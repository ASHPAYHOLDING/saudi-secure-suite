import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, Download, Activity, Mail, AlertTriangle, Wallet,
  CheckCircle, XCircle, Clock, Server, Users, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  Legend,
} from "recharts";

type Period = "today" | "7days" | "30days";

function periodToDate(period: Period): string {
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
  } else if (period === "7days") {
    now.setDate(now.getDate() - 7);
  } else {
    now.setDate(now.getDate() - 30);
  }
  return now.toISOString();
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "اليوم",
  "7days": "آخر 7 أيام",
  "30days": "آخر 30 يوم",
};

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
];

interface HealthData {
  emailStats: { total: number; sent: number; failed: number; pending: number; byDay: { date: string; sent: number; failed: number }[] };
  clientErrors: { total: number; byRoute: { route: string; count: number }[]; byDay: { date: string; count: number }[] };
  walletStats: { total: number; success: number; failed: number; byDay: { date: string; success: number; failed: number }[] };
  tenantUsage: { tenant_id: string; tenant_name: string; invoices: number; expenses: number; users: number }[];
}

const AdminPlatformHealth = () => {
  const [period, setPeriod] = useState<Period>("7days");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const since = periodToDate(period);

      const [emailRes, emailFailRes, errorsRes, tenantsRes] = await Promise.all([
        supabase
          .from("email_logs")
          .select("id, status, sent_at, created_at")
          .gte("created_at", since),
        supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", since),
        supabase
          .from("client_errors")
          .select("id, route, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("tenants")
          .select("id, name")
          .limit(50),
      ]);

      // Process email stats
      const emails = emailRes.data || [];
      const emailByDay = new Map<string, { sent: number; failed: number }>();
      emails.forEach((e) => {
        const day = (e.created_at || "").slice(0, 10);
        const entry = emailByDay.get(day) || { sent: 0, failed: 0 };
        if (e.status === "sent" || e.status === "delivered") entry.sent++;
        else if (e.status === "failed") entry.failed++;
        emailByDay.set(day, entry);
      });

      const emailStats = {
        total: emails.length,
        sent: emails.filter((e) => e.status === "sent" || e.status === "delivered").length,
        failed: emailFailRes.count || 0,
        pending: emails.filter((e) => e.status === "pending" || e.status === "queued").length,
        byDay: Array.from(emailByDay.entries())
          .map(([date, v]) => ({ date, ...v }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };

      // Process client errors
      const errors = errorsRes.data || [];
      const routeMap = new Map<string, number>();
      const errorByDay = new Map<string, number>();
      errors.forEach((e) => {
        const r = e.route || "غير محدد";
        routeMap.set(r, (routeMap.get(r) || 0) + 1);
        const day = (e.created_at || "").slice(0, 10);
        errorByDay.set(day, (errorByDay.get(day) || 0) + 1);
      });

      const clientErrors = {
        total: errors.length,
        byRoute: Array.from(routeMap.entries())
          .map(([route, count]) => ({ route, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        byDay: Array.from(errorByDay.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };

      // Wallet stats — query wallet_transactions if it exists, otherwise use empty
      let walletStats = { total: 0, success: 0, failed: 0, byDay: [] as { date: string; success: number; failed: number }[] };
      try {
        const wtRes = await supabase
          .from("wallet_transactions" as any)
          .select("id, status, created_at")
          .gte("created_at", since)
          .limit(500);
        if (wtRes.data) {
          const wt = wtRes.data as any[];
          const wtByDay = new Map<string, { success: number; failed: number }>();
          wt.forEach((t: any) => {
            const day = (t.created_at || "").slice(0, 10);
            const entry = wtByDay.get(day) || { success: 0, failed: 0 };
            if (t.status === "completed" || t.status === "success") entry.success++;
            else if (t.status === "failed") entry.failed++;
            wtByDay.set(day, entry);
          });
          walletStats = {
            total: wt.length,
            success: wt.filter((t: any) => t.status === "completed" || t.status === "success").length,
            failed: wt.filter((t: any) => t.status === "failed").length,
            byDay: Array.from(wtByDay.entries())
              .map(([date, v]) => ({ date, ...v }))
              .sort((a, b) => a.date.localeCompare(b.date)),
          };
        }
      } catch (_) { /* table may not exist */ }

      // Tenant usage (non-sensitive aggregates only)
      const tenants = tenantsRes.data || [];
      const tenantUsage: HealthData["tenantUsage"] = [];
      for (const t of tenants.slice(0, 20)) {
        const [invRes, expRes, usrRes] = await Promise.all([
          supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("expenses").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("tenant_members" as any).select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        ]);
        tenantUsage.push({
          tenant_id: t.id.slice(0, 8) + "…",
          tenant_name: t.name || "—",
          invoices: invRes.count || 0,
          expenses: expRes.count || 0,
          users: usrRes.count || 0,
        });
      }
      tenantUsage.sort((a, b) => (b.invoices + b.expenses) - (a.invoices + a.expenses));

      setData({ emailStats, clientErrors, walletStats, tenantUsage });
    } catch (err) {
      console.error("Health fetch error", err);
      toast.error("فشل في تحميل بيانات صحة المنصة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // CSV export
  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["القسم", "المقياس", "القيمة"],
      ["البريد", "الإجمالي", data.emailStats.total],
      ["البريد", "مُرسل", data.emailStats.sent],
      ["البريد", "فاشل", data.emailStats.failed],
      ["البريد", "معلق", data.emailStats.pending],
      ["أخطاء العملاء", "الإجمالي", data.clientErrors.total],
      ["المحفظة", "الإجمالي", data.walletStats.total],
      ["المحفظة", "ناجح", data.walletStats.success],
      ["المحفظة", "فاشل", data.walletStats.failed],
      ...data.clientErrors.byRoute.map((r) => ["أخطاء — مسار", r.route, r.count]),
      ...data.tenantUsage.map((t) => [
        "استخدام المنشآت",
        t.tenant_name,
        `فواتير:${t.invoices} مصروفات:${t.expenses} مستخدمين:${t.users}`,
      ]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `platform-health-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير التقرير");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const emailSuccessRate = data.emailStats.total > 0
    ? ((data.emailStats.sent / data.emailStats.total) * 100).toFixed(1)
    : "100";

  const walletSuccessRate = data.walletStats.total > 0
    ? ((data.walletStats.success / data.walletStats.total) * 100).toFixed(1)
    : "100";

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">لوحة صحة المنصة</h1>
          <p className="text-sm text-muted-foreground mt-1">مراقبة شاملة للخدمات والأداء</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="7days">آخر 7 أيام</SelectItem>
              <SelectItem value="30days">آخر 30 يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 me-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 me-1 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPICard
          icon={Mail}
          label="نجاح البريد"
          value={`${emailSuccessRate}%`}
          sub={`${data.emailStats.sent}/${data.emailStats.total}`}
          color="text-blue-600"
          bgColor="bg-blue-500/10"
          status={Number(emailSuccessRate) >= 95 ? "good" : Number(emailSuccessRate) >= 80 ? "warn" : "bad"}
        />
        <KPICard
          icon={AlertTriangle}
          label="أخطاء العملاء"
          value={String(data.clientErrors.total)}
          sub={PERIOD_LABELS[period]}
          color="text-red-600"
          bgColor="bg-red-500/10"
          status={data.clientErrors.total === 0 ? "good" : data.clientErrors.total < 50 ? "warn" : "bad"}
        />
        <KPICard
          icon={Wallet}
          label="نجاح المحفظة"
          value={`${walletSuccessRate}%`}
          sub={`${data.walletStats.success}/${data.walletStats.total}`}
          color="text-green-600"
          bgColor="bg-green-500/10"
          status={Number(walletSuccessRate) >= 98 ? "good" : Number(walletSuccessRate) >= 90 ? "warn" : "bad"}
        />
        <KPICard
          icon={Users}
          label="المنشآت النشطة"
          value={String(data.tenantUsage.length)}
          sub="منشأة"
          color="text-purple-600"
          bgColor="bg-purple-500/10"
          status="good"
        />
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="email">📧 البريد</TabsTrigger>
          <TabsTrigger value="errors">🐛 الأخطاء</TabsTrigger>
          <TabsTrigger value="wallet">💰 المحفظة</TabsTrigger>
          <TabsTrigger value="tenants">🏢 المنشآت</TabsTrigger>
        </TabsList>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">إرسال البريد اليومي</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {data.emailStats.byDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.emailStats.byDay}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sent" name="مُرسل" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="failed" name="فاشل" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزيع حالات البريد</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "مُرسل", value: data.emailStats.sent },
                        { name: "فاشل", value: data.emailStats.failed },
                        { name: "معلق", value: data.emailStats.pending },
                      ].filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {COLORS.map((color, i) => (
                        <Cell key={i} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">الأخطاء اليومية</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {data.clientErrors.byDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.clientErrors.byDay}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="أخطاء"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">أكثر المسارات أخطاءً</CardTitle>
              </CardHeader>
              <CardContent>
                {data.clientErrors.byRoute.length > 0 ? (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {data.clientErrors.byRoute.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <code dir="ltr" className="text-xs text-start truncate max-w-[200px]">{r.route}</code>
                        <Badge variant={r.count > 20 ? "destructive" : "secondary"}>{r.count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState text="لا توجد أخطاء 🎉" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">عمليات المحفظة اليومية</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {data.walletStats.byDay.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.walletStats.byDay}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success" name="ناجح" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" name="فاشل" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenant Usage Tab */}
        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">استخدام المنشآت (بدون بيانات حساسة)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">المنشأة</TableHead>
                      <TableHead className="text-start">الفواتير</TableHead>
                      <TableHead className="text-start">المصروفات</TableHead>
                      <TableHead className="text-start">المستخدمين</TableHead>
                      <TableHead className="text-start">النشاط</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tenantUsage.length > 0 ? (
                      data.tenantUsage.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{t.tenant_name}</TableCell>
                          <TableCell dir="ltr" className="text-start">{t.invoices}</TableCell>
                          <TableCell dir="ltr" className="text-start">{t.expenses}</TableCell>
                          <TableCell dir="ltr" className="text-start">{t.users}</TableCell>
                          <TableCell>
                            <Badge variant={t.invoices + t.expenses > 10 ? "default" : "secondary"}>
                              {t.invoices + t.expenses > 10 ? "نشط" : "منخفض"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          لا توجد بيانات
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Sub-components ───

function KPICard({
  icon: Icon, label, value, sub, color, bgColor, status,
}: {
  icon: any; label: string; value: string; sub: string;
  color: string; bgColor: string; status: "good" | "warn" | "bad";
}) {
  const statusIcon = status === "good"
    ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
    : status === "warn"
    ? <Clock className="h-3.5 w-3.5 text-yellow-500" />
    : <XCircle className="h-3.5 w-3.5 text-red-500" />;

  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs md:text-sm text-muted-foreground truncate">{label}</p>
            <p className={`text-xl md:text-2xl font-bold mt-1 ${color}`}>{value}</p>
            <div className="flex items-center gap-1 mt-1">
              {statusIcon}
              <span className="text-[11px] text-muted-foreground">{sub}</span>
            </div>
          </div>
          <div className={`h-9 w-9 md:h-10 md:w-10 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4 w-4 md:h-5 md:w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      لا توجد بيانات كافية للعرض
    </div>
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

export default AdminPlatformHealth;
