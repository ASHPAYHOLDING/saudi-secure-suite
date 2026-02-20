import type { IntegrationManifest } from "./types";

export const moyasarManifest: IntegrationManifest = {
  providerId: "moyasar",
  name: "ميسر",
  nameEn: "Moyasar",
  category: "payment",
  logoPath: "/brands/payment/moyasar.svg",
  color: "from-cyan-500/10 to-teal-500/5",
  fields: [
    {
      key: "secret_key",
      label: "Secret Key",
      type: "password",
      placeholder: "sk_live_...",
      hint: "من Moyasar Dashboard → Developer → API Keys",
      required: true,
    },
    {
      key: "publishable_key",
      label: "Publishable Key",
      type: "text",
      placeholder: "pk_live_...",
      hint: "من Moyasar Dashboard → Developer → API Keys",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "Webhook secret key",
      hint: "من Moyasar Dashboard → Webhooks",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/moyasar-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط Moyasar",
      officialLink: "https://moyasar.com/docs",
      officialLinkLabel: "وثائق Moyasar",
      steps: [
        {
          title: "سجّل دخولك على Moyasar Dashboard",
          desc: "اذهب إلى dashboard.moyasar.com وسجّل دخولك.",
        },
        {
          title: "انتقل إلى API Keys",
          desc: "من القائمة الجانبية اختر Developer → API Keys.",
          tip: "استخدم Live API Keys للإنتاج",
        },
        {
          title: "انسخ Secret Key",
          desc: "اضغط على عرض Secret Key وانسخها — تبدأ بـ sk_live_...",
        },
        {
          title: "انسخ Publishable Key",
          desc: "انسخ كذلك Publishable Key — تبدأ بـ pk_live_...",
        },
        {
          title: "سجّل Webhook",
          desc: "من قسم Webhooks أضف URL نومكسيو واحفظ الـ Secret.",
        },
      ],
      faq: [
        { q: "هل تدعم Moyasar مدفوعات مدى؟", a: "نعم، Moyasar تدعم مدى وفيزا وماستركارد وApple Pay." },
        { q: "هل تعمل Moyasar في السعودية فقط؟", a: "متخصصة بالسوق السعودي لكنها تدعم بعض العملات الأخرى." },
        { q: "كيف أختبر قبل الإطلاق؟", a: "استخدم Test Keys مع بطاقات الاختبار من صفحة Moyasar للمطورين." },
        { q: "ما الفرق بين Secret Key و Publishable Key؟", a: "Secret Key للعمليات على السيرفر فقط، Publishable Key للواجهة الأمامية." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "webhook_not_received", label: "لا أستقبل Webhooks من Moyasar" },
    { value: "mada_declined", label: "مدى مرفوضة" },
    { value: "payment_error", label: "خطأ في عملية الدفع" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
