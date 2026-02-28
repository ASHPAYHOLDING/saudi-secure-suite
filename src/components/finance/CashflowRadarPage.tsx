import { useState, useMemo } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, DollarSign, Activity,
  Clock, Zap, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Scenario {
  delay_invoice_days: number;
  expense_increase_pct: number;
  advance_payment: number;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(v);

const formatShortCurrency = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

const CashflowRadarPage = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [timeWindow, setTimeWindow] = useState<30 | 60 | 90>(30);
  const [showScenario, setShowScenario] = useState(false);
  const [scenario, setScenario] = useState<Scenario>({
    delay_invoice_days: 0,
    expense_increase_pct: 0,
    advance_payment: 0,
  });

  const hasScenarioChanges = scenario.delay_invoice_days > 0 || scenario.expense_increase_pct > 0 || scenario.advance_payment > 0;

  const { data: baseData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["cashflow-radar", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("cashflow-radar", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      // Track event
      supabase.rpc("track_usage_event" as any, {
        p_tenant_id: tenantId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_event_type: "cashflow_radar_viewed",
        p_route: "/dashboard/finance/cashflow-radar",
        p_category: "analytics",
        p_metadata: {},
      });
      return data;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: scenarioData, isFetching: scenarioFetching } = useQuery({
    queryKey: ["cashflow-radar-scenario", tenantId, scenario],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("cashflow-radar", {
        body: { tenant_id: tenantId, scenario },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && hasScenarioChanges,
    staleTime: 0,
  });

  const activeData = hasScenarioChanges && scenarioData ? scenarioData : baseData;

  // Chart data: merge actuals + projections
  const chartData = useMemo(() => {
    if (!activeData) return [];
    const actuals = (activeData.actuals || []).map((a: any) => ({
      date: a.date,
      actual: a.actual_balance,
    }));
    const projections = (activeData.projections || [])
      .filter((_: any, i: number) => i < timeWindow)
      .map((p: any) => ({
        date: p.date,
        forecast: p.projected_balance,
        riskWeighted: p.risk_weighted_inflow,
      }));
    return [...actuals, ...projections];
  }, [activeData, timeWindow]);

  const summary = activeData?.summary;
  const alerts = activeData?.liquidity_alerts || [];
  const recommendations = activeData?.recommendations || "";

  const getAlertColor = (level: string) => {
    if (level === "critical") return "text-destructive";
    if (level === "medium") return "text-warning";
    return "text-primary";
  };

  const getAlertBg = (level: string) => {
    if (level === "critical") return "bg-destructive/10 border-destructive/30";
    if (level === "medium") return "bg-warning/10 border-warning/30";
    return "bg-primary/10 border-primary/30";
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      <PageHeader
        title={isRTL ? "رادار التدفق النقدي" : "Cashflow Radar"}
        description={isRTL ? "توقعات السيولة والتنبيهات الذكية" : "Liquidity forecasting & smart alerts"}
      >
        <Button
          variant={showScenario ? "default" : "outline"}
          size="sm"
          onClick={() => setShowScenario(!showScenario)}
        >
          <SlidersHorizontal className="h-4 w-4 me-2" />
          {isRTL ? "محاكاة" : "Simulate"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 me-2", isFetching && "animate-spin")} />
          {isRTL ? "تحديث" : "Refresh"}
        </Button>
      </PageHeader>

      {/* CFO Summary Card */}
      <Card className="border-border bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "الرصيد الحالي" : "Current Balance"}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(summary?.current_balance || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/30">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "التوقع (30 يوم)" : "30d Forecast"}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(summary?.projected_30d || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/30">
                <Activity className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "التوقع (90 يوم)" : "90d Forecast"}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(summary?.projected_90d || 0)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-xl",
                summary?.total_alerts > 0 ? "bg-destructive/10" : "bg-emerald-100 dark:bg-emerald-950/30"
              )}>
                {summary?.total_alerts > 0
                  ? <AlertTriangle className="h-6 w-6 text-destructive" />
                  : <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                }
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "تنبيهات السيولة" : "Liquidity Alerts"}</p>
                <p className="text-xl font-bold text-foreground">{summary?.total_alerts || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Simulator */}
      {showScenario && (
        <Card className="border-border border-dashed bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {isRTL ? "محاكي السيناريوهات" : "Scenario Simulator"}
              {hasScenarioChanges && (
                <Badge variant="secondary" className="text-xs">
                  {isRTL ? "محاكاة نشطة" : "Active"}
                </Badge>
              )}
              {scenarioFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label className="text-sm">{isRTL ? "تأخير تحصيل الفواتير (أيام)" : "Invoice Delay (days)"}</Label>
                <Slider
                  value={[scenario.delay_invoice_days]}
                  onValueChange={([v]) => setScenario(s => ({ ...s, delay_invoice_days: v }))}
                  max={30}
                  step={1}
                />
                <p className="text-xs text-muted-foreground text-center">{scenario.delay_invoice_days} {isRTL ? "يوم" : "days"}</p>
              </div>
              <div className="space-y-3">
                <Label className="text-sm">{isRTL ? "زيادة المصروفات (%)" : "Expense Increase (%)"}</Label>
                <Slider
                  value={[scenario.expense_increase_pct]}
                  onValueChange={([v]) => setScenario(s => ({ ...s, expense_increase_pct: v }))}
                  max={50}
                  step={1}
                />
                <p className="text-xs text-muted-foreground text-center">{scenario.expense_increase_pct}%</p>
              </div>
              <div className="space-y-3">
                <Label className="text-sm">{isRTL ? "دفعة مسبقة (ر.س)" : "Advance Payment (SAR)"}</Label>
                <Slider
                  value={[scenario.advance_payment]}
                  onValueChange={([v]) => setScenario(s => ({ ...s, advance_payment: v }))}
                  max={500000}
                  step={10000}
                />
                <p className="text-xs text-muted-foreground text-center">{formatCurrency(scenario.advance_payment)}</p>
              </div>
            </div>
            {hasScenarioChanges && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScenario({ delay_invoice_days: 0, expense_increase_pct: 0, advance_payment: 0 })}
                >
                  {isRTL ? "إعادة تعيين" : "Reset"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Time Window Toggle + Chart */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">{isRTL ? "الفعلي مقابل التوقعات" : "Actual vs Forecast"}</CardTitle>
            <div className="flex gap-1">
              {([30, 60, 90] as const).map(w => (
                <Button
                  key={w}
                  variant={timeWindow === w ? "default" : "outline"}
                  size="sm"
                  className="text-xs px-3"
                  onClick={() => setTimeWindow(w)}
                >
                  {w} {isRTL ? "يوم" : "d"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tickFormatter={formatShortCurrency}
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  labelFormatter={(l) => new Date(l).toLocaleDateString("ar-SA")}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name={isRTL ? "الفعلي" : "Actual"}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="hsl(var(--accent-foreground))"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  name={isRTL ? "التوقعات" : "Forecast"}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Liquidity Alerts */}
      {alerts.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {isRTL ? "تنبيهات السيولة" : "Liquidity Alerts"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert: any, i: number) => (
                <div key={i} className={cn("flex items-center justify-between rounded-lg border p-3", getAlertBg(alert.level))}>
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={cn("h-4 w-4", getAlertColor(alert.level))} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isRTL ? `يوم ${alert.day}` : `Day ${alert.day}`} — {new Date(alert.date).toLocaleDateString(isRTL ? "ar-SA" : "en-US")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? "الرصيد المتوقع:" : "Projected balance:"} {formatCurrency(alert.projected_balance)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getAlertColor(alert.level)}>
                    {alert.level === "critical"
                      ? (isRTL ? "حرج" : "Critical")
                      : alert.level === "medium"
                      ? (isRTL ? "متوسط" : "Medium")
                      : (isRTL ? "منخفض" : "Low")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations */}
      {recommendations && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {isRTL ? "توصيات المدير المالي الذكي" : "AI CFO Recommendations"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
              {recommendations}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{isRTL ? "متوسط التدفق اليومي الوارد" : "Avg Daily Inflow"}</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(summary?.avg_daily_inflow || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{isRTL ? "متوسط التدفق اليومي الصادر" : "Avg Daily Outflow"}</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(summary?.avg_daily_outflow || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{isRTL ? "الفواتير المفتوحة (مرجّح)" : "Open Invoices (Risk-Weighted)"}</p>
            <p className="text-lg font-bold text-foreground">{formatCurrency(summary?.risk_weighted_total || 0)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CashflowRadarPage;
