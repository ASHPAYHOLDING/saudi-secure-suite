import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateAr, formatNumber } from "@/lib/invoice-utils";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";
import ZatcaQRCode from "@/components/invoices/ZatcaQRCode";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface InvoicePreviewProps {
  invoiceId?: string | null;
  onBack: () => void;
}

const InvoicePreview = ({ invoiceId, onBack }: InvoicePreviewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      if (!invoiceId || !tenantId) { setLoading(false); return; }

      const [invRes, itemsRes, tenantRes] = await Promise.all([
        supabase.from("invoices").select("*, customers(name, vat_number, cr_number, address_street, phone)").eq("id", invoiceId).single(),
        supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
        supabase.from("tenants").select("name, cr_number, vat_number, address_street, phone, email").eq("id", tenantId).single(),
      ]);

      if (invRes.data) {
        setInvoice(invRes.data);
        setCustomer(invRes.data.customers);
      }
      if (itemsRes.data) setItems(itemsRes.data);
      if (tenantRes.data) setCompany(tenantRes.data);
      setLoading(false);
    };
    load();
  }, [invoiceId, tenantId]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    printDocument(content, {
      title: `فاتورة ${invoice?.invoice_number || ""}`,
      extraStyles: INVOICE_PRINT_STYLES,
      brandFont: branding.font,
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (!invoice || !company) {
    return (
      <div dir="rtl" className="p-6">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground mb-4"><ArrowRight size={18} />العودة</Button>
        <p className="text-center text-muted-foreground py-16">لم يتم العثور على الفاتورة</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة للقائمة</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} />طباعة</Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handlePrint}><Download size={16} />تصدير PDF</Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[210mm]">
        <div ref={printRef} className="rounded-xl border border-border bg-card shadow-elevated overflow-hidden">
          <style>{`
            .inv-table { width: 100%; border-collapse: collapse; }
            .inv-table th, .inv-table td { padding: 10px 14px; text-align: right; font-size: 13px; }
            .inv-table th { background: ${branding.primaryColor}; color: white; font-weight: 600; font-size: 12px; }
            .inv-table td { border-bottom: 1px solid #e5e7eb; }
            .inv-table tbody tr:last-child td { border-bottom: none; }
            .inv-table .num { font-family: 'Inter', monospace; direction: ltr; text-align: left; }
            .summary-row td { padding: 6px 14px; font-size: 13px; }
            .total-row td { background: ${branding.primaryColor}; color: white; font-weight: 700; font-size: 15px; padding: 12px 14px; }
          `}</style>

          {/* Header */}
          <div className="bg-primary p-8" style={{ background: branding.primaryColor, fontFamily: `'${branding.font}', sans-serif` }}>
            <div className="flex items-start justify-between">
              <div style={{ color: 'white' }}>
                <div className="flex items-center gap-3 mb-3">
                  {branding.logoUrl ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 p-1.5"><img src={branding.logoUrl} alt="" className="max-h-full max-w-full object-contain" /></div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: branding.secondaryColor }}><span className="text-lg font-bold text-white font-english">S</span></div>
                  )}
                  <div>
                    <h1 className="text-xl font-bold">{company.name}</h1>
                  </div>
                </div>
                <div className="space-y-1 text-xs opacity-80 mt-4">
                  {company.cr_number && <p>السجل التجاري: <span className="font-english">{company.cr_number}</span></p>}
                  {company.vat_number && <p>الرقم الضريبي: <span className="font-english">{company.vat_number}</span></p>}
                  {company.address_street && <p>{company.address_street}</p>}
                  <p>
                    {company.phone && <>هاتف: <span className="font-english" dir="ltr">{company.phone}</span></>}
                    {company.email && <> | بريد: <span className="font-english">{company.email}</span></>}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-bold text-white mb-1">فاتورة ضريبية</h2>
                <p className="text-sm font-english opacity-70">Tax Invoice</p>
                <div className="mt-4 rounded-lg px-4 py-2" style={{ background: `${branding.secondaryColor}33` }}>
                  <p className="text-xs opacity-70">رقم الفاتورة</p>
                  <p className="text-lg font-bold font-english text-white">{invoice.invoice_number}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="rounded-xl border border-border p-5 bg-secondary/20">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">بيانات العميل</h3>
                <p className="font-bold text-foreground text-base mb-2">{customer?.name || "—"}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {customer?.vat_number && <p>الرقم الضريبي: <span className="font-english text-foreground">{customer.vat_number}</span></p>}
                  {customer?.cr_number && <p>السجل التجاري: <span className="font-english text-foreground">{customer.cr_number}</span></p>}
                  {customer?.address_street && <p>{customer.address_street}</p>}
                  {customer?.phone && <p>هاتف: <span className="font-english" dir="ltr">{customer.phone}</span></p>}
                </div>
              </div>
              <div className="rounded-xl border border-border p-5 bg-secondary/20">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">تفاصيل الفاتورة</h3>
                <div className="space-y-3">
                  {[
                    { label: "تاريخ الإصدار", value: formatDateAr(invoice.invoice_date) },
                    { label: "تاريخ التوريد", value: formatDateAr(invoice.supply_date) },
                    { label: "تاريخ الاستحقاق", value: formatDateAr(invoice.due_date) },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{d.label}</span>
                      <span className="text-sm font-medium text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Items */}
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
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: "center" }} className="text-muted-foreground">{formatNumber(i + 1)}</td>
                    <td className="text-foreground font-medium">{item.description}</td>
                    <td style={{ textAlign: "center" }} className="font-english">{formatNumber(item.quantity)}</td>
                    <td style={{ textAlign: "center" }}>{item.unit || "وحدة"}</td>
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
                  <tr className="summary-row"><td className="text-muted-foreground">المجموع الفرعي</td><td className="num font-english text-foreground">{formatCurrency(invoice.subtotal)} ر.س</td></tr>
                  {invoice.discount_total > 0 && <tr className="summary-row"><td className="text-muted-foreground">الخصم</td><td className="num font-english text-destructive">- {formatCurrency(invoice.discount_total)} ر.س</td></tr>}
                  <tr className="summary-row"><td className="text-muted-foreground">ضريبة القيمة المضافة</td><td className="num font-english text-foreground">{formatCurrency(invoice.vat_total)} ر.س</td></tr>
                  <tr className="total-row"><td>الإجمالي المستحق</td><td className="num font-english">{formatCurrency(invoice.grand_total)} ر.س</td></tr>
                </tbody>
              </table>
            </div>

            {/* QR, Notes, Stamp */}
            <div className="mt-8 grid grid-cols-3 gap-6">
              <div className="flex items-start gap-4">
                <ZatcaQRCode
                  sellerName={company.name}
                  vatNumber={company.vat_number || ""}
                  timestamp={new Date(invoice.invoice_date).toISOString()}
                  invoiceTotal={invoice.grand_total}
                  vatTotal={invoice.vat_total}
                  size={96}
                />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">رمز الاستجابة السريع</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">متوافق مع ZATCA — تشفير TLV</p>
                </div>
              </div>
              {invoice.notes && (
                <div className="rounded-lg border border-border p-4 bg-secondary/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{invoice.notes}</p>
                </div>
              )}
              <div className="flex justify-center items-start">
                <DigitalStamp stamp={{ companyName: company.name, crNumber: company.cr_number || "", vatNumber: company.vat_number || "", enabled: true }} size="md" />
              </div>
            </div>
          </div>

          <div className="border-t border-border px-8 py-4" style={{ background: 'hsl(210 20% 97%)' }}>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <p>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع أو ختم</p>
              <p className="font-english">Generated by Numaxio — {invoice.invoice_number}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePreview;
