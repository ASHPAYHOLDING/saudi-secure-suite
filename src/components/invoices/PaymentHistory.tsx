import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Banknote, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDateShort } from "@/lib/invoice-utils";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
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

  const fetch = useCallback(async () => {
    if (!invoiceId) return;
    const { data } = await supabase.from("invoice_payments")
      .select("*").eq("invoice_id", invoiceId).order("payment_date", { ascending: false });
    if (data) setPayments(data as Payment[]);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("invoice_payments").delete().eq("id", id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم حذف الدفعة");
    fetch();
    onUpdate();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>;
  if (!payments.length) return <p className="text-xs text-muted-foreground text-center py-4">لا توجد دفعات مسجلة</p>;

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Banknote size={16} className="text-accent" />
          سجل الدفعات
        </h4>
        <Badge variant="secondary" className="text-xs">{payments.length} دفعة — {formatCurrency(total)} ر.س</Badge>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {payments.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-bold font-english text-foreground" dir="ltr">{formatCurrency(p.amount)} ر.س</span>
                <Badge variant="outline" className="text-[10px]">{METHOD_LABELS[p.payment_method] || p.payment_method}</Badge>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{formatDateShort(p.payment_date)}</span>
                {p.reference_number && <span>المرجع: {p.reference_number}</span>}
              </div>
            </div>
            {(userRole === "owner" || userRole === "admin") && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)}>
                <Trash2 size={13} />
              </Button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PaymentHistory;
