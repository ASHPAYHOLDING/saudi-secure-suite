import { useEffect, useState } from "react";
import { CreditCard, Search, TrendingUp, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

const STATUS_MAP: Record<string, { label: string; class: string; icon: string }> = {
  active: { label: "نشط", class: "bg-emerald-100 text-emerald-700", icon: "✅" },
  trial: { label: "تجريبي", class: "bg-amber-100 text-amber-700", icon: "⏳" },
  cancelled: { label: "ملغي", class: "bg-destructive/10 text-destructive", icon: "❌" },
  expired: { label: "منتهي", class: "bg-muted text-muted-foreground", icon: "⏰" },
  past_due: { label: "متأخر", class: "bg-red-100 text-red-700", icon: "⚠️" },
};

const CYCLE_LABELS: Record<string, string> = { monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };

const AdminSubscriptions = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editCycle, setEditCycle] = useState("");
  const [editStatus, setEditStatus] = useState("");

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, []);

  const openEdit = (sub: Subscription) => {
    setEditSub(sub);
    setEditPlan(sub.plan_id);
    setEditCycle(sub.billing_cycle);
    setEditStatus(sub.status);
  };

  const saveEdit = async () => {
    if (!editSub) return;
    const { error } = await supabase.from("subscriptions").update({
      plan_id: editPlan, billing_cycle: editCycle, status: editStatus,
    }).eq("id", editSub.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      const planName = plans.find((p) => p.id === editPlan)?.name_ar || "";
      setSubs((prev) => prev.map((s) => s.id === editSub.id ? { ...s, plan_id: editPlan, plan_name: planName, billing_cycle: editCycle, status: editStatus } : s));
      toast({ title: "تم الحفظ", description: "تم تحديث الاشتراك بنجاح" });
      setEditSub(null);
    }
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

  // Expiring soon (within 7 days)
  const now = new Date();
  const expiringSoon = subs.filter((s) => {
    const end = new Date(s.current_period_end);
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 7 && s.status === "active";
  });

  // Plan distribution chart
  const planChartData = plans.map((p) => ({
    name: p.name_ar,
    active: subs.filter((s) => s.plan_id === p.id && s.status === "active").length,
    trial: subs.filter((s) => s.plan_id === p.id && s.status === "trial").length,
  }));

  const statusCounts = Object.fromEntries(Object.keys(STATUS_MAP).map((k) => [k, subs.filter((s) => s.status === k).length]));

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">إدارة الاشتراكات</h1>
        <p className="text-sm text-muted-foreground">عرض وإدارة اشتراكات جميع الشركات</p>
      </div>

      {/* Revenue + Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-l from-emerald-500/60 to-transparent" />
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2"><DollarSign size={20} className="text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold">{monthlyRevenue.toLocaleString("ar-SA")} <span className="text-sm font-normal text-muted-foreground">ر.س/شهر</span></p>
                <p className="text-xs text-muted-foreground">الإيراد الشهري المتكرر</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-accent/10 p-2"><CreditCard size={20} className="text-accent" /></div><div><p className="text-2xl font-bold">{subs.length}</p><p className="text-xs text-muted-foreground">إجمالي الاشتراكات</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-amber-100 p-2"><TrendingUp size={20} className="text-amber-600" /></div><div><p className="text-2xl font-bold">{statusCounts.trial || 0}</p><p className="text-xs text-muted-foreground">فترة تجريبية</p></div></CardContent></Card>
        <Card className={expiringSoon.length > 0 ? "border-amber-200" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg p-2 ${expiringSoon.length > 0 ? "bg-amber-100" : "bg-muted"}`}><AlertTriangle size={20} className={expiringSoon.length > 0 ? "text-amber-600" : "text-muted-foreground"} /></div>
            <div><p className="text-2xl font-bold">{expiringSoon.length}</p><p className="text-xs text-muted-foreground">تنتهي خلال 7 أيام</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Status Filter */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">توزيع الاشتراكات حسب الخطة</CardTitle>
          </CardHeader>
          <CardContent>
            {planChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={planChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="active" name="نشط" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="trial" name="تجريبي" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">حالة الاشتراكات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(STATUS_MAP).map(([key, { label, class: cls, icon }]) => {
              const count = statusCounts[key] || 0;
              const pct = subs.length > 0 ? (count / subs.length) * 100 : 0;
              return (
                <div key={key} className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/30 ${statusFilter === key ? "border-accent bg-accent/5" : ""}`} onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{icon} {label}</span>
                    <Badge className={cls}>{count}</Badge>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

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
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>تعديل</Button>
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
    </div>
  );
};

export default AdminSubscriptions;
