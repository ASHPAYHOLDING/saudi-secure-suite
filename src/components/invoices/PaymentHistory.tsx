import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Banknote, Undo2, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";
import { secureRpc } from "@/lib/secure-rpc";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  is_reversed: boolean;
  reversed_at: string | null;
  reversal_reason: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  cash: "نقدي",
  credit_card: "بطاقة ائتمان",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
  cheque: "شيك",
  other: "أخرى",
};

const PaymentHistory = ({ invoiceId, onUpdate }: { invoiceId: string; onUpdate: () => void }) => {
  const { tenantId, userRole } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reversalTarget, setReversalTarget] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!invoiceId) return;
    const { data } = await supabase.from("invoice_payments")
      .select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false });
    if (data) setPayments(data as Payment[]);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleReversal = async () => {
    if (!reversalTarget || !reversalReason.trim()) return;
    setReversing(true);

    const { error } = await secureRpc("reverse_payment", {
      p_payment_id: reversalTarget.id,
      p_reason: reversalReason.trim(),
    });

    if (error) {
      toast.error(error.message || "فشل عكس العملية");
    } else {
      toast.success("تم عكس الدفعة بنجاح");
      setReversalTarget(null);
      setReversalReason("");
      fetchPayments();
      onUpdate();
    }
    setReversing(false);
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>;
  if (!payments.length) return <p className="text-xs text-muted-foreground text-center py-4">لا توجد دفعات مسجلة</p>;

  const activePayments = payments.filter(p => !p.is_reversed);
  const total = activePayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Banknote size={16} className="text-accent" />
          سجل الدفعات
        </h4>
        <Badge variant="secondary" className="text-xs">{activePayments.length} دفعة — {formatCurrency(total)} ر.س</Badge>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {payments.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center justify-between px-4 py-3 transition-colors ${
              p.is_reversed ? "bg-muted/40 opacity-60" : "hover:bg-muted/30"
            }`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-sm font-bold font-english ${p.is_reversed ? "line-through text-muted-foreground" : "text-foreground"}`} dir="ltr">
                  {formatCurrency(p.amount)} ر.س
                </span>
                <Badge variant="outline" className="text-[10px]">{METHOD_LABELS[p.payment_method] || p.payment_method}</Badge>
                {p.is_reversed && (
                  <Badge variant="destructive" className="text-[10px] gap-0.5">
                    <Undo2 size={9} />
                    معكوسة
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{formatDateShort(p.payment_date)}</span>
                {p.reference_number && <span>المرجع: {p.reference_number}</span>}
              </div>
              {p.is_reversed && p.reversal_reason && (
                <p className="text-[10px] text-destructive mt-1">سبب العكس: {p.reversal_reason}</p>
              )}
            </div>
            {!p.is_reversed && (userRole === "owner" || userRole === "admin") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setReversalTarget(p)}
              >
                <Undo2 size={13} />
                عكس
              </Button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Reversal Dialog */}
      <Dialog open={!!reversalTarget} onOpenChange={(open) => { if (!open) { setReversalTarget(null); setReversalReason(""); } }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" />
              عكس عملية دفع
            </DialogTitle>
            <DialogDescription>
              سيتم إنشاء حدث عكس (Reversal Event) وتحديث رصيد الفاتورة. لن يتم حذف السجل الأصلي.
            </DialogDescription>
          </DialogHeader>

          {reversalTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ</span>
                  <span className="font-bold font-english" dir="ltr">{formatCurrency(reversalTarget.amount)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الطريقة</span>
                  <span>{METHOD_LABELS[reversalTarget.payment_method] || reversalTarget.payment_method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">التاريخ</span>
                  <span className="font-english">{formatDateShort(reversalTarget.payment_date)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">سبب العكس <span className="text-destructive">*</span></Label>
                <Input
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="مثال: خطأ في المبلغ، دفعة مكررة..."
                  className="text-sm"
                />
              </div>

              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span>هذا الإجراء يُنشئ سجل عكس جديد ولا يحذف الدفعة الأصلية. جميع العمليات مسجلة في سلسلة الأحداث المالية.</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setReversalTarget(null); setReversalReason(""); }}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={handleReversal}
              disabled={reversing || !reversalReason.trim()}
              className="gap-1"
            >
              {reversing ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
              تأكيد العكس
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentHistory;
