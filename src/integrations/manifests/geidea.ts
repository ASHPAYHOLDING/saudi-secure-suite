import type { IntegrationManifest } from "./types";

export const geideaManifest: IntegrationManifest = {
  providerId: "geidea",
  name: "جيديا",
  nameEn: "Geidea",
  category: "payment",
  logoPath: "/brands/payment/geidea.svg",
  color: "from-green-500/10 to-emerald-500/5",
  description: "بوابة دفع سعودية معتمدة تدعم مدى وفيزا وماستركارد مع حلول نقاط البيع والتجارة الإلكترونية.",
  benefits: [
    "شركة سعودية معتمدة من مؤسسة النقد",
    "دعم كامل لمدى وApple Pay",
    "حلول POS + eCommerce في منصة واحدة",
    "تسوية مالية سريعة",
  ],
  requirements: [
    "حساب تاجر مفعّل على Geidea Merchant Portal",
    "Merchant Public Key + API Password",
    "KYC ووثائق المنشأة مكتملة",
  ],
  troubleshootingItems: [
    {
      problem: "خطأ 'Authentication failed'",
      cause: "Merchant Key أو API Password غير صحيحين.",
      solution: "تأكد من نسخ البيانات الصحيحة من Geidea Merchant Portal → Integration → API Credentials.",
    },
    {
      problem: "مدفوعات مدى مرفوضة",
      cause: "خطأ في إعدادات 3D Secure أو عدم تفعيل مدى.",
      solution: "تواصل مع فريق Geidea للتحقق من تفعيل مدى على حسابك.",
    },
  ],
  fields: [
    {
      key: "merchant_key",
      label: "Merchant Public Key",
      type: "text",
      placeholder: "المفتاح العام من بوابة Geidea",
      hint: "من Geidea Merchant Portal → Integration → API Credentials",
      required: true,
    },
    {
      key: "api_password",
      label: "API Password",
      type: "password",
      placeholder: "كلمة مرور API",
      hint: "من Geidea Merchant Portal → Integration → API Credentials",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook Shared Secret",
      type: "password",
      placeholder: "Shared Secret",
      hint: "من Geidea Merchant Portal → Webhooks",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/geidea-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط Geidea",
      officialLink: "https://merchant.geidea.net",
      officialLinkLabel: "Geidea Merchant Portal",
      steps: [
        {
          title: "سجّل دخولك على Geidea Merchant Portal",
          desc: "اذهب إلى merchant.geidea.net وسجّل دخولك.",
        },
        {
          title: "انتقل إلى Integration Settings",
          desc: "من القائمة اختر Integration → API Credentials.",
        },
        {
          title: "انسخ Merchant Public Key",
          desc: "هذا المفتاح العام — يمكنك مشاركته بأمان نسبي.",
          tip: "تأكد من استخدام بيانات الإنتاج وليس البيئة التجريبية",
        },
        {
          title: "انسخ API Password",
          desc: "كلمة المرور السرية — احفظها بأمان ولا تضعها في أي رسائل.",
          tip: "لا تشارك API Password أبداً",
        },
        {
          title: "أضف Webhook URL",
          desc: "من Webhooks → Add Webhook أضف URL نومكسيو وانسخ الـ Shared Secret.",
        },
      ],
      faq: [
        { q: "ما الفرق بين البيئة التجريبية والإنتاجية؟", a: "التجريبية للاختبار فقط والمدفوعات وهمية. الإنتاجية تستقبل مدفوعات حقيقية." },
        { q: "لا أجد خيار Webhooks؟", a: "يجب تفعيل الحساب بالكامل. تواصل مع دعم Geidea." },
        { q: "هل يدعم SAR و USD؟", a: "نعم، يدعم متعدد العملات تلقائياً." },
        { q: "كيف أختبر قبل الإطلاق؟", a: "استخدم بيانات اعتماد Sandbox من Geidea مع بطاقات الاختبار الموجودة في وثائقهم." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "webhook_not_received", label: "لا أستقبل Webhooks من Geidea" },
    { value: "payment_declined", label: "المدفوعات مرفوضة" },
    { value: "mada_issue", label: "مشكلة في مدى" },
    { value: "credentials_error", label: "خطأ في بيانات الاعتماد" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
