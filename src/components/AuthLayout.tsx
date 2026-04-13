import { ZuupLogo } from "./ZuupLogo";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10 auth-shell-inner">
        <ZuupLogo />

        <div className="glass-card rounded-2xl p-8 zuup-card-glow auth-shell-card">
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Centralized authentication for all Zuup services
        </p>
      </div>
    </div>
  );
}
