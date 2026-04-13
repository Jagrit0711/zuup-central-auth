import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";

type SignupMode = "password" | "code";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [signupMode, setSignupMode] = useState<SignupMode>("password");
  const [codeSent, setCodeSent] = useState(false);
  const codeSubmitInFlightRef = useRef(false);
  const { signUp, sendEmailCode, verifyEmailCode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";

  const notifySecurityLogin = async (method: "email_password" | "email_code") => {
    try {
      await fetch("/api/account/security-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "signup",
          method,
          email,
          app: "auth.zuup.dev",
        }),
      });
    } catch {
      // Best-effort email notification.
    }
  };

  useEffect(() => {
    if (signupMode !== "code") return;
    if (!codeSent || loading) return;
    if (code.length !== 6) return;
    void handleCodeSignup();
  }, [code, codeSent, loading, signupMode]);

  const handleCodeSignup = async () => {
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
      await verifyEmailCode(email, code, "signup");
      setCode("");
      setCodeSent(false);
      await notifySecurityLogin("email_code");
      toast.success("Account created and signed in");
      navigate("/profile");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
      codeSubmitInFlightRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupMode === "code") {
      await handleCodeSignup();
      return;
    }

    setLoading(true);
    try {
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      await signUp(email, password, { full_name: fullName });
      await notifySecurityLogin("email_password");
      toast.success("Check your email to confirm your account!");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Enter your full name first");
      return;
    }

    setSendingCode(true);
    try {
      await sendEmailCode(email, "signup", { full_name: fullName });
      setCodeSent(true);
      toast.success("6-digit signup code sent to your email");
    } catch (err: any) {
      toast.error(err.message || "Could not send code");
    } finally {
      setSendingCode(false);
    }
  };

  // Preserve SSO params in login link
  const loginLink = clientId
    ? `/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    : "/login";

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Create your Zuup account</h1>
          <p className="text-sm text-muted-foreground">One account for all Zuup services</p>
        </div>

        <div className="space-y-4">
          <div className="flex rounded-lg border border-border/60 bg-secondary/30 p-1">
            <button
              type="button"
              onClick={() => setSignupMode("password")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${signupMode === "password" ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setSignupMode("code")}
              className={`flex-1 rounded-md px-3 py-2 text-sm ${signupMode === "code" ? "bg-background text-foreground" : "text-muted-foreground"}`}
            >
              6-digit code
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-secondary/50 border-border/60"
            />
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

          {signupMode === "password" ? (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
        </div>

        <Button type="submit" className="w-full zuup-gradient" size="lg" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
          Create Account
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to={loginLink} className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
