import { getSessionCookie, verifySessionToken } from "./_session.js";
import { getUserById, updateUserById } from "./_store.js";
import { parseBody } from "../oauth/_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST"] });
  }

  const token = getSessionCookie(req);
  if (!token) {
    return res.status(401).json({ error: "invalid_session" });
  }

  const verified = verifySessionToken(token);
  if (!verified.ok) {
    return res.status(401).json({ error: "invalid_session" });
  }

  const currentUser = await getUserById(verified.payload.sub);
  if (!currentUser) {
    return res.status(401).json({ error: "invalid_session" });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const action = body.action || "update_profile";

  if (action === "update_password") {
    return res.status(400).json({ error: "unsupported", message: "Password updates are not available for OTP-only accounts" });
  }

  if (action === "update_email") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "invalid_request", message: "email is required" });
    }
    const updated = await updateUserById(currentUser.id, { email });
    return res.status(200).json({ ok: true, user: updated });
  }

  const updates = {};
  const allowedFields = ["full_name", "last_name", "phone", "username", "avatar_url", "security_alerts_enabled"];
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "security_alerts_enabled") {
        updates.user_metadata = {
          ...(currentUser.user_metadata || {}),
          [field]: Boolean(body[field]),
        };
      } else {
        updates.user_metadata = {
          ...(updates.user_metadata || currentUser.user_metadata || {}),
          [field]: body[field],
        };
      }
    }
  }

  const updated = await updateUserById(currentUser.id, updates);
  return res.status(200).json({ ok: true, user: updated });
}
