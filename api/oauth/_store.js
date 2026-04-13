import { generateOpaqueToken } from "./_utils.js";

const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const DEFAULT_TABLE = "oauth_authorization_codes";
const memStore = new Map();

function getStoreConfig() {
  return {
    url: (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    table: process.env.ZUUP_OAUTH_CODES_TABLE || DEFAULT_TABLE,
  };
}

function hasSupabaseStore() {
  const cfg = getStoreConfig();
  return Boolean(cfg.url && cfg.key);
}

async function supabaseInsertCode(entry) {
  const cfg = getStoreConfig();
  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(entry),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase_insert_failed:${res.status}:${txt}`);
  }
}

async function supabaseGetCode(code) {
  const cfg = getStoreConfig();
  const query = new URLSearchParams({
    code: `eq.${code}`,
    limit: "1",
  });

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?${query.toString()}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase_select_failed:${res.status}:${txt}`);
  }

  const rows = await res.json();
  return rows[0] || null;
}

async function supabaseMarkUsed(code) {
  const cfg = getStoreConfig();
  const query = new URLSearchParams({
    code: `eq.${code}`,
  });

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?${query.toString()}`, {
    method: "PATCH",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ used: true, consumed_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`supabase_mark_used_failed:${res.status}:${txt}`);
  }
}

export async function issueServerCode(data) {
  const code = generateOpaqueToken(32);
  const entry = {
    code,
    client_id: data.client_id,
    redirect_uri: data.redirect_uri,
    user_id: data.user_id,
    scopes: data.scopes,
    code_challenge: data.code_challenge || null,
    code_challenge_method: data.code_challenge_method || "S256",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    used: false,
    created_at: new Date().toISOString(),
  };

  if (hasSupabaseStore()) {
    await supabaseInsertCode(entry);
    return code;
  }

  memStore.set(code, entry);
  return code;
}

export async function consumeServerCode(code) {
  if (hasSupabaseStore()) {
    const entry = await supabaseGetCode(code);
    if (!entry) return null;
    if (entry.used) return null;
    if (new Date(entry.expires_at).getTime() <= Date.now()) return null;
    await supabaseMarkUsed(code);
    return entry;
  }

  const entry = memStore.get(code);
  if (!entry) return null;
  if (entry.used) return null;
  if (new Date(entry.expires_at).getTime() <= Date.now()) return null;
  entry.used = true;
  memStore.set(code, entry);
  return entry;
}
