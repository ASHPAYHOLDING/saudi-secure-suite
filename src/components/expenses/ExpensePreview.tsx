import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Check, X, Pencil, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDateAr } from "@/lib/invoice-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const statusLabels: Record<string, string> = {
  draft: "مسودة", pending: "بانتظار الموافقة", approved: "معتمد", rejected: "مرفوض", paid: "مدفوع",
};
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800", rejected: "bg-red-100 text-red-800", paid: "bg-blue-100 text-blue-800",
};
const paymentLabels: Record<string, string> = {
  cash: "نقدي", bank_transfer: "تحويل بنكي", credit_card: "بطاقة ائتمان", other: "أخرى",
};

interface ExpensePreviewProps {
  expenseId?: string | null;
  onBack: () => void;
  onEdit: (id: string) => void;
}

const ExpensePreview = ({ expenseId, onBack, onEdit }: ExpensePreviewProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!expenseId) { setLoading(false); return; }
      const { data } = await supabase.from("expenses").select("*, expense_categories(name)").eq("id", expenseId).single();
      if (data) setExpense(data);
      setLoading(false);
    };
    load();
  }, [expenseId]);

  const updateStatus = async (status: string, extra?: Record<string, any>) => {
    if (!expenseId || !user) return;
    setActionLoading(true);
    const updates: any = { status, ...extra };
    if (status === "approved") { updates.approved_by = user.id; updates.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from("expenses").update(updates).eq("id", expenseId);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); }
    else { setExpense((prev: any) => ({ ...prev, ...updates })); toast({ title: `تم ${statusLabels[status] || status}` }); }
    setActionLoading(false);
    setShowRejectForm(false);
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  if (!expense) return (
    <div dir="rtl" className="p-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 mb-4"><ArrowRight size={18} />العودة</Button>
      <p className="text-center text-muted-foreground py-16">لم يتم العثور على المصروف</p>
    </div>
  );

  const canApprove = expense.status === "pending";
  const canEdit = expense.status === "draft" || expense.status === "rejected";
  const canSubmit = expense.status === "draft";

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة</Button>
          <Badge variant="outline" className={`text-sm ${statusColors[expense.status]}`}>{statusLabels[expense.status]}</Badge>
          <span className="text-xs text-muted-foreground font-mono">{expense.expense_number}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(expense.id)} className="gap-1.5">
              <Pencil size={14} /> تعديل
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" onClick={() => updateStatus("pending")} disabled={actionLoading} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <FileText size={14} /> إرسال للموافقة
            </Button>
          )}
          {canApprove && (
            <>
              <Button size="sm" onClick={() => updateStatus("approved")} disabled={actionLoading} className="gap-1.5 bg-green-600 text-white hover:bg-green-700">
                <Check size={14} /> اعتماد
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowRejectForm(true)} disabled={actionLoading} className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50">
                <X size={14} /> رفض
              </Button>
            </>
          )}
          {expense.status === "approved" && (
            <Button size="sm" onClick={() => updateStatus("paid")} disabled={actionLoading} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
              <Check size={14} /> تم الدفع
            </Button>
          )}
        </div>
      </div>

      {/* Reject Form */}
      {showRejectForm && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium text-red-800">سبب الرفض</p>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="يرجى توضيح سبب الرفض..." className="bg-background" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => updateStatus("rejected", { rejection_reason: rejectionReason })} disabled={!rejectionReason.trim() || actionLoading}>تأكيد الرفض</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowRejectForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader><CardTitle className="text-sm">تفاصيل المصروف</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">العنوان</p><p className="font-medium">{expense.title || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">الفئة</p><p className="font-medium">{expense.expense_categories?.name || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">تاريخ المصروف</p><p className="font-medium">{formatDateAr(expense.expense_date)}</p></div>
                  <div><p className="text-xs text-muted-foreground">طريقة الدفع</p><p className="font-medium">{paymentLabels[expense.payment_method] || expense.payment_method}</p></div>
                  <div><p className="text-xs text-muted-foreground">المبلغ</p><p className="font-medium font-english">{formatCurrency(expense.amount)} ر.س</p></div>
                  <div><p className="text-xs text-muted-foreground">الإجمالي</p><p className="font-bold font-english text-accent">{formatCurrency(expense.total_amount)} ر.س</p></div>
                </div>
                {expense.description && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">الوصف</p>
                    <p className="text-sm">{expense.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Receipt */}
          {expense.receipt_url && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card>
                <CardHeader><CardTitle className="text-sm">الإيصال المرفق</CardTitle></CardHeader>
                <CardContent>
                  <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors">
                    <FileText size={20} className="text-accent shrink-0" />
                    <span className="text-sm flex-1 truncate">{expense.receipt_filename || "ملف مرفق"}</span>
                    <ExternalLink size={14} className="text-muted-foreground shrink-0" />
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Rejection reason */}
          {expense.rejection_reason && (
            <Card className="border-red-200">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-red-700 mb-1">سبب الرفض</p>
                <p className="text-sm text-red-600">{expense.rejection_reason}</p>
              </CardContent>
            </Card>
          )}

          {expense.notes && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm text-muted-foreground">{expense.notes}</p>
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
                  <span className="text-muted-foreground">المبلغ</span>
                  <span className="font-english font-medium" dir="ltr">{formatCurrency(expense.amount)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ضريبة ({expense.vat_rate}٪)</span>
                  <span className="font-english font-medium" dir="ltr">{formatCurrency(expense.vat_amount)} ر.س</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">الإجمالي</span>
                    <span className="text-xl font-bold font-english text-accent" dir="ltr">{formatCurrency(expense.total_amount)} ر.س</span>
                  </div>
                </div>
                {expense.approved_at && (
                  <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                    <p>تمت الموافقة: {formatDateAr(expense.approved_at)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ExpensePreview;
