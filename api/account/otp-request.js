import { parseBody } from "../../server/oauth/utils.js";

const SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYXB3dWtxaHliemlkdWh6cG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjA3ODYsImV4cCI6MjA4NzkzNjc4Nn0.x1a-lyiPhBDqR2U-ZAC_waSa-2smUs_KpSGXbK54rp0";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, apikey, authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST", "OPTIONS"] });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const email = normalizeEmail(body.email);
  const intent = body.intent === "signup" ? "signup" : "login";
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!email) {
    return res.status(400).json({ error: "invalid_request", message: "email is required" });
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      create_user: intent === "signup",
      data: {
        intent,
        ...metadata,
      },
    }),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    return res.status(response.status).json({
      error: responseBody?.error || "otp_send_failed",
      message: responseBody?.msg || responseBody?.message || "Failed to send OTP",
      details: responseBody,
    });
  }

  return res.status(200).json({ ok: true, sent: true, supabase: responseBody });
}
