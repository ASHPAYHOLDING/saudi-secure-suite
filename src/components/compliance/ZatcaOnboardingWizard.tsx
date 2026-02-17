import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Key, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, ArrowRight, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Certificate {
  id: string;
  certificate_type: string;
  environment: string;
  csid: string;
  is_active: boolean;
  created_at: string;
}

const STEPS = [
  { title: "إعداد البيئة", description: "اختر بيئة العمل وأدخل رمز OTP" },
  { title: "شهادة الامتثال", description: "احصل على Compliance CSID" },
  { title: "شهادة الإنتاج", description: "احصل على Production CSID" },
];

const ZatcaOnboardingWizard = () => {
  const { tenantId, user } = useAuth();
  const userId = user?.id;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // Step 1
  const [environment, setEnvironment] = useState<string>("sandbox");
  const [otp, setOtp] = useState("");

  // Step 2
  const [complianceCsid, setComplianceCsid] = useState("");
  const [compliancePrivateKey, setCompliancePrivateKey] = useState("");

  // Step 3
  const [productionCsid, setProductionCsid] = useState("");
  const [productionPrivateKey, setProductionPrivateKey] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    loadCertificates();
  }, [tenantId]);

  const loadCertificates = async () => {
    const { data } = await supabase
      .from("zatca_certificates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (data) {
      setCertificates(data as Certificate[]);
      // Auto-advance step based on existing certs
      const hasCompliance = data.some((c: any) => c.certificate_type === "compliance");
      const hasProduction = data.some((c: any) => c.certificate_type === "production");
      if (hasProduction) setStep(2);
      else if (hasCompliance) setStep(1);
    }
  };

  const handleSaveOtp = async () => {
    if (!tenantId) return;
    setLoading(true);
    await supabase.from("tenants").update({
      zatca_environment: environment,
      zatca_otp: otp,
    }).eq("id", tenantId);
    toast.success("تم حفظ إعدادات البيئة");
    setStep(1);
    setLoading(false);
  };

  const handleSaveComplianceCsid = async () => {
    if (!tenantId || !complianceCsid) return;
    setLoading(true);
    const { error } = await supabase.from("zatca_certificates").upsert({
      tenant_id: tenantId,
      certificate_type: "compliance",
      csid: complianceCsid,
      private_key: compliancePrivateKey || null,
      environment,
      created_by: userId,
    }, { onConflict: "tenant_id,certificate_type,environment" });

    if (error) {
      toast.error("فشل في حفظ الشهادة");
    } else {
      // Update tenant flag
      await supabase.from("tenants").update({
        zatca_compliance_csid: complianceCsid,
        zatca_phase2_ready: false,
      }).eq("id", tenantId);
      toast.success("تم حفظ شهادة الامتثال بنجاح");
      await loadCertificates();
      setStep(2);
    }
    setLoading(false);
  };

  const handleSaveProductionCsid = async () => {
    if (!tenantId || !productionCsid) return;
    setLoading(true);
    const { error } = await supabase.from("zatca_certificates").upsert({
      tenant_id: tenantId,
      certificate_type: "production",
      csid: productionCsid,
      private_key: productionPrivateKey || null,
      environment: "production",
      created_by: userId,
    }, { onConflict: "tenant_id,certificate_type,environment" });

    if (error) {
      toast.error("فشل في حفظ الشهادة");
    } else {
      await supabase.from("tenants").update({
        zatca_production_csid: productionCsid,
        zatca_phase2_ready: true,
      }).eq("id", tenantId);
      toast.success("🎉 تم تفعيل ZATCA Phase 2 بنجاح!");
      await loadCertificates();
    }
    setLoading(false);
  };

  const hasComplianceCert = certificates.some(c => c.certificate_type === "compliance");
  const hasProductionCert = certificates.some(c => c.certificate_type === "production");

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">إعداد ZATCA Phase 2</h2>
          <p className="text-xs text-muted-foreground">ربط منشأتك ببوابة فاتورة الإلكترونية</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < step ? "bg-accent text-accent-foreground" :
              i === step ? "bg-accent/20 text-accent border-2 border-accent" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <div className="hidden sm:block flex-1">
              <p className="text-xs font-medium text-foreground">{s.title}</p>
              <p className="text-[10px] text-muted-foreground">{s.description}</p>
            </div>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border border-border bg-card p-6 space-y-4"
      >
        {step === 0 && (
          <>
            <h3 className="text-sm font-bold text-foreground">❶ إعداد البيئة</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>بيئة العمل</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (تجريبي)</SelectItem>
                    <SelectItem value="production">Production (إنتاجي)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>رمز OTP من بوابة فاتورة</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" dir="ltr" />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">كيف تحصل على OTP؟</p>
              <ol className="list-decimal mr-4 space-y-0.5">
                <li>ادخل بوابة فاتورة ZATCA</li>
                <li>اذهب إلى E-Invoice Onboarding</li>
                <li>اختر Generate OTP</li>
                <li>انسخ الرمز وألصقه هنا</li>
              </ol>
            </div>
            <Button onClick={handleSaveOtp} disabled={loading || !otp} className="gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeft size={14} />}
              التالي
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <h3 className="text-sm font-bold text-foreground">❷ شهادة الامتثال (Compliance CSID)</h3>
            {hasComplianceCert ? (
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="text-accent" size={20} />
                <div>
                  <p className="text-sm font-medium text-foreground">تم تسجيل شهادة الامتثال ✓</p>
                  <p className="text-xs text-muted-foreground">يمكنك المتابعة للخطوة التالية</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Compliance CSID (Base64)</Label>
                  <Input value={complianceCsid} onChange={(e) => setComplianceCsid(e.target.value)} dir="ltr" className="font-mono text-xs" placeholder="Base64 encoded CSID..." />
                </div>
                <div className="space-y-2">
                  <Label>Private Key (اختياري)</Label>
                  <Input value={compliancePrivateKey} onChange={(e) => setCompliancePrivateKey(e.target.value)} dir="ltr" className="font-mono text-xs" type="password" placeholder="EC Private Key..." />
                </div>
              </div>
            )}
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
              <AlertTriangle size={12} className="inline ml-1" />
              احصل على Compliance CSID عبر إرسال CSR مع OTP لبوابة ZATCA Developer Portal.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
                <ArrowRight size={14} />
                السابق
              </Button>
              {hasComplianceCert ? (
                <Button onClick={() => setStep(2)} className="gap-2">
                  <ArrowLeft size={14} />
                  التالي
                </Button>
              ) : (
                <Button onClick={handleSaveComplianceCsid} disabled={loading || !complianceCsid} className="gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  حفظ الشهادة
                </Button>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="text-sm font-bold text-foreground">❸ شهادة الإنتاج (Production CSID)</h3>
            {hasProductionCert ? (
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="text-accent" size={20} />
                <div>
                  <p className="text-sm font-medium text-foreground">🎉 ZATCA Phase 2 مفعّل بالكامل</p>
                  <p className="text-xs text-muted-foreground">يمكنك الآن إصدار فواتير إلكترونية متوافقة</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Production CSID (Base64)</Label>
                  <Input value={productionCsid} onChange={(e) => setProductionCsid(e.target.value)} dir="ltr" className="font-mono text-xs" placeholder="Base64 encoded Production CSID..." />
                </div>
                <div className="space-y-2">
                  <Label>Private Key (اختياري)</Label>
                  <Input value={productionPrivateKey} onChange={(e) => setProductionPrivateKey(e.target.value)} dir="ltr" className="font-mono text-xs" type="password" placeholder="EC Private Key..." />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowRight size={14} />
                السابق
              </Button>
              {!hasProductionCert && (
                <Button onClick={handleSaveProductionCsid} disabled={loading || !productionCsid} className="gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                  تفعيل الإنتاج
                </Button>
              )}
            </div>
          </>
        )}
      </motion.div>

      {/* Current certificates */}
      {certificates.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="text-xs font-bold text-foreground">الشهادات المسجلة</h4>
          <div className="space-y-2">
            {certificates.map(cert => (
              <div key={cert.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Key size={12} className="text-accent" />
                  <span className="font-medium">{cert.certificate_type === "compliance" ? "شهادة الامتثال" : "شهادة الإنتاج"}</span>
                  <span className="text-muted-foreground">({cert.environment})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono" dir="ltr">{cert.csid.substring(0, 16)}...</span>
                  {cert.is_active && <span className="text-accent text-[10px] font-bold">فعّال</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ZatcaOnboardingWizard;
