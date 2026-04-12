import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ZuupLogo } from "@/components/ZuupLogo";
import { OAUTH_ENDPOINTS } from "@/lib/supabase";
import { LogOut, Copy, ExternalLink, Shield, Key, Globe } from "lucide-react";
import { toast } from "sonner";

function EndpointRow({ label, url }: { label: string; url: string }) {
  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} URL copied!`);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/40">
      <span className="text-sm font-medium text-foreground min-w-[160px]">{label}</span>
      <code className="text-xs text-muted-foreground break-all flex-1">{url}</code>
      <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
        <Copy size={14} />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut, session } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <ZuupLogo className="flex-row gap-2 !items-start" />
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut size={16} /> Sign Out
          </Button>
        </div>

        {/* User Info */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full zuup-gradient flex items-center justify-center text-primary-foreground font-semibold">
              {user?.email?.[0]?.toUpperCase() || "Z"}
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.user_metadata?.full_name || "Zuup User"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {session?.access_token && (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Key size={12} /> Access Token
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(session.access_token);
                    toast.success("Token copied!");
                  }}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Copy size={12} />
                </button>
              </div>
              <code className="text-xs text-muted-foreground break-all line-clamp-2">
                {session.access_token}
              </code>
            </div>
          )}
        </div>

        {/* OAuth Endpoints */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="text-primary" size={20} />
            <h2 className="text-lg font-semibold text-foreground">OAuth 2.1 Endpoints</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Share these endpoints with third-party applications to integrate with Zuup Auth.
          </p>

          <div className="space-y-2">
            <EndpointRow label="Authorization" url={OAUTH_ENDPOINTS.authorization} />
            <EndpointRow label="Token" url={OAUTH_ENDPOINTS.token} />
            <EndpointRow label="JWKS" url={OAUTH_ENDPOINTS.jwks} />
            <EndpointRow label="OIDC Discovery" url={OAUTH_ENDPOINTS.oidcDiscovery} />
          </div>
        </div>

        {/* Integration Guide */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="text-primary" size={20} />
            <h2 className="text-lg font-semibold text-foreground">Integration Guide</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            To integrate Zuup Auth into your application:
          </p>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/40 space-y-3">
              <p className="font-medium text-foreground">1. Redirect to Authorization</p>
              <code className="block text-xs bg-background/50 p-3 rounded-md overflow-x-auto">
                {`GET ${OAUTH_ENDPOINTS.authorization}?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT&response_type=code&scope=openid`}
              </code>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/40 space-y-3">
              <p className="font-medium text-foreground">2. Exchange Code for Token</p>
              <code className="block text-xs bg-background/50 p-3 rounded-md overflow-x-auto">
                {`POST ${OAUTH_ENDPOINTS.token}\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT&client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET`}
              </code>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/40 space-y-3">
              <p className="font-medium text-foreground">3. Verify Tokens</p>
              <p>Use the JWKS endpoint to validate JWTs issued by Zuup Auth.</p>
              <a
                href={OAUTH_ENDPOINTS.oidcDiscovery}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                View OIDC Configuration <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
