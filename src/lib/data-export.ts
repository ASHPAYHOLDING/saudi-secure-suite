/**
 * Full data export utility — exports all tenant data to Excel
 */
import { supabase } from "@/integrations/supabase/client";

interface ExportConfig {
  name: string;
  nameAr: string;
  table: string;
  columns: string;
}

const EXPORT_TABLES: ExportConfig[] = [
  { name: "invoices", nameAr: "الفواتير", table: "invoices", columns: "id, invoice_number, invoice_date, due_date, status, subtotal, vat_total, grand_total, currency, notes, created_at" },
  { name: "customers", nameAr: "العملاء", table: "customers", columns: "id, name, name_en, email, phone, vat_number, cr_number, customer_type, address_city, is_active, created_at" },
  { name: "expenses", nameAr: "المصروفات", table: "expenses", columns: "id, expense_number, expense_date, status, amount, vat_amount, total_amount, category, vendor_name, notes, created_at" },
  { name: "quotations", nameAr: "عروض الأسعار", table: "quotations", columns: "id, quotation_number, quotation_date, valid_until, status, subtotal, vat_total, grand_total, created_at" },
  { name: "credit_notes", nameAr: "إشعارات دائنة", table: "credit_notes", columns: "id, credit_note_number, credit_date, status, subtotal, vat_total, grand_total, reason, created_at" },
  { name: "contracts", nameAr: "العقود", table: "contracts", columns: "id, contract_number, title, contract_type, status, total_value, start_date, end_date, created_at" },
  { name: "products", nameAr: "المنتجات", table: "products", columns: "id, name, name_en, sku, unit_price, cost_price, stock_quantity, category, is_active, created_at" },
];

export const exportAllTenantData = async (
  tenantId: string,
  onProgress?: (table: string, done: number, total: number) => void
) => {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const total = EXPORT_TABLES.length;

  for (let i = 0; i < total; i++) {
    const config = EXPORT_TABLES[i];
    onProgress?.(config.nameAr, i, total);

    try {
      const { data } = await supabase
        .from(config.table as any)
        .select(config.columns)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10000);

      if (data && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, config.nameAr.slice(0, 30));
      }
    } catch (e) {
      console.warn(`Export skipped for ${config.name}:`, e);
    }
  }

  onProgress?.("اكتمل", total, total);

  const fileName = `تصدير_البيانات_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
};

export const exportAuditData = async (
  tenantId: string,
  dateFrom: string,
  dateTo: string
) => {
  const XLSX = await import("xlsx");

  const { data } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (!data || data.length === 0) return null;

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "سجل التدقيق");

  const fileName = `سجل_التدقيق_${dateFrom}_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
};
