import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { validateRedirectUri } from "@/lib/supabase";
import type { RegisteredApp } from "@/lib/supabase";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { LogIn, Eye, EyeOff, Loader2, Shield, AlertTriangle } from "lucide-react";

/**
 * SSO Authorize Page
 * 
 * Flow:
 * 1. Third-party app redirects here: /authorize?client_id=zuupcode&redirect_uri=https://code.zuup.dev/callback
 * 2. If user is already logged in → auto-redirect back with access_token
 * 3. If not logged in → show login form → after login → redirect back
 */
export default function Authorize() {
  const [searchParams] = useSearchParams();
  const { user, session, loading, signIn } = useAuth();
  const navigate = useNavigate();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";

  const [app, setApp] = useState<RegisteredApp | null>(null);
  const [invalid, setInvalid] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validate the app on mount
  useEffect(() => {
    if (!clientId || !redirectUri) {
      setInvalid(true);
      return;
    }
    const validApp = validateRedirectUri(clientId, redirectUri);
    if (!validApp) {
      setInvalid(true);
      return;
    }
    setApp(validApp);
  }, [clientId, redirectUri]);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!loading && user && session && app && redirectUri) {
      redirectToApp(session.access_token, session.refresh_token || "");
    }
  }, [loading, user, session, app, redirectUri]);

  function redirectToApp(accessToken: string, refreshToken: string) {
    const url = new URL(redirectUri);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("refresh_token", refreshToken);
    url.searchParams.set("token_type", "bearer");
    url.searchParams.set("expires_in", "3600");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await signIn(email, password);
      toast.success("Authenticated!");
      // Session will be set by onAuthStateChange, which triggers auto-redirect
      if (data.session) {
        redirectToApp(data.session.access_token, data.session.refresh_token || "");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (invalid) {
    return (
      <AuthLayout>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="text-destructive" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Invalid Authorization Request</h1>
          <p className="text-sm text-muted-foreground">
            The application that sent you here provided invalid or missing parameters.
            {!clientId && " Missing client_id."}
            {!redirectUri && " Missing redirect_uri."}
            {clientId && redirectUri && " Unrecognized app or redirect URI."}
          </p>
          <Button variant="ghost" onClick={() => navigate("/profile")} className="text-primary">
            Go to Zuup Auth
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Show login with app context
  return (
    <AuthLayout>
      <form onSubmit={handleLogin} className="space-y-5">
        {/* App requesting auth */}
        {app && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40">
            <Shield className="text-primary shrink-0" size={20} />
            <div className="text-sm">
              <span className="text-muted-foreground">Sign in to continue to </span>
              <span className="font-semibold text-foreground">{app.name}</span>
            </div>
          </div>
        )}

        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Sign in with Zuup</h1>
          <p className="text-sm text-muted-foreground">Use your Zuup account to continue</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary/50 border-border/60"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to={`/forgot-password?redirect=${encodeURIComponent(window.location.href)}`} className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-secondary/50 border-border/60 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full zuup-gradient" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          Continue to {app?.name || "App"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            to={`/signup?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`}
            className="text-primary hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
