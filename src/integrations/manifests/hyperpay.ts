import type { IntegrationManifest } from "./types";

export const hyperpayManifest: IntegrationManifest = {
  providerId: "hyperpay",
  name: "هايبرباي",
  nameEn: "HyperPay",
  category: "payment",
  logoPath: "/brands/payment/hyperpay.svg",
  color: "from-orange-500/10 to-amber-500/5",
  fields: [
    {
      key: "access_token",
      label: "Access Token",
      type: "password",
      placeholder: "Access Token من HyperPay",
      hint: "يُستلم من فريق HyperPay بعد التفعيل",
      required: true,
    },
    {
      key: "entity_id_visa",
      label: "Entity ID (Visa/Mastercard)",
      type: "text",
      placeholder: "8ac7a4ca...",
      hint: "Entity ID الخاص بمدفوعات فيزا وماستركارد",
      required: true,
    },
    {
      key: "entity_id_mada",
      label: "Entity ID (مدى)",
      type: "text",
      placeholder: "8ac7a4ca...",
      hint: "Entity ID الخاص بمدفوعات مدى",
      required: false,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "Webhook Secret",
      hint: "يُستلم من فريق HyperPay",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/hyperpay-webhook",
  docsSections: [
    {
      title: "خطوات ربط HyperPay",
      officialLink: "https://hyperpay.com",
      officialLinkLabel: "موقع HyperPay",
      steps: [
        {
          title: "تواصل مع HyperPay للتفعيل",
          desc: "HyperPay تتطلب تفعيلاً يدوياً — تواصل مع فريقهم على hyperpay.com للحصول على بيانات الاعتماد.",
          tip: "قد تستغرق عملية التفعيل 2-5 أيام عمل",
        },
        {
          title: "استلم Entity IDs",
          desc: "ستستلم Entity ID مختلفاً لكل طريقة دفع (Visa/Mastercard ومدى). سجّلها بعناية.",
        },
        {
          title: "استلم Access Token",
          desc: "احفظ Access Token الذي تستلمه — يُجدَّد دورياً من HyperPay.",
        },
        {
          title: "أبلغ HyperPay بـ Webhook URL",
          desc: "أخبر فريق HyperPay بـ URL نومكسيو: [webhook_url] ليضيفوه كـ Webhook Endpoint رسمي.",
        },
      ],
      faq: [
        { q: "هل HyperPay تدعم مدى؟", a: "نعم، تدعم مدى وفيزا وماستركارد وApple Pay وSTC Pay." },
        { q: "لماذا يوجد أكثر من Entity ID؟", a: "كل طريقة دفع لها Entity ID خاص بها في نظام HyperPay." },
        { q: "كم وقت التفعيل؟", a: "عادةً 3-7 أيام عمل بعد تقديم الوثائق المطلوبة." },
        { q: "ماذا أفعل إذا انتهت صلاحية Access Token؟", a: "تواصل مع فريق HyperPay للحصول على Token جديد." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "entity_id_error", label: "خطأ في Entity ID" },
    { value: "token_expired", label: "Access Token منتهي الصلاحية" },
    { value: "mada_issue", label: "مشكلة في مدى" },
    { value: "webhook_not_received", label: "لا أستقبل Webhooks" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
