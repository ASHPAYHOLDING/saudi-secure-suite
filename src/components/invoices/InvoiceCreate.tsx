import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Trash2, Save, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  generateInvoiceNumber,
  calculateItemTotals,
  calculateInvoiceTotals,
  type InvoiceItem,
} from "@/lib/invoice-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface InvoiceCreateProps {
  onBack: () => void;
  onSaved: (id: string) => void;
}

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

interface CustomerOption { id: string; name: string; }

const InvoiceCreate = ({ onBack, onSaved }: InvoiceCreateProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [invoiceNumber] = useState(generateInvoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from("customers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true).then(({ data }) => {
      if (data) setCustomers(data);
    });
  }, [tenantId]);

  const updateItem = useCallback((id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        const totals = calculateItemTotals(updated);
        return { ...updated, ...totals };
      })
    );
  }, []);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (id: string) => { if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id)); };
  const totals = calculateInvoiceTotals(items);

  const handleSave = async () => {
    if (!tenantId || !user || !customerId) {
      toast({ title: "خطأ", description: "يرجى اختيار العميل", variant: "destructive" });
      return;
    }
    if (items.every(i => !i.description.trim())) {
      toast({ title: "خطأ", description: "أضف بند واحد على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data: invoice, error } = await supabase.from("invoices").insert({
      tenant_id: tenantId,
      customer_id: customerId,
      created_by: user.id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      supply_date: invoiceDate,
      due_date: dueDate,
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      vat_total: totals.vat_total,
      grand_total: totals.grand_total,
      amount_due: totals.grand_total,
      notes: notes || null,
      status: "draft",
    }).select("id").single();

    if (error || !invoice) {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ الفاتورة", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Insert items
    const itemsPayload = items.filter(i => i.description.trim()).map((item, idx) => ({
      tenant_id: tenantId,
      invoice_id: invoice.id,
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

    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsPayload);
    if (itemsError) {
      toast({ title: "تنبيه", description: "تم حفظ الفاتورة لكن فشل حفظ بعض البنود", variant: "destructive" });
    } else {
      toast({ title: "تم حفظ الفاتورة بنجاح" });
    }

    setSaving(false);
    onSaved(invoice.id);
  };

  const unitOptions = ["وحدة", "ساعة", "يوم", "شهر", "صفحة", "قطعة", "كيلو", "متر", "خدمة"];

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">إنشاء فاتورة جديدة</h1>
            <p className="text-xs text-muted-foreground mt-0.5">رقم الفاتورة: <span className="font-english font-medium text-foreground">{invoiceNumber}</span></p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ الفاتورة
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">بيانات العميل</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">اختر العميل *</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">— اختر عميل —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {customers.length === 0 && (
                <p className="text-[10px] text-warning mt-1">لا يوجد عملاء. أضف عميل من صفحة العملاء أولاً.</p>
              )}
            </div>
          </motion.div>

          {/* Items */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="p-6 pb-4"><h3 className="text-sm font-semibold text-foreground">بنود الفاتورة</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-y border-border bg-secondary/30">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground" style={{ width: "30%" }}>الوصف</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "8%" }}>الكمية</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "10%" }}>الوحدة</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "12%" }}>السعر</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "10%" }}>الخصم</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground" style={{ width: "8%" }}>الضريبة</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground" style={{ width: "14%" }}>الإجمالي</th>
                    <th className="px-3 py-2.5" style={{ width: "5%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2"><input type="text" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="وصف الخدمة أو المنتج" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none" /></td>
                      <td className="px-2 py-2"><input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} min="0" dir="ltr" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none" /></td>
                      <td className="px-2 py-2"><select value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-1 text-xs focus:border-accent focus:outline-none">{unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                      <td className="px-2 py-2"><input type="number" value={item.unit_price} onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none" /></td>
                      <td className="px-2 py-2"><input type="number" value={item.discount} onChange={(e) => updateItem(item.id, "discount", parseFloat(e.target.value) || 0)} min="0" step="0.01" dir="ltr" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none" /></td>
                      <td className="px-2 py-2 text-center"><span className="text-xs font-english text-muted-foreground">{item.vat_rate}٪</span></td>
                      <td className="px-3 py-2 text-left"><span className="text-sm font-semibold font-english text-foreground">{formatCurrency(item.line_total)}</span></td>
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
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <label className="text-sm font-semibold text-foreground mb-2 block">ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="ملاحظات إضافية (اختياري)" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none" />
          </motion.div>
        </div>

        {/* Left Column */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">التواريخ</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">تاريخ الإصدار</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">تاريخ الاستحقاق</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-english focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-6 shadow-card sticky top-24">
            <h3 className="text-sm font-semibold text-foreground mb-4">ملخص الفاتورة</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع الفرعي</span><span className="font-english font-medium text-foreground">{formatCurrency(totals.subtotal)} ر.س</span></div>
              {totals.discount_total > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">الخصم</span><span className="font-english font-medium text-destructive">- {formatCurrency(totals.discount_total)} ر.س</span></div>}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">ضريبة القيمة المضافة (١٥٪)</span><span className="font-english font-medium text-foreground">{formatCurrency(totals.vat_total)} ر.س</span></div>
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between items-center"><span className="font-bold text-foreground">الإجمالي المستحق</span><span className="text-xl font-bold font-english text-accent">{formatCurrency(totals.grand_total)} ر.س</span></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceCreate;
