import { useEffect, useState } from "react";
import { Building2, Users, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, FileText, Globe, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

interface Stats {
  totalCompanies: number;
  activeSubscriptions: number;
  totalUsers: number;
  trialSubscriptions: number;
  totalInvoices: number;
  totalContracts: number;
  activeUsers: number;
  suspendedCompanies: number;
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

const PLAN_COLORS = ["hsl(var(--accent))", "hsl(var(--primary))", "#f59e0b", "#8b5cf6"];

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalCompanies: 0, activeSubscriptions: 0, totalUsers: 0, trialSubscriptions: 0,
    totalInvoices: 0, totalContracts: 0, activeUsers: 0, suspendedCompanies: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTenants, setRecentTenants] = useState<RecentTenant[]>([]);
  const [recentActivity, setRecentActivity] = useState<Notification[]>([]);
  const [planDistribution, setPlanDistribution] = useState<{ name: string; value: number }[]>([]);
  const [companyGrowth, setCompanyGrowth] = useState<{ month: string; count: number }[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          tenantsRes, subsActiveRes, profilesRes, trialRes,
          invoicesRes, contractsRes, activeUsersRes, suspendedRes,
          recentTenantsRes, notificationsRes, subsAllRes, plansRes, allTenantsRes,
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
          supabase.from("subscriptions").select("plan_id"),
          supabase.from("subscription_plans").select("id, name_ar"),
          supabase.from("tenants").select("created_at"),
        ]);

        setStats({
          totalCompanies: tenantsRes.count ?? 0,
          activeSubscriptions: subsActiveRes.count ?? 0,
          totalUsers: profilesRes.count ?? 0,
          trialSubscriptions: trialRes.count ?? 0,
          totalInvoices: invoicesRes.count ?? 0,
          totalContracts: contractsRes.count ?? 0,
          activeUsers: activeUsersRes.count ?? 0,
          suspendedCompanies: suspendedRes.count ?? 0,
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

        // Company growth by month (last 6 months)
        if (allTenantsRes.data) {
          const monthCounts: Record<string, number> = {};
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            monthCounts[key] = 0;
          }
          allTenantsRes.data.forEach((t) => {
            const d = new Date(t.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (key in monthCounts) monthCounts[key]++;
          });
          const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
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
    fetchAll();
  }, []);

  const statCards = [
    { title: "إجمالي الشركات", value: stats.totalCompanies, icon: Building2, color: "text-accent", change: `${stats.suspendedCompanies} معلقة`, changeType: stats.suspendedCompanies > 0 ? "warn" : "good" },
    { title: "الاشتراكات النشطة", value: stats.activeSubscriptions, icon: CreditCard, color: "text-emerald-500", change: `${stats.trialSubscriptions} تجريبي`, changeType: "info" },
    { title: "المستخدمين", value: stats.totalUsers, icon: Users, color: "text-blue-500", change: `${stats.activeUsers} نشط`, changeType: "good" },
    { title: "الفواتير", value: stats.totalInvoices, icon: FileText, color: "text-violet-500", change: `${stats.totalContracts} عقد`, changeType: "info" },
  ];

  const Skeleton = () => <div className="h-8 w-20 animate-pulse rounded bg-muted" />;

  const typeIcons: Record<string, string> = {
    new_tenant: "🏢",
    subscription_expired: "⏰",
    subscription_cancelled: "❌",
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `${mins}د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}س`;
    return `${Math.floor(hours / 24)}ي`;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة تحكم المنصة</h1>
        <p className="text-sm text-muted-foreground">نظرة شاملة على أداء نيوماكسيو</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-l from-accent/60 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton /> : (
                <>
                  <div className="text-3xl font-bold text-foreground">{card.value}</div>
                  <p className={`text-xs mt-1 ${card.changeType === "warn" ? "text-amber-500" : card.changeType === "good" ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {card.change}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company Growth Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">نمو الشركات</CardTitle>
            <CardDescription>تسجيل الشركات خلال آخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 animate-pulse rounded bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={companyGrowth}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#growthGrad)" name="شركات جديدة" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع الخطط</CardTitle>
            <CardDescription>نسبة الاشتراكات حسب الخطة</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {loading ? (
              <div className="h-48 w-48 animate-pulse rounded-full bg-muted" />
            ) : planDistribution.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">لا توجد اشتراكات بعد</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={4}>
                      {planDistribution.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {planDistribution.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                      {p.name} ({p.value})
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Companies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 size={18} className="text-accent" /> أحدث الشركات المسجلة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)
            ) : recentTenants.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد شركات بعد</p>
            ) : (
              recentTenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                      <Building2 size={16} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString("ar-SA")}</p>
                    </div>
                  </div>
                  <Badge className={t.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}>
                    {t.status === "active" ? "نشط" : "معلق"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={18} className="text-accent" /> آخر النشاطات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد نشاطات</p>
            ) : (
              recentActivity.map((n) => (
                <div key={n.id} className={`flex items-center gap-3 rounded-lg p-2.5 text-sm transition-colors ${!n.is_read ? "bg-accent/5 border border-accent/10" : "hover:bg-muted/30"}`}>
                  <span className="text-lg">{typeIcons[n.type] || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">نسبة الشركات النشطة</p>
              <Progress value={stats.totalCompanies > 0 ? ((stats.totalCompanies - stats.suspendedCompanies) / stats.totalCompanies) * 100 : 0} className="h-2" />
              <p className="text-xs font-medium mt-1">{stats.totalCompanies > 0 ? Math.round(((stats.totalCompanies - stats.suspendedCompanies) / stats.totalCompanies) * 100) : 0}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">نسبة المستخدمين النشطين</p>
              <Progress value={stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0} className="h-2" />
              <p className="text-xs font-medium mt-1">{stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">تحويل تجريبي → مدفوع</p>
              <Progress value={stats.trialSubscriptions > 0 && stats.activeSubscriptions > 0 ? (stats.activeSubscriptions / (stats.activeSubscriptions + stats.trialSubscriptions)) * 100 : 0} className="h-2" />
              <p className="text-xs font-medium mt-1">{stats.trialSubscriptions > 0 && stats.activeSubscriptions > 0 ? Math.round((stats.activeSubscriptions / (stats.activeSubscriptions + stats.trialSubscriptions)) * 100) : 0}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">متوسط المستخدمين/شركة</p>
              <p className="text-lg font-bold text-foreground">{stats.totalCompanies > 0 ? (stats.totalUsers / stats.totalCompanies).toFixed(1) : 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
