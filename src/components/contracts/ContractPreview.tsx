import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, Lock, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateAr } from "@/lib/invoice-utils";
import { printDocument, CONTRACT_PRINT_STYLES } from "@/lib/pdf-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";
import { useBranding } from "@/contexts/BrandingContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ContractPreviewProps {
  onBack: () => void;
  bodyHtml?: string;
  contractId?: string | null;
}

const ContractPreview = ({ onBack, bodyHtml, contractId }: ContractPreviewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const { tenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) { setLoading(false); return; }

      const tenantPromise = supabase.from("tenants")
        .select("name, name_en, cr_number, vat_number, address_street, phone, email, logo_url, stamp_enabled, stamp_company_name, stamp_cr_number, stamp_vat_number, stamp_image_url")
        .eq("id", tenantId).single();

      const tenantRes = await tenantPromise;
      if (tenantRes.data) setCompany(tenantRes.data);

      if (contractId) {
        const [contractRes, versionsRes] = await Promise.all([
          supabase.from("contracts").select("*, customers(name)").eq("id", contractId).single(),
          supabase.from("contract_versions").select("*").eq("contract_id", contractId).order("version_number", { ascending: false }),
        ]);
        if (contractRes.data) setContract(contractRes.data);
        if (versionsRes.data) setVersions(versionsRes.data);
      }
      setLoading(false);
    };
    load();
  }, [tenantId, contractId]);

  const html = bodyHtml || contract?.body_html || generateDefaultBody(company);
  const isSigned = contract?.status === "signed";

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    printDocument(content, {
      title: contract ? `عقد - ${contract.contract_number}` : "عقد",
      extraStyles: CONTRACT_PRINT_STYLES,
      brandFont: branding.font,
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center py-32"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  const stampData = company ? {
    companyName: company.stamp_company_name || company.name || "",
    crNumber: company.stamp_cr_number || company.cr_number || "",
    vatNumber: company.stamp_vat_number || company.vat_number || "",
    imageUrl: company.stamp_image_url || undefined,
    enabled: company.stamp_enabled ?? true,
  } : null;

  return (
    <div dir="rtl" className="space-y-4 p-4 sm:p-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowRight size={18} />
          العودة
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {isSigned && (
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <Lock size={12} />
              نسخة موقّعة — غير قابلة للتعديل
            </span>
          )}
          <Button variant="outline" className="gap-2" onClick={handlePrint}><Printer size={16} />طباعة</Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handlePrint}><Download size={16} />تصدير PDF</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Contract Document */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3">
          <div ref={printRef} className="rounded-xl border border-border bg-white shadow-elevated overflow-hidden" style={{ fontFamily: `'${branding.font || 'IBM Plex Sans Arabic'}', sans-serif` }}>
            {/* Header Bar */}
            <div className="px-6 sm:px-8 py-5" style={{ background: branding.primaryColor }}>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  {company?.logo_url ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 p-1.5">
                      <img src={company.logo_url} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: branding.secondaryColor }}>
                      <span className="text-sm font-bold">{company?.name?.charAt(0) || 'ن'}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{company?.name || ""}</p>
                    {company?.name_en && <p className="text-[10px] opacity-70 font-english">{company.name_en}</p>}
                  </div>
                </div>
                <div className="text-left">
                  {company?.cr_number && (
                    <div>
                      <p className="text-[10px] opacity-60">السجل التجاري</p>
                      <p className="text-sm font-english font-medium">{company.cr_number}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div
              className="px-6 sm:px-8 py-6 text-sm leading-relaxed text-foreground contract-body"
              style={{ minHeight: "600px", fontSize: "13px", lineHeight: "1.9" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* Stamp Area */}
            <div className="px-6 sm:px-8 pb-6">
              <div className="border-t border-dashed border-border pt-6 flex justify-between items-end">
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p>هذا العقد صادر إلكترونياً</p>
                  <p>ويخضع لأنظمة المملكة العربية السعودية</p>
                </div>
                {stampData && <DigitalStamp stamp={stampData} size="md" />}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 sm:px-8 py-3" style={{ background: "hsl(210 20% 97%)" }}>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <p>مستند رسمي — لا يجوز تعديله بعد التوقيع</p>
                <p className="font-english">Powered by Numaxio{contract ? ` — ${contract.contract_number}` : ''}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Version History Sidebar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
          {versions.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock size={16} className="text-accent" />
                سجل النُسخ
              </h3>
              <div className="space-y-3">
                {versions.map((v, i) => (
                  <div
                    key={v.id}
                    className={`rounded-lg border p-3 text-xs ${i === 0 ? "border-accent/30 bg-accent/5" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground">نسخة {v.version_number}</span>
                      <span className="font-english text-muted-foreground">{formatDateAr(v.created_at)}</span>
                    </div>
                    {v.change_summary && <p className="text-muted-foreground">{v.change_summary}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSigned && (
            <div className="rounded-xl border border-success/20 bg-success/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={14} className="text-success" />
                <span className="text-xs font-semibold text-success">عقد موقّع</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                تم توقيع هذا العقد ولا يمكن تعديله. أي تغييرات تتطلب إنشاء ملحق أو عقد جديد.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

function generateDefaultBody(company: any) {
  const name = company?.name || "الشركة";
  const cr = company?.cr_number || "";
  const vat = company?.vat_number || "";
  return `<div style="text-align:center;margin-bottom:24px;">
<h2 style="font-size:20px;font-weight:700;">عقد تقديم خدمات</h2>
</div>
<p>إنه في يوم ${formatDateAr(new Date())} تم الاتفاق بين كل من:</p>
<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الأول (مقدم الخدمة):</strong></p>
<p>${name}</p>
${cr ? `<p>السجل التجاري: ${cr}</p>` : ''}
${vat ? `<p>الرقم الضريبي: ${vat}</p>` : ''}
</div>
<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الثاني (العميل):</strong></p>
<p>___________________</p>
</div>`;
}

export default ContractPreview;
