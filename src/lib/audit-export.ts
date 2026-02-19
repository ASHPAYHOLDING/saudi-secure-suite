/**
 * Audit Log Export — PDF print + Excel (xlsx) export
 */
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_label: string | null;
  user_id: string;
  created_at: string;
  ip_address: string | null;
  before_value: any;
  after_value: any;
  changes: any;
}

const ACTION_LABELS_AR: Record<string, string> = {
  create: "إنشاء", update: "تعديل", delete: "حذف", soft_delete: "حذف ناعم",
  sign: "توقيع", cancel: "إلغاء", mark_paid: "تأكيد الدفع", approve: "اعتماد", void: "إبطال",
};

const ENTITY_LABELS_AR: Record<string, string> = {
  invoices: "فاتورة", expenses: "مصروف", journal_entries: "قيد يومية",
  subscriptions: "اشتراك", wallet_transactions: "محفظة", budgets: "ميزانية",
  credit_notes: "إشعار دائن", contracts: "عقد", report_versions: "تقرير",
};

// ── PDF Export ──
export const exportAuditPDF = (
  logs: AuditLog[],
  profiles: Record<string, string>,
  dateRange: string,
  tenantName?: string
) => {
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="report-print-header">
      <h1>${tenantName || "المنشأة"}</h1>
      <h2>سجل التدقيق الداخلي</h2>
      <p class="sub">${dateRange} — ${logs.length} سجل</p>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:12%">التاريخ</th>
          <th style="width:10%">الإجراء</th>
          <th style="width:12%">نوع الكيان</th>
          <th style="width:18%">المرجع</th>
          <th style="width:15%">المستخدم</th>
          <th style="width:10%">IP</th>
          <th style="width:23%">التغييرات</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => {
          const changesStr = log.changes
            ? Object.entries(log.changes).slice(0, 3).map(([k, v]: [string, any]) => {
                if (typeof v === "object" && v !== null && "old" in v && "new" in v) {
                  return `${k}: ${v.old} → ${v.new}`;
                }
                return `${k}: ${JSON.stringify(v)}`;
              }).join(" | ")
            : "—";
          return `<tr>
            <td class="font-english" style="font-size:11px">${new Date(log.created_at).toLocaleString("ar-SA")}</td>
            <td>${ACTION_LABELS_AR[log.action] || log.action}</td>
            <td>${ENTITY_LABELS_AR[log.entity_type] || log.entity_type}</td>
            <td class="font-english">${log.entity_label || "—"}</td>
            <td>${profiles[log.user_id] || "نظام"}</td>
            <td class="font-english" style="font-size:10px">${log.ip_address || "—"}</td>
            <td style="font-size:10px">${changesStr.slice(0, 120)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="footer">
      <p>تم الاستخراج بتاريخ: ${new Date().toLocaleString("ar-SA")}</p>
      <p>هذا التقرير مُنشأ آلياً من نظام نُمكسيو — Audit Export</p>
    </div>
  `;

  printDocument(container, {
    title: `سجل التدقيق — ${dateRange}`,
    extraStyles: `
      ${INVOICE_PRINT_STYLES}
      body { direction: rtl; font-family: 'IBM Plex Sans Arabic', sans-serif; }
      .report-print-header { text-align: center; margin-bottom: 20px; }
      .report-print-header h1 { font-size: 20px; font-weight: 700; color: #1a1f36; }
      .report-print-header h2 { font-size: 16px; font-weight: 700; color: #1a1f36; margin-bottom: 4px; }
      .report-print-header .sub { font-size: 12px; color: #6b7280; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #1a1f36; color: #fff; padding: 8px 6px; text-align: right; font-weight: 600; font-size: 10px; }
      td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) { background: #f9fafb; }
      .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
      .footer p { font-size: 10px; color: #9ca3af; margin: 2px 0; }
    `,
  });
};

// ── Excel Export ──
export const exportAuditExcel = async (
  logs: AuditLog[],
  profiles: Record<string, string>,
  dateRange: string
) => {
  const XLSX = await import("xlsx");

  const headers = ["التاريخ", "الإجراء", "نوع الكيان", "المرجع", "المستخدم", "عنوان IP", "التغييرات"];

  const rows = logs.map(log => [
    new Date(log.created_at).toLocaleString("ar-SA"),
    ACTION_LABELS_AR[log.action] || log.action,
    ENTITY_LABELS_AR[log.entity_type] || log.entity_type,
    log.entity_label || "—",
    profiles[log.user_id] || "نظام",
    log.ip_address || "—",
    log.changes ? JSON.stringify(log.changes) : "—",
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 40 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "سجل التدقيق");
  XLSX.writeFile(wb, `سجل التدقيق — ${dateRange}.xlsx`);
};
