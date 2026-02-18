import { useState, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, Loader2, Printer, FileSpreadsheet,
  ArrowUpRight, ArrowDownRight, Minus, BarChart3, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { exportReportPDF, exportReportExcel } from "@/lib/report-export";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
} from "recharts";

interface MonthlyData {
  period: string;
  revenue: number;
  expenses: number;
  net_cash: number;
}

interface ForecastPoint extends MonthlyData {
  type: "actual" | "forecast";
  revenue_optimistic?: number;
  revenue_pessimistic?: number;
  expenses_optimistic?: number;
  expenses_pessimistic?: number;
  net_cash_optimistic?: number;
  net_cash_pessimistic?: number;
}

// Simple linear regression
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function forecast(values: number[], periods: number, growthRate: number = 0): number[] {
  const { slope, intercept } = linearRegression(values);
  const n = values.length;
  const result: number[] = [];
  for (let i = 0; i < periods; i++) {
    const base = Math.max(0, intercept + slope * (n + i));
    result.push(base * (1 + growthRate));
  }
  return result;
}

function getMonthLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr + "-01");
    return d.toLocaleDateString("ar-SA", { year: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "-01");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 7);
}

const fmt = (v: number) => v.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const ForecastingPage = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();

  const [forecastMonths, setForecastMonths] = useState<"6" | "12">("6");
  const [loading, setLoading] = useState(false);
  const [actual, setActual] = useState<MonthlyData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const runForecast = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Get last 12 months
      const now = new Date();
      const from = new Date(now);
      from.setMonth(from.getMonth() - 12);
      const periodFrom = from.toISOString().slice(0, 10);
      const periodTo = now.toISOString().slice(0, 10);

      // Fetch revenue from revenue_summary_view
      const { data: revData } = await supabase.rpc("query_analytics_view", {
        _tenant_id: tenantId,
        _view_name: "revenue_summary_view",
        _columns: ["period", "net_revenue"],
        _group_by: ["period"],
        _period_from: periodFrom,
        _period_to: periodTo,
        _branch_id: null,
        _sort_by: "period",
        _sort_direction: "asc",
        _limit: 100,
      });

      // Fetch expenses from expense_summary_view
      const { data: expData } = await supabase.rpc("query_analytics_view", {
        _tenant_id: tenantId,
        _view_name: "expense_summary_view",
        _columns: ["period", "net_expense"],
        _group_by: ["period"],
        _period_from: periodFrom,
        _period_to: periodTo,
        _branch_id: null,
        _sort_by: "period",
        _sort_direction: "asc",
        _limit: 100,
      });

      // Fetch cashflow from cashflow_view
      const { data: cfData } = await supabase.rpc("query_analytics_view", {
        _tenant_id: tenantId,
        _view_name: "cashflow_view",
        _columns: ["period", "net_cash"],
        _group_by: ["period"],
        _period_from: periodFrom,
        _period_to: periodTo,
        _branch_id: null,
        _sort_by: "period",
        _sort_direction: "asc",
        _limit: 100,
      });

      const revRows = (Array.isArray(revData) ? revData : []) as Record<string, any>[];
      const expRows = (Array.isArray(expData) ? expData : []) as Record<string, any>[];
      const cfRows = (Array.isArray(cfData) ? cfData : []) as Record<string, any>[];

      // Build monthly map
      const months = new Map<string, MonthlyData>();
      for (const r of revRows) {
        const p = String(r.period || "").slice(0, 7);
        if (!p) continue;
        const existing = months.get(p) || { period: p, revenue: 0, expenses: 0, net_cash: 0 };
        existing.revenue += Number(r.net_revenue) || 0;
        months.set(p, existing);
      }
      for (const r of expRows) {
        const p = String(r.period || "").slice(0, 7);
        if (!p) continue;
        const existing = months.get(p) || { period: p, revenue: 0, expenses: 0, net_cash: 0 };
        existing.expenses += Math.abs(Number(r.net_expense) || 0);
        months.set(p, existing);
      }
      for (const r of cfRows) {
        const p = String(r.period || "").slice(0, 7);
        if (!p) continue;
        const existing = months.get(p) || { period: p, revenue: 0, expenses: 0, net_cash: 0 };
        existing.net_cash += Number(r.net_cash) || 0;
        months.set(p, existing);
      }

      const sorted = Array.from(months.values()).sort((a, b) => a.period.localeCompare(b.period));
      setActual(sorted);

      if (sorted.length === 0) {
        toast.info(isRTL ? "لا توجد بيانات تاريخية للتحليل" : "No historical data for analysis");
        setForecastData([]);
        setLoading(false);
        return;
      }

      // Run forecasts
      const periods = Number(forecastMonths);
      const revValues = sorted.map(d => d.revenue);
      const expValues = sorted.map(d => d.expenses);
      const cashValues = sorted.map(d => d.net_cash);

      const revBase = forecast(revValues, periods, 0);
      const revOpt = forecast(revValues, periods, 0.1);
      const revPess = forecast(revValues, periods, -0.1);

      const expBase = forecast(expValues, periods, 0);
      const expOpt = forecast(expValues, periods, 0.1);
      const expPess = forecast(expValues, periods, -0.1);

      const cashBase = forecast(cashValues, periods, 0);
      const cashOpt = forecast(cashValues, periods, 0.1);
      const cashPess = forecast(cashValues, periods, -0.1);

      const lastPeriod = sorted[sorted.length - 1].period;

      const combined: ForecastPoint[] = [
        ...sorted.map(d => ({ ...d, type: "actual" as const })),
        ...Array.from({ length: periods }, (_, i) => ({
          period: addMonths(lastPeriod, i + 1),
          type: "forecast" as const,
          revenue: revBase[i],
          expenses: expBase[i],
          net_cash: cashBase[i],
          revenue_optimistic: revOpt[i],
          revenue_pessimistic: revPess[i],
          expenses_optimistic: expOpt[i],
          expenses_pessimistic: expPess[i],
          net_cash_optimistic: cashOpt[i],
          net_cash_pessimistic: cashPess[i],
        })),
      ];

      setForecastData(combined);
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
    setLoading(false);
  }, [tenantId, forecastMonths, isRTL]);

  // KPI summary
  const forecastOnly = forecastData.filter(d => d.type === "forecast");
  const totalRevForecast = forecastOnly.reduce((s, d) => s + d.revenue, 0);
  const totalExpForecast = forecastOnly.reduce((s, d) => s + d.expenses, 0);
  const totalCashForecast = forecastOnly.reduce((s, d) => s + d.net_cash, 0);
  const totalRevActual = actual.reduce((s, d) => s + d.revenue, 0);
  const totalExpActual = actual.reduce((s, d) => s + d.expenses, 0);

  const revGrowth = totalRevActual > 0 ? ((totalRevForecast - totalRevActual) / totalRevActual * 100) : 0;

  // Chart data
  const chartData = forecastData.map(d => ({
    period: getMonthLabel(d.period),
    [isRTL ? "إيرادات" : "Revenue"]: Math.round(d.revenue),
    [isRTL ? "مصروفات" : "Expenses"]: Math.round(d.expenses),
    [isRTL ? "تدفق نقدي" : "Cash Flow"]: Math.round(d.net_cash),
    type: d.type,
    ...(d.type === "forecast" ? {
      [isRTL ? "إيرادات +10%" : "Revenue +10%"]: Math.round(d.revenue_optimistic || 0),
      [isRTL ? "إيرادات -10%" : "Revenue -10%"]: Math.round(d.revenue_pessimistic || 0),
    } : {}),
  }));

  const handleExportPDF = () => {
    if (!printRef.current) return;
    exportReportPDF(printRef.current, {
      key: "forecasting",
      name: "Financial Forecast",
      nameAr: "التوقعات المالية",
      category: "general",
      columns: [],
      description: "",
      descriptionAr: "",
      icon: "TrendingUp",
      source: "forecasting",
      supportsBranch: false,
      supportsCustomer: false,
    }, `${actual[0]?.period || ""} — ${forecastOnly[forecastOnly.length - 1]?.period || ""}`);
  };

  const handleExportExcel = () => {
    if (forecastData.length === 0) return;
    const cols = [
      { key: "period", label: "Period", labelAr: "الفترة", type: "text" as const },
      { key: "type", label: "Type", labelAr: "النوع", type: "text" as const },
      { key: "revenue", label: "Revenue", labelAr: "الإيرادات", type: "currency" as const },
      { key: "expenses", label: "Expenses", labelAr: "المصروفات", type: "currency" as const },
      { key: "net_cash", label: "Net Cash", labelAr: "صافي النقد", type: "currency" as const },
    ];
    const rows = forecastData.map(d => ({
      period: d.period,
      type: d.type === "actual" ? "فعلي" : "توقع",
      revenue: d.revenue,
      expenses: d.expenses,
      net_cash: d.net_cash,
    }));
    exportReportExcel(rows, cols, {
      key: "forecasting",
      name: "Financial Forecast",
      nameAr: "التوقعات المالية",
      category: "general",
      columns: cols,
      description: "",
      descriptionAr: "",
      icon: "TrendingUp",
      source: "forecasting",
      supportsBranch: false,
      supportsCustomer: false,
    }, `${actual[0]?.period || ""} — ${forecastOnly[forecastOnly.length - 1]?.period || ""}`);
  };

  const revKey = isRTL ? "إيرادات" : "Revenue";
  const expKey = isRTL ? "مصروفات" : "Expenses";
  const cashKey = isRTL ? "تدفق نقدي" : "Cash Flow";
  const revOptKey = isRTL ? "إيرادات +10%" : "Revenue +10%";
  const revPessKey = isRTL ? "إيرادات -10%" : "Revenue -10%";

  return (
    <div dir="rtl" className="space-y-4 p-4 md:p-6" ref={printRef}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="text-primary" size={22} />
            {isRTL ? "التوقعات المالية" : "Financial Forecasting"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isRTL ? "تحليل آخر 12 شهر وتوقع الفترة القادمة مع سيناريوهات النمو والانخفاض" : "Analyze last 12 months & forecast upcoming period with growth/decline scenarios"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={forecastMonths} onValueChange={(v) => setForecastMonths(v as "6" | "12")}>
            <SelectTrigger className="w-[140px] text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6" className="text-xs">{isRTL ? "توقع 6 أشهر" : "Forecast 6 months"}</SelectItem>
              <SelectItem value="12" className="text-xs">{isRTL ? "توقع 12 شهر" : "Forecast 12 months"}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runForecast} disabled={loading} className="gap-1.5 text-xs h-9">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            {isRTL ? "تحليل وتوقع" : "Analyze & Forecast"}
          </Button>
          {forecastData.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1 text-[10px] h-9">
                <Printer size={12} /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1 text-[10px] h-9">
                <FileSpreadsheet size={12} /> Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {forecastData.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20">
          <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'اضغط "تحليل وتوقع" لبدء التحليل المالي' : 'Click "Analyze & Forecast" to start'}
          </p>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              title={isRTL ? "إيرادات متوقعة" : "Forecasted Revenue"}
              value={fmt(totalRevForecast)}
              subtitle={`${isRTL ? "ر.س" : "SAR"}`}
              trend={revGrowth}
              icon={<TrendingUp size={18} />}
              color="text-emerald-600"
            />
            <KPICard
              title={isRTL ? "مصروفات متوقعة" : "Forecasted Expenses"}
              value={fmt(totalExpForecast)}
              subtitle={`${isRTL ? "ر.س" : "SAR"}`}
              icon={<TrendingDown size={18} />}
              color="text-red-500"
            />
            <KPICard
              title={isRTL ? "صافي تدفق نقدي" : "Net Cash Flow"}
              value={fmt(totalCashForecast)}
              subtitle={`${isRTL ? "ر.س" : "SAR"}`}
              trend={totalCashForecast > 0 ? 1 : totalCashForecast < 0 ? -1 : 0}
              icon={<BarChart3 size={18} />}
              color={totalCashForecast >= 0 ? "text-emerald-600" : "text-red-500"}
            />
            <KPICard
              title={isRTL ? "فترة التوقع" : "Forecast Period"}
              value={`${forecastMonths} ${isRTL ? "شهر" : "months"}`}
              subtitle={`${actual.length} ${isRTL ? "شهر تاريخي" : "historical months"}`}
              icon={<Calendar size={18} />}
              color="text-primary"
            />
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">
                {isRTL ? "الرسم البياني — الفعلي مقابل التوقع" : "Chart — Actual vs Forecast"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, direction: "rtl" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey={revKey} stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey={expKey} stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} />
                  <Line type="monotone" dataKey={cashKey} stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={revOptKey} stroke="hsl(var(--primary))" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey={revPessKey} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Scenario Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ScenarioCard
              title={isRTL ? "السيناريو الأساسي" : "Base Scenario"}
              subtitle={isRTL ? "بناءً على الاتجاه الحالي" : "Based on current trend"}
              revenue={totalRevForecast}
              expenses={totalExpForecast}
              netCash={totalCashForecast}
              variant="default"
              isRTL={isRTL}
            />
            <ScenarioCard
              title={isRTL ? "سيناريو النمو +10%" : "Growth +10% Scenario"}
              subtitle={isRTL ? "زيادة 10% في الإيرادات والمصروفات" : "+10% increase in revenue & expenses"}
              revenue={forecastOnly.reduce((s, d) => s + (d.revenue_optimistic || 0), 0)}
              expenses={forecastOnly.reduce((s, d) => s + (d.expenses_optimistic || 0), 0)}
              netCash={forecastOnly.reduce((s, d) => s + (d.net_cash_optimistic || 0), 0)}
              variant="optimistic"
              isRTL={isRTL}
            />
            <ScenarioCard
              title={isRTL ? "سيناريو الانخفاض -10%" : "Decline -10% Scenario"}
              subtitle={isRTL ? "انخفاض 10% في الإيرادات والمصروفات" : "-10% decrease in revenue & expenses"}
              revenue={forecastOnly.reduce((s, d) => s + (d.revenue_pessimistic || 0), 0)}
              expenses={forecastOnly.reduce((s, d) => s + (d.expenses_pessimistic || 0), 0)}
              netCash={forecastOnly.reduce((s, d) => s + (d.net_cash_pessimistic || 0), 0)}
              variant="pessimistic"
              isRTL={isRTL}
            />
          </div>

          {/* Detail Table */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">{isRTL ? "التفاصيل الشهرية" : "Monthly Details"}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">{isRTL ? "الفترة" : "Period"}</TableHead>
                      <TableHead className="text-xs">{isRTL ? "النوع" : "Type"}</TableHead>
                      <TableHead className="text-xs">{isRTL ? "الإيرادات" : "Revenue"}</TableHead>
                      <TableHead className="text-xs">{isRTL ? "المصروفات" : "Expenses"}</TableHead>
                      <TableHead className="text-xs">{isRTL ? "صافي النقد" : "Net Cash"}</TableHead>
                      <TableHead className="text-xs">{isRTL ? "إيرادات +10%" : "Rev +10%"}</TableHead>
                      <TableHead className="text-xs">{isRTL ? "إيرادات -10%" : "Rev -10%"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecastData.map((row, idx) => (
                      <TableRow key={idx} className={row.type === "forecast" ? "bg-primary/5" : ""}>
                        <TableCell className="text-xs font-medium">{getMonthLabel(row.period)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={row.type === "actual" ? "secondary" : "default"} className="text-[9px]">
                            {row.type === "actual" ? (isRTL ? "فعلي" : "Actual") : (isRTL ? "توقع" : "Forecast")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{fmt(row.revenue)}</TableCell>
                        <TableCell className="text-xs">{fmt(row.expenses)}</TableCell>
                        <TableCell className="text-xs font-medium">{fmt(row.net_cash)}</TableCell>
                        <TableCell className="text-xs text-emerald-600">{row.type === "forecast" ? fmt(row.revenue_optimistic || 0) : "—"}</TableCell>
                        <TableCell className="text-xs text-amber-600">{row.type === "forecast" ? fmt(row.revenue_pessimistic || 0) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// ── Sub-components ──

function KPICard({ title, value, subtitle, trend, icon, color }: {
  title: string; value: string; subtitle: string; trend?: number; icon: React.ReactNode; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`${color}`}>{icon}</span>
          {trend !== undefined && trend !== 0 && (
            <Badge variant={trend > 0 ? "default" : "destructive"} className="text-[9px] gap-0.5">
              {trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(trend).toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{title}</p>
        <p className="text-[9px] text-muted-foreground/70">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ScenarioCard({ title, subtitle, revenue, expenses, netCash, variant, isRTL }: {
  title: string; subtitle: string; revenue: number; expenses: number; netCash: number;
  variant: "default" | "optimistic" | "pessimistic"; isRTL: boolean;
}) {
  const borderColor = variant === "optimistic" ? "border-emerald-500/30" : variant === "pessimistic" ? "border-amber-500/30" : "border-primary/30";
  const bgColor = variant === "optimistic" ? "bg-emerald-500/5" : variant === "pessimistic" ? "bg-amber-500/5" : "bg-primary/5";
  return (
    <Card className={`${borderColor} ${bgColor} border`}>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{isRTL ? "الإيرادات" : "Revenue"}</span>
            <span className="font-semibold text-emerald-600">{fmt(revenue)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{isRTL ? "المصروفات" : "Expenses"}</span>
            <span className="font-semibold text-red-500">{fmt(expenses)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-xs">
            <span className="font-medium">{isRTL ? "صافي النقد" : "Net Cash"}</span>
            <span className={`font-bold ${netCash >= 0 ? "text-emerald-600" : "text-red-500"}`}>{fmt(netCash)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ForecastingPage;
