const DEFAULT_SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";

function getEnvValue(key, env) {
  if (env && typeof env === "object" && env[key] != null) {
    return String(env[key]);
  }
  if (typeof process !== "undefined" && process?.env?.[key] != null) {
    return process.env[key];
  }
  return "";
}

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

function getDbConfig(env) {
  return {
    url: (getEnvValue("SUPABASE_URL", env) || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: getEnvValue("SUPABASE_SERVICE_ROLE_KEY", env),
    table: getEnvValue("ZUUP_OAUTH_CLIENTS_TABLE", env) || "oauth_clients",
  };
}

function parseRedirectUris(value) {
  if (!value) return [];
  return String(value)
    .split(/[\n, ]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEnvClient(clientId, env) {
  const envClientId = getEnvValue("ZUUP_CLIENT_ID", env);
  if (!envClientId || envClientId !== clientId) return null;

  const redirectUris = [
    ...parseRedirectUris(getEnvValue("ZUUP_ALLOWED_REDIRECT_URIS", env)),
    ...parseRedirectUris(getEnvValue("ZUUP_REDIRECT_URI", env)),
  ];

  return {
    client_id: envClientId,
    name: getEnvValue("ZUUP_CLIENT_NAME", env) || envClientId,
    icon_url: getEnvValue("ZUUP_CLIENT_ICON_URL", env) || undefined,
    homepage_url: getEnvValue("ZUUP_CLIENT_HOMEPAGE_URL", env) || undefined,
    allowed_redirect_uris: redirectUris,
    allowed_scopes: parseRedirectUris(getEnvValue("ZUUP_ALLOWED_SCOPES", env)).length
      ? parseRedirectUris(getEnvValue("ZUUP_ALLOWED_SCOPES", env))
      : ["openid", "profile", "email"],
    is_first_party: String(getEnvValue("ZUUP_CLIENT_IS_FIRST_PARTY", env) || "false").toLowerCase() === "true",
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

export async function findClientById(clientId, env) {
  if (STATIC_CLIENTS[clientId]) {
    return STATIC_CLIENTS[clientId];
  }

  const envClient = getEnvClient(clientId, env);
  if (envClient) {
    return envClient;
  }

  const cfg = getDbConfig(env);
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

export async function validateAuthRequestPayload(payload, env) {
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

  const client = await findClientById(clientId, env);
  if (!client) {
    return {
      ok: false,
      error: `Unknown client_id: ${clientId}. If you migrated hosting, verify oauth_clients row exists or set ZUUP_CLIENT_ID + ZUUP_ALLOWED_REDIRECT_URIS on this deployment.`,
    };
  }

  if (!Array.isArray(client.allowed_redirect_uris) || client.allowed_redirect_uris.length === 0) {
    return {
      ok: false,
      error: `No allowed_redirect_uris configured for client_id: ${clientId}. Set allowed_redirect_uris in oauth_clients or ZUUP_ALLOWED_REDIRECT_URIS.`,
    };
  }

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
      error: `redirect_uri not registered for this client. Received: ${redirectUri}. Allowed: ${client.allowed_redirect_uris.join(" | ")}. If you moved from Vercel to Cloudflare, register the new callback URL exactly.`,
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
