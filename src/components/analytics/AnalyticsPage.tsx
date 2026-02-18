import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Loader2, TrendingUp, TrendingDown, Users, PieChart as PieChartIcon,
  DollarSign, ArrowUpRight, ArrowDownRight, Wallet, Activity, Calendar,
  Filter, ShoppingBag, Receipt, CreditCard, Building2, RefreshCw, X,
  ChevronDown, ExternalLink, Percent, Repeat, Clock, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, ComposedChart,
  Treemap,
} from "recharts";
import { usePermissions } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import { format, subMonths, startOfMonth, parseISO } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";
import { useCountUp } from "@/hooks/useCountUp";
import ExplainKPI from "@/components/analytics/ExplainKPI";
// Branch context used via filters

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(160, 60%, 45%)",
  "hsl(35, 90%, 55%)",
  "hsl(var(--destructive))",
  "hsl(var(--secondary-foreground))",
  "hsl(280, 55%, 55%)",
  "hsl(var(--muted-foreground))",
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

const fmt = (n: number) => n.toLocaleString("ar-SA");
const fmtCompact = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
};

/* ── Animated KPI ── */
const AnimatedKPI = ({ value, prefix = "", suffix = "", className = "" }: {
  value: number; prefix?: string; suffix?: string; className?: string;
}) => {
  const animated = useCountUp(value);
  return <span className={className}>{prefix}{fmt(animated)}{suffix}</span>;
};

/* ── Card animation wrapper ── */
const MotionCard = ({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

/* ── Types ── */
interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  expenseCount: number;
  vatCollected: number;
  vatPaid: number;
}

interface Filters {
  period: string;
  branchId: string;
  customerId: string;
}

const AnalyticsPage = () => {
  const { tenantId, user } = useAuth();
  const { isRTL, t, currentLang } = useLanguage();
  // Branch filter handled via filters state
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState<Filters>({ period: "12", branchId: "all", customerId: "all" });
  const [showFilters, setShowFilters] = useState(false);
  const [role, setRole] = useState<AppRole>("member");
  const perms = usePermissions(role);
  const dateFnsLocale = currentLang === "ar" ? ar : enUS;

  // Data state
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [customerStats, setCustomerStats] = useState<{ name: string; revenue: number; count: number }[]>([]);
  const [productStats, setProductStats] = useState<{ name: string; revenue: number; qty: number }[]>([]);
  const [branchStats, setBranchStats] = useState<{ name: string; revenue: number; expenses: number }[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [walletData, setWalletData] = useState({ balance: 0, totalTopup: 0, totalDebit: 0, txCount: 0 });
  const [subscriptionData, setSubscriptionData] = useState({
    mrr: 0, arr: 0, activeCount: 0, churnedCount: 0, churnRate: 0, avgLTV: 0,
  });
  const [totals, setTotals] = useState({
    revenue: 0, prevRevenue: 0, expenses: 0, prevExpenses: 0,
    profit: 0, prevProfit: 0, cashFlow: 0, prevCashFlow: 0,
    paidCount: 0, overdueCount: 0, outstandingAmount: 0,
    profitMargin: 0, momGrowth: 0, receivables: 0, payables: 0,
    vatCollected: 0, vatPaid: 0, vatNet: 0,
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

    const months = parseInt(filters.period);
    const now = new Date();
    const periodStart = startOfMonth(subMonths(now, months));
    const prevPeriodStart = startOfMonth(subMonths(now, months * 2));

    // Build branch filter
    const branchFilter = filters.branchId !== "all" ? filters.branchId : null;
    const customerFilter = filters.customerId !== "all" ? filters.customerId : null;

    // Parallel fetch
    let invQ = supabase.from("invoices")
      .select("id, status, grand_total, vat_total, amount_due, amount_paid, due_date, invoice_date, customer_id, branch_id")
      .eq("tenant_id", tenantId).gte("invoice_date", prevPeriodStart.toISOString());
    if (branchFilter) invQ = invQ.eq("branch_id", branchFilter);
    if (customerFilter) invQ = invQ.eq("customer_id", customerFilter);

    let expQ = supabase.from("expenses")
      .select("id, status, total_amount, vat_amount, expense_date, category_id, branch_id")
      .eq("tenant_id", tenantId).gte("expense_date", prevPeriodStart.toISOString());
    if (branchFilter) expQ = expQ.eq("branch_id", branchFilter);

    const [invRes, expRes, custRes, catRes, branchRes, prodRes, walletRes, subRes] = await Promise.all([
      invQ,
      expQ,
      supabase.from("customers").select("id, name").eq("tenant_id", tenantId),
      supabase.from("expense_categories").select("id, name").eq("tenant_id", tenantId),
      supabase.from("branches").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("invoice_items").select("description, quantity, line_total, invoice_id").limit(1000),
      supabase.from("tenant_wallets").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("tenant_id", tenantId),
    ]);

    const invoices = invRes.data || [];
    const expenses = expRes.data || [];
    const allCustomers = custRes.data || [];
    const categories = catRes.data || [];
    const allBranches = branchRes.data || [];
    const invoiceItems = prodRes.data || [];
    const wallet = walletRes.data;
    const subscriptions = subRes.data || [];
    const today = format(now, "yyyy-MM-dd");

    setBranches(allBranches);
    setCustomers(allCustomers);

    // Split current vs previous
    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const currentInvoices = invoices.filter(i => i.invoice_date >= periodStartStr);
    const prevInvoices = invoices.filter(i => i.invoice_date < periodStartStr);
    const currentExpenses = expenses.filter(e => e.expense_date >= periodStartStr);
    const prevExpenses = expenses.filter(e => e.expense_date < periodStartStr);

    const curRevenue = currentInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.grand_total), 0);
    const prevRevenue = prevInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.grand_total), 0);
    const curExp = currentExpenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.total_amount), 0);
    const prevExp = prevExpenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.total_amount), 0);
    const curProfit = curRevenue - curExp;

    const outstanding = currentInvoices.filter(i => !["paid", "cancelled", "draft"].includes(i.status));
    const overdue = outstanding.filter(i => i.due_date < today);
    const receivables = outstanding.reduce((s, i) => s + Number(i.amount_due || 0), 0);

    // VAT
    const vatCollected = currentInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.vat_total || 0), 0);
    const vatPaid = currentExpenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.vat_amount || 0), 0);

    // MoM growth (last 2 months)
    const lastMonth = format(subMonths(now, 1), "yyyy-MM");
    const twoMonthsAgo = format(subMonths(now, 2), "yyyy-MM");
    const lastMonthRev = currentInvoices.filter(i => i.status === "paid" && i.invoice_date.startsWith(lastMonth))
      .reduce((s, i) => s + Number(i.grand_total), 0);
    const twoMonthsAgoRev = currentInvoices.filter(i => i.status === "paid" && i.invoice_date.startsWith(twoMonthsAgo))
      .reduce((s, i) => s + Number(i.grand_total), 0);
    const momGrowth = twoMonthsAgoRev > 0 ? ((lastMonthRev - twoMonthsAgoRev) / twoMonthsAgoRev) * 100 : 0;

    setTotals({
      revenue: curRevenue, prevRevenue,
      expenses: curExp, prevExpenses: prevExp,
      profit: curProfit, prevProfit: prevRevenue - prevExp,
      cashFlow: curProfit, prevCashFlow: prevRevenue - prevExp,
      paidCount: currentInvoices.filter(i => i.status === "paid").length,
      overdueCount: overdue.length,
      outstandingAmount: receivables,
      profitMargin: curRevenue > 0 ? (curProfit / curRevenue) * 100 : 0,
      momGrowth,
      receivables,
      payables: curExp,
      vatCollected,
      vatPaid,
      vatNet: vatCollected - vatPaid,
    });

    // Monthly breakdown
    const monthMap: Record<string, MonthlyData> = {};
    for (let i = 0; i < months; i++) {
      const d = subMonths(now, months - 1 - i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM yyyy", { locale: dateFnsLocale });
      monthMap[key] = { month: key, label, revenue: 0, expenses: 0, profit: 0, invoiceCount: 0, expenseCount: 0, vatCollected: 0, vatPaid: 0 };
    }

    currentInvoices.filter(i => i.status === "paid").forEach(inv => {
      const key = inv.invoice_date.substring(0, 7);
      if (monthMap[key]) {
        monthMap[key].revenue += Number(inv.grand_total);
        monthMap[key].invoiceCount += 1;
        monthMap[key].vatCollected += Number(inv.vat_total || 0);
      }
    });
    currentExpenses.filter(e => e.status === "approved").forEach(exp => {
      const key = exp.expense_date.substring(0, 7);
      if (monthMap[key]) {
        monthMap[key].expenses += Number(exp.total_amount);
        monthMap[key].expenseCount += 1;
        monthMap[key].vatPaid += Number(exp.vat_amount || 0);
      }
    });
    Object.values(monthMap).forEach(m => { m.profit = m.revenue - m.expenses; });
    setMonthlyData(Object.values(monthMap));

    // Invoice status
    const statusLabels: Record<string, string> = { draft: isRTL ? "مسودة" : "Draft", sent: isRTL ? "مرسلة" : "Sent", paid: isRTL ? "مدفوعة" : "Paid", overdue: isRTL ? "متأخرة" : "Overdue", cancelled: isRTL ? "ملغاة" : "Cancelled" };
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
      const name = (e.category_id && catMap.get(e.category_id)) || (isRTL ? "غير مصنف" : "Uncategorized");
      expCatMap[name] = (expCatMap[name] || 0) + Number(e.total_amount);
    });
    setCategoryData(Object.entries(expCatMap).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value })));

    // Top customers
    const custMap = new Map(allCustomers.map(c => [c.id, c.name]));
    const custRevMap: Record<string, { revenue: number; count: number }> = {};
    currentInvoices.filter(i => i.status === "paid").forEach(i => {
      if (!custRevMap[i.customer_id]) custRevMap[i.customer_id] = { revenue: 0, count: 0 };
      custRevMap[i.customer_id].revenue += Number(i.grand_total);
      custRevMap[i.customer_id].count += 1;
    });
    setCustomerStats(
      Object.entries(custRevMap)
        .map(([id, data]) => ({ name: custMap.get(id) || (isRTL ? "غير معروف" : "Unknown"), ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    );

    // Top products
    const paidInvoiceIds = new Set(currentInvoices.filter(i => i.status === "paid").map(i => i.id));
    const prodMap: Record<string, { revenue: number; qty: number }> = {};
    invoiceItems.filter(item => paidInvoiceIds.has(item.invoice_id)).forEach(item => {
      const name = item.description || (isRTL ? "بدون وصف" : "No description");
      if (!prodMap[name]) prodMap[name] = { revenue: 0, qty: 0 };
      prodMap[name].revenue += Number(item.line_total || 0);
      prodMap[name].qty += Number(item.quantity || 0);
    });
    setProductStats(
      Object.entries(prodMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    );

    // Branch stats
    const branchMap = new Map(allBranches.map(b => [b.id, b.name]));
    const branchRevMap: Record<string, { revenue: number; expenses: number }> = {};
    currentInvoices.filter(i => i.status === "paid").forEach(i => {
      const bid = i.branch_id || "none";
      if (!branchRevMap[bid]) branchRevMap[bid] = { revenue: 0, expenses: 0 };
      branchRevMap[bid].revenue += Number(i.grand_total);
    });
    currentExpenses.filter(e => e.status === "approved").forEach(e => {
      const bid = e.branch_id || "none";
      if (!branchRevMap[bid]) branchRevMap[bid] = { revenue: 0, expenses: 0 };
      branchRevMap[bid].expenses += Number(e.total_amount);
    });
    setBranchStats(
      Object.entries(branchRevMap)
        .map(([id, data]) => ({ name: branchMap.get(id) || (isRTL ? "بدون فرع" : "No branch"), ...data }))
        .sort((a, b) => b.revenue - a.revenue)
    );

    // Wallet
    if (wallet) {
      const { data: walletTxs } = await supabase.from("wallet_transactions")
        .select("type, amount, wallet_id")
        .eq("wallet_id", wallet.id);
      const txs = (walletTxs || []) as any[];
      const totalTopup = txs.filter((t: any) => t.type === "credit").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalDebit = txs.filter((t: any) => t.type === "debit").reduce((s: number, t: any) => s + Number(t.amount), 0);
      setWalletData({
        balance: Number(wallet.balance_available || 0),
        totalTopup,
        totalDebit,
        txCount: txs.length,
      });
    }

    // Subscription analytics
    const allSubs = (subscriptions || []) as any[];
    const activeSubs = allSubs.filter((s: any) => s.status === "active");
    const churnedSubs = allSubs.filter((s: any) => s.status === "cancelled" || s.status === "expired");
    const totalMRR = activeSubs.reduce((s: number, sub: any) => {
      const amount = Number(sub.amount || sub.price || 0);
      return s + (sub.billing_cycle === "yearly" ? amount / 12 : amount);
    }, 0);
    const totalSubs = activeSubs.length + churnedSubs.length;
    setSubscriptionData({
      mrr: totalMRR,
      arr: totalMRR * 12,
      activeCount: activeSubs.length,
      churnedCount: churnedSubs.length,
      churnRate: totalSubs > 0 ? (churnedSubs.length / totalSubs) * 100 : 0,
      avgLTV: totalMRR > 0 ? (totalMRR / Math.max(1, churnedSubs.length / Math.max(1, totalSubs))) : 0,
    });

    setLoading(false);
  }, [tenantId, filters, isRTL, dateFnsLocale]);

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
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <BarChart3 size={40} />
        <p className="text-lg font-semibold">{isRTL ? "غير مصرّح" : "Unauthorized"}</p>
        <p className="text-sm">{isRTL ? "ليس لديك صلاحية للوصول إلى التحليلات المالية" : "You don't have access to financial analytics"}</p>
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

  const revPct = pctChange(totals.revenue, totals.prevRevenue);
  const expPct = pctChange(totals.expenses, totals.prevExpenses);
  const profitPct = pctChange(totals.profit, totals.prevProfit);

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* ── Header + Filters ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity size={22} className="text-accent" />
              {isRTL ? "التحليلات المؤسسية" : "Enterprise Analytics"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isRTL ? "رؤية شاملة لأداء منشأتك المالي والتشغيلي" : "Complete view of financial and operational performance"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
              <Filter size={14} />
              {isRTL ? "فلتر" : "Filter"}
              {(filters.branchId !== "all" || filters.customerId !== "all") && (
                <Badge variant="default" className="h-4 w-4 p-0 text-[10px] flex items-center justify-center rounded-full">!</Badge>
              )}
            </Button>
            <Select value={filters.period} onValueChange={(v) => setFilters(f => ({ ...f, period: v }))}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <Calendar size={12} className="me-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">{isRTL ? "3 أشهر" : "3 months"}</SelectItem>
                <SelectItem value="6">{isRTL ? "6 أشهر" : "6 months"}</SelectItem>
                <SelectItem value="12">{isRTL ? "12 شهر" : "12 months"}</SelectItem>
                <SelectItem value="24">{isRTL ? "24 شهر" : "24 months"}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fetchData()}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {/* Collapsible filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
                <Select value={filters.branchId} onValueChange={(v) => setFilters(f => ({ ...f, branchId: v }))}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <Building2 size={12} className="me-1.5" />
                    <SelectValue placeholder={isRTL ? "كل الفروع" : "All branches"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "كل الفروع" : "All branches"}</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.customerId} onValueChange={(v) => setFilters(f => ({ ...f, customerId: v }))}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <Users size={12} className="me-1.5" />
                    <SelectValue placeholder={isRTL ? "كل العملاء" : "All customers"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "كل العملاء" : "All customers"}</SelectItem>
                    {customers.slice(0, 50).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(filters.branchId !== "all" || filters.customerId !== "all") && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setFilters(f => ({ ...f, branchId: "all", customerId: "all" }))}>
                    <X size={12} />{isRTL ? "مسح" : "Clear"}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-max h-9">
            <TabsTrigger value="overview" className="text-xs gap-1.5 px-3">
              <Activity size={13} />{isRTL ? "نظرة عامة" : "Overview"}
            </TabsTrigger>
            <TabsTrigger value="sales" className="text-xs gap-1.5 px-3">
              <ShoppingBag size={13} />{isRTL ? "المبيعات" : "Sales"}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs gap-1.5 px-3">
              <Receipt size={13} />{isRTL ? "المصروفات" : "Expenses"}
            </TabsTrigger>
            <TabsTrigger value="vat" className="text-xs gap-1.5 px-3">
              <Percent size={13} />{isRTL ? "الضريبة" : "VAT"}
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="text-xs gap-1.5 px-3">
              <Repeat size={13} />{isRTL ? "الاشتراكات" : "Subscriptions"}
            </TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs gap-1.5 px-3">
              <Wallet size={13} />{isRTL ? "المحفظة" : "Wallet"}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════ TAB 1: OVERVIEW ═══════ */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          {/* KPI Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: isRTL ? "إجمالي الإيرادات" : "Total Revenue", value: totals.revenue, prev: totals.prevRevenue, icon: TrendingUp, positive: true, sub: `${totals.paidCount} ${isRTL ? "فاتورة" : "invoices"}`, color: "text-accent", metricKey: "revenue", drilldown: [{ label: isRTL ? "الفواتير" : "Invoices", path: "/dashboard/invoices" }] },
              { label: isRTL ? "صافي الربح" : "Net Profit", value: totals.profit, prev: totals.prevProfit, icon: totals.profit >= 0 ? ArrowUpRight : ArrowDownRight, positive: totals.profit >= 0, sub: `${totals.profitMargin.toFixed(1)}% ${isRTL ? "هامش" : "margin"}`, color: totals.profit >= 0 ? "text-accent" : "text-destructive", metricKey: "net_profit", drilldown: [{ label: isRTL ? "التقارير" : "Reports", path: "/dashboard/reports" }] },
              { label: isRTL ? "الذمم المدينة" : "Receivables", value: totals.receivables, prev: 0, icon: Clock, positive: false, sub: `${totals.overdueCount} ${isRTL ? "متأخرة" : "overdue"}`, color: "text-amber-500", metricKey: "ar_aging", drilldown: [{ label: isRTL ? "الفواتير" : "Invoices", path: "/dashboard/invoices" }] },
              { label: isRTL ? "النمو الشهري" : "MoM Growth", value: totals.momGrowth, prev: 0, icon: TrendingUp, positive: totals.momGrowth >= 0, sub: isRTL ? "مقارنة بالشهر السابق" : "vs last month", color: totals.momGrowth >= 0 ? "text-accent" : "text-destructive", isPercent: true, metricKey: "revenue", drilldown: [] },
            ].map((card, i) => {
              const change = card.prev > 0 ? pctChange(card.value, card.prev) : null;
              const periodLbl = `${isRTL ? "آخر" : "Last"} ${filters.period} ${isRTL ? "أشهر" : "months"}`;
              return (
                <MotionCard key={card.label} delay={i * 0.06}>
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.positive ? "bg-accent/10" : "bg-destructive/10"} ${card.color}`}>
                          <card.icon size={18} />
                        </div>
                        <div className="flex items-center gap-1">
                          <ExplainKPI metricKey={card.metricKey} periodLabel={periodLbl} drilldownRoutes={card.drilldown} />
                          {change !== null && (
                            <Badge variant={change >= 0 ? "default" : "destructive"} className="text-[10px] gap-0.5 h-5">
                              {change >= 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                              {Math.abs(change)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-foreground">
                        {(card as any).isPercent ? (
                          <>{totals.momGrowth >= 0 ? "+" : ""}{totals.momGrowth.toFixed(1)}%</>
                        ) : (
                          <><AnimatedKPI value={Math.abs(card.value)} /><span className="text-xs font-normal text-muted-foreground ms-1">{isRTL ? "ر.س" : "SAR"}</span></>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">{card.label}</p>
                      <p className="text-[10px] text-muted-foreground/70">{card.sub}</p>
                    </CardContent>
                  </Card>
                </MotionCard>
              );
            })}
          </div>

          {/* Additional KPIs row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: isRTL ? "التدفق النقدي" : "Cash Flow", value: totals.cashFlow, icon: Wallet, color: totals.cashFlow >= 0 ? "text-emerald-500" : "text-destructive", metricKey: "cashflow", drilldown: [{ label: isRTL ? "التقارير" : "Reports", path: "/dashboard/reports" }] },
              { label: isRTL ? "هامش الربح" : "Profit Margin", value: totals.profitMargin, icon: Percent, color: "text-primary", isPercent: true, metricKey: "net_profit", drilldown: [] },
              { label: isRTL ? "إجمالي المصروفات" : "Total Expenses", value: totals.expenses, icon: TrendingDown, color: "text-destructive", metricKey: "expenses", drilldown: [{ label: isRTL ? "المصروفات" : "Expenses", path: "/dashboard/expenses" }] },
              { label: isRTL ? "الذمم الدائنة" : "Payables", value: totals.payables, icon: DollarSign, color: "text-muted-foreground", metricKey: "ap_aging", drilldown: [{ label: isRTL ? "أوامر الشراء" : "POs", path: "/dashboard/purchase-orders" }] },
            ].map((card, i) => {
              const periodLbl = `${isRTL ? "آخر" : "Last"} ${filters.period} ${isRTL ? "أشهر" : "months"}`;
              return (
              <MotionCard key={card.label} delay={0.3 + i * 0.06}>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center ${card.color}`}>
                      <card.icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-lg font-bold text-foreground truncate">
                          {(card as any).isPercent ? `${card.value.toFixed(1)}%` : <>{fmt(Math.abs(card.value))} <span className="text-[10px] font-normal text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</span></>}
                        </p>
                        <ExplainKPI metricKey={card.metricKey} periodLabel={periodLbl} drilldownRoutes={card.drilldown} />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{card.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </MotionCard>
            );})}
          </div>

          {/* Revenue vs Expenses Chart */}
          <MotionCard delay={0.5}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={16} className="text-accent" />
                  {isRTL ? "الإيرادات مقابل المصروفات" : "Revenue vs Expenses"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number, name: string) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`, name === "revenue" ? (isRTL ? "الإيرادات" : "Revenue") : name === "expenses" ? (isRTL ? "المصروفات" : "Expenses") : (isRTL ? "الربح" : "Profit")]} contentStyle={tooltipStyle} />
                    <Legend formatter={(v) => v === "revenue" ? (isRTL ? "الإيرادات" : "Revenue") : v === "expenses" ? (isRTL ? "المصروفات" : "Expenses") : (isRTL ? "الربح" : "Profit")} />
                    <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={16} />
                    <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </MotionCard>

          {/* Cash Flow Trend */}
          <MotionCard delay={0.6}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet size={16} className="text-accent" />
                  {isRTL ? "اتجاه التدفق النقدي" : "Cash Flow Trend"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`, isRTL ? "التدفق" : "Cash Flow"]} contentStyle={tooltipStyle} />
                    <defs>
                      <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="profit" stroke="hsl(var(--accent))" fill="url(#cashGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </MotionCard>
        </TabsContent>

        {/* ═══════ TAB 2: SALES ═══════ */}
        <TabsContent value="sales" className="space-y-5 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top Customers */}
            <MotionCard>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users size={16} className="text-accent" />
                    {isRTL ? "أفضل العملاء" : "Top Customers"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                  ) : (
                    <div className="space-y-3">
                      {customerStats.map((c, i) => {
                        const maxRev = customerStats[0]?.revenue || 1;
                        const pct = Math.round((c.revenue / maxRev) * 100);
                        return (
                          <motion.div key={i} initial={{ opacity: 0, x: isRTL ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px] font-bold">{i + 1}</span>
                                <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                                <Badge variant="secondary" className="text-[10px] shrink-0">{c.count}</Badge>
                              </div>
                              <span className="text-sm font-bold text-foreground shrink-0">{fmt(c.revenue)} <span className="text-[10px] font-normal text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</span></span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }} className="h-1.5 rounded-full bg-accent/60" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </MotionCard>

            {/* Top Products */}
            <MotionCard delay={0.1}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingBag size={16} className="text-accent" />
                    {isRTL ? "أفضل المنتجات/الخدمات" : "Top Products/Services"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {productStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={productStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" fontSize={10} tickFormatter={fmtCompact} />
                        <YAxis dataKey="name" type="category" fontSize={10} width={100} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`, isRTL ? "الإيرادات" : "Revenue"]} contentStyle={tooltipStyle} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </MotionCard>
          </div>

          {/* Period Analysis */}
          <MotionCard delay={0.2}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar size={16} className="text-accent" />
                  {isRTL ? "تحليل الفترات" : "Period Analysis"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number, name: string) => [`${fmt(v)}`, name === "invoiceCount" ? (isRTL ? "عدد الفواتير" : "Invoices") : (isRTL ? "الإيرادات" : "Revenue")]} contentStyle={tooltipStyle} />
                    <Legend formatter={(v) => v === "revenue" ? (isRTL ? "الإيرادات" : "Revenue") : (isRTL ? "عدد الفواتير" : "Invoice Count")} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="invoiceCount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </MotionCard>

          {/* Branch Analysis */}
          {branchStats.length > 1 && (
            <MotionCard delay={0.3}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 size={16} className="text-accent" />
                    {isRTL ? "تحليل الفروع" : "Branch Analysis"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={branchStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} tickFormatter={fmtCompact} />
                      <Tooltip formatter={(v: number, name: string) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`, name === "revenue" ? (isRTL ? "إيرادات" : "Revenue") : (isRTL ? "مصروفات" : "Expenses")]} contentStyle={tooltipStyle} />
                      <Legend formatter={(v) => v === "revenue" ? (isRTL ? "إيرادات" : "Revenue") : (isRTL ? "مصروفات" : "Expenses")} />
                      <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </MotionCard>
          )}

          {/* Invoice Status */}
          <MotionCard delay={0.4}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon size={16} className="text-accent" />
                  {isRTL ? "توزيع حالة الفواتير" : "Invoice Status Distribution"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا توجد فواتير" : "No invoices"}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </MotionCard>
        </TabsContent>

        {/* ═══════ TAB 3: EXPENSES ═══════ */}
        <TabsContent value="expenses" className="space-y-5 mt-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <MotionCard>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive"><TrendingDown size={20} /></div>
                  <div>
                    <p className="text-xl font-bold">{fmt(totals.expenses)} <span className="text-xs font-normal text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</span></p>
                    <p className="text-[10px] text-muted-foreground">{isRTL ? "إجمالي المصروفات" : "Total Expenses"}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.06}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500"><Receipt size={20} /></div>
                  <div>
                    <p className="text-xl font-bold">{categoryData.length}</p>
                    <p className="text-[10px] text-muted-foreground">{isRTL ? "تصنيفات المصروفات" : "Expense Categories"}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.12}>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Percent size={20} /></div>
                  <div>
                    <p className="text-xl font-bold">{totals.revenue > 0 ? ((totals.expenses / totals.revenue) * 100).toFixed(1) : 0}%</p>
                    <p className="text-[10px] text-muted-foreground">{isRTL ? "نسبة المصروفات/الإيرادات" : "Expense/Revenue Ratio"}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Category Pie */}
            <MotionCard delay={0.2}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChartIcon size={16} className="text-accent" />
                    {isRTL ? "المصروفات حسب التصنيف" : "Expenses by Category"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${fmtCompact(value)}`}>
                          {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v: number) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`]} contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </MotionCard>

            {/* Category Table */}
            <MotionCard delay={0.3}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign size={16} className="text-accent" />
                    {isRTL ? "تفاصيل التصنيفات" : "Category Breakdown"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {categoryData.map((cat, i) => {
                        const totalExp = categoryData.reduce((s, c) => s + c.value, 0);
                        const pct = totalExp > 0 ? (cat.value / totalExp) * 100 : 0;
                        return (
                          <motion.div key={cat.name} initial={{ opacity: 0, x: isRTL ? 16 : -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                <span className="truncate">{cat.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground text-xs">{pct.toFixed(1)}%</span>
                                <span className="font-bold">{fmt(cat.value)}</span>
                              </div>
                            </div>
                            <div className="h-1 rounded-full bg-secondary">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.2 + i * 0.04, duration: 0.4 }} className="h-1 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </MotionCard>
          </div>

          {/* Monthly Expense Trend */}
          <MotionCard delay={0.4}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown size={16} className="text-destructive" />
                  {isRTL ? "اتجاه المصروفات الشهري" : "Monthly Expense Trend"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`, isRTL ? "المصروفات" : "Expenses"]} contentStyle={tooltipStyle} />
                    <defs>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="url(#expGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </MotionCard>
        </TabsContent>

        {/* ═══════ TAB 4: VAT ═══════ */}
        <TabsContent value="vat" className="space-y-5 mt-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <MotionCard>
              <Card className="border-emerald-500/30">
                <CardContent className="p-5 text-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-3"><ArrowUpRight size={24} /></div>
                   <p className="text-2xl font-bold">{fmt(totals.vatCollected)}</p>
                   <p className="text-xs text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</p>
                   <div className="flex items-center justify-center gap-1 mt-1">
                     <p className="text-sm text-muted-foreground">{isRTL ? "ضريبة محصّلة (مخرجات)" : "VAT Collected (Output)"}</p>
                     <ExplainKPI metricKey="vat_payable" periodLabel={`${isRTL ? "آخر" : "Last"} ${filters.period} ${isRTL ? "أشهر" : "months"}`} drilldownRoutes={[{ label: isRTL ? "التقارير" : "Reports", path: "/dashboard/reports" }]} />
                   </div>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.08}>
              <Card className="border-amber-500/30">
                <CardContent className="p-5 text-center">
                  <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto mb-3"><ArrowDownRight size={24} /></div>
                  <p className="text-2xl font-bold">{fmt(totals.vatPaid)}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{isRTL ? "ضريبة مدفوعة (مدخلات)" : "VAT Paid (Input)"}</p>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.16}>
              <Card className={totals.vatNet >= 0 ? "border-destructive/30" : "border-emerald-500/30"}>
                <CardContent className="p-5 text-center">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3 ${totals.vatNet >= 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"}`}>
                    <DollarSign size={24} />
                  </div>
                  <p className="text-2xl font-bold">{fmt(Math.abs(totals.vatNet))}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totals.vatNet >= 0
                      ? (isRTL ? "مستحق للهيئة" : "Payable to Authority")
                      : (isRTL ? "مسترد من الهيئة" : "Refundable")}
                  </p>
                </CardContent>
              </Card>
            </MotionCard>
          </div>

          {/* VAT Trend */}
          <MotionCard delay={0.25}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Percent size={16} className="text-accent" />
                  {isRTL ? "اتجاه الضريبة الشهري" : "Monthly VAT Trend"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={fmtCompact} />
                    <Tooltip formatter={(v: number, name: string) => [`${fmt(v)} ${isRTL ? "ر.س" : "SAR"}`, name === "vatCollected" ? (isRTL ? "محصّلة" : "Collected") : (isRTL ? "مدفوعة" : "Paid")]} contentStyle={tooltipStyle} />
                    <Legend formatter={(v) => v === "vatCollected" ? (isRTL ? "ضريبة محصّلة" : "VAT Collected") : (isRTL ? "ضريبة مدفوعة" : "VAT Paid")} />
                    <Bar dataKey="vatCollected" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="vatPaid" fill="hsl(35, 90%, 55%)" radius={[4, 4, 0, 0]} barSize={16} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </MotionCard>
        </TabsContent>

        {/* ═══════ TAB 5: SUBSCRIPTIONS ═══════ */}
        <TabsContent value="subscriptions" className="space-y-5 mt-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              { label: "MRR", value: subscriptionData.mrr, icon: Repeat, color: "text-accent", isCurrency: true, metricKey: "subscription_revenue" },
              { label: "ARR", value: subscriptionData.arr, icon: TrendingUp, color: "text-primary", isCurrency: true, metricKey: "subscription_revenue" },
              { label: isRTL ? "معدل الإلغاء" : "Churn Rate", value: subscriptionData.churnRate, icon: TrendingDown, color: "text-destructive", isPercent: true, metricKey: "subscription_revenue" },
              { label: isRTL ? "القيمة العمرية" : "Avg LTV", value: subscriptionData.avgLTV, icon: DollarSign, color: "text-emerald-500", isCurrency: true, metricKey: "subscription_revenue" },
            ].map((card, i) => (
              <MotionCard key={card.label} delay={i * 0.08}>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-2 ${card.color}`}>
                      <card.icon size={18} />
                    </div>
                    <p className="text-xl font-bold">
                      {card.isPercent ? `${card.value.toFixed(1)}%` : <>{fmt(Math.round(card.value))} <span className="text-[10px] font-normal text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</span></>}
                    </p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <p className="text-[11px] text-muted-foreground">{card.label}</p>
                      <ExplainKPI metricKey={card.metricKey} drilldownRoutes={[{ label: isRTL ? "الاشتراكات" : "Subscriptions", path: "/dashboard/subscription" }]} />
                    </div>
                  </CardContent>
                </Card>
              </MotionCard>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MotionCard delay={0.3}>
              <Card>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent"><Users size={24} /></div>
                  <div>
                    <p className="text-2xl font-bold">{subscriptionData.activeCount}</p>
                    <p className="text-sm text-muted-foreground">{isRTL ? "اشتراكات نشطة" : "Active Subscriptions"}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.35}>
              <Card>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive"><TrendingDown size={24} /></div>
                  <div>
                    <p className="text-2xl font-bold">{subscriptionData.churnedCount}</p>
                    <p className="text-sm text-muted-foreground">{isRTL ? "اشتراكات ملغاة/منتهية" : "Churned Subscriptions"}</p>
                  </div>
                </CardContent>
              </Card>
            </MotionCard>
          </div>
        </TabsContent>

        {/* ═══════ TAB 6: WALLET ═══════ */}
        <TabsContent value="wallet" className="space-y-5 mt-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <MotionCard>
              <Card className="border-accent/30">
                <CardContent className="p-5 text-center">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent mx-auto mb-3"><Wallet size={24} /></div>
                  <p className="text-2xl font-bold"><AnimatedKPI value={walletData.balance} /></p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</p>
                  <div className="flex items-center justify-center gap-1 mt-1"><p className="text-sm text-muted-foreground">{isRTL ? "صافي الرصيد" : "Net Balance"}</p><ExplainKPI metricKey="wallet_activity" drilldownRoutes={[{ label: isRTL ? "المحفظة" : "Wallet", path: "/dashboard/wallet" }]} /></div>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.08}>
              <Card className="border-emerald-500/30">
                <CardContent className="p-5 text-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-3"><ArrowUpRight size={24} /></div>
                  <p className="text-2xl font-bold">{fmt(walletData.totalTopup)}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{isRTL ? "إجمالي الشحن" : "Total Credits"}</p>
                </CardContent>
              </Card>
            </MotionCard>
            <MotionCard delay={0.16}>
              <Card className="border-destructive/30">
                <CardContent className="p-5 text-center">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-3"><ArrowDownRight size={24} /></div>
                  <p className="text-2xl font-bold">{fmt(walletData.totalDebit)}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "ر.س" : "SAR"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{isRTL ? "إجمالي الخصم" : "Total Debits"}</p>
                </CardContent>
              </Card>
            </MotionCard>
          </div>

          <MotionCard delay={0.25}>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"><Activity size={18} /></div>
                <div>
                  <p className="text-xl font-bold">{walletData.txCount}</p>
                  <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي المعاملات" : "Total Transactions"}</p>
                </div>
              </CardContent>
            </Card>
          </MotionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
