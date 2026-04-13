import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  buildSuccessRedirect,
  buildErrorRedirect,
  logAuditEvent,
  SCOPE_DESCRIPTIONS,
  type OAuthScope,
  type ValidatedRequest,
} from "@/lib/oauth";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  LogIn, Eye, EyeOff, Loader2, Shield, AlertTriangle,
  Check, X, ExternalLink, Lock, Fingerprint, User, Mail,
  RefreshCw, Eye as EyeIcon, Edit, ShieldCheck,
} from "lucide-react";

const SCOPE_ICONS: Record<string, React.ReactNode> = {
  fingerprint: <Fingerprint size={15} />,
  user: <User size={15} />,
  mail: <Mail size={15} />,
  "refresh-cw": <RefreshCw size={15} />,
  eye: <EyeIcon size={15} />,
  edit: <Edit size={15} />,
  shield: <ShieldCheck size={15} />,
};

function getHostname(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export default function Authorize() {
  const [searchParams] = useSearchParams();
  const { user, session, loading, signIn } = useAuth();

  const [validatedReq, setValidatedReq] = useState<ValidatedRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"validating" | "login" | "consent" | "redirecting" | "error">("validating");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Validate the request parameters
  useEffect(() => {
    const payload = Object.fromEntries(searchParams.entries());
    fetch("/api/oauth/validate-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body?.error || "Invalid request");
          setPhase("error");
          return;
        }
        setValidatedReq(body);
      })
      .catch((err) => {
        setError(err?.message || "Failed to validate request");
        setPhase("error");
      });
  }, [searchParams]);

  // Step 2: If already logged in, go straight to consent (or auto-approve for first-party)
  useEffect(() => {
    if (!validatedReq || loading) return;

    if (user && session) {
      if (validatedReq.client.is_first_party) {
        // First-party apps skip consent screen
        void issueCodeAndRedirect(validatedReq, session.user.id).catch((err) => {
          setError(err?.message || "Failed to continue authorization");
          setPhase("error");
        });
      } else {
        setPhase("consent");
      }
    } else {
      setPhase("login");
    }
  }, [validatedReq, user, session, loading]);

  async function issueCodeAndRedirect(req: ValidatedRequest, userId: string) {
    setPhase("redirecting");
    const response = await fetch("/api/oauth/issue-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: req.client.client_id,
        redirect_uri: req.redirect_uri,
        user_id: userId,
        scopes: req.scopes,
        code_challenge: req.code_challenge,
        code_challenge_method: req.code_challenge_method,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || "Failed to issue authorization code");
    }

    const { code } = await response.json();

    logAuditEvent({
      type: "token_issued",
      user_id: userId,
      client_id: req.client.client_id,
      details: { scopes: req.scopes.join(" "), flow: "authorization_code" },
    });

    const redirectUrl = buildSuccessRedirect(req.redirect_uri, code, req.state);
    window.location.href = redirectUrl;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatedReq) return;
    setSubmitting(true);
    try {
      const data = await signIn(email, password);
      toast.success("Authenticated!");
      if (data.session) {
        if (validatedReq.client.is_first_party) {
          await issueCodeAndRedirect(validatedReq, data.session.user.id);
        } else {
          setPhase("consent");
        }
      }
    } catch (err: any) {
      logAuditEvent({ type: "login_failed", details: { email, reason: err.message } });
      toast.error(err.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsent = async (granted: boolean) => {
    if (!validatedReq || !user) return;

    if (!granted) {
      const errorUrl = buildErrorRedirect(
        validatedReq.redirect_uri,
        "access_denied",
        "The user denied the request",
        validatedReq.state
      );
      window.location.href = errorUrl;
      return;
    }

    logAuditEvent({ type: "consent_granted", user_id: user.id, client_id: validatedReq.client.client_id });
    try {
      await issueCodeAndRedirect(validatedReq, user.id);
    } catch (err: any) {
      setError(err?.message || "Failed to continue authorization");
      setPhase("error");
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading || (phase === "validating" && !error) || phase === "redirecting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        {phase === "redirecting" && (
          <p className="text-sm text-muted-foreground animate-pulse">Redirecting you back safely...</p>
        )}
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error || !validatedReq) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="text-destructive" size={26} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Invalid Request</h1>
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-left">
            <p className="text-sm text-destructive font-mono">{error}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            The application that sent you here provided invalid parameters. Please contact the app developer.
          </p>
        </div>
      </AuthLayout>
    );
  }

  // ─── Login Phase ─────────────────────────────────────────────────────────────
  if (phase === "login") {
    return (
      <AuthLayout>
        <form onSubmit={handleLogin} className="space-y-5">
          {/* App context banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/40">
            {validatedReq.client.icon_url && (
              <img
                src={validatedReq.client.icon_url}
                alt={validatedReq.client.name}
                className="w-8 h-8 rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="text-sm flex-1 min-w-0">
              <span className="text-muted-foreground">Sign in to continue to </span>
              <span className="font-semibold text-foreground">{validatedReq.client.name}</span>
            </div>
            <Lock size={14} className="text-muted-foreground shrink-0" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Sign in with Zuup</h1>
            <p className="text-sm text-muted-foreground">Use your Zuup account to continue</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="bg-secondary/50 border-border/60" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="bg-secondary/50 border-border/60 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full zuup-gradient" size="lg" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            Continue to {validatedReq.client.name}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to={`/signup?${searchParams.toString()}`}
              className="text-primary hover:underline font-medium"
            >Sign up</Link>
          </p>

          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-px bg-border/40" />
            <p className="text-xs text-muted-foreground">Secured by Zuup Auth</p>
            <div className="flex-1 h-px bg-border/40" />
          </div>
        </form>
      </AuthLayout>
    );
  }

  // ─── Consent Phase ───────────────────────────────────────────────────────────
  if (phase === "consent") {
    const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
    const initial = displayName[0]?.toUpperCase() || "Z";
    const appHostname = getHostname(validatedReq.client.homepage_url);
    const hasValidHomepage = Boolean(appHostname);

    return (
      <AuthLayout>
        <div className="space-y-5">
          {/* App identity */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                {validatedReq.client.icon_url ? (
                  <img src={validatedReq.client.icon_url} alt="" className="w-8 h-8 rounded" />
                ) : (
                  <Shield className="text-primary" size={24} />
                )}
              </div>
              <div className="flex flex-col items-start">
                <p className="font-semibold text-foreground">{validatedReq.client.name}</p>
                {hasValidHomepage && validatedReq.client.homepage_url && (
                  <a href={validatedReq.client.homepage_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5">
                    {appHostname}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">wants to access your Zuup account</p>
          </div>

          {/* Who you're authorizing as */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/40">
            <div className="w-8 h-8 rounded-full zuup-gradient flex items-center justify-center text-sm font-bold text-primary-foreground">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button onClick={() => setPhase("login")}
              className="text-xs text-primary hover:underline">Switch</button>
          </div>

          {/* Scopes being requested */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">This app will be able to:</p>
            <div className="space-y-1.5">
              {validatedReq.scopes.map((scope) => {
                const info = SCOPE_DESCRIPTIONS[scope];
                if (!info) return null;
                return (
                  <div key={scope} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="text-primary shrink-0 w-5 flex justify-center">
                      {SCOPE_ICONS[info.icon]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{info.label}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </div>
                    <Check size={14} className="text-green-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scopes NOT requested (trust indicators) */}
          {!validatedReq.scopes.includes("zuup:admin") && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/20">
              <Shield size={13} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                {validatedReq.client.name} cannot access your password or delete your account.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => handleConsent(false)}>
              <X size={16} /> Deny
            </Button>
            <Button className="flex-1 zuup-gradient" onClick={() => handleConsent(true)}>
              <Check size={16} /> Allow
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            By clicking Allow, you authorize {validatedReq.client.name} to use your account in accordance with their{" "}
            {hasValidHomepage && validatedReq.client.homepage_url ? (
              <a href={validatedReq.client.homepage_url} className="text-primary hover:underline">terms of service</a>
            ) : (
              <span>terms of service</span>
            )}
            .
          </p>
        </div>
      </AuthLayout>
    );
  }

  return null;
}
