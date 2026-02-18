import { useState, useEffect } from "react";
import { Shield, FileCode, Send, CheckCircle2, XCircle, AlertTriangle, Loader2, Download, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ZatcaPhase2StatusProps {
  invoice: any;
  onUpdate: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "بانتظار التوليد", color: "text-muted-foreground", icon: Shield },
  xml_generated: { label: "تم توليد XML", color: "text-blue-600", icon: FileCode },
  submitting: { label: "جارٍ الإرسال...", color: "text-yellow-600", icon: Loader2 },
  reported: { label: "تم الإبلاغ بنجاح", color: "text-emerald-600", icon: CheckCircle2 },
  cleared: { label: "تم الاعتماد", color: "text-emerald-600", icon: CheckCircle2 },
  failed: { label: "فشل الإرسال", color: "text-destructive", icon: XCircle },
};

const ZatcaPhase2Status = ({ invoice, onUpdate }: ZatcaPhase2StatusProps) => {
  const [generatingXml, setGeneratingXml] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complianceCheck, setComplianceCheck] = useState<any>(null);
  const [checkingCompliance, setCheckingCompliance] = useState(true);

  const status = STATUS_MAP[invoice.zatca_status] || STATUS_MAP.pending;
  const StatusIcon = status.icon;

  // Check compliance on mount
  useEffect(() => {
    const checkCompliance = async () => {
      try {
        const res = await supabase.functions.invoke("zatca-phase2", {
          body: { action: "check-compliance", tenantId: invoice.tenant_id },
        });
        if (res.data && !res.error) {
          setComplianceCheck(res.data);
        }
      } catch {
        // Silently fail – compliance check is optional
      }
      setCheckingCompliance(false);
    };
    if (invoice.tenant_id) checkCompliance();
  }, [invoice.tenant_id]);

  const handleGenerateXML = async () => {
    setGeneratingXml(true);
    try {
      const res = await supabase.functions.invoke("zatca-phase2", {
        body: { action: "generate-xml", invoiceId: invoice.id },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.success) {
        const signedMsg = res.data.signed
          ? "تم توليد XML موقّع رقمياً ✓"
          : "تم توليد XML (بدون توقيع رقمي – لا يوجد مفتاح خاص)";
        toast.success(signedMsg);
        onUpdate();
      } else {
        toast.error(res.data?.error || "فشل في توليد XML");
      }
    } catch (err: any) {
      toast.error(err.message || "خطأ في توليد XML");
    }
    setGeneratingXml(false);
  };

  const handleSubmitToZATCA = async () => {
    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke("zatca-phase2", {
        body: { action: "submit-to-zatca", invoiceId: invoice.id },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.success) {
        toast.success("تم الإبلاغ لبوابة فاتورة بنجاح ✓");
      } else {
        const errors = res.data?.result?.errors;
        toast.error(errors?.[0]?.message || res.data?.result?.message || "فشل الإرسال لبوابة ZATCA");
      }
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "خطأ في الإرسال");
    }
    setSubmitting(false);
  };

  const handleDownloadXML = () => {
    if (!invoice.zatca_xml) return;
    const blob = new Blob([invoice.zatca_xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoice_number}-zatca.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isBlocked = complianceCheck && !complianceCheck.ready && !complianceCheck.hasComplianceCert && !complianceCheck.hasProductionCert;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          ZATCA Phase 2
        </h4>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
          <StatusIcon size={14} className={status.icon === Loader2 ? "animate-spin" : ""} />
          {status.label}
        </div>
      </div>

      {/* Compliance Status */}
      {!checkingCompliance && complianceCheck && (
        <div className={`rounded-lg p-2.5 text-xs flex items-start gap-2 ${
          complianceCheck.ready
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300"
            : "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300"
        }`}>
          {complianceCheck.ready ? (
            <>
              <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">جاهز للفوترة الإلكترونية</span>
                <span className="text-[10px] opacity-70 mr-2">
                  ({complianceCheck.hasProductionCert ? "إنتاج" : "امتثال"})
                </span>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">يتطلب إعداد الامتثال</span>
                {complianceCheck.issues?.map((issue: string, i: number) => (
                  <div key={i} className="text-[10px] opacity-70">
                    {issue === "missing_cr_number" && "• السجل التجاري مطلوب"}
                    {issue === "missing_vat_number" && "• الرقم الضريبي مطلوب"}
                    {issue === "no_active_certificate" && "• لا توجد شهادة ZATCA فعّالة"}
                    {issue === "production_cert_missing" && "• شهادة الإنتاج مطلوبة"}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* UUID */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">UUID الفاتورة:</span>
        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded" dir="ltr">
          {invoice.invoice_uuid || "—"}
        </span>
      </div>

      {/* Hash */}
      {invoice.invoice_hash && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Hash:</span>
          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-[200px]" dir="ltr">
            {invoice.invoice_hash.substring(0, 24)}...
          </span>
        </div>
      )}

      {/* Signed indicator */}
      {invoice.zatca_signed_xml && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
          <Lock size={10} />
          <span>موقّع رقمياً (XAdES-BES)</span>
        </div>
      )}

      {/* Warnings */}
      {invoice.zatca_warnings?.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2.5 space-y-1 dark:bg-yellow-950/20 dark:border-yellow-800">
          {invoice.zatca_warnings.map((w: any, i: number) => (
            <p key={i} className="text-[10px] text-yellow-800 dark:text-yellow-300 flex items-start gap-1.5">
              <AlertTriangle size={10} className="shrink-0 mt-0.5" />
              {w.message || w}
            </p>
          ))}
        </div>
      )}

      {/* Errors */}
      {invoice.zatca_errors?.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 space-y-1 dark:bg-red-950/20 dark:border-red-800">
          {invoice.zatca_errors.map((e: any, i: number) => (
            <p key={i} className="text-[10px] text-red-800 dark:text-red-300 flex items-start gap-1.5">
              <XCircle size={10} className="shrink-0 mt-0.5" />
              {e.message || e}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isBlocked ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock size={12} />
            <span>أكمل إعداد الامتثال أولاً من صفحة الإعدادات</span>
          </div>
        ) : (
          <>
            {(!invoice.zatca_status || invoice.zatca_status === "pending") && (
              <Button size="sm" variant="outline" onClick={handleGenerateXML} disabled={generatingXml} className="gap-1.5 text-xs">
                {generatingXml ? <Loader2 size={12} className="animate-spin" /> : <FileCode size={12} />}
                توليد XML
              </Button>
            )}

            {invoice.zatca_status === "xml_generated" && (
              <>
                <Button size="sm" onClick={handleSubmitToZATCA} disabled={submitting} className="gap-1.5 text-xs bg-accent text-accent-foreground hover:bg-accent/90">
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  إرسال لبوابة فاتورة
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadXML} className="gap-1.5 text-xs">
                  <Download size={12} />
                  تحميل XML
                </Button>
              </>
            )}

            {invoice.zatca_status === "failed" && (
              <Button size="sm" variant="outline" onClick={handleGenerateXML} disabled={generatingXml} className="gap-1.5 text-xs">
                {generatingXml ? <Loader2 size={12} className="animate-spin" /> : <FileCode size={12} />}
                إعادة التوليد
              </Button>
            )}

            {(invoice.zatca_status === "reported" || invoice.zatca_status === "cleared") && invoice.zatca_xml && (
              <Button size="sm" variant="outline" onClick={handleDownloadXML} className="gap-1.5 text-xs">
                <Download size={12} />
                تحميل XML
              </Button>
            )}
          </>
        )}
      </div>

      {invoice.zatca_submitted_at && (
        <p className="text-[10px] text-muted-foreground">
          آخر إرسال: {new Date(invoice.zatca_submitted_at).toLocaleString("ar-SA")}
        </p>
      )}
    </div>
  );
};

export default ZatcaPhase2Status;
