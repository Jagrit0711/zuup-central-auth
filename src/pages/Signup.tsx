import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { validateRedirectUri } from "@/lib/supabase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();

  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const state = searchParams.get("state") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, { full_name: fullName });
      toast.success("Check your email to confirm your account!");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
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
