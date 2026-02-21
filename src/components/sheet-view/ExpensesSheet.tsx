import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SheetTable, { type SheetColumn, type BulkAction } from "./SheetTable";
import type { AppRole } from "@/lib/access/types";

interface Props {
  userRole: AppRole;
  isFinance: boolean;
  isAdmin: boolean;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "pending", label: "بانتظار الموافقة" },
  { value: "approved", label: "معتمدة" },
  { value: "rejected", label: "مرفوضة" },
];

const PAYMENT_OPTIONS = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "credit_card", label: "بطاقة ائتمان" },
];

const COLUMNS: SheetColumn[] = [
  { key: "expense_number", label: "الرقم", editable: false, type: "readonly", width: "120px" },
  { key: "title", label: "العنوان", editable: true, type: "text", width: "180px", validate: v => !v?.trim() ? "العنوان مطلوب" : null },
  { key: "status", label: "الحالة", editable: true, type: "select", options: STATUS_OPTIONS, width: "130px" },
  { key: "expense_date", label: "التاريخ", editable: true, type: "text", width: "120px" },
  { key: "amount", label: "المبلغ", editable: true, type: "number", width: "110px", align: "left", format: v => Number(v).toLocaleString("ar-SA"), validate: v => v <= 0 ? "يجب أن يكون أكبر من صفر" : null },
  { key: "vat_amount", label: "الضريبة", editable: false, type: "number", width: "100px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "total_amount", label: "الإجمالي", editable: false, type: "number", width: "110px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "payment_method", label: "طريقة الدفع", editable: true, type: "select", options: PAYMENT_OPTIONS, width: "130px" },
  { key: "notes", label: "ملاحظات", editable: true, type: "text", width: "200px" },
];

const ExpensesSheet = ({ userRole, isFinance, isAdmin }: Props) => {
  const { tenantId } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    const { data: rows } = await supabase
      .from("expenses")
      .select("id, expense_number, title, status, expense_date, amount, vat_amount, vat_rate, total_amount, payment_method, notes")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (rows) setData(rows);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCellEdit = async (id: string, key: string, value: any): Promise<boolean> => {
    if (!isFinance) { toast.error("ليس لديك صلاحية التعديل"); return false; }
    const updateData: any = { [key]: key === "amount" ? Number(value) : value };
    if (key === "amount") {
      const row = data.find(r => r.id === id);
      const vatRate = row?.vat_rate || 15;
      updateData.vat_amount = Number(value) * (vatRate / 100);
      updateData.total_amount = Number(value) + updateData.vat_amount;
    }
    const { error } = await supabase.from("expenses").update(updateData).eq("id", id);
    if (error) { toast.error("خطأ: " + error.message); return false; }
    toast.success("تم الحفظ");
    await fetchData();
    return true;
  };

  const bulkActions: BulkAction[] = [
    ...(isAdmin ? [{ key: "approve", label: "موافقة", icon: <CheckCircle2 size={12} />, requireConfirm: true }] : []),
    ...(isAdmin ? [{ key: "reject", label: "رفض", icon: <XCircle size={12} />, variant: "destructive" as const, requireConfirm: true }] : []),
  ];

  const handleBulkAction = async (action: string, ids: string[]) => {
    if (action === "approve") {
      await supabase.from("expenses").update({ status: "approved", approved_at: new Date().toISOString() }).in("id", ids);
      toast.success(`تم اعتماد ${ids.length} مصروف`);
    } else if (action === "reject") {
      await supabase.from("expenses").update({ status: "rejected" }).in("id", ids);
      toast.success(`تم رفض ${ids.length} مصروف`);
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  return (
    <SheetTable
      columns={COLUMNS} data={data} loading={loading} selectedIds={selectedIds}
      onToggleSelect={id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })}
      onToggleSelectAll={() => setSelectedIds(prev => prev.size === data.length ? new Set() : new Set(data.map(r => r.id)))}
      onCellEdit={handleCellEdit} bulkActions={bulkActions} onBulkAction={handleBulkAction} canEdit={isFinance}
    />
  );
};

export default ExpensesSheet;
