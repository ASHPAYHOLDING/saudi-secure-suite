/**
 * IntegrationDetailPage
 * ─────────────────────
 * صفحة داخلية كاملة لكل تكامل — بديل عن الـ Modal
 * Route: /dashboard/integrations/:providerId
 *
 * تحتوي على 5 تبويبات:
 *  1) الإعدادات (Setup) — إدخال API Keys + حفظ
 *  2) Webhook & الأمان — رابط Webhook + شرح أمني
 *  3) اختبار الاتصال — Stepper مع نتائج
 *  4) دليل الاستخدام — محتوى عربي احترافي
 *  5) الأسئلة الشائعة — FAQ
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import {
  ArrowRight, Key, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  Wifi, WifiOff, Copy, Link as LinkIcon, ShieldCheck, Lock,
  CreditCard, AlertTriangle, BookOpen, HelpCircle, Settings,
  ChevronDown, ChevronUp, ExternalLink, Power, PowerOff,
  CheckCircle, MinusCircle, Globe, MapPin, Banknote, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Provider definitions ─────────────────────────────────────────────────────

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  hint?: string;
  validate?: z.ZodString;
}

interface ProviderDef {
  id: string;              // URL param
  integrationKey: string;  // paid_integrations.key
  nameAr: string;
  nameEn: string;
  logo: string;            // path in /public/brands/payment/
  category: "local" | "global" | "bnpl" | "wallet";
  categoryLabel: string;
  tagColor: string;
  webhookFnSlug: string;
  webhookSignatureHeader: string;
  credentialFields: CredentialField[];
  webhookSecretLabel: string;
  webhookSecretHint: string;
  docsUrl: string;
  description: string;
  useCases: string[];
  commonErrors: { code: string; fix: string }[];
  supportedMethods: string[];
}

export const ALL_PROVIDERS: ProviderDef[] = [
  {
    id: "tap",
    integrationKey: "pay_tap",
    nameAr: "تاب",
    nameEn: "Tap Payments",
    logo: "/brands/payment/tap.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-blue-500/10 text-blue-700 border-blue-200",
    webhookFnSlug: "tap-webhook",
    webhookSignatureHeader: "hashid",
    credentialFields: [
      {
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_... أو sk_test_...",
        secret: true,
        hint: "من Tap Dashboard → Developers → API Keys",
        validate: z.string().min(20, "المفتاح قصير جداً"),
      },
    ],
    webhookSecretLabel: "Webhook Secret",
    webhookSecretHint: "من Tap Dashboard → Webhooks",
    docsUrl: "https://developers.tap.company/",
    description: "بوابة الدفع الرائدة في منطقة الخليج — تدعم مدى، Visa، Mastercard، Apple Pay وغيرها.",
    useCases: ["استقبال مدفوعات الفواتير", "تحديث حالة الفاتورة تلقائياً عند الدفع", "استرداد المبالغ عبر النظام"],
    commonErrors: [
      { code: "401 Unauthorized", fix: "تحقق من أن Secret Key صحيح وليس Publishable Key" },
      { code: "hashid mismatch", fix: "تحقق من Webhook Secret في إعدادات Tap" },
      { code: "amount mismatch", fix: "تأكد من أن مبلغ الفاتورة يتطابق مع مبلغ الدفع" },
    ],
    supportedMethods: ["مدى", "Visa", "Mastercard", "Apple Pay", "KNET", "Benefit"],
  },
  {
    id: "moyasar",
    integrationKey: "pay_moyasar",
    nameAr: "ميسّر",
    nameEn: "Moyasar",
    logo: "/brands/payment/moyasar.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    webhookFnSlug: "moyasar-webhook",
    webhookSignatureHeader: "x-moyasar-signature",
    credentialFields: [
      {
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_... أو sk_test_...",
        secret: true,
        hint: "من Moyasar Dashboard → Developer → API Keys",
        validate: z.string().min(20, "المفتاح قصير جداً"),
      },
    ],
    webhookSecretLabel: "Webhook Secret",
    webhookSecretHint: "من Moyasar Dashboard → Webhooks → Secret",
    docsUrl: "https://moyasar.com/docs/",
    description: "بوابة دفع سعودية متوافقة مع SAMA — تدعم مدى وApple Pay والبطاقات الدولية.",
    useCases: ["قبول مدفوعات محلية سعودية", "تقارير مدفوعات مفصّلة", "روابط دفع مباشرة"],
    commonErrors: [
      { code: "x-moyasar-signature invalid", fix: "تحقق من Webhook Secret في إعداداتك بـ Moyasar" },
      { code: "401", fix: "تأكد من استخدام sk_ وليس pk_" },
    ],
    supportedMethods: ["مدى", "Visa", "Mastercard", "Apple Pay", "STC Pay"],
  },
  {
    id: "hyperpay",
    integrationKey: "pay_hyperpay",
    nameAr: "هايبر باي",
    nameEn: "HyperPay",
    logo: "/brands/payment/hyperpay.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-purple-500/10 text-purple-700 border-purple-200",
    webhookFnSlug: "hyperpay-webhook",
    webhookSignatureHeader: "X-Initialization-Vector",
    credentialFields: [
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "OGE4OWIyMTM2...",
        secret: true,
        hint: "من HyperPay Backoffice → Administration → Channels",
        validate: z.string().min(20, "المفتاح قصير جداً"),
      },
      {
        key: "entity_id",
        label: "Entity ID (Channel ID)",
        placeholder: "8a89b2137...",
        hint: "من HyperPay Backoffice → Administration → Channels",
        validate: z.string().min(10, "Entity ID قصير جداً"),
      },
    ],
    webhookSecretLabel: "Webhook Secret Key",
    webhookSecretHint: "من HyperPay Backoffice → Administration → Webhooks",
    docsUrl: "https://wordpressdemo.hyperpay.com/doc/",
    description: "بوابة دفع رائدة في السعودية والإمارات — تدعم MADA وVisa وiPay وSTC Pay.",
    useCases: ["قبول بطاقات محلية ودولية", "تكامل مع المتاجر الإلكترونية", "صفحات دفع احترافية"],
    commonErrors: [
      { code: "403", fix: "تأكد من صلاحيات Access Token وأن Entity ID صحيح" },
      { code: "signature mismatch", fix: "تحقق من Webhook Secret Key" },
    ],
    supportedMethods: ["مدى", "Visa", "Mastercard", "STC Pay", "Apple Pay", "iPay"],
  },
  {
    id: "stripe",
    integrationKey: "pay_stripe",
    nameAr: "سترايب",
    nameEn: "Stripe",
    logo: "/brands/payment/stripe.svg",
    category: "global",
    categoryLabel: "عالمي",
    tagColor: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
    webhookFnSlug: "stripe-webhook",
    webhookSignatureHeader: "Stripe-Signature",
    credentialFields: [
      {
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_... أو sk_test_...",
        secret: true,
        hint: "من Stripe Dashboard → Developers → API Keys",
        validate: z.string().min(20, "المفتاح قصير جداً").regex(/^sk_(live|test)_/, "يجب أن يبدأ بـ sk_live_ أو sk_test_"),
      },
      {
        key: "publishable_key",
        label: "Publishable Key (اختياري)",
        placeholder: "pk_live_... أو pk_test_...",
        hint: "من Stripe Dashboard → Developers → API Keys",
      },
    ],
    webhookSecretLabel: "Webhook Signing Secret",
    webhookSecretHint: "من Stripe Dashboard → Webhooks → Signing secret (يبدأ بـ whsec_)",
    docsUrl: "https://docs.stripe.com/webhooks",
    description: "المنصة العالمية الأشهر للمدفوعات — تدعم 135+ عملة ومئات طرق الدفع.",
    useCases: ["قبول مدفوعات دولية", "اشتراكات متكررة", "مدفوعات بالبطاقات"],
    commonErrors: [
      { code: "sk_test_ in production", fix: "استخدم sk_live_ في بيئة الإنتاج" },
      { code: "webhook signature failed", fix: "تأكد من Signing Secret الصحيح (whsec_...)" },
    ],
    supportedMethods: ["Visa", "Mastercard", "American Express", "Apple Pay", "Google Pay", "SEPA"],
  },
  {
    id: "geidea",
    integrationKey: "pay_geidea",
    nameAr: "جيديا",
    nameEn: "Geidea",
    logo: "/brands/payment/geidea.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-orange-500/10 text-orange-700 border-orange-200",
    webhookFnSlug: "geidea-webhook",
    webhookSignatureHeader: "X-Geidea-Signature",
    credentialFields: [
      {
        key: "merchant_public_key",
        label: "Merchant Public Key",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        hint: "من Geidea Merchant Portal → Integration → API Credentials",
        validate: z.string().min(10, "المفتاح قصير جداً"),
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
    description: "بوابة دفع سعودية متكاملة مع نقاط البيع والتجارة الإلكترونية.",
    useCases: ["قبول مدفوعات محلية", "تكامل مع نقاط البيع", "تقارير مفصّلة"],
    commonErrors: [
      { code: "signature invalid", fix: "تحقق من Webhook Shared Secret" },
      { code: "merchant not found", fix: "تأكد من Merchant Public Key" },
    ],
    supportedMethods: ["مدى", "Visa", "Mastercard", "STC Pay"],
  },
  {
    id: "paytabs",
    integrationKey: "pay_paytabs",
    nameAr: "بي تابز",
    nameEn: "PayTabs",
    logo: "/brands/payment/paytabs.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
    webhookFnSlug: "paytabs-webhook",
    webhookSignatureHeader: "signature",
    credentialFields: [
      {
        key: "server_key",
        label: "Server Key",
        placeholder: "SKSA-...",
        secret: true,
        hint: "من PayTabs Dashboard → Developers → API Keys",
        validate: z.string().min(10, "المفتاح قصير جداً"),
      },
      {
        key: "profile_id",
        label: "Profile ID",
        placeholder: "123456",
        hint: "من PayTabs Dashboard → Account → My Account",
      },
    ],
    webhookSecretLabel: "IPN Secret",
    webhookSecretHint: "من PayTabs Dashboard → Developers → IPN Settings",
    docsUrl: "https://support.paytabs.com/",
    description: "بوابة دفع MENA الرائدة — تدعم 168 دولة وأكثر من 40 طريقة دفع.",
    useCases: ["مدفوعات إقليمية", "قبول عملات متعددة", "حلول للمؤسسات"],
    commonErrors: [
      { code: "IPN signature mismatch", fix: "تحقق من IPN Secret Key" },
      { code: "profile_id invalid", fix: "تأكد من Profile ID الصحيح" },
    ],
    supportedMethods: ["مدى", "Visa", "Mastercard", "Amex", "Apple Pay", "Fawry"],
  },
  {
    id: "myfatoorah",
    integrationKey: "pay_myfatoorah",
    nameAr: "ماي فاتورة",
    nameEn: "MyFatoorah",
    logo: "/brands/payment/myfatoorah.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-teal-500/10 text-teal-700 border-teal-200",
    webhookFnSlug: "myfatoorah-webhook",
    webhookSignatureHeader: "x-webhook-secret",
    credentialFields: [
      {
        key: "api_token",
        label: "API Token",
        placeholder: "rLtt25IbuS54en...",
        secret: true,
        hint: "من MyFatoorah Dashboard → Settings → API",
        validate: z.string().min(20, "Token قصير جداً"),
      },
    ],
    webhookSecretLabel: "Webhook Secret",
    webhookSecretHint: "من MyFatoorah Dashboard → Settings → Webhooks",
    docsUrl: "https://docs.myfatoorah.com/",
    description: "بوابة دفع كويتية-خليجية تدعم 10 دول وأكثر من 20 طريقة دفع.",
    useCases: ["مدفوعات خليجية", "روابط دفع", "تحصيل الفواتير"],
    commonErrors: [
      { code: "Invalid token", fix: "تحقق من API Token — انتبه لبيئة Test vs Live" },
      { code: "webhook not verified", fix: "تأكد من Webhook Secret المضاف في الداشبورد" },
    ],
    supportedMethods: ["KNET", "مدى", "Visa", "Mastercard", "Apple Pay", "STC Pay", "Benefit"],
  },
  {
    id: "telr",
    integrationKey: "pay_telr",
    nameAr: "تلر",
    nameEn: "Telr",
    logo: "/brands/payment/telr.svg",
    category: "local",
    categoryLabel: "محلي",
    tagColor: "bg-rose-500/10 text-rose-700 border-rose-200",
    webhookFnSlug: "telr-webhook",
    webhookSignatureHeader: "x-telr-signature",
    credentialFields: [
      {
        key: "api_key",
        label: "API Key",
        placeholder: "DzMfzJ...",
        secret: true,
        hint: "من Telr Merchant Hub → Integration → API Key",
        validate: z.string().min(10, "المفتاح قصير جداً"),
      },
      {
        key: "store_id",
        label: "Store ID",
        placeholder: "1234",
        hint: "من Telr Merchant Hub → Account Settings",
      },
    ],
    webhookSecretLabel: "Webhook Secret",
    webhookSecretHint: "من Telr Merchant Hub → Integration → Webhooks",
    docsUrl: "https://telr.com/support/",
    description: "بوابة دفع معتمدة في الإمارات والسعودية — مثالية للمتاجر الإلكترونية.",
    useCases: ["مدفوعات الإمارات والخليج", "تكامل سريع", "دعم محلي"],
    commonErrors: [
      { code: "auth fail", fix: "تحقق من API Key و Store ID" },
    ],
    supportedMethods: ["مدى", "Visa", "Mastercard", "Apple Pay", "Fawry"],
  },
  {
    id: "paypal",
    integrationKey: "pay_paypal",
    nameAr: "باي بال",
    nameEn: "PayPal",
    logo: "/brands/payment/paypal.svg",
    category: "global",
    categoryLabel: "عالمي",
    tagColor: "bg-sky-500/10 text-sky-700 border-sky-200",
    webhookFnSlug: "paypal-webhook",
    webhookSignatureHeader: "paypal-transmission-sig",
    credentialFields: [
      {
        key: "client_id",
        label: "Client ID",
        placeholder: "AZDxjD...",
        hint: "من PayPal Developer → Apps & Credentials → App",
      },
      {
        key: "client_secret",
        label: "Client Secret",
        placeholder: "EGnHDx...",
        secret: true,
        hint: "من PayPal Developer → Apps & Credentials → App",
        validate: z.string().min(10, "Secret قصير جداً"),
      },
    ],
    webhookSecretLabel: "Webhook ID",
    webhookSecretHint: "من PayPal Developer → Webhooks → Webhook ID",
    docsUrl: "https://developer.paypal.com/docs/api/webhooks/",
    description: "أشهر بوابة دفع عالمية — تدعم 200+ دولة ومحفظة PayPal.",
    useCases: ["قبول مدفوعات دولية", "PayPal Wallet", "بطاقات دولية"],
    commonErrors: [
      { code: "INVALID_CLIENT", fix: "تحقق من Client ID وClient Secret" },
      { code: "webhook signature fail", fix: "تحقق من Webhook ID الصحيح" },
    ],
    supportedMethods: ["PayPal", "Visa", "Mastercard", "Amex", "Venmo"],
  },
  {
    id: "tabby",
    integrationKey: "pay_tabby",
    nameAr: "تابي",
    nameEn: "Tabby",
    logo: "/brands/payment/tabby.svg",
    category: "bnpl",
    categoryLabel: "BNPL",
    tagColor: "bg-lime-500/10 text-lime-700 border-lime-200",
    webhookFnSlug: "tabby-webhook",
    webhookSignatureHeader: "x-tabby-signature",
    credentialFields: [
      {
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_...",
        secret: true,
        hint: "من Tabby Merchant Dashboard → Settings → API Keys",
        validate: z.string().min(20, "المفتاح قصير جداً"),
      },
    ],
    webhookSecretLabel: "Webhook Secret",
    webhookSecretHint: "من Tabby Merchant Dashboard → Settings → Webhooks",
    docsUrl: "https://docs.tabby.ai/",
    description: "خدمة اشترِ الآن وادفع لاحقاً (BNPL) الأشهر في الخليج.",
    useCases: ["تقسيط المشتريات", "زيادة معدل التحويل", "دفع على 4 أقساط"],
    commonErrors: [
      { code: "merchant not eligible", fix: "تأكد من أن نشاطك التجاري مؤهل لـ Tabby" },
      { code: "signature invalid", fix: "تحقق من Webhook Secret" },
    ],
    supportedMethods: ["تقسيط 4 أقساط", "بدون فوائد", "مدى", "Visa"],
  },
  {
    id: "tamara",
    integrationKey: "pay_tamara",
    nameAr: "تمارا",
    nameEn: "Tamara",
    logo: "/brands/payment/tamara.svg",
    category: "bnpl",
    categoryLabel: "BNPL",
    tagColor: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    webhookFnSlug: "tamara-webhook",
    webhookSignatureHeader: "x-tamara-signature",
    credentialFields: [
      {
        key: "api_token",
        label: "API Token",
        placeholder: "Bearer token من Tamara",
        secret: true,
        hint: "من Tamara Partner Portal → API Credentials",
        validate: z.string().min(20, "Token قصير جداً"),
      },
    ],
    webhookSecretLabel: "Notification Token",
    webhookSecretHint: "من Tamara Partner Portal → Webhooks → Notification Token",
    docsUrl: "https://docs.tamara.co/",
    description: "منصة BNPL السعودية الرائدة — تقسيط مرن 3-6-12 شهر.",
    useCases: ["تقسيط مرن", "تحويل مبيعات أعلى", "تمويل فوري للمستهلك"],
    commonErrors: [
      { code: "token expired", fix: "جدّد API Token من Tamara Portal" },
      { code: "order invalid", fix: "تحقق من تنسيق البيانات المرسلة" },
    ],
    supportedMethods: ["تقسيط 3-6-12 شهر", "مدى", "Visa", "Mastercard"],
  },
];

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "هل يتم حفظ مفاتيحي بنص صريح؟",
    a: "لا. جميع المفاتيح والأسرار تُشفَّر باستخدام AES-256-GCM قبل التخزين. حتى مدراء النظام لا يستطيعون الاطلاع على المفاتيح الأصلية. يُرجع النظام فقط مؤشر \"تم الإعداد\" دون عرض القيمة.",
  },
  {
    q: "هل يمكن استخدام أكثر من بوابة في آنٍ واحد؟",
    a: "نعم. يمكنك تفعيل عدة بوابات. يمكنك تحديد البوابة الافتراضية لكل فاتورة، أو السماح للعميل باختيار طريقة الدفع من قائمة متعددة.",
  },
  {
    q: "كيف أتأكد أن Webhook يعمل؟",
    a: "انتقل لتبويب \"اختبار الاتصال\" واضغط \"تشغيل الاختبار\". سيقوم النظام بالتحقق من المفاتيح واختبار الاتصال مع البوابة. يمكنك أيضاً مراجعة سجل آخر 10 أحداث في نفس التبويب.",
  },
  {
    q: "ماذا يحدث إذا تكرر نفس الحدث من البوابة؟",
    a: "النظام يطبق Idempotency كاملة. كل حدث Webhook يحمل معرفاً فريداً يُخزَّن في جدول webhook_events. إذا تكرر نفس الحدث يُرجع النظام 200 OK ويتجاهله دون معالجة مكررة.",
  },
  {
    q: "هل تدعم بوابات الدفع Apple Pay ومدى؟",
    a: "نعم. معظم البوابات المحلية (Tap، Moyasar، HyperPay، Geidea) تدعم مدى وApple Pay. تأكد من تفعيل هذه الطرق في لوحة تحكم البوابة نفسها.",
  },
  {
    q: "كيف تتحدث البوابة مع النظام بعد الدفع؟",
    a: "عند اكتمال الدفع، ترسل البوابة طلب Webhook لـ URL خاص بمستأجرك. يتحقق النظام من التوقيع الرقمي ثم يحدّث حالة الفاتورة تلقائياً ويسجّل الحدث في سجل التدقيق.",
  },
  {
    q: "هل يمكنني استخدام بيئة التجربة (Sandbox) أولاً؟",
    a: "بالتأكيد. معظم البوابات تدعم مفاتيح Test/Sandbox. أدخل المفاتيح التجريبية أولاً واختبر التكامل قبل الانتقال لبيئة الإنتاج.",
  },
];

// ─── Security features ────────────────────────────────────────────────────────

const SECURITY_FEATURES = [
  { icon: ShieldCheck, label: "تشفير AES-256-GCM", desc: "كل الأسرار مشفرة في قاعدة البيانات" },
  { icon: Lock, label: "Idempotency كاملة", desc: "منع معالجة الأحداث المكررة" },
  { icon: CheckCircle2, label: "Amount & Currency Checks", desc: "التحقق من المبلغ والعملة قبل الاعتماد" },
  { icon: Globe, label: "Tenant Isolation", desc: "عزل كامل بين البيانات" },
];

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

// ─── Main Component ───────────────────────────────────────────────────────────

const IntegrationDetailPage = () => {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  const provider = ALL_PROVIDERS.find((p) => p.id === providerId);

  // ── Credential state ──
  const initialCreds = () =>
    Object.fromEntries((provider?.credentialFields || []).map((f) => [f.key, ""]));
  const [creds, setCreds] = useState<Record<string, string>>(initialCreds);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "saving" | "testing" | "done" | "error">("idle");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Integration state from DB ──
  const [integrationState, setIntegrationState] = useState<{
    tenant_activation_status: string;
    has_secret_configured: boolean;
    integration_id: string;
  } | null>(null);
  const [loadingState, setLoadingState] = useState(true);

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState("setup");

  // ── FAQ open state ──
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ─── Fetch integration state ───────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    if (!tenantId || !provider) return;
    setLoadingState(true);
    const { data } = await (supabase as any).rpc("get_paid_integrations_state", {
      p_tenant_id: tenantId,
    });
    if (data) {
      const match = (data as any[]).find((r: any) => r.key === provider.integrationKey);
      if (match) setIntegrationState(match);
    }
    setLoadingState(false);
  }, [tenantId, provider]);

  useEffect(() => { fetchState(); }, [fetchState]);

  // ─── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    if (!provider) return false;
    const errs: Record<string, string> = {};
    for (const field of provider.credentialFields) {
      const val = (creds[field.key] || "").trim();
      if (!val) { errs[field.key] = `${field.label} مطلوب`; continue; }
      if (field.validate) {
        const r = field.validate.safeParse(val);
        if (!r.success) errs[field.key] = r.error.errors[0].message;
      }
    }
    if (!webhookSecret.trim()) {
      errs["webhook_secret"] = `${provider?.webhookSecretLabel} مطلوب — بدونه تُرفض جميع الـ Webhooks`;
    } else if (webhookSecret.trim().length < 8) {
      errs["webhook_secret"] = "السر قصير جداً (8 أحرف على الأقل)";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [creds, webhookSecret, provider]);

  // ─── Save credentials ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate() || !provider) return;
    setSaving(true);
    setSaveStep("saving");
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
          provider: provider.id,
          credentials: credPayload,
          webhookSecret: webhookSecret.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");

      // Test connection
      setSaveStep("testing");
      const testRes = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: provider.id }),
      });
      const testData = await testRes.json();
      setTestResult({ success: testData.success, message: testData.message });

      setSaveStep("done");
      toast({
        title: testData.success ? "تم الحفظ والاختبار بنجاح ✅" : "تم الحفظ — الاختبار فشل",
        description: testData.success
          ? `${provider.nameAr} جاهزة لاستقبال المدفوعات`
          : "تم حفظ البيانات. تحقق من المفاتيح وأعد الاختبار.",
        variant: testData.success ? "default" : "destructive",
      });
      fetchState();
    } catch (err: any) {
      setSaveStep("error");
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // ─── Deactivate ────────────────────────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!integrationState || !tenantId) return;
    if (!confirm("هل تريد إيقاف هذا التكامل؟")) return;
    await (supabase as any)
      .from("tenant_paid_integrations")
      .update({ status: "disabled" })
      .eq("tenant_id", tenantId)
      .eq("integration_id", integrationState.integration_id);
    toast({ title: "تم إيقاف التكامل" });
    fetchState();
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const BRAND_DOMAIN = "numaxio.com";
  const webhookUrl = tenantId
    ? `https://${BRAND_DOMAIN}/webhooks/${provider?.webhookFnSlug}?tenant_id=${tenantId}`
    : "";

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "تم نسخ Webhook URL ✓" });
  };

  const toggleSecret = (key: string) =>
    setShowSecrets((p) => ({ ...p, [key]: !p[key] }));

  const isActive = integrationState?.tenant_activation_status === "active";
  const hasSecret = integrationState?.has_secret_configured ?? false;

  // ─── Not found ─────────────────────────────────────────────────────────────
  if (!provider) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">المزود غير موجود.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowRight size={16} /> رجوع للتكاملات
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => navigate("/dashboard/paid-integrations")}
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          التكاملات
        </button>
        <span>/</span>
        <span>بوابات الدفع</span>
        <span>/</span>
        <span className="text-foreground font-medium">{provider.nameAr}</span>
      </nav>

      {/* ── Back button + Header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 mb-4 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/dashboard/paid-integrations")}
        >
          <ArrowRight size={16} /> رجوع للتكاملات
        </Button>

        {/* Provider Header Card */}
        <Card className="overflow-hidden border-border/50">
          <div className={`h-1.5 bg-gradient-to-l from-primary/40 via-accent/50 to-primary/20`} />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Logo */}
              <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={provider.logo}
                  alt={provider.nameEn}
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-foreground">{provider.nameAr}</h1>
                  <span className="text-sm text-muted-foreground font-english" dir="ltr">{provider.nameEn}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className={cn("text-xs border", provider.tagColor)}>
                    {provider.category === "local" && <MapPin size={10} className="me-1" />}
                    {provider.category === "global" && <Globe size={10} className="me-1" />}
                    {provider.category === "bnpl" && <Banknote size={10} className="me-1" />}
                    {provider.category === "wallet" && <Zap size={10} className="me-1" />}
                    {provider.categoryLabel}
                  </Badge>
                  {isActive ? (
                    <Badge className="text-xs bg-accent/10 text-accent border-accent/20 border">
                      <Wifi size={10} className="me-1" /> متصل ونشط
                    </Badge>
                  ) : hasSecret ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-border bg-muted/40">
                      <Settings size={10} className="me-1" /> تم الإعداد — غير نشط
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <WifiOff size={10} className="me-1" /> غير متصل
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{provider.description}</p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 shrink-0">
                {isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={handleDeactivate}
                  >
                    <PowerOff size={14} /> إيقاف التكامل
                  </Button>
                )}
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="gap-1.5 w-full">
                    <ExternalLink size={14} /> التوثيق الرسمي
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="setup" className="rounded-lg gap-1.5 text-xs sm:text-sm">
            <Key size={14} /> الإعدادات
          </TabsTrigger>
          <TabsTrigger value="webhook" className="rounded-lg gap-1.5 text-xs sm:text-sm">
            <LinkIcon size={14} /> Webhook والأمان
          </TabsTrigger>
          <TabsTrigger value="test" className="rounded-lg gap-1.5 text-xs sm:text-sm">
            <Wifi size={14} /> اختبار الاتصال
          </TabsTrigger>
          <TabsTrigger value="guide" className="rounded-lg gap-1.5 text-xs sm:text-sm">
            <BookOpen size={14} /> دليل الاستخدام
          </TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg gap-1.5 text-xs sm:text-sm">
            <HelpCircle size={14} /> الأسئلة الشائعة
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════
            TAB 1: الإعدادات
        ══════════════════════════════════ */}
        <TabsContent value="setup">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Main form */}
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key size={16} className="text-accent" />
                    بيانات الربط
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Security note */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted-foreground">
                    <Lock size={13} className="mt-0.5 shrink-0 text-accent" />
                    <span>جميع البيانات تُشفَّر بـ AES-256-GCM قبل التخزين ولا تُقرأ أبداً من العميل.</span>
                  </div>

                  {/* Credential fields */}
                  {provider.credentialFields.map((field) => (
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
                            "font-mono text-sm",
                            field.secret && "pe-10",
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

                  {/* Webhook secret */}
                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-accent" />
                      {provider.webhookSecretLabel}
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
                      <p className="text-[11px] text-muted-foreground">{provider.webhookSecretHint}</p>
                    )}
                  </div>

                  {/* Save result */}
                  <AnimatePresence>
                    {saveStep === "done" && testResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg text-sm border",
                          testResult.success
                            ? "bg-accent/10 border-accent/20 text-accent"
                            : "bg-destructive/10 border-destructive/20 text-destructive"
                        )}
                      >
                        {testResult.success
                          ? <CheckCircle2 size={15} className="shrink-0" />
                          : <XCircle size={15} className="shrink-0" />}
                        {testResult.message}
                      </motion.div>
                    )}
                    {saveStep === "error" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 p-3 rounded-lg text-sm border bg-destructive/10 border-destructive/20 text-destructive"
                      >
                        <XCircle size={15} className="shrink-0" />
                        حدث خطأ في الحفظ — تحقق من البيانات وأعد المحاولة
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      className="flex-1 gap-2"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          {saveStep === "saving" ? "جاري الحفظ الآمن..." : "جاري الاختبار..."}
                        </>
                      ) : (
                        <>
                          <Key size={15} />
                          {hasSecret ? "تحديث وإعادة الاختبار" : "حفظ واختبار الاتصال"}
                        </>
                      )}
                    </Button>
                    {isActive && (
                      <Button
                        variant="outline"
                        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={handleDeactivate}
                      >
                        <PowerOff size={14} /> تعطيل
                      </Button>
                    )}
                  </div>

                  {/* Progress */}
                  {saving && (
                    <div className="space-y-2">
                      <Progress
                        value={saveStep === "saving" ? 40 : saveStep === "testing" ? 75 : 100}
                        className="h-1.5"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className={cn(saveStep !== "idle" && "text-accent font-medium")}>التحقق من البيانات</span>
                        <span className={cn((saveStep === "saving" || saveStep === "testing" || saveStep === "done") && "text-accent font-medium")}>حفظ آمن</span>
                        <span className={cn((saveStep === "testing" || saveStep === "done") && "text-accent font-medium")}>اختبار الاتصال</span>
                        <span className={cn(saveStep === "done" && "text-accent font-medium")}>مفعّل</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Side help */}
            <div className="space-y-4">
              {/* How to get keys */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen size={14} className="text-accent" />
                    كيف تحصل على المفاتيح؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    `ادخل على لوحة تحكم ${provider.nameEn}`,
                    "انتقل إلى قسم Developer / API / Integration",
                    "انسخ المفاتيح المطلوبة",
                    "الصقها في النموذج وانقر حفظ",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                    </div>
                  ))}
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-accent hover:underline underline-offset-2 pt-1"
                  >
                    <ExternalLink size={12} /> دليل الإعداد الرسمي
                  </a>
                </CardContent>
              </Card>

              {/* Supported methods */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard size={14} className="text-accent" />
                    طرق الدفع المدعومة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.supportedMethods.map((m) => (
                      <Badge key={m} variant="secondary" className="text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Current status */}
              {!loadingState && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Power size={14} className="text-accent" />
                      حالة التكامل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">الحالة</span>
                      {isActive ? (
                        <Badge className="text-xs bg-accent/10 text-accent border border-accent/20">
                          <CheckCircle size={9} className="me-1" /> نشط
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <MinusCircle size={9} className="me-1" /> غير نشط
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">المفاتيح</span>
                      {hasSecret ? (
                        <Badge className="text-xs bg-accent/10 text-accent border-accent/20 border">
                          <Lock size={9} className="me-1" /> مشفّرة ✓
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          لم تُضَف بعد
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB 2: Webhook & الأمان
        ══════════════════════════════════ */}
        <TabsContent value="webhook">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <LinkIcon size={16} className="text-accent" />
                    رابط الـ Webhook
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    أضف هذا الرابط في إعدادات {provider.nameEn} حتى تستطيع البوابة إشعار النظام بكل عملية دفع.
                  </p>

                  <div className="rounded-xl bg-muted/60 border p-4 space-y-3">
                    <p className="text-[11px] text-muted-foreground font-medium">Webhook URL الخاص بمستأجرك:</p>
                    <p className="text-xs font-mono break-all text-foreground bg-background rounded-lg p-2 border" dir="ltr">
                      {webhookUrl || "سيظهر الرابط بعد تسجيل الدخول"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      onClick={copyWebhook}
                      disabled={!webhookUrl}
                    >
                      {copied ? <CheckCircle2 size={12} className="text-accent" /> : <Copy size={12} />}
                      {copied ? "تم النسخ ✓" : "نسخ الرابط"}
                    </Button>
                  </div>

                  <div className="rounded-xl bg-muted/40 border p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Header التوقيع المطلوب:</p>
                    <code className="text-sm font-mono text-foreground bg-background rounded-lg px-3 py-2 block border" dir="ltr">
                      {provider.webhookSignatureHeader}
                    </code>
                    <p className="text-[11px] text-muted-foreground">
                      ترسل {provider.nameEn} هذا الـ Header مع كل Webhook. نستخدمه للتحقق من صحة الطلب.
                    </p>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                    <span>
                      نستخدم HMAC-SHA256 + timing-safe comparison + نافذة زمنية 5 دقائق لمنع هجمات التكرار (Replay Attacks).
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Security card */}
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck size={14} className="text-accent" />
                    ضمانات الأمان
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {SECURITY_FEATURES.map((feat) => (
                    <div key={feat.label} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                        <feat.icon size={13} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{feat.label}</p>
                        <p className="text-[11px] text-muted-foreground">{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB 3: اختبار الاتصال
        ══════════════════════════════════ */}
        <TabsContent value="test">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi size={16} className="text-accent" />
                    اختبار الاتصال
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Stepper */}
                  <div className="space-y-3">
                    {[
                      { step: 1, label: "التحقق من المفاتيح", desc: "التأكد من وجود مفاتيح API مشفرة" },
                      { step: 2, label: "اختبار Webhook", desc: "التحقق من صحة الرابط وإعدادات التوقيع" },
                      { step: 3, label: "اختبار دفعة تجريبية", desc: "اختياري — إنشاء دفعة بقيمة 1 ر.س" },
                    ].map(({ step, label, desc }) => (
                      <div key={step} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                          saveStep === "done" && step <= 2
                            ? "bg-accent/10 text-accent"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {saveStep === "done" && step <= 2
                            ? <CheckCircle2 size={14} className="text-accent" />
                            : step}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!hasSecret && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 border border-border text-muted-foreground text-sm">
                      <AlertTriangle size={15} className="shrink-0" />
                      لم يتم إعداد المفاتيح بعد. انتقل لتبويب الإعدادات وأضف مفاتيح API أولاً.
                    </div>
                  )}

                  {testResult && (
                    <div className={cn(
                      "flex items-center gap-2.5 p-3 rounded-lg text-sm border",
                      testResult.success
                        ? "bg-accent/10 border-accent/20 text-accent"
                        : "bg-destructive/10 border-destructive/20 text-destructive"
                    )}>
                      {testResult.success
                        ? <CheckCircle2 size={15} className="shrink-0" />
                        : <XCircle size={15} className="shrink-0" />}
                      {testResult.message}
                    </div>
                  )}

                  <Button
                    className="w-full gap-2"
                    disabled={!hasSecret || saving}
                    onClick={() => setActiveTab("setup")}
                  >
                    <Wifi size={15} />
                    {hasSecret ? "إعادة الاختبار (من تبويب الإعدادات)" : "أضف المفاتيح أولاً"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">حالة الربط الحالية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {isActive
                      ? <CheckCircle2 size={16} className="text-accent" />
                      : <XCircle size={16} className="text-muted-foreground" />}
                    <span className="text-sm">{isActive ? "التكامل نشط" : "التكامل غير نشط"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSecret
                      ? <CheckCircle2 size={16} className="text-accent" />
                      : <XCircle size={16} className="text-muted-foreground" />}
                    <span className="text-sm">{hasSecret ? "المفاتيح مُعدَّة" : "المفاتيح غير مُعدَّة"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB 4: دليل الاستخدام
        ══════════════════════════════════ */}
        <TabsContent value="guide">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen size={16} className="text-accent" />
                    متى أحتاج هذا التكامل؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    يمكنك ربط {provider.nameAr} بالنظام إذا أردت:
                  </p>
                  <ul className="space-y-2">
                    {provider.useCases.map((uc) => (
                      <li key={uc} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={14} className="text-accent shrink-0 mt-0.5" />
                        <span>{uc}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi size={16} className="text-accent" />
                    كيف يعمل داخل النظام؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">سيناريو كامل من الدفع حتى تحديث الفاتورة:</p>
                  {[
                    { n: "1", title: "إنشاء الفاتورة", desc: "تُنشئ فاتورة في النظام وترسلها للعميل" },
                    { n: "2", title: "رابط الدفع", desc: `يضغط العميل "ادفع الآن" ويُعاد توجيهه لصفحة ${provider.nameEn}` },
                    { n: "3", title: "اكتمال الدفع", desc: `تُكمل البوابة الدفع وترسل إشعار Webhook لنظامنا` },
                    { n: "4", title: "التحقق التلقائي", desc: "نتحقق من التوقيع والمبلغ والعملة — خلال أقل من ثانية" },
                    { n: "5", title: "تحديث الفاتورة", desc: "تتغير حالة الفاتورة إلى \"مدفوعة\" تلقائياً وتُسجَّل في التدقيق" },
                  ].map((s) => (
                    <div key={s.n} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {s.n}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={16} className="text-destructive" />
                    الأخطاء الشائعة وكيف تحلها
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {provider.commonErrors.map((err) => (
                    <div key={err.code} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                      <code className="text-xs font-mono text-destructive" dir="ltr">{err.code}</code>
                      <p className="text-xs text-muted-foreground">الحل: {err.fix}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">روابط مفيدة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-accent hover:underline underline-offset-2"
                  >
                    <ExternalLink size={13} /> التوثيق الرسمي لـ {provider.nameEn}
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB 5: الأسئلة الشائعة
        ══════════════════════════════════ */}
        <TabsContent value="faq">
          <Card className="max-w-3xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle size={16} className="text-accent" />
                الأسئلة الشائعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx} className="border border-border/50 rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 text-start hover:bg-muted/30 transition-colors"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  >
                    <span className="text-sm font-medium text-foreground">{item.q}</span>
                    {openFaq === idx
                      ? <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                      : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationDetailPage;
