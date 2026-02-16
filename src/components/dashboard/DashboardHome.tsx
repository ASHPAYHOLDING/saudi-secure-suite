import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, TrendingUp, CreditCard, FileSignature, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface DashboardStats {
  totalInvoices: number;
  draftInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalRevenue: number;
  totalVat: number;
  activeContracts: number;
  totalContracts: number;
  totalCustomers: number;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_label: string | null;
  created_at: string;
  user_id: string;
}

const DashboardHome = () => {
  const { tenantId, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<AuditEntry[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    fetchAll();

    const channel = supabase
      .channel('dashboard-home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchAll = async () => {
    const [invoicesRes, contractsRes, customersRes, auditRes, tenantRes] = await Promise.all([
      supabase.from("invoices").select("status, grand_total, vat_total, due_date").eq("tenant_id", tenantId!),
      supabase.from("contracts").select("status").eq("tenant_id", tenantId!),
      supabase.from("customers").select("id").eq("tenant_id", tenantId!),
      supabase.from("audit_logs").select("id, action, entity_type, entity_label, created_at, user_id").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(8),
      supabase.from("tenants").select("name").eq("id", tenantId!).single(),
    ]);

    const invoices = invoicesRes.data || [];
    const contracts = contractsRes.data || [];
    const today = new Date().toISOString().split("T")[0];

    setStats({
      totalInvoices: invoices.length,
      draftInvoices: invoices.filter((i) => i.status === "draft").length,
      paidInvoices: invoices.filter((i) => i.status === "paid").length,
      overdueInvoices: invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.due_date < today).length,
      totalRevenue: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.grand_total || 0), 0),
      totalVat: invoices.reduce((s, i) => s + (i.vat_total || 0), 0),
      activeContracts: contracts.filter((c) => c.status === "active" || c.status === "signed").length,
      totalContracts: contracts.length,
      totalCustomers: customersRes.data?.length || 0,
    });

    setActivities(auditRes.data || []);
    setTenantName(tenantRes.data?.name || "");
    setLoading(false);
  };

  const actionLabel = (action: string, entityType: string) => {
    const map: Record<string, string> = {
      create: "أنشأ",
      update: "حدّث",
      delete: "حذف",
      sign: "وقّع",
      cancel: "ألغى",
      mark_paid: "سدّد",
    };
    const entityMap: Record<string, string> = {
      invoice: "فاتورة",
      contract: "عقد",
      customer: "عميل",
      stamp: "ختم",
    };
    return `${map[action] || action} ${entityMap[entityType] || entityType}`;
  };

  const firstName = profile?.full_name?.split(" ")[0] || "مستخدم";

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const s = stats!;

  const statCards = [
    {
      label: "إجمالي الفواتير",
      value: s.totalInvoices.toString(),
      sub: `${s.paidInvoices} مدفوعة · ${s.draftInvoices} مسودة`,
      icon: CreditCard,
      color: "text-accent",
    },
    {
      label: "الإيرادات المحصّلة",
      value: s.totalRevenue.toLocaleString("ar-SA"),
      suffix: "ر.س",
      sub: `ضريبة: ${s.totalVat.toLocaleString("ar-SA")} ر.س`,
      icon: TrendingUp,
      color: "text-emerald-500",
    },
    {
      label: "العقود",
      value: s.totalContracts.toString(),
      sub: `${s.activeContracts} سارية`,
      icon: FileSignature,
      color: "text-blue-500",
    },
    {
      label: "العملاء",
      value: s.totalCustomers.toString(),
      sub: s.overdueInvoices > 0 ? `${s.overdueInvoices} فاتورة متأخرة` : "لا متأخرات",
      icon: Users,
      color: s.overdueInvoices > 0 ? "text-destructive" : "text-accent",
    },
  ];

  return (
    <div dir="rtl" className="space-y-8 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً، {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">إليك نظرة عامة على أداء منشأتك اليوم</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-english">
              {stat.value}
              {stat.suffix && <span className="mr-1 text-sm font-normal text-muted-foreground">{stat.suffix}</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <h3 className="mb-5 text-sm font-semibold text-foreground">آخر النشاطات</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد نشاطات بعد</p>
          ) : (
            <div className="space-y-4">
              {activities.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <FileText size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {actionLabel(item.action, item.entity_type)}
                      </p>
                      {item.entity_label && (
                        <p className="text-xs text-muted-foreground font-english">{item.entity_label}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ar })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <h3 className="mb-5 text-sm font-semibold text-foreground">معلومات المنشأة</h3>
          <div className="space-y-4">
            {[
              { label: "اسم المنشأة", value: tenantName },
              { label: "عدد العملاء", value: s.totalCustomers.toString() },
              { label: "الفواتير المتأخرة", value: s.overdueInvoices.toString(), accent: s.overdueInvoices > 0 },
              { label: "إجمالي الضريبة", value: `${s.totalVat.toLocaleString("ar-SA")} ر.س` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-sm font-medium ${item.accent ? "text-destructive" : "text-foreground"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardHome;
