import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateAr, formatNumber } from "@/lib/invoice-utils";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";
import ZatcaQRCode from "@/components/invoices/ZatcaQRCode";
import ZatcaPhase2Status from "@/components/invoices/ZatcaPhase2Status";
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

  const loadInvoice = useCallback(async () => {
    if (!invoiceId || !tenantId) { setLoading(false); return; }

    const [invRes, itemsRes, tenantRes] = await Promise.all([
      supabase.from("invoices").select("*, customers(name, name_en, vat_number, cr_number, address_street, address_city, phone, email)").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
      supabase.from("tenants").select("name, name_en, cr_number, vat_number, address_street, address_city, phone, email, logo_url, zatca_phase2_ready, stamp_enabled, stamp_company_name, stamp_cr_number, stamp_vat_number, stamp_image_url").eq("id", tenantId).single(),
    ]);

    if (invRes.data) {
      setInvoice(invRes.data);
      setCustomer(invRes.data.customers);
    }
    if (itemsRes.data) setItems(itemsRes.data);
    if (tenantRes.data) setCompany(tenantRes.data);
    setLoading(false);
  }, [invoiceId, tenantId]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    printDocument(content, {
      title: `فاتورة ضريبية - ${invoice?.invoice_number || ""}`,
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

  const primaryColor = branding.primaryColor || '#1a1f36';
  const secondaryColor = branding.secondaryColor || '#1a9b8a';

  return (
    <div dir="rtl" className="space-y-4 p-4 sm:p-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة للقائمة</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} />طباعة</Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handlePrint}><Download size={16} />تصدير PDF</Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[210mm]">
        <div ref={printRef} className="rounded-xl border border-border bg-white shadow-elevated overflow-hidden" style={{ fontFamily: `'${branding.font || 'IBM Plex Sans Arabic'}', sans-serif` }}>
          
          {/* ===== HEADER SECTION ===== */}
          <div style={{ background: primaryColor }} className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              {/* Company Info - Right */}
              <div style={{ color: 'white' }} className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  {company.logo_url ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 p-1.5 shrink-0">
                      <img src={company.logo_url} alt={company.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl shrink-0" style={{ background: secondaryColor }}>
                      <span className="text-xl font-bold text-white">{company.name?.charAt(0) || 'ن'}</span>
                    </div>
                  )}
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold leading-tight">{company.name}</h1>
                    {company.name_en && <p className="text-xs font-english opacity-70 mt-0.5">{company.name_en}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs opacity-85 mt-2">
                  {company.cr_number && (
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">السجل التجاري:</span>
                      <span className="font-english font-medium" dir="ltr">{company.cr_number}</span>
                    </div>
                  )}
                  {company.vat_number && (
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">الرقم الضريبي:</span>
                      <span className="font-english font-medium" dir="ltr">{company.vat_number}</span>
                    </div>
                  )}
                  {(company.address_street || company.address_city) && (
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">العنوان:</span>
                      <span>{[company.address_street, company.address_city].filter(Boolean).join('، ')}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">هاتف:</span>
                      <span className="font-english" dir="ltr">{company.phone}</span>
                    </div>
                  )}
                  {company.email && (
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">البريد:</span>
                      <span className="font-english" dir="ltr">{company.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Badge - Left */}
              <div className="text-left shrink-0">
                <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-0.5">فاتورة ضريبية</h2>
                  <p className="text-[11px] font-english opacity-60 mb-3">Tax Invoice</p>
                  <div className="border-t border-white/20 pt-3">
                    <p className="text-[10px] opacity-60 mb-0.5">رقم الفاتورة</p>
                    <p className="text-lg font-bold font-english text-white tracking-wide">{invoice.invoice_number}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== DATES & CUSTOMER ===== */}
          <div className="p-6 sm:p-8">
            {/* Date Strip */}
            <div className="grid grid-cols-3 gap-3 mb-6 rounded-xl overflow-hidden border border-border">
              {[
                { label: "تاريخ الإصدار", value: formatDateAr(invoice.invoice_date) },
                { label: "تاريخ التوريد", value: formatDateAr(invoice.supply_date) },
                { label: "تاريخ الاستحقاق", value: formatDateAr(invoice.due_date) },
              ].map((d, i) => (
                <div key={d.label} className={`p-3 sm:p-4 text-center ${i < 2 ? 'border-l border-border' : ''}`} style={{ background: 'hsl(210 20% 97%)' }}>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{d.label}</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">{d.value}</p>
                </div>
              ))}
            </div>

            {/* Customer Details */}
            <div className="rounded-xl border border-border p-4 sm:p-5 mb-6" style={{ background: 'hsl(210 20% 97%)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full" style={{ background: secondaryColor }}></div>
                <h3 className="text-xs font-bold text-muted-foreground tracking-wider">بيانات العميل | Customer Details</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                <div>
                  <p className="font-bold text-foreground text-base">{customer?.name || "—"}</p>
                  {customer?.name_en && <p className="text-xs font-english text-muted-foreground">{customer.name_en}</p>}
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {customer?.vat_number && (
                    <div className="flex items-center gap-2">
                      <span>الرقم الضريبي:</span>
                      <span className="font-english font-medium text-foreground" dir="ltr">{customer.vat_number}</span>
                    </div>
                  )}
                  {customer?.cr_number && (
                    <div className="flex items-center gap-2">
                      <span>السجل التجاري:</span>
                      <span className="font-english font-medium text-foreground" dir="ltr">{customer.cr_number}</span>
                    </div>
                  )}
                  {customer?.address_street && <p>{customer.address_street}</p>}
                  {customer?.phone && (
                    <div className="flex items-center gap-2">
                      <span>هاتف:</span>
                      <span className="font-english" dir="ltr">{customer.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ===== ITEMS TABLE ===== */}
            <div className="rounded-xl border border-border overflow-hidden mb-6">
              <table className="inv-table" dir="rtl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: "5%", textAlign: "center", padding: '12px 10px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600 }}>#</th>
                    <th style={{ width: "33%", textAlign: "right", padding: '12px 14px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600 }}>الوصف</th>
                    <th style={{ width: "8%", textAlign: "center", padding: '12px 10px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600 }}>الكمية</th>
                    <th style={{ width: "8%", textAlign: "center", padding: '12px 10px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600 }}>الوحدة</th>
                    <th style={{ width: "13%", textAlign: "left", padding: '12px 14px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600, fontFamily: "'Inter', sans-serif", direction: 'ltr' as const }}>سعر الوحدة</th>
                    <th style={{ width: "10%", textAlign: "left", padding: '12px 14px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600, fontFamily: "'Inter', sans-serif", direction: 'ltr' as const }}>الخصم</th>
                    <th style={{ width: "8%", textAlign: "center", padding: '12px 10px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600 }}>الضريبة</th>
                    <th style={{ width: "15%", textAlign: "left", padding: '12px 14px', background: primaryColor, color: 'white', fontSize: '11px', fontWeight: 600, fontFamily: "'Inter', sans-serif", direction: 'ltr' as const }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid #e5e7eb' : 'none', background: i % 2 === 1 ? 'hsl(210 20% 98%)' : 'white' }}>
                      <td style={{ textAlign: 'center', padding: '11px 10px', fontSize: '12px', color: '#6b7280' }}>{formatNumber(i + 1)}</td>
                      <td style={{ textAlign: 'right', padding: '11px 14px', fontSize: '13px', fontWeight: 500, color: '#1a1a2e' }}>{item.description}</td>
                      <td style={{ textAlign: 'center', padding: '11px 10px', fontSize: '12px', fontFamily: "'Inter', sans-serif" }}>{formatNumber(item.quantity)}</td>
                      <td style={{ textAlign: 'center', padding: '11px 10px', fontSize: '11px', color: '#6b7280' }}>{item.unit || "وحدة"}</td>
                      <td style={{ textAlign: 'left', padding: '11px 14px', fontSize: '12px', fontFamily: "'Inter', sans-serif", direction: 'ltr' as const }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ textAlign: 'left', padding: '11px 14px', fontSize: '12px', fontFamily: "'Inter', sans-serif", direction: 'ltr' as const, color: item.discount > 0 ? '#dc2626' : '#9ca3af' }}>{item.discount > 0 ? formatCurrency(item.discount) : '—'}</td>
                      <td style={{ textAlign: 'center', padding: '11px 10px', fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>{formatNumber(item.vat_rate)}٪</td>
                      <td style={{ textAlign: 'left', padding: '11px 14px', fontSize: '13px', fontFamily: "'Inter', sans-serif", fontWeight: 600, direction: 'ltr' as const, color: '#1a1a2e' }}>{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== TOTALS ===== */}
            <div className="flex justify-start mb-8">
              <div className="w-full sm:w-[340px] rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
                    <span className="text-xs text-muted-foreground">المجموع الفرعي</span>
                    <span className="text-sm font-english font-medium text-foreground" dir="ltr">{formatCurrency(invoice.subtotal)} ر.س</span>
                  </div>
                  {invoice.discount_total > 0 && (
                    <div className="flex items-center justify-between px-5 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
                      <span className="text-xs text-muted-foreground">إجمالي الخصم</span>
                      <span className="text-sm font-english font-medium text-destructive" dir="ltr">- {formatCurrency(invoice.discount_total)} ر.س</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
                    <span className="text-xs text-muted-foreground">ضريبة القيمة المضافة (١٥٪)</span>
                    <span className="text-sm font-english font-medium text-foreground" dir="ltr">{formatCurrency(invoice.vat_total)} ر.س</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4" style={{ background: primaryColor }}>
                    <span className="text-sm font-bold text-white">الإجمالي المستحق</span>
                    <span className="text-lg font-bold font-english text-white" dir="ltr">{formatCurrency(invoice.grand_total)} ر.س</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== FOOTER: QR + Notes + Stamp ===== */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
              {/* ZATCA QR Code */}
              <div className="flex items-start gap-3">
                <ZatcaQRCode
                  sellerName={company.name}
                  vatNumber={company.vat_number || ""}
                  timestamp={new Date(invoice.invoice_date).toISOString()}
                  invoiceTotal={invoice.grand_total}
                  vatTotal={invoice.vat_total}
                  size={100}
                />
                <div className="pt-1">
                  <p className="text-[10px] font-bold text-muted-foreground mb-1">رمز الاستجابة السريع</p>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">متوافق مع متطلبات هيئة الزكاة والضريبة والجمارك</p>
                  <p className="text-[9px] font-english text-muted-foreground mt-0.5">ZATCA Phase 1 — TLV Encoded</p>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="rounded-lg border border-border p-4" style={{ background: 'hsl(210 20% 97%)' }}>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1.5">ملاحظات</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{invoice.notes}</p>
                </div>
              )}

              {/* Digital Stamp */}
              <div className="flex justify-center sm:justify-end items-start">
                <DigitalStamp stamp={{
                  companyName: company.stamp_company_name || company.name,
                  crNumber: company.stamp_cr_number || company.cr_number || "",
                  vatNumber: company.stamp_vat_number || company.vat_number || "",
                  imageUrl: company.stamp_image_url || undefined,
                  enabled: !!company.stamp_enabled,
                }} size="md" />
              </div>
            </div>
          </div>

          {/* ===== ZATCA Phase 2 Status ===== */}
          {company?.zatca_phase2_ready && (
            <div className="px-6 sm:px-8 pb-4">
              <ZatcaPhase2Status invoice={invoice} onUpdate={loadInvoice} />
            </div>
          )}

          {/* ===== DOCUMENT FOOTER ===== */}
          <div className="border-t border-border px-6 sm:px-8 py-3" style={{ background: 'hsl(210 20% 97%)' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] text-muted-foreground">
              <p>هذه الفاتورة صادرة إلكترونياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك — لا تحتاج إلى توقيع أو ختم</p>
              <p className="font-english">Powered by Numaxio — {invoice.invoice_number}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePreview;
