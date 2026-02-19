import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Clock,
  Gauge, Bell, BellOff, Zap, Database, Mail, Wallet, FileWarning,
  TrendingUp, TrendingDown, Shield, Plus, ExternalLink, Megaphone,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area,
} from "recharts";

type TimeRange = "1h" | "6h" | "24h" | "7d";

const TIME_LABELS: Record<TimeRange, string> = {
  "1h": "ساعة",
  "6h": "6 ساعات",
  "24h": "24 ساعة",
  "7d": "7 أيام",
};

function timeRangeToDate(range: TimeRange): string {
  const now = new Date();
  if (range === "1h") now.setHours(now.getHours() - 1);
  else if (range === "6h") now.setHours(now.getHours() - 6);
  else if (range === "24h") now.setDate(now.getDate() - 1);
  else now.setDate(now.getDate() - 7);
  return now.toISOString();
}

interface LatencyPercentiles {
  p50: number; p95: number; p99: number; avg: number; max: number;
  total_requests: number; error_count: number; error_rate: number;
}

interface FunctionLatency {
  function_name: string; total_requests: number; avg_ms: number;
  p50_ms: number; p95_ms: number; max_ms: number; errors: number; error_rate: number;
}

interface AlertRule {
  id: string; name: string; metric_source: string; metric_name: string;
  condition: string; threshold: number; window_minutes: number;
  is_active: boolean; severity: string;
}

interface MonitoringAlert {
  id: string; metric_source: string; metric_name: string;
  current_value: number; threshold: number; severity: string;
  message: string; is_resolved: boolean; fired_at: string;
}

type ServiceHealth = "healthy" | "degraded" | "down";

interface ServiceStatus {
  name: string;
  nameAr: string;
  icon: React.ElementType;
  health: ServiceHealth;
  latencyMs: number;
  errorRate: number;
  requestCount: number;
}

const AdminMonitoring = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [latency, setLatency] = useState<LatencyPercentiles | null>(null);
  const [functionBreakdown, setFunctionBreakdown] = useState<FunctionLatency[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [emailStats, setEmailStats] = useState({ total: 0, failed: 0, rate: 0 });
  const [walletStats, setWalletStats] = useState({ total: 0, failed: 0, rate: 0 });
  const [incidents, setIncidents] = useState<any[]>([]);
  const [showCreateIncident, setShowCreateIncident] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: "", title_ar: "", severity: "minor", description_ar: "" });

  const fetchData = useCallback(async () => {
    try {
      const since = timeRangeToDate(timeRange);

      // Parallel: latency percentiles, function breakdown, alert rules, active alerts, email/wallet stats
      const [latencyRes, funcRes, rulesRes, alertsRes, emailRes, walletRes] = await Promise.all([
        supabase.rpc("get_edge_latency_percentiles", { _since: since }),
        supabase.rpc("get_edge_latency_by_function", { _since: since }),
        supabase.from("monitoring_alert_rules").select("*").order("created_at"),
        supabase.from("monitoring_alerts").select("*").order("fired_at", { ascending: false }).limit(50),
        supabase.from("email_logs").select("id, status").gte("created_at", since),
        supabase.from("wallet_transactions" as any).select("id, status").gte("created_at", since),
      ]);

      if (latencyRes.data) setLatency(latencyRes.data as any);
      if (funcRes.data) setFunctionBreakdown((funcRes.data as any) || []);
      if (rulesRes.data) setAlertRules(rulesRes.data as any);
      if (alertsRes.data) setAlerts(alertsRes.data as any);

      // Email stats
      const emails = emailRes.data || [];
      const emailFailed = emails.filter((e: any) => e.status === "failed").length;
      setEmailStats({
        total: emails.length,
        failed: emailFailed,
        rate: emails.length > 0 ? Math.round((emailFailed / emails.length) * 100 * 10) / 10 : 0,
      });

      // Wallet stats
      const walletTxs = (walletRes.data as any[]) || [];
      const walletFailed = walletTxs.filter((t: any) => t.status === "failed").length;
      setWalletStats({
        total: walletTxs.length,
        failed: walletFailed,
        rate: walletTxs.length > 0 ? Math.round((walletFailed / walletTxs.length) * 100 * 10) / 10 : 0,
      });

      // Build service health
      const latData = latencyRes.data as any;
      const buildHealth = (errorRate: number, latencyP95: number): ServiceHealth => {
        if (errorRate > 5 || latencyP95 > 3000) return "down";
        if (errorRate > 2 || latencyP95 > 1500) return "degraded";
        return "healthy";
      };

      setServices([
        {
          name: "Edge Functions", nameAr: "الدوال البرمجية", icon: Zap,
          health: latData ? buildHealth(latData.error_rate || 0, latData.p95 || 0) : "healthy",
          latencyMs: latData?.p95 || 0, errorRate: latData?.error_rate || 0,
          requestCount: latData?.total_requests || 0,
        },
        {
          name: "Database", nameAr: "قاعدة البيانات", icon: Database,
          health: "healthy", latencyMs: 0, errorRate: 0, requestCount: 0,
        },
        {
          name: "Email", nameAr: "البريد الإلكتروني", icon: Mail,
          health: buildHealth(emailFailed > 0 ? (emailFailed / Math.max(emails.length, 1)) * 100 : 0, 0),
          latencyMs: 0, errorRate: emails.length > 0 ? Math.round((emailFailed / emails.length) * 100 * 10) / 10 : 0,
          requestCount: emails.length,
        },
        {
          name: "Wallet", nameAr: "المحفظة", icon: Wallet,
          health: buildHealth(walletTxs.length > 0 ? (walletFailed / walletTxs.length) * 100 : 0, 0),
          latencyMs: 0, errorRate: walletStats.rate,
          requestCount: walletTxs.length,
        },
        {
          name: "ZATCA", nameAr: "زاتكا", icon: FileWarning,
          health: "healthy", latencyMs: 0, errorRate: 0, requestCount: 0,
        },
      ]);

      // Incidents
      const incRes = await supabase
        .from("platform_incidents")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      setIncidents((incRes.data as any[]) || []);
    } catch (err) {
      console.error("Monitoring fetch error", err);
      toast.error("فشل تحميل بيانات المراقبة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const toggleRule = async (ruleId: string, active: boolean) => {
    await supabase.from("monitoring_alert_rules").update({ is_active: active }).eq("id", ruleId);
    setAlertRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, is_active: active } : r));
    toast.success(active ? "تم تفعيل التنبيه" : "تم تعطيل التنبيه");
  };

  const resolveAlert = async (alertId: string) => {
    await supabase.from("monitoring_alerts").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", alertId);
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, is_resolved: true } : a));
    toast.success("تم حل التنبيه");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const unresolvedAlerts = alerts.filter((a) => !a.is_resolved);

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            مركز المراقبة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">مراقبة الأداء والأخطاء والتنبيهات في الوقت الفعلي</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {Object.entries(TIME_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 me-1 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <a href="/status" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              صفحة Status
            </Button>
          </a>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {unresolvedAlerts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-5 w-5 text-destructive animate-pulse" />
              <span className="font-semibold text-destructive">{unresolvedAlerts.length} تنبيه نشط</span>
            </div>
            <div className="space-y-2">
              {unresolvedAlerts.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-background/80 rounded-lg p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>
                      {a.severity === "critical" ? "حرج" : "تحذير"}
                    </Badge>
                    <span>{a.message}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => resolveAlert(a.id)}>حل</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Health Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {services.map((svc) => (
          <ServiceHealthCard key={svc.name} service={svc} />
        ))}
      </div>

      {/* Latency KPIs */}
      {latency && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <LatencyKPI label="p50" value={latency.p50} unit="ms" />
          <LatencyKPI label="p95" value={latency.p95} unit="ms" warn={latency.p95 > 1500} critical={latency.p95 > 3000} />
          <LatencyKPI label="معدل الخطأ" value={latency.error_rate} unit="%" warn={latency.error_rate > 2} critical={latency.error_rate > 5} />
          <LatencyKPI label="إجمالي الطلبات" value={latency.total_requests} unit="" />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="functions" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="functions">⚡ الدوال البرمجية</TabsTrigger>
          <TabsTrigger value="services">🏥 صحة الخدمات</TabsTrigger>
          <TabsTrigger value="alerts">🔔 التنبيهات</TabsTrigger>
          <TabsTrigger value="rules">⚙️ قواعد التنبيه</TabsTrigger>
          <TabsTrigger value="incidents">📢 الحوادث</TabsTrigger>
        </TabsList>

        {/* Functions Tab */}
        <TabsContent value="functions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أداء الدوال البرمجية — تفصيل لكل Function</CardTitle>
            </CardHeader>
            <CardContent>
              {functionBreakdown.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-start">Function</TableHead>
                          <TableHead className="text-start">الطلبات</TableHead>
                          <TableHead className="text-start">p50</TableHead>
                          <TableHead className="text-start">p95</TableHead>
                          <TableHead className="text-start">Max</TableHead>
                          <TableHead className="text-start">أخطاء</TableHead>
                          <TableHead className="text-start">%خطأ</TableHead>
                          <TableHead className="text-start">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {functionBreakdown.map((fn) => (
                          <TableRow key={fn.function_name}>
                            <TableCell className="font-mono text-xs">{fn.function_name}</TableCell>
                            <TableCell dir="ltr" className="text-start">{fn.total_requests}</TableCell>
                            <TableCell dir="ltr" className="text-start">{fn.p50_ms}ms</TableCell>
                            <TableCell dir="ltr" className="text-start">
                              <span className={fn.p95_ms > 3000 ? "text-destructive font-bold" : fn.p95_ms > 1500 ? "text-yellow-600" : ""}>
                                {fn.p95_ms}ms
                              </span>
                            </TableCell>
                            <TableCell dir="ltr" className="text-start">{fn.max_ms}ms</TableCell>
                            <TableCell dir="ltr" className="text-start">{fn.errors}</TableCell>
                            <TableCell dir="ltr" className="text-start">
                              <span className={fn.error_rate > 5 ? "text-destructive font-bold" : fn.error_rate > 2 ? "text-yellow-600" : ""}>
                                {fn.error_rate}%
                              </span>
                            </TableCell>
                            <TableCell>
                              <HealthBadge health={fn.error_rate > 5 || fn.p95_ms > 3000 ? "down" : fn.error_rate > 2 || fn.p95_ms > 1500 ? "degraded" : "healthy"} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Chart */}
                  <div className="mt-4 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={functionBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="function_name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: "ms", position: "insideLeft" }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="p50_ms" name="p50" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="p95_ms" name="p95" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <EmptyState text="لا توجد بيانات أداء حالياً" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">📧 البريد الإلكتروني</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-2xl font-bold text-foreground">{emailStats.total}</p><p className="text-xs text-muted-foreground">الإجمالي</p></div>
                  <div><p className="text-2xl font-bold text-destructive">{emailStats.failed}</p><p className="text-xs text-muted-foreground">فشل</p></div>
                  <div>
                    <p className={`text-2xl font-bold ${emailStats.rate > 5 ? "text-destructive" : "text-green-600"}`}>{emailStats.rate}%</p>
                    <p className="text-xs text-muted-foreground">نسبة الفشل</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">💰 المحفظة</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-2xl font-bold text-foreground">{walletStats.total}</p><p className="text-xs text-muted-foreground">الإجمالي</p></div>
                  <div><p className="text-2xl font-bold text-destructive">{walletStats.failed}</p><p className="text-xs text-muted-foreground">فشل</p></div>
                  <div>
                    <p className={`text-2xl font-bold ${walletStats.rate > 2 ? "text-destructive" : "text-green-600"}`}>{walletStats.rate}%</p>
                    <p className="text-xs text-muted-foreground">نسبة الفشل</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts History Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">سجل التنبيهات</CardTitle></CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">الوقت</TableHead>
                        <TableHead className="text-start">الخطورة</TableHead>
                        <TableHead className="text-start">الرسالة</TableHead>
                        <TableHead className="text-start">القيمة</TableHead>
                        <TableHead className="text-start">الحد</TableHead>
                        <TableHead className="text-start">الحالة</TableHead>
                        <TableHead className="text-start">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((a) => (
                        <TableRow key={a.id} className={!a.is_resolved ? "bg-destructive/5" : ""}>
                          <TableCell className="text-xs whitespace-nowrap" dir="ltr">{new Date(a.fired_at).toLocaleString("ar-SA")}</TableCell>
                          <TableCell>
                            <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>
                              {a.severity === "critical" ? "حرج" : "تحذير"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{a.message}</TableCell>
                          <TableCell dir="ltr" className="text-start font-mono">{a.current_value}</TableCell>
                          <TableCell dir="ltr" className="text-start font-mono">{a.threshold}</TableCell>
                          <TableCell>
                            {a.is_resolved
                              ? <Badge variant="outline" className="text-green-600">محلول</Badge>
                              : <Badge variant="destructive">نشط</Badge>
                            }
                          </TableCell>
                          <TableCell>
                            {!a.is_resolved && (
                              <Button size="sm" variant="ghost" onClick={() => resolveAlert(a.id)}>حل</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState text="لا توجد تنبيهات 🎉" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">قواعد التنبيه التلقائي</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${rule.is_active ? "bg-green-500" : "bg-muted"}`} />
                      <div>
                        <p className="text-sm font-medium">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rule.metric_source} → {rule.metric_name} {rule.condition === "gt" ? ">" : "<"} {rule.threshold}
                          {" "}(كل {rule.window_minutes} دقيقة)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={rule.severity === "critical" ? "destructive" : "secondary"}>
                        {rule.severity === "critical" ? "حرج" : "تحذير"}
                      </Badge>
                      <Switch checked={rule.is_active} onCheckedChange={(v) => toggleRule(rule.id, v)} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                إدارة الحوادث
              </CardTitle>
              <Button size="sm" onClick={() => setShowCreateIncident(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                حادثة جديدة
              </Button>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <EmptyState text="لا توجد حوادث مسجلة" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">الخطورة</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">البداية</TableHead>
                      <TableHead className="text-right">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((inc) => (
                      <TableRow key={inc.id}>
                        <TableCell className="font-medium text-sm">{inc.title_ar || inc.title}</TableCell>
                        <TableCell>
                          <Badge variant={inc.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                            {inc.severity === "critical" ? "حرج" : inc.severity === "major" ? "كبير" : "طفيف"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {inc.status === "resolved" ? "تم الحل" : inc.status === "investigating" ? "قيد التحقيق" : inc.status === "identified" ? "تم التحديد" : "مراقبة"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">
                          {new Date(inc.started_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell>
                          {inc.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={async () => {
                                await supabase.from("platform_incidents").update({
                                  status: "resolved",
                                  resolved_at: new Date().toISOString(),
                                }).eq("id", inc.id);
                                toast.success("تم حل الحادثة");
                                fetchData();
                              }}
                            >
                              حل
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Incident Dialog */}
      <Dialog open={showCreateIncident} onOpenChange={setShowCreateIncident}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء حادثة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان (عربي)</Label>
              <Input value={newIncident.title_ar} onChange={(e) => setNewIncident({ ...newIncident, title_ar: e.target.value })} />
            </div>
            <div>
              <Label>Title (English)</Label>
              <Input value={newIncident.title} onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={newIncident.description_ar} onChange={(e) => setNewIncident({ ...newIncident, description_ar: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>الخطورة</Label>
              <Select value={newIncident.severity} onValueChange={(v) => setNewIncident({ ...newIncident, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="minor">طفيف</SelectItem>
                  <SelectItem value="major">كبير</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!newIncident.title_ar.trim() || !newIncident.title.trim()}
              onClick={async () => {
                await supabase.from("platform_incidents").insert({
                  title: newIncident.title,
                  title_ar: newIncident.title_ar,
                  severity: newIncident.severity,
                  description_ar: newIncident.description_ar || null,
                });
                toast.success("تم إنشاء الحادثة");
                setShowCreateIncident(false);
                setNewIncident({ title: "", title_ar: "", severity: "minor", description_ar: "" });
                fetchData();
              }}
            >
              إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Sub-components ───

function ServiceHealthCard({ service }: { service: ServiceStatus }) {
  const Icon = service.icon;
  const colors: Record<ServiceHealth, string> = {
    healthy: "border-green-500/30 bg-green-500/5",
    degraded: "border-yellow-500/30 bg-yellow-500/5",
    down: "border-destructive/30 bg-destructive/5",
  };
  return (
    <Card className={`${colors[service.health]} border`}>
      <CardContent className="pt-3 pb-2 px-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium truncate">{service.nameAr}</span>
        </div>
        <HealthBadge health={service.health} />
        {service.requestCount > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">{service.requestCount} طلب</p>
        )}
      </CardContent>
    </Card>
  );
}

function HealthBadge({ health }: { health: ServiceHealth }) {
  if (health === "healthy") return <Badge className="bg-green-600/20 text-green-700 border-0 text-[10px]"><CheckCircle className="h-3 w-3 me-1" />سليم</Badge>;
  if (health === "degraded") return <Badge className="bg-yellow-500/20 text-yellow-700 border-0 text-[10px]"><Clock className="h-3 w-3 me-1" />متأثر</Badge>;
  return <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 me-1" />معطل</Badge>;
}

function LatencyKPI({ label, value, unit, warn, critical }: { label: string; value: number; unit: string; warn?: boolean; critical?: boolean }) {
  const color = critical ? "text-destructive" : warn ? "text-yellow-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>
          {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
          <span className="text-sm font-normal text-muted-foreground ms-1">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <CheckCircle className="h-10 w-10 mb-2 text-green-500" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export default AdminMonitoring;
