/**
 * Individual widget renderers for the Dashboard Builder.
 * Each receives dashboard stats and renders its specific content.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CircleDollarSign, Receipt, CalendarClock, ShieldAlert,
  TrendingUp, Users, Banknote, Bell, Activity,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ChartsSection = lazy(() => import("@/components/dashboard/DashboardCharts"));

interface WidgetProps {
  stats: any;
  activities?: any[];
  monthlyData?: any[];
}

const fmt = (n: number) => n.toLocaleString("ar-SA");

const KpiWidget = ({
  label, value, isCurrency, sub, icon: Icon, iconBg, iconColor, trend, trendLabel, path,
}: any) => {
  const navigate = useNavigate();
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
          {trend && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
              trend === "up" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trendLabel}
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {fmt(value)}
            {isCurrency && <span className="text-xs font-normal text-muted-foreground ms-1">ر.س</span>}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

export const RevenueWidget = ({ stats }: WidgetProps) => (
  <KpiWidget
    label="إجمالي الإيرادات" value={stats.totalRevenue} isCurrency
    sub={`${stats.paidInvoices} فاتورة محصّلة`}
    icon={CircleDollarSign} iconBg="bg-accent/10" iconColor="text-accent"
    trend={stats.totalRevenue > 0 ? "up" : null} trendLabel="محصّل"
    path="/dashboard/finance"
  />
);

export const ExpensesWidget = ({ stats }: WidgetProps) => {
  const net = stats.totalRevenue - stats.totalExpenses;
  const margin = stats.totalRevenue > 0 ? ((net / stats.totalRevenue) * 100).toFixed(0) : 0;
  return (
    <KpiWidget
      label="المصروفات" value={stats.totalExpenses} isCurrency
      sub={`هامش الربح: ${margin}%`}
      icon={Receipt} iconBg="bg-warning/10" iconColor="text-warning"
      trend={net >= 0 ? "up" : "down"} trendLabel={net >= 0 ? "ربح" : "خسارة"}
      path="/dashboard/expenses"
    />
  );
};

export const OverdueWidget = ({ stats }: WidgetProps) => (
  <KpiWidget
    label="فواتير متأخرة" value={stats.overdueInvoices}
    sub={`من أصل ${stats.totalInvoices} فاتورة`}
    icon={CalendarClock}
    iconBg={stats.overdueInvoices > 0 ? "bg-destructive/10" : "bg-success/10"}
    iconColor={stats.overdueInvoices > 0 ? "text-destructive" : "text-success"}
    trend={stats.overdueInvoices > 0 ? "down" : "up"}
    trendLabel={stats.overdueInvoices > 0 ? "متأخر" : "ممتاز"}
    path="/dashboard/billing"
  />
);

export const VatWidget = ({ stats }: WidgetProps) => (
  <KpiWidget
    label="ضريبة القيمة المضافة" value={stats.totalVat} isCurrency
    sub="VAT 15% — مستحق للهيئة"
    icon={ShieldAlert} iconBg="bg-info/10" iconColor="text-info"
    trend={null} trendLabel="ZATCA"
    path="/dashboard/vat-return"
  />
);

export const CollectionWidget = ({ stats }: WidgetProps) => {
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
          <p className="text-3xl font-bold text-foreground">{rate}%</p>
          <Progress value={rate} className="mt-2 h-2" />
          <p className="text-[10px] text-muted-foreground mt-1">
            {stats.paidInvoices} من {stats.totalInvoices} فاتورة
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export const CustomersWidget = ({ stats }: WidgetProps) => (
  <KpiWidget
    label="العملاء" value={stats.totalCustomers}
    sub={`${stats.activeContracts} عقد نشط`}
    icon={Users} iconBg="bg-primary/10" iconColor="text-primary"
    trend={null} trendLabel=""
    path="/dashboard/customers"
  />
);

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
  if (alerts.length === 0) alerts.push({ msg: "لا توجد تنبيهات حالياً ✅", severity: "info" });

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
  const actionLabels: Record<string, string> = {
    create: "إنشاء", update: "تعديل", delete: "حذف", approve: "اعتماد",
    reject: "رفض", send: "إرسال", mark_paid: "تحصيل", cancel: "إلغاء",
  };
  const entityLabels: Record<string, string> = {
    invoice: "فاتورة", invoices: "فاتورة", contract: "عقد", customer: "عميل",
    expense: "مصروف", journal_entry: "قيد", payment: "دفعة",
  };

  return (
    <Card className="h-full border-border/40 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          آخر الأنشطة
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2 overflow-y-auto max-h-[200px]">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">لا توجد أنشطة حديثة</p>
        ) : (
          activities.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Activity className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className="text-foreground font-medium">
                {actionLabels[a.action] || a.action} {entityLabels[a.entity_type] || a.entity_type}
              </span>
              {a.entity_label && <span className="text-muted-foreground truncate">— {a.entity_label}</span>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export const ChartsWidget = ({ stats, monthlyData = [] }: WidgetProps) => (
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
