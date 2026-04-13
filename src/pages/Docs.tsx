import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Key, Code2, ChevronRight, Copy, Check,
  ArrowRight, Zap, Lock, Globe, Fingerprint,
  AlertTriangle, Info, ExternalLink, Terminal,
} from "lucide-react";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quickstart" },
  { id: "pkce", label: "PKCE Flow" },
  { id: "scopes", label: "Scopes" },
  { id: "endpoints", label: "Endpoints" },
  { id: "register", label: "Register an App" },
  { id: "examples", label: "Code Examples" },
  { id: "errors", label: "Error Reference" },
];

const SCOPES = [
  { scope: "openid", desc: "Required for OIDC. Returns an id_token with user identity.", required: true },
  { scope: "profile", desc: "Access to full_name, username, and avatar_url.", required: false },
  { scope: "email", desc: "Read the user's email address.", required: false },
  { scope: "offline_access", desc: "Issue a refresh_token for long-lived access.", required: false },
  { scope: "zuup:read", desc: "Read Zuup user data and settings.", required: false },
  { scope: "zuup:write", desc: "Create and update Zuup user data.", required: false },
  { scope: "zuup:admin", desc: "Full admin access. Requires explicit approval.", required: false },
];

const ENDPOINTS = [
  { method: "GET", path: "https://auth.zuup.dev/authorize", desc: "Initiate authorization. Redirects to login/consent." },
  { method: "POST", path: "https://auth.zuup.dev/api/oauth/token", desc: "Exchange authorization code for access + refresh tokens." },
  { method: "GET", path: "https://auth.zuup.dev/api/oauth/userinfo", desc: "Fetch the authenticated user's profile (Bearer token)." },
  { method: "POST", path: "/revoke", desc: "Revoke an access or refresh token." },
  { method: "GET", path: "/.well-known/openid-configuration", desc: "OIDC discovery document." },
  { method: "GET", path: "/.well-known/jwks.json", desc: "JSON Web Key Set for token verification." },
];

const ERRORS = [
  { code: "invalid_request", desc: "Missing or malformed parameters.", fix: "Check client_id, redirect_uri, and response_type." },
  { code: "invalid_client", desc: "Unknown or unauthorized client.", fix: "Verify your client_id is registered." },
  { code: "invalid_grant", desc: "Auth code expired, used, or PKCE mismatch.", fix: "Codes expire in 10 min and are single-use." },
  { code: "access_denied", desc: "User denied the consent request.", fix: "Handle gracefully — show your app's fallback." },
  { code: "unsupported_grant_type", desc: "Only authorization_code is supported.", fix: "Use the correct grant_type in your token request." },
  { code: "invalid_scope", desc: "Scope not registered for this client.", fix: "Request only scopes listed in your app's config." },
];

const EXAMPLES: Record<string, { lang: string; code: string }> = {
  "JavaScript (Vanilla)": {
    lang: "javascript",
    code: `// 1. Generate PKCE
async function generatePKCE() {
  const verifier = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
  ).replace(/[+/=]/g, c => ({'+':'-','/':'_','=':''})[c]);

  const hash = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(verifier)
  );
  const challenge = btoa(
    String.fromCharCode(...new Uint8Array(hash))
  ).replace(/[+/=]/g, c => ({'+':'-','/':'_','=':''})[c]);

  return { verifier, challenge };
}

// 2. Redirect to Zuup
async function loginWithZuup() {
  const { verifier, challenge } = await generatePKCE();
  const state = crypto.randomUUID();
  
  sessionStorage.setItem('pkce_verifier', verifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: 'YOUR_CLIENT_ID',
    redirect_uri: window.location.origin + '/callback',
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = \`https://auth.zuup.dev/authorize?\${params}\`;
}

// 3. Handle callback
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (state !== sessionStorage.getItem('oauth_state')) {
    throw new Error('State mismatch — possible CSRF attack');
  }

  // Exchange code (do this server-side in production!)
  const res = await fetch('https://auth.zuup.dev/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET', // server-side only!
      code,
      redirect_uri: window.location.origin + '/callback',
      code_verifier: sessionStorage.getItem('pkce_verifier'),
    }),
  });

  const { access_token, refresh_token } = await res.json();

  const userRes = await fetch('https://auth.zuup.dev/api/oauth/userinfo', {
    headers: { Authorization: 'Bearer ' + access_token },
  });
  const user = await userRes.json();

  console.log('Logged in as:', user?.email);
  return { access_token, refresh_token };
}`,
  },
  "React + Supabase": {
    lang: "typescript",
    code: `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In your component
function LoginButton() {
  const login = async () => {
    const verifier = generateVerifier(); // see JS example
    const challenge = await generateChallenge(verifier);
    
    sessionStorage.setItem('pkce_verifier', verifier);
    
    const params = new URLSearchParams({
      client_id: 'YOUR_CLIENT_ID',
      redirect_uri: window.location.origin + '/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: crypto.randomUUID(),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    
    window.location.href = \`https://auth.zuup.dev/authorize?\${params}\`;
  };

  return <button onClick={login}>Login with Zuup</button>;
}

// In your /callback route
async function handleCallback(code: string) {
  // Your backend exchanges the code with Zuup Auth
  const { access_token, refresh_token } = await exchangeCode(code);

  const profileRes = await fetch('https://auth.zuup.dev/api/oauth/userinfo', {
    headers: { Authorization: 'Bearer ' + access_token },
  });
  const user = await profileRes.json();

  console.log('Logged in as:', user?.email);
}`,
  },
  "Next.js (App Router)": {
    lang: "typescript",
    code: `// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  // Verify state from cookie
  const storedState = req.cookies.get('oauth_state')?.value;
  if (state !== storedState) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
  }
  
  const verifier = req.cookies.get('pkce_verifier')?.value;
  
  // Exchange code for tokens (this IS server-side — safe!)
  const tokenRes = await fetch('https://auth.zuup.dev/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZUUP_CLIENT_ID!,
      client_secret: process.env.ZUUP_CLIENT_SECRET!, // safe on server
      code: code!,
      redirect_uri: \`\${process.env.APP_URL}/api/auth/callback\`,
      code_verifier: verifier!,
    }),
  });
  
  const { access_token, refresh_token } = await tokenRes.json();
  
  // Store in httpOnly cookies
  const response = NextResponse.redirect(new URL('/dashboard', req.url));
  response.cookies.set('access_token', access_token, { httpOnly: true, secure: true });
  response.cookies.set('refresh_token', refresh_token, { httpOnly: true, secure: true });
  return response;
}`,
  },
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="docs-code-wrap">
      <div className="docs-code-bar">
        <span className="docs-code-lang">{lang}</span>
        <button className="docs-copy-btn" onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="docs-code-body">{code}</pre>
    </div>
  );
}

function Alert({ type, children }: { type: "warning" | "info"; children: React.ReactNode }) {
  const styles = {
    warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", color: "#f59e0b", Icon: AlertTriangle },
    info: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)", color: "#60a5fa", Icon: Info },
  };
  const s = styles[type];
  return (
    <div className="docs-alert" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <s.Icon size={15} style={{ color: s.color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState("overview");
  const [activeExample, setActiveExample] = useState("JavaScript (Vanilla)");

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="docs-root">
      <style>{`
        .docs-root {
          min-height: 100vh;
          background: #0d0f14;
          color: #e8eaf0;
          font-family: 'Inter', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .docs-nav {
          position: sticky; top: 0; z-index: 50;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(13,15,20,0.9);
          backdrop-filter: blur(16px);
        }
        .docs-nav-inner {
          max-width: 1200px; margin: 0 auto;
          padding: 0 2rem; height: 58px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .docs-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .docs-logo img { height: 28px; width: auto; }
        .docs-logo-t { font-size: 16px; font-weight: 700; color: #e8eaf0; }
        .docs-logo-a { font-size: 16px; font-weight: 300; color: #e8425a; }
        .docs-nav-right { display: flex; align-items: center; gap: 16px; }
        .docs-nav-right a { font-size: 13px; color: #6b7280; text-decoration: none; transition: color .15s; }
        .docs-nav-right a:hover { color: #e8eaf0; }
        .docs-btn {
          padding: 7px 16px; border-radius: 8px;
          font-size: 13px; font-weight: 600; color: #fff;
          background: linear-gradient(135deg, #e8425a, #f06080);
          border: none; cursor: pointer; text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px;
        }

        .docs-body { display: flex; flex: 1; max-width: 1200px; margin: 0 auto; width: 100%; }

        /* sidebar */
        .docs-sidebar {
          width: 220px; shrink: 0; flex-shrink: 0;
          position: sticky; top: 58px; height: calc(100vh - 58px);
          overflow-y: auto; padding: 28px 0;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .docs-sidebar-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .08em; color: #4b5563;
          padding: 0 20px; margin-bottom: 8px;
        }
        .docs-sidebar-link {
          display: block; padding: 7px 20px;
          font-size: 13px; color: #6b7280;
          text-decoration: none; cursor: pointer;
          transition: all .12s; border-left: 2px solid transparent;
        }
        .docs-sidebar-link:hover { color: #e8eaf0; background: rgba(255,255,255,0.03); }
        .docs-sidebar-link.active { color: #e8425a; border-left-color: #e8425a; background: rgba(232,66,90,0.06); }

        /* content */
        .docs-content { flex: 1; padding: 40px 48px; min-width: 0; }

        .docs-section { margin-bottom: 64px; scroll-margin-top: 80px; }
        .docs-section-tag {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: .1em; color: #e8425a; margin-bottom: 8px;
        }
        .docs-h2 {
          font-size: 28px; font-weight: 800; color: #f1f3f8;
          letter-spacing: -.02em; margin: 0 0 10px; line-height: 1.2;
        }
        .docs-lead { font-size: 15px; color: #6b7280; line-height: 1.7; margin-bottom: 24px; }
        .docs-p { font-size: 14px; color: #9ca3af; line-height: 1.8; margin-bottom: 16px; }
        .docs-h3 { font-size: 17px; font-weight: 600; color: #e8eaf0; margin: 28px 0 10px; }

        /* code */
        .docs-code-wrap {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; overflow: hidden;
          background: #111318; margin: 16px 0;
        }
        .docs-code-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px;
          background: #161a22; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .docs-code-lang { font-size: 12px; color: #6b7280; font-family: 'SF Mono', monospace; }
        .docs-copy-btn {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04); color: #9ca3af;
          font-size: 12px; cursor: pointer; font-family: inherit;
          transition: all .15s;
        }
        .docs-copy-btn:hover { background: rgba(255,255,255,0.09); color: #e8eaf0; }
        .docs-code-body {
          padding: 20px; font-size: 12.5px; line-height: 1.7;
          color: #9ca3af; font-family: 'SF Mono', 'Fira Code', monospace;
          overflow-x: auto; margin: 0;
          white-space: pre;
        }

        /* alert */
        .docs-alert {
          display: flex; gap: 10px; padding: 14px 16px;
          border-radius: 10px; margin: 16px 0;
        }

        /* inline code */
        .ic {
          font-family: 'SF Mono', monospace; font-size: 12px;
          background: rgba(255,255,255,0.08); color: #e8425a;
          padding: 1px 6px; border-radius: 4px;
        }

        /* table */
        .docs-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        .docs-table th { text-align: left; padding: 10px 12px; color: #6b7280; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .docs-table td { padding: 10px 12px; color: #9ca3af; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
        .docs-table td:first-child { font-family: 'SF Mono', monospace; color: #e8425a; font-size: 12px; white-space: nowrap; }
        .docs-table tr:last-child td { border-bottom: none; }

        /* endpoint table */
        .docs-ep-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
        .docs-ep-table td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #9ca3af; }
        .docs-ep-table td:first-child { width: 60px; }
        .docs-ep-table tr:last-child td { border-bottom: none; }
        .method-badge {
          display: inline-block; padding: 2px 8px; border-radius: 4px;
          font-size: 11px; font-weight: 700; font-family: monospace;
        }
        .method-get { background: rgba(16,185,129,0.12); color: #10b981; }
        .method-post { background: rgba(59,130,246,0.12); color: #60a5fa; }

        /* scope pills */
        .scope-req { background: rgba(232,66,90,0.1); color: #e8425a; border: 1px solid rgba(232,66,90,0.2); font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 500; }

        /* example tabs */
        .docs-tabs { display: flex; gap: 4px; margin-bottom: 0; flex-wrap: wrap; }
        .docs-tab {
          padding: 7px 14px; border-radius: 8px 8px 0 0;
          font-size: 13px; color: #6b7280; cursor: pointer;
          background: transparent; border: none; font-family: inherit;
          transition: all .12s;
          border: 1px solid transparent;
          border-bottom: none;
        }
        .docs-tab:hover { color: #e8eaf0; }
        .docs-tab.active { color: #e8eaf0; background: #111318; border-color: rgba(255,255,255,0.08); }

        /* register card */
        .docs-register-steps { display: grid; gap: 16px; }
        .docs-register-step {
          display: flex; gap: 16px;
          padding: 18px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.07);
          background: #111318;
        }
        .docs-step-num {
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(232,66,90,0.1); border: 1px solid rgba(232,66,90,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #e8425a; flex-shrink: 0;
        }
        .docs-step-title { font-size: 14px; font-weight: 600; color: #e8eaf0; margin-bottom: 4px; }
        .docs-step-body { font-size: 13px; color: #6b7280; line-height: 1.6; }

        @media (max-width: 768px) {
          .docs-sidebar { display: none; }
          .docs-content { padding: 24px 20px; }
        }
      `}</style>

      {/* Nav */}
      <nav className="docs-nav">
        <div className="docs-nav-inner">
          <Link to="/" className="docs-logo">
            <img src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png" alt="Zuup" />
            <span className="docs-logo-t">Zuup</span>
            <span className="docs-logo-a">Auth</span>
            <span style={{ fontSize: 12, color: "#4b5563", marginLeft: 4 }}>/ Docs</span>
          </Link>
          <div className="docs-nav-right">
            <Link to="/">Home</Link>
            <Link to="/profile">Dashboard</Link>
            <Link to="/signup" className="docs-btn">
              Get Started <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      <div className="docs-body">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-label">Documentation</div>
          {SECTIONS.map((s) => (
            <div
              key={s.id}
              className={`docs-sidebar-link ${activeSection === s.id ? "active" : ""}`}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </div>
          ))}
          <div style={{ margin: "20px 20px 8px", height: "1px", background: "rgba(255,255,255,0.06)" }} />
          <div className="docs-sidebar-label" style={{ marginTop: 16 }}>Resources</div>
          <a href="https://www.zuup.dev" target="_blank" rel="noopener noreferrer" className="docs-sidebar-link">
            Zuup Platform <ExternalLink size={11} style={{ display: "inline", marginLeft: 4 }} />
          </a>
          <Link to="/profile" className="docs-sidebar-link">Your Dashboard</Link>
        </aside>

        {/* Content */}
        <main className="docs-content">

          {/* Overview */}
          <section className="docs-section" id="overview">
            <div className="docs-section-tag">Introduction</div>
            <h1 className="docs-h2">Zuup Auth</h1>
            <p className="docs-lead">
              Zuup Auth is a centralized identity provider for all Zuup services. It implements OAuth 2.1 with mandatory PKCE and OpenID Connect, giving your app secure access to Zuup user accounts.
            </p>
            <Alert type="info">
              <strong style={{ color: "#60a5fa" }}>OAuth 2.1 only.</strong> Zuup Auth does not support the implicit flow or password grant. All integrations must use the authorization code flow with PKCE.
            </Alert>
            <h3 className="docs-h3">Base URL</h3>
            <CodeBlock lang="text" code="https://auth.zuup.dev" />
            <h3 className="docs-h3">How first-party apps work</h3>
            <p className="docs-p">
              Apps with a <span className="ic">zuup.dev</span> domain are automatically treated as first-party. They skip the OAuth consent screen — users are redirected back to the app immediately after signing in. Third-party apps always show a full consent screen listing requested scopes.
            </p>
          </section>

          {/* Quickstart */}
          <section className="docs-section" id="quickstart">
            <div className="docs-section-tag">Getting started</div>
            <h2 className="docs-h2">Quickstart</h2>
            <p className="docs-lead">Add "Login with Zuup" to your app in four steps.</p>
            <div className="docs-register-steps">
              {[
                { n: "1", title: "Create an account & register your app", body: <>Sign up at <Link to="/signup" style={{ color: "#e8425a" }}>auth.zuup.dev/signup</Link>, go to your <strong>Profile → Apps</strong> tab, and register your application. You'll get a <span className="ic">client_id</span> and a <span className="ic">client_secret</span> (shown once — store it safely).</> },
                { n: "2", title: "Generate PKCE credentials", body: <>Before each login, generate a random <span className="ic">code_verifier</span> and compute its SHA-256 hash as the <span className="ic">code_challenge</span>. See the PKCE section below for exact code.</> },
                { n: "3", title: "Redirect to /authorize", body: <>Send the user to <span className="ic">/authorize</span> with your <span className="ic">client_id</span>, <span className="ic">redirect_uri</span>, requested <span className="ic">scope</span>, and PKCE parameters. Zuup handles auth and redirects back with a short-lived <span className="ic">code</span>.</> },
                { n: "4", title: "Exchange the code for tokens", body: <>On your server, POST to <span className="ic">/token</span> with the code, your <span className="ic">client_secret</span>, and the <span className="ic">code_verifier</span>. You receive <span className="ic">access_token</span> and optionally <span className="ic">refresh_token</span>.</> },
              ].map((s) => (
                <div className="docs-register-step" key={s.n}>
                  <div className="docs-step-num">{s.n}</div>
                  <div><div className="docs-step-title">{s.title}</div><div className="docs-step-body">{s.body}</div></div>
                </div>
              ))}
            </div>
          </section>

          {/* PKCE */}
          <section className="docs-section" id="pkce">
            <div className="docs-section-tag">Security</div>
            <h2 className="docs-h2">PKCE Flow</h2>
            <p className="docs-lead">Proof Key for Code Exchange (PKCE) prevents authorization code interception attacks. It's required for all Zuup Auth integrations.</p>
            <Alert type="warning">
              <strong style={{ color: "#f59e0b" }}>Never skip PKCE.</strong> Requests without a <span className="ic">code_challenge</span> will still work for first-party apps, but are considered insecure. Third-party apps must include PKCE.
            </Alert>
            <h3 className="docs-h3">Step 1 — Authorization Request</h3>
            <CodeBlock lang="text" code={`GET /authorize?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &response_type=code
  &scope=openid%20profile%20email
  &state=RANDOM_STATE_VALUE
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256`} />
            <h3 className="docs-h3">Step 2 — Callback (receive code)</h3>
            <CodeBlock lang="text" code={`GET https://yourapp.com/callback?
  code=AUTH_CODE_HERE
  &state=RANDOM_STATE_VALUE`} />
            <h3 className="docs-h3">Step 3 — Token Exchange</h3>
            <CodeBlock lang="text" code={`POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&code=AUTH_CODE_HERE
&redirect_uri=https://yourapp.com/callback
&code_verifier=ORIGINAL_VERIFIER`} />
            <h3 className="docs-h3">Token Response</h3>
            <CodeBlock lang="json" code={`{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "zuup_rt_...",
  "scope": "openid profile email"
}`} />
          </section>

          {/* Scopes */}
          <section className="docs-section" id="scopes">
            <div className="docs-section-tag">Authorization</div>
            <h2 className="docs-h2">Scopes</h2>
            <p className="docs-lead">Scopes define what your app can access. Request only what you need — users see every requested scope on the consent screen.</p>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Description</th>
                  <th style={{ width: 90 }}>Default</th>
                </tr>
              </thead>
              <tbody>
                {SCOPES.map((s) => (
                  <tr key={s.scope}>
                    <td>{s.scope}</td>
                    <td style={{ fontSize: 13 }}>{s.desc}</td>
                    <td>{s.required && <span className="scope-req">required</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Alert type="info">
              Request scopes as a space-separated string: <span className="ic">scope=openid profile email</span>
            </Alert>
          </section>

          {/* Endpoints */}
          <section className="docs-section" id="endpoints">
            <div className="docs-section-tag">Reference</div>
            <h2 className="docs-h2">Endpoints</h2>
            <table className="docs-ep-table">
              <tbody>
                {ENDPOINTS.map((ep) => (
                  <tr key={ep.path}>
                    <td><span className={`method-badge ${ep.method === "GET" ? "method-get" : "method-post"}`}>{ep.method}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "#e8eaf0" }}>{ep.path}</td>
                    <td>{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="docs-h3">OIDC Discovery</h3>
            <p className="docs-p">The OpenID Connect discovery document is available at <span className="ic">/.well-known/openid-configuration</span> and contains all endpoint URLs, supported scopes, and signing key information.</p>
          </section>

          {/* Register */}
          <section className="docs-section" id="register">
            <div className="docs-section-tag">Setup</div>
            <h2 className="docs-h2">Register an App</h2>
            <p className="docs-lead">Apps must be registered before they can request OAuth authorization.</p>
            <div className="docs-register-steps">
              <div className="docs-register-step">
                <div className="docs-step-num">1</div>
                <div>
                  <div className="docs-step-title">Go to Profile → Apps → Add App</div>
                  <div className="docs-step-body">
                    Sign in to your Zuup Auth account and navigate to the Apps tab in your profile. Click "Add App" to open the registration dialog.
                  </div>
                </div>
              </div>
              <div className="docs-register-step">
                <div className="docs-step-num">2</div>
                <div>
                  <div className="docs-step-title">Fill in app details</div>
                  <div className="docs-step-body">
                    Provide your app name, homepage URL, and the redirect URI(s) that Zuup will send authorization codes to. Apps with a <span className="ic">zuup.dev</span> domain are automatically first-party.
                  </div>
                </div>
              </div>
              <div className="docs-register-step">
                <div className="docs-step-num">3</div>
                <div>
                  <div className="docs-step-title">Save your credentials</div>
                  <div className="docs-step-body">
                    You'll receive a <span className="ic">client_id</span> and a <span className="ic">client_secret</span>. The secret is shown exactly once — copy it to a secure secret manager (e.g. Vercel env vars, AWS Secrets Manager). Never put it in client-side code.
                  </div>
                </div>
              </div>
            </div>
            <Alert type="warning">
              Apps registered through the UI are stored locally for demo purposes. In production, app registrations are stored in the Zuup Auth database and require admin approval for <span className="ic">zuup:admin</span> scope.
            </Alert>
          </section>

          {/* Examples */}
          <section className="docs-section" id="examples">
            <div className="docs-section-tag">Code</div>
            <h2 className="docs-h2">Code Examples</h2>
            <p className="docs-lead">Full integration examples for common frameworks.</p>
            <div className="docs-tabs">
              {Object.keys(EXAMPLES).map((k) => (
                <button key={k} className={`docs-tab ${activeExample === k ? "active" : ""}`} onClick={() => setActiveExample(k)}>
                  {k}
                </button>
              ))}
            </div>
            <CodeBlock lang={EXAMPLES[activeExample].lang} code={EXAMPLES[activeExample].code} />
          </section>

          {/* Errors */}
          <section className="docs-section" id="errors">
            <div className="docs-section-tag">Reference</div>
            <h2 className="docs-h2">Error Reference</h2>
            <p className="docs-lead">OAuth errors are returned as query parameters on your redirect_uri, or as JSON from the token endpoint.</p>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Error code</th>
                  <th>Meaning</th>
                  <th>How to fix</th>
                </tr>
              </thead>
              <tbody>
                {ERRORS.map((e) => (
                  <tr key={e.code}>
                    <td>{e.code}</td>
                    <td>{e.desc}</td>
                    <td style={{ color: "#6b7280" }}>{e.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

        </main>
      </div>
    </div>
  );
}
