import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { FormLabel } from "@/components/ui/form-tooltip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  calculateItemTotals,
  calculateInvoiceTotals,
  type InvoiceItem,
} from "@/lib/invoice-utils";

interface QuotationCreateProps {
  editId?: string | null;
  onBack: () => void;
  onSaved: (id: string) => void;
}

const generateQuotationNumber = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
  return `QUO-${y}${m}-${r}`;
};

const emptyItem = (): InvoiceItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unit: "وحدة",
  unit_price: 0,
  discount: 0,
  vat_rate: 15,
  vat_amount: 0,
  line_total: 0,
});

const QuotationCreate = ({ editId, onBack, onSaved }: QuotationCreateProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [quotationNumber, setQuotationNumber] = useState(generateQuotationNumber);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Load customers and products
  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase.from("customers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("products").select("id, name, unit_price, vat_rate, unit, sku").eq("tenant_id", tenantId).eq("is_active", true),
    ]).then(([cRes, pRes]) => {
      if (cRes.data) setCustomers(cRes.data);
      if (pRes.data) setProducts(pRes.data);
    });
  }, [tenantId]);

  // Load existing quotation for editing
  useEffect(() => {
    if (!editId || !tenantId) return;
    const load = async () => {
      const [qRes, iRes] = await Promise.all([
        supabase.from("quotations").select("*").eq("id", editId).single(),
        supabase.from("quotation_items").select("*").eq("quotation_id", editId).order("sort_order"),
      ]);
      if (qRes.data) {
        const q = qRes.data;
        setQuotationNumber(q.quotation_number);
        setTitle(q.title || "");
        setCustomerId(q.customer_id || "");
        setValidUntil(q.valid_until || "");
        setNotes(q.notes || "");
      }
      if (iRes.data && iRes.data.length > 0) {
        setItems(
          iRes.data.map((i: any) => ({
            id: i.id,
            description: i.description,
            quantity: i.quantity,
            unit: i.unit || "وحدة",
            unit_price: i.unit_price,
            discount: i.discount,
            vat_rate: i.vat_rate,
            vat_amount: i.vat_amount,
            line_total: i.line_total,
          }))
        );
      }
      setLoadingEdit(false);
    };
    load();
  }, [editId, tenantId]);

  const updateItem = useCallback((id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        return { ...updated, ...calculateItemTotals(updated) };
      })
    );
  }, []);

  const selectProduct = (itemId: string, productId: string) => {
    const p = products.find((pr: any) => pr.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const updated = { ...item, description: p.name, unit_price: p.unit_price, vat_rate: p.vat_rate, unit: p.unit || "وحدة" };
        return { ...updated, ...calculateItemTotals(updated) };
      })
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (id: string) => { if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id)); };
  const totals = calculateInvoiceTotals(items);

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!customerId) {
      toast({ title: "خطأ", description: "يرجى اختيار العميل", variant: "destructive" });
      return;
    }
    if (items.every((i) => !i.description.trim())) {
      toast({ title: "خطأ", description: "أضف بند واحد على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (editId) {
      // Update
      const { error } = await supabase.from("quotations").update({
        customer_id: customerId,
        title: title || null,
        valid_until: validUntil || null,
        notes: notes || null,
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        vat_total: totals.vat_total,
        grand_total: totals.grand_total,
      }).eq("id", editId);

      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      // Replace items
      await supabase.from("quotation_items").delete().eq("quotation_id", editId);
      const itemsPayload = items.filter((i) => i.description.trim()).map((item, idx) => ({
        tenant_id: tenantId,
        quotation_id: editId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        discount: item.discount,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        line_total: item.line_total,
        sort_order: idx,
      }));
      await supabase.from("quotation_items").insert(itemsPayload);

      toast({ title: "تم تحديث عرض السعر" });
      setSaving(false);
      onSaved(editId);
    } else {
      // Create
      const { data: quotation, error } = await supabase.from("quotations").insert({
        tenant_id: tenantId,
        customer_id: customerId,
        created_by: user.id,
        quotation_number: quotationNumber,
        title: title || null,
        valid_until: validUntil || null,
        notes: notes || null,
        subtotal: totals.subtotal,
        discount_total: totals.discount_total,
        vat_total: totals.vat_total,
        grand_total: totals.grand_total,
        status: "draft",
      }).select("id").single();

      if (error || !quotation) {
        toast({ title: "خطأ", description: error?.message || "فشل الحفظ", variant: "destructive" });
        setSaving(false);
        return;
      }

      const itemsPayload = items.filter((i) => i.description.trim()).map((item, idx) => ({
        tenant_id: tenantId,
        quotation_id: quotation.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        discount: item.discount,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        line_total: item.line_total,
        sort_order: idx,
      }));
      await supabase.from("quotation_items").insert(itemsPayload);

      toast({ title: "تم حفظ عرض السعر" });
      setSaving(false);
      onSaved(quotation.id);
    }
  };

  const unitOptions = ["وحدة", "ساعة", "يوم", "شهر", "صفحة", "قطعة", "كيلو", "متر", "خدمة"];
  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";
  const smallInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none transition-colors";

  if (loadingEdit) {
    return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{editId ? "تعديل عرض السعر" : "إنشاء عرض سعر جديد"}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">رقم العرض: <span className="font-english font-medium text-foreground">{quotationNumber}</span></p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ عرض السعر
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer + Title */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">بيانات العرض</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormLabel label="العنوان" tooltip="عنوان مختصر يصف العرض مثل: عرض سعر تصميم موقع إلكتروني" />
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عرض سعر تصميم موقع" className={inputClass} />
              </div>
              <div>
                <FormLabel label="العميل" required tooltip="العميل الذي سيتم إرسال عرض السعر له" />
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
                  <option value="">— اختر عميل —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Items Table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="p-5 sm:p-6 pb-4">
              <h3 className="text-sm font-semibold text-foreground">بنود العرض</h3>
              <p className="text-[10px] text-muted-foreground mt-1">يمكنك اختيار منتج من المخزون أو كتابة الوصف يدوياً</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-y border-border bg-secondary/30">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground" style={{ width: "28%" }}>الوصف</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "8%" }}>الكمية</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "10%" }}>الوحدة</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "12%" }}>السعر</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "10%" }}>الخصم</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "8%" }}>الضريبة</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" style={{ width: "14%" }}>الإجمالي</th>
                    <th className="px-2 py-2.5" style={{ width: "5%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10 transition-colors">
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          {products.length > 0 && (
                            <select
                              onChange={(e) => { if (e.target.value) selectProduct(item.id, e.target.value); }}
                              className="h-7 w-full rounded border border-input bg-muted/30 px-2 text-[10px] text-muted-foreground"
                              defaultValue=""
                            >
                              <option value="">اختر من المخزون...</option>
                              {products.map((p: any) => (
                                <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ""}</option>
                              ))}
                            </select>
                          )}
                          <input type="text" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="الوصف" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-accent focus:outline-none transition-colors" />
                        </div>
                      </td>
                      <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} min="0" dir="ltr" className={smallInputClass} /></td>
                      <td className="px-2 py-2"><select value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs focus:border-accent focus:outline-none transition-colors">{unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                      <td className="px-2 py-2"><input type="number" value={item.unit_price} onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className={smallInputClass} /></td>
                      <td className="px-2 py-2"><input type="number" value={item.discount} onChange={(e) => updateItem(item.id, "discount", parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className={smallInputClass} /></td>
                      <td className="px-2 py-2 text-center"><span className="text-xs font-english text-muted-foreground">{item.vat_rate}٪</span></td>
                      <td className="px-3 py-2 text-left"><span className="text-sm font-semibold font-english text-foreground" dir="ltr">{formatCurrency(item.line_total)}</span></td>
                      <td className="px-2 py-2"><button onClick={() => removeItem(item.id)} disabled={items.length <= 1} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs"><Plus size={14} />إضافة بند</Button>
            </div>
          </motion.div>

          {/* Notes */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <label className="text-sm font-semibold text-foreground mb-2 block">ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="شروط وأحكام العرض (اختياري)" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors" />
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">الصلاحية</h3>
            <div>
              <FormLabel label="صالح حتى" tooltip="بعد هذا التاريخ يصبح العرض منتهي الصلاحية. الافتراضي ٣٠ يوماً" />
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={`${inputClass} font-english`} />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-card sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4">ملخص العرض</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="font-english font-medium text-foreground" dir="ltr">{formatCurrency(totals.subtotal)} ر.س</span>
              </div>
              {totals.discount_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الخصم</span>
                  <span className="font-english font-medium text-destructive" dir="ltr">- {formatCurrency(totals.discount_total)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ضريبة القيمة المضافة (١٥٪)</span>
                <span className="font-english font-medium text-foreground" dir="ltr">{formatCurrency(totals.vat_total)} ر.س</span>
              </div>
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">الإجمالي</span>
                  <span className="text-xl font-bold font-english text-accent" dir="ltr">{formatCurrency(totals.grand_total)} ر.س</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default QuotationCreate;
