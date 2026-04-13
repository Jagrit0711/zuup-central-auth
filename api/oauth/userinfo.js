import { setCorsHeaders, verifyJwtHs256 } from "../../server/oauth/utils.js";

function getSigningSecret() {
  return process.env.ZUUP_OAUTH_SIGNING_SECRET || process.env.ZUUP_CLIENT_SECRET || "";
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["GET", "OPTIONS"] });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "invalid_token", msg: "Missing bearer token" });
  }

  const token = authHeader.slice(7).trim();
  const secret = getSigningSecret();
  if (!secret) {
    return res.status(500).json({ error: "server_not_configured", msg: "Missing signing secret" });
  }

  const verified = verifyJwtHs256(token, secret);
  if (!verified.ok) {
    return res.status(401).json({ error: "invalid_token", details: verified.error });
  }

  const p = verified.payload;
  return res.status(200).json({
    sub: p.sub,
    email: p.email || null,
    name: p.name || null,
    preferred_username: p.preferred_username || null,
    picture: p.picture || null,
    aud: p.aud,
    iss: p.iss,
    scope: p.scope || "",
  });
}
