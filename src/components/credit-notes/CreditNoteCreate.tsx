import { useState, useEffect } from "react";
import { ArrowRight, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { calculateItemTotals, formatCurrency } from "@/lib/invoice-utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  vat_rate: number;
  vat_amount: number;
  line_total: number;
}

const CreditNoteCreate = ({ linkedInvoiceId, onBack, onSaved }: { linkedInvoiceId: string | null; onBack: () => void; onSaved: () => void }) => {
  const { user, tenantId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; customer_id: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState(linkedInvoiceId || "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit: "وحدة", unit_price: 0, discount: 0, vat_rate: 15, vat_amount: 0, line_total: 0 },
  ]);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from("customers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true).then(({ data }) => { if (data) setCustomers(data); });
    supabase.from("invoices").select("id, invoice_number, customer_id").eq("tenant_id", tenantId).then(({ data }) => { if (data) setInvoices(data); });
  }, [tenantId]);

  // Auto-select customer when invoice is selected
  useEffect(() => {
    if (invoiceId) {
      const inv = invoices.find(i => i.id === invoiceId);
      if (inv) setCustomerId(inv.customer_id);
    }
  }, [invoiceId, invoices]);

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      const totals = calculateItemTotals(updated);
      return { ...updated, ...totals };
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), description: "", quantity: 1, unit: "وحدة", unit_price: 0, discount: 0, vat_rate: 15, vat_amount: 0, line_total: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price - i.discount), 0);
  const vatTotal = items.reduce((s, i) => s + i.vat_amount, 0);
  const grandTotal = items.reduce((s, i) => s + i.line_total, 0);

  const handleSave = async () => {
    if (!customerId) { toast.error("اختر عميلاً"); return; }
    if (!reason.trim()) { toast.error("أدخل سبب الإشعار"); return; }
    if (!items.some(i => i.description.trim())) { toast.error("أضف بنداً واحداً على الأقل"); return; }
    if (!user || !tenantId) return;

    setSaving(true);
    const now = new Date();
    const cnNumber = `CN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    const { data: cn, error } = await supabase.from("credit_notes").insert({
      tenant_id: tenantId,
      credit_note_number: cnNumber,
      invoice_id: invoiceId || null,
      customer_id: customerId,
      reason,
      notes: notes || null,
      subtotal: Math.round(subtotal * 100) / 100,
      vat_total: Math.round(vatTotal * 100) / 100,
      grand_total: Math.round(grandTotal * 100) / 100,
      status: "draft",
      created_by: user.id,
    }).select("id").single();

    if (error || !cn) {
      toast.error("فشل الإنشاء: " + (error?.message || ""));
      setSaving(false);
      return;
    }

    const itemsToInsert = items.filter(i => i.description.trim()).map((item, idx) => ({
      credit_note_id: cn.id,
      tenant_id: tenantId,
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

    await supabase.from("credit_note_items").insert(itemsToInsert);
    toast.success("تم إنشاء الإشعار الدائن بنجاح");
    onSaved();
    setSaving(false);
  };

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة</Button>
        <h1 className="text-xl font-bold text-foreground">إنشاء إشعار دائن</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>الفاتورة المرتبطة (اختياري)</Label>
          <Select value={invoiceId} onValueChange={setInvoiceId}>
            <SelectTrigger><SelectValue placeholder="اختر فاتورة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون فاتورة</SelectItem>
              {invoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>العميل *</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="اختر عميلاً" /></SelectTrigger>
            <SelectContent>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>سبب الإشعار الدائن *</Label>
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثل: إرجاع بضاعة، خطأ في التسعير..." />
      </div>

      {/* Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">البنود</Label>
          <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs"><Plus size={14} />إضافة بند</Button>
        </div>
        {items.map((item, idx) => (
          <div key={item.id} className="grid gap-3 grid-cols-12 items-end rounded-lg border border-border p-3 bg-card">
            <div className="col-span-12 sm:col-span-4 space-y-1">
              <Label className="text-[11px]">الوصف</Label>
              <Input value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} placeholder="وصف البند" />
            </div>
            <div className="col-span-3 sm:col-span-1 space-y-1">
              <Label className="text-[11px]">الكمية</Label>
              <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, "quantity", +e.target.value)} min={1} />
            </div>
            <div className="col-span-4 sm:col-span-2 space-y-1">
              <Label className="text-[11px]">سعر الوحدة</Label>
              <Input type="number" value={item.unit_price} onChange={e => updateItem(item.id, "unit_price", +e.target.value)} min={0} dir="ltr" />
            </div>
            <div className="col-span-3 sm:col-span-2 space-y-1">
              <Label className="text-[11px]">الخصم</Label>
              <Input type="number" value={item.discount} onChange={e => updateItem(item.id, "discount", +e.target.value)} min={0} dir="ltr" />
            </div>
            <div className="col-span-3 sm:col-span-1 space-y-1">
              <Label className="text-[11px]">الضريبة%</Label>
              <Input type="number" value={item.vat_rate} onChange={e => updateItem(item.id, "vat_rate", +e.target.value)} min={0} dir="ltr" />
            </div>
            <div className="col-span-4 sm:col-span-1 text-left">
              <p className="text-[10px] text-muted-foreground mb-1">الإجمالي</p>
              <p className="text-sm font-bold font-english text-foreground" dir="ltr">{formatCurrency(item.line_total)}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 flex justify-end">
              {items.length > 1 && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="flex justify-start">
        <div className="w-full sm:w-72 rounded-lg border border-border divide-y divide-border overflow-hidden">
          <div className="flex justify-between px-4 py-2.5 bg-muted/30"><span className="text-xs text-muted-foreground">المجموع الفرعي</span><span className="text-sm font-english font-medium" dir="ltr">{formatCurrency(subtotal)} ر.س</span></div>
          <div className="flex justify-between px-4 py-2.5 bg-muted/30"><span className="text-xs text-muted-foreground">ضريبة القيمة المضافة</span><span className="text-sm font-english font-medium" dir="ltr">{formatCurrency(vatTotal)} ر.س</span></div>
          <div className="flex justify-between px-4 py-3 bg-destructive/5"><span className="text-sm font-bold text-destructive">الإجمالي</span><span className="text-lg font-bold font-english text-destructive" dir="ltr">{formatCurrency(grandTotal)} ر.س</span></div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>ملاحظات (اختياري)</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack}>إلغاء</Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          {saving && <Loader2 size={14} className="animate-spin" />}
          حفظ الإشعار الدائن
        </Button>
      </div>
    </div>
  );
};

export default CreditNoteCreate;
