import type { IntegrationManifest } from "./types";

/**
 * Emkan — إمكان
 * حل تقسيط BNPL سعودي للتجار
 * https://merchants.emkanfinance.com.sa/developer-tools
 */
export const emkanManifest: IntegrationManifest = {
  providerId: "emkan",
  name: "إمكان — تقسيط BNPL",
  nameEn: "Emkan Finance (BNPL)",
  description: "تقسيط فوري للعملاء داخل الدفع — تقليل التراجع وزيادة التحويل.",
  category: "bnpl",
  logoPath: "/brands/bnpl/emkan.svg",
  color: "from-teal-600/10 to-teal-500/5",
  fields: [
    {
      key: "environment",
      label: "البيئة",
      type: "text",
      placeholder: "sandbox | production",
      hint: "sandbox للاختبار، production للبيئة الحقيقية",
      required: true,
    },
    {
      key: "merchant_id",
      label: "Merchant ID / Partner ID",
      type: "text",
      placeholder: "معرّف التاجر من إمكان",
      hint: "تجده في لوحة تحكم إمكان → Developer Tools",
      required: true,
    },
    {
      key: "client_id",
      label: "Client ID",
      type: "text",
      placeholder: "client_xxxxxxxxxxxx",
      hint: "معرّف التطبيق من إمكان Developer Portal",
      required: true,
    },
    {
      key: "client_secret",
      label: "Client Secret",
      type: "password",
      placeholder: "••••••••••••••••",
      hint: "لا تشاركه أبداً — يُخزَّن مشفّراً AES-256-GCM",
      required: true,
    },
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "••••••••••••••••",
      hint: "مفتاح API إضافي إن كان مطلوباً من إمكان",
      required: false,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "••••••••••••••••",
      hint: "لتحقق توقيع Webhook من إمكان",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/emkan-webhook",
  supportsConnectionTest: false,
  docsSections: [
    {
      title: "دليل ربط إمكان — خطوة بخطوة",
      officialLink: "https://merchants.emkanfinance.com.sa/developer-tools",
      officialLinkLabel: "Developer Tools — إمكان",
      steps: [
        {
          title: "إنشاء حساب تاجر في إمكان",
          desc: "توجّه إلى merchants.emkanfinance.com.sa وسجّل حسابك التجاري. ستحتاج إلى السجل التجاري ووثائق الهوية.",
          tip: "إمكان يخدم التجار السعوديين حصراً — تأكّد من توافر متطلبات التسجيل",
        },
        {
          title: "الوصول إلى Developer Tools",
          desc: "بعد الموافقة على حسابك، ادخل لوحة التحكم واذهب إلى قسم Developer Tools للحصول على بيانات الاعتماد.",
        },
        {
          title: "استخراج مفاتيح الـ API",
          desc: "من Developer Tools، انسخ: Merchant ID، Client ID، Client Secret. احتفظ بها في مكان آمن.",
          tip: "لا تشارك Client Secret مع أي طرف — يُخزَّن مشفّراً داخل النظام فقط",
        },
        {
          title: "ضبط البيئة (sandbox / production)",
          desc: "ابدأ دائماً بـ sandbox لاختبار تدفق الطلبات كاملاً قبل الانتقال لبيئة الإنتاج.",
        },
        {
          title: "إدخال البيانات في نظام نمكسيو",
          desc: "في تبويب الإعداد أعلاه، أدخل جميع البيانات المطلوبة ثم اضغط «حفظ الإعدادات». تُشفَّر جميع الأسرار تلقائياً.",
        },
        {
          title: "ربط Redirect / Callback / Webhook",
          desc: "انسخ رابط Webhook الظاهر في تبويب الإعداد وأضفه في لوحة إمكان تحت إعدادات Webhook.",
          tip: "تأكّد أن الرابط متاح للعموم (HTTPS) وأن إمكان يمكنه الوصول إليه",
        },
        {
          title: "اختبار عملية تقسيط تجريبية",
          desc: "في بيئة sandbox، نفّذ عملية تقسيط تجريبية للتحقق من تدفق الطلب، الموافقة، والـ Webhook.",
        },
        {
          title: "الانتقال للإنتاج",
          desc: "بعد اختبار ناجح في sandbox، غيّر البيئة إلى production وأعد إدخال مفاتيح الإنتاج من إمكان.",
          tip: "⚠️ قد تتطلب بوابة إمكان تفعيلاً واعتماداً من طرفهم قبل تشغيل بيئة الإنتاج — تواصل مع فريق إمكان",
        },
      ],
      faq: [
        {
          q: "ما هي منتجات التقسيط التي تقدمها إمكان؟",
          a: "إمكان تقدم حلول تقسيط متعددة للعملاء السعوديين داخل صفحة الدفع، مما يتيح للعميل تقسيط المبلغ على أشهر بدون فوائد أو بفوائد محددة حسب المنتج.",
        },
        {
          q: "ما الحد الأدنى والأقصى لمبلغ الطلب؟",
          a: "يختلف الحد حسب اتفاقية التاجر مع إمكان. تواصل مع فريق إمكان للحصول على تفاصيل حدود المبالغ الخاصة بحسابك.",
        },
        {
          q: "متى يصل المبلغ للتاجر؟",
          a: "يستلم التاجر المبلغ من إمكان وفق جدول الدفع المتفق عليه. إمكان تتحمل مخاطر الائتمان ومتابعة أقساط العملاء.",
        },
        {
          q: "هل يمكن الاسترداد لطلبات إمكان؟",
          a: "نعم، يمكن الاسترداد الكامل أو الجزئي. يتم إشعار إمكان عبر API وإمكان تعدّل جدول أقساط العميل.",
        },
        {
          q: "هل بيئة sandbox حقيقية؟",
          a: "نعم، sandbox إمكان بيئة اختبار كاملة تحاكي سلوك الإنتاج دون معالجة مالية حقيقية.",
        },
        {
          q: "لماذا لم يتم الاتصال بعد الحفظ؟",
          a: "تأكّد أن البيانات المدخلة صحيحة ومن بيئة الإنتاج إن كنت تعمل بها. تواصل مع إمكان للتحقق من تفعيل الحساب.",
        },
      ],
    },
  ],
  troubleshootingItems: [
    {
      problem: "Invalid credentials / بيانات خاطئة",
      cause: "Merchant ID أو Client ID أو Client Secret غير صحيح، أو تم إدخال مفاتيح sandbox في بيئة production أو العكس.",
      solution: "تحقّق من بيانات الاعتماد في لوحة إمكان → Developer Tools. تأكّد من تطابق البيئة (sandbox/production).",
    },
    {
      problem: "Unauthorized / 401",
      cause: "انتهت صلاحية الـ Token، أو الحساب غير مفعّل، أو لا يملك الصلاحيات الكافية.",
      solution: "تواصل مع فريق إمكان للتحقق من تفعيل حسابك وصلاحيات API. حاول إعادة توليد المفاتيح.",
    },
    {
      problem: "Signature mismatch — توقيع Webhook غير متطابق",
      cause: "Webhook Secret المُدخَل لا يتطابق مع ما تُرسله إمكان في رأس الطلب.",
      solution: "انسخ Webhook Secret من لوحة إمكان مجدداً وأدخله في حقل Webhook Secret في الإعداد.",
    },
    {
      problem: "Callback not received — لم يصل إشعار الدفع",
      cause: "رابط Webhook غير صحيح أو غير متاح من إمكان، أو الخادم لا يستجيب.",
      solution: "تأكّد من نسخ Webhook URL الصحيح من تبويب الإعداد وإضافته في لوحة إمكان. تحقّق من عدم حجب الرابط.",
    },
    {
      problem: "Customer not eligible — العميل غير مؤهل",
      cause: "العميل لا يستوفي معايير التقسيط لدى إمكان (الائتمان، الهوية، أو الحد).",
      solution: "هذا قرار من إمكان بناءً على تقييم العميل. لا يمكن تجاوزه — وجّه العميل لخيار دفع آخر.",
    },
    {
      problem: "تجاوز حد المبلغ / الحد الأدنى",
      cause: "مبلغ الطلب أقل من الحد الأدنى أو أكبر من الحد الأقصى المسموح به لحساب التاجر.",
      solution: "تواصل مع إمكان لمعرفة حدود المبالغ الخاصة بعقدك. عرض رسالة واضحة للعميل عند تجاوز الحد.",
    },
    {
      problem: "Timeout — انتهت مهلة الاتصال",
      cause: "خوادم إمكان لا تستجيب خلال المهلة الزمنية، أو مشكلة في الشبكة.",
      solution: "أعد المحاولة بعد دقائق. إذا استمرت المشكلة، تحقق من حالة خدمات إمكان أو تواصل مع دعمهم.",
    },
    {
      problem: "Webhook لم يصل أو رُفض",
      cause: "رابط Webhook لا يعمل، أو الخادم يعيد كود خطأ عند استقبال الطلب.",
      solution: "تحقق من Webhook URL، تأكّد أنه HTTPS وعام الوصول. راجع سجلات الاتصال في النظام.",
    },
  ],
  supportIssueTypes: [
    { value: "invalid_credentials", label: "بيانات اعتماد غير صالحة (Invalid credentials)" },
    { value: "unauthorized_401", label: "رفض الوصول — Unauthorized 401" },
    { value: "signature_mismatch", label: "توقيع Webhook غير متطابق" },
    { value: "callback_not_received", label: "لم يصل Callback / لم يُشعَر بالدفع" },
    { value: "customer_not_eligible", label: "العميل غير مؤهل للتقسيط" },
    { value: "amount_limit", label: "تجاوز حد المبلغ / الحد الأدنى" },
    { value: "timeout", label: "انتهت مهلة الاتصال (Timeout)" },
    { value: "webhook_not_received", label: "Webhook لم يصل أو رُفض" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
