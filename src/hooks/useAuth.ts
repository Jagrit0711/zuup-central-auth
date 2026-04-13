import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

type EmailCodeIntent = "login" | "signup";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.auth.refreshSession()
        .then(({ data }) => {
          if (data?.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        })
        .catch(() => {
          // Silent refresh for resilience only.
        });
    };

    const start = async () => {
      try {
        if (cancelled) return;

        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          (_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            setLoading(false);
          }
        );
        subscription = authSubscription;

        supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
          if (cancelled) return;
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
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
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: intent === "signup",
        data: {
          intent,
          ...metadata,
        },
      },
    });

    if (error) throw error;
    return data;
  };

  const verifyEmailCode = async (email: string, token: string, intent: EmailCodeIntent = "login") => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) throw error;

    if (data.session) {
      setUser(data.session.user);
      setSession(data.session);
    }

    return data;
  };

  const signOut = async () => {
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
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const updateProfile = async (data: Record<string, unknown>) => {
    const mergedMetadata = {
      ...(user?.user_metadata || {}),
      ...data,
    };

    const { error } = await supabase.auth.updateUser({ data: mergedMetadata });
    if (error) throw error;

    const { data: refreshed } = await supabase.auth.getUser();
    if (refreshed?.user) {
      setUser(refreshed.user);
      setSession((currentSession) => currentSession ? { ...currentSession, user: refreshed.user } as Session : currentSession);
    }
  };

  const updateEmail = async (email: string) => {
    const { data, error } = await supabase.auth.updateUser({ email });
    if (error) throw error;
    return data;
  };

  const refreshSession = async () => {
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
