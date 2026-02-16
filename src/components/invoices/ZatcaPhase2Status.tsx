import { useState } from "react";
import { Shield, FileCode, Send, CheckCircle2, XCircle, AlertTriangle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ZatcaPhase2StatusProps {
  invoice: any;
  onUpdate: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "بانتظار التوليد", color: "text-muted-foreground", icon: Shield },
  xml_generated: { label: "تم توليد XML", color: "text-blue-600", icon: FileCode },
  reported: { label: "تم الإبلاغ بنجاح", color: "text-emerald-600", icon: CheckCircle2 },
  cleared: { label: "تم الاعتماد", color: "text-emerald-600", icon: CheckCircle2 },
  failed: { label: "فشل الإرسال", color: "text-destructive", icon: XCircle },
};

const ZatcaPhase2Status = ({ invoice, onUpdate }: ZatcaPhase2StatusProps) => {
  const [generatingXml, setGeneratingXml] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const status = STATUS_MAP[invoice.zatca_status] || STATUS_MAP.pending;
  const StatusIcon = status.icon;

  const handleGenerateXML = async () => {
    setGeneratingXml(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("zatca-phase2", {
        body: { action: "generate-xml", invoiceId: invoice.id },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.success) {
        toast.success("تم توليد XML بنجاح");
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
        toast.success("تم الإبلاغ لبوابة فاتورة بنجاح");
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          ZATCA Phase 2
        </h4>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
          <StatusIcon size={14} />
          {status.label}
        </div>
      </div>

      {/* UUID */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">UUID الفاتورة:</span>
        <span className="font-english text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded" dir="ltr">
          {invoice.invoice_uuid || "—"}
        </span>
      </div>

      {/* Hash */}
      {invoice.invoice_hash && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Hash:</span>
          <span className="font-english text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded truncate max-w-[200px]" dir="ltr">
            {invoice.invoice_hash.substring(0, 24)}...
          </span>
        </div>
      )}

      {/* Warnings */}
      {invoice.zatca_warnings?.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2.5 space-y-1">
          {invoice.zatca_warnings.map((w: any, i: number) => (
            <p key={i} className="text-[10px] text-yellow-800 flex items-start gap-1.5">
              <AlertTriangle size={10} className="shrink-0 mt-0.5" />
              {w.message || w}
            </p>
          ))}
        </div>
      )}

      {/* Errors */}
      {invoice.zatca_errors?.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 space-y-1">
          {invoice.zatca_errors.map((e: any, i: number) => (
            <p key={i} className="text-[10px] text-red-800 flex items-start gap-1.5">
              <XCircle size={10} className="shrink-0 mt-0.5" />
              {e.message || e}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
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
