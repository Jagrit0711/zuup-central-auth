import crypto from "node:crypto";

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const bodyRaw = typeof req.body === "string" ? req.body : "";
  const contentType = (req.headers["content-type"] || "").toLowerCase();

  if (!bodyRaw) return {};

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(bodyRaw);
    } catch {
      throw new Error("invalid_json");
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(bodyRaw);
    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(bodyRaw);
  } catch {
    return {};
  }
}

export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const normalized = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(normalized, "base64").toString("utf8");
}

export function sha256Base64Url(input) {
  const digest = crypto.createHash("sha256").update(input).digest();
  return base64UrlEncode(digest);
}

export function signJwtHs256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsigned)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsigned}.${signature}`;
}

export function verifyJwtHs256(token, secret) {
  if (!token || typeof token !== "string") return { ok: false, error: "invalid_token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "invalid_token" };

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(unsigned)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (expectedSig !== encodedSig) {
    return { ok: false, error: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && now > payload.exp) {
      return { ok: false, error: "token_expired" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "invalid_payload" };
  }
}

function getClientsTableConfig() {
  return {
    url: (process.env.SUPABASE_URL || "https://qnapwukqhybziduhzpow.supabase.co").replace(/\/+$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    table: process.env.ZUUP_OAUTH_CLIENTS_TABLE || "oauth_clients",
  };
}

async function getClientSecretFromDb(clientId) {
  const cfg = getClientsTableConfig();
  if (!cfg.key) return null;

  const query = new URLSearchParams({
    client_id: `eq.${clientId}`,
    select: "client_secret",
    limit: "1",
  });

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?${query.toString()}`, {
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

export async function resolveClientCredentials(req, bodyClientId) {
  const authHeader = req.headers.authorization || "";
  let basicClientId = "";
  let basicClientSecret = "";

  if (authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const raw = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
      const idx = raw.indexOf(":");
      if (idx >= 0) {
        basicClientId = raw.slice(0, idx);
        basicClientSecret = raw.slice(idx + 1);
      }
    } catch {
      return { error: "invalid_authorization_header" };
    }
  }

  const singleClientId = process.env.ZUUP_CLIENT_ID;
  const singleClientSecret = process.env.ZUUP_CLIENT_SECRET;
  const rawMap = process.env.ZUUP_CLIENT_SECRETS_JSON;

  const clientId = basicClientId || bodyClientId || "";
  const clientSecret = basicClientSecret || req.body?.client_secret;

  if (!clientId) {
    if (singleClientId && singleClientSecret) {
      return { clientId: singleClientId, clientSecret: singleClientSecret };
    }
    return { error: "invalid_client", msg: "Missing client_id" };
  }

  if (rawMap) {
    let map;
    try {
      map = JSON.parse(rawMap);
    } catch {
      return { error: "server_not_configured", msg: "Invalid ZUUP_CLIENT_SECRETS_JSON" };
    }

    const expected = map[clientId];
    if (expected) {
      if (clientSecret && clientSecret !== expected) {
        return { error: "invalid_client", msg: "Invalid client_secret" };
      }
      return { clientId, clientSecret: expected };
    }
  }

  const dbSecret = await getClientSecretFromDb(clientId);
  if (dbSecret) {
    if (clientSecret && clientSecret !== dbSecret) {
      return { error: "invalid_client", msg: "Invalid client_secret" };
    }
    return { clientId, clientSecret: dbSecret };
  }

  if (singleClientId && singleClientSecret) {
    if (clientId !== singleClientId) {
      return {
        error: "invalid_client",
        msg: "client_id mismatch",
        hint: "Remove ZUUP_CLIENT_ID/ZUUP_CLIENT_SECRET when using multi-client mode",
      };
    }
    if (clientSecret && clientSecret !== singleClientSecret) {
      return { error: "invalid_client", msg: "client_secret mismatch" };
    }
    return { clientId: singleClientId, clientSecret: singleClientSecret };
  }

  return { error: "invalid_client", msg: "Unknown client_id" };
}
