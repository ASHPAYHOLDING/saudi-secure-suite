/**
 * GatewaySetupPage — صفحة إعداد بوابة الدفع (Stripe / Geidea)
 * Route: /dashboard/integrations/gateway/:provider
 *
 * 3 تبويبات:
 *  1) الإعداد       — نموذج المفاتيح + Webhook
 *  2) دليل الاستخدام — تعليمات خطوة بخطوة
 *  3) رفع مشكلة    — نموذج تذكرة دعم مسبق التصنيف
 */

import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Key, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  Wifi, Copy, Link as LinkIcon, ShieldCheck,
  ChevronLeft, AlertTriangle, Lock, CreditCard,
  BookOpen, Headphones, Send, ExternalLink,
  ArrowLeft, Info, Zap, Settings2, MessageCircle,
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
  hidden:  { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.15 } },
};

// ── دليل الاستخدام لكل بوابة ──────────────────────────────────────────────────
const GATEWAY_GUIDES: Record<string, { steps: { title: string; desc: string; tip?: string }[]; faq: { q: string; a: string }[] }> = {
  stripe: {
    steps: [
      { title: "سجّل دخولك على Stripe Dashboard", desc: "اذهب إلى dashboard.stripe.com وسجّل دخولك بحسابك." },
      { title: "انتقل إلى إعدادات المطوّرين", desc: "من القائمة الجانبية اختر Developers → API Keys.", tip: "تأكد أنك في الوضع الصحيح (Live أو Test)" },
      { title: "انسخ Secret Key", desc: "اضغط على Reveal live key واحفظها — ستبدأ بـ sk_live_...", tip: "لا تشارك هذا المفتاح مع أحد أبداً" },
      { title: "أنشئ Webhook Endpoint", desc: "اذهب إلى Developers → Webhooks → Add Endpoint وأضف URL الخاص بنومكسيو.", tip: "اختر الأحداث: payment_intent.succeeded, charge.refunded" },
      { title: "انسخ Signing Secret", desc: "بعد إنشاء الـ Webhook، انقر عليه وانسخ Signing Secret — ستجده في قسم Webhook details." },
    ],
    faq: [
      { q: "هل يمكنني البدء بـ Test Mode؟", a: "نعم، يمكنك استخدام sk_test_... في البداية للتجربة ثم الانتقال لـ sk_live_ لاحقاً." },
      { q: "ماذا لو نسيت Secret Key؟", a: "لا يمكن استرداده — يجب إنشاء مفتاح جديد من Stripe Dashboard." },
      { q: "هل يدعم النظام Stripe Connect؟", a: "يدعم النظام Stripe القياسي حالياً. لـ Connect يرجى التواصل مع الدعم." },
    ],
  },
  geidea: {
    steps: [
      { title: "سجّل دخولك على Geidea Merchant Portal", desc: "اذهب إلى merchant.geidea.net وسجّل دخولك." },
      { title: "انتقل إلى Integration Settings", desc: "من القائمة اختر Integration → API Credentials." },
      { title: "انسخ Merchant Public Key", desc: "هذا المفتاح العام — يمكنك مشاركته بأمان نسبي.", tip: "تأكد أنك تستخدم بيانات الإنتاج وليس البيئة التجريبية" },
      { title: "انسخ API Password", desc: "كلمة المرور السرية — احفظها بأمان.", tip: "لا تضعها في أي كود مصدري أو رسائل" },
      { title: "أضف Webhook URL", desc: "من Webhooks → Add Webhook أضف URL نومكسيو وانسخ الـ Shared Secret." },
    ],
    faq: [
      { q: "ما الفرق بين البيئة التجريبية والإنتاجية؟", a: "البيئة التجريبية للاختبار فقط والمدفوعات وهمية. الإنتاجية تستقبل مدفوعات حقيقية." },
      { q: "لا أجد خيار Webhooks في البوابة؟", a: "يجب أن يكون حسابك مُفعّلاً بالكامل. تواصل مع فريق دعم Geidea." },
      { q: "هل يدعم نظام نومكسيو SAR و USD؟", a: "نعم، يدعم متعدد العملات بشكل تلقائي." },
    ],
  },
};

// ── المكون الرئيسي ─────────────────────────────────────────────────────────────

const GatewaySetupPage = () => {
  const { provider: providerParam } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const gatewayDef = GATEWAY_DEFS.find((d) => d.provider === providerParam);
  const guide = GATEWAY_GUIDES[providerParam || ""] || GATEWAY_GUIDES["stripe"];

  const initialCreds = () =>
    Object.fromEntries((gatewayDef?.credentialFields || []).map((f) => [f.key, ""]));

  const [creds, setCreds] = useState<Record<string, string>>(initialCreds);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<WizardStep>("credentials");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");

  // تذكرة الدعم
  const [ticketSubject, setTicketSubject] = useState(`مشكلة في إعداد ${gatewayDef?.nameAr || "بوابة الدفع"}`);
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const BRAND_DOMAIN = "numaxio.com";
  const webhookUrl = tenantId && gatewayDef
    ? `https://${BRAND_DOMAIN}/webhooks/${gatewayDef.webhookFnSlug}?tenant_id=${tenantId}`
    : "";

  // ── التحقق ─────────────────────────────────────────────────────────────────

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
      errs["webhook_secret"] = `${gatewayDef.webhookSecretLabel} مطلوب`;
    } else if (webhookSecret.trim().length < 8) {
      errs["webhook_secret"] = "السر قصير جداً (8 أحرف على الأقل)";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [creds, webhookSecret, gatewayDef]);

  // ── الحفظ والاختبار ──────────────────────────────────────────────────────────

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
        body: JSON.stringify({ provider: gatewayDef.provider, credentials: credPayload, webhookSecret: webhookSecret.trim() }),
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
      toast({ title: "تم الحفظ — الاختبار فشل", description: "البيانات محفوظة. راجع المفاتيح وأعد الاختبار لاحقاً.", variant: "destructive" });
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

  // ── رفع تذكرة دعم ───────────────────────────────────────────────────────────

  const submitTicket = async () => {
    if (!ticketDesc.trim()) {
      toast({ title: "يرجى كتابة تفاصيل المشكلة", variant: "destructive" });
      return;
    }
    if (!tenantId || !user) {
      toast({ title: "يجب تسجيل الدخول أولاً", variant: "destructive" });
      return;
    }
    setSubmittingTicket(true);
    try {
      const ticketNumber = `TK-${Date.now().toString(36).toUpperCase()}`;
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        ticket_number: ticketNumber,
        scope: "platform",
        tenant_id: tenantId,
        created_by: user.id,
        subject: ticketSubject.trim() || `مشكلة في إعداد ${gatewayDef?.nameAr}`,
        category: "payment_gateway",
        priority: ticketPriority,
        customer_name: profile?.full_name || "",
        customer_email: profile?.email || "",
      } as any).select().single();

      if (error) throw error;

      await supabase.from("ticket_replies").insert({
        ticket_id: (ticket as any).id,
        user_id: user.id,
        sender_type: "user",
        sender_name: profile?.full_name || "مستخدم",
        sender_email: profile?.email || "",
        content: `البوابة: ${gatewayDef?.nameAr}\n\n${ticketDesc.trim()}`,
      } as any);

      try {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            ticketId: (ticket as any).id,
            ticketNumber,
            subject: ticketSubject.trim(),
            category: "بوابة الدفع",
            priority: ticketPriority,
            senderName: profile?.full_name || "",
            senderEmail: profile?.email || "",
            content: ticketDesc.trim(),
            type: "new_ticket",
          },
        });
      } catch (_) { /* silent */ }

      toast({ title: `تم إرسال التذكرة ${ticketNumber} ✅`, description: "سيتواصل معك فريق الدعم قريباً." });
      setTicketDesc("");
    } catch (err: any) {
      toast({ title: "حدث خطأ", description: err.message, variant: "destructive" });
    }
    setSubmittingTicket(false);
  };

  // ── تقدم الخطوات ─────────────────────────────────────────────────────────────

  const VISIBLE = STEPS.filter((s) => s.key !== "error");
  const stepIdx = VISIBLE.findIndex((s) => s.key === step);
  const progress = stepIdx >= 0 ? Math.round((stepIdx / (VISIBLE.length - 1)) * 100) : 0;

  if (!gatewayDef) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">البوابة غير موجودة.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowLeft size={16} /> رجوع للتكاملات
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5" dir="rtl">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={() => navigate("/dashboard/paid-integrations")} className="hover:text-foreground transition-colors">
          التكاملات
        </button>
        <ChevronLeft size={14} className="rotate-180" />
        <span>بوابات الدفع</span>
        <ChevronLeft size={14} className="rotate-180" />
        <span className="text-foreground font-semibold">{gatewayDef.nameAr}</span>
      </nav>

      {/* ── رأس الصفحة ── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowLeft size={15} /> رجوع
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">إعداد {gatewayDef.nameAr}</h1>
            <p className="text-xs text-muted-foreground" dir="ltr">{gatewayDef.nameEn} Payment Gateway</p>
          </div>
          {step === "done" && (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 gap-1 shrink-0">
              <CheckCircle2 size={11} /> مفعّل
            </Badge>
          )}
        </div>
      </div>

      {/* ── التبويبات ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full grid grid-cols-3 h-11" dir="rtl">
          <TabsTrigger value="support" className="gap-1.5 text-sm">
            <Headphones size={14} /> رفع مشكلة
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5 text-sm">
            <BookOpen size={14} /> دليل الاستخدام
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5 text-sm">
            <Settings2 size={14} /> الإعداد
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ تبويب الإعداد ════════════════ */}
        <TabsContent value="setup" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-5">

              {/* شريط التقدم */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>التقدم</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between">
                  {VISIBLE.map((s, i) => (
                    <span key={s.key} className={cn(
                      "text-[10px] transition-colors",
                      s.key === step ? "text-primary font-bold" : i < stepIdx ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* محتوى الخطوة */}
              <AnimatePresence mode="wait">
                <motion.div key={step} variants={fadeSlide} initial="hidden" animate="visible" exit="exit" className="min-h-[300px]">

                  {/* ── بيانات الربط ── */}
                  {step === "credentials" && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-sm">
                        <Lock size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="space-y-0.5">
                          <p className="font-medium text-blue-800 dark:text-blue-300">أمان البيانات</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400">جميع المفاتيح تُشفَّر بـ AES-256-GCM ولا تُخزَّن بنص صريح أبداً.</p>
                        </div>
                      </div>

                      {gatewayDef.credentialFields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label className="text-sm font-medium">{field.label}</Label>
                          <div className="relative">
                            <Input
                              dir="ltr"
                              type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                              placeholder={field.placeholder}
                              value={creds[field.key] || ""}
                              onChange={(e) => {
                                setCreds((p) => ({ ...p, [field.key]: e.target.value }));
                                if (fieldErrors[field.key]) setFieldErrors((p) => { const n = { ...p }; delete n[field.key]; return n; });
                              }}
                              className={cn("font-mono pe-10", fieldErrors[field.key] && "border-destructive")}
                              autoComplete="off"
                            />
                            {field.secret && (
                              <button type="button" onClick={() => toggleSecret(field.key)}
                                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground" tabIndex={-1}>
                                {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            )}
                          </div>
                          {fieldErrors[field.key] && (
                            <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors[field.key]}</p>
                          )}
                          {field.hint && !fieldErrors[field.key] && (
                            <p className="text-xs text-muted-foreground">{field.hint}</p>
                          )}
                        </div>
                      ))}

                      {/* Webhook Secret */}
                      <div className="space-y-1.5 pt-1 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-amber-500" />
                            {gatewayDef.webhookSecretLabel}
                          </Label>
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">مطلوب</Badge>
                        </div>
                        <div className="relative">
                          <Input
                            dir="ltr"
                            type={showSecrets["ws"] ? "text" : "password"}
                            placeholder="السر المشترك من لوحة إعدادات البوابة"
                            value={webhookSecret}
                            onChange={(e) => { setWebhookSecret(e.target.value); if (fieldErrors["webhook_secret"]) setFieldErrors((p) => { const n = { ...p }; delete n["webhook_secret"]; return n; }); }}
                            className={cn("font-mono pe-10", fieldErrors["webhook_secret"] && "border-destructive")}
                            autoComplete="off"
                          />
                          <button type="button" onClick={() => toggleSecret("ws")}
                            className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground" tabIndex={-1}>
                            {showSecrets["ws"] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        {fieldErrors["webhook_secret"] ? (
                          <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors["webhook_secret"]}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{gatewayDef.webhookSecretHint}</p>
                        )}
                      </div>

                      <Button onClick={handleSubmit} className="w-full h-11 gap-2 mt-1">
                        <Key size={15} /> حفظ واختبار الاتصال
                      </Button>
                    </div>
                  )}

                  {/* ── جاري الحفظ ── */}
                  {step === "saving" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-16">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Loader2 size={30} className="text-primary animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">جاري الحفظ الآمن...</p>
                        <p className="text-sm text-muted-foreground mt-1">تشفير AES-256-GCM — لا تُغلق الصفحة</p>
                      </div>
                    </div>
                  )}

                  {/* ── جاري الاختبار ── */}
                  {step === "testing" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-16">
                      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <Wifi size={30} className="text-accent" />
                      </motion.div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">اختبار الاتصال مع {gatewayDef.nameEn}...</p>
                        <p className="text-sm text-muted-foreground mt-1">يتم التحقق من صلاحية المفاتيح</p>
                      </div>
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {/* ── Webhook ── */}
                  {step === "webhook" && (
                    <div className="space-y-4">
                      {testResult && (
                        <div className={cn(
                          "flex items-center gap-2.5 p-3.5 rounded-xl text-sm border",
                          testResult.success
                            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                            : "bg-destructive/10 border-destructive/20 text-destructive"
                        )}>
                          {testResult.success ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                          <span>{testResult.message}</span>
                        </div>
                      )}

                      <div className="space-y-3">
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          <LinkIcon size={14} className="text-primary" />
                          أضف هذا الـ URL في بوابة {gatewayDef.nameEn}
                        </p>

                        <div className="rounded-xl bg-muted/50 border p-3.5 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono text-foreground break-all flex-1" dir="ltr">{webhookUrl}</code>
                          </div>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 w-full" onClick={copyWebhook}>
                            {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
                            {copied ? "تم النسخ ✓" : "نسخ Webhook URL"}
                          </Button>
                        </div>

                        <div className="rounded-xl bg-muted/30 border p-3 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Header التوقيع المطلوب:</p>
                          <code className="text-xs font-mono text-foreground bg-muted rounded px-2 py-1 block" dir="ltr">
                            {gatewayDef.webhookSignatureHeader}
                          </code>
                        </div>

                        <a href={gatewayDef.docsUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline underline-offset-2">
                          <ExternalLink size={12} /> دليل الإعداد الرسمي
                        </a>
                      </div>

                      <Button onClick={() => setStep("done")} className="w-full h-11 gap-2">
                        <CheckCircle2 size={15} /> إنهاء الإعداد
                      </Button>
                    </div>
                  )}

                  {/* ── مكتمل ── */}
                  {step === "done" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 280, damping: 18 }}
                        className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                        <CheckCircle2 size={42} className="text-green-600 dark:text-green-400" />
                      </motion.div>
                      <div className="space-y-1">
                        <p className="text-xl font-bold text-foreground">{gatewayDef.nameAr} جاهزة ✅</p>
                        <p className="text-sm text-muted-foreground">البوابة مفعّلة وستعمل في الفواتير والمدفوعات تلقائياً</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {["الفواتير", "العقود", "الـ Webhooks", "تقارير المدفوعات"].map((a) => (
                          <Badge key={a} variant="outline" className="gap-1 text-xs bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                            <CheckCircle2 size={10} /> {a}
                          </Badge>
                        ))}
                      </div>
                      <Button onClick={() => navigate("/dashboard/paid-integrations")} className="w-full h-11 gap-2 mt-2">
                        العودة للتكاملات
                      </Button>
                    </div>
                  )}

                  {/* ── خطأ ── */}
                  {step === "error" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                        <XCircle size={32} className="text-destructive" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">حدث خطأ في الحفظ</p>
                        <p className="text-sm text-muted-foreground">تحقق من صحة البيانات وإعدادات المزود</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setStep("credentials")}>إعادة المحاولة</Button>
                        <Button variant="ghost" onClick={() => setActiveTab("support")} className="gap-1.5">
                          <Headphones size={14} /> رفع مشكلة
                        </Button>
                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>

              {/* تذييل الأمان */}
              {step !== "done" && step !== "error" && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 border-t pt-3">
                  <Lock size={10} className="text-amber-500" />
                  جميع الـ Webhooks مرفوضة بدون Webhook Secret صحيح — لا يوجد تجاوز أمني.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ تبويب دليل الاستخدام ════════════════ */}
        <TabsContent value="guide" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                خطوات الإعداد — {gatewayDef.nameAr}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              {guide.steps.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary mt-0.5">
                    {i + 1}
                  </div>
                  <div className="space-y-0.5 flex-1 pb-3 border-b last:border-b-0 last:pb-0">
                    <p className="font-medium text-sm text-foreground">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                    {s.tip && (
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-lg p-2">
                        <Info size={12} className="mt-0.5 shrink-0" /> {s.tip}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle size={16} className="text-blue-500" />
                أسئلة شائعة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              {guide.faq.map((item, i) => (
                <div key={i} className="space-y-1 pb-3 border-b last:border-b-0 last:pb-0">
                  <p className="font-medium text-sm text-foreground">{item.q}</p>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border">
            <div>
              <p className="text-sm font-medium text-foreground">وثائق {gatewayDef.nameEn} الرسمية</p>
              <p className="text-xs text-muted-foreground">للمزيد من التفاصيل التقنية</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={gatewayDef.docsUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink size={13} /> فتح الوثائق
              </a>
            </Button>
          </div>
        </TabsContent>

        {/* ════════════════ تبويب رفع مشكلة ════════════════ */}
        <TabsContent value="support" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones size={16} className="text-accent" />
                رفع مشكلة لفريق الدعم
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                سيتواصل معك فريق الدعم خلال 24 ساعة عمل.
              </p>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">

              {/* تصنيف مسبق */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border text-sm">
                <Badge variant="outline" className="gap-1 shrink-0"><CreditCard size={10} /> بوابة الدفع</Badge>
                <span className="text-muted-foreground text-xs">تم اختيار التصنيف تلقائياً بناءً على الصفحة الحالية</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">عنوان المشكلة</Label>
                <Input
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="وصف مختصر للمشكلة"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">الأولوية</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "low",    label: "منخفضة",  cls: "border-muted-foreground/30 text-muted-foreground" },
                    { value: "medium", label: "متوسطة",  cls: "border-amber-400/50 text-amber-600 dark:text-amber-400" },
                    { value: "high",   label: "عالية",   cls: "border-orange-400/50 text-orange-600 dark:text-orange-400" },
                    { value: "urgent", label: "عاجلة",   cls: "border-destructive/60 text-destructive" },
                  ].map((p) => (
                    <button key={p.value} type="button" onClick={() => setTicketPriority(p.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        ticketPriority === p.value ? `${p.cls} bg-current/10` : "border-border text-muted-foreground hover:border-foreground/20"
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">تفاصيل المشكلة *</Label>
                <Textarea
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  placeholder={`اشرح مشكلتك بالتفصيل...\n\nمثال: عند محاولة حفظ مفاتيح ${gatewayDef.nameAr} تظهر رسالة الخطأ التالية: ...`}
                  rows={5}
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  كلما كانت التفاصيل أكثر، كان الرد أسرع وأدق.
                </p>
              </div>

              <Button onClick={submitTicket} disabled={submittingTicket || !ticketDesc.trim()} className="w-full h-11 gap-2">
                {submittingTicket ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {submittingTicket ? "جاري الإرسال..." : "إرسال التذكرة"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GatewaySetupPage;
