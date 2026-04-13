import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      await fetch("/api/account/security-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "password_reset_requested",
          method: "email_link",
          email,
          app: "auth.zuup.dev",
        }),
      }).catch(() => {});
      setSent(true);
      toast.success("Reset link sent!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="text-primary" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a password reset link to <strong className="text-foreground">{email}</strong>
          </p>
          <Link to="/login" className="text-primary hover:underline text-sm inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
            <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
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

          <Button type="submit" className="w-full zuup-gradient" size="lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
            Send Reset Link
          </Button>

          <p className="text-center">
            <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
