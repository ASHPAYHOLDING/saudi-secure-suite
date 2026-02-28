/**
 * DashboardBuilder — Professional enterprise dashboard homepage.
 * Fixed layout with KPI cards, section navigation, and activity feed.
 * No drag-and-drop — clean, polished, responsive.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays, Zap, BarChart3, TrendingUp,
  Users, FileText, Wallet, Receipt, Shield, Building2,
  Briefcase, ArrowUpRight, CreditCard, ShoppingCart,
  FileSignature, Target, BookOpen, UserCircle,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

// ─── Data fetcher (kept from original) ───
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
      supabase.from("audit_logs").select("id, action, entity_type, entity_label, created_at, user_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(5), `aud-${tenantId}`),
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
   Section Navigation Cards
   ═══════════════════════════════════════════════ */
interface SectionCardProps {
  icon: any;
  title: string;
  description: string;
  path: string;
  color: string;
  iconColor: string;
  delay: number;
}

const SectionCard = ({ icon: Icon, title, description, path, color, iconColor, delay }: SectionCardProps) => {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card
        className="group cursor-pointer border-border/50 bg-card hover:shadow-[var(--shadow-md)] transition-all duration-300 overflow-hidden relative"
        onClick={() => navigate(path)}
      >
        <div className="absolute top-0 inset-x-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-l from-accent to-accent/30" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-none shrink-0 transition-transform duration-300 group-hover:scale-105", color)}>
              <Icon className={cn("w-5 h-5", iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{title}</h3>
                <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent transition-colors duration-200 rtl-flip" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   Quick Action Button
   ═══════════════════════════════════════════════ */
interface QuickActionProps {
  icon: any;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  delay: number;
}

const QuickAction = ({ icon: Icon, label, onClick, variant = "secondary", delay }: QuickActionProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.3 }}
  >
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      size="sm"
      className={cn(
        "gap-1.5 rounded-xl h-9 text-xs font-medium transition-all duration-200",
        variant === "primary" && "bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm hover:shadow-[var(--shadow-accent)]"
      )}
      onClick={onClick}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Button>
  </motion.div>
);

/* ═══════════════════════════════════════════════
   Main Dashboard
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
  const gregDate = new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Section navigation data
  const sections = useMemo(() => [
    {
      icon: CreditCard,
      title: "الفواتير والفوترة",
      description: "إنشاء الفواتير، إشعارات الدائن، تتبع المدفوعات",
      path: "/dashboard/billing",
      color: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      icon: Users,
      title: "العملاء",
      description: "إدارة بيانات العملاء والعلاقات التجارية",
      path: "/dashboard/customers",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      icon: Wallet,
      title: "المالية",
      description: "التدفقات النقدية، الحسابات، التقارير المالية",
      path: "/dashboard/finance",
      color: "bg-info/10",
      iconColor: "text-info",
    },
    {
      icon: Receipt,
      title: "المصروفات",
      description: "تسجيل ومتابعة وإدارة المصروفات",
      path: "/dashboard/expenses",
      color: "bg-warning/10",
      iconColor: "text-warning",
    },
    {
      icon: FileSignature,
      title: "العقود",
      description: "إدارة العقود والاتفاقيات التجارية",
      path: "/dashboard/contracts",
      color: "bg-success/10",
      iconColor: "text-success",
    },
    {
      icon: BarChart3,
      title: "التقارير والتحليلات",
      description: "تقارير شاملة ولوحات تحليلية ذكية",
      path: "/dashboard/reports",
      color: "bg-destructive/10",
      iconColor: "text-destructive",
    },
    {
      icon: Target,
      title: "الميزانيات",
      description: "التخطيط المالي ومتابعة الميزانيات",
      path: "/dashboard/budgets",
      color: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      icon: Briefcase,
      title: "الموارد البشرية",
      description: "إدارة الموظفين، الرواتب، الحضور والانصراف",
      path: "/dashboard/hr",
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
  ], []);

  return (
    <div dir={dir} className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* ═══ Welcome Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="rounded-2xl bg-gradient-to-l from-primary via-primary to-primary/90 p-6 sm:p-8 text-primary-foreground relative overflow-hidden"
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-xl sm:text-2xl font-bold flex items-center gap-2"
            >
              👋 مرحباً، {firstName}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex items-center gap-2 mt-2 text-primary-foreground/70 text-xs sm:text-sm"
            >
              <CalendarDays className="w-3.5 h-3.5 flex-none" />
              <span>{hijriDate}</span>
              <span className="text-primary-foreground/40">·</span>
              <span className="text-primary-foreground/50 text-[11px]">{gregDate}</span>
            </motion.div>
          </div>

          {/* Quick summary badges */}
          {data && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="flex items-center gap-2 flex-wrap"
            >
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs">
                <span className="text-primary-foreground/60">الإيرادات</span>
                <span className="font-bold ms-1.5 tabular-nums">{fmtCurrency(data.stats.totalRevenue)}</span>
              </div>
              <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs">
                <span className="text-primary-foreground/60">العملاء</span>
                <span className="font-bold ms-1.5 tabular-nums">{fmtNumber(data.stats.totalCustomers)}</span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="flex items-center gap-2 flex-wrap"
      >
        <QuickAction icon={Zap} label="فاتورة سريعة" onClick={() => setQuickInvoiceOpen(true)} variant="primary" delay={0.2} />
        <QuickAction icon={BarChart3} label="التقارير" onClick={() => navigate("/dashboard/reports")} delay={0.25} />
        <QuickAction icon={Users} label="العملاء" onClick={() => navigate("/dashboard/customers")} delay={0.3} />
        <QuickAction icon={Receipt} label="المصروفات" onClick={() => navigate("/dashboard/expenses")} delay={0.35} />
      </motion.div>

      {/* ═══ Content ═══ */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[130px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[90px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── KPI Cards Row ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
          >
            {[
              <RevenueWidget key="rev" stats={data?.stats || {}} monthlyData={data?.monthlyData} />,
              <ExpensesWidget key="exp" stats={data?.stats || {}} monthlyData={data?.monthlyData} />,
              <OverdueWidget key="ovr" stats={data?.stats || {}} />,
              <VatWidget key="vat" stats={data?.stats || {}} />,
            ].map((widget, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
              >
                {widget}
              </motion.div>
            ))}
          </motion.div>

          {/* ── Alerts ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <AlertsWidget stats={data?.stats || {}} />
          </motion.div>

          {/* ── Secondary KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <CollectionWidget stats={data?.stats || {}} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <CustomersWidget stats={data?.stats || {}} />
            </motion.div>
          </div>

          {/* ── Section Navigation ── */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex items-center gap-2 mb-4"
            >
              <div className="w-1 h-5 rounded-full bg-accent" />
              <h2 className="text-base font-bold text-foreground">الأقسام الرئيسية</h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {sections.map((section, i) => (
                <SectionCard
                  key={section.path}
                  {...section}
                  delay={0.5 + i * 0.05}
                />
              ))}
            </div>
          </div>

          {/* ── Charts ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <ChartsWidget stats={data?.stats || {}} monthlyData={data?.monthlyData} />
          </motion.div>

          {/* ── Activity Feed ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            <ActivityWidget stats={data?.stats || {}} activities={data?.activities} />
          </motion.div>
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
