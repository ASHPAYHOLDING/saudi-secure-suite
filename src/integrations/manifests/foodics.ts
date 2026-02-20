import type { IntegrationManifest } from "./types";

export const foodicsManifest: IntegrationManifest = {
  providerId: "foodics",
  name: "فودكس",
  nameEn: "Foodics",
  category: "pos",
  logoPath: undefined,
  color: "from-orange-500/10 to-amber-500/5",
  fields: [
    {
      key: "api_token",
      label: "API Token",
      type: "password",
      placeholder: "Token من فودكس",
      hint: "من فودكس Dashboard → Settings → Developer → API Keys → Create Token",
      required: true,
    },
    {
      key: "business_id",
      label: "Business ID",
      type: "text",
      placeholder: "معرف المنشأة",
      hint: "تجده في إعدادات حسابك في فودكس",
      required: false,
    },
  ],
  docsSections: [
    {
      title: "خطوات ربط فودكس",
      officialLink: "https://developers.foodics.com",
      officialLinkLabel: "وثائق فودكس للمطورين",
      steps: [
        {
          title: "سجّل دخولك على فودكس",
          desc: "اذهب إلى dashboard.foodics.com وسجّل دخولك بحسابك التجاري.",
          tip: "تأكد أن حسابك لديه صلاحيات Business أو Owner",
        },
        {
          title: "انتقل إلى إعدادات المطوّر",
          desc: "من القائمة اختر Settings → Developer → API Keys.",
        },
        {
          title: "أنشئ مفتاح API",
          desc: "اضغط Create Token، اختر الصلاحيات المطلوبة (Orders, Products, Customers)، ثم انسخ الـ Token.",
        },
        {
          title: "أدخل المفتاح هنا",
          desc: "الصق مفتاح API في خانة الإعداد، سيتم تشفيره فوراً وبشكل آمن.",
        },
        {
          title: "ابدأ المزامنة",
          desc: "ستظهر بيانات الفواتير والمبيعات من فودكس تلقائياً في لوحة التقارير.",
          tip: "يُحدَّث السجل كل 15 دقيقة تلقائياً",
        },
      ],
      faq: [
        { q: "ما الصلاحيات المطلوبة لمفتاح فودكس؟", a: "Orders (Read), Products (Read)، وCustomers (Read) كافية للتشغيل الأساسي." },
        { q: "هل يعمل مع فودكس الإصدار القديم؟", a: "يدعم النظام الإصدار F5 وما فوق. تأكد من تحديث حسابك." },
        { q: "كيف أعرف إذا كان الربط يعمل؟", a: "ستظهر آخر 5 فواتير من فودكس في لوحة التقارير خلال دقيقتين من الإعداد." },
        { q: "هل يمكن مزامنة المخزون؟", a: "نعم، من إعدادات التكامل يمكنك تفعيل مزامنة المخزون." },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "sync_error", label: "خطأ في المزامنة" },
    { value: "missing_orders", label: "طلبات مفقودة" },
    { value: "inventory_mismatch", label: "عدم تطابق المخزون" },
    { value: "token_invalid", label: "Token غير صالح" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
