import { parseBody, setCorsHeaders } from "./_utils.js";
import { validateAuthRequestPayload } from "./_clients.js";

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

  const result = await validateAuthRequestPayload(body || {});
  if (!result.ok) {
    return res.status(400).json(result);
  }

  return res.status(200).json(result.data);
}
