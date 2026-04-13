import { parseBody } from "../../server/oauth/utils.js";

const SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYXB3dWtxaHliemlkdWh6cG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjA3ODYsImV4cCI6MjA4NzkzNjc4Nn0.x1a-lyiPhBDqR2U-ZAC_waSa-2smUs_KpSGXbK54rp0";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST"] });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const token = String(body.code || body.token || "").trim();

  if (!email || !token) {
    return res.status(400).json({ error: "invalid_request", message: "email and code are required" });
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      token,
      type: "email",
    }),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    return res.status(response.status).json({
      error: responseBody?.error || "otp_verify_failed",
      message: responseBody?.msg || responseBody?.message || "Failed to verify OTP",
      details: responseBody,
    });
  }

  return res.status(200).json(responseBody);
}
