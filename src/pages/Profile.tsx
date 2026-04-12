import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAUTH_ENDPOINTS, REGISTERED_APPS } from "@/lib/supabase";
import {
  LogOut, Copy, Shield, Key, Globe, User, Mail, Lock,
  Loader2, Check, Upload, Code2, Clock, Plus, Trash2, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function CopyRow({ label, url }: { label: string; url: string }) {
  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} copied!`);
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/40">
      <span className="text-sm font-medium text-foreground min-w-[140px]">{label}</span>
      <code className="text-xs text-muted-foreground break-all flex-1">{url}</code>
      <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
        <Copy size={14} />
      </button>
    </div>
  );
}

const APP_ICONS: Record<string, React.ReactNode> = {
  zuupcode: <Code2 size={16} />,
  zuuptime: <Clock size={16} />,
  zuupdev: <Globe size={16} />,
};

interface CustomApp {
  client_id: string;
  name: string;
  icon: string;
  allowed_redirect_uris: string[];
}

export default function Profile() {
  const { user, session, signOut, updateProfile, updateEmail, updatePassword } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile editing
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "");
  const [username, setUsername] = useState(user?.user_metadata?.username || "");
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Custom apps management
  const [customApps, setCustomApps] = useState<CustomApp[]>([]);
  const [showAddApp, setShowAddApp] = useState(false);
  const [newAppId, setNewAppId] = useState("");
  const [newAppName, setNewAppName] = useState("");
  const [newAppRedirectUri, setNewAppRedirectUri] = useState("");

  const [activeTab, setActiveTab] = useState<"profile" | "security" | "apps" | "developers">("profile");

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      
      await updateProfile({ avatar_url: data.publicUrl });
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
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
        toast.success("Check your new email to confirm the change");
      } else {
        toast.success("Profile updated!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      toast.success("Password updated!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAddCustomApp = () => {
    if (!newAppId || !newAppName || !newAppRedirectUri) {
      toast.error("All fields are required");
      return;
    }

    const newApp: CustomApp = {
      client_id: newAppId,
      name: newAppName,
      icon: "",
      allowed_redirect_uris: [newAppRedirectUri],
    };

    setCustomApps([...customApps, newApp]);
    toast.success(`${newAppName} added successfully!`);
    setShowAddApp(false);
    setNewAppId("");
    setNewAppName("");
    setNewAppRedirectUri("");
  };

  const handleDeleteCustomApp = (clientId: string) => {
    setCustomApps(customApps.filter(app => app.client_id !== clientId));
    toast.success("App removed");
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: <User size={16} /> },
    { id: "security" as const, label: "Security", icon: <Lock size={16} /> },
    { id: "apps" as const, label: "Connected Apps", icon: <Globe size={16} /> },
    { id: "developers" as const, label: "Developers", icon: <Key size={16} /> },
  ];

  const displayName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Zuup User";
  const avatarInitial = displayName[0]?.toUpperCase() || "Z";

  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png"
              alt="Zuup"
              className="h-8 w-auto"
            />
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-foreground">Zuup</span>
              <span className="text-lg font-light text-primary">Auth</span>
            </div>
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
              {displayName}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-2 border-b border-border/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Profile Settings</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your Zuup identity across all services</p>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-20 h-20 rounded-full object-cover zuup-glow" />
                ) : (
                  <div className="w-20 h-20 rounded-full zuup-gradient flex items-center justify-center text-2xl font-bold text-primary-foreground zuup-glow">
                    {avatarInitial}
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <p className="font-medium text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_username"
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-secondary/50 border-border/60"
                />
                {newEmail !== user?.email && (
                  <p className="text-xs text-primary">A confirmation email will be sent to your new address</p>
                )}
              </div>

              <Button onClick={handleSaveProfile} disabled={savingProfile} className="zuup-gradient">
                {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Security</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your password and security settings</p>
            </div>

            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Lock size={16} className="text-primary" /> Change Password
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="bg-secondary/50 border-border/60"
                  />
                </div>
              </div>

              <Button onClick={handleChangePassword} disabled={savingPassword} className="zuup-gradient">
                {savingPassword ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
                Update Password
              </Button>
            </div>

            {/* Session info */}
            <div className="glass-card rounded-xl p-6 space-y-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Key size={16} className="text-primary" /> Current Session
              </h3>
              {session?.access_token && (
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Access Token</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(session.access_token);
                        toast.success("Token copied!");
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <code className="text-xs text-muted-foreground break-all line-clamp-2">
                    {session.access_token}
                  </code>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Expires: {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : "—"}
              </p>
            </div>
          </div>
        )}

        {/* Connected Apps Tab */}
        {activeTab === "apps" && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Connected Apps</h2>
                <p className="text-sm text-muted-foreground mt-1">Apps that use your Zuup account for sign-in</p>
              </div>
              <Button onClick={() => setShowAddApp(true)} size="sm" className="zuup-gradient">
                <Plus size={16} /> Add App
              </Button>
            </div>

            <div className="space-y-3">
              {/* Default Zuup apps */}
              {Object.values(REGISTERED_APPS).map((app) => (
                <div key={app.client_id} className="glass-card rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-primary">
                    {APP_ICONS[app.client_id] || <Globe size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{app.name}</p>
                    <p className="text-xs text-muted-foreground">client_id: {app.client_id}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    Active
                  </div>
                </div>
              ))}

              {/* Custom apps */}
              {customApps.map((app) => (
                <div key={app.client_id} className="glass-card rounded-xl p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center text-primary">
                    <Globe size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{app.name}</p>
                    <p className="text-xs text-muted-foreground">client_id: {app.client_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Redirects: {app.allowed_redirect_uris.join(", ")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCustomApp(app.client_id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add App Dialog */}
            <Dialog open={showAddApp} onOpenChange={setShowAddApp}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New App</DialogTitle>
                  <DialogDescription>
                    Add a new application to use Zuup authentication
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input
                      value={newAppId}
                      onChange={(e) => setNewAppId(e.target.value)}
                      placeholder="myapp"
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>App Name</Label>
                    <Input
                      value={newAppName}
                      onChange={(e) => setNewAppName(e.target.value)}
                      placeholder="My Application"
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Redirect URI</Label>
                    <Input
                      value={newAppRedirectUri}
                      onChange={(e) => setNewAppRedirectUri(e.target.value)}
                      placeholder="https://myapp.com/callback"
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowAddApp(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCustomApp} className="zuup-gradient">
                    <Plus size={16} /> Add App
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Developers Tab */}
        {activeTab === "developers" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Developer Integration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Integrate "Login with Zuup" into your application
              </p>
            </div>

            {/* OAuth Endpoints */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Shield size={16} className="text-primary" /> OAuth 2.1 Endpoints
              </h3>
              <div className="space-y-2">
                <CopyRow label="Authorization" url={OAUTH_ENDPOINTS.authorization} />
                <CopyRow label="Token" url={OAUTH_ENDPOINTS.token} />
                <CopyRow label="JWKS" url={OAUTH_ENDPOINTS.jwks} />
                <CopyRow label="OIDC Discovery" url={OAUTH_ENDPOINTS.oidcDiscovery} />
              </div>
            </div>

            {/* SSO Integration Guide */}
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Code2 size={16} className="text-primary" /> "Login with Zuup" Integration
              </h3>
              <p className="text-sm text-muted-foreground">
                Add this to your app to enable Zuup SSO login:
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
                  <p className="text-sm font-medium text-foreground">1. Redirect to Zuup Auth</p>
                  <pre className="text-xs bg-background/50 p-3 rounded-md overflow-x-auto text-muted-foreground">
{`// In your app
const ZUUP_AUTH = "https://auth.zuup.dev";
const CLIENT_ID = "your_client_id";
const REDIRECT_URI = "https://yourapp.com/callback";

function loginWithZuup() {
  const state = crypto.randomUUID();
  sessionStorage.setItem("zuup_auth_state", state);
  
  window.location.href = \`\${ZUUP_AUTH}/authorize?\` +
    \`client_id=\${CLIENT_ID}&\` +
    \`redirect_uri=\${encodeURIComponent(REDIRECT_URI)}&\` +
    \`state=\${state}\`;
}`}
                  </pre>
                </div>

                <div className="p-4 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
                  <p className="text-sm font-medium text-foreground">2. Handle the Callback</p>
                  <pre className="text-xs bg-background/50 p-3 rounded-md overflow-x-auto text-muted-foreground">
{`const params = new URLSearchParams(window.location.search);
const accessToken = params.get("access_token");
const state = params.get("state");

// Verify state
if (state !== sessionStorage.getItem("zuup_auth_state")) {
  throw new Error("Invalid state");
}

// Use with Supabase
await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: params.get("refresh_token"),
});`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
