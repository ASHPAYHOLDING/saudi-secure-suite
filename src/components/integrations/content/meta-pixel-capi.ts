/**
 * content/meta-pixel-capi.ts — محتوى تكامل Meta Pixel + Conversions API
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const metaPixelCapiContent: MarketingProviderContent = {
  providerId: "meta_pixel_capi",
  name: "Meta Pixel + Conversions API",
  nameEn: "Meta (Facebook) Pixel + CAPI",
  logoPath: "/brands/marketing/meta.svg",
  color: "from-blue-500/10 to-blue-400/5",
  description: "تتبع التحويلات على Facebook/Instagram عبر Pixel و Server-side CAPI لرفع دقة القياس وتقليل فقدان البيانات.",
  badges: [
    { label: "عالمي", icon: "🌍" },
    { label: "Marketing", icon: "📣" },
    { label: "Server-side CAPI", icon: "🔒" },
  ],
  fields: [
    {
      key: "pixel_id",
      label: "Pixel ID",
      type: "text",
      placeholder: "123456789012345",
      hint: "من Meta Events Manager → الـ Pixel → الإعدادات → Pixel ID",
      required: true,
      section: "config",
    },
    {
      key: "enable_browser_events",
      label: "تفعيل Browser Pixel Events",
      type: "toggle",
      hint: "إرسال أحداث من المتصفح مباشرةً (مكمّل للـ CAPI)",
      section: "config",
    },
    {
      key: "enable_server_events",
      label: "تفعيل Server-side CAPI",
      type: "toggle",
      hint: "إرسال أحداث من السيرفر — يتجاوز Ad Blockers",
      section: "config",
    },
    {
      key: "advanced_matching",
      label: "Advanced Matching",
      type: "toggle",
      hint: "إرسال بيانات مُجزّأة (هاش الإيميل/الهاتف) لرفع دقة الإسناد",
      section: "config",
    },
    {
      key: "deduplication_enabled",
      label: "تفعيل Deduplication",
      type: "toggle",
      hint: "منع تكرار حسبان نفس الحدث مرتين (Browser + Server) عبر event_id موحّد",
      section: "config",
    },
    {
      key: "access_token",
      label: "Access Token (CAPI)",
      type: "password",
      placeholder: "أدخل Access Token من Meta Events Manager",
      hint: "من Events Manager → Data Sources → Pixel → Settings → Generate Access Token",
      required: true,
      section: "secrets",
    },
    {
      key: "test_event_code",
      label: "Test Event Code (اختياري)",
      type: "text",
      placeholder: "TEST12345",
      hint: "من Events Manager → Test Events. اتركه فارغاً في الإنتاج.",
      section: "secrets",
    },
  ],
  events: [
    {
      name: "PageView",
      label: "عرض الصفحة",
      desc: "يُطلق تلقائياً عند تحميل أي صفحة. الأساس لقياس حركة المرور.",
      snippet: `// PageView event\nfetch('/api/marketing-event', {\n  method: 'POST',\n  body: JSON.stringify({\n    provider: 'meta_pixel_capi',\n    event_name: 'PageView',\n    payload: { currency: 'SAR' }\n  })\n});`,
    },
    {
      name: "ViewContent",
      label: "عرض المنتج",
      desc: "يُطلق عند مشاهدة صفحة منتج. يُستخدم لبناء جماهير Dynamic Product Ads.",
      snippet: `// ViewContent event\npayload: { content_ids: ['SKU-123'], value: 250, currency: 'SAR' }`,
    },
    {
      name: "AddToCart",
      label: "إضافة للسلة",
      desc: "يُطلق عند إضافة منتج لسلة التسوق. أساس حملات استعادة السلل المهجورة.",
      snippet: `// AddToCart event\npayload: { content_ids: ['SKU-123'], value: 250, currency: 'SAR' }`,
    },
    {
      name: "InitiateCheckout",
      label: "بدء الدفع",
      desc: "يُطلق عند بدء إجراءات الدفع. مؤشر عالي النية للشراء.",
      snippet: `// InitiateCheckout event\npayload: { value: 450, currency: 'SAR', num_items: 2 }`,
    },
    {
      name: "Purchase",
      label: "عملية شراء",
      desc: "الأهم — يُطلق عند إتمام الطلب بنجاح. أساس قياس ROAS وتحسين الحملات.",
      snippet: `// Purchase event\npayload: {\n  value: 499,\n  currency: 'SAR',\n  order_id: 'ORD-2024-001'\n}`,
    },
    {
      name: "Lead",
      label: "عميل محتمل",
      desc: "يُطلق عند تعبئة نموذج تواصل أو طلب عرض سعر.",
    },
    {
      name: "CompleteRegistration",
      label: "إتمام التسجيل",
      desc: "يُطلق عند إنشاء حساب جديد أو إتمام تسجيل ناجح.",
    },
    {
      name: "Search",
      label: "بحث",
      desc: "يُطلق عند استخدام خاصية البحث في المتجر.",
    },
  ],
  testEventName: "Purchase",
  testPayload: { value: 100, currency: "SAR", order_id: `TEST-${Date.now()}`, content_type: "product" },
  docSections: [
    {
      title: "1. أين أجد Pixel ID",
      steps: [
        {
          title: "ادخل إلى Meta Business Manager",
          desc: "اذهب إلى business.facebook.com وسجّل دخولك بحساب الأعمال الخاص بك.",
          tip: "تأكّد من أن الحساب له صلاحية إدارة البكسل (Admin أو Advertiser)",
        },
        {
          title: "افتح Events Manager",
          desc: "من القائمة اليسرى → All Tools → Events Manager → Data Sources. اختر الـ Pixel الخاص بك.",
        },
        {
          title: "انسخ Pixel ID",
          desc: "ستجد الـ Pixel ID أسفل اسم البكسل مباشرةً. هو رقم من 15 إلى 16 خانة.",
        },
      ],
      faq: [
        { q: "هل Pixel ID سري؟", a: "لا — Pixel ID ليس سرياً ويظهر في كود الموقع. أما Access Token فهو سري تماماً." },
        { q: "هل يمكن استخدام Pixel واحد لأكثر من نطاق؟", a: "نعم، يمكن إضافة نطاقات متعددة في إعدادات الـ Pixel داخل Events Manager." },
      ],
    },
    {
      title: "2. كيف أنشئ Access Token للـ CAPI",
      steps: [
        {
          title: "اذهب إلى إعدادات الـ Pixel",
          desc: "في Events Manager → Data Sources → اختر الـ Pixel → Settings.",
        },
        {
          title: "أنشئ Access Token",
          desc: "في قسم 'Conversions API' → 'Generate Access Token'. انسخه فوراً — لن يظهر مرة أخرى.",
          tip: "احفظ الـ Token في مكان آمن. لا تشاركه مع أحد ولا تضعه في الكود مباشرةً.",
        },
        {
          title: "أدخله في Numaxio",
          desc: "الصق الـ Access Token في حقل 'Access Token (CAPI)' أعلاه وانقر حفظ.",
        },
      ],
      faq: [
        { q: "انتهت صلاحية Token. ماذا أفعل؟", a: "أنشئ Token جديداً من Events Manager وأدخله في حقل 'Access Token' مجدداً. النظام سيُشفّره فوراً." },
        { q: "ما الفرق بين Access Token والـ App Secret؟", a: "Access Token هو المفتاح المستخدم مع CAPI. App Secret يُستخدم مع بعض طرق التحقق القديمة. نحن نستخدم Access Token فقط." },
      ],
    },
    {
      title: "3. الفرق بين Browser Events و Server Events",
      steps: [
        {
          title: "Browser Events (Pixel)",
          desc: "تُرسل مباشرةً من متصفح العميل عبر JavaScript. سريعة وسهلة لكن تتأثر بـ Ad Blockers وITP في Safari.",
        },
        {
          title: "Server Events (CAPI)",
          desc: "تُرسل من سيرفر Numaxio مباشرةً إلى Meta API. لا تتأثر بـ Ad Blockers ولا بـ iOS restrictions.",
          tip: "الجمع بين الاثنين مع Deduplication هو أفضل ممارسة.",
        },
        {
          title: "Deduplication بـ event_id",
          desc: "فعّل 'تفعيل Deduplication' لاستخدام event_id موحّد في Browser + Server. يمنع Meta من حسبان نفس الحدث مرتين.",
        },
      ],
      faq: [
        { q: "هل يمكن استخدام CAPI بدون Pixel في المتصفح؟", a: "نعم، لكن الجمع بينهما يعطي أفضل نتائج وتغطية. CAPI وحده كافٍ إذا كان لديك قيود تقنية على Pixel." },
      ],
    },
    {
      title: "4. تفعيل Test Events والتحقق من الوصول",
      steps: [
        {
          title: "احصل على Test Event Code",
          desc: "في Events Manager → اختر الـ Pixel → Test Events. ستجد Test Event Code يبدأ بـ TEST.",
          tip: "استخدم هذا الكود في بيئة الاختبار فقط — لا تُفعّله في الإنتاج.",
        },
        {
          title: "أرسل حدث تجريبي",
          desc: "من تبويب 'اختبار الإرسال' انقر 'إرسال حدث تجريبي' وراقب ظهوره في Test Events خلال دقائق.",
        },
        {
          title: "انتقل للإنتاج",
          desc: "احذف Test Event Code من الإعدادات واحفظ. سيبدأ النظام إرسال الأحداث للإنتاج مباشرةً.",
        },
      ],
      faq: [
        { q: "الأحداث لا تظهر في Test Events", a: "تأكّد من صحة Test Event Code وأن Access Token لا يزال صالحاً. انتظر 5-10 دقائق. تحقق من سجلات الإرسال." },
        { q: "كم تستغرق الأحداث في الإنتاج للظهور؟", a: "من 30 دقيقة إلى ساعتين للظهور في التقارير. في Events Manager تظهر خلال دقائق." },
      ],
    },
    {
      title: "5. أفضل ممارسات CAPI",
      steps: [
        {
          title: "Advanced Matching",
          desc: "فعّل Advanced Matching لإرسال هاش الإيميل والهاتف. يرفع Match Rate ويحسّن دقة الإسناد بشكل كبير.",
          tip: "Meta تهاش البيانات من طرفها أيضاً — الإرسال المزدوج آمن ومتوافق مع GDPR.",
        },
        {
          title: "event_id فريد لكل حدث",
          desc: "النظام يولّد event_id تلقائياً لكل حدث. إذا كنت تُرسل Browser Pixel أيضاً، استخدم نفس event_id لتفعيل Deduplication.",
        },
        {
          title: "مراقبة Event Match Quality",
          desc: "في Events Manager → راقب 'Event Match Quality Score'. اهدف لـ 6+ من 10 للحصول على أفضل نتائج للحملات.",
        },
      ],
      faq: [
        { q: "ما هو Event Match Quality؟", a: "هو مؤشر من Meta يقيس جودة مطابقة بيانات العميل المُرسلة مع حسابات Facebook. كلما ارتفع كلما تحسّن الإسناد وأداء الحملات." },
      ],
    },
  ],
  troubleshooting: [
    { problem: "Invalid access token", cause: "Access Token منتهي الصلاحية أو تم إلغاؤه", solution: "أنشئ Access Token جديداً من Events Manager → Pixel → Settings → Generate Access Token. أدخله في Numaxio مجدداً." },
    { problem: "Pixel not found / Invalid pixel ID", cause: "Pixel ID غير صحيح أو لا ينتمي لحساب المعلن", solution: "تأكّد من Pixel ID في Events Manager. يجب أن يكون رقماً من 15-16 خانة. تأكّد أنك في Business Manager الصحيح." },
    { problem: "Events not appearing in Meta", cause: "قد يكون Test Event Code مختلف أو التكامل غير نشط", solution: "تأكّد من أن حالة التكامل 'نشط'. إذا كنت في الاختبار، تأكّد من Test Event Code. انتظر 10-15 دقيقة وأعد التحقق." },
    { problem: "Low Event Match Quality", cause: "بيانات عميل غير كافية للمطابقة مع مستخدمي Facebook", solution: "فعّل Advanced Matching لإرسال هاش الإيميل والهاتف. كلما أرسلت بيانات أكثر (بشكل مُجزّأ) كلما ارتفع Match Rate." },
    { problem: "Duplicate events counted", cause: "إرسال نفس الحدث من Browser + Server بدون Deduplication", solution: "فعّل 'تفعيل Deduplication' في إعدادات التكامل. تأكّد من استخدام نفس event_id في Browser Pixel وفي CAPI." },
  ],
  supportIssueTypes: [
    { value: "pixel_not_firing", label: "الـ Pixel لا يُطلق الأحداث" },
    { value: "invalid_token", label: "Access Token غير صالح" },
    { value: "events_not_showing", label: "الأحداث لا تظهر في Meta" },
    { value: "low_match_quality", label: "Event Match Quality منخفض" },
    { value: "deduplication_issue", label: "مشكلة في Deduplication" },
    { value: "capi_setup", label: "مشكلة في إعداد CAPI" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
