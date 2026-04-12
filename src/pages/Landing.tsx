import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Key, Zap, Globe, Lock, Code2, ArrowRight,
  Check, ChevronRight, Users, Activity, Fingerprint,
  ExternalLink, Star, GitBranch,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Docs", href: "/docs" },
  { label: "Apps", href: "#apps" },
];

const FEATURES = [
  {
    icon: <Shield size={20} />,
    title: "OAuth 2.1 + PKCE",
    desc: "Industry-standard authorization code flow with PKCE. No implicit flow, no legacy hacks.",
    color: "coral",
  },
  {
    icon: <Key size={20} />,
    title: "One account, all apps",
    desc: "Sign in once with your Zuup account and access every Zuup service instantly.",
    color: "pink",
  },
  {
    icon: <Zap size={20} />,
    title: "Instant SSO",
    desc: "First-party apps get zero-friction SSO. Third-party apps get a full consent flow.",
    color: "coral",
  },
  {
    icon: <Activity size={20} />,
    title: "Audit log",
    desc: "Every login, token issuance, and consent event is recorded and visible to you.",
    color: "pink",
  },
  {
    icon: <Fingerprint size={20} />,
    title: "API Keys",
    desc: "Issue scoped API keys for server-to-server access with granular permissions.",
    color: "coral",
  },
  {
    icon: <Code2 size={20} />,
    title: "Developer-first",
    desc: "Copy-paste PKCE code snippets, live endpoint docs, and integration testing.",
    color: "pink",
  },
];

const ZUUP_APPS = [
  {
    name: "ZuupCode",
    desc: "Browser-based IDE with 30+ languages",
    url: "https://code.zuup.dev",
    icon: <Code2 size={18} />,
    badge: "First-party",
  },
  {
    name: "ZuupTime",
    desc: "Time tracking for developers",
    url: "https://time.zuup.dev",
    icon: <Activity size={18} />,
    badge: "First-party",
  },
  {
    name: "Zuup",
    desc: "The Zuup platform hub",
    url: "https://www.zuup.dev",
    icon: <Globe size={18} />,
    badge: "First-party",
  },
];

const CODE_SNIPPET = `const params = new URLSearchParams({
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: 'https://yourapp.com/callback',
  response_type: 'code',
  scope: 'openid profile email',
  code_challenge: challenge, // PKCE
  code_challenge_method: 'S256',
});

window.location.href =
  \`https://qnapwukqhybziduhzpow.supabase.co/auth/v1/oauth/authorize?\${params}\`;`;

// Animated counter hook
function useCounter(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

export default function Landing() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="landing-root">
      <style>{`
        .landing-root {
          min-height: 100vh;
          background: #0d0f14;
          color: #e8eaf0;
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
        }

        /* ── Nav ── */
        .l-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(13,15,20,0.85);
          backdrop-filter: blur(16px);
        }
        .l-nav-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 2rem;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .l-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
        }
        .l-logo img { height: 30px; width: auto; }
        .l-logo-text { font-size: 17px; font-weight: 700; color: #e8eaf0; }
        .l-logo-accent { font-size: 17px; font-weight: 300; color: #e8425a; }
        .l-nav-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 20px;
          background: rgba(232,66,90,0.12);
          color: #e8425a;
          border: 1px solid rgba(232,66,90,0.25);
          font-weight: 500;
        }
        .l-nav-links {
          display: flex;
          align-items: center;
          gap: 28px;
          list-style: none;
          margin: 0; padding: 0;
        }
        .l-nav-links a {
          font-size: 14px;
          color: #9ca3af;
          text-decoration: none;
          transition: color 0.15s;
        }
        .l-nav-links a:hover { color: #e8eaf0; }
        .l-nav-actions { display: flex; align-items: center; gap: 10px; }
        .btn-ghost {
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #9ca3af;
          background: transparent;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.15s;
          display: inline-flex; align-items: center;
        }
        .btn-ghost:hover { color: #e8eaf0; }
        .btn-primary {
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #e8425a, #f06080);
          border: none;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex; align-items: center; gap: 6px;
          transition: opacity 0.15s, transform 0.1s;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:active { transform: scale(0.98); }

        /* ── Hero ── */
        .l-hero {
          max-width: 1100px;
          margin: 0 auto;
          padding: 90px 2rem 70px;
          text-align: center;
          position: relative;
        }
        .l-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(232,66,90,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .l-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 20px;
          background: rgba(232,66,90,0.1);
          border: 1px solid rgba(232,66,90,0.2);
          font-size: 13px;
          color: #e8425a;
          margin-bottom: 28px;
          font-weight: 500;
        }
        .l-h1 {
          font-size: clamp(38px, 6vw, 68px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.02em;
          margin: 0 0 20px;
          color: #f1f3f8;
        }
        .l-h1 .accent { color: #e8425a; }
        .l-h1 .muted { color: #6b7280; }
        .l-subtitle {
          font-size: clamp(15px, 2vw, 18px);
          color: #9ca3af;
          max-width: 560px;
          margin: 0 auto 36px;
          line-height: 1.6;
        }
        .l-hero-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .btn-hero {
          padding: 13px 26px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #e8425a, #f06080);
          border: none;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.15s;
          box-shadow: 0 4px 24px rgba(232,66,90,0.25);
        }
        .btn-hero:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(232,66,90,0.35); }
        .btn-hero-ghost {
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          color: #9ca3af;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.15s;
        }
        .btn-hero-ghost:hover { background: rgba(255,255,255,0.08); color: #e8eaf0; }
        .l-meta {
          margin-top: 20px;
          font-size: 13px;
          color: #4b5563;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }
        .l-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: #374151; }

        /* ── Code preview ── */
        .l-code-wrap {
          max-width: 800px;
          margin: 60px auto 0;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          overflow: hidden;
          background: #111318;
          position: relative;
        }
        .l-code-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #161a22;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .l-dot { width: 12px; height: 12px; border-radius: 50%; }
        .l-dot-r { background: #e8425a; }
        .l-dot-y { background: #f59e0b; }
        .l-dot-g { background: #10b981; }
        .l-code-label {
          margin-left: 4px;
          font-size: 13px;
          color: #6b7280;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .l-code-body {
          padding: 24px;
          font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
          font-size: 13px;
          line-height: 1.7;
          color: #9ca3af;
          white-space: pre;
          overflow-x: auto;
        }
        .l-code-body .kw { color: #e8425a; }
        .l-code-body .str { color: #10b981; }
        .l-code-body .prop { color: #60a5fa; }
        .l-code-body .cmt { color: #4b5563; }
        .l-copy-btn {
          position: absolute;
          top: 52px; right: 14px;
          padding: 5px 12px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #9ca3af;
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          display: flex; align-items: center; gap: 5px;
          transition: all 0.15s;
        }
        .l-copy-btn:hover { background: rgba(255,255,255,0.1); color: #e8eaf0; }

        /* ── Stats ── */
        .l-stats {
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.015);
        }
        .l-stats-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 2rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 32px;
          text-align: center;
        }
        .l-stat-num {
          font-size: 36px;
          font-weight: 800;
          color: #f1f3f8;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .l-stat-num span { color: #e8425a; }
        .l-stat-label { font-size: 13px; color: #6b7280; margin-top: 6px; }

        /* ── Section ── */
        .l-section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 80px 2rem;
        }
        .l-section-tag {
          font-size: 12px;
          font-weight: 600;
          color: #e8425a;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }
        .l-section-title {
          font-size: clamp(26px, 3.5vw, 40px);
          font-weight: 800;
          color: #f1f3f8;
          letter-spacing: -0.02em;
          margin: 0 0 14px;
          line-height: 1.15;
        }
        .l-section-sub {
          font-size: 16px;
          color: #6b7280;
          max-width: 500px;
          line-height: 1.6;
          margin: 0 0 48px;
        }

        /* ── Features grid ── */
        .l-features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          overflow: hidden;
        }
        .l-feature {
          background: #0d0f14;
          padding: 28px;
          transition: background 0.15s;
        }
        .l-feature:hover { background: #111318; }
        .l-feature-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
          color: #e8425a;
          background: rgba(232,66,90,0.1);
          border: 1px solid rgba(232,66,90,0.15);
        }
        .l-feature-title {
          font-size: 15px;
          font-weight: 600;
          color: #e8eaf0;
          margin-bottom: 6px;
        }
        .l-feature-desc { font-size: 13px; color: #6b7280; line-height: 1.6; }

        /* ── Apps grid ── */
        .l-apps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .l-app-card {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 22px;
          background: #111318;
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          transition: all 0.15s;
          position: relative;
          overflow: hidden;
        }
        .l-app-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(232,66,90,0.04), transparent);
          opacity: 0;
          transition: opacity 0.15s;
        }
        .l-app-card:hover { border-color: rgba(232,66,90,0.25); transform: translateY(-2px); }
        .l-app-card:hover::before { opacity: 1; }
        .l-app-icon {
          width: 44px; height: 44px;
          border-radius: 10px;
          background: rgba(232,66,90,0.1);
          border: 1px solid rgba(232,66,90,0.15);
          display: flex; align-items: center; justify-content: center;
          color: #e8425a;
          shrink: 0;
        }
        .l-app-name { font-size: 15px; font-weight: 600; color: #e8eaf0; }
        .l-app-desc { font-size: 13px; color: #6b7280; margin-top: 2px; }
        .l-app-badge {
          margin-left: auto;
          padding: 3px 10px;
          border-radius: 20px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          font-size: 11px;
          color: #10b981;
          font-weight: 500;
          white-space: nowrap;
        }
        .l-app-arrow {
          margin-left: auto;
          color: #4b5563;
        }

        /* ── Flow diagram ── */
        .l-flow {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0;
          position: relative;
        }
        .l-flow-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 0 20px;
          position: relative;
        }
        .l-flow-step:not(:last-child)::after {
          content: '';
          position: absolute;
          right: -1px; top: 24px;
          width: 2px; height: 2px;
          background: rgba(232,66,90,0.4);
          box-shadow: 8px 0 0 rgba(232,66,90,0.4), 16px 0 0 rgba(232,66,90,0.4);
        }
        .l-flow-num {
          width: 48px; height: 48px;
          border-radius: 50%;
          border: 2px solid rgba(232,66,90,0.3);
          background: rgba(232,66,90,0.08);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: #e8425a;
          margin-bottom: 14px;
        }
        .l-flow-title { font-size: 14px; font-weight: 600; color: #e8eaf0; margin-bottom: 6px; }
        .l-flow-desc { font-size: 12px; color: #6b7280; line-height: 1.5; }

        /* ── CTA ── */
        .l-cta {
          border-top: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, transparent, rgba(232,66,90,0.04));
        }
        .l-cta-inner {
          max-width: 700px;
          margin: 0 auto;
          padding: 80px 2rem;
          text-align: center;
        }

        /* ── Footer ── */
        .l-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 28px 2rem;
          text-align: center;
        }
        .l-footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .l-footer-copy { font-size: 13px; color: #4b5563; }
        .l-footer-links { display: flex; gap: 20px; }
        .l-footer-links a {
          font-size: 13px;
          color: #4b5563;
          text-decoration: none;
          transition: color 0.15s;
        }
        .l-footer-links a:hover { color: #9ca3af; }

        @media (max-width: 640px) {
          .l-nav-links { display: none; }
          .l-flow { grid-template-columns: 1fr; gap: 24px; }
          .l-flow-step:not(:last-child)::after { display: none; }
          .l-footer-inner { flex-direction: column; text-align: center; }
        }
      `}</style>

      {/* Nav */}
      <nav className="l-nav">
        <div className="l-nav-inner">
          <Link to="/" className="l-logo">
            <img src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png" alt="Zuup" />
            <span className="l-logo-text">Zuup</span>
            <span className="l-logo-accent">Auth</span>
            <span className="l-nav-badge">OAuth 2.1</span>
          </Link>
          <ul className="l-nav-links">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                {l.href.startsWith("/") ? (
                  <Link to={l.href}>{l.label}</Link>
                ) : (
                  <a href={l.href}>{l.label}</a>
                )}
              </li>
            ))}
          </ul>
          <div className="l-nav-actions">
            <Link to="/login" className="btn-ghost">Sign In</Link>
            <Link to="/signup" className="btn-primary">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="l-hero">
        <div className="l-badge">
          <Shield size={13} />
          Secure · Open · Developer-first
        </div>
        <h1 className="l-h1">
          Auth for the<br />
          <span className="accent">Zuup ecosystem.</span><br />
          <span className="muted">Done right.</span>
        </h1>
        <p className="l-subtitle">
          One account across every Zuup service. OAuth 2.1 with PKCE, scoped consent, API keys, and audit logs — built for developers who care about security.
        </p>
        <div className="l-hero-actions">
          <Link to="/signup" className="btn-hero">
            Create Account <ArrowRight size={16} />
          </Link>
          <Link to="/docs" className="btn-hero-ghost">
            <Code2 size={16} /> View Docs
          </Link>
        </div>
        <div className="l-meta">
          <span>Authorization Code + PKCE</span>
          <div className="l-meta-dot" />
          <span>OpenID Connect</span>
          <div className="l-meta-dot" />
          <span>Supabase-backed</span>
        </div>

        {/* Code preview */}
        <div className="l-code-wrap">
          <div className="l-code-bar">
            <div className="l-dot l-dot-r" />
            <div className="l-dot l-dot-y" />
            <div className="l-dot l-dot-g" />
            <span className="l-code-label">authorize.ts — Zuup Auth integration</span>
          </div>
          <button className="l-copy-btn" onClick={handleCopy}>
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
          <div className="l-code-body">
<span className="kw">const</span> params = <span className="kw">new</span> <span className="prop">URLSearchParams</span>{"({"}{"\n"}
  <span className="str">  client_id</span>: <span className="str">'YOUR_CLIENT_ID'</span>,{"\n"}
  <span className="str">  redirect_uri</span>: <span className="str">'https://yourapp.com/callback'</span>,{"\n"}
  <span className="str">  response_type</span>: <span className="str">'code'</span>,{"\n"}
  <span className="str">  scope</span>: <span className="str">'openid profile email'</span>,{"\n"}
  <span className="str">  code_challenge</span>: challenge, <span className="cmt">// PKCE S256</span>{"\n"}
  <span className="str">  code_challenge_method</span>: <span className="str">'S256'</span>,{"\n"}
{"});"}{"\n\n"}
<span className="prop">window</span>.location.href ={"\n"}
  <span className="str">`https://qnapwukqhybziduhzpow.supabase.co/auth/v1/oauth/authorize?</span>{"${params}"}<span className="str">`</span>;
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="l-stats">
        <div className="l-stats-inner">
          {[
            { num: 3, suffix: "+", label: "Zuup apps connected" },
            { num: 6, suffix: "", label: "OAuth scopes supported" },
            { num: 100, suffix: "%", label: "PKCE enforced" },
            { num: 0, suffix: " implicit", label: "Flow legacy endpoints" },
          ].map(({ num, suffix, label }) => (
            <div key={label}>
              <div className="l-stat-num">{num}<span>{suffix}</span></div>
              <div className="l-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="l-section" id="features">
        <div className="l-section-tag">Features</div>
        <h2 className="l-section-title">Everything you need.<br />Nothing you don't.</h2>
        <p className="l-section-sub">Built on OAuth 2.1 best practices. No legacy flows, no insecure shortcuts.</p>
        <div className="l-features">
          {FEATURES.map((f) => (
            <div className="l-feature" key={f.title}>
              <div className="l-feature-icon">{f.icon}</div>
              <div className="l-feature-title">{f.title}</div>
              <div className="l-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="l-section">
          <div className="l-section-tag">How it works</div>
          <h2 className="l-section-title">Four steps to SSO.</h2>
          <p className="l-section-sub">Standard OAuth 2.1 authorization code flow. Works with any language or framework.</p>
          <div className="l-flow">
            {[
              { n: "1", title: "Generate PKCE", desc: "Create a code_verifier and SHA-256 code_challenge in your app" },
              { n: "2", title: "Redirect to Zuup", desc: "Send the user to /authorize with your client_id and challenge" },
              { n: "3", title: "User signs in", desc: "Zuup handles authentication and consent, then redirects back with a code" },
              { n: "4", title: "Exchange for tokens", desc: "POST to /token with the code + verifier. Receive access & refresh tokens" },
            ].map((s) => (
              <div className="l-flow-step" key={s.n}>
                <div className="l-flow-num">{s.n}</div>
                <div className="l-flow-title">{s.title}</div>
                <div className="l-flow-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zuup Apps */}
      <section className="l-section" id="apps">
        <div className="l-section-tag">Ecosystem</div>
        <h2 className="l-section-title">Works across all Zuup apps.</h2>
        <p className="l-section-sub">First-party apps get seamless SSO. Third-party apps get a full OAuth consent flow.</p>
        <div className="l-apps-grid">
          {ZUUP_APPS.map((app) => (
            <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer" className="l-app-card">
              <div className="l-app-icon">{app.icon}</div>
              <div>
                <div className="l-app-name">{app.name}</div>
                <div className="l-app-desc">{app.desc}</div>
              </div>
              <span className="l-app-badge">{app.badge}</span>
            </a>
          ))}
          <div className="l-app-card" style={{ borderStyle: "dashed", cursor: "default" }}>
            <div className="l-app-icon" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", color: "#4b5563" }}>
              <Globe size={18} />
            </div>
            <div>
              <div className="l-app-name" style={{ color: "#6b7280" }}>Your App</div>
              <div className="l-app-desc">Integrate Zuup Auth in minutes</div>
            </div>
            <Link to="/docs" className="btn-primary" style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "13px" }}>
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="l-cta">
        <div className="l-cta-inner">
          <div className="l-section-tag" style={{ textAlign: "center" }}>Get started</div>
          <h2 className="l-section-title" style={{ textAlign: "center" }}>
            Build with Zuup Auth<br />in minutes.
          </h2>
          <p style={{ fontSize: "15px", color: "#6b7280", marginBottom: "32px", lineHeight: 1.6 }}>
            Register your app, grab your client credentials, and follow the docs. First integration takes less than 30 minutes.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/signup" className="btn-hero">
              Create free account <ArrowRight size={16} />
            </Link>
            <Link to="/docs" className="btn-hero-ghost">
              <Code2 size={16} /> Read the docs
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-copy">© 2026 Zuup · Made by Jagrit Sachdev</div>
          <div className="l-footer-links">
            <Link to="/docs">Docs</Link>
            <a href="https://www.zuup.dev" target="_blank" rel="noopener noreferrer">Zuup</a>
            <a href="https://code.zuup.dev" target="_blank" rel="noopener noreferrer">ZuupCode</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// tiny inline icon since we can't import from lucide inline
function Copy({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
