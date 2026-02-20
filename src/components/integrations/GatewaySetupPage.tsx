/**
 * GatewaySetupPage
 * ─────────────────
 * صفحة كاملة لإعداد بوابة دفع (Stripe / Geidea) — بديل عن الـ Dialog
 * Route: /dashboard/integrations/gateway/:provider
 *
 * يحتوي على نفس منطق PaymentGatewayWizard لكن كصفحة داخلية مع Breadcrumb وزر رجوع
 */

import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Key, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  Wifi, WifiOff, Copy, Link as LinkIcon, ShieldCheck,
  ArrowRight, AlertTriangle, Lock, CreditCard, ChevronLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GATEWAY_DEFS } from "./PaymentGatewayWizard";

type WizardStep = "credentials" | "saving" | "testing" | "webhook" | "done" | "error";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "credentials", label: "بيانات الربط" },
  { key: "saving",      label: "حفظ آمن" },
  { key: "testing",     label: "اختبار" },
  { key: "webhook",     label: "Webhook" },
  { key: "done",        label: "مفعّل" },
];

const fadeSlide = {
  hidden:  { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.22, ease: "easeOut" as const } },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.15 } },
};

const GatewaySetupPage = () => {
  const { provider: providerParam } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const gatewayDef = GATEWAY_DEFS.find((d) => d.provider === providerParam);

  const initialCreds = () =>
    Object.fromEntries((gatewayDef?.credentialFields || []).map((f) => [f.key, ""]));

  const [creds, setCreds] = useState<Record<string, string>>(initialCreds);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<WizardStep>("credentials");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const BRAND_DOMAIN = "numaxio.com";
  const webhookUrl = tenantId && gatewayDef
    ? `https://${BRAND_DOMAIN}/webhooks/${gatewayDef.webhookFnSlug}?tenant_id=${tenantId}`
    : "";

  const validate = useCallback((): boolean => {
    if (!gatewayDef) return false;
    const errs: Record<string, string> = {};
    for (const field of gatewayDef.credentialFields) {
      const val = (creds[field.key] || "").trim();
      if (!val) { errs[field.key] = `${field.label} مطلوب`; continue; }
      if (field.validate) {
        const result = field.validate.safeParse(val);
        if (!result.success) errs[field.key] = result.error.errors[0].message;
      }
    }
    if (!webhookSecret.trim()) {
      errs["webhook_secret"] = `${gatewayDef.webhookSecretLabel} مطلوب — بدونه تُرفض جميع الـ Webhooks`;
    } else if (webhookSecret.trim().length < 8) {
      errs["webhook_secret"] = "السر قصير جداً (8 أحرف على الأقل)";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [creds, webhookSecret, gatewayDef]);

  const saveCredentials = async (): Promise<boolean> => {
    if (!gatewayDef) return false;
    setStep("saving");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("غير مسجّل الدخول");
      const credPayload = Object.fromEntries(
        Object.entries(creds).map(([k, v]) => [k, v.trim()])
      );
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: gatewayDef.provider,
          credentials: credPayload,
          webhookSecret: webhookSecret.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      return true;
    } catch (err: any) {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
      setStep("error");
      return false;
    }
  };

  const testConnection = async (): Promise<boolean> => {
    if (!gatewayDef) return false;
    setStep("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: gatewayDef.provider }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.message });
      return data.success;
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const saved = await saveCredentials();
    if (!saved) return;
    const tested = await testConnection();
    if (!tested) {
      setStep("webhook");
      toast({
        title: "تم الحفظ — الاختبار فشل",
        description: "تم حفظ البيانات بأمان. تحقق من المفاتيح ثم أعد الاختبار لاحقاً.",
        variant: "destructive",
      });
      return;
    }
    setStep("webhook");
  };

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "تم نسخ Webhook URL ✓" });
  };

  const toggleSecret = (key: string) =>
    setShowSecrets((p) => ({ ...p, [key]: !p[key] }));

  const VISIBLE = STEPS.filter((s) => s.key !== "error");
  const stepIdx = VISIBLE.findIndex((s) => s.key === step);
  const progress = stepIdx >= 0 ? Math.round((stepIdx / (VISIBLE.length - 1)) * 100) : 0;

  if (!gatewayDef) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">البوابة غير موجودة.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowRight size={16} /> رجوع للتكاملات
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6" dir="rtl">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => navigate("/dashboard/paid-integrations")}
          className="hover:text-foreground transition-colors"
        >
          التكاملات
        </button>
        <ChevronLeft size={14} className="rtl:rotate-180" />
        <span>بوابات الدفع</span>
        <ChevronLeft size={14} className="rtl:rotate-180" />
        <span className="text-foreground font-medium">{gatewayDef.nameAr}</span>
      </nav>

      {/* ── Back button ── */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/dashboard/paid-integrations")}
      >
        <ArrowRight size={16} /> رجوع للتكاملات
      </Button>

      {/* ── Main Card ── */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">إعداد {gatewayDef.nameAr}</h1>
              <p className="text-sm text-muted-foreground" dir="ltr">{gatewayDef.nameEn}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} className="h-1.5" />
            <div className="flex justify-between">
              {VISIBLE.map((s, i) => (
                <span
                  key={s.key}
                  className={cn(
                    "text-[10px] transition-colors",
                    s.key === step ? "text-accent font-bold" : i < stepIdx ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={fadeSlide}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="min-h-[280px]"
            >

              {/* ── Credentials ── */}
              {step === "credentials" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                    <Lock size={13} className="mt-0.5 shrink-0 text-accent" />
                    <span>جميع البيانات تُشفَّر بـ AES-256-GCM قبل التخزين ولا تُقرأ أبداً من العميل.</span>
                  </div>

                  {gatewayDef.credentialFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs font-medium">{field.label}</Label>
                      <div className="relative">
                        <Input
                          dir="ltr"
                          type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={creds[field.key] || ""}
                          onChange={(e) => {
                            setCreds((p) => ({ ...p, [field.key]: e.target.value }));
                            if (fieldErrors[field.key])
                              setFieldErrors((p) => { const n = { ...p }; delete n[field.key]; return n; });
                          }}
                          className={cn(
                            "font-mono text-sm pe-10",
                            fieldErrors[field.key] && "border-destructive focus-visible:ring-destructive"
                          )}
                          autoComplete="off"
                        />
                        {field.secret && (
                          <button
                            type="button"
                            onClick={() => toggleSecret(field.key)}
                            className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                      {fieldErrors[field.key] && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle size={11} /> {fieldErrors[field.key]}
                        </p>
                      )}
                      {field.hint && !fieldErrors[field.key] && (
                        <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                      )}
                    </div>
                  ))}

                  {/* Webhook Secret */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-accent" />
                      {gatewayDef.webhookSecretLabel}
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 py-0">
                        مطلوب
                      </Badge>
                    </Label>
                    <div className="relative">
                      <Input
                        dir="ltr"
                        type={showSecrets["ws"] ? "text" : "password"}
                        placeholder="السر المشترك من لوحة إعدادات البوابة"
                        value={webhookSecret}
                        onChange={(e) => {
                          setWebhookSecret(e.target.value);
                          if (fieldErrors["webhook_secret"])
                            setFieldErrors((p) => { const n = { ...p }; delete n["webhook_secret"]; return n; });
                        }}
                        className={cn(
                          "font-mono text-sm pe-10",
                          fieldErrors["webhook_secret"] && "border-destructive focus-visible:ring-destructive"
                        )}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSecret("ws")}
                        className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showSecrets["ws"] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {fieldErrors["webhook_secret"] ? (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle size={11} /> {fieldErrors["webhook_secret"]}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">{gatewayDef.webhookSecretHint}</p>
                    )}
                  </div>

                  <Button onClick={handleSubmit} className="w-full gap-2 mt-2">
                    <Key size={15} /> حفظ واختبار الاتصال
                  </Button>
                </div>
              )}

              {/* ── Saving ── */}
              {step === "saving" && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <Loader2 size={32} className="text-accent animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">جاري الحفظ الآمن...</p>
                    <p className="text-xs text-muted-foreground mt-1">تشفير AES-256-GCM — لا تُغلق الصفحة</p>
                  </div>
                </div>
              )}

              {/* ── Testing ── */}
              {step === "testing" && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center"
                  >
                    <Wifi size={32} className="text-accent" />
                  </motion.div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">اختبار الاتصال مع {gatewayDef.nameEn}...</p>
                    <p className="text-xs text-muted-foreground mt-1">يتم التحقق من صلاحية المفاتيح</p>
                  </div>
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* ── Webhook info ── */}
              {step === "webhook" && (
                <div className="space-y-4">
                  {testResult && (
                    <div className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl text-sm border",
                      testResult.success
                        ? "bg-accent/10 border-accent/20 text-accent"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    )}>
                      {testResult.success
                        ? <CheckCircle2 size={16} className="shrink-0" />
                        : <AlertTriangle size={16} className="shrink-0" />}
                      {testResult.message}
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <LinkIcon size={14} className="text-accent" />
                      أضف هذا الـ URL في بوابة {gatewayDef.nameEn}
                    </p>

                    <div className="rounded-xl bg-muted/60 border p-3 space-y-2">
                      <p className="text-[11px] text-muted-foreground font-mono break-all" dir="ltr">
                        {webhookUrl}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-7 w-full"
                        onClick={copyWebhook}
                      >
                        {copied ? <CheckCircle2 size={12} className="text-accent" /> : <Copy size={12} />}
                        {copied ? "تم النسخ ✓" : "نسخ Webhook URL"}
                      </Button>
                    </div>

                    <div className="rounded-xl bg-muted/40 border p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Header التوقيع المطلوب:</p>
                      <code className="text-xs font-mono text-foreground bg-muted rounded px-2 py-1 block" dir="ltr">
                        {gatewayDef.webhookSignatureHeader}
                      </code>
                    </div>

                    <a
                      href={gatewayDef.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent underline-offset-2 hover:underline flex items-center gap-1"
                    >
                      دليل الإعداد الرسمي ←
                    </a>
                  </div>

                  <Button onClick={() => setStep("done")} className="w-full gap-2">
                    <CheckCircle2 size={15} /> إنهاء الإعداد
                  </Button>
                </div>
              )}

              {/* ── Done ── */}
              {step === "done" && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                    className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center"
                  >
                    <CheckCircle2 size={42} className="text-accent" />
                  </motion.div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-bold text-foreground">{gatewayDef.nameAr} جاهزة ✅</p>
                    <p className="text-sm text-muted-foreground">
                      البوابة مفعّلة وستعمل في الفواتير والمدفوعات تلقائياً
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["الفواتير", "العقود", "الـ Webhooks", "تقارير المدفوعات"].map((a) => (
                      <Badge key={a} variant="outline" className="gap-1 text-xs bg-accent/5 text-accent border-accent/20">
                        <CheckCircle2 size={10} /> {a}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    onClick={() => navigate("/dashboard/paid-integrations")}
                    className="w-full gap-2 mt-2"
                  >
                    <ArrowRight size={15} /> العودة للتكاملات
                  </Button>
                </div>
              )}

              {/* ── Error ── */}
              {step === "error" && (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <XCircle size={32} className="text-destructive" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">حدث خطأ في الحفظ</p>
                    <p className="text-xs text-muted-foreground mt-1">تحقق من البيانات وإعدادات المزود</p>
                  </div>
                  <Button variant="outline" onClick={() => setStep("credentials")} className="gap-2">
                    <ArrowRight size={14} /> إعادة المحاولة
                  </Button>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Security note */}
          {step !== "done" && step !== "error" && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 border-t pt-3">
              <Lock size={10} className="text-accent" />
              تُرفض جميع الـ Webhooks بدون Webhook Secret صحيح — لا يوجد تجاوز أمني.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GatewaySetupPage;
