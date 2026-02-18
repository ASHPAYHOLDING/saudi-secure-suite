import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, DollarSign, TrendingUp, Award, Download,
  Shield, ShieldOff, Edit, CheckCircle2, XCircle, Loader2,
  Eye, Clock, Wallet, Building2, AlertTriangle, BarChart3,
  Hash, ArrowUpRight, ArrowDownRight, Filter, Crown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

// ── Types ──
interface Affiliate {
  id: string;
  code: string;
  full_name: string;
  email: string;
  phone: string | null;
  commission_rate: number;
  tier: string;
  status: string;
  total_earnings: number;
  total_paid: number;
  total_pending: number;
  bank_name: string | null;
  bank_iban: string | null;
  bank_account_name: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
  user_id: string | null;
  tenant_id: string | null;
}

interface Payout {
  id: string;
  affiliate_id: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

interface FraudAttempt {
  id: string;
  affiliate_id: string | null;
  fraud_type: string;
  details: any;
  ip_address: string | null;
  severity: string;
  resolved: boolean;
  created_at: string;
}

// ── Constants ──
const TIER_OPTIONS = [
  { value: "bronze", label: "برونزي 🥉" },
  { value: "silver", label: "فضي 🥈" },
  { value: "gold", label: "ذهبي 🥇" },
  { value: "platinum", label: "بلاتيني 💎" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "bg-success/10 text-success border-success/20" },
  suspended: { label: "مجمّد", color: "bg-destructive/10 text-destructive border-destructive/20" },
  inactive: { label: "غير نشط", color: "bg-muted text-muted-foreground border-border" },
};

const PAYOUT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-warning/10 text-warning border-warning/20" },
  approved: { label: "تمت الموافقة", color: "bg-success/10 text-success border-success/20" },
  paid: { label: "تم الصرف", color: "bg-primary/10 text-primary border-primary/20" },
  rejected: { label: "مرفوض", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "منخفض", color: "bg-muted text-muted-foreground" },
  medium: { label: "متوسط", color: "bg-warning/10 text-warning" },
  high: { label: "عالي", color: "bg-orange-500/10 text-orange-500" },
  critical: { label: "حرج", color: "bg-destructive/10 text-destructive" },
};

const formatAmount = (n: number) => n.toLocaleString("ar-SA");

// ── KPI Card ──
const KPI = ({ icon: Icon, title, value, suffix, trend }: { icon: any; title: string; value: string | number; suffix?: string; trend?: number }) => (
  <Card className="border-border/50">
    <CardContent className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${trend >= 0 ? "text-success" : "text-destructive"}`}>
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground font-medium">{title}</p>
      <p className="text-lg font-bold text-foreground tabular-nums">{typeof value === "number" ? formatAmount(value) : value} {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}</p>
    </CardContent>
  </Card>
);

const AdminAffiliateManagement = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [fraudAttempts, setFraudAttempts] = useState<FraudAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("partners");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payoutFilter, setPayoutFilter] = useState("pending");

  // Edit dialog
  const [editAff, setEditAff] = useState<Affiliate | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editTier, setEditTier] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Payout processing
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: affs }, { data: pays }] = await Promise.all([
      supabase.from("affiliates").select("*").order("total_earnings", { ascending: false }),
      supabase.from("affiliate_payouts").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    // Fraud attempts table is new - use type assertion
    const { data: frauds } = await supabase.from("affiliate_fraud_attempts" as any).select("*").order("created_at", { ascending: false }).limit(100) as { data: FraudAttempt[] | null };
    setAffiliates(affs || []);
    setPayouts(pays || []);
    setFraudAttempts(frauds || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-affiliate-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliates" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_payouts" }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "affiliate_fraud_attempts" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // ── Stats ──
  const stats = useMemo(() => {
    const totalPaid = affiliates.reduce((s, a) => s + a.total_paid, 0);
    const totalPending = affiliates.reduce((s, a) => s + a.total_pending, 0);
    const totalEarnings = affiliates.reduce((s, a) => s + a.total_earnings, 0);
    const activeCount = affiliates.filter(a => a.status === "active").length;
    const pendingPayouts = payouts.filter(p => p.status === "pending").length;
    const unresolvedFraud = fraudAttempts.filter(f => !f.resolved).length;
    return { totalPaid, totalPending, totalEarnings, activeCount, total: affiliates.length, pendingPayouts, unresolvedFraud };
  }, [affiliates, payouts, fraudAttempts]);

  // ── Top 10 ──
  const top10 = useMemo(() => affiliates.slice(0, 10), [affiliates]);

  // ── Tier performance chart ──
  const tierChart = useMemo(() => {
    const byTier: Record<string, { count: number; earnings: number }> = {};
    affiliates.forEach(a => {
      if (!byTier[a.tier]) byTier[a.tier] = { count: 0, earnings: 0 };
      byTier[a.tier].count++;
      byTier[a.tier].earnings += a.total_earnings;
    });
    return Object.entries(byTier).map(([tier, data]) => ({
      tier: TIER_OPTIONS.find(t => t.value === tier)?.label || tier,
      count: data.count,
      earnings: data.earnings,
    }));
  }, [affiliates]);

  // ── Filtered affiliates ──
  const filtered = useMemo(() => {
    let result = affiliates;
    if (statusFilter !== "all") result = result.filter(a => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
    }
    return result;
  }, [affiliates, statusFilter, search]);

  // ── Filtered payouts ──
  const filteredPayouts = useMemo(() => {
    if (payoutFilter === "all") return payouts;
    return payouts.filter(p => p.status === payoutFilter);
  }, [payouts, payoutFilter]);

  // ── Actions ──
  const handleEditSave = async () => {
    if (!editAff) return;
    setEditLoading(true);
    const { error } = await supabase.from("affiliates").update({
      commission_rate: Number(editRate),
      tier: editTier,
      updated_at: new Date().toISOString(),
    }).eq("id", editAff.id);
    if (error) toast.error("فشل التحديث: " + error.message);
    else { toast.success("تم تحديث بيانات الشريك"); setEditAff(null); fetchData(); }
    setEditLoading(false);
  };

  const toggleFreeze = async (aff: Affiliate) => {
    const newStatus = aff.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("affiliates").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", aff.id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus === "suspended" ? "تم تجميد الحساب" : "تم إعادة تنشيط الحساب"); fetchData(); }
  };

  const processPayout = async (payoutId: string, action: "approve" | "reject") => {
    setProcessingId(payoutId);
    try {
      const { error } = await supabase.rpc("process_affiliate_payout", {
        _payout_id: payoutId,
        _action: action === "approve" ? "approve" : "reject",
        _admin_notes: action === "approve" ? "تمت الموافقة من لوحة الأدمن" : "مرفوض من لوحة الأدمن",
      });
      if (error) throw error;
      toast.success(action === "approve" ? "تمت الموافقة على طلب السحب" : "تم رفض طلب السحب");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
    setProcessingId(null);
  };

  // ── Excel export ──
  const exportExcel = () => {
    const data = affiliates.map(a => ({
      "الاسم": a.full_name,
      "البريد": a.email,
      "الكود": a.code,
      "النسبة %": a.commission_rate,
      "المستوى": a.tier,
      "الحالة": STATUS_MAP[a.status]?.label || a.status,
      "إجمالي الأرباح": a.total_earnings,
      "المدفوع": a.total_paid,
      "قيد الانتظار": a.total_pending,
      "البنك": a.bank_name || "",
      "IBAN": a.bank_iban || "",
      "تاريخ الانضمام": format(new Date(a.created_at), "yyyy-MM-dd"),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الشركاء");
    XLSX.writeFile(wb, `affiliates-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("تم تصدير ملف Excel");
  };

  if (loading) {
    return (
      <div dir="rtl" className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            إدارة الشركاء
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{stats.total} شريك • {stats.activeCount} نشط</p>
        </div>
        <Button onClick={exportExcel} variant="outline" className="gap-2 shrink-0">
          <Download size={16} />
          تصدير Excel
        </Button>
      </motion.div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KPI icon={DollarSign} title="إجمالي المدفوع" value={stats.totalPaid} suffix="ر.س" />
        <KPI icon={Clock} title="قيد الانتظار" value={stats.totalPending} suffix="ر.س" />
        <KPI icon={TrendingUp} title="إجمالي الأرباح" value={stats.totalEarnings} suffix="ر.س" />
        <KPI icon={Users} title="شركاء نشطون" value={stats.activeCount} />
        <KPI icon={Wallet} title="طلبات سحب معلقة" value={stats.pendingPayouts} />
        <KPI icon={AlertTriangle} title="تنبيهات احتيال" value={stats.unresolvedFraud} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-muted/50 p-1 h-auto rounded-xl">
          {[
            { value: "partners", label: "الشركاء", icon: Users },
            { value: "payouts", label: "طلبات السحب", icon: Wallet, badge: stats.pendingPayouts > 0 ? stats.pendingPayouts : undefined },
            { value: "performance", label: "الأداء", icon: BarChart3 },
            { value: "fraud", label: "الاحتيال", icon: ShieldOff, badge: stats.unresolvedFraud > 0 ? stats.unresolvedFraud : undefined },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-2">
              <tab.icon size={16} />
              {tab.label}
              {tab.badge && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{tab.badge}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ PARTNERS TAB ═══ */}
        <TabsContent value="partners" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد أو الكود..." className="ps-9 text-sm" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <Filter size={14} className="me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="suspended">مجمّد</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الشريك</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الكود</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">النسبة</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">المستوى</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الأرباح</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">المدفوع</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الحالة</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">لا يوجد شركاء</td></tr>
                  ) : filtered.map((a, idx) => {
                    const st = STATUS_MAP[a.status] || STATUS_MAP.inactive;
                    const tierLabel = TIER_OPTIONS.find(t => t.value === a.tier)?.label || a.tier;
                    return (
                      <motion.tr
                        key={a.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                      >
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-foreground text-sm">{a.full_name}</p>
                            <p className="text-[11px] text-muted-foreground">{a.email}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <code className="text-xs bg-muted/50 px-1.5 py-0.5 rounded font-mono">{a.code}</code>
                        </td>
                        <td className="p-3 text-sm font-semibold tabular-nums">{a.commission_rate}%</td>
                        <td className="p-3 text-xs">{tierLabel}</td>
                        <td className="p-3 text-sm tabular-nums font-medium">{formatAmount(a.total_earnings)} <span className="text-muted-foreground text-[10px]">ر.س</span></td>
                        <td className="p-3 text-sm tabular-nums">{formatAmount(a.total_paid)} <span className="text-muted-foreground text-[10px]">ر.س</span></td>
                        <td className="p-3"><Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge></td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditAff(a); setEditRate(String(a.commission_rate)); setEditTier(a.tier); }}>
                              <Edit size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" className={`h-7 w-7 p-0 ${a.status === "active" ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}`} onClick={() => toggleFreeze(a)}>
                              {a.status === "active" ? <ShieldOff size={14} /> : <Shield size={14} />}
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══ PAYOUTS TAB ═══ */}
        <TabsContent value="payouts" className="space-y-4 mt-0">
          <div className="flex gap-2">
            <Select value={payoutFilter} onValueChange={setPayoutFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="pending">قيد المراجعة</SelectItem>
                <SelectItem value="approved">تمت الموافقة</SelectItem>
                <SelectItem value="paid">مصروف</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الشريك</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">المبلغ</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الطريقة</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">التاريخ</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الحالة</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayouts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد طلبات</td></tr>
                  ) : filteredPayouts.map((p, idx) => {
                    const aff = affiliates.find(a => a.id === p.affiliate_id);
                    const st = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                    return (
                      <motion.tr
                        key={p.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                      >
                        <td className="p-3">
                          <p className="font-medium text-sm">{aff?.full_name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{aff?.email}</p>
                        </td>
                        <td className="p-3 font-bold tabular-nums text-sm">{formatAmount(p.amount)} ر.س</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            {p.method === "wallet" ? <Wallet size={14} className="text-primary" /> : <Building2 size={14} className="text-primary" />}
                            {p.method === "wallet" ? "محفظة" : "بنكي"}
                          </div>
                        </td>
                        <td className="p-3 text-xs tabular-nums text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy", { locale: ar })}</td>
                        <td className="p-3"><Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge></td>
                        <td className="p-3">
                          {p.status === "pending" ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success hover:text-success" disabled={processingId === p.id} onClick={() => processPayout(p.id, "approve")}>
                                {processingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" disabled={processingId === p.id} onClick={() => processPayout(p.id, "reject")}>
                                <XCircle size={14} />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══ PERFORMANCE TAB ═══ */}
        <TabsContent value="performance" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Tier chart */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">الأداء حسب المستوى</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="tier" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(val: number) => [`${formatAmount(val)} ر.س`, "الأرباح"]} />
                      <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top 10 */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award size={16} className="text-primary" />
                  أفضل 10 شركاء
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {top10.map((a, idx) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{a.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{a.code} • {a.commission_rate}%</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground">{formatAmount(a.total_earnings)} <span className="text-[10px] text-muted-foreground">ر.س</span></span>
                  </motion.div>
                ))}
                {top10.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا يوجد شركاء</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ FRAUD TAB ═══ */}
        <TabsContent value="fraud" className="space-y-4 mt-0">
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" />
                سجل محاولات الاحتيال
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">التاريخ</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">النوع</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الشدة</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">IP</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">التفاصيل</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {fraudAttempts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد محاولات</td></tr>
                  ) : fraudAttempts.map((f, idx) => {
                    const sev = SEVERITY_MAP[f.severity] || SEVERITY_MAP.medium;
                    const fraudLabels: Record<string, string> = {
                      self_referral: "إحالة ذاتية",
                      duplicate_ip: "IP مكرر",
                      duplicate_account: "حساب مكرر",
                      cooling_bypass: "تجاوز التبريد",
                    };
                    return (
                      <motion.tr
                        key={f.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                      >
                        <td className="p-3 text-xs tabular-nums">{format(new Date(f.created_at), "dd/MM/yyyy HH:mm")}</td>
                        <td className="p-3 text-xs font-medium">{fraudLabels[f.fraud_type] || f.fraud_type}</td>
                        <td className="p-3"><Badge variant="outline" className={`text-[10px] ${sev.color}`}>{sev.label}</Badge></td>
                        <td className="p-3 text-xs font-mono text-muted-foreground">{f.ip_address || "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{JSON.stringify(f.details)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={`text-[10px] ${f.resolved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                            {f.resolved ? "تم الحل" : "مفتوح"}
                          </Badge>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editAff} onOpenChange={() => setEditAff(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit size={18} className="text-primary" />
              تعديل بيانات الشريك
            </DialogTitle>
          </DialogHeader>
          {editAff && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="font-semibold text-sm">{editAff.full_name}</p>
                <p className="text-xs text-muted-foreground">{editAff.email} • {editAff.code}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">نسبة العمولة %</label>
                <Input type="number" value={editRate} onChange={e => setEditRate(e.target.value)} min={0} max={50} step={0.5} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">المستوى</label>
                <Select value={editTier} onValueChange={setEditTier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIER_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAff(null)}>إلغاء</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAffiliateManagement;
