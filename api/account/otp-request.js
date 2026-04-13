import nodemailer from "nodemailer";
import { createOrUpdateUser, generateOtpCode, getUserByEmail, normalizeEmail, pruneOtpCodes, storeOtpCode } from "./_store.js";
import { parseBody } from "../oauth/_utils.js";

function getMailConfig() {
  return {
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER || process.env.OUTBOUND_SMTP_USER || "",
      pass: process.env.SMTP_PASS || process.env.OUTBOUND_SMTP_PASS || "",
    },
  };
}

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.OUTBOUND_SMTP_FROM || "noreply@zuup.dev";
}

async function sendOtpEmail({ to, code, purpose }) {
  const transporter = nodemailer.createTransport(getMailConfig());
  const subject = purpose === "signup" ? "Your Zuup signup code" : "Your Zuup sign in code";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <h2 style="margin:0 0 16px">Your Zuup verification code</h2>
      <p style="font-size:15px;line-height:1.6">Use this 6-digit code to finish signing in:</p>
      <div style="font-size:36px;letter-spacing:10px;font-weight:700;padding:18px 22px;margin:20px 0;border:1px solid #e5e7eb;border-radius:14px;background:#f9fafb;text-align:center">${code}</div>
      <p style="font-size:13px;color:#6b7280;line-height:1.6">This code expires in 24 hours. If you did not request it, you can ignore this message.</p>
    </div>
  `;

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });
}

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

  const email = normalizeEmail(body.email);
  const intent = body.intent === "signup" ? "signup" : "login";
  const metadata = body.metadata || {};

  if (!email) {
    return res.status(400).json({ error: "invalid_request", message: "email is required" });
  }

  const existing = await getUserByEmail(email);
  if (intent === "login" && !existing) {
    return res.status(404).json({ error: "account_not_found", message: "No account found for this email" });
  }

  const user = intent === "signup"
    ? await createOrUpdateUser({ email, metadata, allowCreate: true })
    : existing;

  const code = generateOtpCode();
  try {
    await pruneOtpCodes();
    await storeOtpCode({ email, purpose: intent, code, metadata });
    await sendOtpEmail({ to: email, code, purpose: intent });
  } catch (error) {
    return res.status(500).json({ error: "otp_send_failed", message: error.message });
  }

  return res.status(200).json({ ok: true, sent: true, user_id: user?.id || null });
}
