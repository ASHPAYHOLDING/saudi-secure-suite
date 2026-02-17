import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/invoice-utils";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  amountDue: number;
  onPaymentRecorded: () => void;
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "cash", label: "نقدي" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "stc_pay", label: "STC Pay" },
  { value: "apple_pay", label: "Apple Pay" },
  { value: "cheque", label: "شيك" },
  { value: "other", label: "أخرى" },
];

const RecordPaymentDialog = ({ open, onOpenChange, invoiceId, amountDue, onPaymentRecorded }: RecordPaymentDialogProps) => {
  const { user, tenantId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(String(amountDue));
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { toast.error("أدخل مبلغاً صالحاً"); return; }
    if (numAmount > amountDue) { toast.error("المبلغ أكبر من المستحق"); return; }
    if (!user || !tenantId) return;

    setSaving(true);
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      tenant_id: tenantId,
      amount: numAmount,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference_number: reference || null,
      notes: notes || null,
      created_by: user.id,
    });

    if (error) {
      toast.error("فشل تسجيل الدفعة: " + error.message);
    } else {
      toast.success("تم تسجيل الدفعة بنجاح");
      onPaymentRecorded();
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">المبلغ المتبقي</p>
            <p className="text-xl font-bold font-english text-foreground" dir="ltr">{formatCurrency(amountDue)} ر.س</p>
          </div>

          <div className="space-y-2">
            <Label>المبلغ المدفوع</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0} max={amountDue} step={0.01} dir="ltr" />
          </div>

          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>تاريخ الدفع</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>رقم المرجع (اختياري)</Label>
            <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="رقم الحوالة أو الشيك" />
          </div>

          <div className="space-y-2">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
              {saving && <Loader2 size={14} className="animate-spin" />}
              تسجيل الدفعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentDialog;
