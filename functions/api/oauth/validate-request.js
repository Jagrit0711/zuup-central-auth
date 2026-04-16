import { validateAuthRequestPayload } from "../../../server/oauth/clients.js";

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Content-Type": "application/json",
  };
}

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get("origin") || "*";

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

  const result = await validateAuthRequestPayload(body || {});
  if (!result.ok) {
    return new Response(JSON.stringify(result), {
      status: 400,
      headers: corsHeaders(origin),
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: corsHeaders(origin),
  });
}
