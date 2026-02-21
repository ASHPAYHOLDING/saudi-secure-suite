import { useEffect, useState } from "react";
import { ArrowRight, Plus, Trash2, Loader2, Save } from "lucide-react";
import { FormLabel } from "@/components/ui/form-tooltip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startWorkflow } from "@/lib/workflows/engine";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

interface Item {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
  product_id: string | null;
}

interface PurchaseOrderCreateProps {
  editId: string | null;
  onBack: () => void;
  onSaved: (id: string) => void;
}

const PurchaseOrderCreate = ({ editId, onBack, onSaved }: PurchaseOrderCreateProps) => {
  const { tenantId, user } = useAuth();
  const { t, dir } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [title, setTitle] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit: "وحدة", unit_price: 0, discount: 0, vat_rate: 15, product_id: null }]);
  const [orderNumber, setOrderNumber] = useState("");
  const [saving, setSaving] = useState(false);

  // Supplier dialog state
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", email: "", phone: "", cr_number: "", vat_number: "" });

  useEffect(() => {
    if (!tenantId) return;
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    setLoading(true);
    const [suppRes, prodRes, countRes] = await Promise.all([
      supabase.from("suppliers").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, unit_price, vat_rate, unit").eq("tenant_id", tenantId!).eq("is_active", true),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
    ]);
    setSuppliers(suppRes.data || []);
    setProducts(prodRes.data || []);
    const num = (countRes.count || 0) + 1;
    setOrderNumber(`PO-${String(num).padStart(4, "0")}`);

    if (editId) {
      const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", editId).single();
      if (po) {
        setSupplierId(po.supplier_id || "");
        setTitle(po.title);
        setOrderDate(po.order_date);
        setExpectedDelivery(po.expected_delivery_date || "");
        setNotes(po.notes || "");
        setOrderNumber(po.order_number);
        const { data: poItems } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", editId).order("sort_order");
        if (poItems?.length) {
          setItems(poItems.map((i: any) => ({ description: i.description, quantity: i.quantity, unit: i.unit || "وحدة", unit_price: i.unit_price, discount: i.discount, vat_rate: i.vat_rate, product_id: i.product_id })));
        }
      }
    }
    setLoading(false);
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, unit: "وحدة", unit_price: 0, discount: 0, vat_rate: 15, product_id: null }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
  const updateItem = (i: number, field: keyof Item, value: any) => {
    const next = [...items];
    (next[i] as any)[field] = value;
    if (field === "product_id" && value) {
      const prod = products.find((p) => p.id === value);
      if (prod) { next[i].description = prod.name; next[i].unit_price = prod.unit_price; next[i].vat_rate = prod.vat_rate; next[i].unit = prod.unit || "وحدة"; }
    }
    setItems(next);
  };

  const calcLine = (item: Item) => {
    const base = item.quantity * item.unit_price;
    const afterDiscount = base - item.discount;
    const vat = afterDiscount * (item.vat_rate / 100);
    return { lineTotal: afterDiscount + vat, vatAmount: vat };
  };

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price - i.discount, 0);
  const discountTotal = items.reduce((s, i) => s + i.discount, 0);
  const vatTotal = items.reduce((s, i) => s + calcLine(i).vatAmount, 0);
  const grandTotal = subtotal + vatTotal;

  const handleSave = async () => {
    if (!supplierId) { toast.error(t("purchaseOrders.selectSupplierError")); return; }
    if (items.every((i) => !i.description)) { toast.error(t("invoices.addItemError")); return; }

    setSaving(true);
    const poData = {
      tenant_id: tenantId!,
      order_number: orderNumber,
      title,
      supplier_id: supplierId,
      order_date: orderDate,
      expected_delivery_date: expectedDelivery || null,
      notes: notes || null,
      subtotal,
      discount_total: discountTotal,
      vat_total: vatTotal,
      grand_total: grandTotal,
      created_by: user!.id,
    };

    let poId = editId;
    if (editId) {
      const { error } = await supabase.from("purchase_orders").update(poData).eq("id", editId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await supabase.from("purchase_order_items").delete().eq("purchase_order_id", editId);
    } else {
      const { data, error } = await supabase.from("purchase_orders").insert(poData).select("id").single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      poId = data.id;
    }

    const itemRows = items.filter((i) => i.description).map((i, idx) => ({
      tenant_id: tenantId!,
      purchase_order_id: poId!,
      product_id: i.product_id || null,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unit_price: i.unit_price,
      discount: i.discount,
      vat_rate: i.vat_rate,
      vat_amount: calcLine(i).vatAmount,
      line_total: calcLine(i).lineTotal,
      sort_order: idx,
    }));

    await supabase.from("purchase_order_items").insert(itemRows);

    // Auto-start workflow if one exists for purchase orders
    if (!editId) {
      const wfResult = await startWorkflow(tenantId!, "purchase_order", poId!, user!.id);
      if ("instanceId" in wfResult) {
        await supabase.from("purchase_orders").update({ status: "pending_approval" }).eq("id", poId!);
        toast.success("تم إرسال أمر الشراء للموافقة");
      } else {
        toast.success(t("purchaseOrders.savedSuccess"));
      }
    } else {
      toast.success(t("purchaseOrders.savedSuccess"));
    }

    setSaving(false);
    onSaved(poId!);
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name) return;
    const { data, error } = await supabase.from("suppliers").insert({
      tenant_id: tenantId!,
      created_by: user!.id,
      name: newSupplier.name,
      email: newSupplier.email || null,
      phone: newSupplier.phone || null,
      cr_number: newSupplier.cr_number || null,
      vat_number: newSupplier.vat_number || null,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setSuppliers([...suppliers, { id: data.id, name: newSupplier.name }]);
    setSupplierId(data.id);
    setShowSupplierForm(false);
    setNewSupplier({ name: "", email: "", phone: "", cr_number: "", vat_number: "" });
    toast.success(t("common.success"));
  };

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div dir={dir} className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>{t("common.back")}</Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{editId ? t("purchaseOrders.editOrder") : t("purchaseOrders.createOrder")}</h1>
            <p className="text-sm text-muted-foreground font-english">{t("purchaseOrders.orderNumber")}: {orderNumber}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t("common.save")}
        </Button>
      </div>

      {/* Supplier & Basic Info */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t("purchaseOrders.supplierInfo")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormLabel label={t("purchaseOrders.selectSupplier")} required tooltip="اختر المورد الذي ستشتري منه. يمكنك إضافة مورد جديد بالضغط على +" />
            <div className="flex gap-2">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none">
                <option value="">{t("purchaseOrders.chooseSupplier")}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setShowSupplierForm(!showSupplierForm)}><Plus size={16} /></Button>
            </div>
          </div>
          <div>
            <FormLabel label={t("purchaseOrders.poTitle")} tooltip="عنوان وصفي لأمر الشراء مثل: طلب مستلزمات مكتبية - يناير ٢٠٢٥" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t("common.date")}</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english focus:border-accent focus:outline-none" />
          </div>
          <div>
            <FormLabel label={t("purchaseOrders.expectedDelivery")} tooltip="التاريخ المتوقع لاستلام البضاعة من المورد" />
            <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english focus:border-accent focus:outline-none" />
          </div>
        </div>

        {/* Quick Supplier Form */}
        {showSupplierForm && (
          <div className="border border-dashed border-accent/30 rounded-lg p-4 space-y-3 bg-accent/5">
            <h4 className="text-xs font-semibold text-foreground">{t("purchaseOrders.addSupplier")}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <input placeholder={t("common.name")} value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              <input placeholder={t("common.email")} value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              <input placeholder={t("common.phone")} value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              <input placeholder={t("invoices.vatNumber")} value={newSupplier.vat_number} onChange={(e) => setNewSupplier({ ...newSupplier, vat_number: e.target.value })} className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
            </div>
            <Button size="sm" onClick={handleAddSupplier}>{t("common.save")}</Button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground">{t("purchaseOrders.orderItems")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 text-start">{t("invoices.itemDescription")}</th>
                <th className="pb-2 text-start w-20">{t("invoices.quantity")}</th>
                <th className="pb-2 text-start w-20">{t("invoices.unit")}</th>
                <th className="pb-2 text-start w-24">{t("invoices.unitPrice")}</th>
                <th className="pb-2 text-start w-20">{t("invoices.discount")}</th>
                <th className="pb-2 text-start w-24">{t("invoices.lineTotal")}</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-2 pe-2">
                    <select value={item.product_id || ""} onChange={(e) => updateItem(i, "product_id", e.target.value || null)} className="h-8 w-full rounded border border-input bg-background px-2 text-xs mb-1">
                      <option value="">{t("purchaseOrders.selectProduct")}</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="h-8 w-full rounded border border-input bg-background px-2 text-xs" placeholder={t("invoices.descPlaceholder")} />
                  </td>
                  <td className="py-2 pe-2"><input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", +e.target.value)} className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-english" /></td>
                  <td className="py-2 pe-2"><input value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="h-8 w-full rounded border border-input bg-background px-2 text-xs" /></td>
                  <td className="py-2 pe-2"><input type="number" min={0} step={0.01} value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", +e.target.value)} className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-english" /></td>
                  <td className="py-2 pe-2"><input type="number" min={0} step={0.01} value={item.discount} onChange={(e) => updateItem(i, "discount", +e.target.value)} className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-english" /></td>
                  <td className="py-2 pe-2 text-xs font-medium font-english">{calcLine(item).lineTotal.toFixed(2)}</td>
                  <td className="py-2"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}><Trash2 size={14} /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus size={14} /> {t("invoices.addItem")}</Button>

        {/* Summary */}
        <div className={`${dir === "rtl" ? "mr-auto" : "ml-auto"} w-64 space-y-2 pt-4 border-t border-border`}>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("invoices.subtotal")}</span><span className="font-english">{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("invoices.discountTotal")}</span><span className="font-english">{discountTotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("invoices.vat15")}</span><span className="font-english">{vatTotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm font-bold border-t border-border pt-2"><span>{t("invoices.grandTotal")}</span><span className="font-english">{grandTotal.toFixed(2)} {t("common.sar")}</span></div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <label className="text-xs font-medium text-muted-foreground">{t("common.notes")}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none" placeholder={t("invoices.notesPlaceholder")} />
      </div>
    </div>
  );
};

export default PurchaseOrderCreate;
