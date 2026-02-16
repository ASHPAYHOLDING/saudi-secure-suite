import { useState, useRef } from "react";
import { FileText, Download, Loader2, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import { toast } from "sonner";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  subtotal: number;
  vat_total: number;
  grand_total: number;
  status: string;
  vat_number: string | null;
}

const STATUS_AR: Record<string, string> = {
  draft: "مسودة",
  issued: "صادرة",
  sent: "مرسلة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
  overdue: "متأخرة",
};

const VatTaxReport = () => {
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [fetched, setFetched] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [invRes, tenantRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, subtotal, vat_total, grand_total, status, customer_id, customers(name, vat_number)")
        .eq("tenant_id", tenantId)
        .gte("invoice_date", fromDate)
        .lte("invoice_date", toDate)
        .neq("status", "cancelled")
        .order("invoice_date", { ascending: true }),
      supabase
        .from("tenants")
        .select("name, name_en, vat_number, cr_number, address_city, address_street")
        .eq("id", tenantId)
        .single(),
    ]);

    const invoices = (invRes.data || []).map((inv: any) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      customer_name: inv.customers?.name || "—",
      subtotal: inv.subtotal || 0,
      vat_total: inv.vat_total || 0,
      grand_total: inv.grand_total || 0,
      status: inv.status,
      vat_number: inv.customers?.vat_number || null,
    }));

    setRows(invoices);
    setTenant(tenantRes.data);
    setFetched(true);
    setLoading(false);
  };

  const totalSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat_total, 0);
  const totalGrand = rows.reduce((s, r) => s + r.grand_total, 0);

  const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePrint = () => {
    if (!reportRef.current) return;
    printDocument(reportRef.current, {
      title: `تقرير ضريبي - ${fromDate} إلى ${toDate}`,
      extraStyles: `
        ${INVOICE_PRINT_STYLES}
        .report-header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #1a1f36; padding-bottom: 16px; }
        .report-header h1 { font-size: 22px; font-weight: 700; color: #1a1f36; margin-bottom: 4px; }
        .report-header .subtitle { font-size: 13px; color: #6b7280; }
        .company-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 8px; }
        .company-info div { font-size: 12px; line-height: 1.8; }
        .company-info .label { color: #6b7280; }
        .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .summary-box .box { padding: 14px; border-radius: 8px; text-align: center; }
        .summary-box .box h4 { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
        .summary-box .box p { font-size: 18px; font-weight: 700; font-family: 'Inter', monospace; direction: ltr; }
        .box-blue { background: #eff6ff; color: #1d4ed8; }
        .box-red { background: #fef2f2; color: #dc2626; }
        .box-green { background: #f0fdf4; color: #16a34a; }
        .zatca-note { margin-top: 20px; padding: 12px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; font-size: 11px; color: #92400e; }
        .footer-stamp { margin-top: 30px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      `,
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">من تاريخ</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">إلى تاريخ</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-[160px]" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
          عرض التقرير
        </Button>
        {fetched && rows.length > 0 && (
          <Button variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4" />
            تصدير PDF
          </Button>
        )}
      </div>

      {/* Preview */}
      {fetched && (
        <div ref={reportRef} className="rounded-xl border border-border bg-card p-6 space-y-5">
          {/* Header */}
          <div className="report-header text-center border-b-2 border-foreground pb-4">
            <h1 className="text-xl font-bold text-foreground">تقرير ضريبة القيمة المضافة</h1>
            <p className="text-sm text-muted-foreground subtitle">
              الفترة: {fromDate} إلى {toDate}
            </p>
            <p className="text-xs text-muted-foreground mt-1">تقرير جاهز للتقديم لهيئة الزكاة والضريبة والجمارك (ZATCA)</p>
          </div>

          {/* Company Info */}
          {tenant && (
            <div className="company-info flex justify-between gap-4 p-3 rounded-lg bg-muted/50 text-sm">
              <div>
                <span className="text-muted-foreground label">اسم المنشأة: </span>
                <strong>{tenant.name}</strong>
                {tenant.name_en && <span className="text-muted-foreground"> ({tenant.name_en})</span>}
              </div>
              <div>
                <span className="text-muted-foreground label">الرقم الضريبي: </span>
                <strong className="font-english">{tenant.vat_number || "غير مسجل"}</strong>
              </div>
              <div>
                <span className="text-muted-foreground label">السجل التجاري: </span>
                <strong className="font-english">{tenant.cr_number || "—"}</strong>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="summary-box grid grid-cols-3 gap-3">
            <div className="box box-blue rounded-lg p-4 text-center bg-blue-50">
              <h4 className="text-xs text-muted-foreground mb-1">المبيعات (قبل الضريبة)</h4>
              <p className="text-lg font-bold font-english">{fmt(totalSubtotal)} ر.س</p>
            </div>
            <div className="box box-red rounded-lg p-4 text-center bg-red-50">
              <h4 className="text-xs text-muted-foreground mb-1">إجمالي ضريبة القيمة المضافة</h4>
              <p className="text-lg font-bold font-english text-destructive">{fmt(totalVat)} ر.س</p>
            </div>
            <div className="box box-green rounded-lg p-4 text-center bg-green-50">
              <h4 className="text-xs text-muted-foreground mb-1">الإجمالي شامل الضريبة</h4>
              <p className="text-lg font-bold font-english text-emerald-600">{fmt(totalGrand)} ر.س</p>
            </div>
          </div>

          {/* Table */}
          {rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد فواتير في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="inv-table w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-foreground text-background">
                    <th className="py-2 px-3 text-right text-xs font-semibold">#</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">رقم الفاتورة</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">التاريخ</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">العميل</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">الرقم الضريبي</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">المبلغ قبل الضريبة</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">الضريبة (15%)</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">الإجمالي</th>
                    <th className="py-2 px-3 text-right text-xs font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-3 font-english font-medium">{row.invoice_number}</td>
                      <td className="py-2 px-3 font-english">{row.invoice_date}</td>
                      <td className="py-2 px-3">{row.customer_name}</td>
                      <td className="py-2 px-3 font-english text-xs">{row.vat_number || "—"}</td>
                      <td className="py-2 px-3 font-english">{fmt(row.subtotal)}</td>
                      <td className="py-2 px-3 font-english">{fmt(row.vat_total)}</td>
                      <td className="py-2 px-3 font-english font-semibold">{fmt(row.grand_total)}</td>
                      <td className="py-2 px-3">{STATUS_AR[row.status] || row.status}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row bg-foreground text-background font-bold">
                    <td colSpan={5} className="py-3 px-3 text-right">الإجمالي ({rows.length} فاتورة)</td>
                    <td className="py-3 px-3 font-english">{fmt(totalSubtotal)}</td>
                    <td className="py-3 px-3 font-english">{fmt(totalVat)}</td>
                    <td className="py-3 px-3 font-english">{fmt(totalGrand)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ZATCA Note */}
          <div className="zatca-note rounded-lg border border-yellow-400 bg-yellow-50 p-3 text-xs text-yellow-800">
            <strong>ملاحظة:</strong> هذا التقرير مُعدّ وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA).
            يشمل جميع الفواتير الضريبية الصادرة خلال الفترة المحددة. يُرجى مراجعة البيانات والتأكد من صحتها قبل التقديم.
            الأرقام الضريبية للعملاء مدرجة للتحقق من صحة المعاملات التجارية.
          </div>

          {/* Footer */}
          <div className="footer-stamp text-center text-xs text-muted-foreground border-t pt-3 mt-6">
            تم إنشاء هذا التقرير بتاريخ {new Date().toLocaleDateString("ar-SA")} — {tenant?.name || ""}
          </div>
        </div>
      )}
    </div>
  );
};

export default VatTaxReport;
