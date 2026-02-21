import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Users, Loader2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import type { AppRole } from "@/lib/access/types";

interface FinanceStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingCount: number;
  outstandingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  paidCount: number;
  totalInvoices: number;
}

interface TopCustomer {
  id: string;
  name: string;
  revenue: number;
  invoiceCount: number;
}

const FinancialOverview = () => {
  const { tenantId, user } = useAuth();
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const perms = useGranularPermissions();

  const fetchData = useCallback(async () => {
    if (!tenantId) return;

    const [invRes, expRes, custRes] = await Promise.all([
      supabase.from("invoices")
        .select("id, status, grand_total, amount_due, due_date, customer_id")
        .eq("tenant_id", tenantId),
      supabase.from("expenses")
        .select("id, status, total_amount")
        .eq("tenant_id", tenantId),
      supabase.from("customers")
        .select("id, name")
        .eq("tenant_id", tenantId),
    ]);

    const invoices = invRes.data || [];
    const expenses = expRes.data || [];
    const customers = custRes.data || [];
    const today = new Date().toISOString().split("T")[0];

    const totalRevenue = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + Number(i.grand_total), 0);

    const totalExpenses = expenses
      .filter((e) => e.status === "approved")
      .reduce((s, e) => s + Number(e.total_amount), 0);

    const outstanding = invoices.filter(
      (i) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft"
    );
    const overdue = outstanding.filter((i) => i.due_date < today);

    setStats({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      outstandingCount: outstanding.length,
      outstandingAmount: outstanding.reduce((s, i) => s + Number(i.amount_due), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + Number(i.amount_due), 0),
      paidCount: invoices.filter((i) => i.status === "paid").length,
      totalInvoices: invoices.length,
    });

    // Top customers by revenue
    const revenueMap: Record<string, { revenue: number; count: number }> = {};
    invoices
      .filter((i) => i.status === "paid" && i.customer_id)
      .forEach((i) => {
        if (!revenueMap[i.customer_id]) revenueMap[i.customer_id] = { revenue: 0, count: 0 };
        revenueMap[i.customer_id].revenue += Number(i.grand_total);
        revenueMap[i.customer_id].count += 1;
      });

    const customerMap = new Map(customers.map((c) => [c.id, c.name]));
    const top = Object.entries(revenueMap)
      .map(([id, data]) => ({
        id,
        name: customerMap.get(id) || "غير معروف",
        revenue: data.revenue,
        invoiceCount: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    setTopCustomers(top);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchData();

    if (!tenantId) return;
    const channel = supabase
      .channel("finance-overview-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, tenantId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!perms.canAny("analytics.view", "invoices.create", "expenses.create")) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <AlertTriangle size={40} />
        <p className="text-lg font-semibold">غير مصرّح</p>
        <p className="text-sm">ليس لديك صلاحية للوصول إلى التقارير المالية</p>
      </div>
    );
  }

  const s = stats!;
  const profitPositive = s.netProfit >= 0;
  const fmt = (n: number) => n.toLocaleString("ar-SA");

  const kpiCards = [
    {
      label: "إجمالي الإيرادات",
      value: fmt(s.totalRevenue),
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      sub: `${s.paidCount} فاتورة مدفوعة`,
    },
    {
      label: "إجمالي المصروفات",
      value: fmt(s.totalExpenses),
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
      sub: "مصروفات معتمدة",
    },
    {
      label: "صافي الربح",
      value: fmt(Math.abs(s.netProfit)),
      icon: profitPositive ? ArrowUpRight : ArrowDownRight,
      color: profitPositive ? "text-emerald-500" : "text-destructive",
      bg: profitPositive ? "bg-emerald-500/10" : "bg-destructive/10",
      sub: profitPositive ? "ربح" : "خسارة",
    },
    {
      label: "فواتير مستحقة",
      value: s.outstandingCount.toString(),
      icon: AlertTriangle,
      color: s.overdueCount > 0 ? "text-destructive" : "text-warning",
      bg: s.overdueCount > 0 ? "bg-destructive/10" : "bg-warning/10",
      sub: `${fmt(s.outstandingAmount)} ر.س · ${s.overdueCount} متأخرة`,
    },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign size={24} className="text-accent" />
          النظرة المالية
        </h1>
        <p className="text-sm text-muted-foreground">ملخص الأداء المالي للمنشأة في الوقت الفعلي</p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.color}`}>
                    <card.icon size={20} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground font-english">
                  {card.value}
                  <span className="mr-1 text-sm font-normal text-muted-foreground">ر.س</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{card.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Outstanding Invoices Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle size={14} className="text-warning" />
                تفاصيل الفواتير المستحقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.outstandingCount === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">لا توجد فواتير مستحقة 🎉</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-warning/5 border border-warning/20 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">مستحقة (غير متأخرة)</p>
                      <p className="text-xs text-muted-foreground">{s.outstandingCount - s.overdueCount} فاتورة</p>
                    </div>
                    <p className="font-bold text-foreground font-english">
                      {fmt(s.outstandingAmount - s.overdueAmount)} <span className="text-xs font-normal text-muted-foreground">ر.س</span>
                    </p>
                  </div>
                  {s.overdueCount > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/20 p-4">
                      <div>
                        <p className="text-sm font-medium text-destructive">متأخرة السداد</p>
                        <p className="text-xs text-muted-foreground">{s.overdueCount} فاتورة</p>
                      </div>
                      <p className="font-bold text-destructive font-english">
                        {fmt(s.overdueAmount)} <span className="text-xs font-normal">ر.س</span>
                      </p>
                    </div>
                  )}
                  {/* Collection rate */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>نسبة التحصيل</span>
                      <span className="font-english font-semibold text-foreground">
                        {s.totalInvoices > 0
                          ? Math.round((s.paidCount / s.totalInvoices) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-accent transition-all"
                        style={{ width: `${s.totalInvoices > 0 ? (s.paidCount / s.totalInvoices) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Customers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={14} className="text-accent" />
                أعلى العملاء إيراداً
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">لا توجد بيانات بعد</p>
              ) : (
                <div className="space-y-3">
                  {topCustomers.map((c, i) => {
                    const pct = topCustomers[0].revenue > 0
                      ? Math.round((c.revenue / topCustomers[0].revenue) * 100)
                      : 0;
                    return (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{c.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{c.invoiceCount} فاتورة</Badge>
                          </div>
                          <span className="text-sm font-bold text-foreground font-english">
                            {fmt(c.revenue)} <span className="text-[10px] font-normal text-muted-foreground">ر.س</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary">
                          <div
                            className="h-1.5 rounded-full bg-accent/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
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
    </div>
  );
};

export default FinancialOverview;
