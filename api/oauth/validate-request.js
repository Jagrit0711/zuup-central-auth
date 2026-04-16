import { validateAuthRequestPayload } from "../../../server/oauth/clients.js";

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  };
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get("origin") || "*";
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function onRequestPost({ request }) {
  const origin = request.headers.get("origin") || "*";
  const headers = corsHeaders(origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const result = await validateAuthRequestPayload(body || {});
  if (!result.ok) {
    return new Response(JSON.stringify(result), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result.data), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
