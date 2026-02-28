import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, Loader2, Palette, Send, Banknote, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDateAr, formatNumber } from "@/lib/invoice-utils";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";
import ZatcaQRCode from "@/components/invoices/ZatcaQRCode";
import ZatcaPhase2Status from "@/components/invoices/ZatcaPhase2Status";
import RecordPaymentDialog from "@/components/invoices/RecordPaymentDialog";
import PaymentHistory from "@/components/invoices/PaymentHistory";
import PaymentGatewayPanel from "@/components/payments/PaymentGatewayPanel";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { InvoiceTemplate, ColumnConfig } from "@/lib/invoice-template-types";
import { defaultColumns } from "@/lib/invoice-template-types";
import InvoiceDeliveryDialog from "@/components/invoices/InvoiceDeliveryDialog";

interface InvoicePreviewProps {
  invoiceId?: string | null;
  onBack: () => void;
}

/* ── Stripe-inspired design tokens ── */
const T = {
  navy: '#0f172a',
  text: '#1e293b',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  border: 'rgba(15, 23, 42, 0.08)',
  borderMedium: 'rgba(15, 23, 42, 0.12)',
  surface: '#f8fafc',
  surfaceAlt: 'rgba(15, 23, 42, 0.02)',
  red: '#ef4444',
  white: '#ffffff',
} as const;

const InvoicePreview = ({ invoiceId, onBack }: InvoicePreviewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<InvoiceTemplate | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [gatewayOpen, setGatewayOpen] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!invoiceId || !tenantId) { setLoading(false); return; }
    const [invRes, itemsRes, tenantRes, templatesRes] = await Promise.all([
      supabase.from("invoices").select("*, customers(name, name_en, vat_number, cr_number, address_street, address_city, phone, email)").eq("id", invoiceId).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId).order("sort_order"),
      supabase.from("tenants").select("name, name_en, cr_number, vat_number, address_street, address_city, phone, email, logo_url, zatca_phase2_ready, stamp_enabled, stamp_company_name, stamp_cr_number, stamp_vat_number, stamp_image_url").eq("id", tenantId).single(),
      supabase.from("invoice_templates").select("*").eq("tenant_id", tenantId).order("created_at"),
    ]);
    if (invRes.data) { setInvoice(invRes.data); setCustomer(invRes.data.customers); }
    if (itemsRes.data) setItems(itemsRes.data);
    if (tenantRes.data) setCompany(tenantRes.data);
    if (templatesRes.data && templatesRes.data.length > 0) {
      const tpls = templatesRes.data as unknown as InvoiceTemplate[];
      setTemplates(tpls);
      setActiveTemplate(tpls.find(t => t.is_default) || tpls[0]);
    }
    setLoading(false);
  }, [invoiceId, tenantId]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  const tpl = activeTemplate;
  const fontFamily = tpl?.font_family || branding.font || 'IBM Plex Sans Arabic';
  const showLogo = tpl?.show_logo ?? true;
  const showStamp = tpl?.show_stamp ?? true;
  const showQR = tpl?.show_qr_code ?? true;
  const showNotes = tpl?.show_notes ?? true;
  const footerText = tpl?.footer_text || null;
  const columnsConfig: ColumnConfig[] = (tpl?.columns_config as ColumnConfig[]) || defaultColumns();
  const visibleColumns = [...columnsConfig].filter(c => c.visible).sort((a, b) => a.order - b.order);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    printDocument(content, {
      title: `فاتورة ضريبية - ${invoice?.invoice_number || ""}`,
      extraStyles: INVOICE_PRINT_STYLES,
      brandFont: fontFamily,
    });
  };

  const renderCellValue = (col: ColumnConfig, item: any, index: number) => {
    switch (col.key) {
      case 'index': return formatNumber(index + 1);
      case 'description': return item.description;
      case 'quantity': return formatNumber(item.quantity);
      case 'unit': return item.unit || 'وحدة';
      case 'unit_price': return formatCurrency(item.unit_price);
      case 'discount': return item.discount > 0 ? formatCurrency(item.discount) : '—';
      case 'vat_rate': return `${formatNumber(item.vat_rate)}٪`;
      case 'line_total': return formatCurrency(item.line_total);
      default: return '';
    }
  };

  const isNumericCol = (key: string) => ['unit_price', 'discount', 'line_total'].includes(key);
  const isCenterCol = (key: string) => ['index', 'quantity', 'unit', 'vat_rate'].includes(key);

  const cellStyle = (col: ColumnConfig): React.CSSProperties => ({
    textAlign: isNumericCol(col.key) ? 'left' : isCenterCol(col.key) ? 'center' : 'right',
    padding: '9px 14px',
    fontSize: '11px',
    lineHeight: '1.6',
    fontFamily: isNumericCol(col.key) ? "'Inter', sans-serif" : undefined,
    direction: isNumericCol(col.key) ? 'ltr' : undefined,
    fontWeight: col.key === 'line_total' ? 600 : col.key === 'description' ? 500 : undefined,
    color: col.key === 'discount' ? undefined : isCenterCol(col.key) ? T.textMuted : T.text,
    fontVariantNumeric: isNumericCol(col.key) ? 'tabular-nums' : undefined,
    whiteSpace: isNumericCol(col.key) ? 'nowrap' : undefined,
  });

  const thStyle = (col: ColumnConfig): React.CSSProperties => ({
    textAlign: isNumericCol(col.key) ? 'left' : isCenterCol(col.key) ? 'center' : 'right',
    padding: '9px 14px',
    background: T.surfaceAlt,
    color: T.textMuted,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.03em',
    borderBottom: `1px solid ${T.borderMedium}`,
    fontFamily: isNumericCol(col.key) ? "'Inter', sans-serif" : undefined,
    direction: isNumericCol(col.key) ? 'ltr' : undefined,
  });

  /* ── Inline style helpers ── */
  const metaLabel: React.CSSProperties = { fontSize: '9px', color: T.textFaint, letterSpacing: '0.04em', marginBottom: '2px' };
  const metaValue: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: T.text, margin: 0 };
  const sectionLabel: React.CSSProperties = { fontSize: '9px', fontWeight: 600, color: T.textFaint, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' };
  const numFont: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontVariantNumeric: 'tabular-nums' };

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
    <div dir="rtl" className="space-y-4 p-4 sm:p-6">
      {/* ── Action Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ maxWidth: '210mm', margin: '0 auto' }}>
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة للقائمة</Button>
        <div className="flex items-center gap-2">
          {templates.length > 0 && (
            <Select value={activeTemplate?.id || ''} onValueChange={id => setActiveTemplate(templates.find(t => t.id === id) || null)}>
              <SelectTrigger className="w-40 h-9 text-xs gap-1">
                <Palette size={14} className="text-muted-foreground shrink-0" />
                <SelectValue placeholder="اختر قالب" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.primary_color }} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {invoice?.status === 'pending_approval' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              قيد الموافقة
            </span>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setDeliveryOpen(true)} disabled={invoice?.status === 'pending_approval'}><Send size={16} />إرسال</Button>
          {invoice && invoice.status !== 'paid' && invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'pending_approval' && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setPaymentDialogOpen(true)}><Banknote size={16} />تسجيل دفعة</Button>
              <Button variant="outline" className="gap-2" onClick={() => setGatewayOpen(true)}><CreditCard size={16} />بوابة دفع</Button>
            </>
          )}
          <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} />طباعة</Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handlePrint}><Download size={16} />تصدير PDF</Button>
        </div>
      </div>

      {/* ── A4 Page Container (screen preview) ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="invoice-page"
          style={{
            width: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            background: T.white,
            border: `1px solid ${T.border}`,
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            ref={printRef}
            className="invoice-content"
            dir="rtl"
            style={{
              padding: '12mm',
              maxWidth: '190mm',
              margin: '0 auto',
              fontFamily: `'${fontFamily}', sans-serif`,
              lineHeight: 1.6,
              color: T.text,
            }}
          >
            {/* ═══ HEADER ═══ */}
            <div className="break-avoid" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', paddingBottom: '16px', borderBottom: `1px solid ${T.border}` }}>
              {/* Company info — right */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  {showLogo && company.logo_url ? (
                    <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: `1px solid ${T.border}`, padding: '3px', flexShrink: 0 }}>
                      <img src={company.logo_url} alt={company.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                  ) : showLogo ? (
                    <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', background: T.navy, flexShrink: 0 }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: T.white }}>{company.name?.charAt(0) || 'ن'}</span>
                    </div>
                  ) : null}
                  <div>
                    <h1 style={{ fontSize: '15px', fontWeight: 700, color: T.navy, margin: 0, lineHeight: 1.3 }}>{company.name}</h1>
                    {company.name_en && <p style={{ fontSize: '10px', color: T.textMuted, margin: '1px 0 0', ...numFont }}>{company.name_en}</p>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 20px', fontSize: '9px', color: T.textMuted, marginTop: '2px' }}>
                  {company.cr_number && <div><span style={{ color: T.textFaint }}>السجل التجاري: </span><span dir="ltr" style={numFont}>{company.cr_number}</span></div>}
                  {company.vat_number && <div><span style={{ color: T.textFaint }}>الرقم الضريبي: </span><span dir="ltr" style={numFont}>{company.vat_number}</span></div>}
                  {(company.address_street || company.address_city) && <div><span style={{ color: T.textFaint }}>العنوان: </span>{[company.address_street, company.address_city].filter(Boolean).join('، ')}</div>}
                  {company.phone && <div><span style={{ color: T.textFaint }}>هاتف: </span><span dir="ltr" style={numFont}>{company.phone}</span></div>}
                </div>
              </div>

              {/* Invoice # — left */}
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <p style={metaLabel}>رقم الفاتورة</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: T.navy, ...numFont, margin: 0 }} dir="ltr">{invoice.invoice_number}</p>
              </div>
            </div>

            {/* ═══ TITLE ═══ */}
            <div style={{ textAlign: 'center', padding: '18px 0 14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: T.navy, margin: '0 0 2px' }}>فاتورة ضريبية</h2>
              <p style={{ fontSize: '10px', color: T.textFaint, ...numFont, margin: '0 0 10px' }}>Tax Invoice</p>
              <div style={{ height: '1px', background: T.border, maxWidth: '80px', margin: '0 auto' }} />
            </div>

            {/* ═══ DATE STRIP ═══ */}
            <div className="break-avoid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', marginBottom: '16px', border: `1px solid ${T.border}`, borderRadius: '6px', overflow: 'hidden' }}>
              {[
                { label: "تاريخ الإصدار", value: formatDateAr(invoice.invoice_date) },
                { label: "تاريخ التوريد", value: formatDateAr(invoice.supply_date) },
                { label: "تاريخ الاستحقاق", value: formatDateAr(invoice.due_date) },
              ].map((d, i) => (
                <div key={d.label} style={{ padding: '8px 12px', textAlign: 'center', background: T.surface, borderLeft: i < 2 ? `1px solid ${T.border}` : 'none' }}>
                  <p style={{ ...metaLabel, marginBottom: '2px' }}>{d.label}</p>
                  <p style={{ ...metaValue, fontSize: '11px' }}>{d.value}</p>
                </div>
              ))}
            </div>

            {/* ═══ CUSTOMER ═══ */}
            <div className="break-avoid" style={{ border: `1px solid ${T.border}`, borderRadius: '6px', padding: '12px 16px', marginBottom: '16px' }}>
              <p style={sectionLabel}>بيانات العميل | Customer Details</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
                <div>
                  <p style={{ fontWeight: 700, color: T.navy, fontSize: '13px', margin: '0 0 1px' }}>{customer?.name || "—"}</p>
                  {customer?.name_en && <p style={{ fontSize: '10px', color: T.textMuted, margin: 0 }}>{customer.name_en}</p>}
                </div>
                <div style={{ fontSize: '10px', color: T.textMuted }}>
                  {customer?.vat_number && <div style={{ marginBottom: '1px' }}><span style={{ color: T.textFaint }}>الرقم الضريبي: </span><span dir="ltr" style={{ ...numFont, color: T.text }}>{customer.vat_number}</span></div>}
                  {customer?.cr_number && <div style={{ marginBottom: '1px' }}><span style={{ color: T.textFaint }}>السجل التجاري: </span><span dir="ltr" style={{ ...numFont, color: T.text }}>{customer.cr_number}</span></div>}
                  {customer?.address_street && <p style={{ margin: '1px 0' }}>{customer.address_street}</p>}
                  {customer?.phone && <div><span style={{ color: T.textFaint }}>هاتف: </span><span dir="ltr" style={numFont}>{customer.phone}</span></div>}
                </div>
              </div>
            </div>

            {/* ═══ TABLE ═══ */}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
              <table dir="rtl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {visibleColumns.map(col => (
                      <th key={col.key} style={thStyle(col)}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                      {visibleColumns.map(col => (
                        <td key={col.key} style={{
                          ...cellStyle(col),
                          color: col.key === 'discount' ? (item.discount > 0 ? T.red : T.textFaint) : cellStyle(col).color,
                        }}>
                          {renderCellValue(col, item, i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ═══ TOTALS ═══ */}
            <div className="break-avoid" style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
              <div style={{ width: '280px' }}>
                {/* Subtotal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: '11px', color: T.textMuted }}>المجموع الفرعي</span>
                  <span style={{ fontSize: '11px', ...numFont, color: T.text }} dir="ltr">{formatCurrency(invoice.subtotal)} ر.س</span>
                </div>
                {/* Discount */}
                {invoice.discount_total > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: '11px', color: T.textMuted }}>إجمالي الخصم</span>
                    <span style={{ fontSize: '11px', ...numFont, color: T.red }} dir="ltr">- {formatCurrency(invoice.discount_total)} ر.س</span>
                  </div>
                )}
                {/* VAT */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: '11px', color: T.textMuted }}>ضريبة القيمة المضافة (١٥٪)</span>
                  <span style={{ fontSize: '11px', ...numFont, color: T.text }} dir="ltr">{formatCurrency(invoice.vat_total)} ر.س</span>
                </div>
                {/* Grand total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: '4px', borderTop: `2px solid ${T.navy}` }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>الإجمالي المستحق</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, ...numFont, color: T.navy }} dir="ltr">{formatCurrency(invoice.grand_total)} ر.س</span>
                </div>
              </div>
            </div>

            {/* ═══ FOOTER: Notes + Stamp + QR ═══ */}
            <div className="break-avoid" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
              {/* Notes + stamp */}
              <div style={{ flex: 1, minWidth: '180px' }}>
                {showNotes && invoice.notes && (
                  <div style={{ marginBottom: '10px' }}>
                    <p style={sectionLabel}>ملاحظات</p>
                    <p style={{ fontSize: '10px', color: T.textMuted, lineHeight: 1.6 }}>{invoice.notes}</p>
                  </div>
                )}
                {showStamp && (
                  <div style={{ marginTop: '6px' }}>
                    <DigitalStamp stamp={{
                      companyName: company.stamp_company_name || company.name,
                      crNumber: company.stamp_cr_number || company.cr_number || "",
                      vatNumber: company.stamp_vat_number || company.vat_number || "",
                      imageUrl: company.stamp_image_url || undefined,
                      enabled: !!company.stamp_enabled,
                    }} size="md" />
                  </div>
                )}
              </div>

              {/* QR — bottom right */}
              {showQR && (
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <ZatcaQRCode
                    sellerName={company.name}
                    vatNumber={company.vat_number || ""}
                    timestamp={new Date(invoice.invoice_date).toISOString()}
                    invoiceTotal={invoice.grand_total}
                    vatTotal={invoice.vat_total}
                    size={80}
                  />
                  <p style={{ fontSize: '8px', color: T.textFaint, marginTop: '3px' }}>ZATCA TLV</p>
                </div>
              )}
            </div>

            {/* ═══ ZATCA Phase 2 ═══ */}
            {company?.zatca_phase2_ready && (
              <div style={{ marginTop: '12px' }}>
                <ZatcaPhase2Status invoice={invoice} onUpdate={loadInvoice} />
              </div>
            )}

            {/* ═══ DOCUMENT FOOTER ═══ */}
            <div style={{ borderTop: `1px solid ${T.border}`, marginTop: '16px', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', color: T.textFaint }}>
                <p style={{ margin: 0 }}>{footerText || branding.invoiceFooterText || 'هذه الفاتورة صادرة إلكترونياً وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك'}</p>
                <p style={{ margin: 0, ...numFont }}>Powered by Numaxio — {invoice.invoice_number}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Payment History */}
      {invoice && invoice.status !== 'draft' && (
        <div style={{ maxWidth: '210mm', margin: '16px auto 0' }}>
          <PaymentHistory invoiceId={invoice.id} onUpdate={loadInvoice} />
        </div>
      )}

      {invoice && <InvoiceDeliveryDialog open={deliveryOpen} onOpenChange={setDeliveryOpen} invoice={{ id: invoice.id, invoice_number: invoice.invoice_number, grand_total: invoice.grand_total, due_date: invoice.due_date, currency: invoice.currency, customer_name: customer?.name, customer_phone: customer?.phone, customer_email: customer?.email }} />}
      {invoice && <RecordPaymentDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} invoiceId={invoice.id} amountDue={invoice.amount_due} onPaymentRecorded={loadInvoice} />}
      {invoice && <PaymentGatewayPanel open={gatewayOpen} onOpenChange={setGatewayOpen} invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} amount={invoice.amount_due} currency={invoice.currency} customerName={customer?.name} customerMobile={customer?.phone} customerEmail={customer?.email} />}
    </div>
  );
};

export default InvoicePreview;
