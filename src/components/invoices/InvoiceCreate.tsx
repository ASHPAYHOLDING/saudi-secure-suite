import { useState, useCallback, useEffect } from "react";
import { useCenters } from "@/hooks/useCenters";
import { startWorkflow } from "@/lib/workflows/engine";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Trash2, Save, Loader2, AlertCircle } from "lucide-react";
import { FormLabel } from "@/components/ui/form-tooltip";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatCurrencyWithSymbol,
  getCurrencySymbol,
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
  const [currency, setCurrency] = useState("SAR");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [currencies, setCurrencies] = useState<{ code: string; name_ar: string; symbol: string }[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("SAR");
  const [costCenterId, setCostCenterId] = useState("");
  const [profitCenterId, setProfitCenterId] = useState("");
  const { costCenters, profitCenters } = useCenters();

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase.from("customers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("currencies" as any).select("code, name_ar, symbol").eq("is_active", true),
      supabase.from("tenants").select("base_currency").eq("id", tenantId).single(),
    ]).then(([custRes, currRes, tenantRes]) => {
      if (custRes.data) setCustomers(custRes.data);
      if (currRes.data) setCurrencies(currRes.data as any[]);
      if (tenantRes.data) {
        const bc = (tenantRes.data as any).base_currency || "SAR";
        setBaseCurrency(bc);
        setCurrency(bc);
      }
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
  const baseCurrencyTotal = totals.grand_total * exchangeRate;

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === baseCurrency) {
      setExchangeRate(1);
      return;
    }
    if (!tenantId) return;
    const { data } = await supabase
      .from("currency_rates")
      .select("rate")
      .eq("tenant_id", tenantId)
      .eq("from_currency", newCurrency)
      .eq("to_currency", baseCurrency)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setExchangeRate(data?.rate || 1);
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerId) errs.customer = "يرجى اختيار العميل أولاً";
    if (items.every(i => !i.description.trim())) errs.items = "أضف بند واحد على الأقل مع وصف";
    if (items.some(i => i.description.trim() && i.unit_price <= 0)) errs.price = "تأكد من إدخال سعر لكل بند";
    if (new Date(dueDate) < new Date(invoiceDate)) errs.dueDate = "تاريخ الاستحقاق يجب أن يكون بعد تاريخ الإصدار";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!validate()) {
      toast({ title: "تنبيه", description: "يرجى مراجعة الحقول المطلوبة", variant: "destructive" });
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
      currency,
      exchange_rate: exchangeRate,
      base_currency_total: baseCurrencyTotal,
      currency_code: currency,
      exchange_rate_at_creation: exchangeRate,
      base_amount: baseCurrencyTotal,
      notes: notes || null,
      cost_center_id: costCenterId || null,
      profit_center_id: profitCenterId || null,
      status: "draft",
    } as any).select("id").single();

    if (error || !invoice) {
      toast({ title: "خطأ", description: error?.message || "فشل حفظ الفاتورة", variant: "destructive" });
      setSaving(false);
      return;
    }

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

    const wfResult = await startWorkflow(tenantId, "invoice", invoice.id, user.id);
    if ("instanceId" in wfResult) {
      await supabase.from("invoices").update({ status: "pending_approval" } as any).eq("id", invoice.id);
      toast({ title: "تم إرسال الفاتورة للموافقة", description: "الفاتورة بانتظار اعتماد المسؤول" });
    }

    setSaving(false);
    onSaved(invoice.id);
  };

  const unitOptions = ["وحدة", "ساعة", "يوم", "شهر", "صفحة", "قطعة", "كيلو", "متر", "خدمة"];

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";
  const smallInputClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none transition-colors";

  return (
    <div dir="rtl" className="p-4 sm:p-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowRight size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">إنشاء فاتورة ضريبية</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Tax Invoice</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          حفظ الفاتورة
        </Button>
      </div>

      {/* Single-Page Invoice Document */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[210mm]">
        <div className="rounded-xl border border-border bg-white shadow-elevated overflow-hidden" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

          {/* ===== HEADER ===== */}
          <div className="bg-accent p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="text-accent-foreground">
                <h2 className="text-lg sm:text-xl font-bold">فاتورة ضريبية</h2>
                <p className="text-xs font-english opacity-70 mt-0.5">Tax Invoice</p>
              </div>
              <div className="text-left shrink-0">
                <div className="rounded-xl px-5 py-3" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                  <p className="text-[10px] text-accent-foreground/60 mb-0.5">رقم الفاتورة</p>
                  <p className="text-base font-bold font-english tracking-wide text-accent-foreground">{invoiceNumber}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">

            {/* ===== DATES ROW ===== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">تاريخ الإصدار</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={`${inputClass} font-english`} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">تاريخ الاستحقاق</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputClass} font-english ${errors.dueDate ? "border-destructive" : ""}`} />
                {errors.dueDate && <p className="text-[10px] text-destructive mt-1">{errors.dueDate}</p>}
              </div>
              <div className={currencies.length > 1 ? "" : "hidden sm:block"}>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">العملة</label>
                <select value={currency} onChange={(e) => handleCurrencyChange(e.target.value)} className={inputClass}>
                  {currencies.length > 0 ? currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.name_ar} ({c.symbol})</option>
                  )) : (
                    <option value="SAR">ريال سعودي (ر.س)</option>
                  )}
                </select>
              </div>
            </div>

            {currency !== baseCurrency && (
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">سعر الصرف</span>
                <span className="font-english font-medium text-foreground" dir="ltr">1 {getCurrencySymbol(currency)} = {exchangeRate} {getCurrencySymbol(baseCurrency)}</span>
              </div>
            )}

            {/* ===== CUSTOMER ===== */}
            <div className="rounded-xl border border-border p-4 sm:p-5" style={{ background: 'hsl(210 20% 97%)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full bg-accent"></div>
                <h3 className="text-xs font-bold text-muted-foreground tracking-wider">بيانات العميل | Customer Details</h3>
              </div>
              <div>
                <FormLabel label="اختر العميل" required tooltip="حدد العميل الذي ستصدر له الفاتورة" />
                <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setErrors(prev => { const { customer, ...rest } = prev; return rest; }); }} className={`${inputClass} ${errors.customer ? "border-destructive" : ""}`}>
                  <option value="">— اختر عميل —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.customer && <p className="text-[10px] text-destructive mt-1.5 flex items-center gap-1"><AlertCircle size={10} />{errors.customer}</p>}
                {!errors.customer && customers.length === 0 && (
                  <p className="text-[10px] text-warning mt-1.5">لا يوجد عملاء. أضف عميل من صفحة العملاء أولاً.</p>
                )}
              </div>
            </div>

            {/* ===== ITEMS TABLE ===== */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border" style={{ background: 'hsl(210 20% 97%)' }}>
                <h3 className="text-xs font-bold text-muted-foreground tracking-wider">بنود الفاتورة | Invoice Items</h3>
                <p className="text-[10px] text-muted-foreground mt-1">أضف الخدمات أو المنتجات مع الكمية والسعر. يتم احتساب الضريبة تلقائياً بنسبة ١٥٪</p>
                {errors.items && <p className="text-[10px] text-destructive mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.items}</p>}
                {errors.price && <p className="text-[10px] text-destructive mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors.price}</p>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" dir="rtl">
                  <thead>
                    <tr className="border-b border-border bg-accent/5">
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground" style={{ width: "30%" }}>الوصف</th>
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
                    {items.map((item, i) => (
                      <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/10 transition-colors" style={{ background: i % 2 === 1 ? 'hsl(210 20% 98%)' : 'white' }}>
                        <td className="px-3 py-2">
                          <input type="text" value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} placeholder="وصف الخدمة أو المنتج" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none transition-colors" />
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
            </div>

            {/* ===== TOTALS ===== */}
            <div className="flex justify-start">
              <div className="w-full sm:w-[340px] rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
                    <span className="text-xs text-muted-foreground">المجموع الفرعي</span>
                    <span className="text-sm font-english font-medium text-foreground" dir="ltr">{formatCurrency(totals.subtotal)} {getCurrencySymbol(currency)}</span>
                  </div>
                  {totals.discount_total > 0 && (
                    <div className="flex items-center justify-between px-5 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
                      <span className="text-xs text-muted-foreground">الخصم</span>
                      <span className="text-sm font-english font-medium text-destructive" dir="ltr">- {formatCurrency(totals.discount_total)} {getCurrencySymbol(currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
                    <span className="text-xs text-muted-foreground">ضريبة القيمة المضافة (١٥٪)</span>
                    <span className="text-sm font-english font-medium text-foreground" dir="ltr">{formatCurrency(totals.vat_total)} {getCurrencySymbol(currency)}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4 bg-accent">
                    <span className="text-sm font-bold text-accent-foreground">الإجمالي المستحق</span>
                    <span className="text-lg font-bold font-english text-accent-foreground" dir="ltr">{formatCurrency(totals.grand_total)} {getCurrencySymbol(currency)}</span>
                  </div>
                </div>
                {currency !== baseCurrency && (
                  <div className="flex items-center justify-between px-5 py-2.5 border-t border-border text-xs" style={{ background: 'hsl(210 20% 97%)' }}>
                    <span className="text-muted-foreground">بالعملة الأساسية</span>
                    <span className="font-english font-semibold text-muted-foreground" dir="ltr">{formatCurrency(baseCurrencyTotal)} {getCurrencySymbol(baseCurrency)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ===== CENTERS (optional) ===== */}
            {(costCenters.length > 0 || profitCenters.length > 0) && (
              <div className="rounded-xl border border-border p-4 sm:p-5" style={{ background: 'hsl(210 20% 97%)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 rounded-full bg-accent"></div>
                  <h3 className="text-xs font-bold text-muted-foreground tracking-wider">التصنيف المالي</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {costCenters.length > 0 && (
                    <div>
                      <FormLabel label="مركز التكلفة" tooltip="حدد مركز التكلفة لتتبع المصاريف حسب القسم أو المشروع" />
                      <select value={costCenterId} onChange={e => setCostCenterId(e.target.value)} className={inputClass}>
                        <option value="">— بدون —</option>
                        {costCenters.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {profitCenters.length > 0 && (
                    <div>
                      <FormLabel label="مركز الربح" tooltip="حدد مركز الربح لتتبع الإيرادات حسب وحدة الأعمال" />
                      <select value={profitCenterId} onChange={e => setProfitCenterId(e.target.value)} className={inputClass}>
                        <option value="">— بدون —</option>
                        {profitCenters.map(c => <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== NOTES ===== */}
            <div className="rounded-xl border border-border p-4 sm:p-5" style={{ background: 'hsl(210 20% 97%)' }}>
              <label className="text-xs font-bold text-muted-foreground mb-2 block tracking-wider">ملاحظات | Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية (اختياري)" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors" />
            </div>
          </div>

          {/* ===== FOOTER ===== */}
          <div className="border-t border-border px-6 sm:px-8 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
            <p className="text-[10px] text-muted-foreground text-center">
              هذه الفاتورة صادرة إلكترونياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك — {invoiceNumber}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoiceCreate;
