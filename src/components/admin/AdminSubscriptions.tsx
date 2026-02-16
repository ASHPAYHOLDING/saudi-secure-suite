import { useEffect, useState } from "react";
import { CreditCard, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  tenant_name?: string;
  plan_name?: string;
}

interface Plan {
  id: string;
  name_ar: string;
  slug: string;
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  active: { label: "نشط", class: "bg-emerald-100 text-emerald-700" },
  trial: { label: "تجريبي", class: "bg-amber-100 text-amber-700" },
  cancelled: { label: "ملغي", class: "bg-destructive/10 text-destructive" },
  expired: { label: "منتهي", class: "bg-muted text-muted-foreground" },
  past_due: { label: "متأخر", class: "bg-red-100 text-red-700" },
};

const AdminSubscriptions = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      const [subsRes, plansRes, tenantsRes] = await Promise.all([
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("subscription_plans").select("id, name_ar, slug"),
        supabase.from("tenants").select("id, name"),
      ]);

      const tenantMap: Record<string, string> = {};
      tenantsRes.data?.forEach((t) => { tenantMap[t.id] = t.name; });

      const planMap: Record<string, string> = {};
      plansRes.data?.forEach((p) => { planMap[p.id] = p.name_ar; });

      if (subsRes.data) {
        setSubs(subsRes.data.map((s) => ({
          ...s,
          tenant_name: tenantMap[s.tenant_id] || "غير معروف",
          plan_name: planMap[s.plan_id] || "غير معروف",
        })));
      }
      if (plansRes.data) setPlans(plansRes.data);
      setLoading(false);
    };
    fetch();
  }, []);

  const updateStatus = async (subId: string, newStatus: string) => {
    const { error } = await supabase.from("subscriptions").update({ status: newStatus }).eq("id", subId);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setSubs((prev) => prev.map((s) => (s.id === subId ? { ...s, status: newStatus } : s)));
      toast({ title: "تم التحديث", description: "تم تحديث حالة الاشتراك بنجاح" });
    }
  };

  const updatePlan = async (subId: string, planId: string) => {
    const { error } = await supabase.from("subscriptions").update({ plan_id: planId }).eq("id", subId);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      const planName = plans.find((p) => p.id === planId)?.name_ar || "";
      setSubs((prev) => prev.map((s) => (s.id === subId ? { ...s, plan_id: planId, plan_name: planName } : s)));
      toast({ title: "تم التحديث", description: "تم تغيير خطة الاشتراك" });
    }
  };

  const filtered = subs.filter((s) => {
    const matchSearch = s.tenant_name?.includes(search) || s.plan_name?.includes(search);
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">إدارة الاشتراكات</h1>
        <p className="text-sm text-muted-foreground">عرض وإدارة اشتراكات جميع الشركات</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {Object.entries(STATUS_MAP).map(([key, { label, class: cls }]) => {
          const count = subs.filter((s) => s.status === key).length;
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(key === statusFilter ? "all" : key)}>
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Badge className={cls}>{count}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="ابحث بالشركة أو الخطة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
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
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">انتهاء الفترة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.tenant_name}</TableCell>
                    <TableCell>
                      <Select value={s.plan_id} onValueChange={(v) => updatePlan(s.id, v)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_ar}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {{ monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" }[s.billing_cycle] || s.billing_cycle}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_MAP[s.status]?.class || ""}>{STATUS_MAP[s.status]?.label || s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(s.current_period_end).toLocaleDateString("ar-SA")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {s.status !== "active" && (
                          <Button size="sm" variant="default" onClick={() => updateStatus(s.id, "active")}>تفعيل</Button>
                        )}
                        {s.status === "active" && (
                          <Button size="sm" variant="destructive" onClick={() => updateStatus(s.id, "cancelled")}>إلغاء</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد اشتراكات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscriptions;
