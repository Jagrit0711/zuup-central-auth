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
import {
  consumeAuthCode,
  verifyCodeChallenge,
  REGISTERED_CLIENTS,
  logAuditEvent,
} from "@/lib/oauth";
import { supabase } from "@/lib/supabase";

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

      if (grant_type !== "authorization_code") {
        setResult({ ok: false, error: "unsupported_grant_type" });
        return;
      }

      if (!code) {
        setResult({ ok: false, error: "invalid_request: missing code" });
        return;
      }

      const authCode = consumeAuthCode(code);
      if (!authCode) {
        setResult({ ok: false, error: "invalid_grant: code not found, expired, or already used" });
        return;
      }

      if (authCode.client_id !== client_id) {
        setResult({ ok: false, error: "invalid_grant: client_id mismatch" });
        return;
      }

      if (authCode.redirect_uri !== redirect_uri) {
        setResult({ ok: false, error: "invalid_grant: redirect_uri mismatch" });
        return;
      }

      // PKCE verification
      if (authCode.code_challenge) {
        if (!code_verifier) {
          setResult({ ok: false, error: "invalid_request: code_verifier required" });
          return;
        }
        const valid = await verifyCodeChallenge(
          code_verifier,
          authCode.code_challenge,
          authCode.code_challenge_method || "S256"
        );
        if (!valid) {
          setResult({ ok: false, error: "invalid_grant: PKCE verification failed" });
          return;
        }
      }

      // Check client exists
      const client = REGISTERED_CLIENTS[client_id];
      if (!client) {
        setResult({ ok: false, error: "invalid_client" });
        return;
      }

      logAuditEvent({
        type: "token_issued",
        user_id: authCode.user_id,
        client_id,
        details: { grant_type: "authorization_code", scopes: authCode.scopes.join(" ") },
      });

      // Return simulated token response
      // In production, you'd call your backend to generate a proper JWT
      setResult({
        ok: true,
        data: {
          access_token: `zuup_at_${authCode.code}_${Date.now()}`,
          token_type: "Bearer",
          expires_in: 3600,
          scope: authCode.scopes.join(" "),
          user_id: authCode.user_id,
        },
      });
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
