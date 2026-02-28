import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight,
  Wallet, BarChart3, Calendar, Building2, GitBranch, Loader2, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";

/* ─── Date helpers ─── */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const PRESET_RANGES: Record<string, { from: string; to: string; label: string; labelEn: string }> = {
  "7d": { from: daysAgo(7), to: daysAgo(0), label: "آخر 7 أيام", labelEn: "Last 7 days" },
  "30d": { from: daysAgo(30), to: daysAgo(0), label: "آخر 30 يوم", labelEn: "Last 30 days" },
  "90d": { from: daysAgo(90), to: daysAgo(0), label: "آخر 90 يوم", labelEn: "Last 90 days" },
  ytd: {
    from: `${new Date().getFullYear()}-01-01`,
    to: daysAgo(0),
    label: "من بداية السنة",
    labelEn: "Year to date",
  },
};

const ExecutiveAnalyticsDashboard = ({ embedded = false }: { embedded?: boolean }) => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();

  const [preset, setPreset] = useState("30d");
  const [dateFrom, setDateFrom] = useState(PRESET_RANGES["30d"].from);
  const [dateTo, setDateTo] = useState(PRESET_RANGES["30d"].to);
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const handlePreset = (key: string) => {
    setPreset(key);
    const r = PRESET_RANGES[key];
    if (r) { setDateFrom(r.from); setDateTo(r.to); }
  };

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ["branches", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch revenue
  const { data: revenueData, isLoading: revLoading, refetch: refetchRev } = useQuery({
    queryKey: ["analytics-revenue", tenantId, dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("analytics_daily_revenue" as any)
        .select("report_date, amount, invoice_count, branch_id")
        .eq("tenant_id", tenantId)
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .order("report_date", { ascending: true });
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  // Fetch expenses
  const { data: expenseData, isLoading: expLoading, refetch: refetchExp } = useQuery({
    queryKey: ["analytics-expenses", tenantId, dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("analytics_daily_expenses" as any)
        .select("report_date, amount, expense_count, branch_id")
        .eq("tenant_id", tenantId)
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .order("report_date", { ascending: true });
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  // Fetch cashflow
  const { data: cashflowData, isLoading: cfLoading, refetch: refetchCf } = useQuery({
    queryKey: ["analytics-cashflow", tenantId, dateFrom, dateTo, branchFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("analytics_daily_cashflow" as any)
        .select("report_date, inflow, outflow, net_flow, payment_count, branch_id")
        .eq("tenant_id", tenantId)
        .gte("report_date", dateFrom)
        .lte("report_date", dateTo)
        .order("report_date", { ascending: true });
      if (branchFilter !== "all") q = q.eq("branch_id", branchFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const isLoading = revLoading || expLoading || cfLoading;

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = (revenueData || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    const totalExpenses = (expenseData || []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const totalInflow = (cashflowData || []).reduce((s, c: any) => s + Number(c.inflow || 0), 0);
    const totalOutflow = (cashflowData || []).reduce((s, c: any) => s + Number(c.outflow || 0), 0);
    const cashBalance = totalInflow - totalOutflow;
    const invoiceCount = (revenueData || []).reduce((s, r: any) => s + Number(r.invoice_count || 0), 0);
    const expenseCount = (expenseData || []).reduce((s, e: any) => s + Number(e.expense_count || 0), 0);
    return { totalRevenue, totalExpenses, netProfit, cashBalance, invoiceCount, expenseCount, totalInflow, totalOutflow };
  }, [revenueData, expenseData, cashflowData]);

  // Chart data — merge revenue + expenses by date
  const chartData = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of revenueData || []) {
      const d = (r as any).report_date;
      if (!map[d]) map[d] = { date: d, revenue: 0, expenses: 0, net: 0 };
      map[d].revenue += Number((r as any).amount || 0);
    }
    for (const e of expenseData || []) {
      const d = (e as any).report_date;
      if (!map[d]) map[d] = { date: d, revenue: 0, expenses: 0, net: 0 };
      map[d].expenses += Number((e as any).amount || 0);
    }
    return Object.values(map)
      .map((v: any) => ({ ...v, net: v.revenue - v.expenses }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [revenueData, expenseData]);

  // Cashflow chart
  const cashflowChart = useMemo(() => {
    return (cashflowData || []).map((c: any) => ({
      date: c.report_date,
      inflow: Number(c.inflow || 0),
      outflow: Number(c.outflow || 0),
      net: Number(c.net_flow || 0),
    }));
  }, [cashflowData]);

  const refetchAll = () => { refetchRev(); refetchExp(); refetchCf(); };

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const KPI_CARDS = [
    {
      label: isRTL ? "إجمالي الإيرادات" : "Total Revenue",
      value: kpis.totalRevenue,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
      sub: isRTL ? `${kpis.invoiceCount} فاتورة` : `${kpis.invoiceCount} invoices`,
    },
    {
      label: isRTL ? "إجمالي المصروفات" : "Total Expenses",
      value: kpis.totalExpenses,
      icon: TrendingDown,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      sub: isRTL ? `${kpis.expenseCount} مصروف` : `${kpis.expenseCount} expenses`,
    },
    {
      label: isRTL ? "صافي الربح" : "Net Profit",
      value: kpis.netProfit,
      icon: DollarSign,
      color: kpis.netProfit >= 0 ? "text-emerald-600" : "text-red-500",
      bgColor: kpis.netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
      sub: kpis.netProfit >= 0
        ? (isRTL ? "ربح" : "Profit")
        : (isRTL ? "خسارة" : "Loss"),
    },
    {
      label: isRTL ? "صافي التدفق النقدي" : "Cash Balance",
      value: kpis.cashBalance,
      icon: Wallet,
      color: kpis.cashBalance >= 0 ? "text-blue-600" : "text-red-500",
      bgColor: kpis.cashBalance >= 0 ? "bg-blue-500/10" : "bg-red-500/10",
      sub: isRTL
        ? `${fmt(kpis.totalInflow)} داخل | ${fmt(kpis.totalOutflow)} خارج`
        : `${fmt(kpis.totalInflow)} in | ${fmt(kpis.totalOutflow)} out`,
    },
  ];

  return (
    <div dir="rtl" className={embedded ? "space-y-6" : "space-y-6 p-4 md:p-6"}>
      {!embedded && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-primary" />
                {isRTL ? "لوحة التحليلات التنفيذية" : "Executive Analytics"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isRTL ? "مؤشرات مالية سريعة من البيانات المجمّعة — بدون أحمال ثقيلة" : "Fast financial KPIs from pre-aggregated data"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={refetchAll} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              {isRTL ? "تحديث" : "Refresh"}
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "فترة سريعة" : "Quick range"}</Label>
                  <div className="flex gap-1.5">
                    {Object.entries(PRESET_RANGES).map(([key, r]) => (
                      <Button
                        key={key}
                        variant={preset === key ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handlePreset(key)}
                      >
                        {isRTL ? r.label : r.labelEn}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "من" : "From"}</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset(""); }} className="h-8 w-36 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "إلى" : "To"}</Label>
                  <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset(""); }} className="h-8 w-36 text-xs" />
                </div>
                {branches && branches.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1"><GitBranch className="h-3 w-3" />{isRTL ? "الفرع" : "Branch"}</Label>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? "جميع الفروع" : "All branches"}</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {KPI_CARDS.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="relative overflow-hidden">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                        <p className={cn("text-2xl font-bold", card.color)}>
                          {fmt(card.value)} <span className="text-xs font-normal text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                      </div>
                      <div className={cn("p-2.5 rounded-xl", card.bgColor)}>
                        <card.icon className={cn("h-5 w-5", card.color)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Revenue vs Expenses Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {isRTL ? "الإيرادات مقابل المصروفات" : "Revenue vs Expenses"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                      labelFormatter={(label) => label}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name={isRTL ? "الإيرادات" : "Revenue"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name={isRTL ? "المصروفات" : "Expenses"} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Cashflow Chart */}
          {cashflowChart.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  {isRTL ? "التدفق النقدي اليومي" : "Daily Cashflow"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={cashflowChart}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => fmt(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="inflow" name={isRTL ? "تدفق داخل" : "Inflow"} stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                    <Area type="monotone" dataKey="outflow" name={isRTL ? "تدفق خارج" : "Outflow"} stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.15)" />
                    <Area type="monotone" dataKey="net" name={isRTL ? "صافي" : "Net"} stroke="hsl(var(--accent-foreground))" fill="hsl(var(--accent) / 0.1)" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {chartData.length === 0 && cashflowChart.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  {isRTL
                    ? "لا توجد بيانات مجمّعة لهذه الفترة — سيتم تحديث البيانات تلقائياً كل ليلة"
                    : "No aggregated data for this period — data refreshes nightly"}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ExecutiveAnalyticsDashboard;
