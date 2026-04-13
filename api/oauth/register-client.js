import { parseBody, setCorsHeaders } from "../../server/oauth/utils.js";
import { insertClient } from "../../server/oauth/clients.js";

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["POST", "OPTIONS"] });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const {
    client_id,
    client_secret,
    name,
    homepage_url,
    icon_url,
    allowed_redirect_uris,
    allowed_scopes,
    is_first_party,
  } = body || {};

  if (!client_id || !client_secret || !name || !Array.isArray(allowed_redirect_uris) || allowed_redirect_uris.length === 0) {
    return res.status(400).json({
      error: "missing_required_fields",
      required: ["client_id", "client_secret", "name", "allowed_redirect_uris"],
    });
  }

  try {
    const row = await insertClient({
      client_id,
      client_secret,
      name,
      homepage_url,
      icon_url,
      allowed_redirect_uris,
      allowed_scopes: Array.isArray(allowed_scopes) && allowed_scopes.length ? allowed_scopes : ["openid", "profile", "email"],
      is_first_party: Boolean(is_first_party),
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, client: row });
  } catch (error) {
    return res.status(500).json({
      error: "register_client_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
