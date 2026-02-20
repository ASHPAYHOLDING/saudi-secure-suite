/**
 * content/google-ads.ts — محتوى تكامل Google Ads Conversions
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const googleAdsContent: MarketingProviderContent = {
  providerId: "google_ads",
  name: "Google Ads Conversions",
  nameEn: "Google Ads Conversion Tracking",
  logoPath: "/brands/marketing/google-ads.svg",
  color: "from-green-400/10 to-blue-400/5",
  description: "ارفع تحويلات Google Ads من السيرفر لتحسين دقة قياس ROAS وتحسين الحملات عبر Smart Bidding.",
  badges: [
    { label: "عالمي", icon: "🌍" },
    { label: "Marketing", icon: "📣" },
    { label: "Server-side", icon: "🔒" },
  ],
  fields: [
    {
      key: "customer_id",
      label: "Customer ID",
      type: "text",
      placeholder: "123-456-7890",
      hint: "من Google Ads → الزاوية العلوية اليسرى (بجانب اسم الحساب). الشكل: XXX-XXX-XXXX",
      required: true,
      section: "config",
    },
    {
      key: "conversion_action_id",
      label: "Conversion Action ID",
      type: "text",
      placeholder: "1234567890",
      hint: "من Google Ads → الأهداف → التحويلات → اختر التحويل → عرض Tag → في الكود ابحث عن 'send_to'",
      required: true,
      section: "config",
    },
    {
      key: "conversion_label",
      label: "Conversion Label (اختياري)",
      type: "text",
      placeholder: "AbCdEfGhIj",
      hint: "اختياري — من كود التحويل في Google Ads، الجزء بعد '/' في قيمة send_to",
      section: "config",
    },
    {
      key: "currency",
      label: "العملة",
      type: "select",
      options: [
        { value: "SAR", label: "ريال سعودي (SAR)" },
        { value: "USD", label: "دولار أمريكي (USD)" },
        { value: "AED", label: "درهم إماراتي (AED)" },
        { value: "KWD", label: "دينار كويتي (KWD)" },
      ],
      section: "config",
    },
    {
      key: "google_ads_client_id",
      label: "OAuth Client ID",
      type: "password",
      placeholder: "XXXXXXXX.apps.googleusercontent.com",
      hint: "من Google Cloud Console → APIs → Credentials → OAuth 2.0 Client ID",
      required: true,
      section: "secrets",
    },
    {
      key: "google_ads_client_secret",
      label: "OAuth Client Secret",
      type: "password",
      placeholder: "GOCSPX-XXXXXXXXXXXXXX",
      hint: "من نفس صفحة Client ID → Client Secret",
      required: true,
      section: "secrets",
    },
    {
      key: "google_ads_refresh_token",
      label: "Refresh Token",
      type: "password",
      placeholder: "1//XXXXXXXX",
      hint: "احصل عليه بعد OAuth flow من Google. راجع الدليل أدناه.",
      required: true,
      section: "secrets",
    },
    {
      key: "developer_token",
      label: "Developer Token",
      type: "password",
      placeholder: "XXXXXXXXXXXXXXXX",
      hint: "من Google Ads API Center → Developer Token. يتطلب تطبيق API مُعتمد.",
      required: true,
      section: "secrets",
    },
  ],
  testEventName: "Purchase",
  testPayload: { value: 100, currency: "SAR", order_id: `TEST-${Date.now()}` },
  docSections: [
    {
      title: "1. أين أجد Customer ID",
      steps: [
        {
          title: "ادخل إلى Google Ads",
          desc: "اذهب إلى ads.google.com وسجّل دخولك بحساب المعلن.",
        },
        {
          title: "انظر إلى الزاوية العلوية اليسرى",
          desc: "بجانب اسم الحساب ستجد Customer ID بالشكل: 123-456-7890.",
          tip: "احتفظ بـ ID بدون الشرطات (-) عند إدخاله في بعض الأدوات.",
        },
      ],
      faq: [
        { q: "ما الفرق بين Customer ID و Account ID؟", a: "هما نفس الشيء في Google Ads. Customer ID هو المسمى الرسمي في API." },
      ],
    },
    {
      title: "2. كيف أجد Conversion Action ID",
      steps: [
        {
          title: "اذهب إلى الأهداف في Google Ads",
          desc: "من القائمة الجانبية → الأهداف → التحويلات → قائمة التحويلات. اختر التحويل الذي تريد تتبعه.",
        },
        {
          title: "افتح تفاصيل الـ Tag",
          desc: "انقر على اسم التحويل → 'عرض تعليمات وضع العلامات' → 'استخدام Google Tag Manager'. ستجد Conversion ID و Label.",
        },
        {
          title: "استخرج Conversion Action ID",
          desc: "في كود الـ Tag ابحث عن 'send_to': 'AW-XXXXXXXXXX/AbCdEfGhIj'. الرقم بعد AW- هو Conversion ID، والنص بعد / هو Label.",
          tip: "Conversion Action ID في الـ API يختلف عن Conversion ID في الكود. للـ API تحتاج ID من Google Ads API Conversions list.",
        },
      ],
      faq: [
        { q: "هل يمكن تتبع أكثر من تحويل؟", a: "نعم، يمكن إضافة تكاملات منفصلة لكل Conversion Action مختلف." },
      ],
    },
    {
      title: "3. إعداد OAuth والحصول على Refresh Token",
      steps: [
        {
          title: "أنشئ OAuth 2.0 Credentials في Google Cloud",
          desc: "اذهب إلى console.cloud.google.com → APIs & Services → Credentials → Create Credentials → OAuth client ID. اختر 'Desktop app'.",
          tip: "يجب تفعيل Google Ads API في المشروع أولاً من APIs & Services → Library.",
        },
        {
          title: "احصل على Refresh Token عبر OAuth Playground",
          desc: "اذهب إلى developers.google.com/oauthplayground → الإعدادات → Enter Client ID & Secret → اختر 'https://www.googleapis.com/auth/adwords' → Authorize → Exchange for tokens.",
        },
        {
          title: "احصل على Developer Token",
          desc: "من Google Ads → الأدوات → مركز واجهة برمجة التطبيقات (API Center). Developer Token يظهر هنا. قد يحتاج موافقة من Google.",
        },
      ],
      faq: [
        { q: "هل إعداد Google Ads API معقد؟", a: "نعم، يتطلب خطوات إضافية مقارنة بـ Meta أو TikTok. اتبع الدليل بدقة أو راسل الدعم للمساعدة." },
        { q: "هل Developer Token مطلوب دائماً؟", a: "نعم، هو إلزامي لاستخدام Google Ads API. يمكنك الحصول على Test Account Token فورياً لكن Production Token يحتاج مراجعة Google." },
      ],
    },
    {
      title: "4. التحقق من وصول التحويلات",
      steps: [
        {
          title: "أرسل حدث تجريبي",
          desc: "من تبويب 'اختبار الإرسال' أرسل حدث Purchase تجريبي. راجع السجلات للتأكد من HTTP 200.",
        },
        {
          title: "راقب في Google Ads",
          desc: "في Google Ads → الأهداف → التحويلات → انتظر 24-48 ساعة. التحويلات تأخذ وقتاً أطول للظهور مقارنة بـ Meta.",
          tip: "استخدم Conversion Testing Tool في Google Ads للتحقق الفوري.",
        },
      ],
      faq: [
        { q: "لماذا التحويلات لا تظهر فوراً؟", a: "Google Ads يعالج بيانات التحويل خلال 24-48 ساعة. Clickthrough Conversions تظهر أسرع من View-through." },
      ],
    },
  ],
  troubleshooting: [
    { problem: "Token expired / 401 Unauthorized", cause: "Refresh Token انتهت صلاحيته أو تم إلغاؤه", solution: "أعد OAuth flow للحصول على Refresh Token جديد. أدخله في Numaxio. قد يحتاج تجديد الـ Token كل 6 أشهر حسب إعدادات OAuth." },
    { problem: "Developer token not approved", cause: "Developer Token في وضع Test ولا يعمل مع بيانات Production", solution: "طلب Production Access من مركز API في Google Ads. يستغرق أيام قليلة للمراجعة." },
    { problem: "Invalid Customer ID", cause: "Customer ID مكتوب بشكل خاطئ أو يحتوي على شرطات", solution: "أدخل Customer ID بدون شرطات: مثلاً 1234567890 وليس 123-456-7890." },
    { problem: "Conversion not found", cause: "Conversion Action ID غير صحيح أو تم حذف التحويل", solution: "راجع قائمة التحويلات في Google Ads وتأكّد من ID. قد تحتاج إعادة إنشاء الـ Conversion Action." },
  ],
  supportIssueTypes: [
    { value: "auth_failed", label: "فشل المصادقة (OAuth)" },
    { value: "conversion_not_tracking", label: "التحويلات لا تُرصد" },
    { value: "developer_token_issue", label: "مشكلة في Developer Token" },
    { value: "invalid_ids", label: "Customer ID أو Conversion ID خاطئ" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
