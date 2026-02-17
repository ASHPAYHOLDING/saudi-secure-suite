import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, TrendingUp, CreditCard, FileSignature, Users, Loader2,
  ArrowUpRight, ArrowDownRight, Receipt, Wallet, BarChart3,
  Plus, Eye, Clock, CheckCircle2, AlertTriangle, Zap,
  PieChart, Target, Sparkles, Activity, Lightbulb
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from "recharts";

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

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
}

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
];

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

// حكمة اليوم المالية - تتغير يومياً
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

const DailyWisdom = () => {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const wisdom = FINANCIAL_WISDOMS[dayOfYear % FINANCIAL_WISDOMS.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-l from-accent/5 via-accent/[0.02] to-transparent p-5 sm:p-6">
        {/* Decorative elements */}
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

const DashboardHome = () => {
  const { tenantId, profile } = useAuth();
  const { t, dir, currentLang } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<AuditEntry[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    fetchAll();

    const channel = supabase
      .channel('dashboard-home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchAll = async () => {
    const [invoicesRes, contractsRes, customersRes, expensesRes, auditRes, tenantRes] = await Promise.all([
      supabase.from("invoices").select("status, grand_total, vat_total, due_date, invoice_date, created_at").eq("tenant_id", tenantId!),
      supabase.from("contracts").select("status").eq("tenant_id", tenantId!),
      supabase.from("customers").select("id").eq("tenant_id", tenantId!),
      supabase.from("expenses").select("total_amount, expense_date, status").eq("tenant_id", tenantId!),
      supabase.from("audit_logs").select("id, action, entity_type, entity_label, created_at, user_id").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(10),
      supabase.from("tenants").select("name").eq("id", tenantId!).single(),
    ]);

    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const contracts = contractsRes.data || [];
    const today = new Date().toISOString().split("T")[0];

    const totalExpenses = expenses
      .filter(e => e.status === "approved" || e.status === "paid")
      .reduce((s, e) => s + (e.total_amount || 0), 0);

    setStats({
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
    });

    // Build monthly data for chart (last 6 months)
    const months: MonthlyData[] = [];
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
      months.push({ month: monthLabel, revenue: rev, expenses: exp });
    }
    setMonthlyData(months);

    setActivities(auditRes.data || []);
    setTenantName(tenantRes.data?.name || "");
    setLoading(false);
  };

  const actionLabel = (action: string, entityType: string) => {
    const actionMap: Record<string, string> = {
      create: t("dashboard.actionCreate"),
      update: t("dashboard.actionUpdate"),
      delete: t("dashboard.actionDelete"),
      sign: t("dashboard.actionSign"),
      cancel: t("dashboard.actionCancel"),
      mark_paid: t("dashboard.actionMarkPaid"),
    };
    const entityMap: Record<string, string> = {
      invoice: t("dashboard.entityInvoice"),
      contract: t("dashboard.entityContract"),
      customer: t("dashboard.entityCustomer"),
      stamp: t("dashboard.entityStamp"),
      expense: t("dashboard.entityExpense") || "مصروف",
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
    };
    return icons[entityType] || FileText;
  };

  const firstName = tenantName || profile?.full_name?.split(" ")[0] || t("common.user");
  const sar = t("common.sar");
  const dateLocale = currentLang === "ar" ? ar : enUS;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = stats!;
  const netProfit = s.totalRevenue - s.totalExpenses;
  const collectionRate = s.totalInvoices > 0 ? Math.round((s.paidInvoices / s.totalInvoices) * 100) : 0;

  const invoiceDistribution = [
    { name: "مدفوعة", value: s.paidInvoices, color: "hsl(var(--accent))" },
    { name: "معلّقة", value: s.pendingInvoices, color: "hsl(var(--warning))" },
    { name: "متأخرة", value: s.overdueInvoices, color: "hsl(var(--destructive))" },
    { name: "مسودة", value: s.draftInvoices, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0);

  const kpiCards = [
    {
      label: t("dashboard.totalInvoices"),
      value: s.totalInvoices,
      sub: t("dashboard.paidDraft", { paid: s.paidInvoices, draft: s.draftInvoices }),
      icon: CreditCard,
      bg: "bg-accent/10",
      color: "text-accent",
      trend: s.paidInvoices > 0 ? "up" : null,
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
      trend: s.totalRevenue > 0 ? "up" : null,
      path: "/dashboard/finance",
    },
    {
      label: "المصروفات",
      value: s.totalExpenses,
      isCurrency: true,
      sub: `صافي الربح: ${netProfit.toLocaleString("ar-SA")} ${sar}`,
      icon: Receipt,
      bg: "bg-destructive/10",
      color: "text-destructive",
      trend: netProfit > 0 ? "up" : netProfit < 0 ? "down" : null,
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
  ];

  const quickActions = [
    { label: "فاتورة جديدة", icon: CreditCard, path: "/dashboard/billing", color: "bg-accent/10 text-accent hover:bg-accent/20" },
    { label: "عرض سعر", icon: FileText, path: "/dashboard/quotations", color: "bg-info/10 text-info hover:bg-info/20" },
    { label: "مصروف جديد", icon: Receipt, path: "/dashboard/expenses", color: "bg-warning/10 text-warning hover:bg-warning/20" },
    { label: "عميل جديد", icon: Users, path: "/dashboard/customers", color: "bg-success/10 text-success hover:bg-success/20" },
    { label: "عقد جديد", icon: FileSignature, path: "/dashboard/contracts", color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" },
    { label: "التقارير", icon: BarChart3, path: "/dashboard/reports", color: "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20" },
  ];

  return (
    <div dir={dir} className="space-y-6 p-4 sm:p-6">
      {/* Welcome Header */}
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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/billing")}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">فاتورة جديدة</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/reports")}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">التقارير</span>
          </Button>
        </div>
      </motion.div>

      {/* حكمة اليوم المالية */}
      <DailyWisdom />

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
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
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
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

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> الإيرادات والمصروفات
                <Badge variant="secondary" className="text-[10px] mr-auto">آخر ٦ أشهر</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4">
              <div className="h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12, direction: "rtl" }}
                      formatter={(value: number) => [value.toLocaleString("ar-SA") + " " + sar, ""]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" fill="url(#revGrad)" strokeWidth={2} name="الإيرادات" />
                    <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="url(#expGrad)" strokeWidth={2} name="المصروفات" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Invoice Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-5">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-accent" /> توزيع الفواتير
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4">
              {invoiceDistribution.length > 0 ? (
                <>
                  <div className="h-[140px] sm:h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={invoiceDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {invoiceDistribution.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, ""]} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {invoiceDistribution.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-[11px] text-muted-foreground">{d.name} ({d.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                  <PieChart className="w-10 h-10 opacity-30 mb-2" />
                  <p className="text-xs">لا توجد فواتير بعد</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance + Collection Rate */}
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
                <span className="text-xs font-normal text-muted-foreground mr-1">{sar}</span>
              </p>
              <div className="flex items-center gap-1 mt-2">
                {netProfit >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  الإيرادات - المصروفات
                </span>
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
              {s.overdueInvoices > 0 && (
                <Badge variant="outline" className="text-[10px] mt-2 text-destructive border-destructive/30">
                  <AlertTriangle className="w-3 h-3 ml-1" /> تحتاج متابعة
                </Badge>
              )}
              {s.overdueInvoices === 0 && (
                <Badge variant="outline" className="text-[10px] mt-2 text-success border-success/30">
                  <CheckCircle2 className="w-3 h-3 ml-1" /> ممتاز
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

      {/* Activity + Company Info */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
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
              {activities.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{t("dashboard.noActivities")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {activities.map((item, i) => {
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

        {/* Company Info */}
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
                  { label: t("dashboard.companyName"), value: tenantName, icon: Users },
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
    </div>
  );
};

export default DashboardHome;
