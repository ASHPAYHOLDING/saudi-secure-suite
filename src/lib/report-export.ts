/**
 * Report Export — PDF print + Excel (xlsx) export
 */
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import type { ReportColumn, ReportDefinition } from "./report-definitions";

// ── PDF Export ──
export const exportReportPDF = (
  element: HTMLElement,
  report: ReportDefinition,
  dateRange: string
) => {
  printDocument(element, {
    title: `${report.nameAr} - ${dateRange}`,
    extraStyles: `
      ${INVOICE_PRINT_STYLES}
      body { direction: rtl; font-family: 'IBM Plex Sans Arabic', sans-serif; }
      .report-print-header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1a1f36; padding-bottom: 12px; }
      .report-print-header h1 { font-size: 20px; font-weight: 700; color: #1a1f36; }
      .report-print-header .sub { font-size: 12px; color: #6b7280; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #1a1f36; color: #fff; padding: 8px 10px; text-align: right; font-weight: 600; }
      td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) { background: #f9fafb; }
      tfoot td { background: #f3f4f6; font-weight: 700; }
      .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    `,
  });
};

// ── Excel Export (xlsx) ──
export const exportReportExcel = async (
  data: any[],
  columns: ReportColumn[],
  report: ReportDefinition,
  dateRange: string
) => {
  const XLSX = await import("xlsx");

  // Build header row
  const headers = columns.map((c) => c.labelAr);

  // Build data rows
  const rows = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (col.type === "currency" || col.type === "number" || col.type === "percent") {
        return Number(val) || 0;
      }
      return val ?? "";
    })
  );

  // Add totals row for numeric columns
  const totals = columns.map((col) => {
    if (col.type === "currency" || col.type === "number") {
      return data.reduce((s, row) => s + (Number(row[col.key]) || 0), 0);
    }
    if (col === columns[0]) return "الإجمالي";
    return "";
  });

  const wsData = [headers, ...rows, totals];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = columns.map((col) => ({
    wch: Math.max(col.labelAr.length * 2, 14),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, report.nameAr.slice(0, 30));

  XLSX.writeFile(wb, `${report.nameAr} - ${dateRange}.xlsx`);
};
