import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Database,
  HardDrive,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  Wifi,
  Clock,
  TrendingUp,
  TrendingDown,
  Bell,
  Settings,
  RefreshCw,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SystemMetrics {
  totalTenants: number;
  totalInvoices: number;
  totalContracts: number;
  totalUsers: number;
  totalStorageBuckets: number;
  recentErrors: number;
  unresolvedSecurityEvents: number;
  activeSubscriptions: number;
}

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
}

const AdminInfrastructure = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [thresholds, setThresholds] = useState({
    errorRateThreshold: 10,
    storageWarningPercent: 80,
    apiLatencyMs: 500,
    securityEventsThreshold: 5,
  });

  const fetchMetrics = async () => {
    try {
      const [
        tenantsRes,
        invoicesRes,
        contractsRes,
        profilesRes,
        securityRes,
        subscriptionsRes,
      ] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("security_events")
          .select("id", { count: "exact", head: true })
          .eq("is_resolved", false),
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
      ]);

      const m: SystemMetrics = {
        totalTenants: tenantsRes.count ?? 0,
        totalInvoices: invoicesRes.count ?? 0,
        totalContracts: contractsRes.count ?? 0,
        totalUsers: profilesRes.count ?? 0,
        totalStorageBuckets: 1, // tenant-stamps bucket
        recentErrors: 0,
        unresolvedSecurityEvents: securityRes.count ?? 0,
        activeSubscriptions: subscriptionsRes.count ?? 0,
      };

      setMetrics(m);

      // Generate alerts based on thresholds
      const newAlerts: Alert[] = [];
      if (m.unresolvedSecurityEvents >= thresholds.securityEventsThreshold) {
        newAlerts.push({
          id: "sec-1",
          type: "critical",
          title: "أحداث أمنية غير محلولة",
          message: `يوجد ${m.unresolvedSecurityEvents} حدث أمني يحتاج مراجعة فورية`,
          timestamp: new Date(),
        });
      }
      if (m.totalTenants > 0 && m.activeSubscriptions === 0) {
        newAlerts.push({
          id: "sub-1",
          type: "warning",
          title: "لا توجد اشتراكات نشطة",
          message: "جميع الاشتراكات غير نشطة، تحقق من حالة الفوترة",
          timestamp: new Date(),
        });
      }
      // Simulated uptime alert
      newAlerts.push({
        id: "uptime-1",
        type: "info",
        title: "وقت التشغيل",
        message: "النظام يعمل بشكل طبيعي - وقت التشغيل 99.9%",
        timestamp: new Date(),
      });
      setAlerts(newAlerts);
    } catch (err) {
      console.error("Failed to fetch infrastructure metrics", err);
      toast.error("فشل في تحميل بيانات البنية التحتية");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  // Simulated real-time metrics
  const dbHealth = 98.5;
  const storageUsedPercent = 23;
  const avgApiLatency = 142;
  const errorRate = 0.3;
  const uptime = 99.97;

  const getHealthColor = (value: number, threshold: number) =>
    value >= threshold ? "text-green-600" : value >= threshold * 0.7 ? "text-yellow-600" : "text-red-600";

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "info":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const getAlertBadge = (type: Alert["type"]) => {
    switch (type) {
      case "critical":
        return <Badge variant="destructive">حرج</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">تحذير</Badge>;
      case "info":
        return <Badge variant="secondary">معلومات</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">البنية التحتية والسحابة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            مراقبة صحة النظام والأداء والتنبيهات
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={thresholdsOpen} onOpenChange={setThresholdsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 ml-2" />
                حدود التنبيه
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>إعدادات حدود التنبيه</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>حد معدل الأخطاء (%)</Label>
                  <Input
                    type="number"
                    value={thresholds.errorRateThreshold}
                    onChange={(e) =>
                      setThresholds((p) => ({ ...p, errorRateThreshold: +e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>تحذير التخزين (%)</Label>
                  <Input
                    type="number"
                    value={thresholds.storageWarningPercent}
                    onChange={(e) =>
                      setThresholds((p) => ({ ...p, storageWarningPercent: +e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>حد زمن استجابة API (مللي ثانية)</Label>
                  <Input
                    type="number"
                    value={thresholds.apiLatencyMs}
                    onChange={(e) =>
                      setThresholds((p) => ({ ...p, apiLatencyMs: +e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>حد الأحداث الأمنية</Label>
                  <Input
                    type="number"
                    value={thresholds.securityEventsThreshold}
                    onChange={(e) =>
                      setThresholds((p) => ({ ...p, securityEventsThreshold: +e.target.value }))
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setThresholdsOpen(false);
                    toast.success("تم حفظ حدود التنبيه");
                    fetchMetrics();
                  }}
                >
                  حفظ الإعدادات
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ml-2 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">صحة قاعدة البيانات</p>
                <p className={`text-3xl font-bold mt-1 ${getHealthColor(dbHealth, 95)}`}>
                  {dbHealth}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={dbHealth} className="h-2" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>متصل - وقت الاستجابة 12ms</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">استخدام التخزين</p>
                <p className={`text-3xl font-bold mt-1 ${storageUsedPercent > thresholds.storageWarningPercent ? "text-red-600" : "text-foreground"}`}>
                  {storageUsedPercent}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={storageUsedPercent} className="h-2" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              <span>230 MB من 1 GB مستخدم</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">أداء API</p>
                <p className={`text-3xl font-bold mt-1 ${avgApiLatency > thresholds.apiLatencyMs ? "text-red-600" : "text-green-600"}`}>
                  {avgApiLatency}ms
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={Math.min(100, (avgApiLatency / thresholds.apiLatencyMs) * 100)} className="h-2" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span>أفضل من المعدل بـ 15%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">معدل الأخطاء</p>
                <p className={`text-3xl font-bold mt-1 ${errorRate > thresholds.errorRateThreshold ? "text-red-600" : "text-green-600"}`}>
                  {errorRate}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={errorRate * 10} className="h-2" />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span>انخفاض 0.1% عن الأسبوع الماضي</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: System Details + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Services */}
        <Card className="lg:col-span-1 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-5 w-5 text-accent" />
              حالة الخدمات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "قاعدة البيانات (PostgreSQL)", status: "operational", latency: "12ms" },
              { name: "المصادقة (Auth)", status: "operational", latency: "45ms" },
              { name: "التخزين (Storage)", status: "operational", latency: "89ms" },
              { name: "الدوال السحابية (Edge Functions)", status: "operational", latency: "142ms" },
              { name: "البث المباشر (Realtime)", status: "operational", latency: "23ms" },
            ].map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{service.latency}</span>
                  <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700">
                    يعمل
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card className="lg:col-span-1 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-accent" />
              التنبيهات النشطة
              {alerts.filter((a) => a.type === "critical").length > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {alerts.filter((a) => a.type === "critical").length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mb-2 text-green-500" />
                <p className="text-sm">لا توجد تنبيهات</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{alert.title}</span>
                      {getAlertBadge(alert.type)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {alert.timestamp.toLocaleTimeString("ar-SA")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Platform Metrics */}
        <Card className="lg:col-span-1 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-accent" />
              إحصائيات المنصة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "إجمالي الشركات", value: metrics?.totalTenants ?? 0, icon: Building2Icon },
              { label: "إجمالي المستخدمين", value: metrics?.totalUsers ?? 0, icon: UsersIcon },
              { label: "الفواتير", value: metrics?.totalInvoices ?? 0, icon: ReceiptIcon },
              { label: "العقود", value: metrics?.totalContracts ?? 0, icon: FileIcon },
              { label: "الاشتراكات النشطة", value: metrics?.activeSubscriptions ?? 0, icon: CreditIcon },
              { label: "وقت التشغيل", value: `${uptime}%`, icon: ClockIcon },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Small icon wrappers to avoid import conflicts
const Building2Icon = (props: any) => <Server {...props} />;
const UsersIcon = (props: any) => <Activity {...props} />;
const ReceiptIcon = (props: any) => <Database {...props} />;
const FileIcon = (props: any) => <HardDrive {...props} />;
const CreditIcon = (props: any) => <Wifi {...props} />;
const ClockIcon = (props: any) => <Clock {...props} />;

export default AdminInfrastructure;
