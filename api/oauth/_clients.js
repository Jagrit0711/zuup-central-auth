const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";

const STATIC_CLIENTS = {
  "0d810775-7d53-4c4d-b44e-2a39f7fb1741": {
    client_id: "0d810775-7d53-4c4d-b44e-2a39f7fb1741",
    name: "Zuup Auth OAuth App",
    icon_url: "https://www.zuup.dev/favicon.ico",
    homepage_url: "https://www.zuup.dev",
    allowed_redirect_uris: [
      "https://www.zuup.dev/callback",
      "https://code.zuup.dev/callback",
      "https://watch.zuup.dev/auth/zuup/callback",
      "http://localhost:3000/callback",
      "http://localhost:5173/callback",
    ],
    allowed_scopes: ["openid", "profile", "email", "offline_access", "zuup:read"],
    is_first_party: false,
  },
  zuupcode: {
    client_id: "zuupcode",
    name: "ZuupCode",
    icon_url: "https://code.zuup.dev/favicon.ico",
    homepage_url: "https://code.zuup.dev",
    allowed_redirect_uris: [
      "https://code.zuup.dev/callback",
      "https://code.zuup.dev/auth/callback",
      "https://watch.zuup.dev/auth/zuup/callback",
      "http://localhost:3000/callback",
      "http://localhost:5173/callback",
    ],
    allowed_scopes: ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write"],
    is_first_party: true,
  },
  zuuptime: {
    client_id: "zuuptime",
    name: "ZuupTime",
    icon_url: "https://time.zuup.dev/favicon.ico",
    homepage_url: "https://time.zuup.dev",
    allowed_redirect_uris: [
      "https://time.zuup.dev/callback",
      "https://time.zuup.dev/auth/callback",
      "http://localhost:3000/callback",
    ],
    allowed_scopes: ["openid", "profile", "email", "zuup:read"],
    is_first_party: true,
  },
  zuupdev: {
    client_id: "zuupdev",
    name: "Zuup",
    icon_url: "https://www.zuup.dev/favicon.ico",
    homepage_url: "https://www.zuup.dev",
    allowed_redirect_uris: [
      "https://www.zuup.dev/callback",
      "https://zuup.dev/callback",
      "http://localhost:3000/callback",
    ],
    allowed_scopes: ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write", "zuup:admin"],
    is_first_party: true,
  },
};

function getDbConfig() {
  return {
    url: (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    table: process.env.ZUUP_OAUTH_CLIENTS_TABLE || "oauth_clients",
  };
}

function normalizeRedirectUri(value) {
  try {
    const url = new URL(value);
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${normalizedPath}`;
  } catch {
    return value;
  }
}

export async function findClientById(clientId) {
  if (STATIC_CLIENTS[clientId]) {
    return STATIC_CLIENTS[clientId];
  }

  const cfg = getDbConfig();
  if (!cfg.key) return null;

  const query = new URLSearchParams({
    client_id: `eq.${clientId}`,
    select: "client_id,name,icon_url,homepage_url,allowed_redirect_uris,allowed_scopes,is_first_party",
    limit: "1",
  });

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?${query.toString()}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows?.length) return null;

  const row = rows[0];
  return {
    client_id: row.client_id,
    name: row.name || row.client_id,
    icon_url: row.icon_url || undefined,
    homepage_url: row.homepage_url || undefined,
    allowed_redirect_uris: Array.isArray(row.allowed_redirect_uris) ? row.allowed_redirect_uris : [],
    allowed_scopes: Array.isArray(row.allowed_scopes) ? row.allowed_scopes : ["openid", "profile", "email"],
    is_first_party: Boolean(row.is_first_party),
  };
}

export async function validateAuthRequestPayload(payload) {
  const clientId = payload.client_id || payload.clientId || "";
  const redirectUri = payload.redirect_uri || payload.redirectUri || "";
  const scope = payload.scope || "openid profile email";
  const state = payload.state || undefined;
  const codeChallenge = payload.code_challenge || payload.codeChallenge || undefined;
  const codeChallengeMethod = payload.code_challenge_method || payload.codeChallengeMethod || "S256";
  const responseType = payload.response_type || payload.responseType || "";
  const nonce = payload.nonce || undefined;

  if (!clientId) return { ok: false, error: "Missing client_id" };
  if (!redirectUri) return { ok: false, error: "Missing redirect_uri" };
  try {
    new URL(redirectUri);
  } catch {
    return { ok: false, error: "Invalid redirect_uri format" };
  }

  if (responseType && responseType !== "code") {
    return { ok: false, error: `Unsupported response_type: ${responseType}. Only 'code' is supported.` };
  }

  const client = await findClientById(clientId);
  if (!client) return { ok: false, error: `Unknown client_id: ${clientId}` };

  const normalizedIncoming = normalizeRedirectUri(redirectUri);
  const isValidRedirect = client.allowed_redirect_uris.some((registered) => {
    const normalizedRegistered = normalizeRedirectUri(registered);
    return (
      redirectUri === registered ||
      redirectUri.startsWith(registered.endsWith("/") ? registered : `${registered}/`) ||
      normalizedIncoming === normalizedRegistered
    );
  });

  if (!isValidRedirect) {
    return {
      ok: false,
      error: `redirect_uri not registered for this client. Received: ${redirectUri}. Allowed: ${client.allowed_redirect_uris.join(" | ")}`,
    };
  }

  const requestedScopes = String(scope).split(/\s+/).filter(Boolean);
  const invalidScopes = requestedScopes.filter((s) => !client.allowed_scopes.includes(s));
  if (invalidScopes.length) {
    return { ok: false, error: `Scopes not allowed for this client: ${invalidScopes.join(", ")}` };
  }

  return {
    ok: true,
    data: {
      client,
      redirect_uri: redirectUri,
      scopes: requestedScopes,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      nonce,
    },
  };
}

export async function insertClient(client) {
  const cfg = getDbConfig();
  if (!cfg.key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for client registration");
  }

  const payload = {
    client_id: client.client_id,
    client_secret: client.client_secret,
    name: client.name,
    icon_url: client.icon_url || null,
    homepage_url: client.homepage_url || null,
    allowed_redirect_uris: client.allowed_redirect_uris,
    allowed_scopes: client.allowed_scopes,
    is_first_party: Boolean(client.is_first_party),
    created_at: client.created_at || new Date().toISOString(),
  };

  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`client_insert_failed:${res.status}:${txt}`);
  }

  const rows = await res.json();
  return rows?.[0] || null;
}
