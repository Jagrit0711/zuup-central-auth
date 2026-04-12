import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYXB3dWtxaHliemlkdWh6cG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjA3ODYsImV4cCI6MjA4NzkzNjc4Nn0.x1a-lyiPhBDqR2U-ZAC_waSa-2smUs_KpSGXbK54rp0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const OAUTH_ENDPOINTS = {
  authorization: `${SUPABASE_URL}/auth/v1/oauth/authorize`,
  token: `${SUPABASE_URL}/auth/v1/oauth/token`,
  jwks: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  oidcDiscovery: `${SUPABASE_URL}/auth/v1/.well-known/openid-configuration`,
};

// Registered Zuup apps that can use "Login with Zuup"
// In production, these should be stored in a database table
export const REGISTERED_APPS: Record<string, RegisteredApp> = {
  zuupcode: {
    client_id: "zuupcode",
    name: "ZuupCode",
    icon: "https://code.zuup.dev/favicon.ico",
    allowed_redirect_uris: [
      "https://code.zuup.dev/callback",
      "https://code.zuup.dev/auth/callback",
      "http://localhost:3000/callback",
      "http://localhost:5173/callback",
    ],
  },
  zuuptime: {
    client_id: "zuuptime",
    name: "ZuupTime",
    icon: "https://time.zuup.dev/favicon.ico",
    allowed_redirect_uris: [
      "https://time.zuup.dev/callback",
      "https://time.zuup.dev/auth/callback",
      "http://localhost:3000/callback",
    ],
  },
  zuupdev: {
    client_id: "zuupdev",
    name: "Zuup",
    icon: "https://www.zuup.dev/favicon.ico",
    allowed_redirect_uris: [
      "https://www.zuup.dev/callback",
      "https://zuup.dev/callback",
      "http://localhost:3000/callback",
    ],
  },
};

export interface RegisteredApp {
  client_id: string;
  name: string;
  icon: string;
  allowed_redirect_uris: string[];
}

// Validate a redirect URI against registered apps
export function validateRedirectUri(clientId: string, redirectUri: string): RegisteredApp | null {
  const app = REGISTERED_APPS[clientId];
  if (!app) return null;
  if (!app.allowed_redirect_uris.some((uri) => redirectUri.startsWith(uri))) return null;
  return app;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
