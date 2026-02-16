import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, FileText } from "lucide-react";
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
  { value: "sent", label: "مرسل" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
  { value: "converted", label: "محوّل" },
  { value: "expired", label: "منتهي" },
];

const COLUMNS: SheetColumn[] = [
  { key: "quotation_number", label: "رقم العرض", editable: false, type: "readonly", width: "130px" },
  { key: "customer_name", label: "العميل", editable: false, type: "readonly", width: "180px" },
  { key: "title", label: "العنوان", editable: true, type: "text", width: "180px" },
  { key: "status", label: "الحالة", editable: true, type: "select", options: STATUS_OPTIONS, width: "120px" },
  { key: "subtotal", label: "المجموع", editable: false, type: "number", width: "110px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "vat_total", label: "الضريبة", editable: false, type: "number", width: "100px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "grand_total", label: "الإجمالي", editable: false, type: "number", width: "120px", align: "left", format: v => Number(v).toLocaleString("ar-SA") },
  { key: "valid_until", label: "صالح حتى", editable: true, type: "text", width: "120px" },
  { key: "notes", label: "ملاحظات", editable: true, type: "text", width: "200px" },
];

const QuotationsSheet = ({ userRole, isFinance, isAdmin }: Props) => {
  const { tenantId } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    const { data: rows } = await supabase
      .from("quotations")
      .select("id, quotation_number, title, status, subtotal, vat_total, grand_total, valid_until, notes, customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (rows) setData(rows.map((r: any) => ({ ...r, customer_name: r.customers?.name || "—" })));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCellEdit = async (id: string, key: string, value: any): Promise<boolean> => {
    if (!isFinance) { toast.error("ليس لديك صلاحية التعديل"); return false; }
    // Don't allow editing converted quotations
    const row = data.find(r => r.id === id);
    if (row?.status === "converted") { toast.error("لا يمكن تعديل عرض محوّل"); return false; }
    const { error } = await supabase.from("quotations").update({ [key]: value }).eq("id", id);
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
      await supabase.from("quotations").update({ status: "approved", approved_at: new Date().toISOString() }).in("id", ids);
      toast.success(`تم اعتماد ${ids.length} عرض سعر`);
    } else if (action === "reject") {
      await supabase.from("quotations").update({ status: "rejected" }).in("id", ids);
      toast.success(`تم رفض ${ids.length} عرض سعر`);
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

export default QuotationsSheet;
