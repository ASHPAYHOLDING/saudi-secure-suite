/**
 * DashboardBuilder — Premium enterprise dashboard with live clock,
 * scroll-reveal animations, and fully responsive RTL layout.
 */
import { lazy, Suspense, useMemo, useState, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  CalendarDays, Zap, BarChart3, TrendingUp,
  Users, FileText, Wallet, Receipt, Shield, Building2,
  Briefcase, ArrowUpRight, CreditCard, ShoppingCart,
  FileSignature, Target, BookOpen, UserCircle,
  ChevronLeft, Sparkles, Activity, PieChart,
  ArrowRight, Clock, Bell, Plus, BookOpenCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useLiveClock } from "@/hooks/useLiveClock";
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
   Animation variants — respects prefers-reduced-motion
   ═══════════════════════════════════════════════ */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const heroEntry = {
  hidden: { opacity: 0, y: 30, filter: "blur(8px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

const reducedEntry = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

/* ═══════════════════════════════════════════════
   ScrollReveal wrapper — uses IntersectionObserver
   ═══════════════════════════════════════════════ */
const ScrollReveal = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
      animate={isInView
        ? (prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 })
        : undefined
      }
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   Section Navigation Card
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
        className="group cursor-pointer border-border/40 bg-card/80 backdrop-blur-sm hover:border-accent/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-500 overflow-hidden relative h-full"
        onClick={() => navigate(path)}
      >
        <div className={cn("absolute top-0 inset-x-0 h-1 transition-all duration-500 opacity-0 group-hover:opacity-100", gradient)} />
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
                <ChevronLeft className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent transition-all duration-300 group-hover:-translate-x-1 rtl:group-hover:translate-x-1 flex-none" />
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
   Quick Action Button — with hover lift + glow
   ═══════════════════════════════════════════════ */
interface QuickActionProps {
  icon: any;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

const QuickAction = ({ icon: Icon, label, onClick, variant = "secondary" }: QuickActionProps) => (
  <motion.div
    variants={staggerItem}
    whileHover={{ y: -2, scale: 1.03 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
  >
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      size="sm"
      className={cn(
        "gap-2 rounded-xl h-10 text-xs font-semibold transition-all duration-300 border-border/50 whitespace-nowrap",
        variant === "primary"
          ? "bg-gradient-to-l from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-accent-foreground shadow-md hover:shadow-lg hover:shadow-accent/25 border-0"
          : "hover:shadow-md hover:shadow-foreground/5 hover:border-accent/40"
      )}
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  </motion.div>
);

/* ═══════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════ */
const DashboardSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <Skeleton className="h-[200px] rounded-2xl" />
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-28 rounded-xl flex-none" />
      ))}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[140px] rounded-xl" />
      ))}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   Main Dashboard
   ═══════════════════════════════════════════════ */
const DashboardBuilder = () => {
  const { tenantId, profile } = useAuth();
  const { dir } = useLanguage();
  const navigate = useNavigate();
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);
  const prefersReduced = useReducedMotion();
  const clock = useLiveClock();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-builder-stats", tenantId],
    queryFn: () => fetchStats(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const tenantName = data?.tenantName || profile?.full_name?.split(" ")[0] || "";

  const timeOfDay = (() => {
    if (clock.hours < 12) return "صباح الخير";
    if (clock.hours < 17) return "مساء الخير";
    return "مساء النور";
  })();

  const sections = useMemo(() => [
    { icon: CreditCard, title: "الفواتير والفوترة", description: "إنشاء الفواتير، إشعارات الدائن، تتبع المدفوعات", path: "/dashboard/billing", gradient: "bg-gradient-to-br from-emerald-500 to-emerald-600", iconColor: "text-white", count: data?.stats?.totalInvoices },
    { icon: Users, title: "العملاء", description: "إدارة بيانات العملاء والعلاقات التجارية", path: "/dashboard/customers", gradient: "bg-gradient-to-br from-blue-500 to-blue-600", iconColor: "text-white", count: data?.stats?.totalCustomers },
    { icon: Wallet, title: "المالية", description: "التدفقات النقدية، الحسابات، التقارير المالية", path: "/dashboard/finance", gradient: "bg-gradient-to-br from-violet-500 to-violet-600", iconColor: "text-white" },
    { icon: Receipt, title: "المصروفات", description: "تسجيل ومتابعة وإدارة المصروفات", path: "/dashboard/expenses", gradient: "bg-gradient-to-br from-amber-500 to-orange-500", iconColor: "text-white" },
    { icon: FileSignature, title: "العقود", description: "إدارة العقود والاتفاقيات التجارية", path: "/dashboard/contracts", gradient: "bg-gradient-to-br from-teal-500 to-teal-600", iconColor: "text-white", count: data?.stats?.totalContracts },
    { icon: BarChart3, title: "التقارير والتحليلات", description: "تقارير شاملة ولوحات تحليلية ذكية", path: "/dashboard/reports", gradient: "bg-gradient-to-br from-rose-500 to-pink-500", iconColor: "text-white" },
    { icon: Target, title: "الميزانيات", description: "التخطيط المالي ومتابعة الميزانيات", path: "/dashboard/budgets", gradient: "bg-gradient-to-br from-cyan-500 to-cyan-600", iconColor: "text-white" },
    { icon: Briefcase, title: "الموارد البشرية", description: "إدارة الموظفين، الرواتب، الحضور والانصراف", path: "/dashboard/hr", gradient: "bg-gradient-to-br from-indigo-500 to-indigo-600", iconColor: "text-white" },
  ], [data?.stats]);

  const quickActions = [
    { icon: Zap, label: "فاتورة سريعة", onClick: () => setQuickInvoiceOpen(true), variant: "primary" as const },
    { icon: Plus, label: "عميل جديد", onClick: () => navigate("/dashboard/customers"), variant: "secondary" as const },
    { icon: Receipt, label: "إضافة مصروف", onClick: () => navigate("/dashboard/expenses"), variant: "secondary" as const },
    { icon: BookOpenCheck, label: "قيد يومي", onClick: () => navigate("/dashboard/finance"), variant: "secondary" as const },
    { icon: BarChart3, label: "عرض التقارير", onClick: () => navigate("/dashboard/reports"), variant: "secondary" as const },
  ];

  const heroVariant = prefersReduced ? reducedEntry : heroEntry;

  return (
    <div dir={dir} className="space-y-6 p-3 sm:p-5 lg:p-8 max-w-[1400px] mx-auto">

      {/* ═══════════════ HERO HEADER ═══════════════ */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={heroVariant}
        className="rounded-2xl bg-gradient-to-l from-primary via-primary/95 to-primary/85 p-5 sm:p-7 lg:p-8 text-primary-foreground relative overflow-hidden"
      >
        {/* Background decorations */}
        {!prefersReduced && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1/2 -end-1/4 w-[600px] h-[600px] rounded-full bg-white/[0.03]"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-1/3 -start-1/4 w-[400px] h-[400px] rounded-full bg-white/[0.02]"
            />
          </div>
        )}
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle at 1.5px 1.5px, currentColor 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }} />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            {/* Left: Greeting + dates */}
            <div className="space-y-2">
              <motion.div
                initial={prefersReduced ? {} : { opacity: 0, x: 30, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-sm text-white/50 font-medium">{timeOfDay} 👋</p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight mt-1">
                  {tenantName}
                </h1>
              </motion.div>

              <motion.div
                initial={prefersReduced ? {} : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/60 text-xs sm:text-sm"
              >
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 flex-none" />
                  <span className="text-white/70 tabular-nums">{clock.dayName}، {clock.hijriDate}</span>
                </span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <span className="text-white/40 text-[11px] hidden sm:inline tabular-nums">{clock.gregorianDate}</span>
              </motion.div>
            </div>

            {/* Right: Live Clock */}
            <motion.div
              initial={prefersReduced ? {} : { opacity: 0, scale: 0.9, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3.5 sm:px-7 sm:py-4 border border-white/10 flex items-center gap-3"
            >
              <Clock className="w-5 h-5 text-white/40 flex-none" />
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight font-mono">
                  {clock.timeString}
                </span>
                {clock.period && (
                  <span className="text-xs text-white/50 font-medium">{clock.period}</span>
                )}
              </div>
            </motion.div>
          </div>

          {/* Summary pills row */}
          {data && (
            <motion.div
              initial={prefersReduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-wrap items-center gap-2 mt-5"
            >
              {[
                { icon: TrendingUp, label: "الإيرادات", value: fmtCurrency(data.stats.totalRevenue) },
                { icon: Users, label: "العملاء", value: fmtNumber(data.stats.totalCustomers) },
                { icon: FileText, label: "الفواتير", value: fmtNumber(data.stats.totalInvoices) },
              ].map((pill) => (
                <div
                  key={pill.label}
                  className="bg-white/[0.08] backdrop-blur-sm rounded-xl px-3.5 py-2 flex items-center gap-2 border border-white/[0.08]"
                >
                  <pill.icon className="w-3.5 h-3.5 text-white/50 flex-none" />
                  <span className="text-[10px] text-white/40">{pill.label}</span>
                  <span className="text-xs font-bold text-white tabular-nums">{pill.value}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible"
      >
        {quickActions.map((action) => (
          <QuickAction key={action.label} {...action} />
        ))}
      </motion.div>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">

          {/* ── KPI Cards ── */}
          <ScrollReveal>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              <motion.div variants={staggerItem}><RevenueWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} /></motion.div>
              <motion.div variants={staggerItem}><ExpensesWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} /></motion.div>
              <motion.div variants={staggerItem}><OverdueWidget stats={data?.stats || {}} /></motion.div>
              <motion.div variants={staggerItem}><VatWidget stats={data?.stats || {}} /></motion.div>
            </motion.div>
          </ScrollReveal>

          {/* ── Alerts ── */}
          <ScrollReveal>
            <AlertsWidget stats={data?.stats || {}} />
          </ScrollReveal>

          {/* ── Secondary KPIs ── */}
          <ScrollReveal>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              <motion.div variants={staggerItem}><CollectionWidget stats={data?.stats || {}} /></motion.div>
              <motion.div variants={staggerItem}><CustomersWidget stats={data?.stats || {}} /></motion.div>
            </motion.div>
          </ScrollReveal>

          {/* ── Section Navigation ── */}
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-accent to-accent/50" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">الأقسام الرئيسية</h2>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
            >
              {sections.map((section) => (
                <SectionCard key={section.path} {...section} />
              ))}
            </motion.div>
          </ScrollReveal>

          {/* ── Charts ── */}
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-primary to-primary/50" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">الرسوم البيانية</h2>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <ChartsWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} />
          </ScrollReveal>

          {/* ── Activity Feed ── */}
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-warning to-warning/50" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">آخر الأنشطة</h2>
              <div className="flex-1 h-px bg-border/40" />
            </div>
            <ActivityWidget stats={data?.stats || {}} activities={data?.activities} />
          </ScrollReveal>
        </div>
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
