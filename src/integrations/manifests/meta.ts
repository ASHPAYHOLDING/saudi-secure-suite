import type { IntegrationManifest } from "./types";

export const metaManifest: IntegrationManifest = {
  providerId: "meta",
  name: "Meta (Facebook) Pixel + Conversions API",
  nameEn: "Meta Pixel + CAPI",
  category: "marketing",
  logoPath: "/brands/marketing/meta.svg",
  color: "from-blue-600/10 to-indigo-500/5",
  description: "تتبع التحويلات على Facebook/Instagram عبر Pixel و Server-side CAPI لرفع دقة القياس وتقليل فقدان البيانات.",
  fields: [
    {
      key: "pixel_id",
      label: "Pixel ID",
      type: "text",
      placeholder: "123456789012345",
      hint: "من Meta Events Manager → Data Sources → Pixel → Settings → Pixel ID",
      required: true,
    },
    {
      key: "access_token",
      label: "Access Token (CAPI)",
      type: "password",
      placeholder: "EAAxxxxxxxxxxxxxxx",
      hint: "من Meta Events Manager → Pixel → Settings → Generate access token",
      required: true,
    },
    {
      key: "dataset_id",
      label: "Dataset ID (اختياري)",
      type: "text",
      placeholder: "اختياري — يُستخدم عند ربط Pixel بـ Dataset",
      required: false,
    },
    {
      key: "test_event_code",
      label: "Test Event Code (اختياري)",
      type: "text",
      placeholder: "TEST12345",
      hint: "رمز الاختبار من Meta Events Manager — اتركه فارغاً في الإنتاج",
      required: false,
    },
  ],
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "1. أين أجد Pixel ID",
      officialLink: "https://www.facebook.com/events_manager2",
      officialLinkLabel: "Meta Events Manager",
      steps: [
        {
          title: "افتح Meta Events Manager",
          desc: "اذهب إلى business.facebook.com → اختر حسابك الإعلاني → ثم Events Manager من القائمة الجانبية.",
          tip: "تأكّد من أن حسابك له صلاحية Admin أو Advertiser على Business Account.",
        },
        {
          title: "اختر Pixel من Data Sources",
          desc: "من القائمة اليسرى اختر Data Sources → Pixels → اختر الـ Pixel المرتبط بموقعك أو أنشئ واحداً جديداً إن لم يكن موجوداً.",
        },
        {
          title: "انسخ Pixel ID",
          desc: "ستجد الـ Pixel ID في أعلى الصفحة تحت اسم الـ Pixel مباشرةً. إنه رقم مكوّن من 15 خانة عادةً.",
          tip: "Pixel ID ليس سرياً ويمكن تضمينه في كود الموقع بأمان.",
        },
      ],
      faq: [
        {
          q: "هل يمكن استخدام Pixel موجود مسبقاً؟",
          a: "نعم. أدخل Pixel ID الموجود في الحقل المخصص. المهم أن يكون حسابك له صلاحية الوصول لهذا الـ Pixel.",
        },
        {
          q: "ما الفرق بين Pixel ID وDataset ID؟",
          a: "Pixel ID هو المعرّف الأساسي للـ Pixel. Dataset ID يُستخدم عند تفعيل Conversions API مع Dataset منفصل عن الـ Pixel مباشرةً — في أغلب الحالات Pixel ID يكفي.",
        },
      ],
    },
    {
      title: "2. كيف تنشئ Access Token للـ CAPI",
      steps: [
        {
          title: "افتح إعدادات الـ Pixel",
          desc: "في Events Manager → اختر الـ Pixel → انقر تبويب Settings من القائمة العلوية.",
        },
        {
          title: "أنشئ Access Token",
          desc: "مرّر لأسفل حتى قسم 'Conversions API' → اختر 'Generate access token'. سيُنشئ Meta توكناً خاصاً بهذا الـ Pixel.",
          tip: "الـ Token يظهر مرة واحدة فقط عند الإنشاء — انسخه فوراً واحفظه في Numaxio قبل إغلاق الصفحة.",
        },
        {
          title: "الصق الـ Token في Numaxio",
          desc: "أدخل الـ Access Token في حقل 'Access Token' في تبويب الإعداد أعلاه واحفظ.",
        },
      ],
      faq: [
        {
          q: "انتهت صلاحية الـ Access Token. ماذا أفعل؟",
          a: "احذف الـ Token القديم من Meta Events Manager وأنشئ جديداً. ثم حدّثه في Numaxio عبر زر 'استبدال المفتاح' في تبويب الإعداد.",
        },
        {
          q: "هل يمكن استخدام System User Token بدلاً من Page Token؟",
          a: "نعم، ويُوصى به في بيئة الإنتاج. أنشئ System User من Business Settings → System Users وامنحه صلاحية Advertiser على الـ Pixel.",
        },
      ],
    },
    {
      title: "3. تفعيل Test Events والتحقق من وصول الأحداث",
      steps: [
        {
          title: "افتح Test Events في Events Manager",
          desc: "في Events Manager → اختر الـ Pixel → انقر تبويب Test Events. ستجد Test Event Code في أعلى الصفحة.",
          tip: "استخدم هذا الكود فقط أثناء الاختبار. لا تُرسله في بيئة الإنتاج.",
        },
        {
          title: "أدخل Test Event Code في Numaxio",
          desc: "ضع الكود في حقل 'Test Event Code' في تبويب الإعداد وحفظ الإعدادات.",
        },
        {
          title: "أرسل حدث تجريبي",
          desc: "من تبويب 'اختبار الإرسال' في Numaxio اضغط 'إرسال اختبار Server-side'. يجب أن يظهر الحدث خلال 15-60 ثانية في صفحة Test Events.",
        },
        {
          title: "تحقق من الظهور في Events Manager",
          desc: "في صفحة Test Events ستجد الحدث مع تفاصيله: event name, match keys, timestamp. تأكّد من Event Match Quality.",
        },
      ],
      faq: [
        {
          q: "الأحداث لا تظهر في Test Events. ما المشكلة؟",
          a: "تأكّد من صحة Access Token وPixel ID. تحقق من وجود Test Event Code وأنه منسوخ بدقة من Events Manager. افحص سجلات الإرسال في تبويب السجلات.",
        },
        {
          q: "كم يستغرق ظهور الأحداث في التقارير؟",
          a: "في بيئة Test Events: 15-60 ثانية. في التقارير الإعلانية الفعلية: من 20 دقيقة إلى ساعتين حسب حجم البيانات.",
        },
      ],
    },
    {
      title: "4. الفرق بين Browser Events وServer Events",
      steps: [
        {
          title: "Browser Events (Meta Pixel في الموقع)",
          desc: "يتم إطلاقه مباشرةً من متصفح الزائر عبر كود JavaScript. يتأثر بـ Ad Blockers وإعدادات الخصوصية في المتصفح ويفقد دقته مع iOS 14.5+.",
          tip: "الـ Browser Pixel ما زال مهماً لأنه يجمع بيانات تلقائية مثل URL وUser Agent وإحداثيات الصفحة.",
        },
        {
          title: "Server Events (Conversions API)",
          desc: "يتم إطلاقه من الخادم مباشرةً إلى Meta دون المرور بالمتصفح. لا يتأثر بـ Ad Blockers وأكثر موثوقية لقياس التحويلات الحقيقية.",
        },
        {
          title: "الاستخدام معاً (Recommended)",
          desc: "إطلاق نفس الأحداث عبر Browser Pixel وServer CAPI مع event_id مشترك يُمكّن Meta من مزج البيانات وإزالة التكرار (Deduplication) تلقائياً.",
          tip: "هذا هو النهج الموصى به للحصول على أعلى دقة قياس.",
        },
      ],
      faq: [
        {
          q: "هل سيتكرر الحدث إذا أرسلته من Pixel ومن CAPI معاً؟",
          a: "لا، شرط استخدام نفس event_id في الطرفين. Meta يُطابق الـ event_id ويُزيل التكرار تلقائياً ولا يُحتسب إلا مرة واحدة.",
        },
      ],
    },
    {
      title: "5. أفضل ممارسات: Deduplication وAdvanced Matching",
      steps: [
        {
          title: "استخدم event_id ثابتاً لكل عملية",
          desc: "لكل حدث تجاري (مثل Purchase) أنشئ event_id فريداً مرتبطاً بالعملية (مثل: purchase_{orderId}). أرسله في Browser Pixel وServer CAPI.",
          tip: "Numaxio يولّد event_id تلقائياً استناداً إلى Order ID + timestamp لضمان الفرادة.",
        },
        {
          title: "فعّل Advanced Matching",
          desc: "في إعدادات التكامل فعّل 'Enable Advanced Matching'. يُرسل النظام بيانات العميل مجزّأة (SHA256 hash) لتحسين Event Match Quality وإسناد الإعلانات.",
          tip: "يُوصى بإرسال على الأقل: email أو phone. كلما زادت البيانات ارتفعت جودة المطابقة.",
        },
        {
          title: "راقب Event Match Quality في Events Manager",
          desc: "في Events Manager → Pixel → Events → Overview، تحقق من عمود Event Match Quality لكل حدث. القيمة من 6-10 ممتازة.",
        },
      ],
      faq: [
        {
          q: "هل يُؤثر Advanced Matching على خصوصية المستخدمين؟",
          a: "لا. البيانات تُرسل بعد تجزئة SHA256 ولا يمكن فك تشفيرها. Meta يستخدمها فقط لمطابقة الإعلانات داخلياً.",
        },
      ],
    },
    {
      title: "6. الانتقال للإنتاج والتحقق من جودة القياس",
      steps: [
        {
          title: "احذف Test Event Code",
          desc: "قبل الإطلاق الإنتاجي تأكّد من أن حقل Test Event Code فارغ في إعدادات Numaxio.",
        },
        {
          title: "تحقق من Event Match Quality",
          desc: "في Events Manager → Pixel → Events → اختر حدث Purchase → تفاصيل. ستجد Event Match Quality Score. استهدف 7 أو أعلى.",
          tip: "إضافة Advanced Matching ترفع المعدل عادةً بنسبة 20-40%.",
        },
        {
          title: "راقب Aggregated Event Measurement (iOS 14+)",
          desc: "في Events Manager → Settings → تحقق من Aggregated Event Measurement وتأكد من ترتيب الأحداث حسب الأولوية (Purchase أولاً).",
        },
        {
          title: "راقب الأحداث لأول 48 ساعة",
          desc: "بعد الإطلاق، راقب Events Manager يومياً. قارن عدد أحداث Server مع Browser لتقييم مدى التغطية.",
        },
      ],
      faq: [
        {
          q: "كيف أعرف أن الـ CAPI يُحسّن أداء الحملات؟",
          a: "قارن ROAS وCPA قبل وبعد تفعيل CAPI. عادةً يرفع CAPI نسبة الإسناد بـ 15-35% وهو ما يظهر في تحسن ظاهر في الأداء.",
        },
      ],
    },
  ],
  troubleshootingItems: [
    {
      problem: "Invalid Access Token / 401 Unauthorized",
      cause: "الـ Access Token منتهي الصلاحية أو تم إلغاؤه أو غير مرتبط بالـ Pixel الصحيح",
      solution: "افتح Events Manager → Pixel → Settings → احذف Token القديم وأنشئ واحداً جديداً عبر Generate access token. ثم حدّثه في Numaxio عبر 'استبدال المفتاح'.",
    },
    {
      problem: "Pixel ID غير صحيح / 400 Bad Request",
      cause: "الـ Pixel ID مكتوب خطأً أو يخص حساباً إعلانياً آخر",
      solution: "افتح Events Manager وانسخ الـ Pixel ID مباشرةً من صفحة Settings. تأكّد من أنك في Business Account الصحيح ومن أن الـ Token له صلاحية على هذا الـ Pixel.",
    },
    {
      problem: "الأحداث لا تظهر في Events Manager",
      cause: "قد يكون Test Event Code مفقوداً أو Access Token غير صحيح أو الـ Pixel غير مفعّل",
      solution: "1) تحقق من سجلات الإرسال في Numaxio للتأكد من HTTP 200. 2) إذا كانت البيئة اختبارية تأكّد من وجود Test Event Code. 3) انتظر 15-60 ثانية قبل التحقق في Events Manager.",
    },
    {
      problem: "Event Match Quality منخفض (أقل من 5)",
      cause: "بيانات العميل المُرسلة غير كافية لمطابقة مع مستخدمي Meta",
      solution: "فعّل Advanced Matching في الإعدادات وتأكّد من إرسال email أو phone. تحقق من صحة الـ hashing (SHA256 lowercase). استهدف إرسال 3 match keys على الأقل.",
    },
    {
      problem: "تكرار الأحداث (Duplicate Events)",
      cause: "إرسال نفس الحدث من Browser Pixel وServer CAPI بدون event_id مشترك",
      solution: "تأكّد من استخدام نفس event_id في كلا الإرسالين. Numaxio يولّد event_id تلقائياً من Order ID — تأكّد من تمريره لـ Browser Pixel أيضاً.",
    },
    {
      problem: "فشل إرسال الأحداث / Connection Error",
      cause: "مشكلة في الاتصال بـ Meta API أو تجاوز حدود المعدل (Rate Limit)",
      solution: "تحقق من حالة Meta API على developers.facebook.com/status. تحقق من سجلات الإرسال في Numaxio. إذا تجاوزت الـ Rate Limit انتظر دقيقة ثم أعد المحاولة.",
    },
    {
      problem: "إعدادات iOS 14 / Aggregated Events",
      cause: "قيود Apple على التتبع تحدّ من البيانات المستقبَلة من iOS devices",
      solution: "فعّل Aggregated Event Measurement في Events Manager → Settings. رتّب أحداثك حسب الأولوية (Purchase أولاً). CAPI يُعوّض جزءاً كبيراً من هذا الفقدان.",
    },
  ],
  supportIssueTypes: [
    { value: "invalid_token", label: "Access Token غير صالح" },
    { value: "pixel_not_receiving", label: "الـ Pixel لا يستقبل الأحداث" },
    { value: "low_match_quality", label: "Event Match Quality منخفض" },
    { value: "duplicate_events", label: "أحداث مكررة" },
    { value: "capi_connection_failed", label: "فشل الاتصال بـ Meta CAPI" },
    { value: "ios_attribution", label: "مشكلة إسناد iOS 14+" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
