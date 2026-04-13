import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { logAuditEvent } from "@/lib/oauth";

type SignInMode = "password" | "code";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [signInMode, setSignInMode] = useState<SignInMode>("password");
  const [codeSent, setCodeSent] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [pendingMethod, setPendingMethod] = useState<"email_password" | "email_code" | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const codeSubmitInFlightRef = useRef(false);
  const { signIn, sendEmailCode, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const notifySecurityLogin = async (method: "email_password" | "email_code") => {
    try {
      await fetch("/api/account/security-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "login",
          method,
          email,
          app: "auth.zuup.dev",
        }),
      });
    } catch {
      // Security alert best-effort only.
    }
  };

  useEffect(() => {
    if (signInMode !== "code") return;
    if (mfaRequired) return;
    if (!codeSent || loading) return;
    if (code.length !== 6) return;
    void handleCodeSubmit();
  }, [code, codeSent, loading, mfaRequired, signInMode]);

  const finalizeSignIn = async (method: "email_password" | "email_code", userId?: string) => {
    logAuditEvent({ type: "login", user_id: userId, details: { method } });
    await notifySecurityLogin(method);
    toast.success("Welcome back!");

    const hasOAuthParams = searchParams.has("client_id") && searchParams.has("redirect_uri");
    if (hasOAuthParams) {
      navigate(`/authorize?${searchParams.toString()}`);
      return;
    }

    navigate("/profile");
  };

  const maybeStartMfa = async () => {
    const factorsResult = await supabase.auth.mfa.listFactors();
    if (factorsResult.error) throw factorsResult.error;

    const factors = [
      ...(factorsResult.data?.totp || []),
      ...(factorsResult.data?.all || []),
    ];
    const verifiedFactor = factors.find((factor: any) => factor?.status === "verified");
    if (!verifiedFactor?.id) return false;

    const challenge = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id } as any);
    if (challenge.error) throw challenge.error;

    setMfaFactorId(verifiedFactor.id);
    setMfaChallengeId(challenge.data.id);
    setMfaRequired(true);
    toast.message("Enter your 2FA authenticator code");
    return true;
  };

  const handleMfaVerify = async () => {
    if (!mfaFactorId || !mfaChallengeId) {
      toast.error("Two-factor challenge missing. Sign in again.");
      return;
    }

    if (!/^\d{6}$/.test(mfaCode)) {
      toast.error("Enter a valid 6-digit authenticator code");
      return;
    }

    setLoading(true);
    try {
      const verify = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      } as any);
      if (verify.error) throw verify.error;

      const method = pendingMethod || "email_password";
      const userId = pendingUserId || verify.data?.user?.id;

      setMfaRequired(false);
      setMfaCode("");
      setMfaFactorId(null);
      setMfaChallengeId(null);
      setPendingMethod(null);
      setPendingUserId(null);

      await finalizeSignIn(method, userId || undefined);
    } catch (err: any) {
      toast.error(err.message || "Invalid authenticator code");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (codeSubmitInFlightRef.current) return;
    codeSubmitInFlightRef.current = true;
    setLoading(true);
    try {
      if (!codeSent) {
        throw new Error("Send the 6-digit code first");
      }
      if (!/^\d{6}$/.test(code)) {
        throw new Error("Enter a valid 6-digit code");
      }

      const data = await verifyEmailCode(email, code, "login");
      const method: "email_password" | "email_code" = "email_code";
      setCode("");
      setCodeSent(false);

      const mfaStarted = await maybeStartMfa();
      if (mfaStarted) {
        setPendingMethod(method);
        setPendingUserId(data.user?.id || data.session?.user?.id || null);
        return;
      }

      await finalizeSignIn(method, data.user?.id || data.session?.user?.id);
    } catch (err: any) {
      logAuditEvent({ type: "login_failed", details: { email, reason: err.message } });
      toast.error(err.message || "Invalid code");
    } finally {
      setLoading(false);
      codeSubmitInFlightRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signInMode === "code") {
      await handleCodeSubmit();
      return;
    }

    setLoading(true);
    try {
      const data = await signIn(email, password);
      const method: "email_password" = "email_password";

      const mfaStarted = await maybeStartMfa();
      if (mfaStarted) {
        setPendingMethod(method);
        setPendingUserId(data.user?.id || data.session?.user?.id || null);
        return;
      }

      await finalizeSignIn(method, data.user?.id || data.session?.user?.id);
    } catch (err: any) {
      logAuditEvent({ type: "login_failed", details: { email, reason: err.message } });
      toast.error(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    setSendingCode(true);
    try {
      await sendEmailCode(email, "login");
      setCodeSent(true);
      toast.success("6-digit login code sent to your email");
    } catch (err: any) {
      toast.error(err.message || "Could not send code");
    } finally {
      setSendingCode(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Sign in to Zuup</h1>
          <p className="text-sm text-muted-foreground">Access all Zuup services with one account</p>
        </div>

        <div className="space-y-4">
          <div className="flex rounded-lg border border-border/60 bg-secondary/30 p-1">
            <button
              type="button"
              onClick={() => setSignInMode("password")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${signInMode === "password" ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setSignInMode("code")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${signInMode === "code" ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              6-digit code
            </button>
          </div>

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

          {signInMode === "password" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
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
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="code">Email Code</Label>
                <button type="button" onClick={handleSendCode} className="text-xs text-primary hover:underline" disabled={sendingCode}>
                  {sendingCode ? "Sending..." : codeSent ? "Resend code" : "Send code"}
                </button>
              </div>
              <InputOTP
                id="code"
                maxLength={6}
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                pattern="[0-9]*"
                containerClassName="justify-start"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="h-11 w-11 rounded-md border border-border/70 bg-secondary/40" />
                  <InputOTPSlot index={1} className="h-11 w-11 rounded-md border border-border/70 bg-secondary/40" />
                  <InputOTPSlot index={2} className="h-11 w-11 rounded-md border border-border/70 bg-secondary/40" />
                  <InputOTPSlot index={3} className="h-11 w-11 rounded-md border border-border/70 bg-secondary/40" />
                  <InputOTPSlot index={4} className="h-11 w-11 rounded-md border border-border/70 bg-secondary/40" />
                  <InputOTPSlot index={5} className="h-11 w-11 rounded-md border border-border/70 bg-secondary/40" />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground">Use the 6-digit code sent to your email.</p>
            </div>
          )}

          {mfaRequired && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-secondary/20 p-3">
              <Label htmlFor="mfaCode">Authenticator code</Label>
              <Input
                id="mfaCode"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="Enter 6-digit 2FA code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="bg-secondary/50 border-border/60"
              />
              <p className="text-xs text-muted-foreground">Two-factor authentication is enabled for this account.</p>
            </div>
          )}
        </div>

        <Button
          type={mfaRequired ? "button" : "submit"}
          onClick={mfaRequired ? handleMfaVerify : undefined}
          className="w-full zuup-gradient"
          size="lg"
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          {mfaRequired ? "Verify 2FA" : "Sign In"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
