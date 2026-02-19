import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, TrendingUp, CreditCard, FileSignature, Users, Loader2,
  ArrowUpRight, ArrowDownRight, Receipt, Wallet, BarChart3,
  Plus, Eye, Clock, CheckCircle2, AlertTriangle, Zap,
  PieChart, Target, Sparkles, Activity, Lightbulb, Rocket, X, ChevronLeft, RefreshCw
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

// Lazy-load heavy chart components
import { lazy, Suspense } from "react";
const ChartsSection = lazy(() => import("./DashboardCharts"));

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

// Animated counter component
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

// حكمة اليوم المالية
const FINANCIAL_WISDOMS = [
  { text: "الميزانية ليست مجرد أرقام، بل هي خارطة طريق لأهدافك المالية", author: "بيتر دراكر", category: "الميزانية" },
  { text: "لا تنفق ما تبقى بعد الادخار، بل ادخر ما تبقى بعد الإنفاق", author: "وارن بافت", category: "الادخار" },
  { text: "المحاسبة هي لغة الأعمال", author: "وارن بافت", category: "المحاسبة" },
  { text: "الإيرادات تأتي من المبيعات، لكن الأرباح تأتي من التحكم بالتكاليف", author: "حكمة إدارية", category: "الربحية" },
  { text: "التدفق النقدي هو شريان الحياة لأي مشروع تجاري ناجح", author: "ريتشارد برانسون", category: "السيولة" },
  { text: "في عالم المال، الشفافية هي أساس الثقة بين الشركاء والعملاء", author: "حكمة مالية", category: "الشفافية" },
  { text: "أفضل استثمار يمكنك القيام به هو الاستثمار في نفسك وفريقك", author: "بنجامين فرانكلين", category: "الاستثمار" },
  { text: "الفاتورة المنظمة تعكس شركة محترفة وتبني ثقة العميل", author: "حكمة تجارية", category: "الفوترة" },
  { text: "من يتابع أرقامه يومياً لن تفاجئه النتائج السنوية", author: "حكمة محاسبية", category: "المتابعة" },
  { text: "الضرائب ليست عبئاً بل مسؤولية وطنية تعزز الاقتصاد", author: "حكمة ضريبية", category: "الالتزام" },
  { text: "القرار المالي الجيد يعتمد على بيانات دقيقة وليس على الحدس", author: "حكمة إدارية", category: "اتخاذ القرار" },
  { text: "كل ريال تدخره اليوم هو ريالان في المستقبل", author: "حكمة استثمارية", category: "الادخار" },
  { text: "النجاح المالي يبدأ بفهم الفرق بين الأصول والخصوم", author: "روبرت كيوساكي", category: "الأساسيات" },
  { text: "المراجعة الدورية للحسابات تمنع المفاجآت غير السارة", author: "حكمة محاسبية", category: "التدقيق" },
  { text: "العميل الراضي هو أفضل مصدر للإيرادات المتكررة", author: "حكمة تجارية", category: "العملاء" },
  { text: "الأرباح ليست فقط ما تكسبه، بل ما تحافظ عليه", author: "حكمة مالية", category: "إدارة الأرباح" },
  { text: "التخطيط المالي الجيد يحول الأحلام إلى أهداف قابلة للتحقيق", author: "حكمة إدارية", category: "التخطيط" },
  { text: "إدارة المخزون بذكاء توفر رأس المال وتقلل الهدر", author: "حكمة لوجستية", category: "المخزون" },
  { text: "الاستثمار في التقنية المالية يوفر الوقت ويقلل الأخطاء", author: "حكمة تقنية", category: "التحول الرقمي" },
  { text: "لا تؤجل ما يمكن فوترته اليوم إلى الغد", author: "حكمة محاسبية", category: "الفوترة" },
  { text: "التنويع في مصادر الدخل هو أفضل تأمين ضد المخاطر", author: "حكمة استثمارية", category: "إدارة المخاطر" },
  { text: "الشركة الناجحة هي التي تعرف تكلفة كل منتج وخدمة تقدمها", author: "حكمة إدارية", category: "محاسبة التكاليف" },
  { text: "سجّل كل شيء، فالذاكرة تخون لكن الدفاتر لا تكذب", author: "حكمة محاسبية", category: "التوثيق" },
  { text: "الثقة تُبنى بالتزام المواعيد: مواعيد التسليم ومواعيد السداد", author: "حكمة تجارية", category: "الالتزام" },
  { text: "رأس المال العامل هو الفرق بين البقاء والازدهار", author: "حكمة مالية", category: "السيولة" },
  { text: "أفضل وقت للتخطيط الضريبي هو بداية السنة وليس نهايتها", author: "حكمة ضريبية", category: "التخطيط الضريبي" },
  { text: "العقد الواضح يحمي الطرفين ويبني علاقة مهنية طويلة", author: "حكمة قانونية", category: "العقود" },
  { text: "تقرير مالي واحد دقيق خير من عشرة تقارير مبهمة", author: "حكمة محاسبية", category: "التقارير" },
  { text: "في إدارة الأعمال: ما لا يُقاس لا يُدار", author: "بيتر دراكر", category: "القياس" },
  { text: "الامتثال للأنظمة ليس خياراً بل ضرورة لاستدامة الأعمال", author: "حكمة تنظيمية", category: "الامتثال" },
];

// إعلان نيوماكسيو باي
const NumaxioPayBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-l from-accent/10 via-accent/5 to-primary/5 p-5 sm:p-6">
        <motion.div
          className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-accent/10 blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-8 -start-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 start-3 z-10 rounded-full p-1 text-muted-foreground/60 hover:text-foreground hover:bg-background/50 transition-colors"
        >
          <X size={14} />
        </button>
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <motion.div
            className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg shadow-accent/20"
            animate={{ rotate: [0, -3, 3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Rocket className="w-7 h-7 text-accent-foreground" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <motion.span
                className="text-xs font-bold text-accent tracking-wide"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎉 جديد
              </motion.span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground font-[IBM_Plex_Sans_Arabic] mb-1">
              نيوماكسيو باي — بوابة الدفع الذكية
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              استقبل مدفوعاتك من عملائك عبر مدى، فيزا، ماستركارد، Apple Pay و STC Pay مباشرة من فواتيرك. تفعيل فوري بدون تعقيد.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="shrink-0">
            <Button
              size="sm"
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md shadow-accent/20 rounded-xl px-5"
              onClick={() => navigate("/dashboard/numaxio-pay")}
            >
              <span>اكتشف الآن</span>
              <ChevronLeft size={16} />
            </Button>
          </motion.div>
        </div>
        <motion.div
          className="relative mt-4 pt-3 border-t border-accent/10 flex items-center gap-3 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {["مدى", "Visa", "Mastercard", "Apple Pay", "STC Pay"].map((method, i) => (
            <motion.span
              key={method}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-background/60 text-muted-foreground border border-border/50"
            >
              {method}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};

const DailyWisdom = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const wisdom = FINANCIAL_WISDOMS[dayOfYear % FINANCIAL_WISDOMS.length];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-l from-accent/5 via-accent/[0.02] to-transparent p-5 sm:p-6">
        <div className="absolute top-0 left-0 w-32 h-32 bg-accent/5 rounded-full -translate-x-16 -translate-y-16" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-accent/5 rounded-full translate-x-12 translate-y-12" />
        <div className="relative flex items-start gap-4">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-accent tracking-wide">حكمة اليوم</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent/20 text-accent/70">
                {wisdom.category}
              </Badge>
            </div>
            <blockquote className="text-sm sm:text-base font-medium text-foreground leading-relaxed font-[IBM_Plex_Sans_Arabic]">
              "{wisdom.text}"
            </blockquote>
            <p className="text-[11px] text-muted-foreground mt-2">— {wisdom.author}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/** Skeleton card for KPIs */
const KpiSkeleton = () => (
  <Card className="border-border/60">
    <CardContent className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-8 h-5 rounded" />
      </div>
      <Skeleton className="w-24 h-7 rounded" />
      <Skeleton className="w-32 h-3 rounded" />
      <Skeleton className="w-20 h-3 rounded" />
    </CardContent>
  </Card>
);

/** Error card with retry */
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

/** Fetches dashboard stats using timedCall with dedup */
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
    .filter(e => e.status === "approved" || e.status === "paid")
    .reduce((s, e) => s + (e.total_amount || 0), 0);

  const stats: DashboardStats = {
    totalInvoices: invoices.length,
    draftInvoices: invoices.filter((i) => i.status === "draft").length,
    paidInvoices: invoices.filter((i) => i.status === "paid").length,
    pendingInvoices: invoices.filter((i) => i.status === "sent" || i.status === "pending").length,
    cancelledInvoices: invoices.filter((i) => i.status === "cancelled").length,
    overdueInvoices: invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.due_date < today).length,
    totalRevenue: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.grand_total || 0), 0),
    totalVat: invoices.reduce((s, i) => s + (i.vat_total || 0), 0),
    activeContracts: contracts.filter((c) => c.status === "active" || c.status === "signed").length,
    totalContracts: contracts.length,
    totalCustomers: customersRes.data?.length || 0,
    totalExpenses,
  };

  // Build monthly data (last 6 months)
  const monthlyData: { month: string; revenue: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("ar-SA", { month: "short" });
    const rev = invoices
      .filter(inv => inv.status === "paid" && inv.invoice_date?.startsWith(key))
      .reduce((s, inv) => s + (inv.grand_total || 0), 0);
    const exp = expenses
      .filter(e => e.expense_date?.startsWith(key))
      .reduce((s, e) => s + (e.total_amount || 0), 0);
    monthlyData.push({ month: monthLabel, revenue: rev, expenses: exp });
  }

  return {
    stats,
    activities: auditRes.data || [],
    tenantName: tenantRes.data?.name || "",
    monthlyData,
  };
}

const DashboardHome = () => {
  const { tenantId, profile } = useAuth();
  const { t, dir, currentLang } = useLanguage();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats", tenantId],
    queryFn: () => fetchDashboardStats(tenantId!),
    enabled: !!tenantId,
    staleTime: 60_000, // 1 minute
    gcTime: 120_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const actionLabel = (action: string, entityType: string) => {
    const actionMap: Record<string, string> = {
      create: t("dashboard.actionCreate"),
      update: t("dashboard.actionUpdate"),
      delete: t("dashboard.actionDelete"),
      sign: t("dashboard.actionSign"),
      cancel: t("dashboard.actionCancel"),
      mark_paid: t("dashboard.actionMarkPaid"),
      wallet_tx_credit: "إيداع",
      wallet_tx_debit: "خصم",
      wallet_balance_update: "تحديث رصيد",
      affiliate_commission: "عمولة شريك",
      affiliate_payout: "صرف عمولة",
    };
    const entityMap: Record<string, string> = {
      invoice: t("dashboard.entityInvoice"),
      contract: t("dashboard.entityContract"),
      customer: t("dashboard.entityCustomer"),
      stamp: t("dashboard.entityStamp"),
      expense: t("dashboard.entityExpense") || "مصروف",
      wallet: "المحفظة",
      wallet_transaction: "معاملة محفظة",
      subscription: "الاشتراك",
      affiliate: "الشريك",
      affiliate_commission: "عمولة",
      affiliate_payout: "صرف عمولة",
      paylink_transaction: "معاملة دفع",
    };
    return `${actionMap[action] || action} ${entityMap[entityType] || entityType}`;
  };

  const actionIcon = (entityType: string) => {
    const icons: Record<string, any> = {
      invoice: CreditCard,
      contract: FileSignature,
      customer: Users,
      stamp: CheckCircle2,
      expense: Receipt,
      wallet: CreditCard,
      wallet_transaction: CreditCard,
      subscription: CheckCircle2,
      affiliate: Users,
      affiliate_commission: Receipt,
      affiliate_payout: CreditCard,
      paylink_transaction: CreditCard,
    };
    return icons[entityType] || FileText;
  };

  const firstName = data?.tenantName || profile?.full_name?.split(" ")[0] || t("common.user");
  const sar = t("common.sar");
  const dateLocale = currentLang === "ar" ? ar : enUS;

  // Render immediately with skeletons — never block whole page
  const s = data?.stats;

  const kpiCards = s ? [
    {
      label: t("dashboard.totalInvoices"),
      value: s.totalInvoices,
      sub: t("dashboard.paidDraft", { paid: s.paidInvoices, draft: s.draftInvoices }),
      icon: CreditCard,
      bg: "bg-accent/10",
      color: "text-accent",
      trend: s.paidInvoices > 0 ? "up" as const : null,
      path: "/dashboard/billing",
    },
    {
      label: t("dashboard.collectedRevenue"),
      value: s.totalRevenue,
      isCurrency: true,
      sub: t("dashboard.taxLabel", { amount: s.totalVat.toLocaleString("ar-SA") }),
      icon: TrendingUp,
      bg: "bg-success/10",
      color: "text-success",
      trend: s.totalRevenue > 0 ? "up" as const : null,
      path: "/dashboard/finance",
    },
    {
      label: "المصروفات",
      value: s.totalExpenses,
      isCurrency: true,
      sub: `صافي الربح: ${(s.totalRevenue - s.totalExpenses).toLocaleString("ar-SA")} ${sar}`,
      icon: Receipt,
      bg: "bg-destructive/10",
      color: "text-destructive",
      trend: (s.totalRevenue - s.totalExpenses) > 0 ? "up" as const : (s.totalRevenue - s.totalExpenses) < 0 ? "down" as const : null,
      path: "/dashboard/expenses",
    },
    {
      label: t("dashboard.customersLabel"),
      value: s.totalCustomers,
      sub: s.overdueInvoices > 0 ? t("dashboard.overdueInvoices", { count: s.overdueInvoices }) : t("dashboard.noOverdue"),
      icon: Users,
      bg: s.overdueInvoices > 0 ? "bg-destructive/10" : "bg-info/10",
      color: s.overdueInvoices > 0 ? "text-destructive" : "text-info",
      trend: null,
      path: "/dashboard/customers",
    },
  ] : null;

  const quickActions = [
    { label: "فاتورة جديدة", icon: CreditCard, path: "/dashboard/billing", color: "bg-accent/10 text-accent hover:bg-accent/20" },
    { label: "عرض سعر", icon: FileText, path: "/dashboard/quotations", color: "bg-info/10 text-info hover:bg-info/20" },
    { label: "مصروف جديد", icon: Receipt, path: "/dashboard/expenses", color: "bg-warning/10 text-warning hover:bg-warning/20" },
    { label: "عميل جديد", icon: Users, path: "/dashboard/customers", color: "bg-success/10 text-success hover:bg-success/20" },
    { label: "عقد جديد", icon: FileSignature, path: "/dashboard/contracts", color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" },
    { label: "التقارير", icon: BarChart3, path: "/dashboard/reports", color: "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20" },
  ];

  const netProfit = s ? s.totalRevenue - s.totalExpenses : 0;
  const collectionRate = s && s.totalInvoices > 0 ? Math.round((s.paidInvoices / s.totalInvoices) * 100) : 0;

  return (
    <div dir={dir} className="space-y-6 p-4 sm:p-6">
      {/* Welcome Header — always renders immediately */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
            {t("dashboard.welcome", { name: firstName })} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            {t("dashboard.overview")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/dashboard/billing")}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">فاتورة جديدة</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/dashboard/reports")}>
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">التقارير</span>
          </Button>
        </div>
      </motion.div>

      <NumaxioPayBanner />
      <DailyWisdom />

      {/* KPI Cards — skeleton-first */}
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="cursor-pointer"
                onClick={() => navigate(kpi.path)}
              >
                <Card className="border-border/60 hover:border-accent/30 hover:shadow-md transition-all h-full">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                        <kpi.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${kpi.color}`} />
                      </div>
                      {kpi.trend && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${kpi.trend === "up" ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
                          {kpi.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                      {kpi.isCurrency ? (
                        <><AnimatedCounter value={kpi.value} /> <span className="text-xs font-normal text-muted-foreground">{sar}</span></>
                      ) : (
                        <AnimatedCounter value={kpi.value} />
                      )}
                    </p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{kpi.label}</p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground/70 mt-0.5">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Quick Actions — always rendered immediately */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="border-border/60">
          <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> إجراءات سريعة
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
              {quickActions.map((action, i) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  onClick={() => navigate(action.path)}
                  className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl transition-all ${action.color}`}
                >
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">{action.label}</span>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts — lazy loaded AFTER initial render */}
      <Suspense fallback={
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-border/60"><CardContent className="p-6"><Skeleton className="h-[240px] w-full rounded-xl" /></CardContent></Card>
          <Card className="border-border/60"><CardContent className="p-6"><Skeleton className="h-[240px] w-full rounded-xl" /></CardContent></Card>
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

      {/* Performance cards */}
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <Card className="border-border/60 h-full">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-xs text-muted-foreground">نسبة التحصيل</span>
                </div>
                <p className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                  <AnimatedCounter value={collectionRate} />%
                </p>
                <Progress value={collectionRate} className="mt-3 h-2" />
                <p className="text-[10px] text-muted-foreground mt-2">
                  {s.paidInvoices} مدفوعة من {s.totalInvoices}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="border-border/60 h-full">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-success" />
                  </div>
                  <span className="text-xs text-muted-foreground">صافي الربح</span>
                </div>
                <p className={`text-2xl font-bold font-[IBM_Plex_Sans_Arabic] ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  <AnimatedCounter value={Math.abs(netProfit)} />
                  <span className="text-xs font-normal text-muted-foreground ms-1">{sar}</span>
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {netProfit >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                  )}
                  <span className="text-[10px] text-muted-foreground">الإيرادات - المصروفات</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
            <Card className="border-border/60 h-full">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-warning" />
                  </div>
                  <span className="text-xs text-muted-foreground">فواتير متأخرة</span>
                </div>
                <p className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                  <AnimatedCounter value={s.overdueInvoices} />
                </p>
                {s.overdueInvoices > 0 ? (
                  <Badge variant="outline" className="text-[10px] mt-2 text-destructive border-destructive/30">
                    <AlertTriangle className="w-3 h-3 mie-1" /> تحتاج متابعة
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] mt-2 text-success border-success/30">
                    <CheckCircle2 className="w-3 h-3 mie-1" /> ممتاز
                  </Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Card className="border-border/60 h-full">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-info/10 flex items-center justify-center">
                    <FileSignature className="w-4 h-4 text-info" />
                  </div>
                  <span className="text-xs text-muted-foreground">العقود النشطة</span>
                </div>
                <p className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                  <AnimatedCounter value={s.activeContracts} />
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  من أصل {s.totalContracts} عقد
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Activity + Company Info */}
      {s && data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="lg:col-span-2"
          >
            <Card className="border-border/60 h-full">
              <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent" /> {t("dashboard.recentActivities")}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/dashboard/audit")}>
                    <Eye className="w-3 h-3" /> عرض الكل
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4">
                {data.activities.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t("dashboard.noActivities")}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {data.activities.map((item, i) => {
                        const Icon = actionIcon(item.entity_type);
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + i * 0.04 }}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                                <Icon size={14} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {actionLabel(item.action, item.entity_type)}
                                </p>
                                {item.entity_label && (
                                  <p className="text-[11px] text-muted-foreground">{item.entity_label}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
                            </span>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card className="border-border/60 h-full">
              <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" /> {t("dashboard.companyInfo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4">
                <div className="space-y-4">
                  {[
                    { label: t("dashboard.companyName"), value: data.tenantName, icon: Users },
                    { label: t("dashboard.customerCount"), value: s.totalCustomers.toString(), icon: Users },
                    { label: t("dashboard.overdueInvoicesLabel"), value: s.overdueInvoices.toString(), icon: AlertTriangle, accent: s.overdueInvoices > 0 },
                    { label: t("dashboard.totalTax"), value: `${s.totalVat.toLocaleString("ar-SA")} ${sar}`, icon: Receipt },
                    { label: "إجمالي الفواتير", value: s.totalInvoices.toString(), icon: CreditCard },
                    { label: "العقود", value: s.totalContracts.toString(), icon: FileSignature },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                      </div>
                      <span className={`text-sm font-semibold ${item.accent ? "text-destructive" : "text-foreground"}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
