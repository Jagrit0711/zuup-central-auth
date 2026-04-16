const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const DEFAULT_CODES_TABLE = "oauth_authorization_codes";
const DEFAULT_CLIENTS_TABLE = "oauth_clients";

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Content-Type": "application/json",
  };
}

function getEnvValue(key, env) {
  if (env && typeof env === "object" && env[key] != null) {
    return String(env[key]);
  }
  if (typeof process !== "undefined" && process?.env?.[key] != null) {
    return process.env[key];
  }
  return "";
}

function getSupabaseConfig(env) {
  return {
    url: (getEnvValue("SUPABASE_URL", env) || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: getEnvValue("SUPABASE_SERVICE_ROLE_KEY", env),
    codesTable: getEnvValue("ZUUP_OAUTH_CODES_TABLE", env) || DEFAULT_CODES_TABLE,
    clientsTable: getEnvValue("ZUUP_OAUTH_CLIENTS_TABLE", env) || DEFAULT_CLIENTS_TABLE,
  };
}

function getIssuer(env) {
  return getEnvValue("ZUUP_ISSUER", env) || "https://auth.zuup.dev";
}

function getSigningSecret(env) {
  return getEnvValue("ZUUP_OAUTH_SIGNING_SECRET", env) || getEnvValue("ZUUP_CLIENT_SECRET", env) || "";
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlEncodeText(text) {
  return base64UrlEncodeBytes(new TextEncoder().encode(text));
}

function base64UrlDecodeToText(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function parseBasicAuthClient(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return { clientId: "", clientSecret: "" };
  if (!authHeader.toLowerCase().startsWith("basic ")) return { clientId: "", clientSecret: "" };

  try {
    const raw = atob(authHeader.slice(6).trim());
    const idx = raw.indexOf(":");
    if (idx < 0) return { clientId: "", clientSecret: "" };
    return {
      clientId: raw.slice(0, idx),
      clientSecret: raw.slice(idx + 1),
    };
  } catch {
    return { clientId: "", clientSecret: "" };
  }
}

async function sha256Base64Url(input) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

async function signJwtHs256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncodeText(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeText(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned));
  const encodedSig = base64UrlEncodeBytes(new Uint8Array(sig));
  return `${unsigned}.${encodedSig}`;
}

function generateOpaqueToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchClientSecret(clientId, env) {
  if (!clientId) return null;
  const cfg = getSupabaseConfig(env);
  if (!cfg.key) return null;

  const query = new URLSearchParams({
    client_id: `eq.${clientId}`,
    select: "client_secret",
    limit: "1",
  });

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.clientsTable}?${query.toString()}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.client_secret || null;
}

async function resolveClientCredentials(request, body, env) {
  const basic = parseBasicAuthClient(request.headers.get("authorization") || "");
  const bodyClientId = body?.client_id || "";
  const bodyClientSecret = body?.client_secret || "";

  const clientId = basic.clientId || bodyClientId;
  const providedSecret = basic.clientSecret || bodyClientSecret;

  const singleClientId = getEnvValue("ZUUP_CLIENT_ID", env);
  const singleClientSecret = getEnvValue("ZUUP_CLIENT_SECRET", env);

  if (!clientId) {
    if (singleClientId && singleClientSecret) {
      return { clientId: singleClientId, clientSecret: singleClientSecret };
    }
    return { error: "invalid_client", msg: "Missing client_id" };
  }

  const dbSecret = await fetchClientSecret(clientId, env);
  if (dbSecret) {
    if (providedSecret && providedSecret !== dbSecret) {
      return { error: "invalid_client", msg: "Invalid client_secret" };
    }
    return { clientId, clientSecret: dbSecret };
  }

  if (singleClientId && singleClientSecret) {
    if (clientId !== singleClientId) {
      return { error: "invalid_client", msg: "client_id mismatch" };
    }
    if (providedSecret && providedSecret !== singleClientSecret) {
      return { error: "invalid_client", msg: "Invalid client_secret" };
    }
    return { clientId: singleClientId, clientSecret: singleClientSecret };
  }

  return { error: "invalid_client", msg: "Unknown client_id" };
}

async function consumeServerCode(code, env) {
  const cfg = getSupabaseConfig(env);
  if (!cfg.key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const selectQuery = new URLSearchParams({
    code: `eq.${code}`,
    limit: "1",
  });

  const getRes = await fetch(`${cfg.url}/rest/v1/${cfg.codesTable}?${selectQuery.toString()}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
    },
  });

  if (!getRes.ok) {
    const txt = await getRes.text();
    throw new Error(`code_fetch_failed:${getRes.status}:${txt}`);
  }

  const rows = await getRes.json();
  const entry = rows?.[0] || null;
  if (!entry) return null;
  if (entry.used) return null;
  if (new Date(entry.expires_at).getTime() <= Date.now()) return null;

  const patchQuery = new URLSearchParams({ code: `eq.${code}` });
  const patchRes = await fetch(`${cfg.url}/rest/v1/${cfg.codesTable}?${patchQuery.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ used: true, consumed_at: new Date().toISOString() }),
  });

  if (!patchRes.ok) {
    const txt = await patchRes.text();
    throw new Error(`code_mark_used_failed:${patchRes.status}:${txt}`);
  }

  return entry;
}

async function fetchUserProfile(userId, env) {
  if (!userId) return null;
  const cfg = getSupabaseConfig(env);
  if (!cfg.key) return null;

  const res = await fetch(`${cfg.url}/auth/v1/admin/users/${userId}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.user || data || null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("origin") || "*";

  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "method_not_allowed", expected: ["POST", "OPTIONS"] }),
        { status: 405, headers: corsHeaders(origin) }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    const grantType = body?.grant_type || "authorization_code";
    if (grantType !== "authorization_code") {
      return new Response(JSON.stringify({ error: "unsupported_grant_type" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    const { code, redirect_uri, code_verifier } = body || {};
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "invalid_request", msg: "Missing code or redirect_uri" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    const client = await resolveClientCredentials(request, body || {}, env || {});
    if (client.error) {
      return new Response(JSON.stringify({ error: "invalid_client", details: client }), {
        status: 401,
        headers: corsHeaders(origin),
      });
    }

    const authCode = await consumeServerCode(code, env || {});
    if (!authCode) {
      return new Response(JSON.stringify({ error: "invalid_grant", msg: "Invalid authorization code" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    if (authCode.client_id !== client.clientId) {
      return new Response(JSON.stringify({ error: "invalid_grant", msg: "client_id mismatch" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    if (authCode.redirect_uri !== redirect_uri) {
      return new Response(JSON.stringify({ error: "invalid_grant", msg: "redirect_uri mismatch" }), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    if (authCode.code_challenge) {
      if (!code_verifier) {
        return new Response(JSON.stringify({ error: "invalid_request", msg: "code_verifier required" }), {
          status: 400,
          headers: corsHeaders(origin),
        });
      }

      const method = authCode.code_challenge_method || "S256";
      if (method === "plain") {
        if (code_verifier !== authCode.code_challenge) {
          return new Response(JSON.stringify({ error: "invalid_grant", msg: "PKCE verification failed" }), {
            status: 400,
            headers: corsHeaders(origin),
          });
        }
      } else {
        const digest = await sha256Base64Url(code_verifier);
        if (digest !== authCode.code_challenge) {
          return new Response(JSON.stringify({ error: "invalid_grant", msg: "PKCE verification failed" }), {
            status: 400,
            headers: corsHeaders(origin),
          });
        }
      }
    }

    const signingSecret = getSigningSecret(env || {});
    if (!signingSecret) {
      return new Response(JSON.stringify({ error: "server_not_configured", msg: "Missing signing secret" }), {
        status: 500,
        headers: corsHeaders(origin),
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const profile = await fetchUserProfile(authCode.user_id, env || {});
    const userMeta = profile?.user_metadata || {};
    const payload = {
      iss: getIssuer(env || {}),
      sub: authCode.user_id,
      aud: client.clientId,
      iat: now,
      exp: now + expiresIn,
      scope: Array.isArray(authCode.scopes) ? authCode.scopes.join(" ") : "",
      jti: generateOpaqueToken(12),
      email: profile?.email || null,
      name: userMeta.full_name || null,
      preferred_username: userMeta.username || null,
      picture: userMeta.avatar_url || null,
    };

    const accessToken = await signJwtHs256(payload, signingSecret);
    const refreshToken = `zuup_rt_${generateOpaqueToken(24)}`;

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        scope: payload.scope,
      }),
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "token_exchange_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
