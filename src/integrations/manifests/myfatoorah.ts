import type { IntegrationManifest } from "./types";

export const myfatoorahManifest: IntegrationManifest = {
  providerId: "myfatoorah",
  name: "MyFatoorah",
  nameEn: "MyFatoorah",
  category: "payment",
  logoPath: "/brands/payment/myfatoorah.svg",
  color: "from-teal-600/10 to-teal-500/5",
  integrationKey: "pay_myfatoorah",
  badges: ["local"],
  docsUrl: "https://docs.myfatoorah.com/",
  webhookSignatureHeader: "x-webhook-secret",
  webhookSecretLabel: "Webhook Secret",
  webhookSecretHint: "من MyFatoorah Dashboard → Settings → Webhooks",
  supportedMethods: ["KNET", "مدى", "Visa", "Mastercard", "Apple Pay", "STC Pay", "Benefit"],
  useCases: ["مدفوعات خليجية", "روابط دفع", "تحصيل الفواتير"],
  commonErrors: [
    { code: "Invalid token", fix: "تحقق من API Token — انتبه لبيئة Test vs Live" },
    { code: "webhook not verified", fix: "تأكد من Webhook Secret المضاف في الداشبورد" },
  ],
  description: "بوابة دفع خليجية تدعم مدى وKNET وBenefit وSTC Pay مع تغطية شاملة لدول الخليج.",
  benefits: [
    "تغطية كاملة لدول الخليج (السعودية، الكويت، الإمارات، قطر، البحرين، عُمان)",
    "دعم KNET (الكويت) وBenefitPay (البحرين)",
    "STC Pay وApple Pay مدمجة",
    "واجهة دفع مستضافة جاهزة",
  ],
  requirements: [
    "حساب MyFatoorah مفعّل ومعتمد",
    "API Token (Live أو Test)",
    "كود الدولة الصحيح (SAU/KWT/ARE/QAT/BHR/OMN)",
  ],
  troubleshootingItems: [
    {
      problem: "خطأ 'Invalid Token'",
      cause: "API Token غير صحيح أو منتهي الصلاحية.",
      solution: "أنشئ Token جديد من MyFatoorah Portal → Settings → API Keys.",
    },
    {
      problem: "خطأ 'Country not supported'",
      cause: "كود الدولة المُدخل لا يتطابق مع حساب MyFatoorah.",
      solution: "استخدم نفس كود الدولة الذي سجّلت به حسابك: SAU, KWT, ARE, QAT, BHR, OMN.",
    },
  ],
  fields: [
    {
      key: "api_key",
      label: "API Token",
      type: "password",
      placeholder: "rLtt6JWvbUHDDhsZnfpAhpYk...",
      hint: "من MyFatoorah Portal → Settings → API Keys → Live/Test API Key",
      required: true,
    },
    {
      key: "country_code",
      label: "كود الدولة",
      type: "text",
      placeholder: "SAU",
      hint: "SAU للسعودية، KWT للكويت، ARE للإمارات، QAT لقطر",
      required: true,
    },
  ],
  webhookPath: "/functions/v1/myfatoorah-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط MyFatoorah",
      officialLink: "https://docs.myfatoorah.com",
      officialLinkLabel: "وثائق MyFatoorah",
      steps: [
        {
          title: "سجّل في MyFatoorah",
          desc: "اذهب إلى portal.myfatoorah.com وسجّل حسابك التجاري. انتظر موافقة الفريق.",
          tip: "اختار كود الدولة الصحيح عند التسجيل — لا يمكن تغييره لاحقاً",
        },
        {
          title: "احصل على API Token",
          desc: "بعد الموافقة، اذهب إلى Settings → API Keys → انسخ Live API Key للإنتاج أو Test API Key للتجربة.",
        },
        {
          title: "اختر كود الدولة",
          desc: "SAU للسعودية، KWT للكويت، ARE للإمارات، QAT لقطر، BHR للبحرين، OMN لعُمان.",
        },
        {
          title: "أدخل البيانات وأختبر",
          desc: "أدخل API Token وكود الدولة ثم اضغط اختبار الاتصال.",
        },
      ],
      faq: [
        { q: "هل MyFatoorah يدعم Mada؟", a: "نعم، MyFatoorah يدعم Mada وKNET (الكويت) وBenefitPay (البحرين) وSTC Pay." },
        { q: "ما الفرق بين Live وTest API؟", a: "Test API للتجربة بدون معاملات حقيقية. Live API للإنتاج. استخدم Test أولاً للتأكد من الإعداد." },
        { q: "كيف أُفعّل طرق الدفع الإضافية؟", a: "من MyFatoorah Portal → Payment Methods → فعّل الطرق التي تريدها (KNET, Mada, STC Pay...)." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "invalid_api_key", label: "API Key غير صالح" },
    { value: "payment_failed", label: "فشل المدفوعات" },
    { value: "knet_issue", label: "مشكلة مع KNET" },
    { value: "mada_issue", label: "مشكلة مع Mada" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
