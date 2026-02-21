import { useEffect, useState, useCallback, useRef } from "react";
import {
  Shield, Lock, KeyRound, Clock, Database, Eye, EyeOff,
  CheckCircle2, Loader2, AlertTriangle, LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface PolicyState {
  password_min_length: number;
  require_uppercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
  session_timeout_minutes: number;
  audit_retention_days: number;
  webhook_retention_days: number;
}

const DEFAULT_POLICY: PolicyState = {
  password_min_length: 12,
  require_uppercase: true,
  require_numbers: true,
  require_symbols: true,
  session_timeout_minutes: 60,
  audit_retention_days: 365,
  webhook_retention_days: 90,
};

type SaveStatus = "idle" | "saving" | "saved" | "unsaved";

const EnterpriseSecurityPolicies = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [policy, setPolicy] = useState<PolicyState>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  // Load
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await supabase
        .from("enterprise_security_policies")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (data) {
        setPolicy({
          password_min_length: data.password_min_length,
          require_uppercase: data.require_uppercase,
          require_numbers: data.require_numbers,
          require_symbols: data.require_symbols,
          session_timeout_minutes: data.session_timeout_minutes,
          audit_retention_days: data.audit_retention_days,
          webhook_retention_days: data.webhook_retention_days,
        });
      }
      setLoading(false);
    })();
  }, [tenantId]);

  // Auto-save
  const persistSave = useCallback(async (state: PolicyState) => {
    if (!tenantId || savingRef.current) return;
    savingRef.current = true;
    setStatus("saving");
    try {
      const { error } = await supabase
        .from("enterprise_security_policies")
        .upsert({ tenant_id: tenantId, ...state }, { onConflict: "tenant_id" });
      if (error) throw error;
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err: any) {
      setStatus("unsaved");
      toast.error(err.message);
    } finally {
      savingRef.current = false;
    }
  }, [tenantId]);

  const updateField = useCallback(<K extends keyof PolicyState>(key: K, value: PolicyState[K]) => {
    setPolicy((prev) => {
      const next = { ...prev, [key]: value };
      setStatus("unsaved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => persistSave(next), 1200);
      return next;
    });
  }, [persistSave]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const StatusIndicator = () => {
    if (status === "saving") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />{isRTL ? "جاري الحفظ..." : "Saving..."}</Badge>;
    if (status === "saved") return <Badge variant="secondary" className="gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" />{isRTL ? "تم الحفظ" : "Saved"}</Badge>;
    if (status === "unsaved") return <Badge variant="outline" className="gap-1 text-amber-500"><AlertTriangle className="h-3 w-3" />{isRTL ? "تغييرات غير محفوظة" : "Unsaved"}</Badge>;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRTL ? "السياسات الأمنية" : "Security Policies"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "إدارة سياسات كلمات المرور والجلسات والاحتفاظ بالبيانات" : "Manage password, session, and data retention policies"}
            </p>
          </div>
        </div>
        <StatusIndicator />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Password Policy */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{isRTL ? "سياسة كلمات المرور" : "Password Policy"}</CardTitle>
              </div>
              <CardDescription>{isRTL ? "تحكم في متطلبات كلمات المرور لجميع المستخدمين" : "Control password requirements for all users"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{isRTL ? "الحد الأدنى للطول" : "Minimum Length"}</Label>
                  <span className="text-sm font-bold tabular-nums text-primary">{policy.password_min_length}</span>
                </div>
                <Slider
                  value={[policy.password_min_length]}
                  onValueChange={([v]) => updateField("password_min_length", v)}
                  min={8}
                  max={32}
                  step={1}
                />
                <p className="text-[11px] text-muted-foreground">{isRTL ? "الحد الأدنى الموصى به: 12 حرف" : "Recommended minimum: 12 characters"}</p>
              </div>

              <Separator />

              <div className="space-y-3">
                {([
                  { key: "require_uppercase" as const, label: isRTL ? "أحرف كبيرة (A-Z)" : "Uppercase (A-Z)", icon: "A" },
                  { key: "require_numbers" as const, label: isRTL ? "أرقام (0-9)" : "Numbers (0-9)", icon: "#" },
                  { key: "require_symbols" as const, label: isRTL ? "رموز (!@#$)" : "Symbols (!@#$)", icon: "@" },
                ]).map(({ key, label, icon }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-mono font-bold">{icon}</span>
                      <Label className="text-sm">{label}</Label>
                    </div>
                    <Switch
                      checked={policy[key]}
                      onCheckedChange={(v) => updateField(key, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Session Policy */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{isRTL ? "سياسة الجلسات" : "Session Policy"}</CardTitle>
              </div>
              <CardDescription>{isRTL ? "التحكم في مهلة الجلسات وإدارة الوصول" : "Control session timeout and access management"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{isRTL ? "مهلة انتهاء الجلسة (دقائق)" : "Session Timeout (min)"}</Label>
                  <span className="text-sm font-bold tabular-nums text-primary">{policy.session_timeout_minutes}</span>
                </div>
                <Slider
                  value={[policy.session_timeout_minutes]}
                  onValueChange={([v]) => updateField("session_timeout_minutes", v)}
                  min={5}
                  max={480}
                  step={5}
                />
                <p className="text-[11px] text-muted-foreground">
                  {isRTL
                    ? `${Math.floor(policy.session_timeout_minutes / 60)} ساعة و ${policy.session_timeout_minutes % 60} دقيقة`
                    : `${Math.floor(policy.session_timeout_minutes / 60)}h ${policy.session_timeout_minutes % 60}m`}
                </p>
              </div>

              <Separator />

              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LogOut className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    {isRTL ? "تسجيل خروج جميع المستخدمين" : "Force Logout All Users"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {isRTL ? "سيتم إنهاء جميع الجلسات النشطة فوراً" : "All active sessions will be terminated immediately"}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => toast.info(isRTL ? "هذه الميزة قيد التطوير" : "This feature is coming soon")}
                >
                  <LogOut className="h-3.5 w-3.5 me-1.5" />
                  {isRTL ? "تسجيل خروج الجميع" : "Force Logout All"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Retention */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="lg:col-span-2">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">{isRTL ? "سياسة الاحتفاظ بالبيانات" : "Data Retention Policy"}</CardTitle>
              </div>
              <CardDescription>{isRTL ? "تحديد فترة الاحتفاظ بالسجلات التشغيلية" : "Define how long operational logs are retained"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">{isRTL ? "سجلات التدقيق (أيام)" : "Audit Logs (days)"}</Label>
                  <Input
                    type="number"
                    value={policy.audit_retention_days}
                    onChange={(e) => updateField("audit_retention_days", parseInt(e.target.value) || 365)}
                    min={30}
                    max={3650}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL ? `≈ ${(policy.audit_retention_days / 365).toFixed(1)} سنة` : `≈ ${(policy.audit_retention_days / 365).toFixed(1)} years`}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{isRTL ? "سجلات Webhooks (أيام)" : "Webhook Logs (days)"}</Label>
                  <Input
                    type="number"
                    value={policy.webhook_retention_days}
                    onChange={(e) => updateField("webhook_retention_days", parseInt(e.target.value) || 90)}
                    min={7}
                    max={365}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL ? `≈ ${(policy.webhook_retention_days / 30).toFixed(0)} شهر` : `≈ ${(policy.webhook_retention_days / 30).toFixed(0)} months`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default EnterpriseSecurityPolicies;
