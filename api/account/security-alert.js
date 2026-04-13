function getIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendViaResend({ to, from, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { skipped: true, reason: "missing_resend_api_key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, from, subject, html }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`resend_failed:${details}`);
  }

  return { skipped: false };
}

async function shouldSendAlert(email) {
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !email) return true;

  const query = new URLSearchParams({
    email,
  });

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?${query.toString()}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) return true;
  const data = await response.json();
  const first = Array.isArray(data?.users) ? data.users[0] : Array.isArray(data) ? data[0] : null;
  const enabled = first?.user_metadata?.security_alerts_enabled;
  return enabled !== false;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST", "OPTIONS"] });
  }

  const body = parseBody(req);
  const event = body.event || "login";
  const method = body.method || "email_password";
  const email = body.email;
  const app = body.app || "Zuup Auth";

  if (!email) {
    return res.status(400).json({ error: "invalid_request", message: "email is required" });
  }

  const ip = getIp(req);
  const ua = req.headers["user-agent"] || "Unknown browser";
  const time = new Date().toISOString();

  const from = process.env.SECURITY_ALERT_FROM_EMAIL || "Zuup Security <security@zuup.dev>";
  const subject = `Security alert: ${event} on your account`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:620px;margin:0 auto">
      <h2 style="margin:0 0 12px">New ${escapeHtml(event)} detected</h2>
      <p style="margin:0 0 12px">We detected a new ${escapeHtml(event)} on your account.</p>
      <table style="border-collapse:collapse;width:100%;margin:12px 0 16px">
        <tr><td style="padding:8px;border:1px solid #e5e7eb">App</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(app)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Method</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(method)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">IP Address</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(ip)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">User Agent</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(ua)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb">Time</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(time)}</td></tr>
      </table>
      <p style="margin:0;color:#6b7280">If this was not you, reset your password immediately and review connected apps.</p>
    </div>
  `;

  try {
    const enabled = await shouldSendAlert(email);
    if (!enabled) {
      return res.status(202).json({ ok: true, delivery: { skipped: true, reason: "alerts_disabled" } });
    }

    const delivery = await sendViaResend({ to: email, from, subject, html });
    return res.status(delivery.skipped ? 202 : 200).json({ ok: true, delivery });
  } catch (error) {
    return res.status(500).json({ error: "email_send_failed", message: error.message });
  }
}
