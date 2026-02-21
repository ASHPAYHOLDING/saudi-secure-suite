import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateInvoiceNumber, calculateItemTotals } from "@/lib/invoice-utils";
import { startWorkflow } from "@/lib/workflows/engine";
import { Loader2, Zap, Plus, Trash2, CheckCircle2, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface QuickInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuickItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

const QuickInvoiceDialog = ({ open, onOpenChange }: QuickInvoiceDialogProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Form state
  const [invoiceNumber] = useState(generateInvoiceNumber);
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<QuickItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, vat_rate: 15 },
  ]);

  useEffect(() => {
    if (!tenantId || !open) return;
    supabase
      .from("customers")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setCustomers(data);
      });
  }, [tenantId, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setSuccess(false);
        setCreatedId(null);
        setCustomerId("");
        setItems([{ id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, vat_rate: 15 }]);
      }, 300);
    }
  }, [open]);

  const updateItem = useCallback((id: string, field: keyof QuickItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, vat_rate: 15 },
    ]);

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Totals
  const computedItems = items.map((item) => {
    const net = item.unit_price * item.quantity;
    const vat = net * (item.vat_rate / 100);
    return { ...item, vat_amount: vat, line_total: net + vat };
  });
  const subtotal = computedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const vatTotal = computedItems.reduce((s, i) => s + i.vat_amount, 0);
  const grandTotal = subtotal + vatTotal;

  const handleSave = async () => {
    if (!tenantId || !user) return;
    if (!customerId) {
      toast({ title: "اختر العميل أولاً", variant: "destructive" });
      return;
    }
    if (items.every((i) => !i.description.trim() || i.unit_price <= 0)) {
      toast({ title: "أضف بند واحد على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        created_by: user.id,
        invoice_number: invoiceNumber,
        invoice_date: today,
        supply_date: today,
        due_date: dueDate,
        subtotal,
        discount_total: 0,
        vat_total: vatTotal,
        grand_total: grandTotal,
        amount_due: grandTotal,
        currency: "SAR",
        currency_code: "SAR",
        exchange_rate: 1,
        base_currency_total: grandTotal,
        exchange_rate_at_creation: 1,
        base_amount: grandTotal,
        status: "draft",
      } as any)
      .select("id")
      .single();

    if (error || !invoice) {
      toast({ title: "خطأ", description: error?.message || "فشل الحفظ", variant: "destructive" });
      setSaving(false);
      return;
    }

    const itemsPayload = computedItems
      .filter((i) => i.description.trim())
      .map((item, idx) => ({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit: "وحدة",
        unit_price: item.unit_price,
        discount: 0,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        line_total: item.line_total,
        sort_order: idx,
      }));

    await supabase.from("invoice_items").insert(itemsPayload);

    // Auto-start workflow
    const wfResult = await startWorkflow(tenantId, "invoice", invoice.id, user.id);
    if ("instanceId" in wfResult) {
      await supabase.from("invoices").update({ status: "pending_approval" } as any).eq("id", invoice.id);
    }

    setCreatedId(invoice.id);
    setSuccess(true);
    setSaving(false);
    toast({ title: "✅ تم إنشاء الفاتورة بنجاح" });
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-success" />
            </motion.div>
            <h3 className="text-lg font-bold text-foreground">تم إنشاء الفاتورة!</h3>
            <p className="text-sm text-muted-foreground">
              رقم الفاتورة: <span className="font-english font-semibold text-foreground">{invoiceNumber}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              الإجمالي: <span className="font-english font-semibold text-foreground">{grandTotal.toFixed(2)}</span>{" "}
              <span className="text-xs">ر.س</span>
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  if (createdId) navigate(`/dashboard/billing`);
                }}
                className="gap-1.5"
              >
                <FileText className="w-4 h-4" />
                عرض الفاتورة
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 bg-accent text-accent-foreground">
                إغلاق
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Zap className="w-5 h-5 text-accent" />
            فاتورة سريعة
            <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
              10 ثوانٍ ⚡
            </Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            رقم: <span className="font-english font-medium text-foreground">{invoiceNumber}</span> · تاريخ اليوم · استحقاق 30 يوم
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Customer */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">العميل *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={inputClass}
            >
              <option value="">— اختر عميل —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Items */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">البنود</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="grid grid-cols-12 gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder="وصف الخدمة"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    className="col-span-5 h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-accent focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="الكمية"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                    min="0"
                    dir="ltr"
                    className="col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="السعر"
                    value={item.unit_price}
                    onChange={(e) => updateItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    dir="ltr"
                    className="col-span-3 h-9 rounded-md border border-input bg-background px-2 text-sm text-center font-english focus:border-accent focus:outline-none"
                  />
                  <div className="col-span-1 text-center text-[10px] text-muted-foreground">{item.vat_rate}%</div>
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length <= 1}
                    className="col-span-1 flex items-center justify-center h-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={addItem} className="gap-1 text-xs mt-2 text-accent">
              <Plus size={14} />
              إضافة بند
            </Button>
          </div>

          {/* Totals */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع قبل الضريبة</span>
              <span className="font-english font-semibold text-foreground">{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ضريبة القيمة المضافة (15%)</span>
              <span className="font-english font-semibold text-foreground">{vatTotal.toFixed(2)} ر.س</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between text-base font-bold">
              <span className="text-foreground">الإجمالي</span>
              <span className="font-english text-accent">{grandTotal.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* Save */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90 h-11"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            إنشاء الفاتورة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickInvoiceDialog;
