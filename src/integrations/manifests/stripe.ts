import type { IntegrationManifest } from "./types";

export const stripeManifest: IntegrationManifest = {
  providerId: "stripe",
  name: "سترايب",
  nameEn: "Stripe",
  category: "payment",
  logoPath: "/brands/payment/stripe.svg",
  color: "from-indigo-500/10 to-indigo-600/5",
  fields: [
    {
      key: "secret_key",
      label: "Secret Key",
      type: "password",
      placeholder: "sk_live_...",
      hint: "من Stripe Dashboard → Developers → API Keys → Reveal live key",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook Signing Secret",
      type: "password",
      placeholder: "whsec_...",
      hint: "من Stripe Dashboard → Developers → Webhooks → Signing secret",
      required: true,
    },
  ],
  webhookPath: "/functions/v1/stripe-webhook",
  docsSections: [
    {
      title: "خطوات ربط Stripe",
      officialLink: "https://dashboard.stripe.com/developers/api-keys",
      officialLinkLabel: "Stripe API Keys",
      steps: [
        {
          title: "سجّل دخولك على Stripe Dashboard",
          desc: "اذهب إلى dashboard.stripe.com وسجّل دخولك بحسابك.",
        },
        {
          title: "انتقل إلى إعدادات المطوّرين",
          desc: "من القائمة الجانبية اختر Developers → API Keys.",
          tip: "تأكد أنك في الوضع الصحيح (Live وليس Test)",
        },
        {
          title: "انسخ Secret Key",
          desc: "اضغط على Reveal live key واحتفظ بها — ستبدأ بـ sk_live_...",
          tip: "لا تشارك هذا المفتاح مع أحد أبداً",
        },
        {
          title: "أنشئ Webhook Endpoint",
          desc: "اذهب إلى Developers → Webhooks → Add Endpoint وأضف URL نومكسيو.",
          tip: "اختر الأحداث: payment_intent.succeeded, charge.refunded",
        },
        {
          title: "انسخ Signing Secret",
          desc: "بعد إنشاء الـ Webhook، انقر عليه وانسخ Signing Secret من قسم Webhook details.",
        },
      ],
      faq: [
        { q: "هل يمكنني البدء بـ Test Mode؟", a: "نعم، استخدم sk_test_... للتجربة ثم انتقل لـ sk_live_ عند الإطلاق." },
        { q: "ماذا لو نسيت Secret Key؟", a: "لا يمكن استرداده — أنشئ مفتاحاً جديداً من Stripe Dashboard." },
        { q: "هل يدعم Stripe مدى؟", a: "يدعم Stripe مدى عبر Stripe Terminal في السعودية. تواصل مع فريق Stripe للتفعيل." },
        { q: "كيف أتحقق أن Webhook يصل؟", a: "من Stripe Dashboard → Webhooks، اضغط Send test webhook واختر حدث اختباري." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "webhook_not_received", label: "لا أستقبل Webhooks من Stripe" },
    { value: "payment_declined", label: "المدفوعات مرفوضة" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "currency_error", label: "خطأ في العملة" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
