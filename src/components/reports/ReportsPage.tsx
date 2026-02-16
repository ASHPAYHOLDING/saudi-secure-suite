import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Filter, Loader2, TrendingUp, TrendingDown, CreditCard, FileSignature } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VatTaxReport from "./VatTaxReport";

interface MonthlyData {
  month: string;
  revenue: number;
  vat: number;
  invoiceCount: number;
}

const ReportsPage = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalVat: 0,
    totalPaid: 0,
    totalUnpaid: 0,
    totalContracts: 0,
    activeContracts: 0,
    totalCustomers: 0,
  });

  useEffect(() => {
    if (tenantId) fetchReports();
  }, [tenantId, period]);

  const fetchReports = async () => {
    setLoading(true);
    const [invoicesRes, contractsRes, customersRes] = await Promise.all([
      supabase.from("invoices").select("*").eq("tenant_id", tenantId!),
      supabase.from("contracts").select("status, total_value, created_at").eq("tenant_id", tenantId!),
      supabase.from("customers").select("id").eq("tenant_id", tenantId!),
    ]);

    const invoices = invoicesRes.data || [];
    const contracts = contractsRes.data || [];

    // Filter by period
    const now = new Date();
    const filtered = period === "all" ? invoices : invoices.filter((inv) => {
      const d = new Date(inv.invoice_date);
      if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === "quarter") {
        const q = Math.floor(now.getMonth() / 3);
        return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
      }
      if (period === "year") return d.getFullYear() === now.getFullYear();
      return true;
    });

    setSummary({
      totalRevenue: filtered.filter((i) => i.status === "paid").reduce((s, i) => s + (i.grand_total || 0), 0),
      totalVat: filtered.reduce((s, i) => s + (i.vat_total || 0), 0),
      totalPaid: filtered.filter((i) => i.status === "paid").length,
      totalUnpaid: filtered.filter((i) => i.status !== "paid" && i.status !== "cancelled").length,
      totalContracts: contracts.length,
      activeContracts: contracts.filter((c) => c.status === "active" || c.status === "signed").length,
      totalCustomers: customersRes.data?.length || 0,
    });

    // Group by month
    const monthMap: Record<string, MonthlyData> = {};
    filtered.forEach((inv) => {
      const d = new Date(inv.invoice_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { month: key, revenue: 0, vat: 0, invoiceCount: 0 };
      monthMap[key].revenue += inv.status === "paid" ? (inv.grand_total || 0) : 0;
      monthMap[key].vat += inv.vat_total || 0;
      monthMap[key].invoiceCount += 1;
    });
    setMonthlyData(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)));
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summaryCards = [
    { label: "الإيرادات المحصّلة", value: `${summary.totalRevenue.toLocaleString("ar-SA")} ر.س`, icon: TrendingUp, color: "text-emerald-500" },
    { label: "إجمالي الضريبة", value: `${summary.totalVat.toLocaleString("ar-SA")} ر.س`, icon: CreditCard, color: "text-accent" },
    { label: "فواتير مدفوعة / غير مدفوعة", value: `${summary.totalPaid} / ${summary.totalUnpaid}`, icon: FileText, color: "text-blue-500" },
    { label: "العقود النشطة", value: `${summary.activeContracts} من ${summary.totalContracts}`, icon: FileSignature, color: "text-purple-500" },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التقارير</h1>
          <p className="text-sm text-muted-foreground">ملخص الأداء المالي والتشغيلي</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <Filter size={14} className="ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="quarter">هذا الربع</SelectItem>
              <SelectItem value="year">هذه السنة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ${card.color} mb-3`}>
              <card.icon size={20} />
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Monthly Breakdown Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">تفاصيل شهرية</h3>
        {monthlyData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات للفترة المحددة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 text-right font-medium">الشهر</th>
                  <th className="py-3 text-right font-medium">عدد الفواتير</th>
                  <th className="py-3 text-right font-medium">الإيرادات</th>
                  <th className="py-3 text-right font-medium">الضريبة</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr key={row.month} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-english">{row.month}</td>
                    <td className="py-3">{row.invoiceCount}</td>
                    <td className="py-3">{row.revenue.toLocaleString("ar-SA")} ر.س</td>
                    <td className="py-3">{row.vat.toLocaleString("ar-SA")} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* VAT Tax Report */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText size={16} />
          تقرير ضريبي شامل (جاهز لهيئة الزكاة)
        </h3>
        <VatTaxReport />
      </motion.div>
    </div>
  );
};

export default ReportsPage;
