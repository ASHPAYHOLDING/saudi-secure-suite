import type { IntegrationManifest } from "./types";

export const tamaraManifest: IntegrationManifest = {
  providerId: "tamara",
  name: "تمارا — تقسيط",
  nameEn: "Tamara (BNPL)",
  category: "bnpl",
  logoPath: "/brands/payment/tamara.svg",
  color: "from-green-600/10 to-green-500/5",
  fields: [
    {
      key: "api_token",
      label: "API Token",
      type: "password",
      placeholder: "eyJhbGciOi...",
      hint: "من Tamara Merchant Portal → Settings → API Credentials → Token",
      required: true,
    },
    {
      key: "public_key",
      label: "Public Key (Widget)",
      type: "text",
      placeholder: "مفتاح Widget العام",
      hint: "لعرض تجزئة Tamara في صفحة المنتج",
      required: false,
    },
    {
      key: "notification_token",
      label: "Notification Token",
      type: "password",
      placeholder: "رمز التحقق من الإشعارات",
      hint: "للتحقق من إشعارات Tamara الواردة (Webhook verification)",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/tamara-webhook",
  docsSections: [
    {
      title: "خطوات ربط تمارا",
      officialLink: "https://docs.tamara.co",
      officialLinkLabel: "وثائق تمارا للمطورين",
      steps: [
        {
          title: "سجّل كتاجر في تمارا",
          desc: "اذهب إلى merchants.tamara.co وأنشئ حسابك التجاري. تمارا سعودية وتُقبل في السعودية، الإمارات، الكويت.",
          tip: "تمارا تُعطي الأولوية للتجار السعوديين — العملية أسرع من منافسيها محلياً",
        },
        {
          title: "انتظر الموافقة والعقد",
          desc: "سيتواصل فريق تمارا التجاري معك لتوقيع العقد وتحديد رسوم الخدمة.",
        },
        {
          title: "احصل على API Token",
          desc: "من Merchant Portal → Settings → API Credentials → انسخ Token. استخدم Sandbox Token للاختبار.",
        },
        {
          title: "اختبر في Sandbox",
          desc: "استخدم Sandbox API Token مع بيانات اختبار تمارا. انظر: docs.tamara.co للبطاقات التجريبية.",
        },
        {
          title: "أعدّ Webhook",
          desc: "من Merchant Portal → Settings → Webhooks → أضف رابط Webhook وNotification Token.",
        },
      ],
      faq: [
        { q: "كيف يختلف تمارا عن تابي؟", a: "تمارا سعودية المنشأ وتقدم 3 أقساط (Pay in 3) أو 4 أقساط أو شهر كامل (Pay in 30 Days). تابي كويتية وتقدم 4 أقساط فقط." },
        { q: "ما هو الحد الأدنى والأقصى؟", a: "الحد الأدنى 100 ريال. الأقصى يعتمد على تقييم تمارا للعميل (عادة حتى 10,000 ريال)." },
        { q: "هل تمارا تدعم الاسترداد؟", a: "نعم، يمكن استرداد كامل أو جزئي. تمارا تعدّل خطة الأقساط للعميل تلقائياً." },
        { q: "كيف يعرف العميل أنه مؤهل للتقسيط؟", a: "تمارا تُقيّم العميل في الوقت الفعلي عند الدفع. لا حاجة لطلب مسبق أو أوراق." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "invalid_token", label: "API Token غير صالح" },
    { value: "order_rejected", label: "رفض طلب التقسيط" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "capture_issue", label: "مشكلة في تحصيل المبلغ" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
