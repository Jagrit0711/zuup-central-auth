import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qnapwukqhybziduhzpow.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYXB3dWtxaHliemlkdWh6cG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjA3ODYsImV4cCI6MjA4NzkzNjc4Nn0.x1a-lyiPhBDqR2U-ZAC_waSa-2smUs_KpSGXbK54rp0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storageKey: "zuup.auth.session",
  },
});

const AUTH_BASE_URL = "https://auth.zuup.dev";

export const OAUTH_ENDPOINTS = {
  authorization: `${AUTH_BASE_URL}/authorize`,
  token: `${AUTH_BASE_URL}/api/oauth/token`,
  userinfo: `${AUTH_BASE_URL}/api/oauth/userinfo`,
  jwks: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  oidcDiscovery: `${SUPABASE_URL}/auth/v1/.well-known/openid-configuration`,
  revocation: `${SUPABASE_URL}/auth/v1/logout`,
};

export { SUPABASE_URL, SUPABASE_ANON_KEY };
