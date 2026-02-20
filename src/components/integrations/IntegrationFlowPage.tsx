/**
 * IntegrationFlowPage — صفحة تفعيل التكامل
 * Route: /dashboard/integrations/setup/:integrationId
 *
 * 3 تبويبات:
 *  1) الإعداد       — خطوات الشراء + API Keys + الاختبار
 *  2) دليل الاستخدام — تعليمات وأسئلة شائعة
 *  3) رفع مشكلة    — نموذج تذكرة دعم مسبق التصنيف
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ChevronLeft, Loader2, CheckCircle2, Wifi, WifiOff,
  CreditCard, Key, Lock, ShieldCheck, Sparkles, Wallet,
  Settings2, CircleDot, Unlock, BookOpen, Headphones, Send,
  ExternalLink, Info, Zap, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FlowStep = "preview" | "payment" | "paying" | "api_keys" | "testing" | "done";

const FLOW_STEPS: { key: FlowStep; label: string; icon: any }[] = [
  { key: "preview",  label: "عرض التكامل",   icon: CircleDot },
  { key: "payment",  label: "الدفع",          icon: CreditCard },
  { key: "paying",   label: "إتمام الدفع",    icon: ShieldCheck },
  { key: "api_keys", label: "إعداد المفاتيح", icon: Key },
  { key: "testing",  label: "اختبار الاتصال", icon: Wifi },
  { key: "done",     label: "مفعّل",          icon: CheckCircle2 },
];

// ── أدلة الاستخدام الخاصة بكل تكامل ────────────────────────────────────────────
const INTEGRATION_GUIDES: Record<string, {
  steps: { title: string; desc: string; tip?: string }[];
  faq: { q: string; a: string }[];
}> = {
  // ── محاسبة ──
  foodics: {
    steps: [
      { title: "ربط حساب فودكس", desc: "سجّل دخولك على dashboard.foodics.com وانتقل إلى Settings → Developer → API Keys.", tip: "تأكد أن حسابك لديه صلاحيات Business أو Owner" },
      { title: "أنشئ مفتاح API", desc: "اضغط Create Token، اختر الصلاحيات المطلوبة (Orders, Products, Customers)، ثم انسخ الـ Token." },
      { title: "أدخل المفتاح هنا", desc: "الصق مفتاح API في خانة الإعداد، سيتم تشفيره فوراً وبشكل آمن." },
      { title: "ابدأ الاستخدام", desc: "ستظهر بيانات الفواتير والمبيعات من فودكس تلقائياً في لوحة التقارير.", tip: "يُحدَّث السجل كل 15 دقيقة تلقائياً" },
    ],
    faq: [
      { q: "ما الصلاحيات المطلوبة لمفتاح فودكس؟", a: "Orders (Read), Products (Read)، وCustomers (Read) كافية للتشغيل الأساسي." },
      { q: "هل يعمل مع فودكس الإصدار القديم؟", a: "يدعم النظام الإصدار F5 وما فوق. تأكد من تحديث حسابك." },
      { q: "كيف أعرف إذا كان الربط يعمل؟", a: "ستظهر آخر 5 فواتير من فودكس في لوحة التقارير خلال دقيقتين من الإعداد." },
    ],
  },
  zatca: {
    steps: [
      { title: "الحصول على بيانات هيئة الزكاة", desc: "تأكد من تسجيل منشأتك في بوابة فاتورة على fatoora.zatca.gov.sa." },
      { title: "إدخال الرقم الضريبي", desc: "أدخل الرقم الضريبي المكوّن من 15 رقماً كما هو مسجل في هيئة الزكاة والضريبة." },
      { title: "توليد شهادة CSR", desc: "سيقوم النظام تلقائياً بإنشاء طلب الشهادة (CSR) ورفعه لهيئة الزكاة.", tip: "قد تستغرق العملية حتى 24 ساعة" },
      { title: "تفعيل المرحلة الثانية", desc: "بعد قبول الشهادة، سيُفعَّل إصدار الفواتير الإلكترونية المتوافقة مع المرحلة الثانية تلقائياً." },
    ],
    faq: [
      { q: "ما الفرق بين المرحلة الأولى والثانية من زاتكا؟", a: "المرحلة الأولى إصدار فواتير إلكترونية، المرحلة الثانية ربط مباشر مع منظومة هيئة الزكاة." },
      { q: "هل يمكنني الاستمرار في العمل أثناء التفعيل؟", a: "نعم، الفواتير العادية تستمر بشكل طبيعي حتى اكتمال ربط زاتكا." },
      { q: "ماذا أفعل إذا رُفض طلب الشهادة؟", a: "تحقق من صحة بياناتك في بوابة فاتورة أو تواصل مع الدعم الفني." },
    ],
  },
  ocr: {
    steps: [
      { title: "رفع الفواتير الورقية", desc: "انتقل لقسم الفواتير واضغط 'رفع فاتورة'، ثم اختر صورة أو PDF للفاتورة." },
      { title: "مراجعة البيانات المستخرجة", desc: "سيستخرج الذكاء الاصطناعي بيانات الفاتورة تلقائياً — راجعها وعدّل ما يلزم.", tip: "الصور عالية الدقة تعطي نتائج أدق" },
      { title: "اعتماد وحفظ الفاتورة", desc: "بعد التحقق، اضغط 'اعتماد' لحفظ الفاتورة في النظام بشكل نهائي." },
      { title: "تتبع الفواتير المُستخرجة", desc: "تجد جميع الفواتير المُستخرجة بالـ OCR في تبويب 'الفواتير الواردة' مع حالة كل منها." },
    ],
    faq: [
      { q: "ما أنواع الملفات المدعومة؟", a: "PDF، JPG، PNG، وTIFF بحجم أقصى 10 ميجابايت للملف الواحد." },
      { q: "ما مدى دقة استخراج البيانات؟", a: "دقة متوسطة 94% للفواتير العربية والإنجليزية. الصور الواضحة تعطي نتائج أعلى." },
      { q: "هل يدعم الفواتير العربية؟", a: "نعم، يدعم العربية والإنجليزية وثنائية اللغة بشكل كامل." },
    ],
  },
  crm: {
    steps: [
      { title: "إضافة بيانات العملاء", desc: "انتقل لقسم العملاء وأضف العملاء يدوياً أو استورد من Excel." },
      { title: "ربط العملاء بالفواتير", desc: "عند إنشاء فاتورة، اختر العميل من القائمة لربط جميع معاملاته تلقائياً." },
      { title: "متابعة سجل العميل", desc: "اضغط على أي عميل لرؤية كامل تاريخ معاملاته، الفواتير، والمدفوعات.", tip: "يمكنك إضافة ملاحظات وتذكيرات لكل عميل" },
      { title: "تحليلات العملاء", desc: "تجد في التقارير تحليلاً لأفضل العملاء والديون المستحقة ومتوسط وقت الدفع." },
    ],
    faq: [
      { q: "كم عدد العملاء الذي يمكنني إضافته؟", a: "لا يوجد حد في الباقات المدفوعة. الباقة المجانية تسمح بـ 50 عميلاً." },
      { q: "هل يمكن استيراد العملاء من Excel؟", a: "نعم، من قسم العملاء → استيراد، بتنسيق CSV أو Excel." },
      { q: "هل يُرسل النظام تذكيرات للعملاء تلقائياً؟", a: "نعم عبر تفعيل 'تذكيرات الدفع' من إعدادات الشركة." },
    ],
  },
  inventory: {
    steps: [
      { title: "إضافة المنتجات والمستودعات", desc: "انتقل لقسم المخزون وأضف منتجاتك مع تحديد كميات البداية لكل مستودع." },
      { title: "ربط المخزون بالفواتير", desc: "عند إنشاء فاتورة بيع، يُخصم المخزون تلقائياً من المستودع المحدد.", tip: "تأكد من ضبط مستوى التنبيه للمخزون المنخفض" },
      { title: "متابعة حركة المخزون", desc: "تجد سجلاً كاملاً لجميع عمليات الإدخال والإخراج في قسم حركات المخزون." },
      { title: "جرد المخزون الدوري", desc: "استخدم خاصية الجرد لمطابقة الكميات الفعلية مع الأرصدة في النظام." },
    ],
    faq: [
      { q: "هل يدعم النظام تتبع الدُّفعات (Batch Tracking)؟", a: "نعم، يدعم تتبع الدفعات وتواريخ الانتهاء للمنتجات." },
      { q: "ماذا يحدث إذا نفد المخزون وأصدرت فاتورة؟", a: "يُنبّهك النظام ويمكنك السماح بالبيع المكشوف أو إيقافه من الإعدادات." },
      { q: "هل يمكن نقل المخزون بين المستودعات؟", a: "نعم، من قسم المخزون → تحويلات المستودعات." },
    ],
  },
  accounting: {
    steps: [
      { title: "إعداد شجرة الحسابات", desc: "انتقل للمالية → شجرة الحسابات وتحقق من الحسابات الافتراضية أو أضف حسابات مخصصة." },
      { title: "ربط الحسابات بالعمليات", desc: "يُنشئ النظام قيوداً محاسبية تلقائياً عند كل فاتورة ومدفوعات ومصروفات.", tip: "راجع إعدادات الحسابات الافتراضية لكل نوع عملية" },
      { title: "القوائم المالية", desc: "من قسم التقارير → المالية، ستجد الميزانية العمومية وقائمة الدخل ومتاحة دائماً." },
      { title: "إقفال الفترات المحاسبية", desc: "في نهاية كل شهر، قفّل الفترة لمنع التعديل على القيود المحاسبية المؤرخة." },
    ],
    faq: [
      { q: "هل يدعم النظام معايير IFRS؟", a: "نعم، تتوافق التقارير مع معايير المحاسبة الدولية وكذلك متطلبات هيئة الزكاة." },
      { q: "هل يمكن تصدير القيود المحاسبية؟", a: "نعم، يمكن تصديرها بصيغة Excel أو PDF من قسم القيود المحاسبية." },
      { q: "من يمكنه الوصول للتقارير المالية؟", a: "المدير المالي والمحاسب فقط افتراضياً. يمكن تعديل الصلاحيات من إعدادات الفريق." },
    ],
  },
  // ── دليل افتراضي لأي تكامل غير معروف ──
  default: {
    steps: [
      { title: "إدخال مفتاح API", desc: "أدخل مفتاح API الخاص بك من إعدادات حسابك في الخدمة الخارجية في تبويب الإعداد.", tip: "يُخزَّن المفتاح بشكل مشفَّر ولا يُعرض مجدداً" },
      { title: "اختبار الاتصال", desc: "بعد الحفظ، يختبر النظام تلقائياً صحة الربط مع الخدمة الخارجية." },
      { title: "بدء الاستخدام", desc: "بعد نجاح الاختبار، يُفعَّل التكامل في جميع أقسام النظام ذات الصلة.", tip: "ستظهر أيقونة ✅ عند اكتمال الإعداد" },
      { title: "تجديد المفاتيح", desc: "إذا غيّرت مفتاح API في الخدمة الخارجية، عُد لهذه الصفحة وحدّثه.", tip: "يُنصح بتغيير المفاتيح دورياً لأسباب أمنية" },
    ],
    faq: [
      { q: "هل يمكن تعطيل التكامل مؤقتاً؟", a: "نعم، يمكنك إيقافه من صفحة التكاملات دون فقدان إعداداتك." },
      { q: "ماذا يحدث لو انتهت صلاحية المفتاح؟", a: "يتوقف التكامل عن العمل ويصلك إشعار. قم بتحديث المفتاح من هذه الصفحة." },
      { q: "هل البيانات المرسلة آمنة؟", a: "جميع البيانات مشفَّرة بـ AES-256-GCM ولا تُرسَل أبداً بنص صريح." },
      { q: "كيف أعرف أن التكامل يعمل؟", a: "ستظهر علامة ✅ خضراء في صفحة التكاملات، ويمكنك اختبار الاتصال في أي وقت." },
    ],
  },
};

interface IntegrationState {
  integration_id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  integration_type: string;
  price_once: number;
  is_ready: boolean;
  requires_api_keys: boolean;
  api_key_label: string;
  trial_days: number;
  tenant_activation_status: string;
  activation_source: string | null;
  has_secret_configured: boolean;
  entitlement_allowed: boolean;
  entitlement_reason: string;
  can_activate: boolean;
}

const IntegrationFlowPage = () => {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();

  const [integrationState, setIntegrationState] = useState<IntegrationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [flowStep, setFlowStep] = useState<FlowStep>("preview");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "fail">("idle");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paylink">("paylink");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletExists, setWalletExists] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paylinkTransactionNo, setPaylinkTransactionNo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("setup");

  // تذكرة الدعم
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const isTrial       = integrationState?.entitlement_reason === "trial";
  const isEnterprise  = integrationState?.entitlement_reason === "plan" && integrationState?.entitlement_allowed;
  const hasFreeAccess = isTrial || isEnterprise;
  const isPurchased   = integrationState?.tenant_activation_status !== "none";

  const fetchState = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any).rpc("get_paid_integrations_state", { p_tenant_id: tenantId });
    if (data) {
      const match = (data as any[]).find((r: any) => r.integration_id === integrationId);
      if (match) {
        setIntegrationState(match as IntegrationState);
        setTicketSubject(`مشكلة في تكامل ${match.name_ar}`);
        if (match.tenant_activation_status !== "none") {
          if (match.requires_api_keys && !match.has_secret_configured) setFlowStep("api_keys");
          else if (match.tenant_activation_status === "active") setFlowStep("done");
          else setFlowStep("api_keys");
        }
      }
    }
    setLoading(false);
  }, [tenantId, integrationId]);

  const fetchWalletBalance = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=get-balance`,
        { headers: { Authorization: `Bearer ${session?.session?.access_token}` } }
      );
      const data = await res.json();
      setWalletBalance(data.balance_available ?? 0);
      setWalletExists(data.exists ?? false);
    } catch {
      setWalletBalance(0);
      setWalletExists(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    fetchWalletBalance();
  }, [fetchState, fetchWalletBalance]);

  // ── منطق التفعيل والدفع ──────────────────────────────────────────────────────

  const handleFreeAutoActivate = async () => {
    if (!integrationState) return;
    setSaving(true);
    const source = isTrial ? "trial_auto" : "enterprise_auto";
    const label  = isTrial ? "الفترة التجريبية" : "باقة المؤسسات";
    try {
      const { error } = await (supabase as any).from("tenant_paid_integrations").upsert({
        tenant_id: tenantId,
        integration_id: integrationState.integration_id,
        status: integrationState.requires_api_keys ? "disabled" : "active",
        activated_by: user!.id,
        purchased_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        activation_source: source,
      }, { onConflict: "tenant_id,integration_id" });
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      toast({ title: "تم التفعيل تلقائياً ✅", description: `${integrationState.name_ar} — مضمّن في ${label}` });
      fetchState();
      setFlowStep(integrationState.requires_api_keys ? "api_keys" : "done");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleWalletPurchase = async () => {
    if (!integrationState || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=purchase-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({ integrationId: integrationState.integration_id }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast({ title: "فشل الشراء", description: result.error || "حدث خطأ", variant: "destructive" });
        return;
      }
      toast({ title: "تم الشراء بنجاح ✅", description: `${integrationState.name_ar} — الرصيد المتبقي: ${result.new_balance} ر.س` });
      setWalletBalance(result.new_balance);
      fetchState();
      setFlowStep(result.requires_api_keys ? "api_keys" : "done");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handlePaylink = async () => {
    if (!integrationState || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: profData } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      const orderNumber = `INT-${integrationState.key}-${Date.now()}`;
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=create-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({
            amount: integrationState.price_once,
            clientName: profData?.full_name || "عميل",
            clientMobile: "0500000000",
            clientEmail: profData?.email || user.email || "",
            orderNumber,
            note: `شراء تكامل: ${integrationState.name_ar}`,
            callBackUrl: window.location.href,
            products: [{ title: integrationState.name_ar, price: integrationState.price_once, qty: 1, description: `تكامل ${integrationState.name_en}` }],
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast({ title: "خطأ في إنشاء الفاتورة", description: result.error || "حدث خطأ", variant: "destructive" });
        return;
      }
      setPaymentUrl(result.paymentUrl);
      setPaylinkTransactionNo(result.transactionNo);
      setFlowStep("paying");
      window.open(result.paymentUrl, "_blank");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleConfirmPayment = async () => {
    if (!paylinkTransactionNo || !integrationState || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const statusRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=check-status&transactionNo=${paylinkTransactionNo}`,
        { headers: { Authorization: `Bearer ${session?.session?.access_token}` } }
      );
      const statusData = await statusRes.json();
      if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
        await (supabase as any).from("tenant_paid_integrations").upsert({
          tenant_id: tenantId, integration_id: integrationState.integration_id,
          status: integrationState.requires_api_keys ? "disabled" : "active",
          activated_by: user.id, purchased_at: new Date().toISOString(),
          activated_at: new Date().toISOString(), activation_source: "purchase",
        }, { onConflict: "tenant_id,integration_id" });
        toast({ title: "تم الدفع بنجاح ✅" });
        fetchState();
        setFlowStep(integrationState.requires_api_keys ? "api_keys" : "done");
      } else {
        toast({ title: "لم يتم الدفع بعد", description: "أكمل الدفع أولاً ثم حاول مجدداً", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ في التحقق", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleSaveApiKeys = async () => {
    if (!integrationState || !tenantId || !apiKeyValue.trim()) {
      toast({ title: "يرجى إدخال مفتاح API", variant: "destructive" });
      return;
    }
    setSaving(true);
    setTestResult("testing");
    setFlowStep("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-integration-secrets?action=test-and-set`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            integrationId: integrationState.integration_id,
            gatewayKey: integrationState.key,
            apiSecret: apiKeyValue,
          }),
        }
      );
      const result = await res.json();
      setSaving(false);
      if (result.success) {
        setTestResult("success");
        setFlowStep("done");
        toast({ title: result.message || "تم حفظ المفتاح واختبار الاتصال بنجاح ✅" });
        setApiKeyValue("");
        fetchState();
      } else {
        setTestResult("fail");
        setFlowStep("testing");
        toast({ title: "فشل الاتصال أو الحفظ", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      setSaving(false);
      setTestResult("fail");
      setFlowStep("testing");
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  // ── رفع تذكرة دعم ───────────────────────────────────────────────────────────

  const submitTicket = async () => {
    if (!ticketDesc.trim()) { toast({ title: "يرجى كتابة تفاصيل المشكلة", variant: "destructive" }); return; }
    if (!tenantId || !user) return;
    setSubmittingTicket(true);
    try {
      const ticketNumber = `TK-${Date.now().toString(36).toUpperCase()}`;
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        ticket_number: ticketNumber,
        scope: "platform",
        tenant_id: tenantId,
        created_by: user.id,
        subject: ticketSubject.trim() || `مشكلة في تكامل ${integrationState?.name_ar}`,
        category: "technical",
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
        content: `التكامل: ${integrationState?.name_ar} (${integrationState?.name_en})\n\n${ticketDesc.trim()}`,
      } as any);

      try {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            ticketId: (ticket as any).id, ticketNumber,
            subject: ticketSubject.trim(),
            category: "مشكلة تقنية",
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

  // ── شريط التقدم ──────────────────────────────────────────────────────────────

  const visibleSteps = integrationState?.requires_api_keys
    ? FLOW_STEPS.filter((s) => s.key !== "paying")
    : FLOW_STEPS.filter((s) => s.key !== "api_keys" && s.key !== "paying");
  const visibleIndex = visibleSteps.findIndex((s) => s.key === flowStep);
  const progressPercent = visibleSteps.length > 1
    ? Math.max(0, (visibleIndex / (visibleSteps.length - 1)) * 100)
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integrationState) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">التكامل غير موجود.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowLeft size={16} /> رجوع
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
        <span className="text-foreground font-semibold">{integrationState.name_ar}</span>
      </nav>

      {/* ── رأس الصفحة ── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowLeft size={15} /> رجوع
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings2 size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{integrationState.name_ar}</h1>
            <p className="text-xs text-muted-foreground" dir="ltr">{integrationState.name_en}</p>
          </div>
          {flowStep === "done" && (
            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 gap-1 shrink-0">
              <CheckCircle2 size={11} /> مفعّل
            </Badge>
          )}
          {integrationState.trial_days > 0 && integrationState.tenant_activation_status === "none" && (
            <Badge variant="outline" className="gap-1 shrink-0 text-[10px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200">
              <Sparkles size={10} /> {integrationState.trial_days} يوم مجاني
            </Badge>
          )}
        </div>
      </div>

      {/* ── التبويبات ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full grid grid-cols-3 h-11" dir="rtl">
          <TabsTrigger value="setup" className="gap-1.5 text-sm">
            <Settings2 size={14} /> الإعداد
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5 text-sm">
            <BookOpen size={14} /> دليل الاستخدام
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5 text-sm">
            <Headphones size={14} /> رفع مشكلة
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ تبويب الإعداد ════════════════ */}
        <TabsContent value="setup" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-5">

              {/* شريط التقدم */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>تقدم الإعداد</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
                <div className="flex justify-between">
                  {visibleSteps.map((s, i) => {
                    const isActive = s.key === flowStep;
                    const isPast = i < visibleIndex;
                    const StepIcon = s.icon;
                    return (
                      <div key={s.key} className={cn(
                        "flex flex-col items-center gap-1 text-[10px] transition-colors",
                        isActive ? "text-primary font-bold" : isPast ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                      )}>
                        <StepIcon size={13} />
                        {s.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* محتوى الخطوة */}
              <AnimatePresence mode="wait">
                <motion.div key={flowStep} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="min-h-[240px]">

                  {/* ── عرض التكامل ── */}
                  {flowStep === "preview" && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{integrationState.description_ar}</p>

                      <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">السعر</span>
                          {isEnterprise ? (
                            <span className="font-bold text-green-600 dark:text-green-400">مجاني
                              <span className="text-xs font-normal text-muted-foreground mr-1">(باقة المؤسسات)</span>
                            </span>
                          ) : (
                            <span className="font-bold">{integrationState.price_once} ر.س
                              <span className="text-xs font-normal text-muted-foreground mr-1">(مرة واحدة)</span>
                            </span>
                          )}
                        </div>
                        {integrationState.requires_api_keys && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">مفاتيح API</span>
                            <Badge variant="outline" className="text-[10px] gap-1"><Key size={10} /> مطلوبة</Badge>
                          </div>
                        )}
                        {integrationState.trial_days > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">تجربة مجانية</span>
                            <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
                              <Sparkles size={10} /> {integrationState.trial_days} يوم
                            </Badge>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">نوع التكامل</span>
                          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{integrationState.integration_type}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => navigate("/dashboard/paid-integrations")} className="flex-1">إلغاء</Button>
                        {hasFreeAccess ? (
                          <Button onClick={handleFreeAutoActivate} disabled={saving} className="flex-1 gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {saving ? "جاري التفعيل..." : "تفعيل فوري مجاني"}
                          </Button>
                        ) : (
                          <Button onClick={() => setFlowStep("payment")} className="flex-1 gap-2">
                            متابعة للدفع <CreditCard size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── الدفع ── */}
                  {flowStep === "payment" && (
                    <div className="space-y-4">
                      <div className="text-center py-2">
                        <p className="text-4xl font-bold text-foreground">{integrationState.price_once}
                          <span className="text-lg font-medium text-muted-foreground mr-1">ر.س</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">دفعة واحدة — {integrationState.name_ar}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">طريقة الدفع</Label>
                        {[
                          { id: "wallet", label: "المحفظة", sub: walletExists ? `الرصيد: ${walletBalance?.toFixed(2)} ر.س` : "لا توجد محفظة", icon: Wallet },
                          { id: "paylink", label: "Paylink", sub: "ادفع عبر بوابة Paylink الآمنة", icon: CreditCard },
                        ].map((m) => (
                          <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id as any)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right",
                              paymentMethod === m.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                            )}>
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", paymentMethod === m.id ? "bg-primary/10" : "bg-muted")}>
                              <m.icon size={18} className={paymentMethod === m.id ? "text-primary" : "text-muted-foreground"} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground">{m.label}</p>
                              <p className="text-xs text-muted-foreground">{m.sub}</p>
                            </div>
                            {paymentMethod === m.id && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => setFlowStep("preview")} className="flex-1">رجوع</Button>
                        {paymentMethod === "wallet" ? (
                          <Button onClick={handleWalletPurchase}
                            disabled={saving || !walletExists || (walletBalance ?? 0) < integrationState.price_once}
                            className="flex-1 gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                            {saving ? "جاري الخصم..." : `ادفع ${integrationState.price_once} ر.س`}
                          </Button>
                        ) : (
                          <Button onClick={handlePaylink} disabled={saving} className="flex-1 gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                            {saving ? "جاري إنشاء الفاتورة..." : `ادفع ${integrationState.price_once} ر.س`}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── انتظار الدفع ── */}
                  {flowStep === "paying" && (
                    <div className="space-y-4 text-center py-6">
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                        className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                        <CreditCard size={32} className="text-primary" />
                      </motion.div>
                      <div>
                        <p className="font-bold text-foreground text-lg">في انتظار إتمام الدفع...</p>
                        <p className="text-sm text-muted-foreground mt-1">أكمل الدفع في الصفحة التي فُتحت لك</p>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <Loader2 size={12} className="animate-spin" /> يتم انتظار تأكيد الدفع
                      </div>
                      {paymentUrl && (
                        <Button variant="outline" size="sm" onClick={() => window.open(paymentUrl, "_blank")} className="gap-2">
                          <ExternalLink size={13} /> فتح صفحة الدفع مجدداً
                        </Button>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => navigate("/dashboard/paid-integrations")} className="flex-1">إلغاء</Button>
                        <Button onClick={handleConfirmPayment} disabled={saving} className="flex-1 gap-2">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          {saving ? "جاري التحقق..." : "لقد دفعت — تحقق"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── إعداد مفاتيح API ── */}
                  {flowStep === "api_keys" && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
                        <Key size={15} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm text-blue-800 dark:text-blue-300">مفاتيح API مطلوبة</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400">
                            هذا التكامل يتطلب ربطه بحسابك في الخدمة الخارجية. المفتاح يُخزَّن بشكل آمن ومشفَّر.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <Key size={13} className="text-muted-foreground" />
                          {integrationState.api_key_label || "مفتاح API"}
                        </Label>
                        <div className="relative">
                          <Input
                            dir="ltr"
                            type={showApiKey ? "text" : "password"}
                            value={apiKeyValue}
                            onChange={(e) => setApiKeyValue(e.target.value)}
                            placeholder="أدخل مفتاح API الخاص بك"
                            className="font-mono pe-10"
                            autoComplete="off"
                          />
                          <button type="button" onClick={() => setShowApiKey(p => !p)}
                            className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground" tabIndex={-1}>
                            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock size={10} /> يُخزَّن بشكل آمن ومشفَّر — لا يُعرض مجدداً
                        </p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" onClick={() => navigate("/dashboard/paid-integrations")} className="flex-1">لاحقاً</Button>
                        <Button onClick={handleSaveApiKeys} disabled={saving || !apiKeyValue.trim()} className="flex-1 gap-2">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                          {saving ? "جاري الحفظ..." : "حفظ واختبار الاتصال"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── جاري الاختبار ── */}
                  {flowStep === "testing" && testResult === "testing" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-12">
                      <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <Wifi size={32} className="text-accent" />
                      </motion.div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">جاري اختبار الاتصال...</p>
                        <p className="text-sm text-muted-foreground mt-1">يتم التحقق من صلاحية المفاتيح</p>
                      </div>
                      <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    </div>
                  )}

                  {/* ── فشل الاختبار ── */}
                  {flowStep === "testing" && testResult === "fail" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                        <WifiOff size={32} className="text-destructive" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">فشل اختبار الاتصال</p>
                        <p className="text-sm text-muted-foreground">تحقق من مفتاح API وحاول مجدداً</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setFlowStep("api_keys")}>تعديل المفتاح</Button>
                        <Button onClick={handleSaveApiKeys} className="gap-2">
                          <Wifi size={14} /> إعادة الاختبار
                        </Button>
                      </div>
                      <button onClick={() => setActiveTab("support")} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground mt-1">
                        رفع مشكلة لفريق الدعم
                      </button>
                    </div>
                  )}

                  {/* ── مكتمل ── */}
                  {flowStep === "done" && (
                    <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                        <CheckCircle2 size={40} className="text-green-600 dark:text-green-400" />
                      </motion.div>
                      <div className="space-y-1">
                        <p className="text-xl font-bold text-foreground">تم تفعيل {integrationState.name_ar} ✅</p>
                        <p className="text-sm text-muted-foreground">التكامل يعمل الآن في جميع أقسام النظام</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {["الفواتير", "العقود", "المدفوعات", "المشاريع"].map((area) => (
                          <Badge key={area} variant="outline" className="gap-1 text-xs bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                            <CheckCircle2 size={10} /> {area}
                          </Badge>
                        ))}
                      </div>
                      <Button onClick={() => navigate("/dashboard/paid-integrations")} className="w-full h-11 gap-2 mt-2">
                        <Unlock size={14} /> العودة للتكاملات
                      </Button>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ تبويب دليل الاستخدام ════════════════ */}
        <TabsContent value="guide" className="mt-4 space-y-4">
          {(() => {
            const key = integrationState.key?.toLowerCase() || "";
            const type = integrationState.integration_type?.toLowerCase() || "";
            const guide =
              INTEGRATION_GUIDES[key] ||
              INTEGRATION_GUIDES[type] ||
              INTEGRATION_GUIDES["default"];
            return (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap size={16} className="text-amber-500" />
                      كيفية استخدام {integrationState.name_ar}
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
                    <CardTitle className="text-base">أسئلة شائعة</CardTitle>
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
              </>
            );
          })()}
        </TabsContent>

        {/* ════════════════ تبويب رفع مشكلة ════════════════ */}
        <TabsContent value="support" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones size={16} className="text-accent" />
                رفع مشكلة لفريق الدعم
              </CardTitle>
              <p className="text-sm text-muted-foreground">سيتواصل معك فريق الدعم خلال 24 ساعة عمل.</p>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border text-sm">
                <Badge variant="outline" className="gap-1 shrink-0"><Settings2 size={10} /> {integrationState.name_ar}</Badge>
                <span className="text-muted-foreground text-xs">تم اختيار التكامل تلقائياً بناءً على الصفحة الحالية</span>
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
                        ticketPriority === p.value
                          ? `${p.cls} font-semibold`
                          : "border-border text-muted-foreground hover:border-foreground/20"
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
                  placeholder={`اشرح مشكلتك بالتفصيل...\n\nمثال: عند محاولة تفعيل ${integrationState.name_ar} تظهر رسالة الخطأ التالية: ...`}
                  rows={5}
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">كلما كانت التفاصيل أكثر، كان الرد أسرع وأدق.</p>
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

export default IntegrationFlowPage;
