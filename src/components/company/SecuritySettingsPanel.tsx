import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShieldCheck, Save, Loader2, KeyRound, Clock, Globe, Monitor,
  Plus, X, History,
} from "lucide-react";

interface SecuritySettings {
  force_2fa: boolean;
  session_timeout_minutes: number;
  ip_whitelist: string[];
}

interface LoginSession {
  id: string;
  created_at: string;
  ip_address: string | null;
  user_id: string;
  action: string;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  force_2fa: false,
  session_timeout_minutes: 480,
  ip_whitelist: [],
};

const TIMEOUT_OPTIONS = [
  { value: "30", label: "30 دقيقة" },
  { value: "60", label: "ساعة واحدة" },
  { value: "120", label: "ساعتان" },
  { value: "240", label: "4 ساعات" },
  { value: "480", label: "8 ساعات" },
  { value: "1440", label: "24 ساعة" },
];

const SecuritySettingsPanel = () => {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchSettings();
      fetchSessions();
    }
  }, [tenantId]);

  const fetchSettings = async () => {
    const { data } = await (supabase
      .from("tenant_settings" as any)
      .select("security_settings")
      .eq("tenant_id", tenantId!)
      .maybeSingle() as any);

    if (data?.security_settings) {
      setSettings({ ...DEFAULT_SETTINGS, ...data.security_settings, force_2fa: false });
    }
    setLoading(false);
  };

  const fetchSessions = async () => {
    const { data } = await (supabase
      .from("audit_logs")
      .select("id, created_at, ip_address, user_id, action")
      .eq("tenant_id", tenantId!)
      .eq("entity_type", "auth")
      .in("action", ["login", "signup", "password_reset", "session_start"])
      .order("created_at", { ascending: false })
      .limit(10) as any);

    setSessions(data || []);
    setLoadingSessions(false);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);

    const { error } = await (supabase
      .from("tenant_settings" as any)
      .upsert({
        tenant_id: tenantId,
          security_settings: { ...settings, force_2fa: false },
      }, { onConflict: "tenant_id" }) as any);

    setSaving(false);
    if (error) {
      toast.error("فشل حفظ إعدادات الأمان: " + error.message);
    } else {
      toast.success("تم حفظ إعدادات الأمان");
      setDirty(false);
    }
  };

  const updateSetting = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const addIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    // Basic IP/CIDR validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(trimmed)) {
      toast.error("صيغة IP غير صالحة (مثال: 192.168.1.0/24)");
      return;
    }
    if (settings.ip_whitelist.includes(trimmed)) {
      toast.error("هذا العنوان مضاف مسبقاً");
      return;
    }
    updateSetting("ip_whitelist", [...settings.ip_whitelist, trimmed]);
    setNewIp("");
  };

  const removeIp = (ip: string) => {
    updateSetting("ip_whitelist", settings.ip_whitelist.filter(i => i !== ip));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">جارٍ تحميل إعدادات الأمان...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            إعدادات الأمان المتقدمة
          </div>
          {dirty && (
            <Badge className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200">تغييرات غير محفوظة</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Force 2FA */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">المصادقة الثنائية اختيارية</p>
              <p className="text-[11px] text-muted-foreground">يمكن لكل مستخدم تفعيلها أو إيقافها من أمان الحساب</p>
            </div>
          </div>
          <Switch
            checked={false}
            disabled
          />
        </div>

        {/* Session Timeout */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
              <Clock className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">مهلة الجلسة</p>
              <p className="text-[11px] text-muted-foreground">إنهاء الجلسة تلقائياً بعد فترة عدم نشاط</p>
            </div>
          </div>
          <Select
            value={String(settings.session_timeout_minutes)}
            onValueChange={(v) => updateSetting("session_timeout_minutes", Number(v))}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEOUT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* IP Whitelist */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
              <Globe className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">قائمة IP المسموح بها</p>
              <p className="text-[11px] text-muted-foreground">السماح فقط بعناوين IP محددة — اتركها فارغة للسماح بالكل</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="192.168.1.0/24"
              dir="ltr"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && addIp()}
            />
            <Button variant="outline" size="sm" onClick={addIp} className="shrink-0">
              <Plus className="h-4 w-4 ml-1" />
              إضافة
            </Button>
          </div>

          {settings.ip_whitelist.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.ip_whitelist.map(ip => (
                <Badge key={ip} variant="secondary" className="gap-1.5 font-mono text-xs">
                  {ip}
                  <button onClick={() => removeIp(ip)} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {settings.ip_whitelist.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">لا توجد قيود — جميع العناوين مسموح بها</p>
          )}
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving || !dirty} className="w-full sm:w-auto">
          {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          حفظ إعدادات الأمان
        </Button>

        {/* Last 10 Login Sessions */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">آخر 10 جلسات تسجيل دخول</p>
          </div>

          {loadingSessions ? (
            <div className="flex items-center gap-2 text-muted-foreground py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">جارٍ التحميل...</span>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">لا توجد سجلات تسجيل دخول</p>
          ) : (
            <div className="space-y-1.5">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-foreground font-medium">{s.action}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {s.ip_address && <span className="font-mono">{s.ip_address}</span>}
                    <span>
                      {new Date(s.created_at).toLocaleDateString("ar-SA", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SecuritySettingsPanel;
