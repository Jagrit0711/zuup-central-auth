const DEFAULT_SUPABASE_PROJECT_URL = "https://qnapwukqhybziduhzpow.supabase.co";

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function resolveTokenEndpoint() {
  if (process.env.ZUUP_TOKEN_URL) return process.env.ZUUP_TOKEN_URL;
  if (process.env.SUPABASE_OAUTH_TOKEN_URL) return process.env.SUPABASE_OAUTH_TOKEN_URL;
  const base = process.env.SUPABASE_URL || DEFAULT_SUPABASE_PROJECT_URL;
  return `${base.replace(/\/+$/, "")}/auth/v1/oauth/token`;
}

function buildTokenAuthHeaders(clientId, clientSecret) {
  const method = (process.env.ZUUP_CLIENT_AUTH_METHOD || "client_secret_basic").trim();
  if (method === "client_secret_post") {
    return { mode: "client_secret_post", headers: {} };
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return {
    mode: "client_secret_basic",
    headers: {
      Authorization: `Basic ${basic}`,
    },
  };
}

function parseBody(req) {
  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return null;
    }
  }
  return body;
}

function resolveClientCredentials(requestClientId) {
  const singleClientId = process.env.ZUUP_CLIENT_ID;
  const singleClientSecret = process.env.ZUUP_CLIENT_SECRET;

  // Simple single-client deployment mode.
  if (singleClientId && singleClientSecret) {
    if (requestClientId && requestClientId !== singleClientId) {
      return { error: "client_id_mismatch", expected: singleClientId, received: requestClientId };
    }
    return { clientId: singleClientId, clientSecret: singleClientSecret };
  }

  // Multi-client mode using JSON mapping in env, example:
  // ZUUP_CLIENT_SECRETS_JSON={"client_id_a":"secret_a","client_id_b":"secret_b"}
  const mapRaw = process.env.ZUUP_CLIENT_SECRETS_JSON;
  if (!mapRaw) {
    return { error: "server_not_configured", missing: ["ZUUP_CLIENT_ID + ZUUP_CLIENT_SECRET or ZUUP_CLIENT_SECRETS_JSON"] };
  }

  if (!requestClientId) {
    return { error: "missing_client_id" };
  }

  try {
    const parsed = JSON.parse(mapRaw);
    const secret = parsed?.[requestClientId];
    if (!secret) return { error: "unknown_client_id", client_id: requestClientId };
    return { clientId: requestClientId, clientSecret: secret };
  } catch {
    return { error: "invalid_client_secret_map" };
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "method_not_allowed",
      method: req.method,
      expected: ["POST", "OPTIONS"],
    });
  }

  const body = parseBody(req);
  if (!body) {
    return res.status(400).json({ error: "invalid_json" });
  }

  const { code, code_verifier, redirect_uri, client_id } = body;
  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({
      error: "missing_required_fields",
      required: ["code", "code_verifier", "redirect_uri"],
    });
  }

  const creds = resolveClientCredentials(client_id);
  if (creds.error) {
    return res.status(400).json(creds);
  }

  const tokenEndpoint = resolveTokenEndpoint();
  const auth = buildTokenAuthHeaders(creds.clientId, creds.clientSecret);
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: creds.clientId,
    code,
    redirect_uri,
    code_verifier,
  });

  if (auth.mode === "client_secret_post") {
    tokenParams.set("client_secret", creds.clientSecret);
  }

  try {
    const upstream = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...auth.headers,
      },
      body: tokenParams,
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    return res.status(upstream.status).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "upstream_unreachable",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
