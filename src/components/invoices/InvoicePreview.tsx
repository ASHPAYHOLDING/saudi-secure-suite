import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateAr, formatNumber } from "@/lib/invoice-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";

interface InvoicePreviewProps {
  onBack: () => void;
}

// Demo company & invoice data
const company = {
  name: "شركة التقنية المتقدمة",
  cr_number: "1010234567",
  vat_number: "310123456700003",
  address: "الرياض، حي العليا، شارع الأمير محمد بن عبدالعزيز",
  phone: "011-1234567",
  email: "info@advtech.sa",
};

const customer = {
  name: "شركة النور للتجارة",
  vat_number: "310987654300003",
  cr_number: "1010876543",
  address: "جدة، حي الروضة، شارع فلسطين",
  phone: "012-7654321",
};

const invoiceData = {
  invoice_number: "INV-202602-0001",
  invoice_type: "فاتورة ضريبية",
  invoice_date: "2026-02-10",
  supply_date: "2026-02-10",
  due_date: "2026-03-12",
  items: [
    { id: "1", description: "استشارات تقنية — تطوير نظام إدارة المحتوى", quantity: 40, unit: "ساعة", unit_price: 200, discount: 0, vat_rate: 15, vat_amount: 1200, line_total: 9200 },
    { id: "2", description: "استضافة سحابية — باقة الأعمال الشهرية", quantity: 1, unit: "شهر", unit_price: 1500, discount: 0, vat_rate: 15, vat_amount: 225, line_total: 1725 },
    { id: "3", description: "تصميم واجهة المستخدم — صفحات إضافية", quantity: 5, unit: "صفحة", unit_price: 500, discount: 500, vat_rate: 15, vat_amount: 337.5, line_total: 2337.5 },
  ],
  subtotal: 10500,
  discount_total: 500,
  vat_total: 1500,
  grand_total: 11500,
  notes: "الدفع خلال 30 يوماً من تاريخ الفاتورة. شكراً لتعاملكم معنا.",
};

const InvoicePreview = ({ onBack }: InvoicePreviewProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة ${invoiceData.invoice_number}</title>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #1a1a2e; background: white; }
          @page { size: A4; margin: 15mm; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          ${content.querySelector('style')?.textContent || ''}
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div dir="rtl" className="space-y-4 p-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowRight size={18} />
          العودة للقائمة
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer size={16} />
            طباعة
          </Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handlePrint}>
            <Download size={16} />
            تصدير PDF
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-[210mm]"
      >
        <div
          ref={printRef}
          className="rounded-xl border border-border bg-card shadow-elevated overflow-hidden"
        >
          <style>{`
            .inv-table { width: 100%; border-collapse: collapse; }
            .inv-table th, .inv-table td { padding: 10px 14px; text-align: right; font-size: 13px; }
            .inv-table th { background: hsl(220 30% 14%); color: white; font-weight: 600; font-size: 12px; }
            .inv-table td { border-bottom: 1px solid hsl(214 18% 92%); }
            .inv-table tbody tr:last-child td { border-bottom: none; }
            .inv-table .num { font-family: 'IBM Plex Sans Arabic', monospace; direction: ltr; text-align: left; }
            .summary-row td { padding: 6px 14px; font-size: 13px; }
            .total-row td { background: hsl(220 30% 14%); color: white; font-weight: 700; font-size: 15px; padding: 12px 14px; }
          `}</style>

          {/* Header */}
          <div className="bg-primary p-8" style={{ background: 'hsl(220 30% 14%)' }}>
            <div className="flex items-start justify-between">
              {/* Company Info */}
              <div className="text-primary-foreground">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'hsl(172 66% 36%)' }}>
                    <span className="text-lg font-bold text-white font-english">S</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">{company.name}</h1>
                    <p className="text-xs opacity-70 font-english">Advanced Technology Co.</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs opacity-80 mt-4">
                  <p>السجل التجاري: <span className="font-english">{company.cr_number}</span></p>
                  <p>الرقم الضريبي: <span className="font-english">{company.vat_number}</span></p>
                  <p>{company.address}</p>
                  <p>هاتف: <span className="font-english" dir="ltr">{company.phone}</span> | بريد: <span className="font-english">{company.email}</span></p>
                </div>
              </div>

              {/* Invoice Title */}
              <div className="text-left">
                <h2 className="text-2xl font-bold text-white mb-1">{invoiceData.invoice_type}</h2>
                <p className="text-sm font-english opacity-70">Tax Invoice</p>
                <div className="mt-4 rounded-lg px-4 py-2" style={{ background: 'hsl(172 66% 36% / 0.2)' }}>
                  <p className="text-xs opacity-70">رقم الفاتورة</p>
                  <p className="text-lg font-bold font-english text-white">{invoiceData.invoice_number}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dates & Customer */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Customer */}
              <div className="rounded-xl border border-border p-5 bg-secondary/20">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">بيانات العميل</h3>
                <p className="font-bold text-foreground text-base mb-2">{customer.name}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p>الرقم الضريبي: <span className="font-english text-foreground">{customer.vat_number}</span></p>
                  <p>السجل التجاري: <span className="font-english text-foreground">{customer.cr_number}</span></p>
                  <p>{customer.address}</p>
                  <p>هاتف: <span className="font-english" dir="ltr">{customer.phone}</span></p>
                </div>
              </div>

              {/* Dates */}
              <div className="rounded-xl border border-border p-5 bg-secondary/20">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">تفاصيل الفاتورة</h3>
                <div className="space-y-3">
                  {[
                    { label: "تاريخ الإصدار", value: formatDateAr(invoiceData.invoice_date) },
                    { label: "تاريخ التوريد", value: formatDateAr(invoiceData.supply_date) },
                    { label: "تاريخ الاستحقاق", value: formatDateAr(invoiceData.due_date) },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{d.label}</span>
                      <span className="text-sm font-medium text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="inv-table" dir="rtl">
              <thead>
                <tr>
                  <th style={{ width: "5%", textAlign: "center" }}>#</th>
                  <th style={{ width: "35%" }}>الوصف</th>
                  <th style={{ width: "8%", textAlign: "center" }}>الكمية</th>
                  <th style={{ width: "8%", textAlign: "center" }}>الوحدة</th>
                  <th style={{ width: "12%" }} className="num">سعر الوحدة</th>
                  <th style={{ width: "10%" }} className="num">الخصم</th>
                  <th style={{ width: "8%", textAlign: "center" }}>الضريبة</th>
                  <th style={{ width: "14%" }} className="num">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center" }} className="text-muted-foreground">{formatNumber(i + 1)}</td>
                    <td className="text-foreground font-medium">{item.description}</td>
                    <td style={{ textAlign: "center" }} className="font-english">{formatNumber(item.quantity)}</td>
                    <td style={{ textAlign: "center" }}>{item.unit}</td>
                    <td className="num font-english">{formatCurrency(item.unit_price)}</td>
                    <td className="num font-english">{formatCurrency(item.discount)}</td>
                    <td style={{ textAlign: "center" }} className="font-english">{formatNumber(item.vat_rate)}٪</td>
                    <td className="num font-english font-semibold">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-0 flex justify-start">
              <table className="inv-table" style={{ width: "40%", minWidth: "280px" }}>
                <tbody>
                  <tr className="summary-row">
                    <td className="text-muted-foreground">المجموع الفرعي</td>
                    <td className="num font-english text-foreground">{formatCurrency(invoiceData.subtotal)} ر.س</td>
                  </tr>
                  {invoiceData.discount_total > 0 && (
                    <tr className="summary-row">
                      <td className="text-muted-foreground">الخصم</td>
                      <td className="num font-english text-destructive">- {formatCurrency(invoiceData.discount_total)} ر.س</td>
                    </tr>
                  )}
                  <tr className="summary-row">
                    <td className="text-muted-foreground">ضريبة القيمة المضافة (١٥٪)</td>
                    <td className="num font-english text-foreground">{formatCurrency(invoiceData.vat_total)} ر.س</td>
                  </tr>
                  <tr className="total-row">
                    <td>الإجمالي المستحق</td>
                    <td className="num font-english">{formatCurrency(invoiceData.grand_total)} ر.س</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* QR Code, Notes & Stamp */}
            <div className="mt-8 grid grid-cols-3 gap-6">
              {/* QR Code */}
              <div className="flex items-start gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30 shrink-0">
                  <QrCode size={40} className="text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">رمز الاستجابة السريع</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    متوافق مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA) — المرحلة الثانية
                  </p>
                </div>
              </div>

              {/* Notes */}
              {invoiceData.notes && (
                <div className="rounded-lg border border-border p-4 bg-secondary/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{invoiceData.notes}</p>
                </div>
              )}

              {/* Digital Stamp */}
              <div className="flex justify-center items-start">
                <DigitalStamp
                  stamp={{
                    companyName: company.name,
                    crNumber: company.cr_number,
                    vatNumber: company.vat_number,
                    enabled: true,
                  }}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-8 py-4" style={{ background: 'hsl(210 20% 97%)' }}>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <p>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع أو ختم</p>
              <p className="font-english">Generated by SaaS Plus — {invoiceData.invoice_number}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePreview;
