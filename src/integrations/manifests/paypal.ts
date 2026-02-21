import type { IntegrationManifest } from "./types";

export const paypalManifest: IntegrationManifest = {
  providerId: "paypal",
  name: "PayPal",
  nameEn: "PayPal",
  category: "payment",
  logoPath: "/brands/payment/paypal.svg",
  color: "from-blue-700/10 to-blue-600/5",
  integrationKey: "pay_paypal",
  badges: ["global"],
  description: "أشهر بوابة دفع عالمية — تدعم 200+ دولة ومحفظة PayPal.",
  docsUrl: "https://developer.paypal.com/docs/api/webhooks/",
  webhookSignatureHeader: "paypal-transmission-sig",
  webhookSecretLabel: "Webhook ID",
  webhookSecretHint: "من PayPal Developer → Webhooks → Webhook ID",
  supportedMethods: ["PayPal", "Visa", "Mastercard", "Amex", "Venmo"],
  useCases: ["قبول مدفوعات دولية", "PayPal Wallet", "بطاقات دولية"],
  commonErrors: [
    { code: "INVALID_CLIENT", fix: "تحقق من Client ID وClient Secret" },
    { code: "webhook signature fail", fix: "تحقق من Webhook ID الصحيح" },
  ],
  fields: [
    {
      key: "client_id",
      label: "Client ID",
      type: "text",
      placeholder: "AXxxxxxx...",
      hint: "من PayPal Developer → My Apps & Credentials → App → Client ID",
      required: true,
    },
    {
      key: "client_secret",
      label: "Client Secret",
      type: "password",
      placeholder: "سر التطبيق من PayPal",
      hint: "من PayPal Developer → My Apps & Credentials → App → Secret",
      required: true,
    },
    {
      key: "environment",
      label: "البيئة",
      type: "text",
      placeholder: "sandbox أو live",
      hint: "sandbox للاختبار، live للإنتاج",
      required: true,
    },
    {
      key: "webhook_id",
      label: "Webhook ID (اختياري)",
      type: "text",
      placeholder: "معرف الـ Webhook",
      hint: "من PayPal Developer → Webhooks → Webhook ID بعد إنشائه",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/paypal-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط PayPal",
      officialLink: "https://developer.paypal.com/api/rest/",
      officialLinkLabel: "PayPal Developer Docs",
      steps: [
        {
          title: "افتح حساب PayPal Business",
          desc: "اذهب إلى www.paypal.com/sa وافتح حساباً تجارياً (Business Account). الحساب الشخصي لا يدعم API.",
          tip: "في السعودية، PayPal متاح للاستقبال الدولي فقط. للمدفوعات المحلية استخدم بوابة محلية.",
        },
        {
          title: "ادخل PayPal Developer",
          desc: "اذهب إلى developer.paypal.com وسجّل دخولك بحساب PayPal Business الخاص بك.",
        },
        {
          title: "أنشئ تطبيقاً (App)",
          desc: "من My Apps & Credentials → Create App → اختر Merchant → أدخل اسم التطبيق → Create App.",
        },
        {
          title: "انسخ Client ID وSecret",
          desc: "ستجد Client ID وSecret في صفحة التطبيق. انسخهما وخزّنهما بأمان.",
          tip: "اختر Sandbox للاختبار أولاً، ثم Live للإنتاج",
        },
        {
          title: "أنشئ Webhook",
          desc: "من Add Webhook في صفحة التطبيق → أدخل رابط Webhook → اختر الأحداث (PAYMENT.CAPTURE.COMPLETED, PAYMENT.SALE.REFUNDED).",
        },
      ],
      faq: [
        { q: "هل PayPal يعمل في السعودية للمبيعات المحلية؟", a: "PayPal في السعودية يقبل المدفوعات الدولية فقط. للمدفوعات المحلية (Mada، STC Pay) استخدم بوابة محلية مثل Moyasar أو Tap." },
        { q: "ما الفرق بين Sandbox وLive؟", a: "Sandbox بيئة اختبار بأموال وهمية. Live للإنتاج الحقيقي. ابدأ دائماً بـ Sandbox." },
        { q: "هل يمكن استرداد المبالغ (Refund) عبر API؟", a: "نعم، النظام يدعم استرداد كامل أو جزئي عبر PayPal API مع تسجيل العملية تلقائياً." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "invalid_credentials", label: "بيانات اعتماد غير صحيحة" },
    { value: "payment_failed", label: "فشل المدفوعات" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "currency_issue", label: "مشكلة العملة" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
