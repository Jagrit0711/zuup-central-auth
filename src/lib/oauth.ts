/**
 * Zuup Auth - OAuth 2.1 / OIDC Core Library
 *
 * Implements proper authorization code flow with PKCE.
 * All OAuth state is stored in Supabase DB via supabase functions
 * or localStorage fallback (dev mode).
 */

import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OAuthClient {
  client_id: string;
  client_secret_hash?: string; // SHA-256 hash, never stored plain
  name: string;
  icon_url?: string;
  homepage_url?: string;
  allowed_redirect_uris: string[];
  allowed_scopes: OAuthScope[];
  is_first_party: boolean; // first-party apps skip consent screen
  created_at?: string;
}

export type OAuthScope =
  | "openid"
  | "profile"
  | "email"
  | "offline_access"
  | "zuup:read"
  | "zuup:write"
  | "zuup:admin";

export const SCOPE_DESCRIPTIONS: Record<OAuthScope, { label: string; description: string; icon: string }> = {
  openid: { label: "Identity", description: "Verify who you are", icon: "fingerprint" },
  profile: { label: "Profile", description: "Read your name, username, and avatar", icon: "user" },
  email: { label: "Email", description: "Read your email address", icon: "mail" },
  offline_access: { label: "Stay signed in", description: "Access your data when you're not using the app", icon: "refresh-cw" },
  "zuup:read": { label: "Read data", description: "Read your Zuup data and settings", icon: "eye" },
  "zuup:write": { label: "Write data", description: "Create and update your Zuup data", icon: "edit" },
  "zuup:admin": { label: "Admin access", description: "Full administrative access to your account", icon: "shield" },
};

export interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  user_id: string;
  scopes: OAuthScope[];
  code_challenge?: string;
  code_challenge_method?: "S256" | "plain";
  expires_at: number; // unix ms
  used: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  id_token?: string; // OIDC
}

// ─── Registered Clients (in production: DB table) ────────────────────────────

export const REGISTERED_CLIENTS: Record<string, OAuthClient> = {
  "0d810775-7d53-4c4d-b44e-2a39f7fb1741": {
    client_id: "0d810775-7d53-4c4d-b44e-2a39f7fb1741",
    name: "Zuup Auth OAuth App",
    icon_url: "https://www.zuup.dev/favicon.ico",
    homepage_url: "https://www.zuup.dev",
    allowed_redirect_uris: [
      "https://www.zuup.dev/callback",
      "https://code.zuup.dev/callback",
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

const CUSTOM_APPS_KEY = "zuup_custom_apps";

function getCustomRegisteredClients(): Record<string, OAuthClient> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(CUSTOM_APPS_KEY);
    if (!raw) return {};

    const apps = JSON.parse(raw) as Array<{
      client_id: string;
      name: string;
      homepage_url: string;
      icon_url?: string;
      allowed_redirect_uris: string[];
      allowed_scopes: string[];
      is_first_party: boolean;
      created_at?: string;
    }>;

    return Object.fromEntries(
      apps
        .filter((app) =>
          app &&
          app.client_id &&
          app.name &&
          app.homepage_url &&
          Array.isArray(app.allowed_redirect_uris) &&
          Array.isArray(app.allowed_scopes)
        )
        .map((app) => [app.client_id, {
          client_id: app.client_id,
          name: app.name,
          homepage_url: app.homepage_url,
          icon_url: app.icon_url,
          allowed_redirect_uris: app.allowed_redirect_uris,
          allowed_scopes: app.allowed_scopes as OAuthScope[],
          is_first_party: app.is_first_party,
          created_at: app.created_at,
        } satisfies OAuthClient]),
    );
  } catch {
    return {};
  }
}

export function getRegisteredClients(): Record<string, OAuthClient> {
  return { ...REGISTERED_CLIENTS, ...getCustomRegisteredClients() };
}

// ─── Authorization Code Store (localStorage for demo; use DB in prod) ─────────

const CODE_STORE_KEY = "zuup_auth_codes";

function getCodeStore(): Record<string, AuthorizationCode> {
  try {
    return JSON.parse(localStorage.getItem(CODE_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCodeStore(store: Record<string, AuthorizationCode>) {
  localStorage.setItem(CODE_STORE_KEY, JSON.stringify(store));
}

export function generateAuthCode(params: Omit<AuthorizationCode, "code" | "expires_at" | "used">): string {
  const code = generateSecureRandom(32);
  const store = getCodeStore();
  store[code] = {
    ...params,
    code,
    expires_at: Date.now() + 10 * 60 * 1000, // 10 min
    used: false,
  };
  // Cleanup expired codes
  for (const k of Object.keys(store)) {
    if (store[k].expires_at < Date.now()) delete store[k];
  }
  saveCodeStore(store);
  return code;
}

export function consumeAuthCode(code: string): AuthorizationCode | null {
  const store = getCodeStore();
  const entry = store[code];
  if (!entry) return null;
  if (entry.used) return null;
  if (entry.expires_at < Date.now()) return null;
  entry.used = true;
  store[code] = entry;
  saveCodeStore(store);
  return entry;
}

// ─── PKCE Helpers ─────────────────────────────────────────────────────────────

export function generateSecureRandom(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function verifyCodeChallenge(
  verifier: string,
  challenge: string,
  method: "S256" | "plain"
): Promise<boolean> {
  if (method === "plain") return verifier === challenge;
  const computed = await generateCodeChallenge(verifier);
  return computed === challenge;
}

// ─── Client Validation ────────────────────────────────────────────────────────

export interface ValidatedRequest {
  client: OAuthClient;
  redirect_uri: string;
  scopes: OAuthScope[];
  state?: string;
  code_challenge?: string;
  code_challenge_method?: "S256" | "plain";
  nonce?: string;
}

function getParam(params: URLSearchParams, ...names: string[]): string {
  for (const name of names) {
    const value = params.get(name);
    if (value) return value;
  }
  return "";
}

function normalizeRedirectUri(value: string): string {
  try {
    const url = new URL(value);
    // Ignore query and hash when matching registered callback path.
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${normalizedPath}`;
  } catch {
    return value;
  }
}

export function validateAuthRequest(params: URLSearchParams): { ok: true; data: ValidatedRequest } | { ok: false; error: string } {
  const client_id = getParam(params, "client_id", "clientId");
  const redirect_uri = getParam(params, "redirect_uri", "redirectUri");
  const scope = getParam(params, "scope") || "openid profile email";
  const state = getParam(params, "state") || undefined;
  const code_challenge = getParam(params, "code_challenge", "codeChallenge") || undefined;
  const code_challenge_method = (getParam(params, "code_challenge_method", "codeChallengeMethod") || "S256") as "S256" | "plain";
  const response_type = getParam(params, "response_type", "responseType");
  const nonce = getParam(params, "nonce") || undefined;

  if (!client_id) return { ok: false, error: "Missing client_id" };
  if (!redirect_uri) return { ok: false, error: "Missing redirect_uri" };
  try {
    // Require absolute redirect URLs to keep redirect helpers safe.
    new URL(redirect_uri);
  } catch {
    return { ok: false, error: "Invalid redirect_uri format" };
  }
  if (response_type && response_type !== "code") return { ok: false, error: `Unsupported response_type: ${response_type}. Only 'code' is supported.` };

  const client = getRegisteredClients()[client_id];
  if (!client) return { ok: false, error: `Unknown client_id: ${client_id}` };

  const normalizedIncoming = normalizeRedirectUri(redirect_uri);
  const isValidRedirect = client.allowed_redirect_uris.some((registered) => {
    const normalizedRegistered = normalizeRedirectUri(registered);
    return (
      redirect_uri === registered ||
      redirect_uri.startsWith(registered.endsWith("/") ? registered : registered + "/") ||
      normalizedIncoming === normalizedRegistered
    );
  });

  if (!isValidRedirect) {
    return {
      ok: false,
      error: `redirect_uri not registered for this client. Received: ${redirect_uri}. Allowed: ${client.allowed_redirect_uris.join(" | ")}`,
    };
  }

  const requestedScopes = scope.split(/\s+/) as OAuthScope[];
  const invalidScopes = requestedScopes.filter((s) => !client.allowed_scopes.includes(s));
  if (invalidScopes.length > 0) {
    return { ok: false, error: `Scopes not allowed for this client: ${invalidScopes.join(", ")}` };
  }

  return {
    ok: true,
    data: { client, redirect_uri, scopes: requestedScopes, state, code_challenge, code_challenge_method, nonce },
  };
}

// ─── OAuth Error Redirect ─────────────────────────────────────────────────────

export function buildErrorRedirect(redirectUri: string, error: string, description?: string, state?: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export function buildSuccessRedirect(redirectUri: string, code: string, state?: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

// ─── Audit Log (localStorage for demo) ───────────────────────────────────────

export interface AuditEvent {
  id: string;
  type: "login" | "logout" | "token_issued" | "consent_granted" | "client_registered" | "password_changed" | "email_changed" | "login_failed";
  user_id?: string;
  client_id?: string;
  ip?: string;
  user_agent?: string;
  details?: Record<string, string>;
  created_at: string;
}

const AUDIT_KEY = "zuup_audit_log";
const MAX_AUDIT = 100;

export function logAuditEvent(event: Omit<AuditEvent, "id" | "created_at">) {
  const logs: AuditEvent[] = JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]");
  logs.unshift({
    ...event,
    id: generateSecureRandom(8),
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, MAX_AUDIT)));
}

export function getAuditLog(): AuditEvent[] {
  return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]");
}
