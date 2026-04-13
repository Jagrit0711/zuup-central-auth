function parseIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed", expected: ["GET"] });
  }

  const ip = parseIp(req);
  const userAgent = req.headers["user-agent"] || "Unknown browser";

  return res.status(200).json({ ip, userAgent });
}
