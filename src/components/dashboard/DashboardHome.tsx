import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, TrendingUp, CreditCard, FileSignature, Users, 
  ArrowUpRight, ArrowDownRight, Receipt, Wallet, BarChart3,
  Plus, Eye, Clock, CheckCircle2, AlertTriangle, Zap,
  Target, Sparkles, Activity, RefreshCw, ShieldAlert, 
  Banknote, CircleDollarSign, CalendarClock, ArrowRight,
  ShoppingCart, Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { timedCall } from "@/lib/timed-call";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

import { lazy, Suspense } from "react";
const ChartsSection = lazy(() => import("./DashboardCharts"));
const QuickInvoiceDialog = lazy(() => import("@/components/invoices/QuickInvoiceDialog"));

interface DashboardStats {
  totalInvoices: number;
  draftInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  totalVat: number;
  activeContracts: number;
  totalContracts: number;
  totalCustomers: number;
  totalExpenses: number;
  pendingInvoices: number;
  cancelledInvoices: number;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_label: string | null;
  created_at: string;
  user_id: string;
}

// ─── Animated counter ───
const AnimatedCounter = ({ value, duration = 1.2 }: { value: number; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) { setDisplay(0); return; }
    const stepTime = Math.max(Math.floor((duration * 1000) / end), 10);
    const increment = Math.max(Math.ceil(end / (duration * 100)), 1);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString("ar-SA")}</>;
};

// ─── Skeleton ───
const KpiSkeleton = () => (
  <Card className="border-border/40 shadow-sm">
    <CardContent className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>
      <Skeleton className="w-28 h-8 rounded" />
      <Skeleton className="w-36 h-3 rounded" />
    </CardContent>
  </Card>
);

const ErrorCard = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <Card className="border-destructive/30">
    <CardContent className="p-6 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-3.5 h-3.5" />
        إعادة المحاولة
      </Button>
    </CardContent>
  </Card>
);

// ─── VAT Alert Banner ───
const VatAlertBanner = ({ totalVat, totalRevenue }: { totalVat: number; totalRevenue: number }) => {
  const vatRate = totalRevenue > 0 ? (totalVat / totalRevenue) * 100 : 0;
  const now = new Date();
  const daysUntilEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const isUrgent = daysUntilEnd <= 5;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <div className={cn(
        "flex items-center gap-4 rounded-xl border px-5 py-4",
        isUrgent
          ? "border-destructive/30 bg-destructive/5"
          : "border-warning/25 bg-warning/5"
      )}>
        <div className={cn(
          "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          isUrgent ? "bg-destructive/10" : "bg-warning/10"
        )}>
          <ShieldAlert className={cn("w-5 h-5", isUrgent ? "text-destructive" : "text-warning")} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold", isUrgent ? "text-destructive" : "text-warning")}>
            {isUrgent ? "⚠️ موعد تقديم إقرار ضريبة القيمة المضافة قريب" : "تنبيه ضريبة القيمة المضافة"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            إجمالي الضريبة المستحقة: <span className="font-semibold text-foreground">{totalVat.toLocaleString("ar-SA")} ر.س</span>
            {" · "}
            متبقي {daysUntilEnd} يوم على نهاية الفترة
          </p>
        </div>
        <Badge variant="outline" className={cn(
          "shrink-0 text-[10px]",
          isUrgent ? "border-destructive/30 text-destructive" : "border-warning/30 text-warning"
        )}>
          {vatRate.toFixed(1)}% نسبة الضريبة
        </Badge>
      </div>
    </motion.div>
  );
};

// ─── Cashflow Alert ───
const CashflowAlert = ({ revenue, expenses }: { revenue: number; expenses: number }) => {
  const net = revenue - expenses;
  const isNegative = net < 0;
  const ratio = revenue > 0 ? (expenses / revenue) * 100 : 0;
  const isHighBurn = ratio > 85;

  if (!isNegative && !isHighBurn) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <div className="flex items-center gap-4 rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Banknote className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">
            {isNegative ? "🔴 تدفق نقدي سلبي" : "⚠️ معدل حرق مرتفع"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isNegative
              ? `العجز: ${Math.abs(net).toLocaleString("ar-SA")} ر.س — المصروفات تتجاوز الإيرادات`
              : `المصروفات تشكل ${ratio.toFixed(0)}% من الإيرادات — ينصح بمراجعة الإنفاق`
            }
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Data fetcher ───
async function fetchDashboardStats(tenantId: string): Promise<{
  stats: DashboardStats;
  activities: AuditEntry[];
  tenantName: string;
  monthlyData: { month: string; revenue: number; expenses: number }[];
}> {
  const [invoicesRes, contractsRes, customersRes, expensesRes, auditRes, tenantRes] = await Promise.all([
    timedCall("invoices.select", async () =>
      supabase.from("invoices").select("status, grand_total, vat_total, due_date, invoice_date, created_at").eq("tenant_id", tenantId),
      `invoices-${tenantId}`
    ),
    timedCall("contracts.select", async () =>
      supabase.from("contracts").select("status").eq("tenant_id", tenantId),
      `contracts-${tenantId}`
    ),
    timedCall("customers.count", async () =>
      supabase.from("customers").select("id").eq("tenant_id", tenantId),
      `customers-${tenantId}`
    ),
    timedCall("expenses.select", async () =>
      supabase.from("expenses").select("total_amount, expense_date, status").eq("tenant_id", tenantId),
      `expenses-${tenantId}`
    ),
    timedCall("audit_logs.recent", async () =>
      supabase.from("audit_logs").select("id, action, entity_type, entity_label, created_at, user_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5),
      `audit-${tenantId}`
    ),
    timedCall("tenant.name", async () =>
      supabase.from("tenants").select("name").eq("id", tenantId).single(),
      `tenant-name-${tenantId}`
    ),
  ]) as any[];

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const contracts = contractsRes.data || [];
  const today = new Date().toISOString().split("T")[0];

  const totalExpenses = expenses
    .filter((e: any) => e.status === "approved" || e.status === "paid")
    .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

  const stats: DashboardStats = {
    totalInvoices: invoices.length,
    draftInvoices: invoices.filter((i: any) => i.status === "draft").length,
    paidInvoices: invoices.filter((i: any) => i.status === "paid").length,
    pendingInvoices: invoices.filter((i: any) => i.status === "sent" || i.status === "pending").length,
    cancelledInvoices: invoices.filter((i: any) => i.status === "cancelled").length,
    overdueInvoices: invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date < today).length,
    totalRevenue: invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.grand_total || 0), 0),
    totalVat: invoices.reduce((s: number, i: any) => s + (i.vat_total || 0), 0),
    activeContracts: contracts.filter((c: any) => c.status === "active" || c.status === "signed").length,
    totalContracts: contracts.length,
    totalCustomers: customersRes.data?.length || 0,
    totalExpenses,
  };

  const monthlyData: { month: string; revenue: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("ar-SA", { month: "short" });
    const rev = invoices
      .filter((inv: any) => inv.status === "paid" && inv.invoice_date?.startsWith(key))
      .reduce((s: number, inv: any) => s + (inv.grand_total || 0), 0);
    const exp = expenses
      .filter((e: any) => e.expense_date?.startsWith(key))
      .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);
    monthlyData.push({ month: monthLabel, revenue: rev, expenses: exp });
  }

  return {
    stats,
    activities: auditRes.data || [],
    tenantName: tenantRes.data?.name || "",
    monthlyData,
  };
}

// ─── Action helpers ───
const actionLabel = (action: string, entityType: string, t: any) => {
  const actionMap: Record<string, string> = {
    create: t("dashboard.actionCreate"), update: t("dashboard.actionUpdate"),
    delete: t("dashboard.actionDelete"), sign: t("dashboard.actionSign"),
    cancel: t("dashboard.actionCancel"), mark_paid: t("dashboard.actionMarkPaid"),
    approve: "اعتماد", reject: "رفض", send: "إرسال",
    lock: "قفل", unlock: "فتح قفل",
    confirm: "تأكيد", fulfill: "تنفيذ", convert_to_invoice: "تحويل لفاتورة",
    reserve_stock: "حجز مخزون", release_stock: "تحرير مخزون",
    post: "ترحيل", void: "إلغاء", close: "إغلاق",
    receive: "استلام", ship: "شحن", refund: "استرداد",
    adjust: "تعديل", reconcile: "مطابقة",
  };
  const entityMap: Record<string, string> = {
    invoice: t("dashboard.entityInvoice"), invoices: t("dashboard.entityInvoice"),
    contract: t("dashboard.entityContract"), contracts: t("dashboard.entityContract"),
    customer: t("dashboard.entityCustomer"), customers: t("dashboard.entityCustomer"),
    expense: t("dashboard.entityExpense") || "مصروف", expenses: "مصروف",
    journal_entry: "قيد يومية", journal_entries: "قيد يومية",
    payment: "دفعة", payments: "دفعة",
    quotation: "عرض سعر", quotations: "عرض سعر",
    purchase_order: "أمر شراء", purchase_orders: "أوامر شراء",
    budget: "ميزانية", budgets: "ميزانيات",
    sales_order: "أمر بيع", sales_orders: "أوامر بيع",
    credit_note: "إشعار دائن", credit_notes: "إشعارات دائنة",
    product: "منتج", products: "منتجات",
    stock_movement: "حركة مخزون", stock_movements: "حركات مخزون",
    employee: "موظف", employees: "موظفين",
    branch: "فرع", branches: "فروع",
    vendor: "مورد", vendors: "موردين",
    wallet: "محفظة", wallet_transaction: "عملية محفظة",
    subscription: "اشتراك", subscriptions: "اشتراكات",
    discount_code: "كود خصم", discount_codes: "أكواد خصم",
  };
  return `${actionMap[action] || action} ${entityMap[entityType] || entityType}`;
};

const actionIcon = (entityType: string) => {
  const icons: Record<string, any> = {
    invoice: CreditCard, invoices: CreditCard,
    contract: FileSignature, contracts: FileSignature,
    customer: Users, customers: Users,
    expense: Receipt, expenses: Receipt,
    payment: CreditCard, payments: CreditCard,
    journal_entry: FileText, journal_entries: FileText,
    sales_order: ShoppingCart, sales_orders: ShoppingCart,
    quotation: FileText, quotations: FileText,
    purchase_order: FileText, purchase_orders: FileText,
    credit_note: FileText, credit_notes: FileText,
    product: Package, products: Package,
  };
  return icons[entityType] || FileText;
};

// ═══════════════════════════════════════
//  MAIN DASHBOARD
// ═══════════════════════════════════════
const DashboardHome = () => {
  const { tenantId, profile } = useAuth();
  const { t, dir, currentLang } = useLanguage();
  const navigate = useNavigate();
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats", tenantId],
    queryFn: () => fetchDashboardStats(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000,
    gcTime: 120_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`dashboard-realtime-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `tenant_id=eq.${tenantId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `tenant_id=eq.${tenantId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, refetch]);

  const firstName = data?.tenantName || profile?.full_name?.split(" ")[0] || t("common.user");
  const sar = t("common.sar");
  const dateLocale = currentLang === "ar" ? ar : enUS;
  const s = data?.stats;
  const netProfit = s ? s.totalRevenue - s.totalExpenses : 0;
  const collectionRate = s && s.totalInvoices > 0 ? Math.round((s.paidInvoices / s.totalInvoices) * 100) : 0;

  // ─── Executive KPI definitions ───
  const kpiCards = s ? [
    {
      label: "إجمالي الإيرادات",
      value: s.totalRevenue,
      isCurrency: true,
      sub: `${s.paidInvoices} فاتورة محصّلة`,
      icon: CircleDollarSign,
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      trend: s.totalRevenue > 0 ? "up" as const : null,
      trendLabel: "محصّل",
      path: "/dashboard/finance",
    },
    {
      label: "المصروفات",
      value: s.totalExpenses,
      isCurrency: true,
      sub: `هامش الربح: ${s.totalRevenue > 0 ? ((netProfit / s.totalRevenue) * 100).toFixed(0) : 0}%`,
      icon: Receipt,
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
      trend: netProfit >= 0 ? "up" as const : "down" as const,
      trendLabel: netProfit >= 0 ? "ربح" : "خسارة",
      path: "/dashboard/expenses",
    },
    {
      label: "فواتير متأخرة",
      value: s.overdueInvoices,
      isCurrency: false,
      sub: `من أصل ${s.totalInvoices} فاتورة`,
      icon: CalendarClock,
      iconBg: s.overdueInvoices > 0 ? "bg-destructive/10" : "bg-success/10",
      iconColor: s.overdueInvoices > 0 ? "text-destructive" : "text-success",
      trend: s.overdueInvoices > 0 ? "down" as const : "up" as const,
      trendLabel: s.overdueInvoices > 0 ? "متأخر" : "ممتاز",
      path: "/dashboard/billing",
    },
    {
      label: "ضريبة القيمة المضافة",
      value: s.totalVat,
      isCurrency: true,
      sub: "VAT 15% — مستحق للهيئة",
      icon: ShieldAlert,
      iconBg: "bg-info/10",
      iconColor: "text-info",
      trend: null,
      trendLabel: "ZATCA",
      path: "/dashboard/vat-return",
    },
  ] : null;

  // ─── Quick Actions ───
  const quickActions = [
    { label: "⚡ فاتورة سريعة", icon: Zap, action: () => setQuickInvoiceOpen(true), accent: true },
    { label: "فاتورة جديدة", icon: CreditCard, action: () => navigate("/dashboard/billing") },
    { label: "قيد يومي", icon: FileText, action: () => navigate("/dashboard/journal-entries") },
    { label: "مصروف جديد", icon: Receipt, action: () => navigate("/dashboard/expenses") },
    { label: "عميل جديد", icon: Users, action: () => navigate("/dashboard/customers") },
    { label: "التقارير", icon: BarChart3, action: () => navigate("/dashboard/reports") },
  ];

  return (
    <div dir={dir} className="space-y-5 p-4 sm:p-6 max-w-[1400px] mx-auto">

      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground font-arabic">
            {t("dashboard.welcome", { name: firstName })}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Activity className="w-3 h-3" />
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm"
            onClick={() => setQuickInvoiceOpen(true)}
          >
            <Zap className="w-3.5 h-3.5" />
            فاتورة سريعة
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/dashboard/reports")}>
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">التقارير</span>
          </Button>
        </div>
      </motion.div>

      {/* ═══ Alerts: VAT + Cashflow ═══ */}
      {s && s.totalVat > 0 && (
        <VatAlertBanner totalVat={s.totalVat} totalRevenue={s.totalRevenue} />
      )}
      {s && <CashflowAlert revenue={s.totalRevenue} expenses={s.totalExpenses} />}

      {/* ═══ KPI Cards ═══ */}
      {isError ? (
        <ErrorCard message="تعذّر تحميل البيانات" onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading || !kpiCards ? (
            Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            kpiCards.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="cursor-pointer group"
                onClick={() => navigate(kpi.path)}
              >
                <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-accent/20 transition-all h-full relative overflow-hidden">
                  {/* Top accent line */}
                  <div className={cn(
                    "absolute top-0 inset-x-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity",
                    "bg-gradient-to-l from-accent to-accent/40"
                  )} />
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", kpi.iconBg)}>
                        <kpi.icon className={cn("w-5 h-5", kpi.iconColor)} />
                      </div>
                      {kpi.trend && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          kpi.trend === "up" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        )}>
                          {kpi.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {kpi.trendLabel}
                        </span>
                      )}
                      {!kpi.trend && kpi.trendLabel && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info/10 text-info">
                          {kpi.trendLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground font-arabic tracking-tight">
                      {kpi.isCurrency ? (
                        <>
                          <AnimatedCounter value={kpi.value} />
                          <span className="text-xs font-normal text-muted-foreground ms-1">{sar}</span>
                        </>
                      ) : (
                        <AnimatedCounter value={kpi.value} />
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">{kpi.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ═══ Executive Summary Row ═══ */}
      {s && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Collection Rate */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">نسبة التحصيل</span>
                </div>
                <p className="text-2xl font-bold text-foreground font-arabic">
                  <AnimatedCounter value={collectionRate} /><span className="text-sm">%</span>
                </p>
                <Progress value={collectionRate} className="mt-2.5 h-1.5" />
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  {s.paidInvoices} من {s.totalInvoices}
                </p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", netProfit >= 0 ? "bg-success/10" : "bg-destructive/10")}>
                    <TrendingUp className={cn("w-4 h-4", netProfit >= 0 ? "text-success" : "text-destructive")} />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">صافي الربح</span>
                </div>
                <p className={cn("text-2xl font-bold font-arabic", netProfit >= 0 ? "text-success" : "text-destructive")}>
                  <AnimatedCounter value={Math.abs(netProfit)} />
                  <span className="text-xs font-normal text-muted-foreground ms-1">{sar}</span>
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  {netProfit >= 0 ? <ArrowUpRight className="w-3 h-3 text-success" /> : <ArrowDownRight className="w-3 h-3 text-destructive" />}
                  <span className="text-[10px] text-muted-foreground/60">الإيرادات − المصروفات</span>
                </div>
              </CardContent>
            </Card>

            {/* Active Contracts */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                    <FileSignature className="w-4 h-4 text-info" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">العقود النشطة</span>
                </div>
                <p className="text-2xl font-bold text-foreground font-arabic">
                  <AnimatedCounter value={s.activeContracts} />
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  من أصل {s.totalContracts} عقد
                </p>
              </CardContent>
            </Card>

            {/* Customers */}
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">إجمالي العملاء</span>
                </div>
                <p className="text-2xl font-bold text-foreground font-arabic">
                  <AnimatedCounter value={s.totalCustomers} />
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  {s.overdueInvoices > 0 ? (
                    <span className="text-destructive font-medium">{s.overdueInvoices} فاتورة متأخرة</span>
                  ) : "لا مستحقات متأخرة"}
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* ═══ Quick Actions Bar ═══ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.38 + i * 0.03 }}
              onClick={action.action}
              className={cn(
                "shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all",
                action.accent
                  ? "bg-accent text-accent-foreground shadow-sm hover:bg-accent/90"
                  : "bg-muted/50 text-foreground hover:bg-muted"
              )}
            >
              <action.icon className="w-3.5 h-3.5" />
              {action.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ═══ Charts ═══ */}
      <Suspense fallback={
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-border/40"><CardContent className="p-6"><Skeleton className="h-[220px] w-full rounded-xl" /></CardContent></Card>
          <Card className="border-border/40"><CardContent className="p-6"><Skeleton className="h-[220px] w-full rounded-xl" /></CardContent></Card>
        </div>
      }>
        {s && data && (
          <ChartsSection
            monthlyData={data.monthlyData}
            invoiceDistribution={[
              { name: "مدفوعة", value: s.paidInvoices, color: "hsl(var(--accent))" },
              { name: "معلّقة", value: s.pendingInvoices, color: "hsl(var(--warning))" },
              { name: "متأخرة", value: s.overdueInvoices, color: "hsl(var(--destructive))" },
              { name: "مسودة", value: s.draftInvoices, color: "hsl(var(--muted-foreground))" },
            ].filter(d => d.value > 0)}
            sar={sar}
          />
        )}
      </Suspense>

      {/* ═══ Recent Activity ═══ */}
      {s && data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-2 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                  <Sparkles className="w-4 h-4 text-accent" />
                  آخر العمليات
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[11px] gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate("/dashboard/audit")}>
                  عرض الكل <ArrowRight className="w-3 h-3 rtl-mirror" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {data.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">{t("dashboard.noActivities")}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {data.activities.map((item, i) => {
                    const Icon = actionIcon(item.entity_type);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 + i * 0.03 }}
                        className="flex items-center justify-between gap-3 py-3 first:pt-1"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground shrink-0">
                            <Icon size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {actionLabel(item.action, item.entity_type, t)}
                            </p>
                            {item.entity_label && (
                              <p className="text-[10px] text-muted-foreground/70">{item.entity_label}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap shrink-0">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Invoice Dialog */}
      <Suspense fallback={null}>
        <QuickInvoiceDialog open={quickInvoiceOpen} onOpenChange={setQuickInvoiceOpen} />
      </Suspense>
    </div>
  );
};

export default DashboardHome;
