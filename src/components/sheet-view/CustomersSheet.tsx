import { useState, useEffect, useCallback } from "react";
import { Archive, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SheetTable, { type SheetColumn, type BulkAction } from "./SheetTable";
import type { AppRole } from "@/lib/access/types";

interface Props {
  userRole: AppRole;
  isAdmin: boolean;
}

const TYPE_OPTIONS = [
  { value: "business", label: "شركة" },
  { value: "individual", label: "فرد" },
];

const COLUMNS: SheetColumn[] = [
  { key: "name", label: "الاسم", editable: true, type: "text", width: "200px", validate: v => !v?.trim() ? "الاسم مطلوب" : null },
  { key: "name_en", label: "الاسم (إنجليزي)", editable: true, type: "text", width: "180px" },
  { key: "customer_type", label: "النوع", editable: true, type: "select", options: TYPE_OPTIONS, width: "100px" },
  { key: "email", label: "البريد", editable: true, type: "text", width: "180px", validate: v => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "بريد غير صالح" : null },
  { key: "phone", label: "الهاتف", editable: true, type: "text", width: "140px" },
  { key: "vat_number", label: "الرقم الضريبي", editable: true, type: "text", width: "150px" },
  { key: "cr_number", label: "السجل التجاري", editable: true, type: "text", width: "140px" },
  { key: "address_city", label: "المدينة", editable: true, type: "text", width: "120px" },
  { key: "is_active", label: "الحالة", editable: true, type: "select", options: [{ value: "true", label: "نشط" }, { value: "false", label: "غير نشط" }], width: "90px" },
];

const CustomersSheet = ({ userRole, isAdmin }: Props) => {
  const { tenantId } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    const { data: rows } = await supabase
      .from("customers")
      .select("id, name, name_en, customer_type, email, phone, vat_number, cr_number, address_city, is_active")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (rows) setData(rows.map(r => ({ ...r, is_active: String(r.is_active) })));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCellEdit = async (id: string, key: string, value: any): Promise<boolean> => {
    const updateData: any = { [key]: key === "is_active" ? value === "true" : value };
    const { error } = await supabase.from("customers").update(updateData).eq("id", id);
    if (error) { toast.error("خطأ: " + error.message); return false; }
    toast.success("تم الحفظ");
    await fetchData();
    return true;
  };

  const bulkActions: BulkAction[] = [
    { key: "deactivate", label: "تعطيل", icon: <Archive size={12} />, requireConfirm: true },
    { key: "activate", label: "تفعيل", icon: <CheckCircle2 size={12} /> },
  ];

  const handleBulkAction = async (action: string, ids: string[]) => {
    const isActive = action === "activate";
    await supabase.from("customers").update({ is_active: isActive }).in("id", ids);
    toast.success(`تم ${isActive ? "تفعيل" : "تعطيل"} ${ids.length} عميل`);
    setSelectedIds(new Set());
    await fetchData();
  };

  return (
    <SheetTable
      columns={COLUMNS} data={data} loading={loading} selectedIds={selectedIds}
      onToggleSelect={id => setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; })}
      onToggleSelectAll={() => setSelectedIds(prev => prev.size === data.length ? new Set() : new Set(data.map(r => r.id)))}
      onCellEdit={handleCellEdit} bulkActions={bulkActions} onBulkAction={handleBulkAction} canEdit={true}
    />
  );
};

export default CustomersSheet;
