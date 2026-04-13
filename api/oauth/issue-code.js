import { issueServerCode } from "../../server/oauth/store.js";
import { parseBody, setCorsHeaders } from "../../server/oauth/utils.js";

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
    redirect_uri,
    user_id,
    scopes,
    code_challenge,
    code_challenge_method,
  } = body || {};

  if (!client_id || !redirect_uri || !user_id) {
    return res.status(400).json({
      error: "missing_required_fields",
      required: ["client_id", "redirect_uri", "user_id"],
    });
  }

  try {
    const code = await issueServerCode({
      client_id,
      redirect_uri,
      user_id,
      scopes: Array.isArray(scopes) ? scopes : [],
      code_challenge,
      code_challenge_method,
    });

    return res.status(200).json({ code });
  } catch (error) {
    return res.status(500).json({
      error: "code_issue_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
