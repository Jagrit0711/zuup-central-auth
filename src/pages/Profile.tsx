import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase, OAUTH_ENDPOINTS } from "@/lib/supabase";
import { getAuditLog, getRegisteredClients, logAuditEvent, generateSecureRandom, type AuditEvent } from "@/lib/oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity,
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Code2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Key,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Plus,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TabId = "home" | "info" | "security" | "connected" | "activity" | "developers";

interface RegisteredApp {
  client_id: string;
  client_secret: string;
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

interface ConnectedAuthorization {
  id: string;
  name: string;
  authorized_at: string;
  expires_at: string;
  permissions: string[];
}

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
    client_id: "zuupwatch",
    client_secret: "hidden",
    name: "ZuupWatch",
    homepage_url: "https://watch.zuup.dev",
    icon_url: "https://www.zuup.dev/favicon.ico",
    allowed_redirect_uris: ["https://watch.zuup.dev/callback", "https://watch.zuup.dev/auth/zuup/callback"],
    allowed_scopes: ["openid", "profile", "email", "zuup:read"],
    is_first_party: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const ALL_SCOPES = ["openid", "profile", "email", "offline_access", "zuup:read", "zuup:write", "zuup:admin"];

const COUNTRY_LIST = [
  "United States",
  "India",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Singapore",
  "United Arab Emirates",
  "Japan",
  "Netherlands",
  "Brazil",
  "South Africa",
  "Mexico",
  "Other",
];

const MOBILE_COUNTRY_CODES = [
  "+1 (US/CA)",
  "+44 (UK)",
  "+61 (AU)",
  "+49 (DE)",
  "+33 (FR)",
  "+91 (IN)",
  "+81 (JP)",
  "+65 (SG)",
  "+971 (UAE)",
  "+52 (MX)",
  "+55 (BR)",
  "+27 (ZA)",
];

const APP_SHOWCASE = [
  { name: "Zuup", url: "https://zuup.dev" },
  { name: "Zuup Buy", url: "https://order.zuup.dev" },
  { name: "Zuup Time", url: "https://time.zuup.dev" },
  { name: "Zuup Code", url: "https://code.zuup.dev" },
  { name: "Zuup Watch", url: "https://watch.zuup.dev" },
  { name: "Zuup Giza", url: "https://giza.zuup.dev" },
  { name: "Zuup Schools", url: "https://zuup.dev/schools" },
];

function appPreviewUrl(url: string, seed: number): string {
  return `/api/account/preview-image?url=${encodeURIComponent(url)}&v=${seed}`;
}

const REVOKED_CONNECTED_APPS_KEY = "zuup_revoked_connected_apps";

function scopeToPermission(scope: string): string {
  const map: Record<string, string> = {
    openid: "See your verification status",
    profile: "See your name",
    email: "See your email address",
    offline_access: "Stay signed in when you're away",
    "zuup:read": "See basic information about you",
    "zuup:write": "Edit data in your account",
    "zuup:admin": "Admin-level account access",
  };
  return map[scope] || `Access: ${scope}`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <span style={{ width: 120, color: "#6b7280", fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#9ca3af", fontSize: 12, fontFamily: "monospace", flex: 1, wordBreak: "break-all" }}>{value}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        style={{ border: "none", background: "none", color: "#6b7280", cursor: "pointer", padding: 0 }}
      >
        {copied ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function isZuupDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "zuup.dev" || hostname.endsWith(".zuup.dev");
  } catch {
    return false;
  }
}

function generateClientId(): string {
  return generateSecureRandom(16);
}

function generateClientSecret(): string {
  return `zuup_cs_${generateSecureRandom(28)}`;
}

function parseDevice(userAgent: string): { device: string; browser: string } {
  if (!userAgent) return { device: "Unknown device", browser: "Unknown browser" };
  const browser = userAgent.includes("Chrome") ? "Chrome" : userAgent.includes("Firefox") ? "Firefox" : "Browser";
  const device = userAgent.includes("Linux") ? "Generic Linux" : userAgent.includes("Windows") ? "Windows" : "Device";
  return { browser, device };
}

function fileToCompressedDataUrl(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Invalid image file"));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, session, signOut, updateProfile, updateEmail, updatePassword } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [devMode, setDevMode] = useState<boolean>(() => localStorage.getItem("zuup_dev_mode") === "true");

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || "");
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || "");
  const [country, setCountry] = useState(user?.user_metadata?.country || "");
  const [mobileCountryCode, setMobileCountryCode] = useState(user?.user_metadata?.phone_country_code || "+1 (US/CA)");
  const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phone || "");
  const [addressLine1, setAddressLine1] = useState(user?.user_metadata?.address_line1 || "");
  const [addressLine2, setAddressLine2] = useState(user?.user_metadata?.address_line2 || "");
  const [city, setCity] = useState(user?.user_metadata?.city || "");
  const [stateRegion, setStateRegion] = useState(user?.user_metadata?.state_region || "");
  const [postalCode, setPostalCode] = useState(user?.user_metadata?.postal_code || "");
  const [username, setUsername] = useState(user?.user_metadata?.username || "");
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sessionIp, setSessionIp] = useState("Loading...");
  const [sessionUserAgent, setSessionUserAgent] = useState("");

  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(user?.user_metadata?.security_alerts_enabled !== false);
  const [updatingAlerts, setUpdatingAlerts] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [revokedClientIds, setRevokedClientIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(REVOKED_CONNECTED_APPS_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [customApps, setCustomApps] = useState<RegisteredApp[]>([]);
  const [showAddApp, setShowAddApp] = useState(false);
  const [newCreatedApp, setNewCreatedApp] = useState<RegisteredApp | null>(null);
  const [newAppName, setNewAppName] = useState("");
  const [newAppHomepage, setNewAppHomepage] = useState("");
  const [newAppRedirect, setNewAppRedirect] = useState("");
  const [newAppScopes, setNewAppScopes] = useState<string[]>(["openid", "profile", "email"]);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [previewSeed, setPreviewSeed] = useState<number>(() => Date.now());
  const [brokenPreviews, setBrokenPreviews] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAuditLog(getAuditLog());
    const storedApps = localStorage.getItem("zuup_custom_apps");
    if (storedApps) setCustomApps(JSON.parse(storedApps));
    const storedKeys = localStorage.getItem("zuup_api_keys");
    if (storedKeys) setApiKeys(JSON.parse(storedKeys));

    fetch("/api/account/session-context")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ip) setSessionIp(data.ip);
        if (data?.userAgent) setSessionUserAgent(data.userAgent);
      })
      .catch(() => {
        setSessionIp("Unavailable");
      });

    if (user?.id) {
      const storedBackupCodes = localStorage.getItem(`zuup_backup_codes_${user.id}`);
      if (storedBackupCodes) {
        try {
          setBackupCodes(JSON.parse(storedBackupCodes));
        } catch {
          setBackupCodes([]);
        }
      }
    }
  }, []);

  useEffect(() => {
    setAlertsEnabled(user?.user_metadata?.security_alerts_enabled !== false);
  }, [user?.user_metadata?.security_alerts_enabled]);

  useEffect(() => {
    setFullName(user?.user_metadata?.full_name || user?.user_metadata?.name || "");
    setLastName(user?.user_metadata?.last_name || "");
    setCountry(user?.user_metadata?.country || "");
    setMobileCountryCode(user?.user_metadata?.phone_country_code || "+1 (US/CA)");
    setPhoneNumber(user?.user_metadata?.phone || "");
    setAddressLine1(user?.user_metadata?.address_line1 || "");
    setAddressLine2(user?.user_metadata?.address_line2 || "");
    setCity(user?.user_metadata?.city || "");
    setStateRegion(user?.user_metadata?.state_region || "");
    setPostalCode(user?.user_metadata?.postal_code || "");
    setUsername(user?.user_metadata?.username || "");
    setNewEmail(user?.email || "");
    setAvatarUrl(user?.user_metadata?.avatar_url || "");
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    supabase.auth.mfa.listFactors()
      .then(({ data, error }) => {
        if (error) throw error;
        const factors = [
          ...(data?.totp || []),
          ...(data?.all || []),
        ];
        const active = factors.find((factor: any) => factor.status === "verified") || factors[0];
        setMfaEnabled(Boolean(active));
        setMfaFactorId(active?.id || null);
      })
      .catch(() => {
        setMfaEnabled(false);
        setMfaFactorId(null);
      });
  }, [user]);

  useEffect(() => {
    localStorage.setItem("zuup_dev_mode", devMode ? "true" : "false");
    if (!devMode && activeTab === "developers") {
      setActiveTab("home");
    }
  }, [devMode, activeTab]);

  const displayName = fullName || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const avatarInitial = displayName[0]?.toUpperCase() || "U";
  const completion = useMemo(() => {
    const fields = [fullName, lastName, phoneNumber, country, addressLine1, city, postalCode, avatarUrl];
    const filled = fields.filter((value) => String(value || "").trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [fullName, lastName, phoneNumber, country, addressLine1, city, postalCode, avatarUrl]);

  const sessionInfo = useMemo(() => {
    const parsed = parseDevice(navigator.userAgent);
    return {
      browser: `${parsed.browser} Current`,
      device: parsed.device,
      signedInAt: user?.last_sign_in_at || user?.created_at || new Date().toISOString(),
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : "",
      ip: "Not available in browser",
      method: "Email",
    };
  }, [user?.created_at, user?.last_sign_in_at, session?.expires_at]);

  const generateBackupCodes = () => {
    const codes = Array.from({ length: 8 }, () => generateSecureRandom(4).toUpperCase());
    setBackupCodes(codes);
    if (user?.id) {
      localStorage.setItem(`zuup_backup_codes_${user.id}`, JSON.stringify(codes));
    }
  };

  const handleEnableTotp = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Zuup Authenticator",
        issuer: "Zuup",
      } as any);
      if (error) throw error;
      setMfaFactorId(data.id);
      setMfaQrCode(data?.totp?.qr_code || null);
      toast.success("Scan the QR code and verify with a 6-digit code");
    } catch (err: any) {
      toast.error(err.message || "Failed to start 2FA setup");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyTotp = async () => {
    if (!mfaFactorId) {
      toast.error("No pending authenticator setup found");
      return;
    }
    if (!/^\d{6}$/.test(mfaVerifyCode)) {
      toast.error("Enter a valid 6-digit authenticator code");
      return;
    }

    setMfaLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId } as any);
      if (challenge.error) throw challenge.error;

      const verified = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaVerifyCode,
      } as any);
      if (verified.error) throw verified.error;
      setMfaEnabled(true);
      setMfaQrCode(null);
      setMfaVerifyCode("");
      generateBackupCodes();
      logAuditEvent({ type: "2fa_enabled", user_id: user?.id });
      toast.success("Two-factor authentication enabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to verify authenticator code");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    if (!mfaFactorId) return;
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId } as any);
      if (error) throw error;
      setMfaEnabled(false);
      setMfaFactorId(null);
      setMfaQrCode(null);
      setMfaVerifyCode("");
      setBackupCodes([]);
      if (user?.id) {
        localStorage.removeItem(`zuup_backup_codes_${user.id}`);
      }
      logAuditEvent({ type: "2fa_disabled", user_id: user?.id });
      toast.success("Two-factor authentication disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to disable 2FA");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleToggleAlerts = async () => {
    setUpdatingAlerts(true);
    try {
      await updateProfile({
        security_alerts_enabled: !alertsEnabled,
      } as any);
      setAlertsEnabled((prev) => !prev);
      toast.success(!alertsEnabled ? "Security alert emails enabled" : "Security alert emails disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to update alert settings");
    } finally {
      setUpdatingAlerts(false);
    }
  };

  const allDevApps = [...BUILTIN_APPS, ...customApps];

  const connectedApps = useMemo(() => {
    const clients = getRegisteredClients();
    const byClient = new Map<string, ConnectedAuthorization>();

    for (const event of auditLog) {
      if ((event.type !== "consent_granted" && event.type !== "token_issued") || !event.client_id) continue;
      if (revokedClientIds.includes(event.client_id)) continue;

      const client = clients[event.client_id];
      const scopes = (event.details?.scopes || "")
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const fallbackScopes = client?.allowed_scopes || [];
      const effectiveScopes = scopes.length > 0 ? scopes : fallbackScopes;
      const permissions = effectiveScopes.map(scopeToPermission);

      const baseAuthorizedAt = event.created_at;
      const expiresAt = new Date(new Date(baseAuthorizedAt).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();

      const existing = byClient.get(event.client_id);
      if (!existing) {
        byClient.set(event.client_id, {
          id: event.client_id,
          name: client?.name || event.client_id,
          authorized_at: baseAuthorizedAt,
          expires_at: expiresAt,
          permissions,
        });
      }
    }

    return Array.from(byClient.values()).sort(
      (a, b) => new Date(b.authorized_at).getTime() - new Date(a.authorized_at).getTime(),
    );
  }, [auditLog, revokedClientIds]);

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "20px 22px",
    marginBottom: 14,
  };

  const handleSignOut = async () => {
    logAuditEvent({ type: "logout", user_id: user?.id });
    await signOut();
    navigate("/login");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max 2MB image");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${user?.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true });

      if (!error) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
        await updateProfile({ avatar_url: data.publicUrl });
        setAvatarUrl(data.publicUrl);
        toast.success("Avatar updated");
        return;
      }

      const message = String(error?.message || "").toLowerCase();
      if (message.includes("bucket not found")) {
        const dataUrl = await fileToCompressedDataUrl(file);
        await updateProfile({ avatar_url: dataUrl });
        setAvatarUrl(dataUrl);
        toast.success("Avatar updated");
        return;
      }

      throw error;
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveMyInfo = async () => {
    setSavingProfile(true);
    try {
      const normalizedFullName = String(fullName || "").trim();
      const normalizedLastName = String(lastName || "").trim();
      const normalizedCountry = String(country || "").trim();
      const normalizedPhone = String(phoneNumber || "").trim();
      const normalizedAddressLine1 = String(addressLine1 || "").trim();
      const normalizedAddressLine2 = String(addressLine2 || "").trim();
      const normalizedCity = String(city || "").trim();
      const normalizedStateRegion = String(stateRegion || "").trim();
      const normalizedPostalCode = String(postalCode || "").trim();
      const combinedName = `${normalizedFullName} ${normalizedLastName}`.trim();
      const fullPhone = normalizedPhone ? `${mobileCountryCode} ${normalizedPhone}`.trim() : "";

      await updateProfile({
        full_name: normalizedFullName,
        first_name: normalizedFullName,
        last_name: normalizedLastName,
        country: normalizedCountry,
        name: combinedName || normalizedFullName,
        phone: normalizedPhone,
        phone_number: normalizedPhone,
        phone_country_code: mobileCountryCode,
        full_phone: fullPhone,
        address_line1: normalizedAddressLine1,
        address_line2: normalizedAddressLine2,
        city: normalizedCity,
        state_region: normalizedStateRegion,
        postal_code: normalizedPostalCode,
        mailing_address: {
          line1: normalizedAddressLine1,
          line2: normalizedAddressLine2,
          city: normalizedCity,
          state_region: normalizedStateRegion,
          postal_code: normalizedPostalCode,
          country: normalizedCountry,
        },
        username,
        avatar_url: avatarUrl,
        cover_image_url: null,
        gallery_images: [],
      });

      if (newEmail !== user?.email) {
        const emailUpdate = await updateEmail(newEmail);
        logAuditEvent({ type: "email_changed", user_id: user?.id });
        const pending = (emailUpdate as any)?.user?.new_email || newEmail;
        toast.success(`Email change confirmation sent to ${pending}`);
      } else {
        toast.success("Profile updated");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      logAuditEvent({ type: "password_changed", user_id: user?.id });
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAddApp = () => {
    if (!newAppName || !newAppHomepage || !newAppRedirect) {
      toast.error("All fields are required");
      return;
    }

    const app: RegisteredApp = {
      client_id: generateClientId(),
      client_secret: generateClientSecret(),
      name: newAppName,
      homepage_url: newAppHomepage,
      allowed_redirect_uris: newAppRedirect.split(",").map((s) => s.trim()).filter(Boolean),
      allowed_scopes: newAppScopes,
      is_first_party: isZuupDomain(newAppHomepage),
      created_at: new Date().toISOString(),
    };

    const updated = [...customApps, app];
    fetch("/api/oauth/register-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(app),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || body?.error || "Failed to register app");
        }

        setCustomApps(updated);
        localStorage.setItem("zuup_custom_apps", JSON.stringify(updated));
        setNewCreatedApp(app);
        logAuditEvent({ type: "client_registered", user_id: user?.id, client_id: app.client_id, details: { name: app.name } });
      })
      .catch((err: any) => {
        toast.error(err?.message || "Failed to register app");
      });
  };

  const handleCreateApiKey = () => {
    if (!newKeyName.trim()) {
      toast.error("Key name is required");
      return;
    }

    setCreatingKey(true);
    setTimeout(() => {
      const fullKey = `zuup_sk_${generateSecureRandom(24)}`;
      const key: ApiKey = {
        id: generateSecureRandom(8),
        name: newKeyName,
        prefix: `${fullKey.slice(0, 16)}...`,
        created_at: new Date().toISOString(),
        scopes: ["zuup:read"],
      };
      const updated = [...apiKeys, key];
      setApiKeys(updated);
      localStorage.setItem("zuup_api_keys", JSON.stringify(updated));
      setCreatedKey(fullKey);
      setNewKeyName("");
      setCreatingKey(false);
    }, 500);
  };

  const revokeConnectedApp = (id: string) => {
    const updated = Array.from(new Set([...revokedClientIds, id]));
    setRevokedClientIds(updated);
    localStorage.setItem(REVOKED_CONNECTED_APPS_KEY, JSON.stringify(updated));
    toast.success("App authorization revoked");
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; visible: boolean }> = [
    { id: "home", label: "Home", icon: <Globe size={14} />, visible: true },
    { id: "info", label: "My Info", icon: <User size={14} />, visible: true },
    { id: "security", label: "Security", icon: <Shield size={14} />, visible: true },
    { id: "connected", label: "Connected Apps", icon: <Key size={14} />, visible: true },
    { id: "activity", label: "Activity Log", icon: <Activity size={14} />, visible: true },
    { id: "developers", label: "Developers", icon: <Code2 size={14} />, visible: devMode },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", color: "#e8eaf0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(13,15,20,0.9)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 1.2rem", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <img src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png" alt="Zuup" style={{ height: 28 }} />
            <span style={{ fontWeight: 700, color: "#f1f3f8" }}>Zuup</span>
            <span style={{ fontWeight: 300, color: "#e8425a" }}>Account</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#e8425a,#f06080)", fontWeight: 700, fontSize: 12 }}>
                {avatarInitial}
              </div>
            )}
            <button
              onClick={handleSignOut}
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", borderRadius: 8, padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 1.2rem 64px" }}>
        <div style={{ display: "flex", gap: 2, overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {tabs.filter((t) => t.visible).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                border: "none",
                background: "transparent",
                color: activeTab === t.id ? "#e8425a" : "#6b7280",
                borderBottom: `2px solid ${activeTab === t.id ? "#e8425a" : "transparent"}`,
                padding: "13px 14px",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 780, marginTop: 24 }}>
          {activeTab === "home" && (
            <>
              <div style={card}>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>Home</p>
                <h1 style={{ margin: "6px 0 8px", fontSize: 28 }}>Hello {displayName}</h1>
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>Your Zuup account is your passport to all Zuup services.</p>
              </div>

              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Complete your profile</p>
                  <span style={{ color: "#e8425a", fontSize: 12, fontWeight: 600 }}>{completion}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ width: `${completion}%`, height: "100%", background: "linear-gradient(135deg,#e8425a,#f06080)" }} />
                </div>
                <Button size="sm" onClick={() => setActiveTab("info")} className="zuup-gradient">Finish profile</Button>
              </div>

              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Zuup Apps Network</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSeed(Date.now());
                      setBrokenPreviews({});
                    }}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.03)",
                      color: "#9ca3af",
                      borderRadius: 8,
                      fontSize: 11,
                      padding: "5px 9px",
                      cursor: "pointer",
                    }}
                  >
                    Reload photos
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {APP_SHOWCASE.map((app) => (
                    <a
                      key={app.url}
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.02)", color: "#e8eaf0", overflow: "hidden" }}
                    >
                      {!brokenPreviews[app.url] ? (
                        <img
                          src={appPreviewUrl(app.url, previewSeed)}
                          alt={app.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenPreviews((prev) => ({ ...prev, [app.url]: true }))}
                          style={{ width: "100%", height: 118, objectFit: "cover", display: "block", background: "#161a22" }}
                        />
                      ) : (
                        <div style={{ height: 118, background: "linear-gradient(135deg, rgba(232,66,90,0.16), rgba(16,24,39,0.8))", display: "grid", placeItems: "center", color: "#e8eaf0", fontSize: 12 }}>
                          Preview unavailable
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{app.name}</span>
                        <Globe size={14} style={{ color: "#e8425a" }} />
                      </div>
                      <div style={{ margin: "0 12px 12px", color: "#9ca3af", fontSize: 11, wordBreak: "break-all" }}>
                        {app.url.replace("https://", "")}
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>Saved Contact Snapshot</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <CopyRow label="Country" value={country || "Not set"} />
                  <CopyRow label="Phone" value={(phoneNumber ? `${mobileCountryCode} ${phoneNumber}` : "Not set")} />
                  <CopyRow label="City" value={city || "Not set"} />
                  <CopyRow label="Postal" value={postalCode || "Not set"} />
                </div>
              </div>
            </>
          )}

          {activeTab === "info" && (
            <>
              <div style={card}>
                <p style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>Personal info</p>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                  <div style={{ position: "relative" }}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#e8425a,#f06080)", fontWeight: 700, fontSize: 24 }}>
                        {avatarInitial}
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: "50%", border: "2px solid #0d0f14", background: "#e8425a", color: "white", display: "grid", placeItems: "center", cursor: "pointer" }}
                    >
                      {uploadingAvatar ? <RefreshCw size={12} className="animate-spin" /> : <Camera size={12} />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                  </div>

                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{displayName}</p>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>{user?.email}</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>First name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="First name" className="bg-secondary/50 border-border/60" />
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Last name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="bg-secondary/50 border-border/60" />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Country</Label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    style={{
                      width: "100%",
                      height: 40,
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.03)",
                      color: "#e8eaf0",
                      padding: "0 10px",
                      outline: "none",
                    }}
                  >
                    <option value="" style={{ color: "#111827" }}>Select country</option>
                    {COUNTRY_LIST.map((item) => (
                      <option key={item} value={item} style={{ color: "#111827" }}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Mobile country code</Label>
                  <select
                    value={mobileCountryCode}
                    onChange={(e) => setMobileCountryCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 40,
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.03)",
                      color: "#e8eaf0",
                      padding: "0 10px",
                      outline: "none",
                    }}
                  >
                    {MOBILE_COUNTRY_CODES.map((item) => (
                      <option key={item} value={item} style={{ color: "#111827" }}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Phone number</Label>
                  <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1 555 000 0000" className="bg-secondary/50 border-border/60" />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Mailing address line 1</Label>
                  <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street and house number" className="bg-secondary/50 border-border/60" />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Mailing address line 2</Label>
                  <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Apartment, suite, landmark (optional)" className="bg-secondary/50 border-border/60" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="bg-secondary/50 border-border/60" />
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>State / region</Label>
                    <Input value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} placeholder="State" className="bg-secondary/50 border-border/60" />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Postal code</Label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal / ZIP code" className="bg-secondary/50 border-border/60" />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="bg-secondary/50 border-border/60" />
                  {newEmail !== user?.email && <p style={{ margin: "6px 0 0", color: "#e8425a", fontSize: 12 }}>Change email requested</p>}
                </div>

                <div style={{ marginTop: 12 }}>
                  <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-secondary/50 border-border/60" />
                </div>

                <Button onClick={handleSaveMyInfo} disabled={savingProfile} className="zuup-gradient" style={{ marginTop: 14 }}>
                  {savingProfile ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />} Save my info
                </Button>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14 }}>Developer mode</p>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>Wanna OAuth some OAuth? Check this to unlock Developers tab.</p>
                  </div>
                  <button
                    onClick={() => setDevMode((v) => !v)}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: devMode ? "#e8425a" : "#374151",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        left: devMode ? 24 : 4,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "white",
                        transition: "left .16s",
                      }}
                    />
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "security" && (
            <>
              <div style={card}>
                <p style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600 }}>Active Sessions</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                    <p style={{ margin: "0 0 6px", color: "#9ca3af", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><Monitor size={13} /> Browser</p>
                    <p style={{ margin: 0, fontSize: 13 }}>{sessionInfo.browser}</p>
                  </div>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                    <p style={{ margin: "0 0 6px", color: "#9ca3af", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><Smartphone size={13} /> Device</p>
                    <p style={{ margin: 0, fontSize: 13 }}>{sessionInfo.device}</p>
                  </div>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                    <p style={{ margin: "0 0 6px", color: "#9ca3af", fontSize: 12 }}>IP Address</p>
                    <p style={{ margin: 0, fontSize: 13 }}>{sessionIp || sessionInfo.ip}</p>
                  </div>
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                    <p style={{ margin: "0 0 6px", color: "#9ca3af", fontSize: 12 }}>Login method</p>
                    <p style={{ margin: 0, fontSize: 13 }}>{sessionInfo.method}</p>
                  </div>
                </div>

                <p style={{ margin: "12px 0 0", color: "#6b7280", fontSize: 12 }}>
                  Signed in: {new Date(sessionInfo.signedInAt).toLocaleString()} · Lasts until: {sessionInfo.expiresAt ? new Date(sessionInfo.expiresAt).toLocaleString() : "Unknown"}
                </p>
                <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 12 }}>
                  Session browser: {sessionUserAgent || "Unavailable"}
                </p>
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Authenticator App</p>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9ca3af" }}>Add an extra layer of security by requiring a code from an authenticator app.</p>
                {!mfaEnabled && !mfaQrCode && (
                  <Button variant="outline" onClick={handleEnableTotp} disabled={mfaLoading}>
                    {mfaLoading ? <RefreshCw className="animate-spin" size={14} /> : <Shield size={14} />} Set up two-factor authentication
                  </Button>
                )}

                {!mfaEnabled && mfaQrCode && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Scan this QR in Google Authenticator/Authy, then enter the 6-digit code.</p>
                    <img src={mfaQrCode} alt="2FA QR" style={{ width: 180, height: 180, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "white", padding: 8 }} />
                    <Input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={mfaVerifyCode}
                      onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="bg-secondary/50 border-border/60"
                    />
                    <Button className="zuup-gradient" onClick={handleVerifyTotp} disabled={mfaLoading}>
                      {mfaLoading ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />} Verify and enable
                    </Button>
                  </div>
                )}

                {mfaEnabled && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#10b981" }}>Two-factor authentication is enabled.</p>
                    <Button variant="outline" onClick={handleDisableTotp} disabled={mfaLoading}>
                      {mfaLoading ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />} Disable 2FA
                    </Button>
                  </div>
                )}
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Passkeys</p>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af" }}>
                  Passkey MFA is not enabled for this Supabase project. Use Authenticator App (TOTP) above.
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#f59e0b" }}>
                  If you enable WebAuthn MFA in Supabase later, this section can be re-enabled.
                </p>
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Backup Codes</p>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9ca3af" }}>
                  {backupCodes.length > 0 ? "Store these in a safe place. Each code can be used once." : "No backup codes available. Enable 2FA first to generate backup codes."}
                </p>
                {backupCodes.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {backupCodes.map((code) => (
                      <div key={code} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 10px", fontFamily: "monospace", fontSize: 12 }}>
                        {code}
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="outline" onClick={generateBackupCodes} disabled={!mfaEnabled}>Generate backup codes</Button>
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Security Alert Emails</p>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9ca3af" }}>
                  Send an email when your account logs in from a new request with browser and IP details.
                </p>
                <Button variant="outline" onClick={handleToggleAlerts} disabled={updatingAlerts}>
                  {updatingAlerts ? <RefreshCw className="animate-spin" size={14} /> : <Mail size={14} />} {alertsEnabled ? "Disable alerts" : "Enable alerts"}
                </Button>
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Change password</p>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>New password</Label>
                    <div style={{ position: "relative" }}>
                      <Input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-secondary/50 border-border/60 pr-10" />
                      <button onClick={() => setShowNew((v) => !v)} type="button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "#6b7280", cursor: "pointer" }}>
                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "block" }}>Confirm password</Label>
                    <div style={{ position: "relative" }}>
                      <Input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-secondary/50 border-border/60 pr-10" />
                      <button onClick={() => setShowConfirm((v) => !v)} type="button" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "#6b7280", cursor: "pointer" }}>
                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button onClick={handleChangePassword} disabled={savingPassword} className="zuup-gradient" style={{ marginTop: 12 }}>
                  {savingPassword ? <RefreshCw className="animate-spin" size={14} /> : <Lock size={14} />} Update password
                </Button>
              </div>
            </>
          )}

          {activeTab === "connected" && (
            <>
              <div style={card}>
                <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>Connected Apps</p>
                {connectedApps.length === 0 && <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>No connected apps.</p>}

                <div style={{ display: "grid", gap: 10 }}>
                  {connectedApps.map((app) => (
                    <div key={app.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 14 }}>{app.name}</p>
                          <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>Authorized {new Date(app.authorized_at).toLocaleString()}</p>
                        </div>
                        <button onClick={() => revokeConnectedApp(app.id)} style={{ border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", borderRadius: 8, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}>
                          Revoke
                        </button>
                      </div>
                      <p style={{ margin: "8px 0 6px", color: "#9ca3af", fontSize: 12 }}>
                        Expires {new Date(app.expires_at).toLocaleDateString()}
                      </p>
                      <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>
                        Permissions: {app.permissions.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "activity" && (
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Activity Log</p>
                <button
                  onClick={() => setAuditLog(getAuditLog())}
                  style={{ border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#9ca3af", borderRadius: 8, fontSize: 12, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              {auditLog.length === 0 && <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>No account events yet.</p>}
              {auditLog.map((event) => (
                <div key={event.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 10 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 13, color: "#e8eaf0" }}>{event.type.replaceAll("_", " ")}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{new Date(event.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "developers" && (
            <>
              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600, fontSize: 16 }}>Developer tools</p>
                <p style={{ margin: "0 0 12px", color: "#9ca3af", fontSize: 13 }}>Register OAuth apps, issue API keys, and integrate with Zuup Auth.</p>
                <Link to="/docs" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#fff", background: "linear-gradient(135deg,#e8425a,#f06080)", padding: "9px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  <Code2 size={14} /> Open Docs
                </Link>
              </div>

              <div style={card}>
                <p style={{ margin: "0 0 10px", fontWeight: 600 }}>OAuth Endpoints</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <CopyRow label="Authorization" value={OAUTH_ENDPOINTS.authorization} />
                  <CopyRow label="Token" value={OAUTH_ENDPOINTS.token} />
                  <CopyRow label="Userinfo" value={OAUTH_ENDPOINTS.userinfo} />
                  <CopyRow label="JWKS" value={OAUTH_ENDPOINTS.jwks} />
                  <CopyRow label="OIDC Discovery" value={OAUTH_ENDPOINTS.oidcDiscovery} />
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>OAuth Apps</p>
                  <Button size="sm" className="zuup-gradient" onClick={() => setShowAddApp(true)}>
                    <Plus size={14} /> Add app
                  </Button>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {allDevApps.map((app) => (
                    <div key={app.client_id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14 }}>{app.name}</p>
                          <p style={{ margin: 0, color: "#6b7280", fontSize: 12, fontFamily: "monospace" }}>{app.client_id}</p>
                        </div>
                        <a href={app.homepage_url} target="_blank" rel="noopener noreferrer" style={{ color: "#9ca3af" }}>
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>API Keys</p>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateKey(true)}>
                    <Plus size={14} /> New key
                  </Button>
                </div>
                {apiKeys.length === 0 && <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>No API keys yet.</p>}
                <div style={{ display: "grid", gap: 8 }}>
                  {apiKeys.map((key) => (
                    <div key={key.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600 }}>{key.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{key.prefix}</p>
                      </div>
                      <button
                        onClick={() => {
                          const updated = apiKeys.filter((k) => k.id !== key.id);
                          setApiKeys(updated);
                          localStorage.setItem("zuup_api_keys", JSON.stringify(updated));
                        }}
                        style={{ border: "none", background: "none", color: "#9ca3af", cursor: "pointer" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={showAddApp}
        onOpenChange={(open) => {
          setShowAddApp(open);
          if (!open) {
            setNewCreatedApp(null);
            setNewAppName("");
            setNewAppHomepage("");
            setNewAppRedirect("");
            setNewAppScopes(["openid", "profile", "email"]);
          }
        }}
      >
        <DialogContent style={{ background: "#161a22", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0" }}>
          <DialogHeader>
            <DialogTitle>Register app</DialogTitle>
            <DialogDescription style={{ color: "#9ca3af" }}>Create OAuth credentials for your app.</DialogDescription>
          </DialogHeader>

          {newCreatedApp ? (
            <>
              <CopyRow label="Client ID" value={newCreatedApp.client_id} />
              <CopyRow label="Client Secret" value={newCreatedApp.client_secret} />
              <DialogFooter>
                <Button className="zuup-gradient" onClick={() => setShowAddApp(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <Label style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "block" }}>App Name</Label>
                  <Input value={newAppName} onChange={(e) => setNewAppName(e.target.value)} className="bg-secondary/50 border-border/60" />
                </div>
                <div>
                  <Label style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "block" }}>Homepage URL</Label>
                  <Input value={newAppHomepage} onChange={(e) => setNewAppHomepage(e.target.value)} className="bg-secondary/50 border-border/60" />
                </div>
                <div>
                  <Label style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "block" }}>Redirect URI(s)</Label>
                  <Input value={newAppRedirect} onChange={(e) => setNewAppRedirect(e.target.value)} placeholder="https://app.com/callback" className="bg-secondary/50 border-border/60" />
                </div>
                <div>
                  <Label style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "block" }}>Scopes</Label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ALL_SCOPES.map((scope) => (
                      <button
                        key={scope}
                        onClick={() => setNewAppScopes((prev) => (prev.includes(scope) ? prev.filter((x) => x !== scope) : [...prev, scope]))}
                        style={{
                          border: `1px solid ${newAppScopes.includes(scope) ? "rgba(232,66,90,0.35)" : "rgba(255,255,255,0.12)"}`,
                          color: newAppScopes.includes(scope) ? "#e8425a" : "#9ca3af",
                          background: newAppScopes.includes(scope) ? "rgba(232,66,90,0.08)" : "transparent",
                          borderRadius: 8,
                          fontSize: 12,
                          padding: "5px 9px",
                          fontFamily: "monospace",
                          cursor: "pointer",
                        }}
                      >
                        {scope}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowAddApp(false)}>Cancel</Button>
                <Button className="zuup-gradient" onClick={handleAddApp}><Plus size={14} /> Register</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreateKey}
        onOpenChange={(open) => {
          setShowCreateKey(open);
          if (!open) {
            setCreatedKey(null);
            setNewKeyName("");
          }
        }}
      >
        <DialogContent style={{ background: "#161a22", border: "1px solid rgba(255,255,255,0.1)", color: "#e8eaf0" }}>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription style={{ color: "#9ca3af" }}>Store this key securely. It is shown once.</DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <>
              <CopyRow label="API Key" value={createdKey} />
              <DialogFooter>
                <Button className="zuup-gradient" onClick={() => setShowCreateKey(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div>
                <Label style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "block" }}>Key Name</Label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="bg-secondary/50 border-border/60" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateKey(false)}>Cancel</Button>
                <Button className="zuup-gradient" onClick={handleCreateApiKey} disabled={creatingKey}>
                  {creatingKey ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />} Create
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
