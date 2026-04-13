import { createOrUpdateUser, consumeOtpCode, getUserByEmail } from "../../server/account/store.js";
import { createSessionToken, setSessionCookie } from "../../server/account/session.js";
import { parseBody } from "../../server/oauth/utils.js";

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
  const code = String(body.code || "").trim();
  const intent = body.intent === "signup" ? "signup" : "login";
  const metadata = body.metadata || {};

  if (!email || !code) {
    return res.status(400).json({ error: "invalid_request", message: "email and code are required" });
  }

  const consumed = await consumeOtpCode({ email, purpose: intent, code });
  if (!consumed.ok) {
    const status = consumed.error === "code_expired" ? 400 : 401;
    return res.status(status).json({ error: consumed.error, message: "Invalid or expired code" });
  }

  let user = await getUserByEmail(email);
  if (!user) {
    if (intent !== "signup") {
      return res.status(404).json({ error: "account_not_found", message: "No account found for this email" });
    }
    user = await createOrUpdateUser({ email, metadata, allowCreate: true });
  }

  const nowIso = new Date().toISOString();
  const userUpdate = {
    last_sign_in_at: nowIso,
  };

  if (intent === "signup") {
    userUpdate.user_metadata = {
      ...(user.user_metadata || {}),
      ...metadata,
    };
  }

  const mergedUser = {
    ...user,
    ...userUpdate,
    user_metadata: userUpdate.user_metadata || user.user_metadata || {},
  };

  const sessionToken = createSessionToken(mergedUser);
  setSessionCookie(res, sessionToken);

  return res.status(200).json({
    ok: true,
    user: mergedUser,
    session: {
      access_token: sessionToken,
      token_type: "Bearer",
      expires_in: 60 * 60 * 24 * 30,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      user: mergedUser,
    },
  });
}
