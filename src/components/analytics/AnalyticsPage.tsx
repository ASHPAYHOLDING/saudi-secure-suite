import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Loader2, TrendingUp, TrendingDown, Users, PieChart as PieChartIcon,
  DollarSign, ArrowUpRight, ArrowDownRight, Wallet, Activity, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, ComposedChart,
} from "recharts";
import { usePermissions } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--secondary-foreground))",
  "hsl(var(--muted-foreground))",
  "hsl(160, 60%, 45%)",
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const fmt = (n: number) => n.toLocaleString("ar-SA");

interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  expenseCount: number;
}

const AnalyticsPage = () => {
  const { tenantId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("12");
  const [role, setRole] = useState<AppRole>("member");
  const perms = usePermissions(role);

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [customerStats, setCustomerStats] = useState<{ name: string; revenue: number; count: number }[]>([]);
  const [totals, setTotals] = useState({
    revenue: 0, prevRevenue: 0, expenses: 0, prevExpenses: 0,
    profit: 0, prevProfit: 0, cashFlow: 0, prevCashFlow: 0,
    paidCount: 0, overdueCount: 0, outstandingAmount: 0,
  });

  useEffect(() => {
    if (!tenantId || !user) return;
    supabase.from("tenant_members").select("role")
      .eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.role) setRole(data.role as AppRole); });
  }, [tenantId, user]);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const months = parseInt(period);
    const now = new Date();
    const periodStart = startOfMonth(subMonths(now, months));
    const prevPeriodStart = startOfMonth(subMonths(now, months * 2));

    const [invRes, expRes, custRes, catRes] = await Promise.all([
      supabase.from("invoices").select("id, status, grand_total, amount_due, due_date, invoice_date, customer_id")
        .eq("tenant_id", tenantId).gte("invoice_date", prevPeriodStart.toISOString()),
      supabase.from("expenses").select("id, status, total_amount, expense_date, category_id")
        .eq("tenant_id", tenantId).gte("expense_date", prevPeriodStart.toISOString()),
      supabase.from("customers").select("id, name").eq("tenant_id", tenantId),
      supabase.from("expense_categories").select("id, name").eq("tenant_id", tenantId),
    ]);

    const invoices = invRes.data || [];
    const expenses = expRes.data || [];
    const customers = custRes.data || [];
    const categories = catRes.data || [];
    const today = format(now, "yyyy-MM-dd");

    // Split current vs previous period
    const currentInvoices = invoices.filter(i => i.invoice_date >= format(periodStart, "yyyy-MM-dd"));
    const prevInvoices = invoices.filter(i => i.invoice_date < format(periodStart, "yyyy-MM-dd"));
    const currentExpenses = expenses.filter(e => e.expense_date >= format(periodStart, "yyyy-MM-dd"));
    const prevExpenses = expenses.filter(e => e.expense_date < format(periodStart, "yyyy-MM-dd"));

    const curRevenue = currentInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.grand_total), 0);
    const prevRevenue = prevInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.grand_total), 0);
    const curExp = currentExpenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.total_amount), 0);
    const prevExp = prevExpenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.total_amount), 0);

    const outstanding = currentInvoices.filter(i => !["paid", "cancelled", "draft"].includes(i.status));
    const overdue = outstanding.filter(i => i.due_date < today);

    setTotals({
      revenue: curRevenue, prevRevenue,
      expenses: curExp, prevExpenses: prevExp,
      profit: curRevenue - curExp, prevProfit: prevRevenue - prevExp,
      cashFlow: curRevenue - curExp, prevCashFlow: prevRevenue - prevExp,
      paidCount: currentInvoices.filter(i => i.status === "paid").length,
      overdueCount: overdue.length,
      outstandingAmount: outstanding.reduce((s, i) => s + Number(i.amount_due), 0),
    });

    // Monthly breakdown
    const monthMap: Record<string, MonthlyData> = {};
    for (let i = 0; i < months; i++) {
      const d = subMonths(now, months - 1 - i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MM/yyyy");
      monthMap[key] = { month: key, label, revenue: 0, expenses: 0, profit: 0, invoiceCount: 0, expenseCount: 0 };
    }

    currentInvoices.filter(i => i.status === "paid").forEach(inv => {
      const key = inv.invoice_date.substring(0, 7);
      if (monthMap[key]) {
        monthMap[key].revenue += Number(inv.grand_total);
        monthMap[key].invoiceCount += 1;
      }
    });

    currentExpenses.filter(e => e.status === "approved").forEach(exp => {
      const key = exp.expense_date.substring(0, 7);
      if (monthMap[key]) {
        monthMap[key].expenses += Number(exp.total_amount);
        monthMap[key].expenseCount += 1;
      }
    });

    Object.values(monthMap).forEach(m => { m.profit = m.revenue - m.expenses; });
    setMonthlyData(Object.values(monthMap));

    // Invoice status distribution
    const statusLabels: Record<string, string> = { draft: "مسودة", sent: "مرسلة", paid: "مدفوعة", overdue: "متأخرة", cancelled: "ملغاة" };
    const statusMap: Record<string, number> = {};
    currentInvoices.forEach(inv => {
      const label = statusLabels[inv.status] || inv.status;
      statusMap[label] = (statusMap[label] || 0) + 1;
    });
    setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    // Expense categories
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    const expCatMap: Record<string, number> = {};
    currentExpenses.filter(e => e.status === "approved").forEach(e => {
      const name = (e.category_id && catMap.get(e.category_id)) || "غير مصنف";
      expCatMap[name] = (expCatMap[name] || 0) + Number(e.total_amount);
    });
    setCategoryData(Object.entries(expCatMap).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value })));

    // Top customers
    const custMap = new Map(customers.map(c => [c.id, c.name]));
    const custRevMap: Record<string, { revenue: number; count: number }> = {};
    currentInvoices.filter(i => i.status === "paid").forEach(i => {
      if (!custRevMap[i.customer_id]) custRevMap[i.customer_id] = { revenue: 0, count: 0 };
      custRevMap[i.customer_id].revenue += Number(i.grand_total);
      custRevMap[i.customer_id].count += 1;
    });
    setCustomerStats(
      Object.entries(custRevMap)
        .map(([id, data]) => ({ name: custMap.get(id) || "غير معروف", ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 7)
    );

    setLoading(false);
  }, [tenantId, period]);

  useEffect(() => {
    fetchData();
    if (!tenantId) return;
    const channel = supabase.channel("analytics-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, tenantId]);

  const pctChange = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  if (!perms.isFinance) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <BarChart3 size={40} />
        <p className="text-lg font-semibold">غير مصرّح</p>
        <p className="text-sm">ليس لديك صلاحية للوصول إلى التحليلات المالية</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpiCards = [
    {
      label: "إجمالي الإيرادات", value: totals.revenue, prev: totals.prevRevenue,
      icon: TrendingUp, positive: true, sub: `${totals.paidCount} فاتورة مدفوعة`,
    },
    {
      label: "إجمالي المصروفات", value: totals.expenses, prev: totals.prevExpenses,
      icon: TrendingDown, positive: false, sub: "مصروفات معتمدة",
    },
    {
      label: "صافي الربح", value: totals.profit, prev: totals.prevProfit,
      icon: totals.profit >= 0 ? ArrowUpRight : ArrowDownRight,
      positive: totals.profit >= 0, sub: totals.profit >= 0 ? "ربح" : "خسارة",
    },
    {
      label: "التدفق النقدي", value: totals.cashFlow, prev: totals.prevCashFlow,
      icon: Wallet, positive: totals.cashFlow >= 0,
      sub: totals.overdueCount > 0 ? `${totals.overdueCount} فاتورة متأخرة` : "لا متأخرات",
    },
  ];

  const revenuePct = pctChange(totals.revenue, totals.prevRevenue);
  const expensePct = pctChange(totals.expenses, totals.prevExpenses);
  const profitPct = pctChange(totals.profit, totals.prevProfit);
  const cashFlowPct = pctChange(totals.cashFlow, totals.prevCashFlow);
  const pcts = [revenuePct, expensePct, profitPct, cashFlowPct];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity size={24} className="text-accent" />
            لوحة مؤشرات الأداء (KPI)
          </h1>
          <p className="text-sm text-muted-foreground">تحليلات تفاعلية شاملة لأداء منشأتك المالي</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <Calendar size={14} className="ml-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">آخر 3 أشهر</SelectItem>
            <SelectItem value="6">آخر 6 أشهر</SelectItem>
            <SelectItem value="12">آخر 12 شهر</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => {
          const change = pcts[i];
          const isUp = change >= 0;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.positive ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>
                      <card.icon size={20} />
                    </div>
                    {card.prev > 0 && (
                      <Badge variant={isUp === card.positive ? "default" : "destructive"} className="text-[10px] gap-0.5">
                        {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(change)}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {fmt(Math.abs(card.value))}
                    <span className="mr-1 text-sm font-normal text-muted-foreground">ر.س</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" dir="rtl">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="breakdown">التفاصيل</TabsTrigger>
          <TabsTrigger value="customers">العملاء</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Revenue vs Expenses */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-accent" />
                  الإيرادات مقابل المصروفات (شهري)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات</p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${fmt(value)} ر.س`,
                          name === "revenue" ? "الإيرادات" : name === "expenses" ? "المصروفات" : "صافي الربح",
                        ]}
                        contentStyle={tooltipStyle}
                      />
                      <Legend
                        formatter={(value) =>
                          value === "revenue" ? "الإيرادات" : value === "expenses" ? "المصروفات" : "صافي الربح"
                        }
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={20} />
                      <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Cash Flow Trend */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet size={16} className="text-accent" />
                  اتجاه التدفق النقدي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(value: number) => [`${fmt(value)} ر.س`, "التدفق النقدي"]}
                      contentStyle={tooltipStyle}
                    />
                    <defs>
                      <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone" dataKey="profit" stroke="hsl(var(--accent))"
                      fill="url(#cashFlowGrad)" strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-6 mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Invoice Status Pie */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChartIcon size={16} className="text-accent" />
                    توزيع حالة الفواتير
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">لا توجد فواتير</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}>
                          {statusData.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Expense Categories Pie */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign size={16} className="text-accent" />
                    توزيع المصروفات حسب التصنيف
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">لا توجد مصروفات مصنّفة</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                          label={({ name, value }) => `${name}: ${fmt(value)}`}>
                          {categoryData.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip
                          formatter={(value: number) => [`${fmt(value)} ر.س`]}
                          contentStyle={tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Monthly Revenue Trend Line */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp size={16} className="text-accent" />
                  اتجاه الإيرادات الشهري
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(value: number) => [`${fmt(value)} ر.س`, "الإيرادات"]}
                      contentStyle={tooltipStyle}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6 mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Customers Bar */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users size={16} className="text-accent" />
                    أفضل العملاء حسب الإيرادات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={customerStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={11} />
                        <YAxis dataKey="name" type="category" fontSize={11} width={120} />
                        <Tooltip
                          formatter={(value: number) => [`${fmt(value)} ر.س`, "الإيرادات"]}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Customer Revenue Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users size={16} className="text-accent" />
                    تفاصيل العملاء
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات</p>
                  ) : (
                    <div className="space-y-3">
                      {customerStats.map((c, i) => {
                        const maxRevenue = customerStats[0]?.revenue || 1;
                        const pct = Math.round((c.revenue / maxRevenue) * 100);
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px] font-bold">
                                  {i + 1}
                                </span>
                                <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{c.name}</span>
                                <Badge variant="secondary" className="text-[10px]">{c.count} فاتورة</Badge>
                              </div>
                              <span className="text-sm font-bold text-foreground">
                                {fmt(c.revenue)} <span className="text-[10px] font-normal text-muted-foreground">ر.س</span>
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary">
                              <div className="h-1.5 rounded-full bg-accent/60 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Outstanding Amount Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المبالغ المستحقة</p>
                      <p className="text-2xl font-bold text-foreground">{fmt(totals.outstandingAmount)} <span className="text-sm font-normal text-muted-foreground">ر.س</span></p>
                    </div>
                  </div>
                  {totals.overdueCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <TrendingDown size={12} />
                      {totals.overdueCount} متأخرة
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
