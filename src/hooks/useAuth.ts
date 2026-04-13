import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

type EmailCodeIntent = "login" | "signup";
type AuthSource = "supabase" | "custom" | null;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function postJsonWithFallback(
  urls: string[],
  payload: Record<string, unknown>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let lastNotFoundError: Error | null = null;

  for (const url of urls) {
    const response = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }),
      timeoutMs,
      timeoutMessage,
    );

    if (response.status === 404) {
      lastNotFoundError = new Error("otp_route_not_found");
      continue;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.message || body?.error || "Request failed");
    }

    return body;
  }

  throw lastNotFoundError || new Error("Request failed");
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authSource, setAuthSource] = useState<AuthSource>(null);

  const hydrateCustomSession = async () => {
    const response = await fetch("/api/account/session", { credentials: "include" });
    if (!response.ok) return false;

    const body = await response.json().catch(() => ({}));
    if (!body?.user || !body?.session) return false;

    setUser(body.user);
    setSession(body.session);
    setAuthSource("custom");
    setLoading(false);
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void hydrateCustomSession()
        .then((hydrated) => {
          if (hydrated) return;
          return supabase.auth.refreshSession().then(({ data }) => {
            if (data?.session) {
              setSession(data.session);
              setUser(data.session.user);
            }
          });
        })
        .catch(() => {
          // Silent refresh for resilience only.
        });
    };

    const start = async () => {
      try {
        const hydrated = await hydrateCustomSession();
        if (cancelled || hydrated) return;

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          (_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            setAuthSource(nextSession ? "supabase" : null);
            setLoading(false);
          }
        );
        subscription = authSubscription;

        supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
          if (cancelled) return;
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          setAuthSource(nextSession ? "supabase" : null);
          setLoading(false);
        });

        document.addEventListener("visibilitychange", onVisibilityChange);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    await fetch("/api/account/logout", { method: "POST", credentials: "include" }).catch(() => {});
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: metadata,
      },
    });
    if (error) throw error;
    return data;
  };

  const sendEmailCode = async (
    email: string,
    intent: EmailCodeIntent,
    metadata?: Record<string, unknown>,
  ) => {
    return postJsonWithFallback(
      ["/api/account/otp-request", "/api/account/otp/request"],
      { email, intent, metadata },
      20000,
      "OTP request timed out after 20 seconds. Check SMTP settings and try again.",
    );
  };

  const verifyEmailCode = async (email: string, token: string, intent: EmailCodeIntent = "login") => {
    const body = await postJsonWithFallback(
      ["/api/account/otp-verify", "/api/account/otp/verify"],
      { email, code: token, intent },
      12000,
      "OTP verification timed out after 12 seconds. Try again.",
    );

    await supabase.auth.signOut().catch(() => {});
    setUser(body.user);
    setSession(body.session);
    setAuthSource("custom");
    return body;
  };

  const signOut = async () => {
    if (authSource === "custom") {
      await fetch("/api/account/logout", { method: "POST", credentials: "include" });
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setSession(null);
      setAuthSource(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (password: string) => {
    if (authSource === "custom") {
      throw new Error("Password updates are not available for OTP-only accounts");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const updateProfile = async (data: Record<string, unknown>) => {
    if (authSource === "custom") {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "update_profile", ...data }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || body?.error || "Failed to update profile");
      }

      setUser(body.user);
      setSession((currentSession) => currentSession ? { ...currentSession, user: body.user } as Session : currentSession);
      return;
    }

    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
  };

  const updateEmail = async (email: string) => {
    if (authSource === "custom") {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "update_email", email }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || body?.error || "Failed to update email");
      }

      setUser(body.user);
      setSession((currentSession) => currentSession ? { ...currentSession, user: body.user } as Session : currentSession);
      return;
    }

    const { error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
  };

  const refreshSession = async () => {
    if (authSource === "custom") {
      const hydrated = await hydrateCustomSession();
      if (!hydrated) throw new Error("No active session");
      return { session, user };
    }

    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    return data;
  };

  return {
    user, session, loading,
    signIn, signUp, signOut,
    sendEmailCode, verifyEmailCode,
    resetPassword, updatePassword,
    updateProfile, updateEmail,
    refreshSession,
  };
}
