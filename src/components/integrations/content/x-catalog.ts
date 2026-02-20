/**
 * content/x-catalog.ts — محتوى تكامل X (Twitter) Catalog
 * مزامنة كاتالوج المنتجات مع X Ads للحملات الديناميكية
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const xCatalogContent: MarketingProviderContent = {
  providerId: "x_catalog",
  name: "X Catalog (كاتالوج منتجات X)",
  nameEn: "X (Twitter) Product Catalog",
  logoPath: "/brands/marketing/x.svg",
  color: "from-gray-800/10 to-gray-500/5",
  description: "زامن كاتالوج منتجاتك مع X Ads لعرضها في حملات Dynamic Product Ads واستهداف مستخدمي X بالمنتجات المناسبة.",
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
      placeholder: "o12345",
      hint: "من X Ads Manager → Creatives → Dynamic Product Ads → Catalogs → اختر الكاتالوج → Catalog ID",
      required: true,
      section: "config",
    },
    {
      key: "feed_format",
      label: "تنسيق الـ Feed",
      type: "select",
      options: [
        { value: "xml", label: "XML (Google Merchant Center Format)" },
        { value: "csv", label: "CSV (Tab-separated)" },
      ],
      section: "config",
    },
    {
      key: "feed_url",
      label: "Feed URL (اختياري)",
      type: "url",
      placeholder: "https://yoursite.com/products.xml",
      hint: "رابط خارجي لـ feed المنتجات إذا كنت تعتمد على Pull بدلاً من Push API",
      section: "config",
    },
    {
      key: "api_key",
      label: "X Ads API Key (Consumer Key)",
      type: "password",
      placeholder: "xxxxxxxxxxxxxxxxxxxx",
      hint: "من developer.twitter.com → Apps → اختر التطبيق → Keys and Tokens → API Key",
      required: true,
      section: "secrets",
    },
    {
      key: "api_secret",
      label: "X Ads API Secret (Consumer Secret)",
      type: "password",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "من نفس صفحة API Key → API Key Secret",
      required: true,
      section: "secrets",
    },
    {
      key: "access_token",
      label: "Access Token",
      type: "password",
      placeholder: "1234567890-xxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "من Keys and Tokens → Access Token & Secret (مطلوب صلاحية Read and Write)",
      required: true,
      section: "secrets",
    },
    {
      key: "access_token_secret",
      label: "Access Token Secret",
      type: "password",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "من نفس صفحة Access Token → Access Token Secret",
      required: true,
      section: "secrets",
    },
  ],
  testEventName: "catalog_validation",
  testPayload: { mode: "dry_run", catalog_id: "x_catalog" },
  docSections: [
    {
      title: "1. ما هو X Catalog وحملات Dynamic Product Ads",
      steps: [
        {
          title: "تعريف X Catalog",
          desc: "كاتالوج المنتجات في X هو قاعدة بيانات منتجاتك داخل منصة الإعلانات. يتيح إطلاق حملات Dynamic Product Ads التي تعرض تلقائياً المنتجات الأنسب لكل مستخدم بناءً على اهتماماته وتصفحه.",
          tip: "X Catalog يتطلب وجود X Shopping Catalog مُفعَّل لحساب الإعلانات.",
        },
        {
          title: "فائدة Dynamic Product Ads على X",
          desc: "بدلاً من إنشاء إعلان يدوي لكل منتج، تُنشئ حملة واحدة. X يختار تلقائياً المنتجات الأنسب من كاتالوجك لكل مستخدم — رفع كبير في CTR وتقليل تكلفة الإعلان.",
        },
      ],
      faq: [
        { q: "هل X Catalog مجاني؟", a: "نعم، إنشاء الكاتالوج مجاني. تدفع فقط على تشغيل الحملات الإعلانية." },
        { q: "هل أحتاج X Pixel مع الكاتالوج؟", a: "يُفضَّل نعم. X Pixel يتتبع زيارات منتجاتك مما يُمكّن X من تحسين استهداف Dynamic Ads بشكل أفضل." },
      ],
    },
    {
      title: "2. إنشاء X Developer App والحصول على API Keys",
      steps: [
        {
          title: "اذهب إلى X Developer Portal",
          desc: "اذهب إلى developer.twitter.com وسجّل دخولك. اختر 'Projects & Apps' ثم أنشئ App جديداً إذا لم يكن لديك واحد.",
          tip: "تأكّد من تطبيق للاستخدام التجاري (Commercial Use) وليس التطوير الشخصي فقط.",
        },
        {
          title: "احصل على API Key وSecret",
          desc: "من App Settings → Keys and Tokens → API Key and Secret. انسخهما معاً في مكان آمن.",
          tip: "API Key Secret يظهر مرة واحدة فقط. إذا نسيته، ستحتاج إعادة توليده.",
        },
        {
          title: "ولّد Access Token بصلاحية Ads",
          desc: "من Keys and Tokens → Access Token & Secret → Generate. تأكّد من أن الـ App له صلاحية 'Read and Write'. للـ Ads API قد تحتاج Elevated Access.",
        },
        {
          title: "طلب X Ads API Access",
          desc: "اذهب إلى developer.twitter.com → Products → X Ads API → Apply for Access. ملأ النموذج بتفاصيل استخدامك. الموافقة تستغرق يومين إلى أسبوع.",
        },
      ],
      faq: [
        { q: "لماذا أحتاج X Ads API Access منفصل؟", a: "X تُميّز بين الوصول العام للـ API والوصول لـ Ads API التي تتطلب موافقة مسبقة للحفاظ على جودة الإعلانات." },
        { q: "هل يمكن استخدام Feed URL بدون API؟", a: "نعم، إذا اخترت 'Feed URL' Numaxio يُنشئ رابطاً تضيفه يدوياً في X Commerce Manager. لا تحتاج API Keys في هذه الحالة." },
      ],
    },
    {
      title: "3. إنشاء الكاتالوج في X Ads Manager",
      steps: [
        {
          title: "افتح X Ads Manager",
          desc: "اذهب إلى ads.x.com → Creatives → من القائمة المنسدلة اختر 'Dynamic Product Ads'. ستجد قسم 'Catalogs'.",
        },
        {
          title: "أنشئ كاتالوجاً جديداً",
          desc: "انقر 'Create Catalog' → أدخل اسم الكاتالوج وموقعه الجغرافي → 'Create'. ستحصل على Catalog ID.",
        },
        {
          title: "أضف Data Source",
          desc: "داخل الكاتالوج → Data Source → Add Source → اختر 'URL Feed' أو 'API Upload'. إذا اخترت URL Feed الصق رابط الـ Feed من Numaxio.",
          tip: "تنسيق XML المتوافق مع Google Merchant Center هو الأكثر دعماً في X Catalog.",
        },
      ],
      faq: [
        { q: "كم منتجاً يدعم الكاتالوج؟", a: "يدعم X حتى 100,000 منتج في الكاتالوج الواحد. لمتاجر أكبر تواصل مع X Sales Team." },
        { q: "كم مرة يتحدث الكاتالوج؟", a: "مع URL Feed، X يسحب التحديثات كل 24 ساعة. مع API Push تحديثات فورية." },
      ],
    },
    {
      title: "4. التحقق من مزامنة المنتجات",
      steps: [
        {
          title: "راقب حالة الـ Sync في X Ads Manager",
          desc: "في Catalogs → اختر الكاتالوج → Data Source → ستجد Last Sync Time وعدد المنتجات المُحمَّلة بنجاح.",
        },
        {
          title: "راجع المنتجات المرفوضة",
          desc: "انقر على 'Issues' لرؤية المنتجات ذات المشاكل. الأسباب الشائعة: صور مفقودة، سعر صفر، رابط معطوب.",
        },
        {
          title: "أرسل Sync تجريبي",
          desc: "من تبويب 'اختبار الإرسال' في Numaxio، أرسل طلب Sync بوضع dry_run للتحقق من صحة البيانات قبل النشر الفعلي.",
          tip: "Dry Run يفحص تنسيق البيانات دون إرسالها لـ X — مفيد للتشخيص.",
        },
      ],
      faq: [
        { q: "المنتجات مُحمَّلة لكن الحملة لا تعمل؟", a: "تأكّد من ربط الكاتالوج بحملة Dynamic Product Ads في X Ads Manager. تأكّد من وجود X Pixel على الموقع لتحسين الاستهداف." },
      ],
    },
    {
      title: "5. متطلبات المنتجات في X Catalog",
      steps: [
        {
          title: "الحقول الإلزامية",
          desc: "id, title, description, link (رابط المنتج), image_link (رابط الصورة), price (بالعملة الصحيحة), availability (in stock / out of stock), condition (new / used / refurbished).",
          tip: "الصورة يجب أن تكون على الأقل 100×100 بكسل. يُوصى بـ 1200×1200.",
        },
        {
          title: "الحقول الاختيارية المهمة",
          desc: "brand, google_product_category, sale_price, shipping, gtin (رقم المنتج العالمي), additional_image_link للصور الإضافية.",
        },
      ],
      faq: [
        { q: "هل أحتاج GTIN لكل منتج؟", a: "ليس إلزامياً لكنه يُحسّن دقة الاستهداف ويُقلّل من رفض المنتجات. إن لم تكن لديك GTINs، تأكّد من إضافة brand بدلاً عنها." },
      ],
    },
  ],
  troubleshooting: [
    {
      problem: "401 Unauthorized عند Push API",
      cause: "API Keys أو Access Tokens غير صحيحة أو منتهية",
      solution: "تأكّد من إدخال جميع الـ 4 مفاتيح بشكل صحيح (API Key, API Secret, Access Token, Access Token Secret). تأكّد من صلاحية 'Read and Write'.",
    },
    {
      problem: "منتجات مرفوضة في الكاتالوج",
      cause: "حقول إلزامية مفقودة أو صور لا تلبي المتطلبات",
      solution: "راجع قائمة الحقول الإلزامية. تأكّد من أن الصور كبيرة بما يكفي. تأكّد من أن رابط المنتج يعمل. راجع X Ads Manager → Catalog → Issues.",
    },
    {
      problem: "Feed URL لا يتحمّل",
      cause: "الرابط غير متاح للعموم أو يحتاج مصادقة",
      solution: "تأكّد أن Feed URL يمكن الوصول إليه بدون كلمة مرور من أي متصفح. تأكّد من تنسيق XML صحيح. جرّب فتح الرابط في Incognito Mode.",
    },
    {
      problem: "لا يوجد X Ads API Access",
      cause: "الحساب لم يحصل بعد على موافقة Ads API",
      solution: "اذهب إلى developer.twitter.com → Products → X Ads API وقدّم طلب الوصول. الموافقة تستغرق يومين إلى أسبوع. استخدم Feed URL كبديل في هذه المرحلة.",
    },
  ],
  supportIssueTypes: [
    { value: "api_auth_failed", label: "فشل مصادقة X Ads API" },
    { value: "catalog_not_syncing", label: "الكاتالوج لا يتزامن" },
    { value: "products_rejected", label: "منتجات مرفوضة" },
    { value: "feed_url_issue", label: "مشكلة في Feed URL" },
    { value: "ads_api_access", label: "لا يوجد وصول لـ X Ads API" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
