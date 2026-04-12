import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { OAUTH_ENDPOINTS } from "@/lib/supabase";
import { REGISTERED_CLIENTS, getAuditLog, logAuditEvent, generateSecureRandom, type AuditEvent } from "@/lib/oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogOut, Copy, Shield, Key, Globe, User, Mail, Lock,
  Loader2, Check, Upload, Code2, Clock, Plus, Trash2, Camera,
  Activity, AlertTriangle, Terminal, RefreshCw, Eye, EyeOff,
  Fingerprint, ExternalLink, ChevronRight, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ─── Sub-components ────────────────────────────────────────────────────────────

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/40">
      <span className="text-sm font-medium text-foreground min-w-[140px] shrink-0">{label}</span>
      <span className={`text-xs text-muted-foreground break-all flex-1 ${mono ? "font-mono" : ""}`}>{value}</span>
      <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  const typeConfig: Record<string, { color: string; label: string }> = {
    login: { color: "text-green-400", label: "Sign in" },
    logout: { color: "text-muted-foreground", label: "Sign out" },
    token_issued: { color: "text-blue-400", label: "Token issued" },
    consent_granted: { color: "text-primary", label: "Consent granted" },
    client_registered: { color: "text-purple-400", label: "App registered" },
    password_changed: { color: "text-amber-400", label: "Password changed" },
    email_changed: { color: "text-amber-400", label: "Email changed" },
    login_failed: { color: "text-destructive", label: "Failed sign in" },
  };
  const config = typeConfig[event.type] || { color: "text-muted-foreground", label: event.type };
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/20 last:border-0">
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.color.replace("text-", "bg-")}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
        {event.details && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {Object.entries(event.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </p>
        )}
        {event.client_id && (
          <p className="text-xs text-muted-foreground">{event.client_id}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground shrink-0">
        {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used?: string;
  scopes: string[];
}

// ─── Main Profile Page ─────────────────────────────────────────────────────────

export default function Profile() {
  const { user, session, signOut, updateProfile, updateEmail, updatePassword } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [username, setUsername] = useState(user?.user_metadata?.username || "");
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  // Audit log
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "apps" | "keys" | "activity" | "developers">("profile");

  useEffect(() => {
    setAuditLog(getAuditLog());
    const stored = localStorage.getItem("zuup_api_keys");
    if (stored) setApiKeys(JSON.parse(stored));
  }, []);

  const displayName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Zuup User";
  const avatarInitial = displayName[0]?.toUpperCase() || "Z";

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
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await updateProfile({ avatar_url: data.publicUrl });
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ full_name: fullName, username, avatar_url: avatarUrl });
      if (newEmail !== user?.email) {
        await updateEmail(newEmail);
        logAuditEvent({ type: "email_changed", user_id: user?.id });
        toast.success("Check your new email to confirm the change");
      } else {
        toast.success("Profile saved!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (newPassword.length < 8) { toast.error("Min 8 characters"); return; }
    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      logAuditEvent({ type: "password_changed", user_id: user?.id });
      toast.success("Password updated!");
      setNewPassword(""); setConfirmPassword(""); setCurrentPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) { toast.error("Name required"); return; }
    setCreatingKey(true);
    setTimeout(() => {
      const fullKey = `zuup_sk_${generateSecureRandom(24)}`;
      const newKey: ApiKey = {
        id: generateSecureRandom(8),
        name: newKeyName,
        prefix: fullKey.substring(0, 12) + "...",
        created_at: new Date().toISOString(),
        scopes: ["zuup:read"],
      };
      const updated = [...apiKeys, newKey];
      setApiKeys(updated);
      localStorage.setItem("zuup_api_keys", JSON.stringify(updated));
      setCreatedKey(fullKey);
      setCreatingKey(false);
      setNewKeyName("");
    }, 600);
  };

  const handleDeleteApiKey = (id: string) => {
    const updated = apiKeys.filter((k) => k.id !== id);
    setApiKeys(updated);
    localStorage.setItem("zuup_api_keys", JSON.stringify(updated));
    toast.success("API key deleted");
  };

  const passwordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const pwdScore = passwordStrength(newPassword);

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: <User size={15} /> },
    { id: "security" as const, label: "Security", icon: <Lock size={15} /> },
    { id: "apps" as const, label: "Apps", icon: <Globe size={15} /> },
    { id: "keys" as const, label: "API Keys", icon: <Key size={15} /> },
    { id: "activity" as const, label: "Activity", icon: <Activity size={15} /> },
    { id: "developers" as const, label: "Developers", icon: <Code2 size={15} /> },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png" alt="Zuup" className="h-8 w-auto" />
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-foreground">Zuup</span>
              <span className="text-lg font-light text-primary">Auth</span>
            </div>
            <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
              OAuth 2.1
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full zuup-gradient flex items-center justify-center text-xs font-semibold text-primary-foreground">
                  {avatarInitial}
                </div>
              )}
              <span className="text-sm text-foreground font-medium">{displayName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground gap-2">
              <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Tab bar */}
        <div className="flex gap-0.5 mb-8 overflow-x-auto border-b border-border/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Profile ── */}
        {activeTab === "profile" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Profile</h2>
              <p className="text-sm text-muted-foreground mt-1">Your identity across all Zuup services</p>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover ring-2 ring-border" />
                ) : (
                  <div className="w-20 h-20 rounded-full zuup-gradient flex items-center justify-center text-2xl font-bold text-primary-foreground">
                    {avatarInitial}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {uploadingAvatar ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <p className="text-xs text-muted-foreground">
                    Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="bg-secondary/50 border-border/60" />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" className="bg-secondary/50 border-border/60 pl-7" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="bg-secondary/50 border-border/60" />
                {newEmail !== user?.email && (
                  <p className="text-xs text-primary flex items-center gap-1"><Info size={12} /> A confirmation email will be sent</p>
                )}
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="zuup-gradient">
                {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Save Changes
              </Button>
            </div>

            {/* Account ID */}
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Account ID</p>
              <CopyRow label="User ID" value={user?.id || "—"} />
            </div>
          </div>
        )}

        {/* ── Security ── */}
        {activeTab === "security" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Security</h2>
              <p className="text-sm text-muted-foreground mt-1">Password and session management</p>
            </div>

            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2"><Lock size={15} className="text-primary" /> Change Password</h3>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input type={showNew ? "text" : "password"} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters"
                      className="bg-secondary/50 border-border/60 pr-10" />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= pwdScore ? pwdScore <= 2 ? "bg-red-500" : pwdScore <= 3 ? "bg-amber-500" : "bg-green-500" : "bg-secondary"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pwdScore <= 2 ? "Weak" : pwdScore <= 3 ? "Fair" : pwdScore <= 4 ? "Strong" : "Very strong"}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <div className="relative">
                    <Input type={showConfirm ? "text" : "password"} value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                      className="bg-secondary/50 border-border/60 pr-10" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={11} /> Passwords don't match</p>
                  )}
                </div>
              </div>

              <Button onClick={handleChangePassword} disabled={savingPassword || !newPassword || newPassword !== confirmPassword} className="zuup-gradient">
                {savingPassword ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
                Update Password
              </Button>
            </div>

            {/* Current session */}
            <div className="glass-card rounded-xl p-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2"><Key size={15} className="text-primary" /> Active Session</h3>
              <div className="space-y-2">
                <CopyRow label="Access Token" value={session?.access_token || "—"} />
                <CopyRow label="Refresh Token" value={session?.refresh_token || "—"} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Expires: {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "—"}</span>
                <div className="flex items-center gap-1 text-green-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Active</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Connected Apps ── */}
        {activeTab === "apps" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Connected Apps</h2>
              <p className="text-sm text-muted-foreground mt-1">Applications authorized to use your Zuup account</p>
            </div>
            <div className="space-y-3">
              {Object.values(REGISTERED_CLIENTS).map((client) => (
                <div key={client.client_id} className="glass-card rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center overflow-hidden shrink-0">
                    {client.icon_url ? (
                      <img src={client.icon_url} alt={client.name} className="w-8 h-8 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }} />
                    ) : (
                      <Globe size={18} className="text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{client.name}</p>
                      {client.is_first_party && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">First-party</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{client.client_id}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {client.allowed_scopes.map((s) => (
                        <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                  {client.homepage_url && (
                    <a href={client.homepage_url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── API Keys ── */}
        {activeTab === "keys" && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">API Keys</h2>
                <p className="text-sm text-muted-foreground mt-1">Secret keys for server-to-server access</p>
              </div>
              <Button onClick={() => setShowCreateKey(true)} size="sm" className="zuup-gradient">
                <Plus size={15} /> New Key
              </Button>
            </div>

            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">API keys grant full account access. Keep them secret and never expose in client-side code.</p>
            </div>

            {apiKeys.length === 0 ? (
              <div className="glass-card rounded-xl p-10 text-center space-y-3">
                <Key size={32} className="text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div key={key.id} className="glass-card rounded-xl p-5 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                      <Key size={15} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{key.name}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{key.prefix}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteApiKey(key.id)}
                      className="text-destructive hover:text-destructive shrink-0">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Create key dialog */}
            <Dialog open={showCreateKey} onOpenChange={(o) => { setShowCreateKey(o); if (!o) setCreatedKey(null); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>Give your key a descriptive name so you can identify it later.</DialogDescription>
                </DialogHeader>
                {createdKey ? (
                  <div className="space-y-4 py-4">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1"><Check size={14} /> Key created successfully!</p>
                      <p className="text-xs text-muted-foreground mb-3">Copy this key now — you won't be able to see it again.</p>
                      <div className="flex items-center gap-2 bg-background/50 rounded p-2.5 border border-border/40">
                        <code className="text-xs font-mono text-foreground break-all flex-1">{createdKey}</code>
                        <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied!"); }}
                          className="text-muted-foreground hover:text-primary shrink-0">
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Key Name</Label>
                      <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g. Production Server, CI/CD Pipeline"
                        className="bg-secondary/50" />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  {createdKey ? (
                    <Button onClick={() => { setShowCreateKey(false); setCreatedKey(null); }} className="zuup-gradient">Done</Button>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={() => setShowCreateKey(false)}>Cancel</Button>
                      <Button onClick={handleCreateApiKey} disabled={creatingKey} className="zuup-gradient">
                        {creatingKey ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create Key
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ── Activity ── */}
        {activeTab === "activity" && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Activity Log</h2>
                <p className="text-sm text-muted-foreground mt-1">Recent security events on your account</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAuditLog(getAuditLog())} className="text-muted-foreground">
                <RefreshCw size={14} /> Refresh
              </Button>
            </div>

            <div className="glass-card rounded-xl p-5">
              {auditLog.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Activity size={28} className="text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">No activity yet. Events will appear here as you use Zuup Auth.</p>
                </div>
              ) : (
                <div>
                  {auditLog.map((event) => (
                    <AuditEventRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Developers ── */}
        {activeTab === "developers" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Developer Integration</h2>
              <p className="text-sm text-muted-foreground mt-1">Integrate Zuup Auth into your application using OAuth 2.1 + PKCE</p>
            </div>

            {/* Your credentials */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2"><Fingerprint size={15} className="text-primary" /> Your OAuth App Credentials</h3>
              <CopyRow label="Client ID" value="0d810775-7d53-4c4d-b44e-2a39f7fb1741" />
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                <p className="text-xs text-muted-foreground">Your client secret was shown once at creation. Store it in an environment variable, never in code.</p>
              </div>
            </div>

            {/* OAuth Endpoints */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2"><Shield size={15} className="text-primary" /> OAuth 2.1 Endpoints</h3>
              <div className="space-y-2">
                <CopyRow label="Authorization" value={OAUTH_ENDPOINTS.authorization} />
                <CopyRow label="Token" value={OAUTH_ENDPOINTS.token} />
                <CopyRow label="Userinfo" value={OAUTH_ENDPOINTS.userinfo} />
                <CopyRow label="JWKS" value={OAUTH_ENDPOINTS.jwks} />
                <CopyRow label="OIDC Discovery" value={OAUTH_ENDPOINTS.oidcDiscovery} />
                <CopyRow label="Revocation" value={OAUTH_ENDPOINTS.revocation} />
              </div>
            </div>

            {/* Integration guide */}
            <div className="glass-card rounded-xl p-6 space-y-5">
              <h3 className="font-medium text-foreground flex items-center gap-2"><Terminal size={15} className="text-primary" /> Authorization Code + PKCE Flow</h3>

              <div className="space-y-4">
                {[
                  {
                    step: "1",
                    title: "Generate PKCE Code Verifier & Challenge",
                    code: `// Generate a cryptographically random code verifier
const array = new Uint8Array(32);
crypto.getRandomValues(array);
const verifier = btoa(String.fromCharCode(...array))
  .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');

// SHA-256 hash → base64url = code challenge
const encoded = new TextEncoder().encode(verifier);
const hash = await crypto.subtle.digest('SHA-256', encoded);
const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
  .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');

sessionStorage.setItem('pkce_verifier', verifier);`,
                  },
                  {
                    step: "2",
                    title: "Redirect to Zuup Authorization",
                    code: `const params = new URLSearchParams({
  client_id: '0d810775-7d53-4c4d-b44e-2a39f7fb1741',
  redirect_uri: 'https://yourapp.com/callback',
  response_type: 'code',
  scope: 'openid profile email',
  state: crypto.randomUUID(), // store in sessionStorage for CSRF protection
  code_challenge: challenge,
  code_challenge_method: 'S256',
});

window.location.href = \`${window.location.origin}/authorize?\${params}\`;`,
                  },
                  {
                    step: "3",
                    title: "Handle the Callback & Exchange Code",
                    code: `// /callback route in your app
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const state = params.get('state');

// Verify state (CSRF protection)
if (state !== sessionStorage.getItem('oauth_state')) throw new Error('Invalid state');

// Exchange code for tokens (server-side for real apps!)
const response = await fetch('${OAUTH_ENDPOINTS.token}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: '0d810775-7d53-4c4d-b44e-2a39f7fb1741',
    client_secret: process.env.ZUUP_CLIENT_SECRET, // server-side only!
    code,
    redirect_uri: 'https://yourapp.com/callback',
    code_verifier: sessionStorage.getItem('pkce_verifier'),
  }),
});
const { access_token, refresh_token } = await response.json();`,
                  },
                  {
                    step: "4",
                    title: "Use with Supabase Client",
                    code: `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Set the session
await supabase.auth.setSession({ access_token, refresh_token });

// Get user
const { data: { user } } = await supabase.auth.getUser();`,
                  },
                ].map(({ step, title, code }) => (
                  <div key={step} className="rounded-lg border border-border/40 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary/40 border-b border-border/30">
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-semibold shrink-0">{step}</div>
                      <p className="text-sm font-medium text-foreground">{title}</p>
                    </div>
                    <div className="relative">
                      <pre className="text-xs text-muted-foreground p-4 overflow-x-auto bg-background/30 font-mono leading-relaxed">{code}</pre>
                      <button
                        onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied!"); }}
                        className="absolute top-2 right-2 p-1.5 rounded bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
