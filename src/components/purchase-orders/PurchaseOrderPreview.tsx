import { useEffect, useState } from "react";
import { ArrowRight, Check, X, Truck, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

interface Props {
  orderId: string | null;
  onBack: () => void;
}

const PurchaseOrderPreview = ({ orderId, onBack }: Props) => {
  const { tenantId, user } = useAuth();
  const { t, dir, currentLang } = useLanguage();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    const [poRes, itemsRes] = await Promise.all([
      supabase.from("purchase_orders").select("*, suppliers(*)").eq("id", orderId!).single(),
      supabase.from("purchase_order_items").select("*, products(name)").eq("purchase_order_id", orderId!).order("sort_order"),
    ]);
    setOrder(poRes.data);
    setSupplier((poRes.data as any)?.suppliers);
    setItems(itemsRes.data || []);
    setLoading(false);
  };

  const updateStatus = async (status: string, extras: Record<string, any> = {}) => {
    setActionLoading(status);
    const { error } = await supabase.from("purchase_orders").update({ status, ...extras }).eq("id", orderId!);
    if (error) toast.error(error.message);
    else { toast.success(t("common.success")); fetchOrder(); }
    setActionLoading("");
  };

  const handleReceive = async () => {
    setActionLoading("receive");
    
    // Re-fetch fresh items to avoid stale state
    const { data: freshItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("purchase_order_id", orderId!).order("sort_order");
    const currentItems = freshItems || items;
    
    // Update delivery status
    const { error: poErr } = await supabase.from("purchase_orders").update({ delivery_status: "delivered", delivered_at: new Date().toISOString() }).eq("id", orderId!);
    if (poErr) { toast.error(poErr.message); setActionLoading(""); return; }

    // Update inventory for each item with a product_id
    for (const item of currentItems) {
      if (item.product_id) {
        const { error } = await supabase.rpc("record_stock_movement", {
          _product_id: item.product_id,
          _tenant_id: tenantId!,
          _movement_type: "in",
          _quantity: item.quantity,
          _reference_type: "purchase_order",
          _reference_id: orderId!,
          _notes: `استلام أمر شراء ${order.order_number}`,
          _created_by: user!.id,
        });
        if (error) { toast.error(`Stock error: ${error.message}`); }

        // Update received_quantity on the item
        await supabase.from("purchase_order_items").update({ received_quantity: item.quantity }).eq("id", item.id);
      }
    }

    toast.success(t("purchaseOrders.receivedSuccess"));
    fetchOrder();
    setActionLoading("");
  };

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!order) return <div className="p-6 text-center text-muted-foreground">{t("purchaseOrders.notFound")}</div>;

  const statusLabel: Record<string, string> = {
    draft: t("purchaseOrders.statusDraft"),
    pending_approval: t("purchaseOrders.statusPending"),
    approved: t("purchaseOrders.statusApproved"),
    rejected: t("purchaseOrders.statusRejected"),
    cancelled: t("purchaseOrders.statusCancelled"),
  };

  return (
    <div dir={dir} className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>{t("common.back")}</Button>
          <div>
            <h1 className="text-xl font-bold text-foreground font-english">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">{order.title}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Approval flow */}
          {order.status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => updateStatus("pending_approval")} disabled={!!actionLoading}>
              {t("purchaseOrders.submitApproval")}
            </Button>
          )}
          {order.status === "pending_approval" && (
            <>
              <Button size="sm" className="gap-1" onClick={() => updateStatus("approved", { approved_by: user!.id, approved_at: new Date().toISOString() })} disabled={!!actionLoading}>
                <Check size={14} /> {t("purchaseOrders.approve")}
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus("rejected")} disabled={!!actionLoading}>
                <X size={14} /> {t("purchaseOrders.reject")}
              </Button>
            </>
          )}
          {order.status === "approved" && order.delivery_status !== "delivered" && (
            <Button size="sm" className="gap-1" onClick={handleReceive} disabled={!!actionLoading}>
              {actionLoading === "receive" ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              {t("purchaseOrders.receiveGoods")}
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex gap-3">
        <Badge variant={order.status === "approved" ? "default" : order.status === "rejected" ? "destructive" : "secondary"}>
          {statusLabel[order.status] || order.status}
        </Badge>
        <Badge variant={order.delivery_status === "delivered" ? "default" : "outline"}>
          {order.delivery_status === "delivered" ? t("purchaseOrders.deliveryDelivered") : t("purchaseOrders.deliveryPending")}
        </Badge>
      </div>

      {/* Supplier Info */}
      {supplier && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t("purchaseOrders.supplierInfo")}</h3>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <div><span className="text-muted-foreground">{t("common.name")}:</span> <span className="font-medium">{supplier.name}</span></div>
            {supplier.email && <div><span className="text-muted-foreground">{t("common.email")}:</span> <span className="font-english">{supplier.email}</span></div>}
            {supplier.phone && <div><span className="text-muted-foreground">{t("common.phone")}:</span> <span className="font-english">{supplier.phone}</span></div>}
            {supplier.vat_number && <div><span className="text-muted-foreground">{t("invoices.vatNumber")}:</span> <span className="font-english">{supplier.vat_number}</span></div>}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">#</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("invoices.itemDescription")}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("invoices.quantity")}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("invoices.unitPrice")}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("invoices.tax")}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">{t("invoices.lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-4 py-3 text-muted-foreground font-english">{i + 1}</td>
                <td className="px-4 py-3 text-foreground">{item.description}</td>
                <td className="px-4 py-3 font-english">{item.quantity} {item.unit}</td>
                <td className="px-4 py-3 font-english">{item.unit_price?.toFixed(2)}</td>
                <td className="px-4 py-3 font-english">{item.vat_amount?.toFixed(2)}</td>
                <td className="px-4 py-3 font-medium font-english">{item.line_total?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} w-72 p-4 space-y-2`}>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("invoices.subtotal")}</span><span className="font-english">{order.subtotal?.toFixed(2)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("invoices.discountTotal")}</span><span className="font-english">{order.discount_total?.toFixed(2)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("invoices.vat15")}</span><span className="font-english">{order.vat_total?.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm font-bold border-t border-border pt-2"><span>{t("invoices.grandTotal")}</span><span className="font-english">{order.grand_total?.toFixed(2)} {t("common.sar")}</span></div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-2">{t("common.notes")}</h3>
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderPreview;
