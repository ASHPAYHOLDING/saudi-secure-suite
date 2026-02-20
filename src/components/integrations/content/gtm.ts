/**
 * content/gtm.ts — محتوى تكامل Google Tag Manager
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const gtmContent: MarketingProviderContent = {
  providerId: "gtm",
  name: "Google Tag Manager",
  nameEn: "Google Tag Manager (GTM)",
  logoPath: "/brands/marketing/google-tag-manager.svg",
  color: "from-blue-400/10 to-yellow-400/5",
  description: "أدر جميع تاقات التتبع (Meta, Google Ads, TikTok...) من مكان واحد بدون تعديل الكود في كل مرة.",
  badges: [
    { label: "عالمي", icon: "🌍" },
    { label: "Marketing", icon: "📣" },
    { label: "Tag Manager", icon: "⚙️" },
  ],
  fields: [
    {
      key: "container_id",
      label: "Container ID",
      type: "text",
      placeholder: "GTM-XXXXXXX",
      hint: "من Google Tag Manager → اختر الـ Container → الـ ID في الأعلى (مثال: GTM-AB12CD3)",
      required: true,
      section: "config",
    },
    {
      key: "workspace_id",
      label: "Workspace ID (اختياري)",
      type: "text",
      placeholder: "1234567",
      hint: "رقم الـ Workspace إذا كنت تريد النشر عبر GTM API",
      section: "config",
    },
    {
      key: "publish_mode",
      label: "طريقة النشر",
      type: "select",
      options: [
        { value: "manual", label: "يدوي (من GTM مباشرةً)" },
        { value: "auto", label: "تلقائي (عبر GTM API)" },
      ],
      section: "config",
    },
    {
      key: "gtm_service_account_json",
      label: "Service Account JSON (مطلوب للنشر التلقائي)",
      type: "password",
      placeholder: "الصق محتوى ملف JSON هنا",
      hint: "من Google Cloud Console → IAM → Service Accounts → Create Key → JSON",
      section: "secrets",
    },
  ],
  testEventName: "gtm_validation",
  testPayload: { container_id: "GTM-XXXXXXX" },
  docSections: [
    {
      title: "1. أين أجد Container ID",
      steps: [
        {
          title: "ادخل إلى Google Tag Manager",
          desc: "اذهب إلى tagmanager.google.com وسجّل دخولك بحساب Google.",
        },
        {
          title: "اختر الـ Container المناسب",
          desc: "ستجد قائمة بالـ Containers. اختر الخاص بموقعك. الـ Container ID يظهر بالشكل GTM-XXXXXXX.",
          tip: "إذا لم يكن لديك Container، أنشئ واحداً وادخل اسم حسابك ونطاق الموقع.",
        },
        {
          title: "انسخ الـ Container ID",
          desc: "انقر على اسم الـ Container → ستجد الـ ID في رأس الصفحة أو في Workspace → Admin.",
        },
      ],
      faq: [
        { q: "ما هو GTM وما فائدته؟", a: "Google Tag Manager هو أداة تُمكّنك من إضافة وإدارة أكواد التتبع (Tags) في موقعك بدون تعديل الكود مباشرةً. يدعم Meta Pixel, Google Ads, TikTok, وغيرها." },
        { q: "هل GTM مجاني؟", a: "نعم، Google Tag Manager مجاني تماماً لجميع المواقع." },
      ],
    },
    {
      title: "2. كيف تضيف GTM لموقعك",
      steps: [
        {
          title: "احصل على كود التثبيت",
          desc: "من GTM → Workspace → انقر على Container ID في الأعلى → ستظهر نافذة بكودين: أحدهما لـ <head> والآخر لـ <body>.",
        },
        {
          title: "ضعهما في موقعك",
          desc: "الكود الأول بعد فتح <head>، الكود الثاني بعد فتح <body> مباشرةً. هذا كل ما تحتاجه لتثبيت GTM.",
          tip: "بعد التثبيت، كل Tags التتبع تُدار من GTM بدون لمس كود الموقع.",
        },
        {
          title: "أضف Tags داخل GTM",
          desc: "من GTM → Tags → New → اختر نوع الـ Tag (مثل Google Analytics, Meta Pixel...) وأضف التفاصيل.",
        },
      ],
      faq: [
        { q: "كيف أتحقق أن GTM مثبّت بشكل صحيح؟", a: "استخدم 'Google Tag Assistant' Extension في Chrome، أو وضع Preview في GTM نفسه. يُظهر لك جميع Tags المُشغّلة في كل صفحة." },
      ],
    },
    {
      title: "3. إدارة Meta Pixel و Google Ads عبر GTM",
      steps: [
        {
          title: "أضف Meta Pixel كـ Tag في GTM",
          desc: "من GTM → Tags → New → Community Templates → ابحث عن 'Meta Pixel'. أدخل Pixel ID وحدد Trigger.",
        },
        {
          title: "أضف Google Ads Conversion Tracking",
          desc: "من GTM → Tags → New → Google Ads Conversion Tracking. أدخل Conversion ID و Label. حدد Trigger 'Thank You Page'.",
        },
        {
          title: "انشر التغييرات",
          desc: "بعد إضافة Tags → انقر Submit في GTM → أدخل اسماً وصفياً → انشر. التغييرات تنعكس فوراً على الموقع.",
          tip: "دائماً اختبر في Preview قبل النشر للتأكد من عمل كل شيء.",
        },
      ],
      faq: [
        { q: "هل يمكن استخدام GTM مع Server-side CAPI؟", a: "نعم، GTM يدعم Server-side Container منفصل. لكن الإعداد أكثر تعقيداً ويحتاج Tagging Server مستضافاً." },
      ],
    },
  ],
  troubleshooting: [
    { problem: "الـ Tags لا تُشغَّل", cause: "Triggers غير صحيحة أو GTM غير مُثبَّت", solution: "استخدم Preview Mode في GTM للتحقق. تأكّد من وجود كودَي GTM في <head> و<body>. راجع Trigger Conditions." },
    { problem: "Container ID غير صحيح", cause: "ID مكتوب خاطئاً أو من Container آخر", solution: "ارجع لـ tagmanager.google.com وانسخ ID مباشرةً. يجب أن يبدأ بـ GTM-." },
    { problem: "Tags تُشغَّل مرتين", cause: "كود GTM مُدرج أكثر من مرة في الصفحة", solution: "تأكّد أن كود GTM موجود مرة واحدة فقط في <head> ومرة واحدة في <body>." },
  ],
  supportIssueTypes: [
    { value: "tags_not_firing", label: "Tags لا تُشغَّل" },
    { value: "container_not_loading", label: "Container لا يتحمّل" },
    { value: "publish_failed", label: "فشل النشر" },
    { value: "service_account_error", label: "خطأ في Service Account" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
