import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, Loader2, Check, X, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateAr, formatNumber } from "@/lib/invoice-utils";
import { printDocument, INVOICE_PRINT_STYLES } from "@/lib/pdf-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const statusLabels: Record<string, string> = {
  draft: "مسودة", sent: "مُرسل", approved: "موافق عليه", rejected: "مرفوض", converted: "تم التحويل",
};

interface QuotationPreviewProps {
  quotationId?: string | null;
  onBack: () => void;
  onConvertedToInvoice: () => void;
}

const QuotationPreview = ({ quotationId, onBack, onConvertedToInvoice }: QuotationPreviewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!quotationId || !tenantId) { setLoading(false); return; }
      const [qRes, iRes, tRes] = await Promise.all([
        supabase.from("quotations").select("*, customers(name, name_en, vat_number, cr_number, address_street, address_city, phone, email)").eq("id", quotationId).single(),
        supabase.from("quotation_items").select("*").eq("quotation_id", quotationId).order("sort_order"),
        supabase.from("tenants").select("name, name_en, cr_number, vat_number, address_street, address_city, phone, email, logo_url").eq("id", tenantId).single(),
      ]);
      if (qRes.data) { setQuotation(qRes.data); setCustomer(qRes.data.customers); }
      if (iRes.data) setItems(iRes.data);
      if (tRes.data) setCompany(tRes.data);
      setLoading(false);
    };
    load();
  }, [quotationId, tenantId]);

  const handlePrint = () => {
    if (!printRef.current) return;
    printDocument(printRef.current, {
      title: `عرض سعر - ${quotation?.quotation_number || ""}`,
      extraStyles: INVOICE_PRINT_STYLES,
      brandFont: branding.font,
    });
  };

  const updateStatus = async (status: string) => {
    if (!quotationId || !user) return;
    setActionLoading(true);
    const updates: any = { status };
    if (status === "approved") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = user.id;
    }
    const { error } = await supabase.from("quotations").update(updates).eq("id", quotationId);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setQuotation((prev: any) => ({ ...prev, ...updates }));
      toast({ title: `تم ${status === "approved" ? "الموافقة" : status === "rejected" ? "الرفض" : status === "sent" ? "الإرسال" : "التحديث"}` });
    }
    setActionLoading(false);
  };

  const convertToInvoice = async () => {
    if (!quotation || !tenantId || !user) return;
    setActionLoading(true);

    // Generate invoice number
    const now = new Date();
    const invNum = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    const { data: invoice, error } = await supabase.from("invoices").insert({
      tenant_id: tenantId,
      customer_id: quotation.customer_id,
      created_by: user.id,
      invoice_number: invNum,
      invoice_date: new Date().toISOString().split("T")[0],
      supply_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      subtotal: quotation.subtotal,
      discount_total: quotation.discount_total,
      vat_total: quotation.vat_total,
      grand_total: quotation.grand_total,
      amount_due: quotation.grand_total,
      notes: quotation.notes,
      status: "draft",
    }).select("id").single();

    if (error || !invoice) {
      toast({ title: "خطأ", description: error?.message || "فشل التحويل", variant: "destructive" });
      setActionLoading(false);
      return;
    }

    // Copy items
    const invoiceItems = items.map((item, idx) => ({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      discount: item.discount,
      vat_rate: item.vat_rate,
      vat_amount: item.vat_amount,
      line_total: item.line_total,
      sort_order: idx,
    }));
    await supabase.from("invoice_items").insert(invoiceItems);

    // Mark quotation as converted
    await supabase.from("quotations").update({
      status: "converted",
      converted_invoice_id: invoice.id,
    }).eq("id", quotationId);

    toast({ title: "تم تحويل عرض السعر إلى فاتورة بنجاح", description: `رقم الفاتورة: ${invNum}` });
    setActionLoading(false);
    onConvertedToInvoice();
  };

  if (loading) {
    return <div className="flex justify-center items-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (!quotation || !company) {
    return (
      <div dir="rtl" className="p-6">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground mb-4"><ArrowRight size={18} />العودة</Button>
        <p className="text-center text-muted-foreground py-16">لم يتم العثور على عرض السعر</p>
      </div>
    );
  }

  const primaryColor = branding.primaryColor || "#1a1f36";
  const secondaryColor = branding.secondaryColor || "#1a9b8a";
  const isReadOnly = quotation.status === "approved" || quotation.status === "converted";

  return (
    <div dir="rtl" className="space-y-4 p-4 sm:p-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground"><ArrowRight size={18} />العودة</Button>
          <Badge variant="outline" className="text-sm">{statusLabels[quotation.status]}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {quotation.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => updateStatus("sent")} disabled={actionLoading} className="gap-1.5">
              <Send size={14} /> إرسال
            </Button>
          )}
          {(quotation.status === "draft" || quotation.status === "sent") && (
            <>
              <Button variant="outline" size="sm" onClick={() => updateStatus("approved")} disabled={actionLoading} className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
                <Check size={14} /> موافقة
              </Button>
              <Button variant="outline" size="sm" onClick={() => updateStatus("rejected")} disabled={actionLoading} className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50">
                <X size={14} /> رفض
              </Button>
            </>
          )}
          {quotation.status === "approved" && !quotation.converted_invoice_id && (
            <Button size="sm" onClick={convertToInvoice} disabled={actionLoading} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <FileText size={14} /> تحويل إلى فاتورة
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} />طباعة</Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handlePrint}><Download size={16} />تصدير PDF</Button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[210mm]">
        <div ref={printRef} className="rounded-xl border border-border bg-white shadow-elevated overflow-hidden" style={{ fontFamily: `'${branding.font || "IBM Plex Sans Arabic"}', sans-serif` }}>

          {/* Header */}
          <div style={{ background: primaryColor }} className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div style={{ color: "white" }} className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  {company.logo_url ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 p-1.5 shrink-0">
                      <img src={company.logo_url} alt={company.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl shrink-0" style={{ background: secondaryColor }}>
                      <span className="text-xl font-bold text-white">{company.name?.charAt(0) || "ن"}</span>
                    </div>
                  )}
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold leading-tight">{company.name}</h1>
                    {company.name_en && <p className="text-xs font-english opacity-70 mt-0.5">{company.name_en}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs opacity-85 mt-2">
                  {company.cr_number && <div className="flex items-center gap-1.5"><span className="opacity-70">السجل التجاري:</span><span className="font-english font-medium" dir="ltr">{company.cr_number}</span></div>}
                  {company.vat_number && <div className="flex items-center gap-1.5"><span className="opacity-70">الرقم الضريبي:</span><span className="font-english font-medium" dir="ltr">{company.vat_number}</span></div>}
                  {(company.address_street || company.address_city) && <div className="flex items-center gap-1.5"><span className="opacity-70">العنوان:</span><span>{[company.address_street, company.address_city].filter(Boolean).join("، ")}</span></div>}
                  {company.phone && <div className="flex items-center gap-1.5"><span className="opacity-70">هاتف:</span><span className="font-english" dir="ltr">{company.phone}</span></div>}
                </div>
              </div>

              <div className="text-left shrink-0">
                <div className="rounded-xl px-5 py-4" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-0.5">عرض سعر</h2>
                  <p className="text-[11px] font-english opacity-60 mb-3">Price Quotation</p>
                  <div className="border-t border-white/20 pt-3">
                    <p className="text-[10px] opacity-60 mb-0.5">رقم العرض</p>
                    <p className="text-lg font-bold font-english text-white tracking-wide">{quotation.quotation_number}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3 mb-6 rounded-xl overflow-hidden border border-border">
              {[
                { label: "تاريخ العرض", value: formatDateAr(quotation.created_at) },
                { label: "صالح حتى", value: quotation.valid_until ? formatDateAr(quotation.valid_until) : "غير محدد" },
              ].map((d, i) => (
                <div key={d.label} className={`p-3 sm:p-4 text-center ${i === 0 ? "border-l border-border" : ""}`} style={{ background: "hsl(210 20% 97%)" }}>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{d.label}</p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground">{d.value}</p>
                </div>
              ))}
            </div>

            {/* Customer */}
            <div className="rounded-xl border border-border p-4 sm:p-5 mb-6" style={{ background: "hsl(210 20% 97%)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 rounded-full" style={{ background: secondaryColor }}></div>
                <h3 className="text-xs font-bold text-muted-foreground tracking-wider">بيانات العميل</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                <div>
                  <p className="font-bold text-foreground text-base">{customer?.name || "—"}</p>
                  {customer?.name_en && <p className="text-xs font-english text-muted-foreground">{customer.name_en}</p>}
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {customer?.vat_number && <div className="flex items-center gap-2"><span>الرقم الضريبي:</span><span className="font-english font-medium text-foreground" dir="ltr">{customer.vat_number}</span></div>}
                  {customer?.phone && <div className="flex items-center gap-2"><span>هاتف:</span><span className="font-english" dir="ltr">{customer.phone}</span></div>}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl border border-border overflow-hidden mb-6">
              <table className="inv-table" dir="rtl" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ width: "5%", textAlign: "center", padding: "12px 10px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600 }}>#</th>
                    <th style={{ width: "35%", textAlign: "right", padding: "12px 14px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600 }}>الوصف</th>
                    <th style={{ width: "8%", textAlign: "center", padding: "12px 10px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600 }}>الكمية</th>
                    <th style={{ width: "8%", textAlign: "center", padding: "12px 10px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600 }}>الوحدة</th>
                    <th style={{ width: "14%", textAlign: "left", padding: "12px 14px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600, fontFamily: "'Inter', sans-serif", direction: "ltr" as const }}>السعر</th>
                    <th style={{ width: "10%", textAlign: "left", padding: "12px 14px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600, fontFamily: "'Inter', sans-serif", direction: "ltr" as const }}>الخصم</th>
                    <th style={{ width: "8%", textAlign: "center", padding: "12px 10px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600 }}>الضريبة</th>
                    <th style={{ width: "14%", textAlign: "left", padding: "12px 14px", background: primaryColor, color: "white", fontSize: "11px", fontWeight: 600, fontFamily: "'Inter', sans-serif", direction: "ltr" as const }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? "1px solid #e5e7eb" : "none", background: i % 2 === 1 ? "hsl(210 20% 98%)" : "white" }}>
                      <td style={{ textAlign: "center", padding: "11px 10px", fontSize: "12px", color: "#6b7280" }}>{formatNumber(i + 1)}</td>
                      <td style={{ textAlign: "right", padding: "11px 14px", fontSize: "13px", fontWeight: 500, color: "#1a1a2e" }}>{item.description}</td>
                      <td style={{ textAlign: "center", padding: "11px 10px", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>{formatNumber(item.quantity)}</td>
                      <td style={{ textAlign: "center", padding: "11px 10px", fontSize: "11px", color: "#6b7280" }}>{item.unit || "وحدة"}</td>
                      <td style={{ textAlign: "left", padding: "11px 14px", fontSize: "12px", fontFamily: "'Inter', sans-serif", direction: "ltr" as const }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ textAlign: "left", padding: "11px 14px", fontSize: "12px", fontFamily: "'Inter', sans-serif", direction: "ltr" as const, color: item.discount > 0 ? "#dc2626" : "#9ca3af" }}>{item.discount > 0 ? formatCurrency(item.discount) : "—"}</td>
                      <td style={{ textAlign: "center", padding: "11px 10px", fontSize: "11px", fontFamily: "'Inter', sans-serif" }}>{formatNumber(item.vat_rate)}٪</td>
                      <td style={{ textAlign: "left", padding: "11px 14px", fontSize: "13px", fontFamily: "'Inter', sans-serif", fontWeight: 600, direction: "ltr" as const, color: "#1a1a2e" }}>{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-start mb-8">
              <div className="w-full sm:w-[340px] rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: "hsl(210 20% 97%)" }}>
                    <span className="text-xs text-muted-foreground">المجموع الفرعي</span>
                    <span className="text-sm font-english font-medium text-foreground" dir="ltr">{formatCurrency(quotation.subtotal)} ر.س</span>
                  </div>
                  {quotation.discount_total > 0 && (
                    <div className="flex items-center justify-between px-5 py-3" style={{ background: "hsl(210 20% 97%)" }}>
                      <span className="text-xs text-muted-foreground">إجمالي الخصم</span>
                      <span className="text-sm font-english font-medium text-destructive" dir="ltr">- {formatCurrency(quotation.discount_total)} ر.س</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-5 py-3" style={{ background: "hsl(210 20% 97%)" }}>
                    <span className="text-xs text-muted-foreground">ضريبة القيمة المضافة</span>
                    <span className="text-sm font-english font-medium text-foreground" dir="ltr">{formatCurrency(quotation.vat_total)} ر.س</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4" style={{ background: primaryColor }}>
                    <span className="text-sm font-bold text-white">الإجمالي</span>
                    <span className="text-lg font-bold font-english text-white" dir="ltr">{formatCurrency(quotation.grand_total)} ر.س</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer: Notes + Stamp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
              {quotation.notes && (
                <div className="rounded-lg border border-border p-4" style={{ background: "hsl(210 20% 97%)" }}>
                  <p className="text-[10px] font-bold text-muted-foreground mb-1.5">الشروط والأحكام</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{quotation.notes}</p>
                </div>
              )}
              <div className="flex justify-center sm:justify-end items-start">
                <DigitalStamp size="md" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default QuotationPreview;
