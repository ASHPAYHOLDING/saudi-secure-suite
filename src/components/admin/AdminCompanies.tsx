import { useEffect, useState, useMemo } from "react";
import {
  Building2, Search, Eye, Download, MapPin, Users as UsersIcon, FileText,
  CreditCard, Shield, Power, PowerOff, ArrowUpDown, Zap, BarChart3,
  ChevronDown, Settings2, TrendingUp, HardDrive, Activity, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, MoreVertical, ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

interface Tenant {
  id: string;
  name: string;
  name_en: string | null;
  email: string | null;
  phone: string | null;
  cr_number: string | null;
  vat_number: string | null;
  status: string;
  created_at: string;
  vat_registered: boolean;
  industry: string | null;
  address_city: string | null;
  zatca_phase1_enabled: boolean;
}

interface TenantInvoice {
  id: string;
  invoice_number: string;
  status: string;
  grand_total: number;
  invoice_date: string;
}

interface TenantContract {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  total_value: number;
}

interface TenantMember {
  user_id: string;
  role: string;
  joined_at: string;
  full_name?: string;
  email?: string;
}

interface SubscriptionPlan {
  id: string;
  name_ar: string;
  slug: string;
  price_monthly: number;
  price_yearly: number | null;
  max_users: number | null;
  max_invoices: number | null;
  max_storage_gb: number | null;
}

interface TenantSubscription {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_end: string;
  current_period_start: string;
}

interface TenantUsage {
  invoicesCount: number;
  membersCount: number;
  contractsCount: number;
  totalRevenue: number;
  paidInvoices: number;
  overdueInvoices: number;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك", admin: "مدير", manager: "مدير قسم", hr: "موارد بشرية", accountant: "محاسب", member: "موظف"
};

const AdminCompanies = () => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "created_at" | "members" | "invoices">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Counts
  const [memberCount, setMemberCount] = useState<Record<string, number>>({});
  const [invoiceCount, setInvoiceCount] = useState<Record<string, number>>({});
  const [contractCount, setContractCount] = useState<Record<string, number>>({});
  const [subscriptions, setSubscriptions] = useState<Record<string, TenantSubscription>>({});
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  // Detail dialog
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [detailInvoices, setDetailInvoices] = useState<TenantInvoice[]>([]);
  const [detailContracts, setDetailContracts] = useState<TenantContract[]>([]);
  const [detailMembers, setDetailMembers] = useState<TenantMember[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tenantUsage, setTenantUsage] = useState<TenantUsage | null>(null);

  // Action dialogs
  const [planChangeDialog, setPlanChangeDialog] = useState<{ tenant: Tenant; sub: TenantSubscription | null } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedBillingCycle, setSelectedBillingCycle] = useState("monthly");
  const [suspendDialog, setSuspendDialog] = useState<Tenant | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();

    // Realtime subscription for tenants, members, invoices, contracts, subscriptions
    const channel = supabase
      .channel('admin-companies-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_members' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [tenantsRes, membersRes, invoicesRes, contractsRes, subsRes, plansRes] = await Promise.all([
      supabase.from("tenants").select("id, name, name_en, email, phone, cr_number, vat_number, status, created_at, vat_registered, industry, address_city, zatca_phase1_enabled").order("created_at", { ascending: false }),
      supabase.from("tenant_members").select("tenant_id"),
      supabase.from("invoices").select("tenant_id"),
      supabase.from("contracts").select("tenant_id"),
      supabase.from("subscriptions").select("id, tenant_id, plan_id, status, billing_cycle, current_period_end, current_period_start"),
      supabase.from("subscription_plans").select("id, name_ar, slug, price_monthly, price_yearly, max_users, max_invoices, max_storage_gb"),
    ]);

    if (tenantsRes.data) setTenants(tenantsRes.data);
    if (plansRes.data) setPlans(plansRes.data as SubscriptionPlan[]);

    const count = (data: { tenant_id: string }[] | null) => {
      const c: Record<string, number> = {};
      data?.forEach((r) => { c[r.tenant_id] = (c[r.tenant_id] || 0) + 1; });
      return c;
    };
    setMemberCount(count(membersRes.data));
    setInvoiceCount(count(invoicesRes.data));
    setContractCount(count(contractsRes.data));

    if (subsRes.data) {
      const subMap: Record<string, TenantSubscription> = {};
      (subsRes.data as any[]).forEach((s) => { subMap[s.tenant_id] = s; });
      setSubscriptions(subMap);
    }
    setLoading(false);
  };

  const openDetail = async (tenant: Tenant) => {
    setSelected(tenant);
    setDetailTab("overview");
    setDetailLoading(true);

    const [invRes, conRes, memRes, allInvRes] = await Promise.all([
      supabase.from("invoices").select("id, invoice_number, status, grand_total, invoice_date").eq("tenant_id", tenant.id).order("invoice_date", { ascending: false }).limit(20),
      supabase.from("contracts").select("id, contract_number, title, status, total_value").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("tenant_members").select("user_id, role, joined_at").eq("tenant_id", tenant.id),
      supabase.from("invoices").select("grand_total, status").eq("tenant_id", tenant.id),
    ]);

    setDetailInvoices((invRes.data as TenantInvoice[]) || []);
    setDetailContracts((conRes.data as TenantContract[]) || []);

    // Usage stats
    const invoices = allInvRes.data || [];
    setTenantUsage({
      invoicesCount: invoices.length,
      membersCount: memRes.data?.length || 0,
      contractsCount: conRes.data?.length || 0,
      totalRevenue: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.grand_total), 0),
      paidInvoices: invoices.filter((i) => i.status === "paid").length,
      overdueInvoices: invoices.filter((i) => i.status === "overdue").length,
    });

    // Enrich members
    if (memRes.data && memRes.data.length > 0) {
      const userIds = memRes.data.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      const profileMap: Record<string, { full_name: string; email: string }> = {};
      profiles?.forEach((p) => { profileMap[p.id] = p; });
      setDetailMembers(memRes.data.map((m) => ({
        ...m,
        full_name: profileMap[m.user_id]?.full_name || "—",
        email: profileMap[m.user_id]?.email || "—",
      })));
    } else {
      setDetailMembers([]);
    }
    setDetailLoading(false);
  };

  // === ACTIONS ===
  const toggleStatus = async (tenant: Tenant, reason?: string) => {
    setActionLoading(true);
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("tenants").update({ status: newStatus }).eq("id", tenant.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      setActionLoading(false);
      return;
    }
    // Log the action
    if (user) {
      await supabase.from("audit_logs").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        action: newStatus === "suspended" ? "suspend_tenant" : "activate_tenant",
        entity_type: "tenant",
        entity_id: tenant.id,
        entity_label: tenant.name,
        changes: reason ? { reason } : null,
      });
    }
    setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t)));
    if (selected?.id === tenant.id) setSelected({ ...tenant, status: newStatus });
    toast({
      title: newStatus === "suspended" ? "تم تعليق الشركة" : "تم تفعيل الشركة",
      description: tenant.name,
    });
    setSuspendDialog(null);
    setSuspendReason("");
    setActionLoading(false);
  };

  const changePlan = async () => {
    if (!planChangeDialog || !selectedPlanId) return;
    setActionLoading(true);
    const { tenant, sub } = planChangeDialog;
    const newPlan = plans.find((p) => p.id === selectedPlanId);

    if (sub) {
      const { error } = await supabase.from("subscriptions").update({
        plan_id: selectedPlanId,
        billing_cycle: selectedBillingCycle,
      }).eq("id", sub.id);
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setActionLoading(false);
        return;
      }
      // Log
      if (user) {
        await supabase.from("subscription_logs").insert({
          subscription_id: sub.id,
          tenant_id: tenant.id,
          action: "plan_change",
          performed_by: user.id,
          old_plan_id: sub.plan_id,
          new_plan_id: selectedPlanId,
          old_billing_cycle: sub.billing_cycle,
          new_billing_cycle: selectedBillingCycle,
          notes: `تغيير الخطة بواسطة السوبر أدمن إلى ${newPlan?.name_ar}`,
        });
      }
      setSubscriptions((prev) => ({
        ...prev,
        [tenant.id]: { ...sub, plan_id: selectedPlanId, billing_cycle: selectedBillingCycle },
      }));
    } else {
      // Create new subscription
      const { data: newSub, error } = await supabase.from("subscriptions").insert({
        tenant_id: tenant.id,
        plan_id: selectedPlanId,
        billing_cycle: selectedBillingCycle,
        status: "active",
      }).select().single();
      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setActionLoading(false);
        return;
      }
      if (newSub) {
        setSubscriptions((prev) => ({ ...prev, [tenant.id]: newSub as any }));
        if (user) {
          await supabase.from("subscription_logs").insert({
            subscription_id: newSub.id,
            tenant_id: tenant.id,
            action: "create",
            performed_by: user.id,
            new_plan_id: selectedPlanId,
            new_billing_cycle: selectedBillingCycle,
            new_status: "active",
            notes: `إنشاء اشتراك بواسطة السوبر أدمن - ${newPlan?.name_ar}`,
          });
        }
      }
    }

    toast({ title: "تم تحديث الاشتراك", description: `تم تغيير خطة ${tenant.name} إلى ${newPlan?.name_ar}` });
    setPlanChangeDialog(null);
    setActionLoading(false);
  };

  const exportCSV = () => {
    const headers = ["الاسم", "الاسم الانجليزي", "البريد", "الهاتف", "السجل التجاري", "الرقم الضريبي", "المدينة", "القطاع", "الحالة", "الأعضاء", "الفواتير", "العقود", "تاريخ التسجيل"];
    const rows = filtered.map((t) => [
      t.name, t.name_en || "", t.email || "", t.phone || "", t.cr_number || "", t.vat_number || "",
      t.address_city || "", t.industry || "", t.status === "active" ? "نشط" : "معلق",
      memberCount[t.id] || 0, invoiceCount[t.id] || 0, contractCount[t.id] || 0,
      new Date(t.created_at).toLocaleDateString("ar-SA"),
    ]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `companies-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === FILTERING & SORTING ===
  const industries = useMemo(() => {
    const set = new Set(tenants.map((t) => t.industry).filter(Boolean) as string[]);
    return Array.from(set);
  }, [tenants]);

  const filtered = useMemo(() => {
    let result = tenants.filter((t) => {
      const matchSearch = !search || t.name.includes(search) || t.name_en?.toLowerCase().includes(search.toLowerCase()) || t.email?.includes(search) || t.cr_number?.includes(search);
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchIndustry = industryFilter === "all" || t.industry === industryFilter;
      return matchSearch && matchStatus && matchIndustry;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name, "ar");
      else if (sortBy === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortBy === "members") cmp = (memberCount[a.id] || 0) - (memberCount[b.id] || 0);
      else if (sortBy === "invoices") cmp = (invoiceCount[a.id] || 0) - (invoiceCount[b.id] || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [tenants, search, statusFilter, industryFilter, sortBy, sortDir, memberCount, invoiceCount]);

  const getPlanName = (planId: string) => plans.find((p) => p.id === planId)?.name_ar || "—";
  const getPlan = (planId: string) => plans.find((p) => p.id === planId);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { active: "bg-emerald-500/10 text-emerald-600 border-0", suspended: "bg-destructive/10 text-destructive border-0", inactive: "bg-muted text-muted-foreground border-0" };
    const labels: Record<string, string> = { active: "نشط", suspended: "معلق", inactive: "غير نشط" };
    return <Badge variant="secondary" className={map[status] || map.active}>{labels[status] || status}</Badge>;
  };

  const invoiceStatusBadge = (status: string) => {
    const map: Record<string, string> = { draft: "bg-muted text-muted-foreground", sent: "bg-blue-500/10 text-blue-600", paid: "bg-emerald-500/10 text-emerald-600", cancelled: "bg-destructive/10 text-destructive", overdue: "bg-amber-500/10 text-amber-600" };
    const labels: Record<string, string> = { draft: "مسودة", sent: "مرسلة", paid: "مدفوعة", cancelled: "ملغية", overdue: "متأخرة" };
    return <Badge variant="secondary" className={map[status] || ""}>{labels[status] || status}</Badge>;
  };

  const subStatusBadge = (status: string) => {
    const map: Record<string, string> = { active: "bg-emerald-500/10 text-emerald-600", trial: "bg-amber-500/10 text-amber-600", expired: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground" };
    const labels: Record<string, string> = { active: "نشط", trial: "تجريبي", expired: "منتهي", cancelled: "ملغي" };
    return <Badge variant="secondary" className={map[status] || ""}>{labels[status] || status}</Badge>;
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const suspendedCount = tenants.filter((t) => t.status === "suspended").length;
  const totalMembers = Object.values(memberCount).reduce((a, b) => a + b, 0);
  const totalInvoices = Object.values(invoiceCount).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
            إدارة الشركات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة شاملة لجميع الشركات المسجلة في المنصة</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw size={14} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download size={14} /> تصدير CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "إجمالي الشركات", value: tenants.length, icon: Building2, color: "text-accent", bg: "bg-accent/10", sub: `${activeCount} نشط · ${suspendedCount} معلق` },
          { title: "إجمالي المستخدمين", value: totalMembers, icon: UsersIcon, color: "text-blue-500", bg: "bg-blue-500/10", sub: `متوسط ${tenants.length > 0 ? (totalMembers / tenants.length).toFixed(1) : 0} / شركة` },
          { title: "إجمالي الفواتير", value: totalInvoices, icon: FileText, color: "text-violet-500", bg: "bg-violet-500/10", sub: `${Object.values(contractCount).reduce((a, b) => a + b, 0)} عقد` },
          { title: "الاشتراكات", value: Object.keys(subscriptions).length, icon: CreditCard, color: "text-emerald-500", bg: "bg-emerald-500/10", sub: `${Object.values(subscriptions).filter((s) => s.status === "active").length} نشط` },
        ].map((card) => (
          <Card key={card.title} className="group hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.bg} transition-transform group-hover:scale-110`}>
                <card.icon size={20} className={card.color} />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? "..." : card.value}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم أو البريد أو السجل التجاري..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="suspended">معلق</SelectItem>
              </SelectContent>
            </Select>
            {industries.length > 0 && (
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="القطاع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع القطاعات</SelectItem>
                  {industries.map((ind) => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="ترتيب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">تاريخ التسجيل</SelectItem>
                <SelectItem value="name">الاسم</SelectItem>
                <SelectItem value="members">عدد الأعضاء</SelectItem>
                <SelectItem value="invoices">عدد الفواتير</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
              <ArrowUpDown size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{filtered.length} شركة من أصل {tenants.length}</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الشركة</TableHead>
                    <TableHead className="text-right">الاشتراك</TableHead>
                    <TableHead className="text-right">الأعضاء</TableHead>
                    <TableHead className="text-right">الفواتير</TableHead>
                    <TableHead className="text-right">العقود</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التسجيل</TableHead>
                    <TableHead className="text-right w-[140px]">إجراءات سريعة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const sub = subscriptions[t.id];
                    return (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openDetail(t)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                              <Building2 size={15} className="text-accent" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{t.name}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                {t.name_en && <span>{t.name_en}</span>}
                                {t.address_city && <span className="flex items-center gap-0.5"><MapPin size={10} />{t.address_city}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[11px]">{getPlanName(sub.plan_id)}</Badge>
                              {subStatusBadge(sub.status)}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">بدون اشتراك</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{memberCount[t.id] || 0}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{invoiceCount[t.id] || 0}</Badge></TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{contractCount[t.id] || 0}</Badge></TableCell>
                        <TableCell>{statusBadge(t.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openDetail(t)}>
                              <Eye size={15} />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                  <MoreVertical size={15} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => openDetail(t)} className="gap-2">
                                  <Eye size={14} /> عرض التفاصيل
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setPlanChangeDialog({ tenant: t, sub: sub || null });
                                  setSelectedPlanId(sub?.plan_id || "");
                                  setSelectedBillingCycle(sub?.billing_cycle || "monthly");
                                }} className="gap-2">
                                  <ArrowUpDown size={14} /> تغيير الخطة
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {t.status === "active" ? (
                                  <DropdownMenuItem onClick={() => setSuspendDialog(t)} className="gap-2 text-destructive focus:text-destructive">
                                    <PowerOff size={14} /> تعليق الشركة
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => toggleStatus(t)} className="gap-2 text-emerald-600 focus:text-emerald-600">
                                    <Power size={14} /> تفعيل الشركة
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                        لا توجد شركات مطابقة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================== DETAIL DIALOG =================== */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir="rtl" className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {selected && (
            <>
              {/* Header */}
              <div className="sticky top-0 z-10 bg-card border-b p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                      <Building2 size={22} className="text-accent" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        {selected.name}
                        {statusBadge(selected.status)}
                      </h2>
                      <p className="text-xs text-muted-foreground">{selected.name_en || selected.industry || "شركة مسجلة"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        const sub = subscriptions[selected.id];
                        setPlanChangeDialog({ tenant: selected, sub: sub || null });
                        setSelectedPlanId(sub?.plan_id || "");
                        setSelectedBillingCycle(sub?.billing_cycle || "monthly");
                      }}
                    >
                      <ArrowUpDown size={13} /> تغيير الخطة
                    </Button>
                    {selected.status === "active" ? (
                      <Button size="sm" variant="destructive" className="gap-1.5 text-xs" onClick={() => setSuspendDialog(selected)}>
                        <PowerOff size={13} /> تعليق
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => toggleStatus(selected)}>
                        <Power size={13} /> تفعيل
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="px-5 pb-5">
                <TabsList className="w-full mt-2">
                  <TabsTrigger value="overview" className="flex-1 gap-1.5"><BarChart3 size={14} /> نظرة عامة</TabsTrigger>
                  <TabsTrigger value="info" className="flex-1 gap-1.5"><Building2 size={14} /> المعلومات</TabsTrigger>
                  <TabsTrigger value="members" className="flex-1 gap-1.5"><UsersIcon size={14} /> الأعضاء ({detailMembers.length})</TabsTrigger>
                  <TabsTrigger value="invoices" className="flex-1 gap-1.5"><FileText size={14} /> الفواتير ({detailInvoices.length})</TabsTrigger>
                  <TabsTrigger value="contracts" className="flex-1 gap-1.5"><CreditCard size={14} /> العقود ({detailContracts.length})</TabsTrigger>
                </TabsList>

                {detailLoading ? (
                  <div className="flex justify-center p-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
                  </div>
                ) : (
                  <>
                    {/* === OVERVIEW TAB === */}
                    <TabsContent value="overview" className="space-y-4 mt-4">
                      {/* Usage KPIs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "المستخدمين", value: tenantUsage?.membersCount || 0, limit: getPlan(subscriptions[selected.id]?.plan_id)?.max_users, icon: UsersIcon, color: "text-blue-500" },
                          { label: "الفواتير", value: tenantUsage?.invoicesCount || 0, limit: getPlan(subscriptions[selected.id]?.plan_id)?.max_invoices, icon: FileText, color: "text-violet-500" },
                          { label: "العقود", value: tenantUsage?.contractsCount || 0, limit: null, icon: CreditCard, color: "text-amber-500" },
                          { label: "الإيرادات", value: tenantUsage?.totalRevenue || 0, limit: null, icon: TrendingUp, color: "text-emerald-500", isCurrency: true },
                        ].map((kpi) => (
                          <Card key={kpi.label}>
                            <CardContent className="p-4 text-center">
                              <kpi.icon size={20} className={`mx-auto mb-2 ${kpi.color}`} />
                              <p className="text-xl font-bold">
                                {kpi.isCurrency ? formatCurrency(kpi.value) : kpi.value}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                              {kpi.limit && (
                                <div className="mt-2">
                                  <Progress value={Math.min((kpi.value / kpi.limit) * 100, 100)} className="h-1.5" />
                                  <p className="text-[10px] text-muted-foreground mt-1">{kpi.value} / {kpi.limit}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Subscription Info */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard size={16} className="text-accent" /> معلومات الاشتراك
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {subscriptions[selected.id] ? (() => {
                            const sub = subscriptions[selected.id];
                            const plan = getPlan(sub.plan_id);
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">الخطة</p>
                                  <p className="font-semibold">{plan?.name_ar || "—"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">الحالة</p>
                                  <div className="mt-0.5">{subStatusBadge(sub.status)}</div>
                                </div>
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">دورة الفوترة</p>
                                  <p className="font-semibold">{sub.billing_cycle === "yearly" ? "سنوي" : sub.billing_cycle === "quarterly" ? "ربع سنوي" : "شهري"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/40 p-3">
                                  <p className="text-[11px] text-muted-foreground">ينتهي في</p>
                                  <p className="font-semibold">{new Date(sub.current_period_end).toLocaleDateString("ar-SA")}</p>
                                </div>
                              </div>
                            );
                          })() : (
                            <p className="text-sm text-muted-foreground text-center py-4">لا يوجد اشتراك — يمكنك إنشاء اشتراك من زر "تغيير الخطة"</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Invoice Summary */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Activity size={16} className="text-accent" /> ملخص الفواتير
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-lg bg-emerald-500/10 p-3">
                              <p className="text-lg font-bold text-emerald-600">{tenantUsage?.paidInvoices || 0}</p>
                              <p className="text-[11px] text-muted-foreground">مدفوعة</p>
                            </div>
                            <div className="rounded-lg bg-amber-500/10 p-3">
                              <p className="text-lg font-bold text-amber-600">{tenantUsage?.overdueInvoices || 0}</p>
                              <p className="text-[11px] text-muted-foreground">متأخرة</p>
                            </div>
                            <div className="rounded-lg bg-accent/10 p-3">
                              <p className="text-lg font-bold text-accent">{formatCurrency(tenantUsage?.totalRevenue || 0)}</p>
                              <p className="text-[11px] text-muted-foreground">إجمالي الإيرادات</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* === INFO TAB === */}
                    <TabsContent value="info" className="mt-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <InfoRow label="الاسم" value={selected.name} />
                        <InfoRow label="الاسم (EN)" value={selected.name_en} />
                        <InfoRow label="البريد" value={selected.email} />
                        <InfoRow label="الهاتف" value={selected.phone} />
                        <InfoRow label="السجل التجاري" value={selected.cr_number} />
                        <InfoRow label="الرقم الضريبي" value={selected.vat_number} />
                        <InfoRow label="المدينة" value={selected.address_city} />
                        <InfoRow label="القطاع" value={selected.industry} />
                        <InfoRow label="مسجل بالضريبة" value={selected.vat_registered ? "نعم ✅" : "لا"} />
                        <InfoRow label="ZATCA المرحلة 1" value={selected.zatca_phase1_enabled ? "مفعل ✅" : "غير مفعل"} />
                        <InfoRow label="تاريخ التسجيل" value={new Date(selected.created_at).toLocaleDateString("ar-SA")} />
                        <InfoRow label="الحالة" value={selected.status === "active" ? "نشط ✅" : "معلق ⛔"} />
                      </div>
                    </TabsContent>

                    {/* === MEMBERS TAB === */}
                    <TabsContent value="members" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">الاسم</TableHead>
                            <TableHead className="text-right">البريد</TableHead>
                            <TableHead className="text-right">الدور</TableHead>
                            <TableHead className="text-right">تاريخ الانضمام</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailMembers.map((m) => (
                            <TableRow key={m.user_id}>
                              <TableCell className="font-medium">{m.full_name}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{m.email}</TableCell>
                              <TableCell><Badge variant="secondary">{ROLE_LABELS[m.role] || m.role}</Badge></TableCell>
                              <TableCell className="text-muted-foreground text-xs">{new Date(m.joined_at).toLocaleDateString("ar-SA")}</TableCell>
                            </TableRow>
                          ))}
                          {detailMembers.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد أعضاء</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    {/* === INVOICES TAB === */}
                    <TabsContent value="invoices" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">رقم الفاتورة</TableHead>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">المبلغ</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailInvoices.map((inv) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium text-xs">{inv.invoice_number}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{new Date(inv.invoice_date).toLocaleDateString("ar-SA")}</TableCell>
                              <TableCell className="text-xs">{formatCurrency(inv.grand_total)}</TableCell>
                              <TableCell>{invoiceStatusBadge(inv.status)}</TableCell>
                            </TableRow>
                          ))}
                          {detailInvoices.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد فواتير</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    {/* === CONTRACTS TAB === */}
                    <TabsContent value="contracts" className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">رقم العقد</TableHead>
                            <TableHead className="text-right">العنوان</TableHead>
                            <TableHead className="text-right">القيمة</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailContracts.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium text-xs">{c.contract_number}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">{c.title}</TableCell>
                              <TableCell className="text-xs">{formatCurrency(c.total_value)}</TableCell>
                              <TableCell>{statusBadge(c.status)}</TableCell>
                            </TableRow>
                          ))}
                          {detailContracts.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد عقود</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =================== SUSPEND DIALOG =================== */}
      <Dialog open={!!suspendDialog} onOpenChange={() => { setSuspendDialog(null); setSuspendReason(""); }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <PowerOff size={20} /> تعليق الشركة
            </DialogTitle>
            <DialogDescription>
              سيتم تعليق جميع خدمات الشركة <span className="font-semibold">{suspendDialog?.name}</span>. هل أنت متأكد؟
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>سبب التعليق (اختياري)</Label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="مثال: عدم سداد رسوم الاشتراك..."
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setSuspendDialog(null); setSuspendReason(""); }}>إلغاء</Button>
            <Button variant="destructive" onClick={() => suspendDialog && toggleStatus(suspendDialog, suspendReason)} disabled={actionLoading}>
              {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <PowerOff size={14} />}
              <span className="mr-1.5">تأكيد التعليق</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================== PLAN CHANGE DIALOG =================== */}
      <Dialog open={!!planChangeDialog} onOpenChange={() => setPlanChangeDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown size={20} className="text-accent" />
              تغيير خطة الاشتراك
            </DialogTitle>
            <DialogDescription>
              تغيير خطة <span className="font-semibold">{planChangeDialog?.tenant.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {planChangeDialog?.sub && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-muted-foreground text-xs mb-1">الخطة الحالية</p>
                <p className="font-semibold">{getPlanName(planChangeDialog.sub.plan_id)} — {planChangeDialog.sub.billing_cycle === "yearly" ? "سنوي" : "شهري"}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>الخطة الجديدة</Label>
              <div className="grid gap-2">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${selectedPlanId === plan.id ? "border-accent bg-accent/5 ring-1 ring-accent" : "hover:bg-muted/30"}`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{plan.name_ar}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.max_users ? `${plan.max_users} مستخدم` : "غير محدود"} · {plan.max_invoices ? `${plan.max_invoices} فاتورة` : "غير محدود"}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold">{formatCurrency(plan.price_monthly)}</p>
                        <p className="text-[10px] text-muted-foreground">/ شهر</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>دورة الفوترة</Label>
              <Select value={selectedBillingCycle} onValueChange={setSelectedBillingCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="quarterly">ربع سنوي</SelectItem>
                  <SelectItem value="yearly">سنوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPlanChangeDialog(null)}>إلغاء</Button>
            <Button onClick={changePlan} disabled={!selectedPlanId || actionLoading} className="gap-1.5">
              {actionLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              تأكيد التغيير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="rounded-lg border p-3">
    <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
    <p className="font-medium text-sm">{value || "—"}</p>
  </div>
);

export default AdminCompanies;
