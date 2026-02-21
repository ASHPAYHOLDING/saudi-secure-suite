import type { IntegrationManifest } from "./types";

export const paytabsManifest: IntegrationManifest = {
  providerId: "paytabs",
  name: "PayTabs",
  nameEn: "PayTabs",
  category: "payment",
  logoPath: "/brands/payment/paytabs.svg",
  color: "from-blue-600/10 to-blue-500/5",
  integrationKey: "pay_paytabs",
  badges: ["local"],
  docsUrl: "https://developers.paytabs.com",
  webhookSignatureHeader: "signature",
  webhookSecretLabel: "IPN Secret",
  webhookSecretHint: "من PayTabs Dashboard → Developers → IPN Settings",
  supportedMethods: ["مدى", "Visa", "Mastercard", "Amex", "Apple Pay", "Fawry"],
  useCases: ["مدفوعات إقليمية", "قبول عملات متعددة", "حلول للمؤسسات"],
  commonErrors: [
    { code: "IPN signature mismatch", fix: "تحقق من IPN Secret Key" },
    { code: "profile_id invalid", fix: "تأكد من Profile ID الصحيح" },
  ],
  description: "بوابة دفع إلكتروني تخدم المنطقة العربية مع دعم مدى وفيزا وماستركارد وتغطية لأكثر من 7 دول.",
  benefits: [
    "تغطية واسعة: السعودية والإمارات ومصر وعُمان والأردن",
    "دعم مدى وAMEX بالإضافة لفيزا وماستركارد",
    "نموذج دفع مدمج (Hosted Payment Page)",
    "تقارير مفصّلة ولوحة تحكم عربية",
  ],
  requirements: [
    "حساب تاجر مفعّل على PayTabs",
    "Profile ID + Server Key",
    "KYC مكتمل",
    "اختيار المنطقة الصحيحة (SAU/ARE/EGY)",
  ],
  troubleshootingItems: [
    {
      problem: "خطأ 'Invalid Profile ID'",
      cause: "Profile ID غير صحيح أو لا يتطابق مع المنطقة.",
      solution: "تأكد من Profile ID من PayTabs Dashboard → My Profile وأن المنطقة المختارة صحيحة.",
    },
    {
      problem: "رفض المدفوعات بدون سبب واضح",
      cause: "Server Key منتهي أو خطأ في إعدادات 3D Secure.",
      solution: "جدّد Server Key من Developers → Keys وتأكد من تفعيل 3D Secure في إعدادات PayTabs.",
    },
  ],
  fields: [
    {
      key: "profile_id",
      label: "Profile ID",
      type: "text",
      placeholder: "12345",
      hint: "من لوحة تحكم PayTabs → My Profile → Profile ID",
      required: true,
    },
    {
      key: "server_key",
      label: "Server Key",
      type: "password",
      placeholder: "S-XXXXXXXXXXXX",
      hint: "من PayTabs Dashboard → Developers → Keys → Server Key",
      required: true,
    },
    {
      key: "client_key",
      label: "Client Key",
      type: "password",
      placeholder: "C-XXXXXXXXXXXX",
      hint: "من PayTabs Dashboard → Developers → Keys → Client Key",
      required: false,
    },
    {
      key: "region",
      label: "Region",
      type: "text",
      placeholder: "SAU",
      hint: "كود المنطقة: SAU للسعودية، ARE للإمارات، EGY لمصر",
      required: true,
    },
  ],
  webhookPath: "/functions/v1/paytabs-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "خطوات ربط PayTabs",
      officialLink: "https://developers.paytabs.com",
      officialLinkLabel: "وثائق PayTabs",
      steps: [
        {
          title: "سجّل دخولك على PayTabs",
          desc: "اذهب إلى merchant.paytabs.com وسجّل دخولك بحساب التاجر.",
          tip: "تأكد أن حسابك مفعّل وموثّق (KYC مكتمل)",
        },
        {
          title: "احصل على Profile ID",
          desc: "من لوحة التحكم → My Profile → ستجد Profile ID في أعلى الصفحة.",
        },
        {
          title: "احصل على Server Key",
          desc: "من لوحة التحكم → Developers → Keys → Server Key. انسخه وخزّنه بأمان.",
        },
        {
          title: "اختر المنطقة الصحيحة",
          desc: "SAU للمملكة العربية السعودية، ARE للإمارات، EGY لمصر. المنطقة تحدد نقطة النهاية (Endpoint) الصحيحة.",
        },
        {
          title: "أدخل البيانات وأختبر الاتصال",
          desc: "أدخل Profile ID وServer Key والمنطقة ثم اضغط اختبار الاتصال للتحقق.",
        },
      ],
      faq: [
        { q: "ما الفرق بين Server Key وClient Key؟", a: "Server Key يُستخدم من الخادم لإنشاء جلسات الدفع. Client Key يُستخدم في واجهة المستخدم لعرض نموذج الدفع فقط." },
        { q: "ما هي المناطق المدعومة؟", a: "SAU (السعودية)، ARE (الإمارات)، EGY (مصر)، JOR (الأردن)، OMN (عُمان)، IRQ (العراق)، PAK (باكستان)." },
        { q: "هل PayTabs يدعم Mada؟", a: "نعم، PayTabs يدعم Mada وVisa وMastercard وAMEX في المملكة العربية السعودية." },
      ],
    },
    {
      title: "إعداد Webhook",
      steps: [
        {
          title: "انسخ رابط Webhook",
          desc: "انسخ رابط Webhook الظاهر في صفحة الإعداد.",
        },
        {
          title: "أضفه في PayTabs",
          desc: "من PayTabs Dashboard → Developers → Webhooks → Add New → الصق الرابط واختر الأحداث.",
        },
      ],
      faq: [
        { q: "أي أحداث Webhook أختار؟", a: "اختر على الأقل: payment.success, payment.failure, refund.success" },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "invalid_credentials", label: "بيانات اعتماد غير صحيحة" },
    { value: "payment_declined", label: "رفض المدفوعات" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "mada_issue", label: "مشكلة مع Mada" },
    { value: "refund_issue", label: "مشكلة في الاسترداد" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
