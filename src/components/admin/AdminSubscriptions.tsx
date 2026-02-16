import { useEffect, useState } from "react";
import { CreditCard, Search, TrendingUp, Calendar, DollarSign, AlertTriangle, Download, History, CalendarPlus, BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart, Legend } from "recharts";

interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  tenant_name?: string;
  plan_name?: string;
  plan_price?: number;
}

interface Plan {
  id: string;
  name_ar: string;
  slug: string;
  price_monthly: number;
  price_yearly: number | null;
}

interface SubLog {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
  old_plan_name?: string;
  new_plan_name?: string;
}

const STATUS_MAP: Record<string, { label: string; class: string; icon: string }> = {
  active: { label: "نشط", class: "bg-emerald-100 text-emerald-700", icon: "✅" },
  trial: { label: "تجريبي", class: "bg-amber-100 text-amber-700", icon: "⏳" },
  cancelled: { label: "ملغي", class: "bg-destructive/10 text-destructive", icon: "❌" },
  expired: { label: "منتهي", class: "bg-muted text-muted-foreground", icon: "⏰" },
  past_due: { label: "متأخر", class: "bg-red-100 text-red-700", icon: "⚠️" },
};

const CYCLE_LABELS: Record<string, string> = { monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  upgrade: { label: "ترقية", color: "text-emerald-600" },
  downgrade: { label: "تخفيض", color: "text-amber-600" },
  cancel: { label: "إلغاء", color: "text-destructive" },
  renew: { label: "تجديد", color: "text-blue-600" },
  extend: { label: "تمديد", color: "text-accent" },
  status_change: { label: "تغيير حالة", color: "text-muted-foreground" },
  plan_change: { label: "تغيير خطة", color: "text-purple-600" },
  cycle_change: { label: "تغيير دورة", color: "text-indigo-600" },
};

const AdminSubscriptions = () => {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editCycle, setEditCycle] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Extend dialog
  const [extendSub, setExtendSub] = useState<Subscription | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const [extendNotes, setExtendNotes] = useState("");

  // Logs dialog
  const [logsSub, setLogsSub] = useState<Subscription | null>(null);
  const [logs, setLogs] = useState<SubLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchData = async () => {
    const [subsRes, plansRes, tenantsRes] = await Promise.all([
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, name_ar, slug, price_monthly, price_yearly"),
      supabase.from("tenants").select("id, name"),
    ]);

    const tenantMap: Record<string, string> = {};
    tenantsRes.data?.forEach((t) => { tenantMap[t.id] = t.name; });

    const planMap: Record<string, { name: string; price: number }> = {};
    plansRes.data?.forEach((p) => { planMap[p.id] = { name: p.name_ar, price: p.price_monthly }; });

    if (subsRes.data) {
      setSubs(subsRes.data.map((s) => ({
        ...s,
        tenant_name: tenantMap[s.tenant_id] || "غير معروف",
        plan_name: planMap[s.plan_id]?.name || "غير معروف",
        plan_price: planMap[s.plan_id]?.price || 0,
      })));
    }
    if (plansRes.data) setPlans(plansRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('admin-subscriptions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_plans' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // === Edit ===
  const openEdit = (sub: Subscription) => {
    setEditSub(sub);
    setEditPlan(sub.plan_id);
    setEditCycle(sub.billing_cycle);
    setEditStatus(sub.status);
  };

  const saveEdit = async () => {
    if (!editSub || !user) return;
    const changes: string[] = [];

    if (editPlan !== editSub.plan_id) changes.push("plan_change");
    if (editCycle !== editSub.billing_cycle) changes.push("cycle_change");
    if (editStatus !== editSub.status) changes.push("status_change");

    const { error } = await supabase.from("subscriptions").update({
      plan_id: editPlan, billing_cycle: editCycle, status: editStatus,
    }).eq("id", editSub.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    // Log each change
    for (const action of changes) {
      await supabase.from("subscription_logs").insert({
        subscription_id: editSub.id,
        tenant_id: editSub.tenant_id,
        action,
        old_plan_id: action === "plan_change" ? editSub.plan_id : null,
        new_plan_id: action === "plan_change" ? editPlan : null,
        old_status: action === "status_change" ? editSub.status : null,
        new_status: action === "status_change" ? editStatus : null,
        old_billing_cycle: action === "cycle_change" ? editSub.billing_cycle : null,
        new_billing_cycle: action === "cycle_change" ? editCycle : null,
        performed_by: user.id,
      });
    }

    const planName = plans.find((p) => p.id === editPlan)?.name_ar || "";
    setSubs((prev) => prev.map((s) => s.id === editSub.id ? { ...s, plan_id: editPlan, plan_name: planName, billing_cycle: editCycle, status: editStatus } : s));
    toast({ title: "تم الحفظ", description: "تم تحديث الاشتراك بنجاح" });
    setEditSub(null);
  };

  // === Extend ===
  const openExtend = (sub: Subscription) => {
    setExtendSub(sub);
    setExtendDays("30");
    setExtendNotes("");
  };

  const saveExtend = async () => {
    if (!extendSub || !user) return;
    const days = parseInt(extendDays);
    if (isNaN(days) || days <= 0) {
      toast({ title: "خطأ", description: "أدخل عدد أيام صحيح", variant: "destructive" });
      return;
    }

    const currentEnd = new Date(extendSub.current_period_end);
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

    const { error } = await supabase.from("subscriptions").update({
      current_period_end: newEnd.toISOString(),
      status: "active",
    }).eq("id", extendSub.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("subscription_logs").insert({
      subscription_id: extendSub.id,
      tenant_id: extendSub.tenant_id,
      action: "extend",
      old_status: extendSub.status,
      new_status: "active",
      notes: `تمديد ${days} يوم. ${extendNotes}`.trim(),
      performed_by: user.id,
    });

    setSubs((prev) => prev.map((s) => s.id === extendSub.id ? { ...s, current_period_end: newEnd.toISOString(), status: "active" } : s));
    toast({ title: "تم التمديد", description: `تم تمديد الاشتراك ${days} يوم` });
    setExtendSub(null);
  };

  // === Logs ===
  const openLogs = async (sub: Subscription) => {
    setLogsSub(sub);
    setLogsLoading(true);
    const { data } = await supabase
      .from("subscription_logs")
      .select("*")
      .eq("subscription_id", sub.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const planMap: Record<string, string> = {};
    plans.forEach((p) => { planMap[p.id] = p.name_ar; });

    setLogs((data || []).map((l: any) => ({
      ...l,
      old_plan_name: l.old_plan_id ? planMap[l.old_plan_id] : null,
      new_plan_name: l.new_plan_id ? planMap[l.new_plan_id] : null,
    })));
    setLogsLoading(false);
  };

  // === Export CSV ===
  const exportCSV = () => {
    const headers = ["الشركة", "الخطة", "الدورة", "السعر", "الحالة", "بداية الفترة", "نهاية الفترة", "تاريخ الإنشاء"];
    const rows = filtered.map((s) => [
      s.tenant_name || "",
      s.plan_name || "",
      CYCLE_LABELS[s.billing_cycle] || s.billing_cycle,
      String(s.plan_price || 0),
      STATUS_MAP[s.status]?.label || s.status,
      new Date(s.current_period_start).toLocaleDateString("ar-SA"),
      new Date(s.current_period_end).toLocaleDateString("ar-SA"),
      new Date(s.created_at).toLocaleDateString("ar-SA"),
    ]);

    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم التصدير", description: `تم تصدير ${filtered.length} اشتراك` });
  };

  const filtered = subs.filter((s) => {
    const matchSearch = s.tenant_name?.includes(search) || s.plan_name?.includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Revenue calculations
  const monthlyRevenue = subs.filter((s) => s.status === "active").reduce((sum, s) => {
    const plan = plans.find((p) => p.id === s.plan_id);
    if (!plan) return sum;
    if (s.billing_cycle === "yearly" && plan.price_yearly) return sum + plan.price_yearly / 12;
    return sum + plan.price_monthly;
  }, 0);

  const yearlyRevenue = monthlyRevenue * 12;
  const activeCount = subs.filter((s) => s.status === "active").length;
  const trialCount = subs.filter((s) => s.status === "trial").length;
  const renewalRate = subs.length > 0 ? Math.round((activeCount / subs.length) * 100) : 0;
  const churnRate = subs.length > 0 ? Math.round((subs.filter((s) => s.status === "cancelled" || s.status === "expired").length / subs.length) * 100) : 0;

  const now = new Date();
  const expiringSoon = subs.filter((s) => {
    const end = new Date(s.current_period_end);
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 7 && s.status === "active";
  });

  // Monthly revenue trend (simulated from created_at distribution)
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const revenueChartData = (() => {
    const data: { month: string; revenue: number; newSubs: number; churned: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthSubs = subs.filter((s) => s.created_at.startsWith(monthKey));
      const activeSubs = subs.filter((s) => {
        const created = new Date(s.created_at);
        return created <= d && s.status === "active";
      });
      const revenue = activeSubs.reduce((sum, s) => {
        const plan = plans.find((p) => p.id === s.plan_id);
        return sum + (plan?.price_monthly || 0);
      }, 0);
      const churned = subs.filter((s) => {
        const created = new Date(s.created_at);
        return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear() && (s.status === "cancelled" || s.status === "expired");
      }).length;
      data.push({ month: monthNames[d.getMonth()], revenue, newSubs: monthSubs.length, churned });
    }
    return data;
  })();

  // Plan distribution chart
  const planChartData = plans.map((p) => ({
    name: p.name_ar,
    active: subs.filter((s) => s.plan_id === p.id && s.status === "active").length,
    trial: subs.filter((s) => s.plan_id === p.id && s.status === "trial").length,
  }));

  const statusCounts = Object.fromEntries(Object.keys(STATUS_MAP).map((k) => [k, subs.filter((s) => s.status === k).length]));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة الاشتراكات</h1>
          <p className="text-sm text-muted-foreground">عرض وإدارة اشتراكات جميع الشركات</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download size={16} /> تصدير CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-l from-emerald-500/60 to-transparent" />
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2"><DollarSign size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{monthlyRevenue.toLocaleString("ar-SA")} <span className="text-sm font-normal text-muted-foreground">ر.س</span></p>
                <p className="text-xs text-muted-foreground">MRR الشهري</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-100 p-2"><BarChart3 size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{yearlyRevenue.toLocaleString("ar-SA")} <span className="text-sm font-normal text-muted-foreground">ر.س</span></p>
              <p className="text-xs text-muted-foreground">ARR السنوي</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-accent/10 p-2"><ArrowUpRight size={20} className="text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{renewalRate}%</p>
              <p className="text-xs text-muted-foreground">معدل التجديد</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-100 p-2"><ArrowDownRight size={20} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold">{churnRate}%</p>
              <p className="text-xs text-muted-foreground">معدل الإلغاء</p>
            </div>
          </CardContent>
        </Card>
        <Card className={expiringSoon.length > 0 ? "border-amber-200" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg p-2 ${expiringSoon.length > 0 ? "bg-amber-100" : "bg-muted"}`}><AlertTriangle size={20} className={expiringSoon.length > 0 ? "text-amber-600" : "text-muted-foreground"} /></div>
            <div><p className="text-2xl font-bold">{expiringSoon.length}</p><p className="text-xs text-muted-foreground">تنتهي خلال 7 أيام</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">📈 اتجاه الإيرادات</TabsTrigger>
          <TabsTrigger value="distribution">📊 توزيع الخطط</TabsTrigger>
          <TabsTrigger value="status">📋 حالة الاشتراكات</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">اتجاه الإيرادات والاشتراكات الشهري</CardTitle>
              <CardDescription>آخر 6 أشهر</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, direction: "rtl" }} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="الإيراد (ر.س)" stroke="hsl(var(--accent))" fill="url(#revGrad)" strokeWidth={2} />
                  <Line type="monotone" dataKey="newSubs" name="اشتراكات جديدة" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="churned" name="ملغية" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader><CardTitle className="text-base">توزيع الاشتراكات حسب الخطة</CardTitle></CardHeader>
            <CardContent>
              {planChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={planChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="active" name="نشط" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="trial" name="تجريبي" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader><CardTitle className="text-base">حالة الاشتراكات</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries(STATUS_MAP).map(([key, { label, class: cls, icon }]) => {
                  const count = statusCounts[key] || 0;
                  const pct = subs.length > 0 ? (count / subs.length) * 100 : 0;
                  return (
                    <div key={key} className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${statusFilter === key ? "border-accent bg-accent/5" : ""}`} onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{icon} {label}</span>
                        <Badge className={cls}>{count}</Badge>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}%</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="ابحث بالشركة أو الخطة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">الخطة</TableHead>
                  <TableHead className="text-right">الدورة</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">بداية الفترة</TableHead>
                  <TableHead className="text-right">نهاية الفترة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const daysLeft = Math.ceil((new Date(s.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.tenant_name}</TableCell>
                      <TableCell><Badge variant="secondary">{s.plan_name}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{CYCLE_LABELS[s.billing_cycle] || s.billing_cycle}</TableCell>
                      <TableCell>{(s.plan_price || 0).toLocaleString("ar-SA")} ر.س</TableCell>
                      <TableCell><Badge className={STATUS_MAP[s.status]?.class || ""}>{STATUS_MAP[s.status]?.label || s.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(s.current_period_start).toLocaleDateString("ar-SA")}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-xs text-muted-foreground">{new Date(s.current_period_end).toLocaleDateString("ar-SA")}</span>
                          {daysLeft > 0 && daysLeft <= 7 && <Badge className="mr-1 bg-amber-100 text-amber-700 text-[10px]">{daysLeft} يوم</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(s)} title="تعديل">✏️</Button>
                          <Button size="sm" variant="outline" onClick={() => openExtend(s)} title="تمديد"><CalendarPlus size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={() => openLogs(s)} title="السجل"><History size={14} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا توجد اشتراكات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editSub} onOpenChange={() => setEditSub(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader><DialogTitle>تعديل اشتراك: {editSub?.tenant_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">الخطة</label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar} — {p.price_monthly} ر.س/شهر</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">دورة الفوترة</label>
              <Select value={editCycle} onValueChange={setEditCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="quarterly">ربع سنوي</SelectItem>
                  <SelectItem value="yearly">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">الحالة</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditSub(null)}>إلغاء</Button>
            <Button onClick={saveEdit}>حفظ التغييرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={!!extendSub} onOpenChange={() => setExtendSub(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تمديد اشتراك: {extendSub?.tenant_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p>الخطة الحالية: <strong>{extendSub?.plan_name}</strong></p>
              <p>تنتهي في: <strong>{extendSub ? new Date(extendSub.current_period_end).toLocaleDateString("ar-SA") : ""}</strong></p>
              <p>الحالة: <Badge className={STATUS_MAP[extendSub?.status || ""]?.class || ""}>{STATUS_MAP[extendSub?.status || ""]?.label || extendSub?.status}</Badge></p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">عدد أيام التمديد</label>
              <div className="flex gap-2">
                {["7", "14", "30", "60", "90"].map((d) => (
                  <Button key={d} size="sm" variant={extendDays === d ? "default" : "outline"} onClick={() => setExtendDays(d)}>{d}</Button>
                ))}
              </div>
              <Input type="number" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} className="mt-2" placeholder="أو أدخل عدد مخصص" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">ملاحظات (اختياري)</label>
              <Textarea value={extendNotes} onChange={(e) => setExtendNotes(e.target.value)} placeholder="سبب التمديد..." rows={2} />
            </div>
            {extendSub && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
                <p>📅 التاريخ الجديد للانتهاء: <strong>{new Date(new Date(extendSub.current_period_end).getTime() + parseInt(extendDays || "0") * 86400000).toLocaleDateString("ar-SA")}</strong></p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExtendSub(null)}>إلغاء</Button>
            <Button onClick={saveExtend} className="gap-2"><CalendarPlus size={16} /> تمديد الاشتراك</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!logsSub} onOpenChange={() => setLogsSub(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History size={18} /> سجل تغييرات: {logsSub?.tenant_name}</DialogTitle>
          </DialogHeader>
          {logsLoading ? (
            <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">لا توجد تغييرات مسجلة</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "text-foreground" };
                return (
                  <div key={log.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium text-sm ${actionInfo.color}`}>{actionInfo.label}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
                    </div>
                    {log.old_plan_name && log.new_plan_name && (
                      <p className="text-xs text-muted-foreground">الخطة: {log.old_plan_name} ← {log.new_plan_name}</p>
                    )}
                    {log.old_status && log.new_status && (
                      <p className="text-xs text-muted-foreground">الحالة: {STATUS_MAP[log.old_status]?.label || log.old_status} ← {STATUS_MAP[log.new_status]?.label || log.new_status}</p>
                    )}
                    {log.notes && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-1.5">{log.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubscriptions;
