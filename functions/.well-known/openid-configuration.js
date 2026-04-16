function getEnvValue(key, env) {
  if (env && typeof env === "object" && env[key] != null) {
    return String(env[key]);
  }
  if (typeof process !== "undefined" && process?.env?.[key] != null) {
    return process.env[key];
  }
  return "";
}

function jsonHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300",
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get("origin") || "*";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders(origin) });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed", expected: ["GET", "OPTIONS"] }), {
      status: 405,
      headers: jsonHeaders(origin),
    });
  }

  const issuer = (getEnvValue("ZUUP_ISSUER", env) || "https://auth.zuup.dev").replace(/\/+$/, "");

  return new Response(
    JSON.stringify({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
      code_challenge_methods_supported: ["S256", "plain"],
      scopes_supported: ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write", "zuup:admin"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["HS256"],
    }),
    {
      status: 200,
      headers: jsonHeaders(origin),
    }
  );
}
