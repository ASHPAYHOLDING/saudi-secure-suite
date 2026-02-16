import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Archive, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SheetTable, { type SheetColumn, type BulkAction } from "./SheetTable";
import type { AppRole } from "@/lib/roles";

interface Props {
  userRole: AppRole;
  isFinance: boolean;
  isAdmin: boolean;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "issued", label: "صادرة" },
  { value: "sent", label: "مرسلة" },
  { value: "paid", label: "مدفوعة" },
  { value: "overdue", label: "متأخرة" },
  { value: "cancelled", label: "ملغاة" },
];

const COLUMNS: SheetColumn[] = [
  { key: "invoice_number", label: "رقم الفاتورة", editable: false, type: "readonly", width: "130px" },
  { key: "customer_name", label: "العميل", editable: false, type: "readonly", width: "180px" },
  { key: "status", label: "الحالة", editable: true, type: "select", options: STATUS_OPTIONS, width: "120px" },
  { key: "invoice_date", label: "تاريخ الإصدار", editable: false, type: "readonly", width: "120px" },
  { key: "due_date", label: "تاريخ الاستحقاق", editable: true, type: "text", width: "120px", validate: v => !v ? "مطلوب" : null },
  { key: "subtotal", label: "المجموع", editable: false, type: "number", width: "110px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "vat_total", label: "الضريبة", editable: false, type: "number", width: "100px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "grand_total", label: "الإجمالي", editable: false, type: "number", width: "120px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "amount_paid", label: "المدفوع", editable: true, type: "number", width: "110px", align: "left", validate: v => v < 0 ? "قيمة غير صالحة" : null },
  { key: "notes", label: "ملاحظات", editable: true, type: "text", width: "200px" },
];

const InvoicesSheet = ({ userRole, isFinance, isAdmin }: Props) => {
  const { tenantId, user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    const { data: rows } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, status, invoice_date, due_date, subtotal, vat_total, grand_total, amount_paid, amount_due, notes, customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (rows) {
      setData(rows.map((r: any) => ({ ...r, customer_name: r.customers?.name || "—" })));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCellEdit = async (id: string, key: string, value: any): Promise<boolean> => {
    if (!isFinance) { toast.error("ليس لديك صلاحية التعديل"); return false; }
    const updateData: any = { [key]: key === "amount_paid" ? Number(value) : value };
    if (key === "amount_paid") {
      const row = data.find(r => r.id === id);
      updateData.amount_due = row.grand_total - Number(value);
    }
    const { error } = await supabase.from("invoices").update(updateData).eq("id", id);
    if (error) { toast.error("خطأ في الحفظ: " + error.message); return false; }
    toast.success("تم الحفظ");
    await fetchData();
    return true;
  };

  const bulkActions: BulkAction[] = [
    ...(isFinance ? [{ key: "mark_paid", label: "تحديد كمدفوعة", icon: <CheckCircle2 size={12} />, requireConfirm: true }] : []),
    ...(isAdmin ? [{ key: "cancel", label: "إلغاء", icon: <XCircle size={12} />, variant: "destructive" as const, requireConfirm: true }] : []),
  ];

  const handleBulkAction = async (action: string, ids: string[]) => {
    if (action === "mark_paid") {
      for (const id of ids) {
        const row = data.find(r => r.id === id);
        await supabase.from("invoices").update({ status: "paid", amount_paid: row?.grand_total || 0, amount_due: 0 }).eq("id", id);
      }
      toast.success(`تم تحديث ${ids.length} فاتورة كمدفوعة`);
    } else if (action === "cancel") {
      await supabase.from("invoices").update({ status: "cancelled" }).in("id", ids);
      toast.success(`تم إلغاء ${ids.length} فاتورة`);
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  return (
    <SheetTable
      columns={COLUMNS}
      data={data}
      loading={loading}
      selectedIds={selectedIds}
      onToggleSelect={id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })}
      onToggleSelectAll={() => setSelectedIds(prev => prev.size === data.length ? new Set() : new Set(data.map(r => r.id)))}
      onCellEdit={handleCellEdit}
      bulkActions={bulkActions}
      onBulkAction={handleBulkAction}
      canEdit={isFinance}
    />
  );
};

export default InvoicesSheet;
