import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, TrendingUp, CreditCard, FileSignature, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useLanguage } from "@/hooks/useLanguage";

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
  const { t, dir, currentLang } = useLanguage();
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
    const actionMap: Record<string, string> = {
      create: t("dashboard.actionCreate"),
      update: t("dashboard.actionUpdate"),
      delete: t("dashboard.actionDelete"),
      sign: t("dashboard.actionSign"),
      cancel: t("dashboard.actionCancel"),
      mark_paid: t("dashboard.actionMarkPaid"),
    };
    const entityMap: Record<string, string> = {
      invoice: t("dashboard.entityInvoice"),
      contract: t("dashboard.entityContract"),
      customer: t("dashboard.entityCustomer"),
      stamp: t("dashboard.entityStamp"),
    };
    return `${actionMap[action] || action} ${entityMap[entityType] || entityType}`;
  };

  const firstName = profile?.full_name?.split(" ")[0] || t("common.user");
  const sar = t("common.sar");
  const dateLocale = currentLang === "ar" ? ar : enUS;

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
      label: t("dashboard.totalInvoices"),
      value: s.totalInvoices.toString(),
      sub: t("dashboard.paidDraft", { paid: s.paidInvoices, draft: s.draftInvoices }),
      icon: CreditCard,
      color: "text-accent",
    },
    {
      label: t("dashboard.collectedRevenue"),
      value: s.totalRevenue.toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US"),
      suffix: sar,
      sub: t("dashboard.taxLabel", { amount: s.totalVat.toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US") }),
      icon: TrendingUp,
      color: "text-emerald-500",
    },
    {
      label: t("dashboard.contracts"),
      value: s.totalContracts.toString(),
      sub: t("dashboard.activeContracts", { count: s.activeContracts }),
      icon: FileSignature,
      color: "text-blue-500",
    },
    {
      label: t("dashboard.customersLabel"),
      value: s.totalCustomers.toString(),
      sub: s.overdueInvoices > 0 ? t("dashboard.overdueInvoices", { count: s.overdueInvoices }) : t("dashboard.noOverdue"),
      icon: Users,
      color: s.overdueInvoices > 0 ? "text-destructive" : "text-accent",
    },
  ];

  return (
    <div dir={dir} className="space-y-8 p-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.welcome", { name: firstName })}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.overview")}</p>
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
              {stat.suffix && <span className={`${dir === "rtl" ? "mr-1" : "ml-1"} text-sm font-normal text-muted-foreground`}>{stat.suffix}</span>}
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
          <h3 className="mb-5 text-sm font-semibold text-foreground">{t("dashboard.recentActivities")}</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("dashboard.noActivities")}</p>
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
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: dateLocale })}
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
          <h3 className="mb-5 text-sm font-semibold text-foreground">{t("dashboard.companyInfo")}</h3>
          <div className="space-y-4">
            {[
              { label: t("dashboard.companyName"), value: tenantName },
              { label: t("dashboard.customerCount"), value: s.totalCustomers.toString() },
              { label: t("dashboard.overdueInvoicesLabel"), value: s.overdueInvoices.toString(), accent: s.overdueInvoices > 0 },
              { label: t("dashboard.totalTax"), value: `${s.totalVat.toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US")} ${sar}` },
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
