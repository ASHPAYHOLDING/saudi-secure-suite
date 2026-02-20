/**
 * content/meta-catalog.ts — محتوى تكامل Meta (Facebook + Instagram) Catalog
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const metaCatalogContent: MarketingProviderContent = {
  providerId: "meta_catalog",
  name: "Meta Catalog (Facebook + Instagram)",
  nameEn: "Meta Product Catalog",
  logoPath: "/brands/marketing/meta.svg",
  color: "from-blue-500/10 to-purple-400/5",
  description: "زامن كاتالوج منتجاتك مع Meta Commerce لعرضها في Facebook Shop و Instagram Shopping وحملات Dynamic Ads.",
  badges: [
    { label: "عالمي", icon: "🌍" },
    { label: "Marketing", icon: "📣" },
    { label: "Catalog", icon: "🧾" },
  ],
  fields: [
    {
      key: "catalog_id",
      label: "Catalog ID",
      type: "text",
      placeholder: "123456789012345",
      hint: "من Meta Commerce Manager → Catalogs → اختر الكاتالوج → Basic Settings → Catalog ID",
      required: true,
      section: "config",
    },
    {
      key: "feed_type",
      label: "طريقة إضافة المنتجات",
      type: "select",
      options: [
        { value: "scheduled", label: "feed مجدول (URL رابط)" },
        { value: "on_demand", label: "API مباشر (push)" },
      ],
      section: "config",
    },
    {
      key: "currency",
      label: "عملة الأسعار",
      type: "select",
      options: [
        { value: "SAR", label: "ريال سعودي (SAR)" },
        { value: "AED", label: "درهم إماراتي (AED)" },
        { value: "USD", label: "دولار أمريكي (USD)" },
      ],
      section: "config",
    },
    {
      key: "language",
      label: "لغة الكاتالوج",
      type: "select",
      options: [
        { value: "ar", label: "العربية" },
        { value: "en", label: "الإنجليزية" },
      ],
      section: "config",
    },
    {
      key: "access_token",
      label: "Access Token",
      type: "password",
      placeholder: "أدخل Access Token من Meta",
      hint: "نفس Access Token المستخدم في Meta Pixel + CAPI إن وُجد",
      required: true,
      section: "secrets",
    },
  ],
  testEventName: "catalog_sync",
  testPayload: { mode: "dry_run" },
  docSections: [
    {
      title: "1. ما هو Meta Catalog وما فائدته",
      steps: [
        {
          title: "تعريف Meta Catalog",
          desc: "Catalog هو قاعدة بيانات منتجاتك داخل Meta. يتيح عرض منتجاتك تلقائياً في Facebook Shop و Instagram Shopping وحملات Dynamic Ads التي تستهدف كل مستخدم بالمنتج الأنسب له.",
        },
        {
          title: "فوائد Dynamic Ads",
          desc: "بدلاً من إنشاء إعلان يدوي لكل منتج، تُنشئ حملة واحدة تعرض آلياً المنتجات التي شاهدها أو أضافها المستخدم للسلة — رفع كبير في ROAS.",
        },
      ],
      faq: [
        { q: "هل أحتاج Meta Pixel مع الكاتالوج؟", a: "نعم، Meta Pixel أو CAPI مطلوب لربط زيارات الموقع بمنتجات الكاتالوج لعمل Dynamic Ads." },
      ],
    },
    {
      title: "2. أين أجد Catalog ID",
      steps: [
        {
          title: "افتح Meta Commerce Manager",
          desc: "اذهب إلى business.facebook.com → Commerce Manager. أو من Business Settings → Data Sources → Catalogs.",
        },
        {
          title: "اختر الكاتالوج",
          desc: "ستجد قائمة بالكاتالوجات. انقر على الكاتالوج الخاص بك.",
          tip: "إذا لم يكن لديك كاتالوج، أنشئ واحداً جديداً من Commerce Manager → Create Catalog.",
        },
        {
          title: "انسخ Catalog ID",
          desc: "من قائمة الإعدادات → Basic Settings → ستجد Catalog ID (رقم كبير).",
        },
      ],
      faq: [
        { q: "كم عدد المنتجات التي يمكن إضافتها؟", a: "يدعم Meta ملايين المنتجات. لكن حجم الـ feed المثالي أقل من 100,000 منتج للأداء الأفضل." },
      ],
    },
    {
      title: "3. طرق مزامنة المنتجات",
      steps: [
        {
          title: "Feed مجدول (URL)",
          desc: "تُنشئ Numaxio رابطاً (URL) لكاتالوجك. تُضيفه في Meta Commerce Manager كـ Data Feed. Meta تسحبه تلقائياً يومياً.",
          tip: "أفضل للمتاجر الكبيرة ذات التحديثات الدورية المنتظمة.",
        },
        {
          title: "API مباشر (Push)",
          desc: "Numaxio يرسل المنتجات مباشرةً إلى Meta عبر Catalog Batch API. فوري لكن يستهلك API calls أكثر.",
          tip: "أفضل للمتاجر التي تحتاج تحديثات لحظية (كالمخزون والأسعار).",
        },
      ],
      faq: [
        { q: "ما هو أفضل Sync Frequency؟", a: "يومياً كافٍ للغالبية. إذا تتغير الأسعار أو المخزون بشكل متكرر، استخدم Push API أو Hourly Feed." },
      ],
    },
    {
      title: "4. التحقق من جودة الكاتالوج",
      steps: [
        {
          title: "راجع Catalog Quality في Meta",
          desc: "في Commerce Manager → Catalog → Issues. ستجد قائمة بالمنتجات التي بها مشاكل (صور مفقودة، أسعار ناقصة، إلخ).",
        },
        {
          title: "أصلح الأخطاء",
          desc: "الأخطاء الشائعة: صورة الحجم صغير (<500×500)، وصف فارغ، رابط منتج معطوب. أصلحها في بيانات المنتج في Numaxio.",
        },
      ],
      faq: [
        { q: "لماذا بعض المنتجات مرفوضة في Meta؟", a: "Meta لها متطلبات صارمة: صور عالية الجودة، أوصاف واضحة، أسعار دقيقة، رابط سليم. راجع Commerce Policies." },
      ],
    },
  ],
  troubleshooting: [
    { problem: "المنتجات لا تظهر في الكاتالوج", cause: "Feed لم يُعالَج بعد أو Catalog ID خاطئ", solution: "انتظر ساعة لمعالجة الـ Feed. تأكّد من Catalog ID في Commerce Manager. راجع Catalog Issues لتفاصيل الأخطاء." },
    { problem: "صور المنتجات مرفوضة", cause: "الصور أصغر من 500×500 أو JPG/PNG غير صالح", solution: "استخدم صوراً بأبعاد لا تقل عن 800×800 بكسل بصيغة JPG أو PNG." },
    { problem: "Access Token غير صالح", cause: "Token انتهت صلاحيته أو لا يملك صلاحية Catalog", solution: "أنشئ Access Token جديداً من Business Settings. تأكّد أن Token لديه صلاحية 'catalog_management'." },
  ],
  supportIssueTypes: [
    { value: "catalog_not_syncing", label: "الكاتالوج لا يتزامن" },
    { value: "products_rejected", label: "منتجات مرفوضة" },
    { value: "feed_error", label: "خطأ في الـ Feed" },
    { value: "invalid_token", label: "Access Token غير صالح" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
