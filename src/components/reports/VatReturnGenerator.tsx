import { useState, useRef, useMemo } from "react";
import {
  AlertTriangle, Calendar, ChevronDown, Download, FileSpreadsheet,
  FileText, Loader2, Shield, CheckCircle2, XCircle, Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import { toast } from "sonner";

// ─── Types ───
interface VatReturnData {
  // Box 1-4: Sales
  standardRatedSales: number;
  standardRatedSalesVat: number;
  zeroRatedSales: number;
  exemptSales: number;
  // Box 5-8: Purchases
  standardRatedPurchases: number;
  standardRatedPurchasesVat: number;
  zeroRatedPurchases: number;
  exemptPurchases: number;
  // Computed
  totalOutputVat: number;
  totalInputVat: number;
  netVat: number;
  // Metadata
  totalInvoices: number;
  totalExpenses: number;
  totalPurchaseOrders: number;
}

interface DataWarning {
  type: "error" | "warning" | "info";
  messageAr: string;
  messageEn: string;
}

interface TenantInfo {
  name: string;
  name_en: string | null;
  vat_number: string | null;
  cr_number: string | null;
  address_city: string | null;
}

// ─── Period helpers ───
const QUARTERS = [
  { key: "Q1", labelAr: "الربع الأول (يناير - مارس)", labelEn: "Q1 (Jan - Mar)", from: "-01-01", to: "-03-31" },
  { key: "Q2", labelAr: "الربع الثاني (أبريل - يونيو)", labelEn: "Q2 (Apr - Jun)", from: "-04-01", to: "-06-30" },
  { key: "Q3", labelAr: "الربع الثالث (يوليو - سبتمبر)", labelEn: "Q3 (Jul - Sep)", from: "-07-01", to: "-09-30" },
  { key: "Q4", labelAr: "الربع الرابع (أكتوبر - ديسمبر)", labelEn: "Q4 (Oct - Dec)", from: "-10-01", to: "-12-31" },
];

const getCurrentYear = () => new Date().getFullYear();
const getYears = () => {
  const y = getCurrentYear();
  return [y, y - 1, y - 2];
};

const fmt = (n: number) => n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const VatReturnGenerator = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();

  const [year, setYear] = useState(String(getCurrentYear()));
  const [quarter, setQuarter] = useState("Q1");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [vatData, setVatData] = useState<VatReturnData | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [warnings, setWarnings] = useState<DataWarning[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  const selectedQuarter = QUARTERS.find((q) => q.key === quarter)!;
  const dateFrom = `${year}${selectedQuarter.from}`;
  const dateTo = `${year}${selectedQuarter.to}`;

  // ─── Fetch & Calculate ───
  const generate = async () => {
    if (!tenantId) return;
    setLoading(true);
    setWarnings([]);

    try {
      const [invoicesRes, expensesRes, purchasesRes, tenantRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, status, subtotal, vat_total, grand_total, customer_id, customers(vat_number)")
          .eq("tenant_id", tenantId)
          .gte("invoice_date", dateFrom)
          .lte("invoice_date", dateTo),
        supabase
          .from("expenses")
          .select("id, status, amount, vat_amount, vat_rate, total_amount")
          .eq("tenant_id", tenantId)
          .gte("expense_date", dateFrom)
          .lte("expense_date", dateTo),
        supabase
          .from("purchase_orders")
          .select("id, status, subtotal, vat_total, grand_total")
          .eq("tenant_id", tenantId)
          .gte("order_date", dateFrom)
          .lte("order_date", dateTo),
        supabase
          .from("tenants")
          .select("name, name_en, vat_number, cr_number, address_city")
          .eq("id", tenantId)
          .single(),
      ]);

      setTenant(tenantRes.data);

      const invoices = invoicesRes.data || [];
      const expenses = expensesRes.data || [];
      const purchases = purchasesRes.data || [];

      // ── Warnings ──
      const w: DataWarning[] = [];

      if (!tenantRes.data?.vat_number) {
        w.push({ type: "error", messageAr: "الرقم الضريبي للمنشأة غير مسجل", messageEn: "Organization VAT number is missing" });
      }
      if (!tenantRes.data?.cr_number) {
        w.push({ type: "warning", messageAr: "السجل التجاري غير مسجل", messageEn: "Commercial registration number is missing" });
      }

      const draftInvoices = invoices.filter((i) => i.status === "draft");
      if (draftInvoices.length > 0) {
        w.push({ type: "warning", messageAr: `يوجد ${draftInvoices.length} فاتورة مسودة لم يتم اعتمادها`, messageEn: `${draftInvoices.length} draft invoice(s) not finalized` });
      }

      const draftExpenses = expenses.filter((e) => e.status === "draft");
      if (draftExpenses.length > 0) {
        w.push({ type: "warning", messageAr: `يوجد ${draftExpenses.length} مصروف مسودة لم يتم اعتماده`, messageEn: `${draftExpenses.length} draft expense(s) not approved` });
      }

      const cancelledInvoices = invoices.filter((i) => i.status === "cancelled");
      if (cancelledInvoices.length > 0) {
        w.push({ type: "info", messageAr: `تم استبعاد ${cancelledInvoices.length} فاتورة ملغاة`, messageEn: `${cancelledInvoices.length} cancelled invoice(s) excluded` });
      }

      const missingVatCustomers = invoices.filter((i: any) => i.status !== "cancelled" && !i.customers?.vat_number);
      if (missingVatCustomers.length > 0) {
        w.push({ type: "warning", messageAr: `${missingVatCustomers.length} فاتورة لعملاء بدون رقم ضريبي`, messageEn: `${missingVatCustomers.length} invoice(s) for customers without VAT numbers` });
      }

      setWarnings(w);

      // ── Calculations (exclude cancelled) ──
      const activeInvoices = invoices.filter((i) => i.status !== "cancelled");
      const activeExpenses = expenses.filter((e) => e.status !== "draft" && e.status !== "rejected");
      const activePurchases = purchases.filter((p) => p.status !== "cancelled" && p.status !== "rejected");

      const standardRatedSales = activeInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
      const standardRatedSalesVat = activeInvoices.reduce((s, i) => s + (i.vat_total || 0), 0);

      const standardRatedExpenses = activeExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const standardRatedExpensesVat = activeExpenses.reduce((s, e) => s + (e.vat_amount || 0), 0);

      const standardRatedPOVat = activePurchases.reduce((s, p) => s + (p.vat_total || 0), 0);
      const standardRatedPOAmount = activePurchases.reduce((s, p) => s + (p.subtotal || 0), 0);

      const totalInputVat = standardRatedExpensesVat + standardRatedPOVat;
      const totalInputAmount = standardRatedExpenses + standardRatedPOAmount;

      const result: VatReturnData = {
        standardRatedSales,
        standardRatedSalesVat,
        zeroRatedSales: 0,
        exemptSales: 0,
        standardRatedPurchases: totalInputAmount,
        standardRatedPurchasesVat: totalInputVat,
        zeroRatedPurchases: 0,
        exemptPurchases: 0,
        totalOutputVat: standardRatedSalesVat,
        totalInputVat,
        netVat: standardRatedSalesVat - totalInputVat,
        totalInvoices: activeInvoices.length,
        totalExpenses: activeExpenses.length,
        totalPurchaseOrders: activePurchases.length,
      };

      setVatData(result);
      setFetched(true);
    } catch (err: any) {
      toast.error(err.message || "Error generating VAT return");
    }
    setLoading(false);
  };

  // ─── Export PDF ───
  const handleExportPDF = () => {
    if (!reportRef.current) return;
    printDocument(reportRef.current, {
      title: `إقرار ضريبة القيمة المضافة - ${selectedQuarter.labelAr} ${year}`,
      extraStyles: `
        ${INVOICE_PRINT_STYLES}
        body { direction: rtl; font-family: 'IBM Plex Sans Arabic', sans-serif; }
        .vat-header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1a1f36; padding-bottom: 16px; }
        .vat-header h1 { font-size: 20px; font-weight: 700; color: #1a1f36; }
        .vat-header .sub { font-size: 12px; color: #6b7280; }
        .company-block { display: flex; justify-content: space-between; margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #1a1f36; color: #fff; padding: 10px 12px; text-align: right; }
        td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
        .section-head { background: #f3f4f6; font-weight: 700; }
        .total-row { background: #1a1f36; color: #fff; font-weight: 700; }
        .net-positive { color: #dc2626; }
        .net-negative { color: #16a34a; }
        .warning-box { margin-top: 16px; padding: 10px; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; font-size: 11px; }
        .footer-stamp { margin-top: 24px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
      `,
    });
  };

  // ─── Export Excel (ZATCA VAT Return format) ───
  const handleExportExcel = async () => {
    if (!vatData) return;
    const XLSX = await import("xlsx");

    const rows = [
      ["إقرار ضريبة القيمة المضافة - VAT Return Declaration"],
      [`المنشأة: ${tenant?.name || ""}`, `الرقم الضريبي: ${tenant?.vat_number || "—"}`],
      [`الفترة: ${selectedQuarter.labelAr} ${year}`, `من: ${dateFrom}`, `إلى: ${dateTo}`],
      [],
      ["البند", "المبلغ (ر.س)", "الضريبة (ر.س)"],
      ["المبيعات الخاضعة للنسبة الأساسية (15%)", vatData.standardRatedSales, vatData.standardRatedSalesVat],
      ["المبيعات بنسبة صفر", vatData.zeroRatedSales, 0],
      ["المبيعات المعفاة", vatData.exemptSales, 0],
      [],
      ["المشتريات الخاضعة للنسبة الأساسية (15%)", vatData.standardRatedPurchases, vatData.standardRatedPurchasesVat],
      ["المشتريات بنسبة صفر", vatData.zeroRatedPurchases, 0],
      ["المشتريات المعفاة", vatData.exemptPurchases, 0],
      [],
      ["إجمالي ضريبة المخرجات", "", vatData.totalOutputVat],
      ["إجمالي ضريبة المدخلات", "", vatData.totalInputVat],
      ["صافي الضريبة المستحقة / (القابلة للاسترداد)", "", vatData.netVat],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "إقرار ضريبي");
    XLSX.writeFile(wb, `VAT_Return_${quarter}_${year}.xlsx`);
    toast.success(isRTL ? "تم تصدير الإقرار بنجاح" : "VAT return exported");
  };

  // ─── Render ───
  return (
    <div dir="rtl" className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? "مُولّد الإقرار الضريبي" : "VAT Return Generator"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isRTL ? "إقرار ضريبة القيمة المضافة وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك" : "ZATCA-compliant VAT return declaration"}
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          {isRTL ? "للقراءة فقط" : "Read-only"}
        </Badge>
      </div>

      {/* Period Selection */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {isRTL ? "السنة" : "Year"}
              </label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getYears().map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {isRTL ? "الفترة الضريبية" : "Tax Period"}
              </label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.key} value={q.key}>
                      {isRTL ? q.labelAr : q.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              {isRTL ? "إنشاء الإقرار" : "Generate Return"}
            </Button>
            {fetched && vatData && (
              <>
                <Button variant="outline" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 me-1" />
                  PDF
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 me-1" />
                  Excel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-semibold text-yellow-800">
                {isRTL ? "تنبيهات قبل التقديم" : "Pre-filing Warnings"}
              </span>
            </div>
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {w.type === "error" && <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                  {w.type === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />}
                  {w.type === "info" && <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                  <span className={w.type === "error" ? "text-destructive" : "text-yellow-800"}>
                    {isRTL ? w.messageAr : w.messageEn}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VAT Return Report */}
      {fetched && vatData && (
        <div ref={reportRef} className="space-y-4">
          {/* Printable Header */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="vat-header text-center border-b-2 border-foreground pb-4">
                <h2 className="text-lg font-bold text-foreground">إقرار ضريبة القيمة المضافة</h2>
                <p className="text-xs text-muted-foreground">VAT Return Declaration</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedQuarter.labelAr} {year} ({dateFrom} — {dateTo})
                </p>
              </div>

              {/* Company Info */}
              {tenant && (
                <div className="company-block flex flex-wrap gap-6 p-3 rounded-lg bg-muted/50 text-sm">
                  <div>
                    <span className="text-muted-foreground">اسم المنشأة: </span>
                    <strong>{tenant.name}</strong>
                    {tenant.name_en && <span className="text-muted-foreground"> ({tenant.name_en})</span>}
                  </div>
                  <div>
                    <span className="text-muted-foreground">الرقم الضريبي: </span>
                    <strong className="font-english">{tenant.vat_number || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">السجل التجاري: </span>
                    <strong className="font-english">{tenant.cr_number || "—"}</strong>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg p-4 text-center bg-blue-50 border border-blue-100">
                  <p className="text-xs text-muted-foreground mb-1">
                    {isRTL ? "ضريبة المخرجات (المبيعات)" : "Output VAT (Sales)"}
                  </p>
                  <p className="text-lg font-bold font-english text-blue-700">{fmt(vatData.totalOutputVat)} ر.س</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{vatData.totalInvoices} {isRTL ? "فاتورة" : "invoices"}</p>
                </div>
                <div className="rounded-lg p-4 text-center bg-green-50 border border-green-100">
                  <p className="text-xs text-muted-foreground mb-1">
                    {isRTL ? "ضريبة المدخلات (المشتريات)" : "Input VAT (Purchases)"}
                  </p>
                  <p className="text-lg font-bold font-english text-green-700">{fmt(vatData.totalInputVat)} ر.س</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {vatData.totalExpenses + vatData.totalPurchaseOrders} {isRTL ? "عملية" : "transactions"}
                  </p>
                </div>
                <div className={`rounded-lg p-4 text-center border ${vatData.netVat >= 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {isRTL ? "صافي الضريبة المستحقة" : "Net VAT Payable"}
                  </p>
                  <p className={`text-lg font-bold font-english ${vatData.netVat >= 0 ? "text-destructive" : "text-emerald-700"}`}>
                    {fmt(Math.abs(vatData.netVat))} ر.س
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {vatData.netVat >= 0
                      ? (isRTL ? "مستحق الدفع" : "Payable")
                      : (isRTL ? "قابل للاسترداد" : "Refundable")}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Detailed Breakdown Table */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5">
                      <TableHead className="text-right font-semibold w-10">#</TableHead>
                      <TableHead className="text-right font-semibold">البند</TableHead>
                      <TableHead className="text-right font-semibold">المبلغ (ر.س)</TableHead>
                      <TableHead className="text-right font-semibold">تعديل (ر.س)</TableHead>
                      <TableHead className="text-right font-semibold">الضريبة (ر.س)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Sales Section */}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={5} className="font-bold text-sm">
                        {isRTL ? "المبيعات (ضريبة المخرجات)" : "Sales (Output VAT)"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">1</TableCell>
                      <TableCell>المبيعات الخاضعة للنسبة الأساسية (15%)</TableCell>
                      <TableCell className="font-english">{fmt(vatData.standardRatedSales)}</TableCell>
                      <TableCell className="font-english text-muted-foreground">0.00</TableCell>
                      <TableCell className="font-english font-semibold">{fmt(vatData.standardRatedSalesVat)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">2</TableCell>
                      <TableCell>المبيعات الخاضعة لنسبة صفر</TableCell>
                      <TableCell className="font-english">{fmt(vatData.zeroRatedSales)}</TableCell>
                      <TableCell className="font-english text-muted-foreground">0.00</TableCell>
                      <TableCell className="font-english">0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">3</TableCell>
                      <TableCell>المبيعات المعفاة</TableCell>
                      <TableCell className="font-english">{fmt(vatData.exemptSales)}</TableCell>
                      <TableCell className="font-english text-muted-foreground">0.00</TableCell>
                      <TableCell className="font-english">0.00</TableCell>
                    </TableRow>
                    <TableRow className="bg-blue-50/50 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>إجمالي ضريبة المخرجات</TableCell>
                      <TableCell className="font-english">{fmt(vatData.standardRatedSales + vatData.zeroRatedSales + vatData.exemptSales)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-english text-blue-700">{fmt(vatData.totalOutputVat)}</TableCell>
                    </TableRow>

                    {/* Purchases Section */}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={5} className="font-bold text-sm">
                        {isRTL ? "المشتريات (ضريبة المدخلات)" : "Purchases (Input VAT)"}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">5</TableCell>
                      <TableCell>المشتريات الخاضعة للنسبة الأساسية (15%)</TableCell>
                      <TableCell className="font-english">{fmt(vatData.standardRatedPurchases)}</TableCell>
                      <TableCell className="font-english text-muted-foreground">0.00</TableCell>
                      <TableCell className="font-english font-semibold">{fmt(vatData.standardRatedPurchasesVat)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">6</TableCell>
                      <TableCell>المشتريات الخاضعة لنسبة صفر</TableCell>
                      <TableCell className="font-english">{fmt(vatData.zeroRatedPurchases)}</TableCell>
                      <TableCell className="font-english text-muted-foreground">0.00</TableCell>
                      <TableCell className="font-english">0.00</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">7</TableCell>
                      <TableCell>المشتريات المعفاة</TableCell>
                      <TableCell className="font-english">{fmt(vatData.exemptPurchases)}</TableCell>
                      <TableCell className="font-english text-muted-foreground">0.00</TableCell>
                      <TableCell className="font-english">0.00</TableCell>
                    </TableRow>
                    <TableRow className="bg-green-50/50 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>إجمالي ضريبة المدخلات</TableCell>
                      <TableCell className="font-english">{fmt(vatData.standardRatedPurchases + vatData.zeroRatedPurchases + vatData.exemptPurchases)}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-english text-green-700">{fmt(vatData.totalInputVat)}</TableCell>
                    </TableRow>

                    {/* Net */}
                    <TableRow className="bg-foreground text-background font-bold text-base">
                      <TableCell></TableCell>
                      <TableCell colSpan={3}>صافي الضريبة المستحقة / (القابلة للاسترداد)</TableCell>
                      <TableCell className={`font-english text-lg ${vatData.netVat >= 0 ? "" : ""}`}>
                        {vatData.netVat >= 0 ? "" : "("}{fmt(Math.abs(vatData.netVat))}{vatData.netVat < 0 ? ")" : ""} ر.س
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* ZATCA Note */}
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-800">
                <strong>ملاحظة هامة:</strong> هذا الإقرار الضريبي مُعدّ وفقاً لنموذج هيئة الزكاة والضريبة والجمارك (ZATCA).
                البيانات محسوبة تلقائياً من الفواتير والمصروفات وأوامر الشراء المسجلة في النظام.
                يُرجى مراجعة جميع الأرقام والتأكد من صحتها قبل تقديم الإقرار الرسمي عبر بوابة الهيئة.
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground border-t pt-3 mt-4">
                تم إنشاء هذا الإقرار بتاريخ {new Date().toLocaleDateString("ar-SA")} — {tenant?.name || ""}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!fetched && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-14 w-14 mx-auto mb-4 opacity-15" />
          <p className="text-sm">{isRTL ? "اختر الفترة الضريبية ثم اضغط 'إنشاء الإقرار'" : "Select the tax period and click 'Generate Return'"}</p>
          <p className="text-xs mt-1 text-muted-foreground/60">
            {isRTL ? "يتم حساب الضريبة تلقائياً من الفواتير والمصروفات وأوامر الشراء" : "VAT is auto-calculated from invoices, expenses, and purchase orders"}
          </p>
        </div>
      )}
    </div>
  );
};

export default VatReturnGenerator;
