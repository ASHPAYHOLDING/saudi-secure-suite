/**
 * PaymentGatewayWizard
 * ─────────────────────
 * Standalone Wizard for configuring Stripe / Geidea (and any future
 * payment_gateway integration). Opened from PaidIntegrationsPage when
 * the user clicks "تفعيل" on a payment_gateway card.
 *
 * Flow:
 *  credentials → save (via provider-save EF) → test → webhook info → done
 *
 * Security:
 *  - NEVER writes to tenant_payment_providers directly from the client.
 *  - All credentials are sent to provider-save Edge Function which
 *    encrypts with AES-GCM before storing.
 *  - Webhook secret mandatory (validated before save).
 *  - Input masking on secret fields.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Key, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  Wifi, WifiOff, Copy, Link as LinkIcon, ShieldCheck,
  ArrowLeft, AlertTriangle, Lock, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "credentials" | "saving" | "testing" | "webhook" | "done" | "error";

export interface GatewayDef {
  provider: "stripe" | "geidea";            // maps to tenant_payment_providers.provider
  integrationKey: string;                   // paid_integrations.key  (pay_stripe / pay_geidea)
  nameAr: string;
  nameEn: string;
  color: string;
  webhookFnSlug: string;                    // e.g. stripe-webhook
  webhookSignatureHeader: string;           // header the provider sends
  credentialFields: {
    key: string;
    label: string;
    placeholder: string;
    secret?: boolean;
    hint?: string;
    validate?: z.ZodString;
  }[];
  webhookSecretLabel: string;
  webhookSecretHint: string;
  docsUrl: string;
}

// ─── Gateway definitions ──────────────────────────────────────────────────────

export const GATEWAY_DEFS: GatewayDef[] = [
  {
    provider: "stripe",
    integrationKey: "pay_stripe",
    nameAr: "سترايب",
    nameEn: "Stripe",
    color: "from-indigo-500/10 to-indigo-600/5 border-indigo-200",
    webhookFnSlug: "stripe-webhook",
    webhookSignatureHeader: "Stripe-Signature",
    credentialFields: [
      {
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_... أو sk_test_...",
        secret: true,
        hint: "من Stripe Dashboard → Developers → API Keys",
        validate: z.string()
          .min(20, "المفتاح قصير جداً")
          .regex(/^sk_(live|test)_/, "يجب أن يبدأ بـ sk_live_ أو sk_test_"),
      },
      {
        key: "publishable_key",
        label: "Publishable Key (اختياري للعرض على الواجهة)",
        placeholder: "pk_live_... أو pk_test_...",
        hint: "من Stripe Dashboard → Developers → API Keys",
      },
    ],
    webhookSecretLabel: "Webhook Signing Secret",
    webhookSecretHint: "من Stripe Dashboard → Webhooks → Signing secret",
    docsUrl: "https://docs.stripe.com/webhooks",
  },
  {
    provider: "geidea",
    integrationKey: "pay_geidea",
    nameAr: "جيديا",
    nameEn: "Geidea",
    color: "from-orange-500/10 to-orange-600/5 border-orange-200",
    webhookFnSlug: "geidea-webhook",
    webhookSignatureHeader: "X-Geidea-Signature",
    credentialFields: [
      {
        key: "merchant_public_key",
        label: "Merchant Public Key",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        hint: "من Geidea Merchant Portal → Integration → API Credentials",
        validate: z.string()
          .min(10, "المفتاح قصير جداً")
          .regex(/^[0-9a-fA-F-]{32,}$/, "تنسيق UUID/Key غير صالح"),
      },
      {
        key: "api_password",
        label: "API Password",
        placeholder: "كلمة المرور من بوابة Geidea",
        secret: true,
        hint: "من Geidea Merchant Portal → Integration → API Credentials",
        validate: z.string().min(6, "كلمة المرور قصيرة جداً"),
      },
    ],
    webhookSecretLabel: "Webhook Shared Secret",
    webhookSecretHint: "من Geidea Merchant Portal → Webhooks",
    docsUrl: "https://docs.geidea.net/",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  gatewayDef: GatewayDef;
  tenantId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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

export const PaymentGatewayWizard = ({ gatewayDef, tenantId, open, onClose, onSuccess }: Props) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  // Credential values
  const initialCreds = () => Object.fromEntries(gatewayDef.credentialFields.map((f) => [f.key, ""]));
  const [creds, setCreds] = useState<Record<string, string>>(initialCreds);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Wizard state
  const [step, setStep] = useState<WizardStep>("credentials");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};

    for (const field of gatewayDef.credentialFields) {
      const val = (creds[field.key] || "").trim();
      if (!val) {
        errs[field.key] = `${field.label} مطلوب`;
        continue;
      }
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

  // ── Save via Edge Function ──────────────────────────────────────────────────

  const saveCredentials = async (): Promise<boolean> => {
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

  // ── Test Connection ─────────────────────────────────────────────────────────

  const testConnection = async (): Promise<boolean> => {
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

  // ── Main submit flow ────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return;

    const saved = await saveCredentials();
    if (!saved) return;

    const tested = await testConnection();
    if (!tested) {
      // Allow proceeding even if test fails — credentials are saved
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Display branded URL — the actual backend endpoint is proxied via Cloudflare
  const BRAND_DOMAIN = "numaxio.com";
  const webhookUrl = tenantId
    ? `https://${BRAND_DOMAIN}/webhooks/${gatewayDef.webhookFnSlug}?tenant_id=${tenantId}`
    : "";

  // Actual backend URL used internally (never shown to user)
  const _internalWebhookUrl = tenantId
    ? `${supabaseUrl}/functions/v1/${gatewayDef.webhookFnSlug}?tenant_id=${tenantId}`
    : "";

  const copyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "تم نسخ Webhook URL ✓" });
  };

  const toggleSecret = (key: string) =>
    setShowSecrets((p) => ({ ...p, [key]: !p[key] }));

  const handleClose = () => {
    // Reset
    setCreds(initialCreds());
    setWebhookSecret("");
    setShowSecrets({});
    setStep("credentials");
    setFieldErrors({});
    setTestResult(null);
    setCopied(false);
    onClose();
  };

  const handleDone = () => {
    handleClose();
    onSuccess();
  };

  // ── Step index for progress ──────────────────────────────────────────────────

  const VISIBLE = STEPS.filter((s) => s.key !== "error");
  const stepIdx = VISIBLE.findIndex((s) => s.key === step);
  const progress = stepIdx >= 0 ? Math.round((stepIdx / (VISIBLE.length - 1)) * 100) : 0;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-lg">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard size={18} className="text-primary" />
            </div>
            إعداد {gatewayDef.nameAr}
          </DialogTitle>
          <DialogDescription>
            {step === "credentials" && "أدخل بيانات الربط الخاصة بحسابك — تُشفَّر قبل التخزين"}
            {step === "saving"      && "جاري الحفظ الآمن..."}
            {step === "testing"     && "اختبار الاتصال مع البوابة..."}
            {step === "webhook"     && "أضف Webhook URL في إعدادات بوابتك"}
            {step === "done"        && `${gatewayDef.nameAr} مفعّلة وجاهزة لاستقبال المدفوعات`}
            {step === "error"       && "حدث خطأ — تحقق من البيانات وأعد المحاولة"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2 py-1">
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
            className="min-h-[220px] py-2"
          >

            {/* ── Credentials ── */}
            {step === "credentials" && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                  <Lock size={13} className="mt-0.5 shrink-0 text-accent" />
                  <span>جميع البيانات تُشفَّر بـ AES-256-GCM قبل التخزين ولا تُقرأ أبداً من العميل.</span>
                </div>

                {/* Credential fields */}
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

                {/* Webhook Secret — MANDATORY */}
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
              <div className="flex flex-col items-center justify-center gap-4 py-8">
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
              <div className="flex flex-col items-center justify-center gap-4 py-8">
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
                {/* Test result badge */}
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
                    <ArrowLeft size={11} className="rotate-180" /> دليل الإعداد الرسمي
                  </a>
                </div>

                <Button onClick={() => setStep("done")} className="w-full gap-2">
                  <CheckCircle2 size={15} /> إنهاء الإعداد
                </Button>
              </div>
            )}

            {/* ── Done ── */}
            {step === "done" && (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center"
                >
                  <CheckCircle2 size={42} className="text-accent" />
                </motion.div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-foreground">
                    {gatewayDef.nameAr} جاهزة ✅
                  </p>
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
                <Button onClick={handleDone} className="w-full gap-2 mt-2">
                  <ArrowLeft size={15} className="rotate-180" /> العودة للتكاملات
                </Button>
              </div>
            )}

            {/* ── Error ── */}
            {step === "error" && (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <XCircle size={32} className="text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">حدث خطأ في الحفظ</p>
                  <p className="text-xs text-muted-foreground mt-1">تحقق من البيانات وإعدادات المزود</p>
                </div>
                <Button variant="outline" onClick={() => setStep("credentials")} className="gap-2">
                  <ArrowLeft size={14} /> إعادة المحاولة
                </Button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Security note */}
        {step !== "done" && step !== "error" && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 border-t pt-3 mt-1">
            <Lock size={10} className="text-accent" />
            تُرفض جميع الـ Webhooks بدون Webhook Secret صحيح — لا يوجد تجاوز أمني.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentGatewayWizard;
