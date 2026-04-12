import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { OAUTH_ENDPOINTS } from "@/lib/supabase";
import { getAuditLog, logAuditEvent, generateSecureRandom, type AuditEvent } from "@/lib/oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogOut, Copy, Shield, Key, Globe, User, Lock,
  Loader2, Check, Code2, Clock, Plus, Trash2, Camera,
  Activity, AlertTriangle, Terminal, RefreshCw, Eye, EyeOff,
  Fingerprint, ExternalLink, Info, Star,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isZuupDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "zuup.dev" || hostname.endsWith(".zuup.dev");
  } catch {
    return false;
  }
}

function isFirstParty(homepageUrl: string, redirectUris: string[]): boolean {
  return isZuupDomain(homepageUrl) || redirectUris.some(isZuupDomain);
}

function generateClientId(): string {
  return generateSecureRandom(16);
}

function generateClientSecret(): string {
  return `zuup_cs_${generateSecureRandom(28)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisteredApp {
  client_id: string;
  client_secret: string; // shown once
  name: string;
  homepage_url: string;
  icon_url?: string;
  allowed_redirect_uris: string[];
  allowed_scopes: string[];
  is_first_party: boolean;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  scopes: string[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <span style={{ fontSize: 13, color: "#6b7280", minWidth: 130, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: "#9ca3af", flex: 1, wordBreak: "break-all", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ color: "#4b5563", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", flexShrink: 0, transition: "color .15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#e8425a")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>
        {copied ? <Check size={13} style={{ color: "#10b981" }} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "green" | "blue" | "coral" }) {
  const styles = {
    default: { bg: "rgba(255,255,255,0.07)", color: "#6b7280", border: "rgba(255,255,255,0.08)" },
    green: { bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.2)" },
    blue: { bg: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "rgba(59,130,246,0.2)" },
    coral: { bg: "rgba(232,66,90,0.1)", color: "#e8425a", border: "rgba(232,66,90,0.2)" },
  };
  const s = styles[variant];
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {children}
    </span>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const typeMap: Record<string, { color: string; label: string }> = {
    login: { color: "#10b981", label: "Sign in" },
    logout: { color: "#6b7280", label: "Sign out" },
    token_issued: { color: "#60a5fa", label: "Token issued" },
    consent_granted: { color: "#e8425a", label: "Consent granted" },
    client_registered: { color: "#a78bfa", label: "App registered" },
    password_changed: { color: "#f59e0b", label: "Password changed" },
    email_changed: { color: "#f59e0b", label: "Email changed" },
    login_failed: { color: "#ef4444", label: "Failed sign in" },
  };
  const c = typeMap[event.type] || { color: "#6b7280", label: event.type };
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: c.color, margin: 0 }}>{c.label}</p>
        {event.details && (
          <p style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace", marginTop: 2 }}>
            {Object.entries(event.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </p>
        )}
        {event.client_id && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>{event.client_id}</p>}
      </div>
      <span style={{ fontSize: 11, color: "#374151", flexShrink: 0 }}>
        {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const BUILTIN_APPS: RegisteredApp[] = [
  {
    client_id: "zuupcode",
    client_secret: "hidden",
    name: "ZuupCode",
    homepage_url: "https://code.zuup.dev",
    icon_url: "https://code.zuup.dev/favicon.ico",
    allowed_redirect_uris: ["https://code.zuup.dev/callback", "http://localhost:5173/callback"],
    allowed_scopes: ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write"],
    is_first_party: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    client_id: "zuuptime",
    client_secret: "hidden",
    name: "ZuupTime",
    homepage_url: "https://time.zuup.dev",
    icon_url: "https://time.zuup.dev/favicon.ico",
    allowed_redirect_uris: ["https://time.zuup.dev/callback"],
    allowed_scopes: ["openid", "profile", "email", "zuup:read"],
    is_first_party: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    client_id: "zuupdev",
    client_secret: "hidden",
    name: "Zuup Platform",
    homepage_url: "https://www.zuup.dev",
    icon_url: "https://www.zuup.dev/favicon.ico",
    allowed_redirect_uris: ["https://www.zuup.dev/callback", "https://zuup.dev/callback"],
    allowed_scopes: ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write", "zuup:admin"],
    is_first_party: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const ALL_SCOPES = ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write", "zuup:admin"];

export default function Profile() {
  const { user, session, signOut, updateProfile, updateEmail, updatePassword } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [username, setUsername] = useState(user?.user_metadata?.username || "");
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Apps
  const [customApps, setCustomApps] = useState<RegisteredApp[]>([]);
  const [showAddApp, setShowAddApp] = useState(false);
  const [newCreatedApp, setNewCreatedApp] = useState<RegisteredApp | null>(null);
  const [newAppName, setNewAppName] = useState("");
  const [newAppHomepage, setNewAppHomepage] = useState("");
  const [newAppRedirect, setNewAppRedirect] = useState("");
  const [newAppScopes, setNewAppScopes] = useState<string[]>(["openid", "profile", "email"]);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);

  // Activity
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "apps" | "keys" | "activity" | "developers">("profile");

  useEffect(() => {
    setAuditLog(getAuditLog());
    const stored = localStorage.getItem("zuup_custom_apps");
    if (stored) setCustomApps(JSON.parse(stored));
    const keys = localStorage.getItem("zuup_api_keys");
    if (keys) setApiKeys(JSON.parse(keys));
  }, []);

  const displayName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const avatarInitial = displayName[0]?.toUpperCase() || "Z";
  const allApps = [...BUILTIN_APPS, ...customApps];

  const handleSignOut = async () => {
    logAuditEvent({ type: "logout", user_id: user?.id });
    await signOut();
    navigate("/login");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Max 2MB"); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await updateProfile({ avatar_url: data.publicUrl });
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar updated!");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploadingAvatar(false); }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName, username, avatar_url: avatarUrl });
      if (newEmail !== user?.email) {
        await updateEmail(newEmail);
        logAuditEvent({ type: "email_changed", user_id: user?.id });
        toast.success("Confirmation email sent to new address");
      } else {
        toast.success("Profile saved!");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (newPassword.length < 8) { toast.error("Min 8 characters"); return; }
    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      logAuditEvent({ type: "password_changed", user_id: user?.id });
      toast.success("Password updated!");
      setNewPassword(""); setConfirmPassword("");
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingPassword(false); }
  };

  const handleAddApp = () => {
    if (!newAppName || !newAppHomepage || !newAppRedirect) { toast.error("All fields required"); return; }
    const firstParty = isFirstParty(newAppHomepage, [newAppRedirect]);
    const app: RegisteredApp = {
      client_id: generateClientId(),
      client_secret: generateClientSecret(),
      name: newAppName,
      homepage_url: newAppHomepage,
      allowed_redirect_uris: newAppRedirect.split(",").map(s => s.trim()).filter(Boolean),
      allowed_scopes: newAppScopes,
      is_first_party: firstParty,
      created_at: new Date().toISOString(),
    };
    const updated = [...customApps, app];
    setCustomApps(updated);
    localStorage.setItem("zuup_custom_apps", JSON.stringify(updated));
    setNewCreatedApp(app);
    logAuditEvent({ type: "client_registered", user_id: user?.id, client_id: app.client_id, details: { name: app.name } });
  };

  const handleDeleteApp = (clientId: string) => {
    const updated = customApps.filter(a => a.client_id !== clientId);
    setCustomApps(updated);
    localStorage.setItem("zuup_custom_apps", JSON.stringify(updated));
    toast.success("App removed");
  };

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) { toast.error("Name required"); return; }
    setCreatingKey(true);
    setTimeout(() => {
      const fullKey = `zuup_sk_${generateSecureRandom(24)}`;
      const key: ApiKey = {
        id: generateSecureRandom(8),
        name: newKeyName,
        prefix: fullKey.substring(0, 14) + "...",
        created_at: new Date().toISOString(),
        scopes: ["zuup:read"],
      };
      const updated = [...apiKeys, key];
      setApiKeys(updated);
      localStorage.setItem("zuup_api_keys", JSON.stringify(updated));
      setCreatedKey(fullKey);
      setCreatingKey(false);
      setNewKeyName("");
    }, 600);
  };

  const pwdScore = (() => {
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: <User size={14} /> },
    { id: "security" as const, label: "Security", icon: <Lock size={14} /> },
    { id: "apps" as const, label: "Apps", icon: <Globe size={14} /> },
    { id: "keys" as const, label: "API Keys", icon: <Key size={14} /> },
    { id: "activity" as const, label: "Activity", icon: <Activity size={14} /> },
    { id: "developers" as const, label: "Developers", icon: <Code2 size={14} /> },
  ];

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "22px 24px",
    marginBottom: 16,
  };
  const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: "#e8eaf0", marginBottom: 4 };
  const sectionSub: React.CSSProperties = { fontSize: 13, color: "#4b5563", marginBottom: 20 };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8eaf0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(13,15,20,0.9)", backdropFilter: "blur(16px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 2rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <img src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png" alt="Zuup" style={{ height: 28, width: "auto" }} />
            <span style={{ fontSize: 17, fontWeight: 700, color: "#e8eaf0" }}>Zuup</span>
            <span style={{ fontSize: 17, fontWeight: 300, color: "#e8425a" }}>Auth</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#e8425a,#f06080)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {avatarInitial}
                </div>
              )}
              <span style={{ fontSize: 13, color: "#9ca3af", display: "none" }} className="sm-show">{displayName}</span>
            </div>
            <button onClick={handleSignOut}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#6b7280", fontSize: 13, cursor: "pointer", transition: "all .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e8eaf0"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 2rem" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 36, overflowX: "auto", paddingBottom: 0 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "14px 16px", fontSize: 13, fontWeight: 500,
                color: activeTab === t.id ? "#e8425a" : "#6b7280",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: `2px solid ${activeTab === t.id ? "#e8425a" : "transparent"}`,
                marginBottom: -1, whiteSpace: "nowrap", transition: "all .12s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { if (activeTab !== t.id) e.currentTarget.style.color = "#e8eaf0"; }}
              onMouseLeave={(e) => { if (activeTab !== t.id) e.currentTarget.style.color = "#6b7280"; }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 720, paddingBottom: 60 }}>

          {/* ── Profile ── */}
          {activeTab === "profile" && (
            <div>
              <div style={{ marginBottom: 28 }}>
                <p style={sectionTitle}>Profile</p>
                <p style={sectionSub}>Your identity across all Zuup services</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
                <div style={{ position: "relative" }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)" }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#e8425a,#f06080)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff" }}>
                      {avatarInitial}
                    </div>
                  )}
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                    style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: "50%", background: "#e8425a", border: "2px solid #0d0f14", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {uploadingAvatar ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite", color: "#fff" }} /> : <Camera size={12} style={{ color: "#fff" }} />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#f1f3f8", margin: 0 }}>{displayName}</p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "3px 0" }}>{user?.email}</p>
                  <p style={{ fontSize: 11, color: "#374151", margin: 0 }}>
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="bg-secondary/50 border-border/60" />
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Username</Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_handle" className="bg-secondary/50 border-border/60" />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Email Address</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="bg-secondary/50 border-border/60" />
                  {newEmail !== user?.email && <p style={{ fontSize: 12, color: "#e8425a", marginTop: 4 }}>A confirmation email will be sent</p>}
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="zuup-gradient">
                  {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save Changes
                </Button>
              </div>

              <div style={card}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#4b5563", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Account ID</p>
                <CopyRow label="User ID" value={user?.id || "—"} />
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === "security" && (
            <div>
              <p style={sectionTitle}>Security</p>
              <p style={sectionSub}>Password and session management</p>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <Lock size={15} style={{ color: "#e8425a" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", margin: 0 }}>Change Password</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>New Password</Label>
                    <div style={{ position: "relative" }}>
                      <Input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className="bg-secondary/50 border-border/60 pr-10" />
                      <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4b5563" }}>
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {newPassword && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                          {[1,2,3,4,5].map(i => (
                            <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= pwdScore ? pwdScore <= 2 ? "#ef4444" : pwdScore <= 3 ? "#f59e0b" : "#10b981" : "rgba(255,255,255,0.08)", transition: "background .2s" }} />
                          ))}
                        </div>
                        <p style={{ fontSize: 11, color: "#4b5563" }}>{["", "Weak", "Weak", "Fair", "Strong", "Very strong"][pwdScore]}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Confirm Password</Label>
                    <div style={{ position: "relative" }}>
                      <Input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter" className="bg-secondary/50 border-border/60 pr-10" />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#4b5563" }}>
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Passwords don't match</p>
                    )}
                  </div>
                  <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword || newPassword !== confirmPassword} className="zuup-gradient" style={{ width: "fit-content" }}>
                    {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Update Password
                  </Button>
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Key size={15} style={{ color: "#e8425a" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", margin: 0 }}>Active Session</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <CopyRow label="Access Token" value={session?.access_token || "—"} />
                  <CopyRow label="Refresh Token" value={session?.refresh_token || "—"} />
                </div>
                <p style={{ fontSize: 12, color: "#374151", marginTop: 10 }}>
                  Expires: {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "—"}
                </p>
              </div>
            </div>
          )}

          {/* ── Apps ── */}
          {activeTab === "apps" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                  <p style={sectionTitle}>Connected Apps</p>
                  <p style={sectionSub}>Applications that use your Zuup account</p>
                </div>
                <button onClick={() => { setShowAddApp(true); setNewCreatedApp(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#e8425a,#f06080)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> Add App
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {allApps.map((app) => (
                  <div key={app.client_id} style={{ ...card, display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(232,66,90,0.08)", border: "1px solid rgba(232,66,90,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                      {app.icon_url ? (
                        <img src={app.icon_url} alt={app.name} style={{ width: 28, height: 28, objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <Globe size={18} style={{ color: "#e8425a" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", margin: 0 }}>{app.name}</p>
                        {app.is_first_party && <Badge variant="green">First-party</Badge>}
                        {!app.is_first_party && <Badge variant="blue">Third-party</Badge>}
                      </div>
                      <p style={{ fontSize: 12, fontFamily: "monospace", color: "#4b5563", margin: "0 0 8px" }}>{app.client_id}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {app.allowed_scopes.map(s => (
                          <span key={s} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: "#4b5563", fontFamily: "monospace" }}>{s}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {app.homepage_url && (
                        <a href={app.homepage_url} target="_blank" rel="noopener noreferrer" style={{ color: "#4b5563", transition: "color .15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#e8425a")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {!app.is_first_party && !BUILTIN_APPS.find(b => b.client_id === app.client_id) && (
                        <button onClick={() => handleDeleteApp(app.client_id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 2, transition: "color .15s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add App Dialog */}
              <Dialog open={showAddApp} onOpenChange={(o) => { setShowAddApp(o); if (!o) { setNewCreatedApp(null); setNewAppName(""); setNewAppHomepage(""); setNewAppRedirect(""); setNewAppScopes(["openid", "profile", "email"]); } }}>
                <DialogContent style={{ background: "#161a22", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0" }}>
                  <DialogHeader>
                    <DialogTitle style={{ color: "#f1f3f8" }}>Register New Application</DialogTitle>
                    <DialogDescription style={{ color: "#6b7280" }}>
                      Add an app to use Zuup OAuth authentication. Apps on zuup.dev domains are automatically first-party.
                    </DialogDescription>
                  </DialogHeader>

                  {newCreatedApp ? (
                    <div style={{ paddingBottom: 8 }}>
                      <div style={{ padding: 16, borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                          <Check size={14} style={{ color: "#10b981" }} />
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", margin: 0 }}>{newCreatedApp.name} registered!</p>
                        </div>
                        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Save these credentials now — the client secret will not be shown again.</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <CopyRow label="Client ID" value={newCreatedApp.client_id} />
                          <CopyRow label="Client Secret" value={newCreatedApp.client_secret} />
                        </div>
                        {newCreatedApp.is_first_party && (
                          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#10b981" }}>
                            <Star size={12} /> Automatically detected as first-party (zuup.dev domain)
                          </div>
                        )}
                      </div>
                      <Button onClick={() => { setShowAddApp(false); setNewCreatedApp(null); }} className="zuup-gradient w-full">Done</Button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
                        <div>
                          <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>App Name</Label>
                          <Input value={newAppName} onChange={(e) => setNewAppName(e.target.value)} placeholder="My Awesome App" className="bg-secondary/50 border-border/60" />
                        </div>
                        <div>
                          <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Homepage URL</Label>
                          <Input value={newAppHomepage} onChange={(e) => setNewAppHomepage(e.target.value)} placeholder="https://myapp.zuup.dev" className="bg-secondary/50 border-border/60" />
                          {newAppHomepage && isZuupDomain(newAppHomepage) && (
                            <p style={{ fontSize: 11, color: "#10b981", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <Star size={10} /> Will be marked as first-party (zuup.dev domain detected)
                            </p>
                          )}
                        </div>
                        <div>
                          <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Redirect URI(s)</Label>
                          <Input value={newAppRedirect} onChange={(e) => setNewAppRedirect(e.target.value)} placeholder="https://myapp.com/callback, http://localhost:3000/callback" className="bg-secondary/50 border-border/60" />
                          <p style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>Separate multiple URIs with commas</p>
                        </div>
                        <div>
                          <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, display: "block" }}>Requested Scopes</Label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {ALL_SCOPES.map(scope => (
                              <button key={scope} onClick={() => setNewAppScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope])}
                                style={{
                                  padding: "5px 10px", borderRadius: 6, fontSize: 12, fontFamily: "monospace", cursor: "pointer", transition: "all .12s",
                                  background: newAppScopes.includes(scope) ? "rgba(232,66,90,0.15)" : "rgba(255,255,255,0.05)",
                                  border: `1px solid ${newAppScopes.includes(scope) ? "rgba(232,66,90,0.3)" : "rgba(255,255,255,0.08)"}`,
                                  color: newAppScopes.includes(scope) ? "#e8425a" : "#4b5563",
                                }}>
                                {scope}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddApp(false)} style={{ color: "#6b7280" }}>Cancel</Button>
                        <Button onClick={handleAddApp} className="zuup-gradient">
                          <Plus size={14} /> Register App
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── API Keys ── */}
          {activeTab === "keys" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                  <p style={sectionTitle}>API Keys</p>
                  <p style={sectionSub}>For server-to-server access</p>
                </div>
                <button onClick={() => setShowCreateKey(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#e8425a,#f06080)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={14} /> New Key
                </button>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", gap: 10, marginBottom: 20 }}>
                <AlertTriangle size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>API keys grant full account access. Store them in environment variables only — never put them in client-side code or commit them to git.</p>
              </div>
              {apiKeys.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#4b5563" }}>
                  <Key size={28} style={{ margin: "0 auto 10px", display: "block" }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No API keys yet. Create one to get started.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {apiKeys.map(k => (
                    <div key={k.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, marginBottom: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Key size={14} style={{ color: "#4b5563" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "#e8eaf0", margin: "0 0 2px" }}>{k.name}</p>
                        <p style={{ fontSize: 12, fontFamily: "monospace", color: "#4b5563", margin: 0 }}>{k.prefix}</p>
                      </div>
                      <p style={{ fontSize: 11, color: "#374151" }}>{new Date(k.created_at).toLocaleDateString()}</p>
                      <button onClick={() => { const u = apiKeys.filter(x => x.id !== k.id); setApiKeys(u); localStorage.setItem("zuup_api_keys", JSON.stringify(u)); toast.success("Deleted"); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 2 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#4b5563")}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Dialog open={showCreateKey} onOpenChange={(o) => { setShowCreateKey(o); if (!o) setCreatedKey(null); }}>
                <DialogContent style={{ background: "#161a22", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0" }}>
                  <DialogHeader>
                    <DialogTitle style={{ color: "#f1f3f8" }}>Create API Key</DialogTitle>
                    <DialogDescription style={{ color: "#6b7280" }}>Name your key so you can identify it later.</DialogDescription>
                  </DialogHeader>
                  {createdKey ? (
                    <div>
                      <div style={{ padding: 14, borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 16 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", marginBottom: 8 }}>Key created — copy it now!</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <code style={{ fontSize: 12, fontFamily: "monospace", color: "#e8eaf0", flex: 1, wordBreak: "break-all" }}>{createdKey}</code>
                          <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied!"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                      <Button onClick={() => { setShowCreateKey(false); setCreatedKey(null); }} className="zuup-gradient w-full">Done</Button>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: "8px 0" }}>
                        <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Key Name</Label>
                        <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. Production Server" className="bg-secondary/50 border-border/60" />
                      </div>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreateKey(false)} style={{ color: "#6b7280" }}>Cancel</Button>
                        <Button onClick={handleCreateApiKey} disabled={creatingKey} className="zuup-gradient">
                          {creatingKey ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Key
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── Activity ── */}
          {activeTab === "activity" && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
                <div>
                  <p style={sectionTitle}>Activity Log</p>
                  <p style={sectionSub}>Recent security events on your account</p>
                </div>
                <button onClick={() => setAuditLog(getAuditLog())}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 12px", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <div style={card}>
                {auditLog.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#4b5563" }}>
                    <Activity size={26} style={{ margin: "0 auto 8px", display: "block" }} />
                    <p style={{ fontSize: 13, margin: 0 }}>No activity yet. Events appear here as you use Zuup Auth.</p>
                  </div>
                ) : auditLog.map(e => <AuditRow key={e.id} event={e} />)}
              </div>
            </div>
          )}

          {/* ── Developers ── */}
          {activeTab === "developers" && (
            <div>
              <p style={sectionTitle}>Developer Integration</p>
              <p style={sectionSub}>Build with Zuup Auth using OAuth 2.1 + PKCE</p>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Fingerprint size={15} style={{ color: "#e8425a" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", margin: 0 }}>Your OAuth Credentials</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <CopyRow label="Client ID" value="0d810775-7d53-4c4d-b44e-2a39f7fb1741" />
                </div>
                <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", display: "flex", gap: 8 }}>
                  <AlertTriangle size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Your client secret was shown once at creation. Store it in a secure environment variable.</p>
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Shield size={15} style={{ color: "#e8425a" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", margin: 0 }}>OAuth Endpoints</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <CopyRow label="Authorization" value={OAUTH_ENDPOINTS.authorization} />
                  <CopyRow label="Token" value={OAUTH_ENDPOINTS.token} />
                  <CopyRow label="Userinfo" value={OAUTH_ENDPOINTS.userinfo} />
                  <CopyRow label="JWKS" value={OAUTH_ENDPOINTS.jwks} />
                  <CopyRow label="OIDC Discovery" value={OAUTH_ENDPOINTS.oidcDiscovery} />
                </div>
              </div>

              <div style={{ textAlign: "center", padding: "20px", background: "rgba(232,66,90,0.04)", borderRadius: 14, border: "1px solid rgba(232,66,90,0.1)" }}>
                <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 14px" }}>Full integration guide with PKCE code examples →</p>
                <Link to="/docs"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 8, background: "linear-gradient(135deg,#e8425a,#f06080)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  <Code2 size={14} /> Open Developer Docs
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
