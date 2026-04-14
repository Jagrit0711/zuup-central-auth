import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  Fingerprint,
  Globe,
  Info,
  Key,
  Lock,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";

const SECTIONS = [
  { id: "overview", label: "Summary" },
  { id: "quickstart", label: "Flow" },
  { id: "register", label: "App Registry" },
  { id: "environment", label: "Env Vars" },
  { id: "frontend", label: "PKCE Start" },
  { id: "callback", label: "Callback" },
  { id: "session", label: "Session" },
  { id: "scopes", label: "Scopes" },
  { id: "endpoints", label: "Endpoints" },
  { id: "mistakes", label: "Failure Modes" },
  { id: "repo-map", label: "Repo Map" },
];

const APP_EXAMPLES = [
  {
    name: "Zuup Auth OAuth App",
    clientId: "0d810775-7d53-4c4d-b44e-2a39f7fb1741",
    firstParty: false,
    redirects: [
      "https://www.zuup.dev/callback",
      "https://code.zuup.dev/callback",
      "https://watch.zuup.dev/auth/zuup/callback",
      "http://localhost:3000/callback",
      "http://localhost:5173/callback",
    ],
  },
  {
    name: "ZuupCode",
    clientId: "zuupcode",
    firstParty: true,
    redirects: [
      "https://code.zuup.dev/callback",
      "https://code.zuup.dev/auth/callback",
      "https://watch.zuup.dev/auth/zuup/callback",
      "http://localhost:3000/callback",
      "http://localhost:5173/callback",
    ],
  },
  {
    name: "ZuupTime",
    clientId: "zuuptime",
    firstParty: true,
    redirects: ["https://time.zuup.dev/callback", "https://time.zuup.dev/auth/callback", "http://localhost:3000/callback"],
  },
  {
    name: "Zuup",
    clientId: "zuupdev",
    firstParty: true,
    redirects: ["https://www.zuup.dev/callback", "https://zuup.dev/callback", "http://localhost:3000/callback"],
  },
];

const QUICK_STEPS = [
  {
    title: "Register the client",
    body: (
      <>
        Register through the Zuup Auth signup flow. In this repo, the app registration UI is reachable from <Link to="/signup">the signup route</Link>, and admin management lives in
        <span className="docs-inline">/profile</span>.
      </>
    ),
  },
  {
    title: "Configure redirects",
    body: (
      <>
        Use a real callback page such as <span className="docs-inline">/callback</span> or <span className="docs-inline">/auth/zuup/callback</span>. Do not point the redirect URI at an API
        route.
      </>
    ),
  },
  {
    title: "Set environment",
    body: (
      <>
        Keep browser-facing values prefixed with <span className="docs-inline">VITE_</span>. Keep <span className="docs-inline">client_secret</span> and service keys only on the server.
      </>
    ),
  },
  {
    title: "Start PKCE login",
    body: (
      <>
        Generate a PKCE verifier/challenge before redirecting the user to <span className="docs-inline">https://auth.zuup.dev/authorize</span>.
      </>
    ),
  },
  {
    title: "Handle callback",
    body: (
      <>
        Validate <span className="docs-inline">state</span>, confirm the stored PKCE verifier, then send the authorization code to your backend.
      </>
    ),
  },
  {
    title: "Exchange and hydrate",
    body: (
      <>
        Exchange the code on the server, fetch <span className="docs-inline">userinfo</span>, and hydrate your app session. In this repo, session persistence is managed by
        Supabase auth in <span className="docs-inline">src/lib/supabase.ts</span>.
      </>
    ),
  },
];

const CLIENT_VARS = [
  "VITE_ZUUP_CLIENT_ID",
  "VITE_ZUUP_REDIRECT_URI",
  "VITE_ZUUP_AUTH_URL or VITE_ZUUP_AUTHORIZE_URL",
  "VITE_ZUUP_SCOPE",
  "VITE_ZUUP_TOKEN_URL or VITE_ZUUP_TOKEN_EXCHANGE_URL when you override the exchange path",
];

const SERVER_VARS = [
  "ZUUP_CLIENT_ID",
  "ZUUP_CLIENT_SECRET",
  "ZUUP_REDIRECT_URI",
  "ZUUP_TOKEN_URL or ZUUP_OAUTH_TOKEN_URL",
  "ZUUP_USERINFO_URL",
  "ZUUP_OAUTH_SIGNING_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const SCOPES = [
  { scope: "openid", required: true, desc: "Required for identity and OIDC claims." },
  { scope: "profile", required: false, desc: "Name, username, and avatar." },
  { scope: "email", required: false, desc: "User email address." },
  { scope: "offline_access", required: false, desc: "Refresh token access." },
  { scope: "zuup:read", required: false, desc: "Read-only Zuup account data." },
  { scope: "zuup:write", required: false, desc: "Create and update Zuup account data." },
  { scope: "zuup:admin", required: false, desc: "Admin access. Request only when needed." },
];

const ENDPOINTS = [
  { method: "GET", path: "https://auth.zuup.dev/authorize", desc: "Hosted authorize entrypoint." },
  { method: "POST", path: "https://auth.zuup.dev/api/oauth/validate-request", desc: "Preflight validation before consent." },
  { method: "POST", path: "https://auth.zuup.dev/api/oauth/token", desc: "Authorization-code exchange." },
  { method: "GET", path: "https://auth.zuup.dev/api/oauth/userinfo", desc: "Bearer-token profile lookup." },
  { method: "POST", path: "https://auth.zuup.dev/api/oauth/register-client", desc: "Client registration endpoint." },
];

const REPO_MAP = [
  { file: "src/lib/oauth.ts", desc: "PKCE, client validation, scopes, code issuance, audit logging." },
  { file: "src/pages/Authorize.tsx", desc: "Login and consent UI." },
  { file: "src/pages/Token.tsx", desc: "Token exchange demo page." },
  { file: "src/lib/supabase.ts", desc: "Supabase auth client and endpoint constants." },
  { file: "src/hooks/useAuth.ts", desc: "Session loading and refresh handling." },
  { file: "api/oauth/token.js", desc: "Server token exchange and JWT minting." },
  { file: "api/oauth/userinfo.js", desc: "Bearer-token profile endpoint." },
  { file: "api/oauth/validate-request.js", desc: "Request validation endpoint." },
];

const COMMON_MISTAKES = [
  "Using an API route as the redirect URI.",
  "Putting the client secret in browser-visible env vars.",
  "Not saving the PKCE verifier before redirect.",
  "Mismatching callback URLs between Zuup and your app.",
  "Requesting scopes that the client was never registered for.",
];

const EXAMPLES = {
  browser: {
    label: "Browser PKCE",
    lang: "typescript",
    code: `import { generateCodeChallenge, generateCodeVerifier } from "@/lib/oauth";

export async function loginWithZuup() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem("zuup_pkce_verifier", verifier);
  sessionStorage.setItem("zuup_oauth_state", state);

  const params = new URLSearchParams({
    client_id: "YOUR_CLIENT_ID",
    redirect_uri: window.location.origin + "/callback",
    response_type: "code",
    scope: "openid profile email offline_access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.assign(
    \`https://auth.zuup.dev/authorize?\${params}\`
  );
}`,
  },
  server: {
    label: "Server exchange",
    lang: "typescript",
    code: `const response = await fetch("/api/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "authorization_code",
    code,
    redirect_uri: window.location.origin + "/callback",
    client_id: process.env.ZUUP_CLIENT_ID,
    code_verifier,
  }),
});

const payload = await response.json();

const profileResponse = await fetch("/api/oauth/userinfo", {
  headers: { Authorization: \`Bearer \${payload.access_token}\` },
});

const profile = await profileResponse.json();`,
  },
} as const;

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="docs-code-wrap">
      <div className="docs-code-bar">
        <span className="docs-code-meta">
          <span className="docs-code-lang">{lang}</span>
          <span className="docs-code-title">Snippet</span>
        </span>
        <button
          className="docs-copy-btn"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="docs-code-body">{code}</pre>
    </div>
  );
}

function Alert({ type, children }: { type: "warning" | "info"; children: ReactNode }) {
  const config =
    type === "warning"
      ? { icon: AlertTriangle, border: "rgba(245, 158, 11, 0.24)", bg: "rgba(245, 158, 11, 0.08)", color: "#fbbf24" }
      : { icon: Info, border: "rgba(96, 165, 250, 0.24)", bg: "rgba(96, 165, 250, 0.08)", color: "#93c5fd" };

  const Icon = config.icon;

  return (
    <div className="docs-alert" style={{ borderColor: config.border, background: config.bg }}>
      <Icon size={16} style={{ color: config.color, flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  lead,
  delay,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  delay: number;
  children: ReactNode;
}) {
  return (
    <section id={id} className="docs-section" style={{ animationDelay: `${delay}ms` }}>
      <div className="docs-section-eyebrow">{eyebrow}</div>
      <h2 className="docs-section-title">{title}</h2>
      {lead ? <p className="docs-section-lead">{lead}</p> : null}
      {children}
    </section>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <span className="docs-inline">{children}</span>;
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState("overview");
  const [activeExample, setActiveExample] = useState<keyof typeof EXAMPLES>("browser");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target instanceof HTMLElement) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-22% 0px -58% 0px", threshold: [0.2, 0.35, 0.5, 0.75] },
    );

    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="docs-shell">
      <style>{`
        .docs-shell {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          color: #e8eef9;
          background:
            radial-gradient(circle at top left, rgba(232, 66, 90, 0.16), transparent 28%),
            radial-gradient(circle at bottom right, rgba(96, 165, 250, 0.12), transparent 32%),
            linear-gradient(180deg, #080a0f 0%, #0c1018 48%, #090c12 100%);
        }

        .docs-shell::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.85), transparent 90%);
          opacity: 0.3;
        }

        .docs-orb {
          position: fixed;
          border-radius: 9999px;
          filter: blur(90px);
          pointer-events: none;
          opacity: 0.18;
          animation: docsFloat 16s ease-in-out infinite;
        }

        .docs-orb-a {
          top: -10rem;
          right: -12rem;
          width: 30rem;
          height: 30rem;
          background: hsl(var(--zuup-coral) / 0.8);
        }

        .docs-orb-b {
          bottom: -12rem;
          left: -10rem;
          width: 28rem;
          height: 28rem;
          background: rgba(96, 165, 250, 0.9);
          animation-duration: 20s;
          animation-delay: -6s;
        }

        .docs-topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          backdrop-filter: blur(18px);
          background: rgba(8, 10, 15, 0.72);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .docs-topbar-inner {
          max-width: 1440px;
          margin: 0 auto;
          min-height: 72px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .docs-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }

        .docs-brand img {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .docs-brand-mark {
          display: flex;
          flex-direction: column;
          line-height: 1;
        }

        .docs-brand-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .docs-brand-sub {
          margin-top: 4px;
          font-size: 12px;
          color: #8b94a7;
        }

        .docs-topbar-links {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .docs-topbar-links a {
          color: #aab3c4;
          text-decoration: none;
          font-size: 13px;
          transition: color 140ms ease, transform 140ms ease;
        }

        .docs-topbar-links a:hover {
          color: #fff;
          transform: translateY(-1px);
        }

        .docs-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          background: linear-gradient(135deg, hsl(var(--zuup-coral)), hsl(var(--zuup-glow)));
          box-shadow: 0 12px 32px -18px rgba(232, 66, 90, 0.75);
          transition: transform 160ms ease, box-shadow 160ms ease, filter 160ms ease;
        }

        .docs-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 44px -22px rgba(232, 66, 90, 0.85);
          filter: saturate(1.04);
        }

        .docs-layout {
          max-width: 1440px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr);
          gap: 0;
        }

        .docs-sidebar {
          position: sticky;
          top: 72px;
          height: calc(100vh - 72px);
          overflow: auto;
          padding: 28px 16px 28px 20px;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%);
        }

        .docs-sidebar-label {
          margin: 0 0 10px;
          color: #73819a;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .docs-sidebar-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          margin-bottom: 4px;
          border-radius: 12px;
          border: 1px solid transparent;
          color: #a7b2c7;
          text-decoration: none;
          cursor: pointer;
          background: transparent;
          transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
        }

        .docs-sidebar-link:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.035);
        }

        .docs-sidebar-link.active {
          color: #fff;
          background: rgba(232, 66, 90, 0.1);
          border-color: rgba(232, 66, 90, 0.22);
          transform: translateX(2px);
        }

        .docs-sidebar-divider {
          margin: 16px 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
        }

        .docs-main {
          padding: 28px 28px 90px;
          min-width: 0;
        }

        .docs-section {
          margin-top: 36px;
          scroll-margin-top: 100px;
          animation: docsRise 0.65s ease both;
        }

        .docs-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.85fr);
          gap: 18px;
        }

        .docs-panel {
          position: relative;
          padding: 26px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025));
          backdrop-filter: blur(18px);
          box-shadow: 0 24px 80px -42px rgba(0, 0, 0, 0.9);
        }

        .docs-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 34%, transparent 70%, rgba(255, 255, 255, 0.08));
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.55;
        }

        .docs-hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          color: #ffd1d8;
          background: rgba(232, 66, 90, 0.12);
          border: 1px solid rgba(232, 66, 90, 0.22);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          margin-bottom: 18px;
        }

        .docs-hero-title {
          margin: 0;
          font-size: clamp(2.6rem, 4.2vw, 4.7rem);
          line-height: 0.95;
          letter-spacing: -0.06em;
          max-width: 12ch;
        }

        .docs-hero-title span {
          background: linear-gradient(135deg, #fff 0%, #ffd6de 34%, #f48aa0 70%, #f1bac5 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .docs-hero-lead {
          margin: 18px 0 0;
          max-width: 68ch;
          color: #aab3c4;
          font-size: 15px;
          line-height: 1.8;
        }

        .docs-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 22px 0 28px;
        }

        .docs-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #dfe7f5;
          font-size: 12px;
          font-weight: 700;
        }

        .docs-chip-accent {
          color: #ffd1d8;
          background: rgba(232, 66, 90, 0.12);
          border-color: rgba(232, 66, 90, 0.18);
        }

        .docs-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }

        .docs-secondary-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #dfe7f5;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.03);
          transition: background 160ms ease, transform 160ms ease, border-color 160ms ease;
        }

        .docs-secondary-button:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateY(-1px);
        }

        .docs-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .docs-stat-card {
          padding: 16px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(10, 14, 22, 0.5);
        }

        .docs-stat-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          color: #fff;
          font-weight: 800;
          font-size: 13px;
        }

        .docs-stat-desc {
          margin: 0;
          color: #aab3c4;
          font-size: 12px;
          line-height: 1.65;
        }

        .docs-panel-stack {
          display: grid;
          gap: 14px;
        }

        .docs-mini-card {
          padding: 16px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }

        .docs-mini-card-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 800;
          color: #fff;
        }

        .docs-mini-card p {
          margin: 0;
          color: #aab3c4;
          font-size: 12px;
          line-height: 1.7;
        }

        .docs-section-eyebrow {
          margin-bottom: 10px;
          color: #f48aa0;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .docs-section-title {
          margin: 0;
          font-size: clamp(1.55rem, 2.5vw, 2.2rem);
          letter-spacing: -0.04em;
          line-height: 1.08;
          color: #fff;
        }

        .docs-section-lead {
          margin: 12px 0 0;
          max-width: 82ch;
          color: #aab3c4;
          font-size: 14px;
          line-height: 1.8;
        }

        .docs-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .docs-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .docs-step-card,
        .docs-file-card,
        .docs-env-card,
        .docs-mistake-card,
        .docs-app-card {
          padding: 18px;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: 0 24px 72px -54px rgba(0, 0, 0, 0.9);
          transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
        }

        .docs-step-card:hover,
        .docs-file-card:hover,
        .docs-env-card:hover,
        .docs-mistake-card:hover,
        .docs-app-card:hover {
          transform: translateY(-2px);
          border-color: rgba(232, 66, 90, 0.18);
          background: rgba(255, 255, 255, 0.05);
        }

        .docs-step-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          margin-bottom: 14px;
          color: #fff;
          font-weight: 800;
          font-size: 13px;
          background: linear-gradient(135deg, hsl(var(--zuup-coral) / 0.9), hsl(var(--zuup-glow) / 0.9));
          box-shadow: 0 10px 22px -14px rgba(232, 66, 90, 0.85);
        }

        .docs-card-title {
          margin: 0 0 8px;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .docs-card-body {
          margin: 0;
          color: #aab3c4;
          font-size: 13px;
          line-height: 1.7;
        }

        .docs-inline {
          display: inline-flex;
          align-items: center;
          padding: 1px 7px;
          border-radius: 999px;
          border: 1px solid rgba(232, 66, 90, 0.2);
          background: rgba(232, 66, 90, 0.08);
          color: #ffd1d8;
          font-family: ui-monospace, SFMono-Regular, SF Mono, Consolas, monospace;
          font-size: 12px;
          line-height: 1.5;
        }

        .docs-alert {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid;
        }

        .docs-alert div {
          color: #aab3c4;
          font-size: 13px;
          line-height: 1.75;
        }

        .docs-code-wrap {
          margin-top: 18px;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(8, 11, 16, 0.96);
          box-shadow: 0 28px 80px -58px rgba(0, 0, 0, 0.9);
        }

        .docs-code-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015));
        }

        .docs-code-meta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          white-space: nowrap;
        }

        .docs-code-title {
          color: #dfe7f5;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .docs-code-lang {
          color: #9aa5ba;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .docs-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #dfe7f5;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 140ms ease, transform 140ms ease, border-color 140ms ease;
        }

        .docs-copy-btn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .docs-code-body {
          margin: 0;
          padding: 18px 18px 20px;
          overflow-x: auto;
          color: #c6d0e0;
          font-size: 12.5px;
          line-height: 1.75;
          white-space: pre;
          font-family: ui-monospace, SFMono-Regular, SF Mono, Consolas, monospace;
        }

        .docs-table-wrap {
          margin-top: 18px;
          overflow-x: auto;
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }

        .docs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .docs-table th,
        .docs-table td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          vertical-align: top;
        }

        .docs-table th {
          color: #7f8ca2;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          white-space: nowrap;
        }

        .docs-table td {
          color: #bfd0e3;
        }

        .docs-table tr:last-child td {
          border-bottom: none;
        }

        .docs-method {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 64px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .docs-method-get {
          color: #7cf0b8;
          background: rgba(16, 185, 129, 0.12);
        }

        .docs-method-post {
          color: #93c5fd;
          background: rgba(59, 130, 246, 0.14);
        }

        .docs-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .docs-tab {
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #aab3c4;
          background: rgba(255, 255, 255, 0.03);
          cursor: pointer;
          transition: background 140ms ease, transform 140ms ease, border-color 140ms ease, color 140ms ease;
        }

        .docs-tab:hover {
          color: #fff;
          transform: translateY(-1px);
        }

        .docs-tab.active {
          color: #fff;
          background: rgba(232, 66, 90, 0.12);
          border-color: rgba(232, 66, 90, 0.25);
        }

        .docs-grid-4 .docs-app-card {
          min-height: 100%;
        }

        .docs-app-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .docs-app-title h4 {
          margin: 0;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
        }

        .docs-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .docs-badge-first {
          color: #ffd1d8;
          background: rgba(232, 66, 90, 0.12);
        }

        .docs-badge-third {
          color: #c6d6ff;
          background: rgba(59, 130, 246, 0.12);
        }

        .docs-app-card ul {
          margin: 10px 0 0;
          padding-left: 18px;
          color: #aab3c4;
          font-size: 12px;
          line-height: 1.75;
        }

        .docs-app-card li + li {
          margin-top: 4px;
        }

        .docs-files-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }

        .docs-file-card {
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }

        .docs-file-icon {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: linear-gradient(135deg, rgba(232, 66, 90, 0.94), rgba(243, 113, 134, 0.9));
        }

        .docs-file-card code {
          display: inline-block;
          margin-bottom: 6px;
          color: #ffd1d8;
          font-family: ui-monospace, SFMono-Regular, SF Mono, Consolas, monospace;
          font-size: 12px;
          font-weight: 700;
        }

        .docs-file-card p {
          margin: 0;
          color: #aab3c4;
          font-size: 12px;
          line-height: 1.7;
        }

        @keyframes docsRise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes docsFloat {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, -18px, 0) scale(1.04);
          }
        }

        @media (max-width: 1180px) {
          .docs-layout {
            grid-template-columns: 1fr;
          }

          .docs-sidebar {
            position: relative;
            top: 0;
            height: auto;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .docs-main {
            padding-top: 18px;
          }
        }

        @media (max-width: 900px) {
          .docs-hero,
          .docs-grid-2,
          .docs-grid-4,
          .docs-files-grid {
            grid-template-columns: 1fr;
          }

          .docs-topbar-inner {
            padding: 14px 18px;
            flex-direction: column;
            align-items: flex-start;
          }

          .docs-main {
            padding: 18px 18px 80px;
          }
        }

        @media (max-width: 640px) {
          .docs-sidebar {
            padding-inline: 12px;
          }

          .docs-topbar-links {
            gap: 10px;
          }

          .docs-button,
          .docs-secondary-button {
            width: 100%;
            justify-content: center;
          }

          .docs-panel,
          .docs-step-card,
          .docs-file-card,
          .docs-env-card,
          .docs-mistake-card,
          .docs-app-card {
            padding: 16px;
            border-radius: 20px;
          }

          .docs-code-body {
            font-size: 12px;
          }

          .docs-table th,
          .docs-table td {
            padding-inline: 12px;
          }
        }
      `}</style>

      <div className="docs-orb docs-orb-a" />
      <div className="docs-orb docs-orb-b" />

      <nav className="docs-topbar">
        <div className="docs-topbar-inner">
          <Link to="/" className="docs-brand">
            <img src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png" alt="Zuup" />
            <span className="docs-brand-mark">
              <span className="docs-brand-name">Zuup Auth</span>
              <span className="docs-brand-sub">OAuth 2.1 + PKCE docs</span>
            </span>
          </Link>

          <div className="docs-topbar-links">
            <Link to="/">Home</Link>
            <Link to="/profile">Dashboard</Link>
            <a href="https://auth.zuup.dev/signup" target="_blank" rel="noreferrer">
              Register App <ExternalLink size={12} style={{ display: "inline", marginLeft: 4 }} />
            </a>
            <Link to="/signup" className="docs-button">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <p className="docs-sidebar-label">Documentation</p>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`docs-sidebar-link ${activeSection === section.id ? "active" : ""}`}
              onClick={() => scrollTo(section.id)}
            >
              <span>{section.label}</span>
              <ChevronRight size={14} style={{ opacity: 0.6 }} />
            </button>
          ))}

          <div className="docs-sidebar-divider" />

          <p className="docs-sidebar-label">Resources</p>
          <Link to="/profile" className="docs-sidebar-link">
            <span>Dashboard</span>
            <Shield size={14} style={{ opacity: 0.7 }} />
          </Link>
          <a href="https://www.zuup.dev" target="_blank" rel="noreferrer" className="docs-sidebar-link">
            <span>Zuup Platform</span>
            <ExternalLink size={14} style={{ opacity: 0.7 }} />
          </a>
        </aside>

        <main className="docs-main">
          <section id="overview" className="docs-section" style={{ animationDelay: "0ms" }}>
            <div className="docs-hero">
              <div className="docs-panel">
                <div className="docs-hero-kicker">
                  <Zap size={14} /> Zuup Auth Integration Guide
                </div>
                <h1 className="docs-hero-title">
                  <span>OAuth 2.1 + PKCE, with the server holding the secret.</span>
                </h1>
                <p className="docs-hero-lead">
                  This guide follows the actual code in this repo. The browser starts login, Zuup validates the request and shows consent when needed, and the server handles code exchange,
                  profile lookup, and session hydration.
                </p>

                <div className="docs-chip-row">
                  <span className="docs-chip docs-chip-accent"><Fingerprint size={13} /> PKCE required</span>
                  <span className="docs-chip"><Shield size={13} /> First-party apps skip consent</span>
                  <span className="docs-chip"><Lock size={13} /> Secrets stay server-side</span>
                  <span className="docs-chip"><Terminal size={13} /> Demo endpoints are in this repo</span>
                </div>

                <div className="docs-hero-actions">
                  <Link to="/signup" className="docs-button">
                    Open signup flow <ArrowRight size={14} />
                  </Link>
                  <Link to="/profile" className="docs-secondary-button">
                    View dashboard <ExternalLink size={14} />
                  </Link>
                </div>
              </div>

              <div className="docs-panel docs-panel-stack">
                <div className="docs-mini-card">
                  <div className="docs-mini-card-title">
                    <Globe size={14} /> What Zuup Auth gives you
                  </div>
                  <p>Hosted login at <InlineCode>https://auth.zuup.dev</InlineCode>, OAuth 2.1 authorization code flow with mandatory PKCE, and optional OIDC profile data via scope selection.</p>
                </div>
                <div className="docs-stat-grid">
                  <div className="docs-stat-card">
                    <div className="docs-stat-top"><Key size={14} /> Hosted authorize endpoint</div>
                    <p className="docs-stat-desc">Use the Zuup-hosted login page instead of building your own auth UI.</p>
                  </div>
                  <div className="docs-stat-card">
                    <div className="docs-stat-top"><Shield size={14} /> Consent behavior</div>
                    <p className="docs-stat-desc">`.zuup.dev` apps can skip consent; third-party apps show the consent screen.</p>
                  </div>
                  <div className="docs-stat-card">
                    <div className="docs-stat-top"><Code2 size={14} /> Server exchange</div>
                    <p className="docs-stat-desc">The token endpoint mints tokens after PKCE verification and profile lookup.</p>
                  </div>
                  <div className="docs-stat-card">
                    <div className="docs-stat-top"><Lock size={14} /> Session persistence</div>
                    <p className="docs-stat-desc">This repo uses Supabase auth session persistence with <InlineCode>storageKey: "zuup.auth.session"</InlineCode>.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Section
            id="quickstart"
            eyebrow="Getting started"
            title="Quick Start"
            lead="Follow this sequence if you want the shortest path from registration to a working login flow."
            delay={80}
          >
            <div className="docs-grid-2">
              {QUICK_STEPS.map((step, index) => (
                <div className="docs-step-card" key={step.title}>
                  <div className="docs-step-index">{index + 1}</div>
                  <h3 className="docs-card-title">{step.title}</h3>
                  <p className="docs-card-body">{step.body}</p>
                </div>
              ))}
            </div>

            <Alert type="info">
              If your site is not on a <InlineCode>zuup.dev</InlineCode> domain, users will see the consent screen before the browser returns to your app.
            </Alert>
          </Section>

          <Section
            id="register"
            eyebrow="Registration"
            title="Register the App"
            lead="Use a real callback page and register every production and preview domain you plan to ship."
            delay={160}
          >
            <div className="docs-grid-2">
              <div className="docs-env-card">
                <h3 className="docs-card-title">Where to register</h3>
                <p className="docs-card-body">
                  Register through the Zuup Auth signup flow at <InlineCode>auth.zuup.dev/signup</InlineCode> or the local app's signup route. Use the exact callback URL your app will
                  receive after login.
                </p>
              </div>
              <div className="docs-env-card">
                <h3 className="docs-card-title">Callback routes in this repo</h3>
                <p className="docs-card-body">
                  The guide is written to match real callback patterns such as <InlineCode>/callback</InlineCode> and <InlineCode>/auth/zuup/callback</InlineCode>. Pick one and keep it
                  consistent in your app registration and runtime code.
                </p>
              </div>
            </div>

            <div className="docs-grid-4">
              {APP_EXAMPLES.map((app) => (
                <div className="docs-app-card" key={app.clientId}>
                  <div className="docs-app-title">
                    <h4>{app.name}</h4>
                    <span className={`docs-badge ${app.firstParty ? "docs-badge-first" : "docs-badge-third"}`}>
                      {app.firstParty ? "First-party" : "Third-party"}
                    </span>
                  </div>
                  <p className="docs-card-body" style={{ marginBottom: 10 }}>
                    Client ID: <InlineCode>{app.clientId}</InlineCode>
                  </p>
                  <p className="docs-card-body" style={{ marginBottom: 8 }}>
                    Redirects:
                  </p>
                  <ul>
                    {app.redirects.slice(0, 3).map((redirect) => (
                      <li key={redirect}>{redirect}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Alert type="warning">
              If you are shipping a custom app, only request scopes that were actually registered for that client. The authorization validator rejects mismatched scopes and redirect URIs.
            </Alert>
          </Section>

          <Section
            id="environment"
            eyebrow="Configuration"
            title="Environment Variables"
            lead="Split values by where they are used. Browser-facing values need the `VITE_` prefix; secrets never should."
            delay={240}
          >
            <div className="docs-grid-2">
              <div className="docs-env-card">
                <h3 className="docs-card-title">Client-side variables</h3>
                <p className="docs-card-body">These are readable by browser code and should only contain public values.</p>
                <ul>
                  {CLIENT_VARS.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </div>
              <div className="docs-env-card">
                <h3 className="docs-card-title">Server-side variables</h3>
                <p className="docs-card-body">Keep these in server-only env vars or Vercel server settings.</p>
                <ul>
                  {SERVER_VARS.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </div>
            </div>

            <Alert type="info">
              In this repo, the token and userinfo endpoints also accept <InlineCode>ZUUP_OAUTH_SIGNING_SECRET</InlineCode> as the preferred signing secret fallback.
            </Alert>
          </Section>

          <Section
            id="frontend"
            eyebrow="Browser flow"
            title="Start Login from the Frontend"
            lead="Generate PKCE in the browser, store the verifier in session storage, and redirect to Zuup with the full authorization request."
            delay={320}
          >
            <div className="docs-grid-2">
              <div className="docs-mini-card">
                <div className="docs-mini-card-title"><Fingerprint size={14} /> Required query parameters</div>
                <p>client_id, redirect_uri, response_type=code, scope, state, code_challenge, and code_challenge_method=S256.</p>
              </div>
              <div className="docs-mini-card">
                <div className="docs-mini-card-title"><Info size={14} /> Repo reference</div>
                <p>The auth request validation happens before consent in <InlineCode>src/pages/Authorize.tsx</InlineCode> using <InlineCode>api/oauth/validate-request.js</InlineCode>.</p>
              </div>
            </div>

            <div className="docs-tabs">
              {Object.entries(EXAMPLES).map(([key, example]) => (
                <button
                  key={key}
                  className={`docs-tab ${activeExample === key ? "active" : ""}`}
                  onClick={() => setActiveExample(key as keyof typeof EXAMPLES)}
                >
                  {example.label}
                </button>
              ))}
            </div>

            <CodeBlock code={EXAMPLES[activeExample].code} lang={EXAMPLES[activeExample].lang} />
          </Section>

          <Section
            id="callback"
            eyebrow="Callback path"
            title="Handle the Callback and Exchange the Code"
            lead="Your callback page should do three things: verify state, confirm the PKCE verifier exists, and send the authorization code to your backend."
            delay={400}
          >
            <div className="docs-grid-2">
              <div className="docs-step-card">
                <div className="docs-step-index">1</div>
                <h3 className="docs-card-title">Check state</h3>
                <p className="docs-card-body">Reject the callback if the returned state does not match the one saved before redirect.</p>
              </div>
              <div className="docs-step-card">
                <div className="docs-step-index">2</div>
                <h3 className="docs-card-title">Verify the PKCE verifier</h3>
                <p className="docs-card-body">The browser must still have the original verifier available when the callback runs.</p>
              </div>
              <div className="docs-step-card">
                <div className="docs-step-index">3</div>
                <h3 className="docs-card-title">Exchange on the server</h3>
                <p className="docs-card-body">Post the code and verifier to your backend or to the app's token exchange endpoint.</p>
              </div>
              <div className="docs-step-card">
                <div className="docs-step-index">4</div>
                <h3 className="docs-card-title">Fetch userinfo</h3>
                <p className="docs-card-body">Use the returned access token to fetch the profile and hydrate your local session.</p>
              </div>
            </div>

            <CodeBlock code={EXAMPLES.server.code} lang={EXAMPLES.server.lang} />

            <Alert type="warning">
              Do not put <InlineCode>client_secret</InlineCode> in browser code. The server-side token exchange in this repo is handled by <InlineCode>api/oauth/token.js</InlineCode>.
            </Alert>
          </Section>

          <Section
            id="session"
            eyebrow="Persistence"
            title="Persist the Session"
            lead="This repo relies on Supabase auth session persistence and auth-state listeners to keep the app synced with the current user."
            delay={480}
          >
            <div className="docs-grid-2">
              <div className="docs-mini-card">
                <div className="docs-mini-card-title"><Lock size={14} /> Session storage</div>
                <p>Supabase auth is configured with persistence, auto-refresh, PKCE flow, and the storage key <InlineCode>zuup.auth.session</InlineCode>.</p>
              </div>
              <div className="docs-mini-card">
                <div className="docs-mini-card-title"><Shield size={14} /> Auth hydration</div>
                <p>The <InlineCode>useAuth</InlineCode> hook subscribes to auth-state changes and refreshes the session on visibility changes.</p>
              </div>
            </div>

            <Alert type="info">
              The app already keeps session state in sync through Supabase auth. Your external integration should store tokens in a secure location, not in ad hoc local storage.
            </Alert>
          </Section>

          <Section
            id="scopes"
            eyebrow="Authorization"
            title="Scopes"
            lead="Request the smallest scope set that satisfies the feature you are building. More scopes mean more consent friction."
            delay={560}
          >
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {SCOPES.map((scope) => (
                    <tr key={scope.scope}>
                      <td>
                        <InlineCode>{scope.scope}</InlineCode>
                      </td>
                      <td>{scope.required ? "Yes" : "No"}</td>
                      <td>{scope.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Alert type="info">
              The recommended default request is <InlineCode>openid profile email</InlineCode>. Add <InlineCode>offline_access</InlineCode> only if you need refresh tokens.
            </Alert>
          </Section>

          <Section
            id="endpoints"
            eyebrow="Reference"
            title="Endpoints"
            lead="These are the real endpoints used by the app and the server handlers in this repository."
            delay={640}
          >
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((endpoint) => (
                    <tr key={endpoint.path}>
                      <td>
                        <span className={`docs-method ${endpoint.method === "GET" ? "docs-method-get" : "docs-method-post"}`}>
                          {endpoint.method}
                        </span>
                      </td>
                      <td>
                        <InlineCode>{endpoint.path}</InlineCode>
                      </td>
                      <td>{endpoint.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="docs-grid-2">
              <div className="docs-env-card">
                <h3 className="docs-card-title">Hosted login</h3>
                <p className="docs-card-body">The hosted authorize URL is the public entry point. The local app mirrors the same auth rules in the React UI.</p>
              </div>
              <div className="docs-env-card">
                <h3 className="docs-card-title">Token + userinfo</h3>
                <p className="docs-card-body">The server exchange issues the access token, and userinfo returns the profile claims that the app hydrates.</p>
              </div>
            </div>
          </Section>

          <Section
            id="mistakes"
            eyebrow="Troubleshooting"
            title="Common Mistakes"
            lead="Most integration issues come from redirect mismatches or leaking secrets to the browser."
            delay={720}
          >
            <div className="docs-grid-2">
              {COMMON_MISTAKES.map((mistake) => (
                <div className="docs-mistake-card" key={mistake}>
                  <h3 className="docs-card-title">Watch out</h3>
                  <p className="docs-card-body">{mistake}</p>
                </div>
              ))}
            </div>

            <Alert type="warning">
              If a client hits <InlineCode>invalid_grant</InlineCode>, check the redirect URI, code age, and PKCE verifier first. The token exchange in this repo rejects mismatches
              immediately.
            </Alert>
          </Section>

          <Section
            id="repo-map"
            eyebrow="Repository guide"
            title="Repo Map"
            lead="These are the files that matter when you want to follow the implementation or adapt it for another app."
            delay={800}
          >
            <div className="docs-files-grid">
              {REPO_MAP.map((entry) => (
                <div className="docs-file-card" key={entry.file}>
                  <div className="docs-file-icon">
                    <Code2 size={18} />
                  </div>
                  <div>
                    <code>{entry.file}</code>
                    <p>{entry.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Alert type="info">
              The page is intentionally aligned to the implementation in this repository, not a generic OAuth guide. That keeps the docs useful when you are debugging the local demo or
              porting the same pattern into another site.
            </Alert>
          </Section>
        </main>
      </div>
    </div>
  );
}