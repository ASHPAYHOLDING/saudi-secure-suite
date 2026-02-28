import { useEffect, useState } from "react";
import { fmtCurrency } from "@/lib/formatters";
import {
  Building2, Users, CreditCard, FileText, Activity, Shield, Server,
  TrendingUp, ArrowUpRight, ArrowDownRight, Zap, Globe, BarChart3,
  Clock, CheckCircle2, AlertTriangle, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { motion } from "framer-motion";

interface Stats {
  totalCompanies: number;
  activeSubscriptions: number;
  totalUsers: number;
  trialSubscriptions: number;
  totalInvoices: number;
  totalContracts: number;
  activeUsers: number;
  suspendedCompanies: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

interface RecentTenant {
  id: string;
  name: string;
  created_at: string;
  status: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

const PLAN_COLORS = [
  "hsl(172, 66%, 36%)",
  "hsl(220, 30%, 14%)",
  "hsl(38, 92%, 50%)",
  "hsl(260, 60%, 55%)",
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalCompanies: 0, activeSubscriptions: 0, totalUsers: 0, trialSubscriptions: 0,
    totalInvoices: 0, totalContracts: 0, activeUsers: 0, suspendedCompanies: 0,
    totalRevenue: 0, monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTenants, setRecentTenants] = useState<RecentTenant[]>([]);
  const [recentActivity, setRecentActivity] = useState<Notification[]>([]);
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number }[]>([]);
  const [companyGrowth, setCompanyGrowth] = useState<{ month: string; count: number }[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; revenue: number }[]>([]);

  const fetchAll = async () => {
    try {
      const [
        tenantsRes, subsActiveRes, profilesRes, trialRes,
        invoicesRes, contractsRes, activeUsersRes, suspendedRes,
        recentTenantsRes, notificationsRes, subsAllRes, plansRes, allTenantsRes,
        allInvoicesRes,
      ] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trial"),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "suspended"),
        supabase.from("tenants").select("id, name, created_at, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("platform_notifications").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("subscriptions").select("plan_id, billing_cycle"),
        supabase.from("subscription_plans").select("id, name_ar, price_monthly, price_yearly"),
        supabase.from("tenants").select("created_at"),
        supabase.from("invoices").select("grand_total, invoice_date, status"),
      ]);

      // Calculate revenue from invoices
      let totalRevenue = 0;
      let monthlyRevenue = 0;
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const revenueMonths: Record<string, number> = {};

      // Init last 6 months for revenue
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        revenueMonths[key] = 0;
      }

      if (allInvoicesRes.data) {
        allInvoicesRes.data
          .filter((inv) => inv.status !== "cancelled")
          .forEach((inv) => {
            totalRevenue += Number(inv.grand_total) || 0;
            const d = new Date(inv.invoice_date);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              monthlyRevenue += Number(inv.grand_total) || 0;
            }
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (key in revenueMonths) {
              revenueMonths[key] += Number(inv.grand_total) || 0;
            }
          });
      }

      // Also add estimated revenue from active subscriptions
      let estimatedMRR = 0;
      if (subsAllRes.data && plansRes.data) {
        const planPriceMap: Record<string, { monthly: number; yearly: number }> = {};
        plansRes.data.forEach((p) => {
          planPriceMap[p.id] = { monthly: p.price_monthly || 0, yearly: p.price_yearly || 0 };
        });
        subsAllRes.data.forEach((s) => {
          const prices = planPriceMap[s.plan_id];
          if (prices) {
            estimatedMRR += s.billing_cycle === "yearly"
              ? (prices.yearly || prices.monthly * 12) / 12
              : prices.monthly;
          }
        });
      }

      const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

      setRevenueByMonth(
        Object.entries(revenueMonths).map(([key, revenue]) => ({
          month: months[parseInt(key.split("-")[1]) - 1],
          revenue: Math.round(revenue),
        }))
      );

      setStats({
        totalCompanies: tenantsRes.count ?? 0,
        activeSubscriptions: subsActiveRes.count ?? 0,
        totalUsers: profilesRes.count ?? 0,
        trialSubscriptions: trialRes.count ?? 0,
        totalInvoices: invoicesRes.count ?? 0,
        totalContracts: contractsRes.count ?? 0,
        activeUsers: activeUsersRes.count ?? 0,
        suspendedCompanies: suspendedRes.count ?? 0,
        totalRevenue: Math.round(totalRevenue),
        monthlyRevenue: Math.round(estimatedMRR || monthlyRevenue),
      });

      if (recentTenantsRes.data) setRecentTenants(recentTenantsRes.data);
      if (notificationsRes.data) setRecentActivity(notificationsRes.data as Notification[]);

      // Plan distribution
      if (subsAllRes.data && plansRes.data) {
        const planMap: Record<string, string> = {};
        plansRes.data.forEach((p) => { planMap[p.id] = p.name_ar; });
        const counts: Record<string, number> = {};
        subsAllRes.data.forEach((s) => {
          const name = planMap[s.plan_id] || "غير محدد";
          counts[name] = (counts[name] || 0) + 1;
        });
        setPlanDistribution(Object.entries(counts).map(([name, value]) => ({ name, value })));
      }

      // Company growth
      if (allTenantsRes.data) {
        const monthCounts: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date(currentYear, currentMonth - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthCounts[key] = 0;
        }
        allTenantsRes.data.forEach((t) => {
          const d = new Date(t.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (key in monthCounts) monthCounts[key]++;
        });
        setCompanyGrowth(Object.entries(monthCounts).map(([key, count]) => ({
          month: months[parseInt(key.split("-")[1]) - 1],
          count,
        })));
      }
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const formatCurrency = (n: number) => fmtCurrency(n, { decimals: 0 });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${Math.floor(hours / 24)} ي`;
  };

  const typeIcons: Record<string, string> = {
    new_tenant: "🏢",
    subscription_expired: "⏰",
    subscription_cancelled: "❌",
  };

  const Skeleton = ({ className = "h-8 w-20" }: { className?: string }) => (
    <div className={`animate-pulse rounded bg-muted ${className}`} />
  );

  // System health mock (calculated from real data)
  const healthScore = stats.totalCompanies > 0
    ? Math.min(100, Math.round(
        ((stats.totalCompanies - stats.suspendedCompanies) / stats.totalCompanies) * 40 +
        (stats.activeUsers / Math.max(stats.totalUsers, 1)) * 30 +
        (stats.suspendedCompanies === 0 ? 30 : 10)
      ))
    : 100;

  const healthColor = healthScore >= 90 ? "text-emerald-500" : healthScore >= 70 ? "text-amber-500" : "text-destructive";
  const healthBg = healthScore >= 90 ? "bg-emerald-500/10" : healthScore >= 70 ? "bg-amber-500/10" : "bg-destructive/10";

  return (
    <motion.div
      className="p-6 space-y-6 max-w-[1600px] mx-auto"
      dir="rtl"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            مركز القيادة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة تنفيذية شاملة على أداء المنصة</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${healthBg} ${healthColor}`}>
            {healthScore >= 90 ? <CheckCircle2 size={16} /> : healthScore >= 70 ? <AlertTriangle size={16} /> : <XCircle size={16} />}
            صحة النظام: {healthScore}%
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={14} />
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </motion.div>

      {/* Hero KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "الشركات النشطة",
            value: loading ? null : stats.totalCompanies,
            subtitle: loading ? null : `${stats.suspendedCompanies} معلقة`,
            icon: Building2,
            iconBg: "bg-accent/10",
            iconColor: "text-accent",
            trend: stats.suspendedCompanies === 0 ? "up" : "neutral",
          },
          {
            title: "إجمالي المستخدمين",
            value: loading ? null : stats.totalUsers,
            subtitle: loading ? null : `${stats.activeUsers} نشط`,
            icon: Users,
            iconBg: "bg-blue-500/10",
            iconColor: "text-blue-500",
            trend: stats.activeUsers > stats.totalUsers * 0.8 ? "up" : "neutral",
          },
          {
            title: "الفواتير المُصدرة",
            value: loading ? null : stats.totalInvoices,
            subtitle: loading ? null : `${stats.totalContracts} عقد`,
            icon: FileText,
            iconBg: "bg-violet-500/10",
            iconColor: "text-violet-500",
            trend: "up",
          },
          {
            title: "الإيرادات الشهرية (MRR)",
            value: loading ? null : formatCurrency(stats.monthlyRevenue),
            subtitle: loading ? null : `إجمالي: ${formatCurrency(stats.totalRevenue)}`,
            icon: TrendingUp,
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-500",
            trend: "up",
          },
        ].map((card, i) => (
          <motion.div key={card.title} variants={item}>
            <Card className="relative overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-l from-accent/60 via-accent/30 to-transparent" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.iconBg} transition-transform group-hover:scale-110`}>
                    <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  {card.trend === "up" && (
                    <div className="flex items-center gap-0.5 text-emerald-500 text-xs font-medium">
                      <ArrowUpRight size={14} />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  {card.value === null ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground tracking-tight">{card.value}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
                  {card.subtitle && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{card.subtitle}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Subscription Quick Stats */}
      <motion.div variants={item}>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard size={18} className="text-accent" />
              <h3 className="font-semibold text-sm">توزيع الاشتراكات</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "نشط", count: stats.activeSubscriptions, color: "bg-emerald-500", textColor: "text-emerald-600" },
                { label: "تجريبي", count: stats.trialSubscriptions, color: "bg-amber-500", textColor: "text-amber-600" },
                { label: "شركات معلقة", count: stats.suspendedCompanies, color: "bg-destructive", textColor: "text-destructive" },
                { label: "معدل التحويل", count: null, color: "", textColor: "text-accent", isRate: true },
              ].map((s) => (
                <div key={s.label} className="text-center p-3 rounded-lg bg-muted/40">
                  {loading ? (
                    <Skeleton className="h-8 w-12 mx-auto" />
                  ) : s.isRate ? (
                    <p className={`text-2xl font-bold ${s.textColor}`}>
                      {stats.trialSubscriptions + stats.activeSubscriptions > 0
                        ? Math.round((stats.activeSubscriptions / (stats.activeSubscriptions + stats.trialSubscriptions)) * 100)
                        : 0}%
                    </p>
                  ) : (
                    <p className={`text-2xl font-bold ${s.textColor}`}>{s.count}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 size={18} className="text-accent" />
                    اتجاه الإيرادات
                  </CardTitle>
                  <CardDescription>الإيرادات الشهرية خلال آخر 6 أشهر</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">﷼ ريال</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueByMonth}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(172, 66%, 36%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(172, 66%, 36%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, direction: "rtl" }}
                      formatter={(value: number) => [formatCurrency(value), "الإيرادات"]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(172, 66%, 36%)" strokeWidth={2.5} fill="url(#revenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Plan Distribution */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard size={18} className="text-accent" />
                توزيع الخطط
              </CardTitle>
              <CardDescription>نسبة الاشتراكات حسب الخطة</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              {loading ? (
                <Skeleton className="h-48 w-48 rounded-full" />
              ) : planDistribution.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  لا توجد اشتراكات بعد
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        dataKey="value"
                        paddingAngle={4}
                        strokeWidth={0}
                      >
                        {planDistribution.map((_, i) => (
                          <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap justify-center gap-3">
                    {planDistribution.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-1.5 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="font-semibold">({p.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Company Growth + Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe size={18} className="text-accent" />
                نمو الشركات
              </CardTitle>
              <CardDescription>الشركات المسجلة خلال آخر 6 أشهر</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={companyGrowth} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, direction: "rtl" }}
                      formatter={(value: number) => [value, "شركات جديدة"]}
                    />
                    <Bar dataKey="count" fill="hsl(220, 30%, 14%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Health */}
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Server size={18} className="text-accent" />
                صحة النظام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                {
                  label: "نسبة الشركات النشطة",
                  value: stats.totalCompanies > 0 ? Math.round(((stats.totalCompanies - stats.suspendedCompanies) / stats.totalCompanies) * 100) : 100,
                  color: "bg-emerald-500",
                },
                {
                  label: "نسبة المستخدمين النشطين",
                  value: stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 100,
                  color: "bg-blue-500",
                },
                {
                  label: "معدل التحويل (تجريبي → مدفوع)",
                  value: stats.trialSubscriptions + stats.activeSubscriptions > 0 ? Math.round((stats.activeSubscriptions / (stats.activeSubscriptions + stats.trialSubscriptions)) * 100) : 0,
                  color: "bg-accent",
                },
                {
                  label: "متوسط المستخدمين / شركة",
                  value: null,
                  display: stats.totalCompanies > 0 ? (stats.totalUsers / stats.totalCompanies).toFixed(1) : "0",
                },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">{metric.label}</span>
                    <span className="text-xs font-semibold">
                      {loading ? "..." : metric.value !== null ? `${metric.value}%` : metric.display}
                    </span>
                  </div>
                  {metric.value !== null && (
                    <Progress value={loading ? 0 : metric.value} className="h-2" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row: Recent + Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Companies */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 size={18} className="text-accent" />
                أحدث الشركات المسجلة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              ) : recentTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد شركات بعد</p>
              ) : (
                recentTenants.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                        <Building2 size={16} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        t.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 border-0"
                          : "bg-destructive/10 text-destructive border-0"
                      }
                    >
                      {t.status === "active" ? "نشط" : "معلق"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Feed */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity size={18} className="text-accent" />
                سجل النشاطات الأخيرة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Activity size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد نشاطات حتى الآن</p>
                </div>
              ) : (
                recentActivity.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 rounded-xl p-3 text-sm transition-colors ${
                      !n.is_read ? "bg-accent/5 border border-accent/10" : "hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-lg">{typeIcons[n.type] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
