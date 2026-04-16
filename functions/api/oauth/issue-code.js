import { validateAuthRequestPayload } from "../../../server/oauth/clients.js";

const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const DEFAULT_CODES_TABLE = "oauth_authorization_codes";

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

function getStoreConfig(env) {
  return {
    url: (getEnvValue("SUPABASE_URL", env) || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: getEnvValue("SUPABASE_SERVICE_ROLE_KEY", env),
    table: getEnvValue("ZUUP_OAUTH_CODES_TABLE", env) || DEFAULT_CODES_TABLE,
  };
}

function generateOpaqueToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function insertCode(entry, env) {
  const cfg = getStoreConfig(env);
  if (!cfg.key) {
    throw new Error("missing_supabase_service_role_key");
  }

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(entry),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`code_insert_failed:${res.status}:${txt}`);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("origin") || "*";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed", expected: ["POST", "OPTIONS"] }), {
      status: 405,
      headers: corsHeaders(origin),
    });
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

  const { client_id, redirect_uri, user_id, scopes, code_challenge, code_challenge_method } = body || {};

  if (!client_id || !redirect_uri || !user_id) {
    return new Response(
      JSON.stringify({
        error: "missing_required_fields",
        required: ["client_id", "redirect_uri", "user_id"],
      }),
      {
        status: 400,
        headers: corsHeaders(origin),
      }
    );
  }

  try {
    const scopeString = Array.isArray(scopes) ? scopes.join(" ") : "openid profile email";
    const validation = await validateAuthRequestPayload(
      {
        client_id,
        redirect_uri,
        scope: scopeString,
        response_type: "code",
      },
      env || {}
    );

    if (!validation.ok) {
      return new Response(JSON.stringify(validation), {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    const code = generateOpaqueToken(32);
    const entry = {
      code,
      client_id,
      redirect_uri,
      user_id,
      scopes: Array.isArray(scopes) ? scopes : [],
      code_challenge: code_challenge || null,
      code_challenge_method: code_challenge_method || "S256",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used: false,
      created_at: new Date().toISOString(),
    };

    await insertCode(entry, env || {});

    return new Response(JSON.stringify({ code }), {
      status: 200,
      headers: corsHeaders(origin),
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "code_issue_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}
