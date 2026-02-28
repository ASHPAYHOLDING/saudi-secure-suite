/**
 * DashboardBuilder — Premium enterprise dashboard with stunning animations.
 * Fully responsive across all devices. Professional & polished.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Zap, BarChart3, TrendingUp,
  Users, FileText, Wallet, Receipt, Shield, Building2,
  Briefcase, ArrowUpRight, CreditCard, ShoppingCart,
  FileSignature, Target, BookOpen, UserCircle,
  ChevronLeft, Sparkles, Activity, PieChart,
  ArrowRight, Clock, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { timedCall } from "@/lib/timed-call";
import { cn } from "@/lib/utils";
import { fmtCurrency, fmtNumber } from "@/lib/formatters";
import {
  RevenueWidget, ExpensesWidget, OverdueWidget, VatWidget,
  CollectionWidget, CustomersWidget, AlertsWidget, ActivityWidget, ChartsWidget,
} from "./WidgetRenderers";

const QuickInvoiceDialog = lazy(() => import("@/components/invoices/QuickInvoiceDialog"));

// ─── Data fetcher ───
async function fetchStats(tenantId: string) {
  const [invoicesRes, contractsRes, customersRes, expensesRes, auditRes, tenantRes] = await Promise.all([
    timedCall("invoices.select", async () =>
      supabase.from("invoices").select("status, grand_total, vat_total, due_date, invoice_date, created_at").eq("tenant_id", tenantId), `inv-${tenantId}`),
    timedCall("contracts.select", async () =>
      supabase.from("contracts").select("status").eq("tenant_id", tenantId), `con-${tenantId}`),
    timedCall("customers.count", async () =>
      supabase.from("customers").select("id").eq("tenant_id", tenantId), `cust-${tenantId}`),
    timedCall("expenses.select", async () =>
      supabase.from("expenses").select("total_amount, expense_date, status").eq("tenant_id", tenantId), `exp-${tenantId}`),
    timedCall("audit.recent", async () =>
      supabase.from("audit_logs").select("id, action, entity_type, entity_label, created_at, user_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8), `aud-${tenantId}`),
    timedCall("tenant.name", async () =>
      supabase.from("tenants").select("name").eq("id", tenantId).single(), `tname-${tenantId}`),
  ]) as any[];

  const invoices = invoicesRes.data || [];
  const expenses = expensesRes.data || [];
  const contracts = contractsRes.data || [];
  const today = new Date().toISOString().split("T")[0];

  const totalExpenses = expenses
    .filter((e: any) => e.status === "approved" || e.status === "paid")
    .reduce((s: number, e: any) => s + (e.total_amount || 0), 0);

  const stats = {
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

  const monthlyData: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("ar-SA", { month: "short" });
    monthlyData.push({
      month: monthLabel,
      revenue: invoices.filter((inv: any) => inv.status === "paid" && inv.invoice_date?.startsWith(key)).reduce((s: number, inv: any) => s + (inv.grand_total || 0), 0),
      expenses: expenses.filter((e: any) => e.expense_date?.startsWith(key)).reduce((s: number, e: any) => s + (e.total_amount || 0), 0),
    });
  }

  return {
    stats,
    activities: auditRes.data || [],
    tenantName: tenantRes.data?.name || "",
    monthlyData,
  };
}

/* ═══════════════════════════════════════════════
   Stagger container variant
   ═══════════════════════════════════════════════ */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const fadeSlideUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 260, damping: 20 },
  },
};

/* ═══════════════════════════════════════════════
   Section Navigation Card — Premium Design
   ═══════════════════════════════════════════════ */
interface SectionCardProps {
  icon: any;
  title: string;
  description: string;
  path: string;
  gradient: string;
  iconColor: string;
  count?: number;
}

const SectionCard = ({ icon: Icon, title, description, path, gradient, iconColor, count }: SectionCardProps) => {
  const navigate = useNavigate();
  return (
    <motion.div variants={staggerItem}>
      <Card
        className="group cursor-pointer border-border/40 bg-card/80 backdrop-blur-sm hover:border-accent/30 hover:shadow-lg transition-all duration-500 overflow-hidden relative h-full"
        onClick={() => navigate(path)}
      >
        {/* Top gradient bar */}
        <div className={cn("absolute top-0 inset-x-0 h-1 transition-all duration-500 opacity-0 group-hover:opacity-100", gradient)} />
        
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardContent className="p-4 sm:p-5 relative z-10">
          <div className="flex items-start gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={cn("w-11 h-11 rounded-2xl flex items-center justify-center flex-none shrink-0 shadow-sm", gradient)}
            >
              <Icon className="w-5 h-5 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors duration-300">{title}</h3>
                <motion.div
                  initial={{ x: 0 }}
                  whileHover={{ x: -4 }}
                  className="flex-none"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-all duration-300 rtl-flip" />
                </motion.div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{description}</p>
              {count !== undefined && count > 0 && (
                <Badge variant="secondary" className="mt-2 text-[10px] h-5 px-2 bg-muted/60">
                  {fmtNumber(count)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   Quick Action Button — Animated
   ═══════════════════════════════════════════════ */
interface QuickActionProps {
  icon: any;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

const QuickAction = ({ icon: Icon, label, onClick, variant = "secondary" }: QuickActionProps) => (
  <motion.div variants={staggerItem}>
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      size="sm"
      className={cn(
        "gap-2 rounded-xl h-10 text-xs font-semibold transition-all duration-300 border-border/50",
        variant === "primary" && "bg-gradient-to-l from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground shadow-md hover:shadow-lg hover:shadow-accent/20 border-0"
      )}
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  </motion.div>
);

/* ═══════════════════════════════════════════════
   Summary Stat Pill
   ═══════════════════════════════════════════════ */
const StatPill = ({ label, value, icon: Icon }: { label: string; value: string; icon: any }) => (
  <motion.div
    variants={staggerItem}
    className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 flex items-center gap-2.5 border border-white/10"
  >
    <Icon className="w-4 h-4 text-white/60 flex-none" />
    <div className="flex flex-col">
      <span className="text-[10px] text-white/50 font-medium">{label}</span>
      <span className="text-sm font-bold text-white tabular-nums">{value}</span>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════
   Loading Skeleton — Premium
   ═══════════════════════════════════════════════ */
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <Skeleton className="h-[160px] rounded-2xl" />
    <div className="flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[140px] rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-[80px] rounded-xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px] rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-[300px] rounded-xl" />
  </div>
);

/* ═══════════════════════════════════════════════
   Main Dashboard — Premium Layout
   ═══════════════════════════════════════════════ */
const DashboardBuilder = () => {
  const { tenantId, profile } = useAuth();
  const { dir } = useLanguage();
  const navigate = useNavigate();
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-builder-stats", tenantId],
    queryFn: () => fetchStats(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const firstName = data?.tenantName || profile?.full_name?.split(" ")[0] || "";
  const hijriDate = new Date().toLocaleDateString("ar-SA-u-ca-islamic", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const gregDate = new Date().toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });

  const sections = useMemo(() => [
    {
      icon: CreditCard,
      title: "الفواتير والفوترة",
      description: "إنشاء الفواتير، إشعارات الدائن، تتبع المدفوعات",
      path: "/dashboard/billing",
      gradient: "bg-gradient-to-br from-emerald-500 to-emerald-600",
      iconColor: "text-white",
      count: data?.stats?.totalInvoices,
    },
    {
      icon: Users,
      title: "العملاء",
      description: "إدارة بيانات العملاء والعلاقات التجارية",
      path: "/dashboard/customers",
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      iconColor: "text-white",
      count: data?.stats?.totalCustomers,
    },
    {
      icon: Wallet,
      title: "المالية",
      description: "التدفقات النقدية، الحسابات، التقارير المالية",
      path: "/dashboard/finance",
      gradient: "bg-gradient-to-br from-violet-500 to-violet-600",
      iconColor: "text-white",
    },
    {
      icon: Receipt,
      title: "المصروفات",
      description: "تسجيل ومتابعة وإدارة المصروفات",
      path: "/dashboard/expenses",
      gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
      iconColor: "text-white",
    },
    {
      icon: FileSignature,
      title: "العقود",
      description: "إدارة العقود والاتفاقيات التجارية",
      path: "/dashboard/contracts",
      gradient: "bg-gradient-to-br from-teal-500 to-teal-600",
      iconColor: "text-white",
      count: data?.stats?.totalContracts,
    },
    {
      icon: BarChart3,
      title: "التقارير والتحليلات",
      description: "تقارير شاملة ولوحات تحليلية ذكية",
      path: "/dashboard/reports",
      gradient: "bg-gradient-to-br from-rose-500 to-pink-500",
      iconColor: "text-white",
    },
    {
      icon: Target,
      title: "الميزانيات",
      description: "التخطيط المالي ومتابعة الميزانيات",
      path: "/dashboard/budgets",
      gradient: "bg-gradient-to-br from-cyan-500 to-cyan-600",
      iconColor: "text-white",
    },
    {
      icon: Briefcase,
      title: "الموارد البشرية",
      description: "إدارة الموظفين، الرواتب، الحضور والانصراف",
      path: "/dashboard/hr",
      gradient: "bg-gradient-to-br from-indigo-500 to-indigo-600",
      iconColor: "text-white",
    },
  ], [data?.stats]);

  const timeOfDay = (() => {
    const h = new Date().getHours();
    if (h < 12) return "صباح الخير";
    if (h < 17) return "مساء الخير";
    return "مساء النور";
  })();

  return (
    <div dir={dir} className="space-y-6 p-3 sm:p-5 lg:p-8 max-w-[1400px] mx-auto">
      {/* ═══ Hero Welcome Section ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl bg-gradient-to-l from-primary via-primary/95 to-primary/85 p-5 sm:p-7 lg:p-8 text-primary-foreground relative overflow-hidden"
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/2 -end-1/4 w-[600px] h-[600px] rounded-full bg-white/[0.03]"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/3 -start-1/4 w-[400px] h-[400px] rounded-full bg-white/[0.02]"
          />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }} />
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-sm text-white/50 font-medium mb-1">{timeOfDay} 👋</p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">
                  {firstName}
                </h1>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center gap-2 mt-2.5 text-white/50 text-xs sm:text-sm"
              >
                <CalendarDays className="w-3.5 h-3.5 flex-none" />
                <span className="text-white/70">{hijriDate}</span>
                <span className="text-white/30">·</span>
                <span className="text-white/40 text-[11px] hidden sm:inline">{gregDate}</span>
              </motion.div>
            </div>

            {/* Summary pills */}
            {data && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="flex items-center gap-2 flex-wrap"
              >
                <StatPill icon={TrendingUp} label="الإيرادات" value={fmtCurrency(data.stats.totalRevenue)} />
                <StatPill icon={Users} label="العملاء" value={fmtNumber(data.stats.totalCustomers)} />
                <StatPill icon={FileText} label="الفواتير" value={fmtNumber(data.stats.totalInvoices)} />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex items-center gap-2 flex-wrap"
      >
        <QuickAction icon={Zap} label="فاتورة سريعة" onClick={() => setQuickInvoiceOpen(true)} variant="primary" />
        <QuickAction icon={BarChart3} label="التقارير" onClick={() => navigate("/dashboard/reports")} />
        <QuickAction icon={Users} label="العملاء" onClick={() => navigate("/dashboard/customers")} />
        <QuickAction icon={Receipt} label="المصروفات" onClick={() => navigate("/dashboard/expenses")} />
      </motion.div>

      {/* ═══ Main Content ═══ */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="space-y-6"
        >
          {/* ── KPI Cards Row ── */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            <motion.div variants={staggerItem}>
              <RevenueWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} />
            </motion.div>
            <motion.div variants={staggerItem}>
              <ExpensesWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} />
            </motion.div>
            <motion.div variants={staggerItem}>
              <OverdueWidget stats={data?.stats || {}} />
            </motion.div>
            <motion.div variants={staggerItem}>
              <VatWidget stats={data?.stats || {}} />
            </motion.div>
          </motion.div>

          {/* ── Alerts ── */}
          <motion.div variants={fadeSlideUp}>
            <AlertsWidget stats={data?.stats || {}} />
          </motion.div>

          {/* ── Secondary KPIs ── */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            <motion.div variants={staggerItem}>
              <CollectionWidget stats={data?.stats || {}} />
            </motion.div>
            <motion.div variants={staggerItem}>
              <CustomersWidget stats={data?.stats || {}} />
            </motion.div>
          </motion.div>

          {/* ── Section Navigation ── */}
          <motion.div variants={fadeSlideUp}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-accent to-accent/50" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">الأقسام الرئيسية</h2>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {sections.map((section) => (
                <SectionCard key={section.path} {...section} />
              ))}
            </motion.div>
          </motion.div>

          {/* ── Charts ── */}
          <motion.div variants={fadeSlideUp}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-primary to-primary/50" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">الرسوم البيانية</h2>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <ChartsWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} />
          </motion.div>

          {/* ── Activity Feed ── */}
          <motion.div variants={fadeSlideUp}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-warning to-warning/50" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">آخر الأنشطة</h2>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <ActivityWidget stats={data?.stats || {}} activities={data?.activities} />
          </motion.div>
        </motion.div>
      )}

      {/* Quick Invoice Dialog */}
      <Suspense fallback={null}>
        {quickInvoiceOpen && (
          <QuickInvoiceDialog open={quickInvoiceOpen} onOpenChange={setQuickInvoiceOpen} />
        )}
      </Suspense>
    </div>
  );
};

export default DashboardBuilder;
