import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2, TrendingUp, Users, PieChart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";

const COLORS = ["#0f4c81", "#1a9b8a", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const AnalyticsPage = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [customerStats, setCustomerStats] = useState<{ name: string; invoices: number; revenue: number }[]>([]);

  useEffect(() => {
    if (tenantId) fetchAnalytics();
  }, [tenantId]);

  const fetchAnalytics = async () => {
    const [invoicesRes, customersRes] = await Promise.all([
      supabase.from("invoices").select("*, customers(name)").eq("tenant_id", tenantId!),
      supabase.from("customers").select("id, name").eq("tenant_id", tenantId!),
    ]);

    const invoices = invoicesRes.data || [];
    const customers = customersRes.data || [];

    // Revenue by month
    const monthMap: Record<string, number> = {};
    invoices.filter((i) => i.status === "paid").forEach((inv) => {
      const d = new Date(inv.invoice_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] || 0) + (inv.grand_total || 0);
    });
    setRevenueData(
      Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue }))
    );

    // Invoice status distribution
    const statusMap: Record<string, number> = {};
    const statusLabels: Record<string, string> = {
      draft: "مسودة",
      sent: "مرسلة",
      paid: "مدفوعة",
      overdue: "متأخرة",
      cancelled: "ملغاة",
    };
    invoices.forEach((inv) => {
      const label = statusLabels[inv.status] || inv.status;
      statusMap[label] = (statusMap[label] || 0) + 1;
    });
    setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    // Top customers by revenue
    const custMap: Record<string, { name: string; invoices: number; revenue: number }> = {};
    invoices.forEach((inv) => {
      const cName = (inv.customers as any)?.name || "غير محدد";
      if (!custMap[inv.customer_id]) custMap[inv.customer_id] = { name: cName, invoices: 0, revenue: 0 };
      custMap[inv.customer_id].invoices += 1;
      if (inv.status === "paid") custMap[inv.customer_id].revenue += inv.grand_total || 0;
    });
    setCustomerStats(
      Object.values(custMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">التحليلات</h1>
        <p className="text-sm text-muted-foreground">رسوم بيانية وتحليلات تفصيلية لأداء منشأتك</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-foreground">الإيرادات الشهرية</h3>
          </div>
          {revenueData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">لا توجد بيانات إيرادات بعد</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString("ar-SA")} ر.س`, "الإيرادات"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Invoice Status Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={18} className="text-accent" />
            <h3 className="text-sm font-semibold text-foreground">توزيع حالة الفواتير</h3>
          </div>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">لا توجد فواتير بعد</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPie>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Top Customers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-foreground">أفضل العملاء حسب الإيرادات</h3>
        </div>
        {customerStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات عملاء بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 text-right font-medium">العميل</th>
                  <th className="py-3 text-right font-medium">عدد الفواتير</th>
                  <th className="py-3 text-right font-medium">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {customerStats.map((cust, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-3 font-medium text-foreground">{cust.name}</td>
                    <td className="py-3">{cust.invoices}</td>
                    <td className="py-3">{cust.revenue.toLocaleString("ar-SA")} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AnalyticsPage;
