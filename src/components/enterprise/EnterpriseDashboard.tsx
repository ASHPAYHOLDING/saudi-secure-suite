import { useEffect, useState } from "react";
import { Shield, Users, Activity, AlertTriangle, Settings, Lock, Clock, Globe, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface EnterpriseStats {
  activeUsers: number;
  activeSessions: number;
  securityAlerts: number;
  failedLogins: number;
}

interface EnterpriseSettingsData {
  enforce_ip_restrictions: boolean;
  password_rotation_days: number;
  session_timeout_minutes: number;
  allow_multiple_sessions: boolean;
}

const premiumFadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const EnterpriseDashboard = () => {
  const { tenantId } = useAuth();
  const { t, isRTL } = useLanguage();
  const [stats, setStats] = useState<EnterpriseStats>({
    activeUsers: 0,
    activeSessions: 0,
    securityAlerts: 0,
    failedLogins: 0,
  });
  const [settings, setSettings] = useState<EnterpriseSettingsData>({
    enforce_ip_restrictions: false,
    password_rotation_days: 90,
    session_timeout_minutes: 60,
    allow_multiple_sessions: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch active users count
        const { count: usersCount } = await supabase
          .from("tenant_members")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoDate = sevenDaysAgo.toISOString();

        // Fetch failed logins (last 7 days) — no tenant_id on login_attempts
        const { count: failedCount } = await supabase
          .from("login_attempts")
          .select("*", { count: "exact", head: true })
          .eq("success", false)
          .gte("attempted_at", isoDate);

        // Fetch security alerts from audit_logs
        const { count: alertsCount } = await supabase
          .from("audit_logs")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("created_at", isoDate);

        // Fetch enterprise settings
        const { data: settingsData } = await supabase
          .from("enterprise_settings")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        setStats({
          activeUsers: usersCount ?? 0,
          activeSessions: usersCount ?? 0, // approximate
          securityAlerts: alertsCount ?? 0,
          failedLogins: failedCount ?? 0,
        });

        if (settingsData) {
          setSettings({
            enforce_ip_restrictions: settingsData.enforce_ip_restrictions,
            password_rotation_days: settingsData.password_rotation_days,
            session_timeout_minutes: settingsData.session_timeout_minutes,
            allow_multiple_sessions: settingsData.allow_multiple_sessions,
          });
        }
      } catch (err) {
        console.error("Enterprise dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenantId]);

  const saveSettings = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("enterprise_settings")
        .upsert(
          { tenant_id: tenantId, ...settings },
          { onConflict: "tenant_id" }
        );
      if (error) throw error;
      toast.success(isRTL ? "تم حفظ إعدادات المؤسسة" : "Enterprise settings saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const kpis = [
    {
      label: isRTL ? "المستخدمون النشطون" : "Active Users",
      value: stats.activeUsers,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: isRTL ? "الجلسات النشطة" : "Active Sessions",
      value: stats.activeSessions,
      icon: Activity,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: isRTL ? "تنبيهات الأمان (7 أيام)" : "Security Alerts (7d)",
      value: stats.securityAlerts,
      icon: AlertTriangle,
      color: stats.securityAlerts > 0 ? "text-amber-400" : "text-emerald-400",
      bgColor: stats.securityAlerts > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      label: isRTL ? "محاولات دخول فاشلة" : "Failed Login Attempts",
      value: stats.failedLogins,
      icon: Shield,
      color: stats.failedLogins > 5 ? "text-red-400" : "text-muted-foreground",
      bgColor: stats.failedLogins > 5 ? "bg-red-500/10" : "bg-muted/50",
    },
  ];

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 enterprise-shadow">
            <Building2 className="h-5.5 w-5.5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {isRTL ? "مركز حوكمة المؤسسة" : "Enterprise Governance Center"}
              </h1>
              <Badge className="enterprise-indicator border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                Enterprise Edition
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "إدارة السياسات الأمنية والجلسات والوصول" : "Manage security policies, sessions, and access controls"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            variants={premiumFadeUp}
            initial="initial"
            animate="animate"
            transition={{ delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="enterprise-card">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.bgColor}`}>
                  <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums">{loading ? "—" : kpi.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="policies" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="policies" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            {isRTL ? "السياسات" : "Policies"}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {isRTL ? "الجلسات" : "Sessions"}
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            {isRTL ? "الوصول" : "Access"}
          </TabsTrigger>
          <TabsTrigger value="ip" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {isRTL ? "IP" : "IP"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? "سياسات الأمان" : "Security Policies"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{isRTL ? "تدوير كلمة المرور (أيام)" : "Password Rotation (days)"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "إجبار تغيير كلمة المرور كل فترة" : "Force password change periodically"}
                  </p>
                </div>
                <Input
                  type="number"
                  value={settings.password_rotation_days}
                  onChange={(e) => setSettings((s) => ({ ...s, password_rotation_days: parseInt(e.target.value) || 90 }))}
                  className="w-24"
                  min={7}
                  max={365}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{isRTL ? "مهلة انتهاء الجلسة (دقائق)" : "Session Timeout (min)"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "إنهاء الجلسة بعد فترة خمول" : "End session after inactivity"}
                  </p>
                </div>
                <Input
                  type="number"
                  value={settings.session_timeout_minutes}
                  onChange={(e) => setSettings((s) => ({ ...s, session_timeout_minutes: parseInt(e.target.value) || 60 }))}
                  className="w-24"
                  min={5}
                  max={480}
                />
              </div>
              <Separator />
              <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto">
                {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ السياسات" : "Save Policies")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? "إدارة الجلسات" : "Session Management"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{isRTL ? "السماح بجلسات متعددة" : "Allow Multiple Sessions"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "السماح بتسجيل الدخول من عدة أجهزة" : "Allow login from multiple devices"}
                  </p>
                </div>
                <Switch
                  checked={settings.allow_multiple_sessions}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, allow_multiple_sessions: v }))}
                />
              </div>
              <Separator />
              <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto">
                {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ الإعدادات" : "Save Settings")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? "التحكم المتقدم بالوصول" : "Advanced Access Control"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "راجع صلاحيات الفريق وسياسات الوصول من صفحة إدارة الصلاحيات."
                  : "Review team permissions and access policies from the Permissions page."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isRTL ? "تقييد عناوين IP" : "IP Restrictions"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{isRTL ? "تفعيل تقييد IP" : "Enable IP Restrictions"}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "السماح بالوصول فقط من عناوين محددة" : "Only allow access from specific IPs"}
                  </p>
                </div>
                <Switch
                  checked={settings.enforce_ip_restrictions}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, enforce_ip_restrictions: v }))}
                />
              </div>
              <Separator />
              <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto">
                {saving ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ الإعدادات" : "Save Settings")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnterpriseDashboard;
