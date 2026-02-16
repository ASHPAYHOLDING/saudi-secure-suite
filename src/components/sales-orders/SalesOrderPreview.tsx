import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Check, X, FileText, Package, Truck, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDateAr, formatNumber } from "@/lib/invoice-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import DocumentLifecycleTimeline from "@/components/lifecycle/DocumentLifecycleTimeline";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار", confirmed: "مؤكد", partially_fulfilled: "مكتمل جزئياً", fulfilled: "مكتمل", cancelled: "ملغى",
};

interface SalesOrderPreviewProps {
  orderId?: string | null;
  onBack: () => void;
  onConvertedToInvoice: () => void;
  onConvertToDeliveryNote?: (orderId: string) => void;
}

const SalesOrderPreview = ({ orderId, onBack, onConvertedToInvoice, onConvertToDeliveryNote }: SalesOrderPreviewProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!orderId || !tenantId) { setLoading(false); return; }
      const [oRes, iRes] = await Promise.all([
        supabase.from("sales_orders").select("*, customers(name, phone, email, vat_number)").eq("id", orderId).single(),
        supabase.from("sales_order_items").select("*, products(name, stock_quantity)").eq("sales_order_id", orderId).order("sort_order"),
      ]);
      if (oRes.data) { setOrder(oRes.data); setCustomer(oRes.data.customers); }
      if (iRes.data) setItems(iRes.data);
      setLoading(false);
    };
    load();
  }, [orderId, tenantId]);

  const confirmOrder = async () => {
    if (!orderId || !tenantId) return;
    setActionLoading(true);
    try {
      // Reserve stock
      const { error: reserveError } = await supabase.rpc("reserve_stock_for_order", {
        _sales_order_id: orderId,
        _tenant_id: tenantId,
      });
      if (reserveError) throw reserveError;

      const { error } = await supabase.from("sales_orders").update({ status: "confirmed" }).eq("id", orderId);
      if (error) throw error;

      setOrder((prev: any) => ({ ...prev, status: "confirmed" }));
      // Reload items to get updated reserved quantities
      const { data: updatedItems } = await supabase.from("sales_order_items").select("*, products(name, stock_quantity)").eq("sales_order_id", orderId).order("sort_order");
      if (updatedItems) setItems(updatedItems);
      toast({ title: "تم تأكيد أمر البيع وحجز المخزون" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const cancelOrder = async () => {
    if (!orderId || !tenantId) return;
    setActionLoading(true);
    try {
      // Release stock if confirmed
      if (order.status !== "pending") {
        const { error: releaseError } = await supabase.rpc("release_stock_reservation", {
          _sales_order_id: orderId,
          _tenant_id: tenantId,
        });
        if (releaseError) throw releaseError;
      }
      const { error } = await supabase.from("sales_orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", orderId);
      if (error) throw error;
      setOrder((prev: any) => ({ ...prev, status: "cancelled" }));
      toast({ title: "تم إلغاء أمر البيع" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const fulfillItem = async (itemId: string, qty: number) => {
    setActionLoading(true);
    const { error } = await supabase.from("sales_order_items").update({ fulfilled_quantity: qty }).eq("id", itemId);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); setActionLoading(false); return; }

    // Check overall fulfillment
    const updatedItems = items.map((i) => i.id === itemId ? { ...i, fulfilled_quantity: qty } : i);
    setItems(updatedItems);

    const allFulfilled = updatedItems.every((i) => i.fulfilled_quantity >= i.quantity);
    const anyFulfilled = updatedItems.some((i) => i.fulfilled_quantity > 0);
    const newFulfillment = allFulfilled ? "fulfilled" : anyFulfilled ? "partial" : "unfulfilled";
    const newStatus = allFulfilled ? "fulfilled" : anyFulfilled ? "partially_fulfilled" : order.status;

    const updates: any = { fulfillment_status: newFulfillment, status: newStatus };
    if (allFulfilled) updates.fulfilled_at = new Date().toISOString();

    await supabase.from("sales_orders").update(updates).eq("id", orderId);
    setOrder((prev: any) => ({ ...prev, ...updates }));
    toast({ title: "تم تحديث التنفيذ" });
    setActionLoading(false);
  };

  const convertToInvoice = async () => {
    if (!order || !tenantId || !user) return;
    setActionLoading(true);
    const now = new Date();
    const invNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    const { data: invoice, error } = await supabase.from("invoices").insert({
      tenant_id: tenantId, customer_id: order.customer_id, created_by: user.id,
      invoice_number: invNum, invoice_date: now.toISOString().split("T")[0],
      supply_date: now.toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      subtotal: order.subtotal, discount_total: order.discount_total,
      vat_total: order.vat_total, grand_total: order.grand_total,
      amount_due: order.grand_total, notes: order.notes, status: "draft",
    }).select("id").single();

    if (error || !invoice) { toast({ title: "خطأ", description: error?.message, variant: "destructive" }); setActionLoading(false); return; }

    const invoiceItems = items.map((item, idx) => ({
      tenant_id: tenantId, invoice_id: invoice.id, description: item.description,
      quantity: item.quantity, unit: item.unit, unit_price: item.unit_price,
      discount: item.discount, vat_rate: item.vat_rate, vat_amount: item.vat_amount,
      line_total: item.line_total, sort_order: idx,
    }));
    await supabase.from("invoice_items").insert(invoiceItems);
    await supabase.from("sales_orders").update({ converted_invoice_id: invoice.id }).eq("id", orderId);

    toast({ title: "تم تحويل أمر البيع إلى فاتورة", description: `رقم الفاتورة: ${invNum}` });
    setActionLoading(false);
    onConvertedToInvoice();
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  if (!order) return (
    <div dir="rtl" className="p-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 mb-4"><ArrowRight size={18} />العودة</Button>
      <p className="text-center text-muted-foreground py-16">لم يتم العثور على أمر البيع</p>
    </div>
  );

  const totalFulfilled = items.reduce((s, i) => s + (i.fulfilled_quantity || 0), 0);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const fulfillmentPercent = totalQty > 0 ? Math.round((totalFulfilled / totalQty) * 100) : 0;

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة</Button>
          <Badge variant="outline" className="text-sm">{statusLabels[order.status]}</Badge>
          <span className="text-xs text-muted-foreground font-mono">{order.order_number}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {order.status === "pending" && (
            <>
              <Button size="sm" onClick={confirmOrder} disabled={actionLoading} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
                <Check size={14} /> تأكيد وحجز المخزون
              </Button>
              <Button variant="outline" size="sm" onClick={cancelOrder} disabled={actionLoading} className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50">
                <X size={14} /> إلغاء
              </Button>
            </>
          )}
          {(order.status === "confirmed" || order.status === "partially_fulfilled") && !order.converted_invoice_id && (
            <Button variant="outline" size="sm" onClick={cancelOrder} disabled={actionLoading} className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50">
              <X size={14} /> إلغاء
            </Button>
          )}
          {order.fulfillment_status === "fulfilled" && !order.converted_invoice_id && (
            <Button size="sm" onClick={convertToInvoice} disabled={actionLoading} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <FileText size={14} /> تحويل إلى فاتورة
            </Button>
          )}
          {(order.status === "confirmed" || order.status === "partially_fulfilled" || order.status === "fulfilled") && !order.converted_delivery_note_id && onConvertToDeliveryNote && (
            <Button size="sm" variant="outline" onClick={() => onConvertToDeliveryNote(orderId!)} disabled={actionLoading} className="gap-1.5">
              <Truck size={14} /> إنشاء إشعار تسليم
            </Button>
          )}
          {order.converted_delivery_note_id && (
            <Badge className="bg-accent/10 text-accent" variant="outline">تم إنشاء إشعار تسليم</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Info */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package size={18} />تفاصيل الأمر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">العميل</p><p className="font-medium">{customer?.name || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">تاريخ الأمر</p><p className="font-medium">{formatDateAr(order.order_date)}</p></div>
                  <div><p className="text-xs text-muted-foreground">التسليم المتوقع</p><p className="font-medium">{order.expected_delivery_date ? formatDateAr(order.expected_delivery_date) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">الإجمالي</p><p className="font-bold font-english text-accent">{formatCurrency(order.grand_total)} ر.س</p></div>
                </div>
                {order.quotation_id && (
                  <p className="text-xs text-muted-foreground mt-3">تم إنشاؤه من عرض سعر</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Fulfillment Progress */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck size={18} />تتبع التنفيذ — {fulfillmentPercent}٪</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={fulfillmentPercent} className="mb-4" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">البند</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground">المطلوب</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground">محجوز</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground">منفذ</th>
                        <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground">السعر</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">الإجمالي</th>
                        {(order.status === "confirmed" || order.status === "partially_fulfilled") && (
                          <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground">تنفيذ</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2.5 font-medium">{item.description}</td>
                          <td className="px-2 py-2.5 text-center font-english">{formatNumber(item.quantity)}</td>
                          <td className="px-2 py-2.5 text-center font-english">{formatNumber(item.reserved_quantity)}</td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`font-english font-medium ${item.fulfilled_quantity >= item.quantity ? "text-green-600" : "text-amber-600"}`}>
                              {formatNumber(item.fulfilled_quantity)}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center font-english">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2.5 text-left font-english font-semibold">{formatCurrency(item.line_total)}</td>
                          {(order.status === "confirmed" || order.status === "partially_fulfilled") && (
                            <td className="px-2 py-2.5 text-center">
                              {item.fulfilled_quantity < item.quantity ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  disabled={actionLoading}
                                  onClick={() => fulfillItem(item.id, item.quantity)}
                                >
                                  تنفيذ الكل
                                </Button>
                              ) : (
                                <Badge className="bg-green-100 text-green-800" variant="outline">✓</Badge>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {order.notes && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Summary */}
        <div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="sticky top-24">
              <CardHeader><CardTitle className="text-sm">ملخص مالي</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span className="font-english font-medium" dir="ltr">{formatCurrency(order.subtotal)} ر.س</span>
                </div>
                {order.discount_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الخصم</span>
                    <span className="font-english font-medium text-destructive" dir="ltr">- {formatCurrency(order.discount_total)} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ضريبة القيمة المضافة</span>
                  <span className="font-english font-medium" dir="ltr">{formatCurrency(order.vat_total)} ر.س</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">الإجمالي</span>
                    <span className="text-xl font-bold font-english text-accent" dir="ltr">{formatCurrency(order.grand_total)} ر.س</span>
                  </div>
                </div>
                {order.converted_invoice_id && (
                  <div className="pt-2 border-t border-border">
                    <Badge className="bg-purple-100 text-purple-800" variant="outline">تم التحويل لفاتورة</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
          {/* Lifecycle */}
          {orderId && <DocumentLifecycleTimeline documentType="sales_order" documentId={orderId} />}
        </div>
      </div>
    </div>
  );
};

export default SalesOrderPreview;
