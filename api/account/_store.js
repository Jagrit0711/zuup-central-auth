import crypto from "node:crypto";
import { sha256Base64Url } from "../oauth/_utils.js";

const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";

function getDbConfig() {
  return {
    url: (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    usersTable: process.env.ZUUP_USERS_TABLE || "zuup_users",
    codesTable: process.env.ZUUP_EMAIL_CODES_TABLE || "zuup_email_codes",
  };
}

function getHeaders() {
  const cfg = getDbConfig();
  if (!cfg.key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    Accept: "application/json",
  };
}

async function restFetch(path, init = {}) {
  const cfg = getDbConfig();
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init.headers || {}),
    },
  });
  return res;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

export async function pruneOtpCodes() {
  const cfg = getDbConfig();
  const nowIso = new Date().toISOString();

  const expiredQuery = new URLSearchParams({
    expires_at: `lt.${nowIso}`,
  });

  await restFetch(`${cfg.codesTable}?${expiredQuery.toString()}`, {
    method: "DELETE",
  }).catch(() => {});
}

export async function getUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const cfg = getDbConfig();
  const query = new URLSearchParams({
    email: `eq.${normalizedEmail}`,
    select: "*",
    limit: "1",
  });

  const res = await restFetch(`${cfg.usersTable}?${query.toString()}`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

export async function getUserById(id) {
  if (!id) return null;

  const cfg = getDbConfig();
  const query = new URLSearchParams({
    id: `eq.${id}`,
    select: "*",
    limit: "1",
  });

  const res = await restFetch(`${cfg.usersTable}?${query.toString()}`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

export async function createOrUpdateUser({ email, metadata = {}, allowCreate = true }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("invalid_email");
  }

  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    const nextMetadata = {
      ...(existing.user_metadata || {}),
      ...metadata,
    };

    const updateRes = await restFetch(`${getDbConfig().usersTable}?id=eq.${existing.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateRes.ok) {
      const details = await updateRes.text();
      throw new Error(`update_user_failed:${details}`);
    }

    const rows = await updateRes.json();
    return rows?.[0] || existing;
  }

  if (!allowCreate) {
    throw new Error("account_not_found");
  }

  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    user_metadata: metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_sign_in_at: null,
  };

  const insertRes = await restFetch(getDbConfig().usersTable, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(user),
  });

  if (!insertRes.ok) {
    const details = await insertRes.text();
    throw new Error(`create_user_failed:${details}`);
  }

  const rows = await insertRes.json();
  return rows?.[0] || user;
}

export async function updateUserById(id, updates = {}) {
  if (!id) throw new Error("missing_user_id");

  const updateRes = await restFetch(`${getDbConfig().usersTable}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...updates,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!updateRes.ok) {
    const details = await updateRes.text();
    throw new Error(`update_user_failed:${details}`);
  }

  const rows = await updateRes.json();
  return rows?.[0] || null;
}

export async function storeOtpCode({ email, purpose, code, metadata = {}, expiresInMinutes = 24 * 60 }) {
  const normalizedEmail = normalizeEmail(email);
  const codeHash = sha256Base64Url(code);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

  const cfg = getDbConfig();
  const insertRes = await restFetch(cfg.codesTable, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      email: normalizedEmail,
      purpose,
      code_hash: codeHash,
      metadata,
      expires_at: expiresAt,
      attempts: 0,
      consumed_at: null,
      created_at: new Date().toISOString(),
    }),
  });

  if (!insertRes.ok) {
    const details = await insertRes.text();
    throw new Error(`store_code_failed:${details}`);
  }

  const rows = await insertRes.json();
  return rows?.[0] || null;
}

export async function consumeOtpCode({ email, purpose, code }) {
  const normalizedEmail = normalizeEmail(email);
  const codeHash = sha256Base64Url(code);
  const cfg = getDbConfig();

  const query = new URLSearchParams({
    email: `eq.${normalizedEmail}`,
    purpose: `eq.${purpose}`,
    consumed_at: "is.null",
    select: "*",
    order: "created_at.desc",
    limit: "1",
  });

  const res = await restFetch(`${cfg.codesTable}?${query.toString()}`);
  if (!res.ok) {
    const details = await res.text();
    throw new Error(`read_code_failed:${details}`);
  }

  const rows = await res.json();
  const record = rows?.[0];
  if (!record) return { ok: false, error: "code_not_found" };

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await restFetch(`${cfg.codesTable}?id=eq.${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempts: (record.attempts || 0) + 1 }),
    }).catch(() => {});
    return { ok: false, error: "code_expired" };
  }

  if (record.code_hash !== codeHash) {
    await restFetch(`${cfg.codesTable}?id=eq.${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempts: (record.attempts || 0) + 1 }),
    }).catch(() => {});
    return { ok: false, error: "invalid_code" };
  }

  const updateRes = await restFetch(`${cfg.codesTable}?id=eq.${record.id}`, {
    method: "DELETE",
  });

  if (!updateRes.ok) {
    const details = await updateRes.text();
    throw new Error(`consume_code_failed:${details}`);
  }

  return { ok: true, record };
}
