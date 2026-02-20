/**
 * content/x-pixel.ts — محتوى تكامل X (Twitter) Pixel
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const xPixelContent: MarketingProviderContent = {
  providerId: "x_pixel",
  name: "X Pixel",
  nameEn: "X (Twitter) Pixel",
  logoPath: "/brands/marketing/x.svg",
  color: "from-gray-800/10 to-gray-600/5",
  description: "تتبع التحويلات والجماهير على X (تويتر) عبر Universal Website Tag لقياس أداء الحملات الإعلانية.",
  badges: [
    { label: "عالمي", icon: "🌍" },
    { label: "Marketing", icon: "📣" },
    { label: "Browser Tag", icon: "🏷️" },
  ],
  fields: [
    {
      key: "pixel_id",
      label: "X Pixel ID (Universal Website Tag)",
      type: "text",
      placeholder: "o12345",
      hint: "من X Ads Manager → Tools → Conversion Tracking → Tag ID",
      required: true,
      section: "config",
    },
    {
      key: "enable_browser_events",
      label: "تفعيل Browser Events",
      type: "toggle",
      hint: "إرسال أحداث من المتصفح عبر X Universal Website Tag",
      section: "config",
    },
  ],
  events: [
    {
      name: "PageView",
      label: "عرض الصفحة",
      desc: "يُطلق عند تحميل أي صفحة. أساس بناء الجماهير المُعاد استهدافها.",
      snippet: `// X Pixel — PageView\ntwq('event', 'tw-o12345-pageview', {});`,
    },
    {
      name: "Purchase",
      label: "عملية شراء",
      desc: "يُطلق عند إتمام الطلب. أهم حدث لقياس ROAS على X Ads.",
      snippet: `// X Pixel — Purchase\ntwq('event', 'tw-o12345-purchase', {\n  value: '499.00',\n  currency: 'SAR',\n  order_id: 'ORD-001'\n});`,
    },
    {
      name: "AddToCart",
      label: "إضافة للسلة",
      desc: "يُطلق عند إضافة منتج لسلة التسوق.",
      snippet: `twq('event', 'tw-o12345-addtocart', { value: '250.00', currency: 'SAR' });`,
    },
    {
      name: "InitiateCheckout",
      label: "بدء الدفع",
      desc: "يُطلق عند بدء إجراءات الدفع.",
    },
    {
      name: "SignUp",
      label: "تسجيل حساب",
      desc: "يُطلق عند إنشاء حساب جديد.",
    },
  ],
  testEventName: "PageView",
  testPayload: { value: 0, currency: "SAR" },
  docSections: [
    {
      title: "1. أين أجد X Pixel ID",
      steps: [
        {
          title: "ادخل إلى X Ads Manager",
          desc: "اذهب إلى ads.x.com (أو ads.twitter.com) وسجّل دخولك بحساب المعلن.",
        },
        {
          title: "افتح Conversion Tracking",
          desc: "من القائمة العلوية → Tools → Conversion Tracking. ستجد Universal Website Tag.",
          tip: "إذا لم تجد Conversion Tracking، تأكّد أن حساب الإعلانات مُفعّل ولديه رصيد.",
        },
        {
          title: "احصل على Pixel ID",
          desc: "انقر على اسم الـ Tag لعرض تفاصيله. ستجد Tag ID بشكل مثل 'o12345'. هذا هو الـ Pixel ID.",
        },
      ],
      faq: [
        { q: "ما هو Universal Website Tag؟", a: "هو كود JavaScript يضعه X في موقعك لتتبع زوار الموقع وقياس الأحداث. مشابه لـ Meta Pixel." },
        { q: "هل يدعم X Server-side Events مثل CAPI؟", a: "X لديه Conversion API لكن في مرحلة محدودة. حالياً التتبع الأساسي يعتمد على Browser Tag." },
      ],
    },
    {
      title: "2. كيف تضيف X Pixel لموقعك",
      steps: [
        {
          title: "انسخ كود الـ Pixel",
          desc: "من X Ads Manager → Tools → Conversion Tracking → View Tag Code. انسخ الكود الكامل.",
        },
        {
          title: "ضعه في <head> موقعك",
          desc: "ألصق الكود في قسم <head> في كل صفحات الموقع. يُفضّل عبر Google Tag Manager.",
        },
        {
          title: "أضف أحداث التحويل",
          desc: "بعد الـ Tag الأساسي، أضف كود الأحداث (مثل Purchase) في الصفحات المناسبة.",
          tip: "استخدم الـ snippets في تبويب الأحداث أعلاه كنقطة بداية.",
        },
      ],
      faq: [
        { q: "هل يمكن استخدام X Pixel مع GTM؟", a: "نعم، X لديه Template رسمي في GTM Gallery. ابحث عن 'X Pixel' في Community Templates." },
      ],
    },
    {
      title: "3. التحقق من وصول الأحداث",
      steps: [
        {
          title: "فعّل X Pixel Helper",
          desc: "ثبّت إضافة 'Twitter Pixel Helper' في Chrome لمراقبة الأحداث في الوقت الفعلي أثناء التصفح.",
        },
        {
          title: "راقب في X Ads Manager",
          desc: "في Conversion Tracking → اختر Tag → Tracking History. ستجد الأحداث المستلمة في آخر 7 أيام.",
          tip: "قد تستغرق الأحداث من 2-3 ساعات حتى تظهر في التقارير.",
        },
      ],
      faq: [
        { q: "لماذا لا تظهر الأحداث؟", a: "تأكّد أن الكود مُدرج في <head>. تحقق من X Pixel Helper. تأكّد أن Pixel ID صحيح في Numaxio." },
      ],
    },
  ],
  troubleshooting: [
    { problem: "Pixel ID غير صحيح", cause: "تم إدخال ID خاطئ أو من حساب مختلف", solution: "افتح X Ads Manager → Tools → Conversion Tracking وانسخ Tag ID مباشرةً." },
    { problem: "الأحداث لا تظهر", cause: "كود الـ Pixel غير مُدرج في الموقع أو Ad Blocker نشط", solution: "تأكّد من وجود كود الـ Pixel في <head>. جرّب X Pixel Helper Extension. قم بالتصفح في وضع Incognito." },
  ],
  supportIssueTypes: [
    { value: "pixel_not_tracking", label: "الـ Pixel لا يتتبع" },
    { value: "events_missing", label: "الأحداث مفقودة" },
    { value: "pixel_id_invalid", label: "Pixel ID غير صالح" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
