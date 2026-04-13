import { ensureGlobalUser, getUserByEmail, getUserById, updateUserById } from "../../server/account/store.js";
import { parseBody } from "../../server/oauth/utils.js";

const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYXB3dWtxaHliemlkdWh6cG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjA3ODYsImV4cCI6MjA4NzkzNjc4Nn0.x1a-lyiPhBDqR2U-ZAC_waSa-2smUs_KpSGXbK54rp0";

function getAuthConfig() {
  return {
    url: (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    anonKey: process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
  };
}

function getAccessToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function getAuthUser(accessToken) {
  const cfg = getAuthConfig();
  const response = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return { user: null, status: response.status };
  }

  const user = await response.json().catch(() => null);
  return { user, status: 200 };
}

function buildMetadataPatch(body, currentMetadata) {
  const metadata = { ...(currentMetadata || {}) };
  const allowedFields = [
    "full_name",
    "first_name",
    "last_name",
    "name",
    "phone",
    "username",
    "avatar_url",
    "security_alerts_enabled",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      metadata[field] = field === "security_alerts_enabled" ? Boolean(body[field]) : body[field];
    }
  }

  return metadata;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "method_not_allowed", expected: ["GET", "POST", "OPTIONS"] });
  }

  const accessToken = getAccessToken(req);
  if (!accessToken) {
    return res.status(401).json({ error: "invalid_session", message: "Missing bearer token" });
  }

  const { user: authUser, status } = await getAuthUser(accessToken);
  if (!authUser?.id) {
    return res.status(status === 200 ? 401 : status).json({ error: "invalid_session" });
  }

  const normalizedAuthEmail = String(authUser.email || "").trim().toLowerCase();

  let globalUser = await getUserById(authUser.id);
  if (!globalUser && normalizedAuthEmail) {
    // Backward compatibility: older rows were created with random UUIDs.
    globalUser = await getUserByEmail(normalizedAuthEmail);
  }

  if (!globalUser) {
    globalUser = await ensureGlobalUser({
      id: authUser.id,
      email: normalizedAuthEmail,
      metadata: {},
    });
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, user: globalUser });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }

  const nextMetadata = buildMetadataPatch(body, globalUser?.user_metadata || {});
  const updated = await updateUserById(authUser.id, {
    email: String(body.email || globalUser?.email || normalizedAuthEmail || "").trim().toLowerCase() || globalUser.email,
    user_metadata: nextMetadata,
  });

  const latest = updated || await getUserById(authUser.id);
  return res.status(200).json({ ok: true, user: latest });
}
