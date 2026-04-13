import { getSessionCookie, verifySessionToken } from "./_session.js";
import { getUserById } from "./_store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["GET"] });
  }

  const token = getSessionCookie(req);
  if (!token) {
    return res.status(204).end();
  }

  const verified = verifySessionToken(token);
  if (!verified.ok) {
    return res.status(401).json({ error: "invalid_session" });
  }

  const user = await getUserById(verified.payload.sub);
  if (!user) {
    return res.status(401).json({ error: "invalid_session" });
  }

  const session = {
    access_token: token,
    token_type: "Bearer",
    expires_in: 60 * 60 * 24 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    user,
  };

  return res.status(200).json({ user, session, source: "custom" });
}
