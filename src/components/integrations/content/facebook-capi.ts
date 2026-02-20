/**
 * content/facebook-capi.ts — محتوى تكامل Facebook Conversions API (CAPI فقط)
 * بدون Browser Pixel — Server-side فقط
 */
import type { MarketingProviderContent } from "../MarketingIntegrationPage";

export const facebookCapiContent: MarketingProviderContent = {
  providerId: "facebook_capi",
  name: "Facebook Conversions API (CAPI)",
  nameEn: "Facebook CAPI (Server-side only)",
  logoPath: "/brands/marketing/facebook.svg",
  color: "from-blue-600/10 to-blue-400/5",
  description: "أرسل أحداث التحويل مباشرةً من سيرفر Numaxio إلى Facebook بدون الحاجة لـ Pixel في المتصفح — تجاوز كامل لـ Ad Blockers وقيود iOS.",
  badges: [
    { label: "عالمي", icon: "🌍" },
    { label: "Marketing", icon: "📣" },
    { label: "Server-side فقط", icon: "🔒" },
  ],
  fields: [
    {
      key: "dataset_id",
      label: "Dataset ID (Pixel ID)",
      type: "text",
      placeholder: "123456789012345",
      hint: "من Meta Events Manager → Data Sources → اختر الـ Pixel → Settings → Dataset ID (نفس Pixel ID)",
      section: "config",
    },
    {
      key: "deduplication_enabled",
      label: "تفعيل Deduplication",
      type: "toggle",
      hint: "منع تكرار الأحداث إذا كنت تستخدم Browser Pixel بالتوازي. يستخدم event_id موحد.",
      section: "config",
    },
    {
      key: "access_token",
      label: "Access Token",
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
      name: "Purchase",
      label: "عملية شراء",
      desc: "أهم حدث — يُرسل عند إتمام الطلب. أساس قياس ROAS وتحسين الحملات.",
      snippet: `// Facebook CAPI — Purchase (Server-side)
// يُرسل تلقائياً من Numaxio بعد تأكيد الطلب
{
  "event_name": "Purchase",
  "event_time": 1700000000,
  "event_id": "ORD-2024-001",
  "action_source": "website",
  "custom_data": {
    "value": 499,
    "currency": "SAR",
    "order_id": "ORD-2024-001"
  }
}`,
    },
    {
      name: "Lead",
      label: "عميل محتمل",
      desc: "يُرسل عند تعبئة نموذج تواصل أو طلب عرض سعر من موقعك.",
    },
    {
      name: "CompleteRegistration",
      label: "إتمام التسجيل",
      desc: "يُرسل عند إنشاء حساب جديد بنجاح.",
    },
    {
      name: "InitiateCheckout",
      label: "بدء الدفع",
      desc: "يُرسل عند بدء إجراءات الدفع — مؤشر عالي النية.",
    },
    {
      name: "Subscribe",
      label: "اشتراك",
      desc: "يُرسل عند الاشتراك في خطة أو باقة. مهم للخدمات المتكررة.",
    },
  ],
  testEventName: "Purchase",
  testPayload: { value: 100, currency: "SAR", order_id: `TEST-CAPI-${Date.now()}`, action_source: "website" },
  docSections: [
    {
      title: "1. الفرق بين CAPI وحده ومع Pixel",
      steps: [
        {
          title: "متى تختار CAPI فقط؟",
          desc: "إذا لم تتمكن من تثبيت Browser Pixel في موقعك، أو إذا كان تطبيقك يعمل بدون JavaScript، أو تريد أقصى مستوى خصوصية للمستخدمين — CAPI فقط هو الخيار الأمثل.",
          tip: "CAPI وحده يُعطي نتائج ممتازة خاصةً للتجارة الإلكترونية وأحداث الطلبات.",
        },
        {
          title: "ميزة تجاوز Ad Blockers",
          desc: "Browser Pixel يُحجبه Ad Blockers ويتأثر بـ ITP في Safari/Firefox. CAPI يرسل مباشرةً من سيرفر Numaxio إلى Meta — لا يمكن حجبه.",
        },
        {
          title: "Action Source = website",
          desc: "عند إرسال أحداث CAPI، يتم تحديد action_source تلقائياً كـ 'website' لإعلام Meta بأن الحدث جاء من موقعك.",
        },
      ],
      faq: [
        { q: "هل أحتاج أن يكون لديّ Pixel مُثبَّت؟", a: "لا. هذا التكامل يعمل بشكل مستقل تماماً بدون Browser Pixel. Pixel ID (Dataset ID) مطلوب فقط لتحديد وجهة الإرسال في Meta." },
        { q: "هل CAPI فقط كافٍ لحملات Dynamic Ads؟", a: "نعم، شرط أن ترسل بيانات المستخدم الكافية (هاش الإيميل/الهاتف) لتحقيق Match Rate جيد." },
      ],
    },
    {
      title: "2. الحصول على Access Token",
      steps: [
        {
          title: "ادخل إلى Meta Events Manager",
          desc: "اذهب إلى business.facebook.com → Events Manager → Data Sources → اختر الـ Pixel (Dataset).",
        },
        {
          title: "أنشئ Access Token مخصص للـ CAPI",
          desc: "من Settings → Conversions API → 'Generate Access Token'. انسخه فوراً — لن يظهر مجدداً.",
          tip: "أنشئ Token منفصلاً لكل تطبيق أو خادم يرسل إلى هذا الـ Pixel. يسهّل الإدارة والإلغاء.",
        },
        {
          title: "أدخله في Numaxio",
          desc: "الصق الـ Token في حقل 'Access Token' أعلاه. سيُشفَّر فوراً بـ AES-256-GCM.",
        },
      ],
      faq: [
        { q: "ما نوع الصلاحيات التي يحتاجها Token؟", a: "Token يولَّد من Events Manager لا يحتاج صلاحيات إضافية — مصمم خصيصاً لإرسال الأحداث فقط." },
        { q: "Token انتهت صلاحيته. ماذا أفعل؟", a: "أنشئ Token جديداً من Events Manager وادخله في إعدادات التكامل. الـ Tokens من CAPI لا تنتهي في الغالب لكن يمكن إلغاؤها يدوياً." },
      ],
    },
    {
      title: "3. User Data Matching وتحسين Match Rate",
      steps: [
        {
          title: "ما هو User Data؟",
          desc: "Numaxio يرسل بيانات مُجزّأة (SHA-256) مع كل حدث: الإيميل، الهاتف، الاسم، العنوان. يستخدمها Meta لمطابقة الحدث مع مستخدمي Facebook.",
          tip: "البيانات تُجزَّأ قبل الإرسال — Meta لا تستطيع عكس الهاش. متوافق مع GDPR وسياسات Meta.",
        },
        {
          title: "رفع Event Match Quality",
          desc: "كلما أرسلت بيانات أكثر (إيميل + هاتف + اسم + رمز بريدي) كلما ارتفع Event Match Quality Score (EMQ). استهدف 7+ من 10.",
        },
        {
          title: "event_id للـ Deduplication",
          desc: "فعّل Deduplication إذا كنت تستخدم Browser Pixel بالتوازي. Numaxio يرسل نفس event_id الذي يستخدمه الـ Pixel لمنع التكرار.",
        },
      ],
      faq: [
        { q: "هل يمكنني إرسال رقم الهاتف بدون هاش؟", a: "لا — Numaxio يُجزِّئ جميع بيانات المستخدم تلقائياً قبل الإرسال. Meta تقبل الهاش فقط وتُحوّله من طرفها أيضاً." },
        { q: "ما هي بيانات المستخدم المدعومة؟", a: "الإيميل، رقم الهاتف، الاسم الأول والأخير، المدينة، الدولة، الرمز البريدي، الجنس، تاريخ الميلاد." },
      ],
    },
    {
      title: "4. اختبار CAPI والتحقق من وصول الأحداث",
      steps: [
        {
          title: "احصل على Test Event Code",
          desc: "من Events Manager → اختر الـ Dataset → Test Events → ستجد Test Event Code مثل TEST12345.",
          tip: "استخدم Test Event Code فقط في بيئة الاختبار. احذفه من الإعدادات قبل الإنتاج.",
        },
        {
          title: "أرسل حدث تجريبي",
          desc: "من تبويب 'اختبار الإرسال' في Numaxio، أرسل حدث Purchase تجريبي. يظهر في Events Manager → Test Events خلال دقائق.",
        },
        {
          title: "راجع الاستجابة في السجلات",
          desc: "في تبويب 'السجلات' ستجد HTTP status code. 200 = نجاح. إذا ظهر خطأ، راجع Response Body للتفاصيل.",
        },
      ],
      faq: [
        { q: "الحدث ظهر في Test Events لكن لا يظهر في التقارير العادية", a: "هذا طبيعي — Test Events معزولة عن البيانات الحقيقية. في الإنتاج (بدون Test Event Code) ستظهر الأحداث في التقارير خلال 30-60 دقيقة." },
      ],
    },
  ],
  troubleshooting: [
    {
      problem: "400 Bad Request — Invalid parameter",
      cause: "بيانات الحدث غير مكتملة أو Dataset ID خاطئ",
      solution: "تأكّد من Dataset ID (نفس Pixel ID). تأكّد أن event_time لا يتجاوز 7 أيام في الماضي. راجع Response Body في السجلات للتفاصيل.",
    },
    {
      problem: "401 Unauthorized — Invalid Token",
      cause: "Access Token تم إلغاؤه أو منتهي",
      solution: "أنشئ Access Token جديداً من Events Manager → Pixel → Settings → Generate Access Token. أدخله في Numaxio واحفظ.",
    },
    {
      problem: "منخفض Event Match Quality",
      cause: "بيانات المستخدم غير كافية للمطابقة",
      solution: "تأكّد أن Numaxio يرسل إيميل وهاتف العميل مع كل حدث. كلما زادت البيانات المجزّأة كلما ارتفع EMQ Score.",
    },
    {
      problem: "أحداث مكررة في التقارير",
      cause: "إرسال من CAPI وBrowser Pixel بدون Deduplication",
      solution: "فعّل 'Deduplication' في إعدادات التكامل. تأكّد أن Browser Pixel يستخدم نفس event_id.",
    },
  ],
  supportIssueTypes: [
    { value: "invalid_token", label: "Access Token غير صالح" },
    { value: "events_not_appearing", label: "الأحداث لا تظهر في Meta" },
    { value: "low_match_quality", label: "Event Match Quality منخفض" },
    { value: "deduplication_issue", label: "مشكلة في Deduplication" },
    { value: "bad_request_error", label: "خطأ 400 Bad Request" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
