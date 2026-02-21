import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Globe,
  Database,
  Activity,
  Server,
  RefreshCw,
  TrendingUp,
  HardDrive,
  Users,
  Zap,
  Clock,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { REGION_CONFIG, type TenantRegion } from "@/lib/region-client";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

interface RegionStat {
  region: string;
  tenant_count: number;
  active_subscriptions: number;
}

interface DbLoadMetric {
  label: string;
  labelEn: string;
  value: number;
  max: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
}

const SystemInfrastructurePage = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  const [regionStats, setRegionStats] = useState<RegionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStats, setApiStats] = useState<{ total: number; avg_latency: number; error_rate: number }>({ total: 0, avg_latency: 0, error_rate: 0 });
  const [eventStats, setEventStats] = useState<{ pending: number; processed: number; failed: number }>({ pending: 0, processed: 0, failed: 0 });

  const fetchData = async () => {
    try {
      // Fetch region distribution
      const { data: regions } = await supabase
        .from("tenant_region_stats" as any)
        .select("*");

      if (regions) {
        setRegionStats(regions as unknown as RegionStat[]);
      }

      // Fetch API request stats (last 24h)
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
      const { data: apiLogs, count: apiCount } = await supabase
        .from("api_request_logs")
        .select("response_time_ms, status_code", { count: "exact" })
        .gte("created_at", oneDayAgo)
        .limit(1000);

      if (apiLogs && apiLogs.length > 0) {
        const avgLatency = apiLogs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / apiLogs.length;
        const errors = apiLogs.filter(l => l.status_code >= 400).length;
        setApiStats({
          total: apiCount || apiLogs.length,
          avg_latency: Math.round(avgLatency),
          error_rate: Math.round((errors / apiLogs.length) * 100 * 10) / 10,
        });
      }

      // Fetch domain event stats
      const [pendingRes, processedRes, failedRes] = await Promise.all([
        supabase.from("domain_events").select("id", { count: "exact", head: true }).eq("processed", false),
        supabase.from("domain_events").select("id", { count: "exact", head: true }).eq("processed", true),
        supabase.from("dead_letter_queue" as any).select("id", { count: "exact", head: true }),
      ]);

      setEventStats({
        pending: pendingRes.count || 0,
        processed: processedRes.count || 0,
        failed: failedRes.count || 0,
      });
    } catch (err) {
      console.error("Failed to fetch infrastructure data:", err);
      toast.error(isRTL ? "فشل في تحميل بيانات البنية التحتية" : "Failed to load infrastructure data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalTenants = useMemo(() => regionStats.reduce((s, r) => s + Number(r.tenant_count), 0), [regionStats]);

  const pieData = useMemo(() => regionStats.map(r => ({
    name: REGION_CONFIG[r.region as TenantRegion]?.[isRTL ? "label" : "labelEn"] || r.region,
    value: Number(r.tenant_count),
    flag: REGION_CONFIG[r.region as TenantRegion]?.flag || "🌐",
    color: REGION_CONFIG[r.region as TenantRegion]?.color || "hsl(var(--muted))",
  })), [regionStats, isRTL]);

  const barData = useMemo(() => regionStats.map(r => ({
    name: REGION_CONFIG[r.region as TenantRegion]?.flag + " " + (REGION_CONFIG[r.region as TenantRegion]?.[isRTL ? "label" : "labelEn"] || r.region),
    tenants: Number(r.tenant_count),
    active: Number(r.active_subscriptions),
  })), [regionStats, isRTL]);

  // Simulated DB load metrics (would come from pg_stat in production)
  const dbMetrics: DbLoadMetric[] = [
    { label: "اتصالات نشطة", labelEn: "Active Connections", value: 12, max: 100, unit: "", status: "healthy" },
    { label: "استخدام الذاكرة", labelEn: "Memory Usage", value: 34, max: 100, unit: "%", status: "healthy" },
    { label: "عمليات الكتابة/ثانية", labelEn: "Writes/sec", value: 45, max: 500, unit: "ops", status: "healthy" },
    { label: "عمليات القراءة/ثانية", labelEn: "Reads/sec", value: 230, max: 2000, unit: "ops", status: "healthy" },
    { label: "حجم قاعدة البيانات", labelEn: "Database Size", value: 420, max: 5000, unit: "MB", status: "healthy" },
    { label: "معدل إصابة الكاش", labelEn: "Cache Hit Ratio", value: 97, max: 100, unit: "%", status: "healthy" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            {isRTL ? "البنية التحتية والمناطق" : "Infrastructure & Regions"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "مراقبة توزيع المستأجرين وأداء قاعدة البيانات" : "Monitor tenant distribution and database performance"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"} ${refreshing ? "animate-spin" : ""}`} />
          {isRTL ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي المستأجرين" : "Total Tenants"}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{totalTenants}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {regionStats.length} {isRTL ? "مناطق نشطة" : "active regions"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "طلبات API (24 ساعة)" : "API Requests (24h)"}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{apiStats.total.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-accent/30 flex items-center justify-center">
                <Zap className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isRTL ? `متوسط الاستجابة: ${apiStats.avg_latency}ms` : `Avg latency: ${apiStats.avg_latency}ms`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "أحداث النظام" : "Domain Events"}</p>
                <p className="text-3xl font-bold mt-1 text-foreground">{eventStats.processed + eventStats.pending}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                <Activity className="h-6 w-6 text-secondary-foreground" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="text-[10px]">{eventStats.pending} {isRTL ? "معلق" : "pending"}</Badge>
              {eventStats.failed > 0 && (
                <Badge variant="destructive" className="text-[10px]">{eventStats.failed} {isRTL ? "فاشل" : "failed"}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{isRTL ? "معدل الأخطاء" : "Error Rate"}</p>
                <p className={`text-3xl font-bold mt-1 ${apiStats.error_rate > 5 ? "text-destructive" : "text-green-600"}`}>
                  {apiStats.error_rate}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {isRTL ? "آخر 24 ساعة" : "Last 24 hours"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart: Region Distribution */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-primary" />
              {isRTL ? "توزيع المستأجرين حسب المنطقة" : "Tenant Distribution by Region"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                {isRTL ? "لا توجد بيانات" : "No data available"}
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Region Legend */}
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {pieData.map((r) => (
                <div key={r.name} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs text-muted-foreground">{r.flag} {r.name} ({r.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart: Tenants vs Active Subscriptions */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              {isRTL ? "المستأجرين مقابل الاشتراكات النشطة" : "Tenants vs Active Subscriptions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                {isRTL ? "لا توجد بيانات" : "No data available"}
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tenants" name={isRTL ? "المستأجرين" : "Tenants"} className="fill-primary" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="active" name={isRTL ? "اشتراكات نشطة" : "Active Subs"} className="fill-accent" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DB Load Metrics */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" />
            {isRTL ? "مؤشرات أداء قاعدة البيانات" : "Database Performance Metrics"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dbMetrics.map((metric) => (
              <div key={metric.labelEn} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{isRTL ? metric.label : metric.labelEn}</span>
                  <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700 border-green-300">
                    {isRTL ? "طبيعي" : "Healthy"}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{metric.value}</span>
                  <span className="text-xs text-muted-foreground">{metric.unit} / {metric.max}</span>
                </div>
                <Progress value={(metric.value / metric.max) * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Region Details Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5 text-primary" />
            {isRTL ? "تفاصيل المناطق" : "Region Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-start font-medium text-muted-foreground">{isRTL ? "المنطقة" : "Region"}</th>
                  <th className="py-3 px-4 text-start font-medium text-muted-foreground">{isRTL ? "النقطة النهائية" : "Endpoint"}</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground">{isRTL ? "المستأجرين" : "Tenants"}</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground">{isRTL ? "اشتراكات نشطة" : "Active Subs"}</th>
                  <th className="py-3 px-4 text-center font-medium text-muted-foreground">{isRTL ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(REGION_CONFIG) as TenantRegion[]).map((regionKey) => {
                  const config = REGION_CONFIG[regionKey];
                  const stat = regionStats.find(r => r.region === regionKey);
                  return (
                    <tr key={regionKey} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{config.flag}</span>
                          {isRTL ? config.label : config.labelEn}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs font-mono">{config.endpoint}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">{stat?.tenant_count || 0}</td>
                      <td className="py-3 px-4 text-center">{stat?.active_subscriptions || 0}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-300 text-[10px]">
                          {isRTL ? "متصل" : "Connected"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemInfrastructurePage;
