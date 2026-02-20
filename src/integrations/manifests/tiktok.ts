import type { IntegrationManifest } from "./types";

export const tiktokManifest: IntegrationManifest = {
  providerId: "tiktok",
  name: "TikTok Conversion API",
  nameEn: "TikTok Conversion API",
  category: "marketing",
  logoPath: "/brands/marketing/tiktok.svg",
  color: "from-pink-500/10 to-cyan-400/5",
  description: "تتبع التحويلات وإرسال الأحداث إلى TikTok لرفع أداء الحملات وقياس ROAS بدقة.",
  fields: [
    {
      key: "pixel_id",
      label: "Pixel ID",
      type: "text",
      placeholder: "CXXXXXXXXXXXXXXXXXX",
      hint: "من TikTok Events Manager → لوحة التحكم → Pixel → إعدادات → Pixel ID",
      required: true,
    },
    {
      key: "access_token",
      label: "Access Token",
      type: "password",
      placeholder: "أدخل Access Token من TikTok",
      hint: "من TikTok Events Manager → Pixel → Settings → Generate Access Token",
      required: true,
    },
    {
      key: "test_event_code",
      label: "Test Event Code (اختياري)",
      type: "text",
      placeholder: "TEST12345",
      hint: "رمز الاختبار من TikTok Events Manager — اتركه فارغاً في الإنتاج",
      required: false,
    },
  ],
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "1. أين أجد Pixel ID",
      officialLink: "https://ads.tiktok.com/marketing_api/docs?id=1701890980908033",
      officialLinkLabel: "TikTok Events Manager",
      steps: [
        {
          title: "ادخل إلى TikTok Ads Manager",
          desc: "اذهب إلى ads.tiktok.com وسجّل دخولك بحساب المعلن الخاص بك.",
          tip: "تأكّد من أن الحساب له صلاحيات إدارة البكسل (Admin أو Analyst)",
        },
        {
          title: "افتح Events Manager",
          desc: "من القائمة العلوية اختر Tools → Events → Manage → ثم اختر TikTok Pixel.",
        },
        {
          title: "انسخ Pixel ID",
          desc: "ستجد الـ Pixel ID تحت اسم البكسل مباشرةً. إنه رقم يبدأ بـ C ويحتوي على 19 خانة عادةً.",
        },
      ],
      faq: [
        {
          q: "هل يمكنني استخدام أكثر من Pixel ID؟",
          a: "حالياً النظام يدعم Pixel واحد لكل حساب. إذا كان لديك أكثر من متجر يمكنك إضافة تكاملات منفصلة."
        },
        {
          q: "هل Pixel ID سري؟",
          a: "Pixel ID ليس سرياً ويمكن مشاركته. أما Access Token فهو سري ويجب عدم مشاركته."
        },
      ],
    },
    {
      title: "2. كيف أطلع Access Token",
      steps: [
        {
          title: "اذهب إلى إعدادات الـ Pixel",
          desc: "في Events Manager → اختر الـ Pixel → انقر Settings في الأعلى.",
        },
        {
          title: "أنشئ Access Token",
          desc: "مرّر للأسفل حتى قسم 'Conversions API' → انقر 'Generate Access Token'.",
          tip: "الـ Token لا يظهر مرة أخرى، احفظه فوراً في مكان آمن.",
        },
        {
          title: "أدخل الـ Token في Numaxio",
          desc: "الصق الـ Access Token في حقل 'Access Token' في تبويب الإعداد أعلاه.",
        },
      ],
      faq: [
        {
          q: "انتهت صلاحية الـ Access Token. ماذا أفعل؟",
          a: "احذف الـ Token القديم وأنشئ جديداً من Events Manager. ثم حدّثه في Numaxio عبر زر 'استبدال المفتاح'."
        },
      ],
    },
    {
      title: "3. تفعيل Test Event Code",
      steps: [
        {
          title: "افتح Test Events في TikTok",
          desc: "في Events Manager → Pixel → Test Events → ستجد Test Event Code يبدأ بـ TEST.",
          tip: "استخدم هذا الكود أثناء الاختبار فقط — لا تستخدمه في الإنتاج.",
        },
        {
          title: "أدخل الكود في Numaxio",
          desc: "ضع الكود في حقل 'Test Event Code' في تبويب الإعداد. سيُرفق تلقائياً مع كل حدث.",
        },
        {
          title: "أرسل حدث تجريبي",
          desc: "من تبويب 'اختبار الإرسال' انقر 'إرسال حدث تجريبي' وراقب ظهوره في TikTok Test Events.",
        },
      ],
      faq: [
        {
          q: "الأحداث لا تظهر في Test Events. ما المشكلة؟",
          a: "تأكّد من صحة Test Event Code وأن Access Token لا يزال صالحاً. راجع سجلات الإرسال في تبويب 'اختبار الإرسال'."
        },
      ],
    },
    {
      title: "4. التحقق من وصول الأحداث داخل TikTok Events Manager",
      steps: [
        {
          title: "افتح قسم Events Overview",
          desc: "في Events Manager → اختر الـ Pixel → Events → Overview. ستجد قائمة بآخر الأحداث المستلمة.",
        },
        {
          title: "تحقق من Match Rate",
          desc: "اضغط على اسم الحدث لترى تفاصيله. Match Rate يُعبّر عن جودة مطابقة بيانات العميل.",
          tip: "Match Rate أعلى من 70% ممتاز. حسّنه عبر Advanced Matching.",
        },
        {
          title: "فعّل Advanced Matching",
          desc: "في إعدادات التكامل فعّل 'Enable Advanced Matching'. سيُرسل النظام بيانات مجزّأة للمساعدة في رفع معدل المطابقة.",
        },
      ],
      faq: [
        {
          q: "ما هو Advanced Matching؟",
          a: "هو إرسال بيانات مُجزّأة (مثل هاش الإيميل أو الهاتف) لمساعدة TikTok على مطابقة الحدث بمستخدم حقيقي ورفع دقة الإسناد."
        },
        {
          q: "كم يستغرق ظهور الأحداث في TikTok؟",
          a: "عادةً من 5 إلى 15 دقيقة في بيئة الاختبار. في الإنتاج قد تصل إلى ساعة للظهور في التقارير."
        },
      ],
    },
    {
      title: "5. الانتقال للإنتاج",
      steps: [
        {
          title: "احذف Test Event Code",
          desc: "في إعدادات التكامل في Numaxio، احذف قيمة Test Event Code أو اتركها فارغة.",
        },
        {
          title: "تأكّد من استخدام بيانات حقيقية",
          desc: "تأكّد أن Pixel ID وAccess Token هما للحساب الفعلي وليس بيئة الاختبار.",
        },
        {
          title: "راقب الأحداث لـ 24 ساعة",
          desc: "بعد الإطلاق، راقب Events Manager للتحقق من استمرار وصول الأحداث بشكل صحيح.",
          tip: "ضبط قواعد الإسناد في TikTok Ads Manager يُحسّن دقة قياس ROAS.",
        },
      ],
      faq: [
        {
          q: "هل Conversion API يستبدل TikTok Pixel في الموقع؟",
          a: "لا. يُوصى باستخدام الاثنين معاً لتحقيق أفضل تغطية. Conversion API يُعوّض عن فقدان بيانات Browser Pixel بسبب Ad Blockers."
        },
      ],
    },
  ],
  troubleshootingItems: [
    {
      problem: "Invalid Pixel ID",
      cause: "الـ Pixel ID غير صحيح أو لا يتبع حساب المعلن الحالي",
      solution: "تحقق من Pixel ID في TikTok Events Manager. يجب أن يبدأ بـ C ويحتوي على 19 خانة. تأكّد من أنك في الحساب الإعلاني الصحيح.",
    },
    {
      problem: "Unauthorized / 401",
      cause: "Access Token منتهي الصلاحية أو غير صحيح",
      solution: "أنشئ Access Token جديداً من Events Manager → Pixel → Settings → Generate Access Token. ثم حدّثه في Numaxio.",
    },
    {
      problem: "الأحداث لا تظهر في TikTok",
      cause: "قد يكون الـ Pixel غير مفعّل أو Test Event Code مخالف",
      solution: "تأكّد من أن الـ Pixel نشط في Events Manager. إذا كنت في بيئة الاختبار تأكّد من Test Event Code. انتظر 15 دقيقة وأعد المحاولة.",
    },
    {
      problem: "Deduplication Error",
      cause: "تم إرسال نفس الحدث أكثر من مرة بنفس Event ID",
      solution: "تأكّد من أن كل طلب يحمل event_id فريداً. النظام يستخدم Order ID + timestamp لتوليد event_id تلقائياً.",
    },
    {
      problem: "Match Rate منخفض جداً",
      cause: "بيانات العميل غير كافية للمطابقة مع مستخدمي TikTok",
      solution: "فعّل 'Advanced Matching' في إعدادات التكامل. يُساعد إرسال الإيميل والهاتف (مجزّأة) على رفع معدل المطابقة.",
    },
    {
      problem: "Connection timeout",
      cause: "TikTok API لم يستجب في الوقت المحدد",
      solution: "تحقق من حالة TikTok API على status.tiktok.com. تُعاد المحاولة تلقائياً. إذا استمرت المشكلة راسل الدعم.",
    },
  ],
  supportIssueTypes: [
    { value: "pixel_not_firing", label: "الـ Pixel لا يُطلق الأحداث" },
    { value: "invalid_token", label: "Access Token غير صالح" },
    { value: "events_not_showing", label: "الأحداث لا تظهر في TikTok" },
    { value: "low_match_rate", label: "Match Rate منخفض" },
    { value: "connection_failed", label: "فشل الاتصال" },
    { value: "deduplication_issue", label: "مشكلة في التكرار" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
