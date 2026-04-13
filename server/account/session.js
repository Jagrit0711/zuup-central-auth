import { signJwtHs256, verifyJwtHs256, generateOpaqueToken } from "../oauth/utils.js";

const SESSION_COOKIE = "zuup_session";
const SESSION_ISSUER = process.env.ZUUP_SESSION_ISSUER || process.env.ZUUP_ISSUER || "https://auth.zuup.dev";

function getSessionSecret() {
  return process.env.ZUUP_SESSION_SECRET || process.env.ZUUP_OAUTH_SIGNING_SECRET || process.env.ZUUP_CLIENT_SECRET || "";
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

export function createSessionToken(user) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("server_not_configured");
  }

  const now = Math.floor(Date.now() / 1000);
  return signJwtHs256(
    {
      iss: SESSION_ISSUER,
      sub: user.id,
      aud: "zuup-auth",
      iat: now,
      exp: now + 60 * 60 * 24 * 30,
      jti: generateOpaqueToken(12),
      email: user.email,
    },
    secret,
  );
}

export function verifySessionToken(token) {
  const secret = getSessionSecret();
  if (!secret) {
    return { ok: false, error: "server_not_configured" };
  }

  return verifyJwtHs256(token, secret);
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`,
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export function getSessionCookie(req) {
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE] || "";
}
