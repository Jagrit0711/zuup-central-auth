import { consumeServerCode } from "./_store.js";
import {
  parseBody,
  resolveClientCredentials,
  setCorsHeaders,
  sha256Base64Url,
  signJwtHs256,
  generateOpaqueToken,
} from "./_utils.js";

const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";

function getIssuer() {
  return process.env.ZUUP_ISSUER || "https://auth.zuup.dev";
}

function getSigningSecret() {
  return process.env.ZUUP_OAUTH_SIGNING_SECRET || process.env.ZUUP_CLIENT_SECRET || "";
}

async function fetchUserProfile(userId) {
  const supabaseUrl = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !userId) return null;

  const url = `${supabaseUrl}/auth/v1/admin/users/${userId}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user || data || null;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST", "OPTIONS"] });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  req.body = body;

  const grantType = body.grant_type || "authorization_code";
  if (grantType !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  const { code, redirect_uri, code_verifier, client_id } = body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: "invalid_request", msg: "Missing code or redirect_uri" });
  }

  const client = await resolveClientCredentials(req, client_id);
  if (client.error) {
    return res.status(401).json({ error: "invalid_client", details: client });
  }

  const authCode = await consumeServerCode(code);
  if (!authCode) {
    return res.status(400).json({ error: "invalid_grant", msg: "Invalid authorization code" });
  }

  if (authCode.client_id !== client.clientId) {
    return res.status(400).json({ error: "invalid_grant", msg: "client_id mismatch" });
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: "invalid_grant", msg: "redirect_uri mismatch" });
  }

  if (authCode.code_challenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: "invalid_request", msg: "code_verifier required" });
    }

    const method = authCode.code_challenge_method || "S256";
    if (method === "plain") {
      if (code_verifier !== authCode.code_challenge) {
        return res.status(400).json({ error: "invalid_grant", msg: "PKCE verification failed" });
      }
    } else {
      const digest = sha256Base64Url(code_verifier);
      if (digest !== authCode.code_challenge) {
        return res.status(400).json({ error: "invalid_grant", msg: "PKCE verification failed" });
      }
    }
  }

  const signingSecret = getSigningSecret();
  if (!signingSecret) {
    return res.status(500).json({ error: "server_not_configured", msg: "Missing signing secret" });
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  const profile = await fetchUserProfile(authCode.user_id);
  const userMeta = profile?.user_metadata || {};
  const payload = {
    iss: getIssuer(),
    sub: authCode.user_id,
    aud: client.clientId,
    iat: now,
    exp: now + expiresIn,
    scope: (authCode.scopes || []).join(" "),
    jti: generateOpaqueToken(12),
    email: profile?.email || null,
    name: userMeta.full_name || null,
    preferred_username: userMeta.username || null,
    picture: userMeta.avatar_url || null,
  };

  const accessToken = signJwtHs256(payload, signingSecret);
  const refreshToken = `zuup_rt_${generateOpaqueToken(24)}`;

  return res.status(200).json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: payload.scope,
  });
}
