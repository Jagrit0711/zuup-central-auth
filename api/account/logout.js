import { clearSessionCookie } from "../../server/account/session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST"] });
  }

  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
