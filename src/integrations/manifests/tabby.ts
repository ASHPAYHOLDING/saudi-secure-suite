import type { IntegrationManifest } from "./types";

export const tabbyManifest: IntegrationManifest = {
  providerId: "tabby",
  name: "تابي — تقسيط",
  nameEn: "Tabby (BNPL)",
  category: "bnpl",
  logoPath: "/brands/payment/tabby.svg",
  color: "from-yellow-500/10 to-yellow-400/5",
  fields: [
    {
      key: "api_key",
      label: "Secret Key",
      type: "password",
      placeholder: "sk_test_xxxx أو sk_live_xxxx",
      hint: "من Tabby Merchant Dashboard → Settings → API Keys",
      required: true,
    },
    {
      key: "public_key",
      label: "Public Key",
      type: "text",
      placeholder: "pk_test_xxxx أو pk_live_xxxx",
      hint: "المفتاح العام لعرض Tabby widget في الواجهة",
      required: false,
    },
    {
      key: "merchant_code",
      label: "Merchant Code",
      type: "text",
      placeholder: "كود التاجر",
      hint: "تجده في إعدادات حسابك في Tabby",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/tabby-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط Tabby",
      officialLink: "https://docs.tabby.ai",
      officialLinkLabel: "Tabby Developer Docs",
      steps: [
        {
          title: "سجّل كتاجر في Tabby",
          desc: "اذهب إلى merchant.tabby.ai وسجّل حسابك التجاري. يتطلب Tabby توثيق الهوية التجارية.",
          tip: "Tabby متاح في السعودية، الإمارات، الكويت، البحرين",
        },
        {
          title: "انتظر الموافقة التجارية",
          desc: "فريق Tabby سيتواصل معك لإكمال إجراءات العقد التجاري قبل تفعيل API.",
        },
        {
          title: "احصل على API Keys",
          desc: "بعد الموافقة، من Settings → API Keys → انسخ Secret Key (للخادم) وPublic Key (للواجهة).",
        },
        {
          title: "اختبر في بيئة Test",
          desc: "استخدم sk_test وpk_test أولاً مع بطاقات الاختبار المتاحة في Tabby Docs.",
        },
        {
          title: "فعّل بيئة الإنتاج",
          desc: "بعد اختبار ناجح، استخدم sk_live وpk_live وأعد تهيئة Webhook.",
        },
      ],
      faq: [
        { q: "كيف يعمل نظام التقسيط في Tabby؟", a: "يُقسّم Tabby المبلغ إلى 4 أقساط شهرية بدون فوائد. العميل يدفع القسط الأول فور الشراء." },
        { q: "ما هو الحد الأدنى والأقصى لمبلغ الطلب؟", a: "الحد الأدنى 50 ريال، الأقصى يعتمد على تقييم ائتمان العميل ونوع التاجر (عادة 5000-10000 ريال)." },
        { q: "متى يصل المبلغ للتاجر؟", a: "يستلم التاجر المبلغ الكامل من Tabby مباشرة بعد تأكيد الطلب. Tabby تتحمل مخاطر الائتمان." },
        { q: "هل يمكن استرداد طلبات Tabby؟", a: "نعم، يمكن استرداد كامل أو جزئي. Tabby ستعدّل جدول أقساط العميل تلقائياً." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "invalid_keys", label: "API Keys غير صالحة" },
    { value: "payment_rejected", label: "رفض طلب التقسيط" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "limit_issue", label: "تجاوز حد المبلغ" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
