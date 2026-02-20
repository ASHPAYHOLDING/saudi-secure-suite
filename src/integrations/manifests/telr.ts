import type { IntegrationManifest } from "./types";

export const telrManifest: IntegrationManifest = {
  providerId: "telr",
  name: "Telr",
  nameEn: "Telr",
  category: "payment",
  logoPath: "/brands/payment/telr.svg",
  color: "from-red-600/10 to-red-500/5",
  fields: [
    {
      key: "merchant_id",
      label: "Merchant ID",
      type: "text",
      placeholder: "12345",
      hint: "من لوحة تحكم Telr → Settings → Account → Merchant ID",
      required: true,
    },
    {
      key: "api_key",
      label: "Auth Key",
      type: "password",
      placeholder: "مفتاح المصادقة من Telr",
      hint: "من Telr Store → Integrations → API Key",
      required: true,
    },
    {
      key: "store_id",
      label: "Store ID",
      type: "text",
      placeholder: "معرف المتجر",
      hint: "تجده في إعدادات المتجر في لوحة Telr",
      required: true,
    },
  ],
  webhookPath: "/functions/v1/telr-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط Telr",
      officialLink: "https://telr.com/support/",
      officialLinkLabel: "وثائق Telr",
      steps: [
        {
          title: "افتح حساب Telr",
          desc: "اذهب إلى secure.telr.com وسجّل حساباً تجارياً. يتطلب Telr موافقة يدوية.",
          tip: "Telr يركز على الإمارات والسعودية. تأكد من نوع نشاطك التجاري عند التسجيل",
        },
        {
          title: "احصل على Merchant ID وStore ID",
          desc: "بعد الموافقة، من Settings → Account ستجد Merchant ID وStore ID.",
        },
        {
          title: "أنشئ Auth Key",
          desc: "من Integrations → API → Create API Key. احتفظ بالمفتاح في مكان آمن.",
        },
        {
          title: "أدخل البيانات وأختبر الاتصال",
          desc: "أدخل Merchant ID وStore ID وAuth Key ثم اضغط اختبار الاتصال.",
        },
      ],
      faq: [
        { q: "ما طرق الدفع التي يدعمها Telr؟", a: "Visa وMastercard وAmex وMada (السعودية) وMADAY (الإمارات) وKNET وBenefitPay." },
        { q: "هل Telr يدعم التقسيط؟", a: "نعم، Telr يدعم تقسيط Tabby وTamara كخيارات إضافية." },
        { q: "هل يمكن استخدام Telr في وضع الاختبار؟", a: "نعم، استخدم Sandbox credentials من لوحة Telr للاختبار قبل الإنتاج." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "auth_failed", label: "خطأ في المصادقة" },
    { value: "payment_declined", label: "رفض المدفوعات" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
