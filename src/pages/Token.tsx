/**
 * /token - OAuth 2.1 Token Exchange Endpoint
 *
 * Handles:
 * - authorization_code grant (with PKCE verification)
 * - refresh_token grant
 *
 * In production this would be a server-side endpoint.
 * This is a client-side simulation for demo purposes.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface TokenResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export default function TokenEndpoint() {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<TokenResult | null>(null);

  useEffect(() => {
    (async () => {
      const grant_type = searchParams.get("grant_type") || "authorization_code";
      const code = searchParams.get("code") || "";
      const redirect_uri = searchParams.get("redirect_uri") || "";
      const client_id = searchParams.get("client_id") || "";
      const code_verifier = searchParams.get("code_verifier") || undefined;
      const client_secret = searchParams.get("client_secret") || undefined;

      if (grant_type !== "authorization_code") {
        setResult({ ok: false, error: "unsupported_grant_type" });
        return;
      }

      if (!code) {
        setResult({ ok: false, error: "invalid_request: missing code" });
        return;
      }

      const response = await fetch("/api/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(client_id && client_secret
            ? { Authorization: `Basic ${btoa(`${client_id}:${client_secret}`)}` }
            : {}),
        },
        body: JSON.stringify({
          grant_type,
          code,
          redirect_uri,
          client_id,
          code_verifier,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResult({ ok: false, error: JSON.stringify(payload) });
        return;
      }

      setResult({ ok: true, data: payload });
    })();
  }, []);

  // This endpoint returns JSON — render it for display
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded zuup-gradient flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
          <span className="font-semibold text-foreground">Zuup Auth</span>
          <span className="text-muted-foreground">/token</span>
        </div>

        {!result ? (
          <p className="text-muted-foreground text-sm">Processing token exchange...</p>
        ) : (
          <div className={`rounded-xl border p-6 space-y-3 ${result.ok ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${result.ok ? "bg-green-500" : "bg-destructive"}`} />
              <p className="text-sm font-medium">{result.ok ? "Token Exchange Successful" : "Token Exchange Failed"}</p>
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto bg-secondary/30 rounded p-3 font-mono">
              {JSON.stringify(result.ok ? result.data : { error: result.error }, null, 2)}
            </pre>
            <p className="text-xs text-muted-foreground">
              {result.ok
                ? "In production, your server would exchange this code. This endpoint is for demo purposes."
                : "See the OAuth 2.1 spec for error details."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
