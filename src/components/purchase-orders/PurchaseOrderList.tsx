import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Loader2, Eye, Pencil, Truck, DollarSign, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

interface PurchaseOrderListProps {
  onCreateNew: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const PurchaseOrderList = ({ onCreateNew, onView, onEdit }: PurchaseOrderListProps) => {
  const { tenantId } = useAuth();
  const { t, dir, currentLang } = useLanguage();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!tenantId) return;
    fetchOrders();

    const channel = supabase
      .channel("po-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*, suppliers(name)")
      .eq("tenant_id", tenantId!)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setOrders(data || []);
    setLoading(false);
  };

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || (o.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: t("purchaseOrders.statusDraft"), variant: "secondary" },
      pending_approval: { label: t("purchaseOrders.statusPending"), variant: "outline" },
      approved: { label: t("purchaseOrders.statusApproved"), variant: "default" },
      rejected: { label: t("purchaseOrders.statusRejected"), variant: "destructive" },
      cancelled: { label: t("purchaseOrders.statusCancelled"), variant: "destructive" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const deliveryBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: t("purchaseOrders.deliveryPending"), color: "text-muted-foreground" },
      partial: { label: t("purchaseOrders.deliveryPartial"), color: "text-amber-500" },
      delivered: { label: t("purchaseOrders.deliveryDelivered"), color: "text-emerald-500" },
    };
    const s = map[status] || { label: status, color: "text-muted-foreground" };
    return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>;
  };

  const totalSpend = orders.filter(o => o.status === "approved").reduce((s, o) => s + (o.grand_total || 0), 0);
  const pendingCount = orders.filter(o => o.status === "pending_approval").length;
  const pendingDelivery = orders.filter(o => o.status === "approved" && o.delivery_status !== "delivered").length;

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div dir={dir} className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("purchaseOrders.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("purchaseOrders.subtitle")}</p>
        </div>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus size={16} /> {t("purchaseOrders.createOrder")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: t("purchaseOrders.totalSpend"), value: totalSpend.toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US"), icon: DollarSign, color: "text-accent" },
          { label: t("purchaseOrders.pendingApproval"), value: pendingCount.toString(), icon: Clock, color: "text-amber-500" },
          { label: t("purchaseOrders.pendingDelivery"), value: pendingDelivery.toString(), icon: Truck, color: "text-blue-500" },
        ].map((stat) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground font-english">{stat.value} {stat.label === t("purchaseOrders.totalSpend") ? t("common.sar") : ""}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className={`absolute ${dir === "rtl" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <input
            type="text"
            placeholder={t("purchaseOrders.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`h-10 w-full rounded-lg border border-input bg-background ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "draft", "pending_approval", "approved", "rejected"].map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? t("common.all") : s === "draft" ? t("purchaseOrders.statusDraft") : s === "pending_approval" ? t("purchaseOrders.statusPending") : s === "approved" ? t("purchaseOrders.statusApproved") : t("purchaseOrders.statusRejected")}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">{orders.length === 0 ? t("purchaseOrders.noOrders") : t("purchaseOrders.noMatch")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("purchaseOrders.orderNumber")}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("purchaseOrders.supplier")}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("common.date")}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("common.total")}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("common.status")}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("purchaseOrders.delivery")}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground font-english">{order.order_number}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{(order.suppliers as any)?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-english">{order.order_date}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground font-english">{order.grand_total?.toLocaleString()} {t("common.sar")}</td>
                    <td className="px-4 py-3">{statusBadge(order.status)}</td>
                    <td className="px-4 py-3">{deliveryBadge(order.delivery_status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(order.id)}><Eye size={14} /></Button>
                        {order.status === "draft" && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(order.id)}><Pencil size={14} /></Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderList;
