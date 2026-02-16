import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Printer, Download, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateAr } from "@/lib/invoice-utils";
import { printDocument, CONTRACT_PRINT_STYLES } from "@/lib/pdf-utils";
import DigitalStamp from "@/components/stamp/DigitalStamp";
import { useBranding } from "@/contexts/BrandingContext";

interface ContractPreviewProps {
  onBack: () => void;
  bodyHtml?: string;
}

const company = {
  name: "شركة التقنية المتقدمة",
  cr_number: "1010234567",
  vat_number: "310123456700003",
};

// Demo version history
const versions = [
  { version: 1, date: "2026-02-01", by: "أحمد الخالد", summary: "إنشاء العقد" },
  { version: 2, date: "2026-02-05", by: "أحمد الخالد", summary: "تعديل بند الأجر" },
  { version: 3, date: "2026-02-10", by: "محمد العلي", summary: "توقيع العقد" },
];

const defaultBody = `<div style="text-align:center;margin-bottom:24px;">
<h2 style="font-size:20px;font-weight:700;">عقد تقديم خدمات</h2>
<p style="font-size:12px;color:#666;">رقم العقد: CON-2026-0002</p>
</div>
<p>إنه في يوم ${formatDateAr(new Date())} تم الاتفاق بين كل من:</p>
<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الأول (مقدم الخدمة):</strong></p>
<p>شركة التقنية المتقدمة</p>
<p>السجل التجاري: 1010234567 | الرقم الضريبي: 310123456700003</p>
<p>العنوان: الرياض، حي العليا</p>
</div>
<div style="margin:16px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
<p><strong>الطرف الثاني (العميل):</strong></p>
<p>شركة النور للتجارة</p>
<p>السجل التجاري: 1010876543</p>
</div>
<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الأول: موضوع العقد</h3>
<p>يلتزم الطرف الأول بتقديم الخدمات التالية: <strong>تطوير نظام إدارة الموارد البشرية</strong></p>
<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثاني: مدة العقد</h3>
<p>يبدأ تنفيذ هذا العقد من تاريخ ١ فبراير ٢٠٢٦ وينتهي بتاريخ ٣١ أغسطس ٢٠٢٦.</p>
<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الثالث: قيمة العقد</h3>
<p>قيمة هذا العقد الإجمالية هي <strong>١٨٠٬٠٠٠٫٠٠ ريال سعودي</strong> شاملة ضريبة القيمة المضافة (15٪).</p>
<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الرابع: شروط الدفع</h3>
<p>يتم الدفع وفقاً للجدول الزمني المتفق عليه بين الطرفين.</p>
<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند الخامس: السرية</h3>
<p>يلتزم كلا الطرفين بالمحافظة على سرية المعلومات.</p>
<h3 style="font-size:15px;font-weight:600;margin-top:20px;">البند السادس: فض النزاعات</h3>
<p>يُحال أي خلاف إلى الجهات القضائية المختصة في المملكة العربية السعودية.</p>
<div style="margin-top:40px;display:flex;justify-content:space-between;">
<div style="text-align:center;width:45%;"><p><strong>الطرف الأول</strong></p><p>شركة التقنية المتقدمة</p><p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع والختم</p></div>
<div style="text-align:center;width:45%;"><p><strong>الطرف الثاني</strong></p><p>شركة النور للتجارة</p><p style="margin-top:40px;border-top:1px solid #000;padding-top:8px;">التوقيع والختم</p></div>
</div>`;

const ContractPreview = ({ onBack, bodyHtml }: ContractPreviewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { branding } = useBranding();
  const html = bodyHtml || defaultBody;
  const isSigned = !bodyHtml; // demo: default view is signed

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    printDocument(content, {
      title: "عقد",
      extraStyles: CONTRACT_PRINT_STYLES,
      brandFont: branding.font,
    });
  };

  return (
    <div dir="rtl" className="space-y-4 p-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={18} />
          العودة
        </Button>
        <div className="flex items-center gap-2">
          {isSigned && (
            <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <Lock size={12} />
              نسخة موقّعة — غير قابلة للتعديل
            </span>
          )}
          <Button variant="outline" className="gap-2" onClick={handlePrint}>
            <Printer size={16} />
            طباعة
          </Button>
          <Button
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handlePrint}
          >
            <Download size={16} />
            تصدير PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Contract Document */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3"
        >
          <div
            ref={printRef}
            className="rounded-xl border border-border bg-white shadow-elevated overflow-hidden"
          >
            {/* Header Bar */}
            <div className="px-8 py-5" style={{ background: branding.primaryColor, fontFamily: `'${branding.font}', sans-serif` }}>
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  {branding.logoUrl ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 p-1.5">
                      <img src={branding.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: branding.secondaryColor }}>
                      <span className="text-sm font-bold font-english">S</span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{company.name}</p>
                    <p className="text-[10px] opacity-70 font-english">Advanced Technology Co.</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs opacity-60">السجل التجاري</p>
                  <p className="text-sm font-english font-medium">{company.cr_number}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div
              className="px-8 py-6 text-sm leading-relaxed text-foreground contract-body"
              style={{ minHeight: "600px", fontSize: "13px", lineHeight: "1.9" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* Stamp Area */}
            <div className="px-8 pb-6">
              <div className="border-t border-dashed border-border pt-6 flex justify-between items-end">
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p>هذا العقد صادر إلكترونياً</p>
                  <p>ويخضع لأنظمة المملكة العربية السعودية</p>
                </div>
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

            {/* Footer */}
            <div
              className="border-t border-border px-8 py-3"
              style={{ background: "hsl(210 20% 97%)" }}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <p>مستند رسمي — لا يجوز تعديله بعد التوقيع</p>
                <p className="font-english">Generated by Numaxio</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Version History Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock size={16} className="text-accent" />
              سجل النُسخ
            </h3>
            <div className="space-y-3">
              {versions.map((v, i) => (
                <div
                  key={v.version}
                  className={`rounded-lg border p-3 text-xs ${
                    i === 0
                      ? "border-accent/30 bg-accent/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">
                      نسخة {v.version}
                    </span>
                    <span className="font-english text-muted-foreground">
                      {v.date}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{v.summary}</p>
                  <p className="text-muted-foreground/60 mt-1">بواسطة: {v.by}</p>
                </div>
              ))}
            </div>
          </div>

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

export default ContractPreview;
