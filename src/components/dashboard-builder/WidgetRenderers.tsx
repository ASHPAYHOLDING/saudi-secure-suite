/**
 * Individual widget renderers for the Dashboard Builder.
 * Each receives dashboard stats and renders its specific content.
 * Widgets show a compact empty state when their data is zero/empty.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CircleDollarSign, Receipt, CalendarClock, ShieldAlert,
  TrendingUp, Users, Banknote, Bell, Activity,
  ArrowUpRight, ArrowDownRight, Minus, Plus, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency, fmtNumber } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ChartsSection = lazy(() => import("@/components/dashboard/DashboardCharts"));

interface WidgetProps {
  stats: any;
  activities?: any[];
  monthlyData?: any[];
}

/* ═══════════════════════════════════════════════
   Widget Empty State — compact, fits inside widget cards
   ═══════════════════════════════════════════════ */
const WidgetEmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionPath,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
}) => {
  const navigate = useNavigate();
  return (
    <Card className="h-full border-border/40 shadow-sm">
      <CardContent className="p-4 sm:p-5 h-full flex flex-col items-center justify-center text-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">{description}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8"
          onClick={() => navigate(actionPath)}
        >
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
};

/* ═══════════════════════════════════════════════
   Trend helper — computes % change between two periods
   Returns { direction, percent, tooltip } or null
   ═══════════════════════════════════════════════ */
interface TrendInfo {
  direction: "up" | "down" | "flat";
  percent: string;
  tooltip: string;
}

function computeTrend(
  current: number,
  previous: number | null | undefined,
  currentLabel: string,
  previousLabel: string,
  isCurrency = false,
): TrendInfo | null {
  if (previous == null || previous === 0) {
    if (current > 0) return { direction: "up", percent: "—", tooltip: `${currentLabel}: ${isCurrency ? fmtCurrency(current) : fmtNumber(current)} · لا توجد بيانات للفترة السابقة` };
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  const absChange = Math.abs(change).toFixed(1);
  const direction: TrendInfo["direction"] = change > 0.5 ? "up" : change < -0.5 ? "down" : "flat";
  const tooltip = `${currentLabel}: ${isCurrency ? fmtCurrency(current) : fmtNumber(current)} · ${previousLabel}: ${isCurrency ? fmtCurrency(previous) : fmtNumber(previous)} · التغيّر: ${change >= 0 ? "+" : ""}${absChange}%`;
  return { direction, percent: `${absChange}%`, tooltip };
}

/* ═══════════════════════════════════════════════
   KPI Widget (shared renderer) — with trend indicator + tooltip
   ═══════════════════════════════════════════════ */
const KpiWidget = ({
  label, value, isCurrency, sub, icon: Icon, iconBg, iconColor, trendInfo, path,
}: {
  label: string;
  value: number;
  isCurrency?: boolean;
  sub?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  trendInfo?: TrendInfo | null;
  path: string;
}) => {
  const navigate = useNavigate();

  const TrendBadge = trendInfo ? (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-default",
            trendInfo.direction === "up" && "bg-success/10 text-success",
            trendInfo.direction === "down" && "bg-destructive/10 text-destructive",
            trendInfo.direction === "flat" && "bg-muted text-muted-foreground",
          )}>
            {trendInfo.direction === "up" && <ArrowUpRight className="w-3 h-3" />}
            {trendInfo.direction === "down" && <ArrowDownRight className="w-3 h-3" />}
            {trendInfo.direction === "flat" && <Minus className="w-3 h-3" />}
            {trendInfo.percent}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[11px] max-w-[260px] text-center leading-relaxed">
          {trendInfo.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  return (
    <Card
      className="h-full border-border/40 shadow-sm hover:shadow-md hover:border-accent/20 transition-all cursor-pointer group relative overflow-hidden"
      onClick={() => navigate(path)}
    >
      <div className="absolute top-0 inset-x-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-accent to-accent/40" />
      <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          {TrendBadge}
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums">
            {isCurrency ? fmtCurrency(value) : fmtNumber(value)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

/* ═══════════════════════════════════════════════
   Widget Renderers
   ═══════════════════════════════════════════════ */

export const RevenueWidget = ({ stats, monthlyData = [] }: WidgetProps) => {
  if (stats.totalRevenue === 0 && stats.paidInvoices === 0) {
    return (
      <WidgetEmptyState
        icon={CircleDollarSign}
        title="لا توجد إيرادات بعد"
        description="أنشئ أول فاتورة لبدء تتبع الإيرادات"
        actionLabel="إنشاء فاتورة"
        actionPath="/dashboard/billing"
      />
    );
  }
  const currentRev = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 1]?.revenue : undefined;
  const prevRev = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2]?.revenue : undefined;
  const trend = computeTrend(currentRev ?? stats.totalRevenue, prevRev, "هذا الشهر", "الشهر السابق", true);
  return (
    <KpiWidget
      label="إجمالي الإيرادات" value={stats.totalRevenue} isCurrency
      sub={`${stats.paidInvoices} فاتورة محصّلة`}
      icon={CircleDollarSign} iconBg="bg-accent/10" iconColor="text-accent"
      trendInfo={trend}
      path="/dashboard/finance"
    />
  );
};

export const ExpensesWidget = ({ stats, monthlyData = [] }: WidgetProps) => {
  if (stats.totalExpenses === 0) {
    return (
      <WidgetEmptyState
        icon={Receipt}
        title="لا توجد مصروفات"
        description="سجّل أول مصروف لمتابعة النفقات"
        actionLabel="إضافة مصروف"
        actionPath="/dashboard/expenses"
      />
    );
  }
  const net = stats.totalRevenue - stats.totalExpenses;
  const margin = stats.totalRevenue > 0 ? ((net / stats.totalRevenue) * 100).toFixed(0) : 0;
  const currentExp = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 1]?.expenses : undefined;
  const prevExp = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2]?.expenses : undefined;
  // For expenses, "down" is good — invert the direction display
  const rawTrend = computeTrend(currentExp ?? stats.totalExpenses, prevExp, "هذا الشهر", "الشهر السابق", true);
  const trend = rawTrend ? { ...rawTrend, direction: rawTrend.direction === "up" ? "down" as const : rawTrend.direction === "down" ? "up" as const : "flat" as const } : null;
  return (
    <KpiWidget
      label="المصروفات" value={stats.totalExpenses} isCurrency
      sub={`هامش الربح: ${margin}%`}
      icon={Receipt} iconBg="bg-warning/10" iconColor="text-warning"
      trendInfo={trend}
      path="/dashboard/expenses"
    />
  );
};

export const OverdueWidget = ({ stats }: WidgetProps) => {
  if (stats.totalInvoices === 0) {
    return (
      <WidgetEmptyState
        icon={CalendarClock}
        title="لا توجد فواتير"
        description="أنشئ فواتير لمتابعة حالة التحصيل"
        actionLabel="إنشاء فاتورة"
        actionPath="/dashboard/billing"
      />
    );
  }
  const trend: TrendInfo = stats.overdueInvoices > 0
    ? { direction: "down", percent: `${stats.overdueInvoices}`, tooltip: `${stats.overdueInvoices} فاتورة متأخرة من أصل ${stats.totalInvoices}` }
    : { direction: "up", percent: "0", tooltip: "لا توجد فواتير متأخرة — ممتاز!" };
  return (
    <KpiWidget
      label="فواتير متأخرة" value={stats.overdueInvoices}
      sub={`من أصل ${stats.totalInvoices} فاتورة`}
      icon={CalendarClock}
      iconBg={stats.overdueInvoices > 0 ? "bg-destructive/10" : "bg-success/10"}
      iconColor={stats.overdueInvoices > 0 ? "text-destructive" : "text-success"}
      trendInfo={trend}
      path="/dashboard/billing"
    />
  );
};

export const VatWidget = ({ stats }: WidgetProps) => {
  if (stats.totalVat === 0 && stats.totalInvoices === 0) {
    return (
      <WidgetEmptyState
        icon={ShieldAlert}
        title="لا توجد ضريبة مستحقة"
        description="ستظهر بيانات الضريبة عند إصدار فواتير"
        actionLabel="إنشاء فاتورة"
        actionPath="/dashboard/billing"
      />
    );
  }
  return (
    <KpiWidget
      label="ضريبة القيمة المضافة" value={stats.totalVat} isCurrency
      sub="VAT 15% — مستحق للهيئة"
      icon={ShieldAlert} iconBg="bg-info/10" iconColor="text-info"
      path="/dashboard/vat-return"
    />
  );
};

export const CollectionWidget = ({ stats }: WidgetProps) => {
  if (stats.totalInvoices === 0) {
    return (
      <WidgetEmptyState
        icon={TrendingUp}
        title="لا توجد بيانات تحصيل"
        description="أنشئ فواتير لمتابعة معدل التحصيل"
        actionLabel="إنشاء فاتورة"
        actionPath="/dashboard/billing"
      />
    );
  }
  const rate = stats.totalInvoices > 0 ? Math.round((stats.paidInvoices / stats.totalInvoices) * 100) : 0;
  return (
    <Card className="h-full border-border/40 shadow-sm">
      <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <span className="text-sm font-semibold text-foreground">معدل التحصيل</span>
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground tabular-nums">{rate}%</p>
          <Progress value={rate} className="mt-2 h-2" />
          <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {stats.paidInvoices} من {stats.totalInvoices} فاتورة
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export const CustomersWidget = ({ stats }: WidgetProps) => {
  if (stats.totalCustomers === 0) {
    return (
      <WidgetEmptyState
        icon={Users}
        title="لا يوجد عملاء"
        description="أضف أول عميل لبدء إدارة علاقاتك"
        actionLabel="إضافة عميل"
        actionPath="/dashboard/customers"
      />
    );
  }
  return (
    <KpiWidget
      label="العملاء" value={stats.totalCustomers}
      sub={`${stats.activeContracts} عقد نشط`}
      icon={Users} iconBg="bg-primary/10" iconColor="text-primary"
      path="/dashboard/customers"
    />
  );
};

export const PayrollWidget = ({ stats }: WidgetProps) => (
  <Card className="h-full border-border/40 shadow-sm">
    <CardContent className="p-4 sm:p-5 h-full flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Banknote className="w-4 h-4 text-accent" />
        </div>
        <span className="text-sm font-semibold text-foreground">الرواتب</span>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">يتم عرض بيانات الرواتب من وحدة HR</p>
        <Badge className="mt-2 bg-accent/10 text-accent">Enterprise</Badge>
      </div>
    </CardContent>
  </Card>
);

export const AlertsWidget = ({ stats }: WidgetProps) => {
  const alerts: { msg: string; severity: "warning" | "destructive" | "info" }[] = [];
  if (stats.overdueInvoices > 0) alerts.push({ msg: `${stats.overdueInvoices} فاتورة متأخرة`, severity: "destructive" });
  const ratio = stats.totalRevenue > 0 ? (stats.totalExpenses / stats.totalRevenue) * 100 : 0;
  if (ratio > 85) alerts.push({ msg: `معدل حرق مرتفع (${ratio.toFixed(0)}%)`, severity: "warning" });
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  if (stats.totalVat > 0 && daysLeft <= 7) alerts.push({ msg: `إقرار VAT خلال ${daysLeft} يوم`, severity: "warning" });

  if (alerts.length === 0) {
    return (
      <Card className="h-full border-border/40 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-success" />
            التنبيهات
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col items-center justify-center text-center gap-2 py-4">
          <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-success" />
          </div>
          <p className="text-sm font-medium text-foreground">لا توجد تنبيهات ✅</p>
          <p className="text-[11px] text-muted-foreground">كل شيء يسير بشكل ممتاز</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border/40 shadow-sm">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-warning" />
          التنبيهات
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className={cn(
            "rounded-lg px-3 py-2 text-xs font-medium",
            a.severity === "destructive" && "bg-destructive/10 text-destructive",
            a.severity === "warning" && "bg-warning/10 text-warning",
            a.severity === "info" && "bg-muted text-muted-foreground",
          )}>
            {a.msg}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const ActivityWidget = ({ activities = [] }: WidgetProps) => {
  const navigate = useNavigate();
  const actionLabels: Record<string, string> = {
    create: "إنشاء", update: "تعديل", delete: "حذف", approve: "اعتماد",
    reject: "رفض", send: "إرسال", mark_paid: "تحصيل", cancel: "إلغاء",
  };
  const entityLabels: Record<string, string> = {
    invoice: "فاتورة", invoices: "فاتورة", contract: "عقد", customer: "عميل",
    expense: "مصروف", journal_entry: "قيد", payment: "دفعة",
  };

  if (activities.length === 0) {
    return (
      <Card className="h-full border-border/40 shadow-sm">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            آخر الأنشطة
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col items-center justify-center text-center gap-3 py-6">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">لا توجد أنشطة حديثة</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">ابدأ بإنشاء فاتورة أو إضافة عميل</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => navigate("/dashboard/billing")}
          >
            <Plus className="w-3.5 h-3.5" />
            إنشاء فاتورة
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border/40 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          آخر الأنشطة
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2 overflow-y-auto max-h-[200px]">
        {activities.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Activity className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-foreground font-medium">
              {actionLabels[a.action] || a.action} {entityLabels[a.entity_type] || a.entity_type}
            </span>
            {a.entity_label && <span className="text-muted-foreground truncate">— {a.entity_label}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export const ChartsWidget = ({ stats, monthlyData = [] }: WidgetProps) => {
  const navigate = useNavigate();
  const hasData = stats.totalInvoices > 0 || (monthlyData && monthlyData.some((m: any) => m.revenue > 0 || m.expenses > 0));

  if (!hasData) {
    return (
      <Card className="h-full border-border/40 shadow-sm">
        <CardContent className="p-4 sm:p-5 h-full flex flex-col items-center justify-center text-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">لا توجد بيانات للرسم البياني</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">أنشئ فواتير ومصروفات لعرض التحليلات</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={() => navigate("/dashboard/billing")}
          >
            <Plus className="w-3.5 h-3.5" />
            إنشاء فاتورة
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border/40 shadow-sm overflow-hidden">
      <CardContent className="p-2 h-full">
        <Suspense fallback={<Skeleton className="w-full h-full rounded-lg" />}>
          <ChartsSection
            monthlyData={monthlyData}
            invoiceDistribution={[
              { name: "مدفوعة", value: stats.paidInvoices, color: "hsl(var(--success))" },
              { name: "معلّقة", value: stats.pendingInvoices, color: "hsl(var(--warning))" },
              { name: "متأخرة", value: stats.overdueInvoices, color: "hsl(var(--destructive))" },
              { name: "مسودة", value: stats.draftInvoices, color: "hsl(var(--muted-foreground))" },
            ]}
            sar="ر.س"
          />
        </Suspense>
      </CardContent>
    </Card>
  );
};

/** Map widget ID to component */
export const WIDGET_COMPONENTS: Record<string, React.ComponentType<WidgetProps>> = {
  revenue: RevenueWidget,
  expenses: ExpensesWidget,
  overdue: OverdueWidget,
  vat: VatWidget,
  collection: CollectionWidget,
  customers: CustomersWidget,
  payroll: PayrollWidget,
  alerts: AlertsWidget,
  activity: ActivityWidget,
  charts: ChartsWidget,
};
