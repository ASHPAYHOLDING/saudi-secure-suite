import type { IntegrationManifest } from "./types";

export const tapManifest: IntegrationManifest = {
  providerId: "tap",
  name: "تاب للمدفوعات",
  nameEn: "Tap Payments",
  category: "payment",
  logoPath: "/brands/payment/tap.svg",
  color: "from-rose-500/10 to-pink-500/10",
  fields: [
    {
      key: "secret_key",
      label: "Secret Key",
      type: "password",
      placeholder: "sk_live_...",
      hint: "من Tap Dashboard → Developers → API Keys → Secret Key",
      required: true,
    },
    {
      key: "public_key",
      label: "Public Key",
      type: "text",
      placeholder: "pk_live_...",
      hint: "من Tap Dashboard → Developers → API Keys → Public Key",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "whsec_...",
      hint: "من Tap Dashboard → Webhooks → Secret",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/tap-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات الربط مع Tap Payments",
      officialLink: "https://developers.tap.company",
      officialLinkLabel: "وثائق Tap للمطورين",
      steps: [
        {
          title: "سجّل دخولك على Tap Dashboard",
          desc: "اذهب إلى dashboard.tap.company وسجّل دخولك بحسابك التجاري.",
        },
        {
          title: "انتقل إلى Developer Settings",
          desc: "من القائمة الجانبية اختر Developers → API Keys.",
          tip: "تأكد من اختيار Live Keys وليس Test Keys للإنتاج",
        },
        {
          title: "انسخ Secret Key",
          desc: "اضغط على Secret Key وانسخها — ستبدأ بـ sk_live_...",
          tip: "لا تشارك هذا المفتاح مع أحد أبداً",
        },
        {
          title: "انسخ Public Key",
          desc: "انسخ Public Key أيضاً — ستبدأ بـ pk_live_...",
        },
        {
          title: "أضف Webhook URL",
          desc: "من Tap Dashboard → Webhooks → Create New، أضف URL نومكسيو: [webhook_url] ثم احفظ الـ Webhook Secret.",
          tip: "اختر الأحداث: charge.succeeded, charge.failed",
        },
      ],
      faq: [
        { q: "هل تدعم Tap المدفوعات بالريال؟", a: "نعم، تدعم SAR وعدة عملات خليجية وعالمية." },
        { q: "ما طرق الدفع التي تدعمها Tap؟", a: "بطاقات Visa/Mastercard، مدى، Benefit، Fawry، وApple Pay." },
        { q: "كيف أختبر التكامل؟", a: "استخدم Test Keys من لوحة Tap مع بطاقات الاختبار المتوفرة في وثائقهم." },
        { q: "ما الفرق بين Secret Key و Public Key؟", a: "Secret Key للعمليات الحساسة على السيرفر، Public Key للواجهة الأمامية فقط." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "webhook_not_received", label: "لا أستقبل Webhooks من Tap" },
    { value: "payment_declined", label: "المدفوعات مرفوضة" },
    { value: "wrong_currency", label: "مشكلة في العملة" },
    { value: "mada_not_working", label: "مدى لا تعمل" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
