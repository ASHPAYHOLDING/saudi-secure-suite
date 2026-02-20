import type { IntegrationManifest } from "./types";

/**
 * MISPAY — تقسيط BNPL
 * حل تقسيط مرن للتجار السعوديين
 * https://doc.mispay.co/docs/introduction
 */
export const mispayManifest: IntegrationManifest = {
  providerId: "mispay",
  name: "MISPAY — تقسيط",
  nameEn: "MISPAY (BNPL)",
  description: "تقسيط مرن للعملاء داخل صفحة الدفع مع موافقة فورية وزيادة معدل التحويل.",
  category: "bnpl",
  logoPath: "/brands/bnpl/mispay.svg",
  color: "from-violet-600/10 to-violet-500/5",
  fields: [
    {
      key: "environment",
      label: "البيئة",
      type: "text",
      placeholder: "sandbox | production",
      hint: "sandbox للاختبار، production للبيئة الفعلية",
      required: true,
    },
    {
      key: "merchant_id",
      label: "Merchant ID",
      type: "text",
      placeholder: "MISPAY-MERCHANT-XXXX",
      hint: "معرّف التاجر من لوحة MISPAY",
      required: true,
    },
    {
      key: "client_id",
      label: "Client ID",
      type: "text",
      placeholder: "client_xxxxxxxxxxxx",
      hint: "معرّف التطبيق من Developer Portal",
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
      hint: "مفتاح API الخاص بحساب التاجر",
      required: false,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "••••••••••••••••",
      hint: "للتحقق من توقيع HMAC-SHA256 للـ Webhook",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/mispay-webhook",
  supportsConnectionTest: false,
  docsSections: [
    {
      title: "دليل ربط MISPAY — خطوة بخطوة",
      officialLink: "https://doc.mispay.co/docs/introduction",
      officialLinkLabel: "MISPAY Developer Docs",
      steps: [
        {
          title: "إنشاء حساب تاجر في MISPAY",
          desc: "توجّه إلى mispay.co وسجّل حساب تاجر. ستحتاج إلى السجل التجاري ووثائق الهوية لإتمام التسجيل.",
          tip: "MISPAY يخدم التجار السعوديين — تأكّد من توافر متطلبات التوثيق التجاري",
        },
        {
          title: "الوصول إلى لوحة المطور",
          desc: "بعد الموافقة على حسابك، ادخل Dashboard → Developer Tools للحصول على بيانات الاعتماد الخاصة بك.",
        },
        {
          title: "تفعيل بيئة Sandbox",
          desc: "ابدأ دائماً ببيئة Sandbox للاختبار. فعّل Sandbox من لوحة MISPAY واستخرج مفاتيح الاختبار.",
          tip: "Sandbox لا يُجري عمليات مالية حقيقية — آمن للاختبار الكامل",
        },
        {
          title: "استخراج مفاتيح API",
          desc: "من Developer Tools، انسخ: Merchant ID، Client ID، Client Secret، وAPI Key. احتفظ بها في مكان آمن.",
          tip: "لا تشارك Client Secret أو API Key — يُخزَّنان مشفّرَين داخل النظام فقط",
        },
        {
          title: "إدخال البيانات في نظام نمكسيو",
          desc: "في تبويب الإعداد، أدخل جميع البيانات المطلوبة واختر البيئة المناسبة، ثم اضغط «حفظ الإعدادات».",
        },
        {
          title: "نسخ Redirect و Webhook URL",
          desc: "انسخ رابط Webhook الظاهر في تبويب الإعداد وأضفه في لوحة MISPAY تحت إعدادات Webhook. افعل نفس الشيء لـ Redirect URL.",
          tip: "تأكّد أن الروابط HTTPS ومتاحة للعموم حتى يتمكن MISPAY من الوصول إليها",
        },
        {
          title: "إجراء اختبار تقسيط تجريبي",
          desc: "في Sandbox، نفّذ عملية تقسيط تجريبية للتحقق من تدفق الطلب، الموافقة الفورية، ووصول Webhook.",
        },
        {
          title: "الانتقال لبيئة الإنتاج",
          desc: "بعد اختبار ناجح في Sandbox، غيّر البيئة إلى production وأعد إدخال مفاتيح الإنتاج من MISPAY.",
          tip: "⚠️ قد يتطلب MISPAY تفعيلاً واعتماداً من طرفهم قبل تشغيل بيئة الإنتاج — تواصل مع فريق MISPAY للتأكيد",
        },
      ],
      faq: [
        {
          q: "ما هي آلية عمل MISPAY للتقسيط؟",
          a: "MISPAY يتيح للعميل تقسيط المشتريات داخل صفحة الدفع مع موافقة فورية. التاجر يستلم المبلغ الكامل فور إتمام الطلب، بينما يتولى MISPAY متابعة أقساط العميل.",
        },
        {
          q: "ما الحد الأدنى والأقصى لمبلغ الطلب؟",
          a: "يتحدد الحد وفقاً لاتفاقية التاجر مع MISPAY. تواصل مع فريق MISPAY للاطلاع على حدود المبالغ المطبّقة على حسابك.",
        },
        {
          q: "متى يصل المبلغ للتاجر؟",
          a: "يستلم التاجر المبلغ الكامل من MISPAY وفق الجدول المتفق عليه. MISPAY يتحمل مخاطر الائتمان ويتابع أقساط العملاء بشكل مستقل.",
        },
        {
          q: "هل يمكن الاسترداد لطلبات MISPAY؟",
          a: "نعم، يدعم MISPAY الاسترداد الكامل والجزئي عبر API. سيتم إشعار MISPAY تلقائياً لتعديل جدول أقساط العميل.",
        },
        {
          q: "هل Sandbox حقيقي للاختبار؟",
          a: "نعم، Sandbox هو بيئة اختبار كاملة تحاكي Sandbox بدون معالجة مالية فعلية — مثالي لاختبار التدفق الكامل.",
        },
        {
          q: "لماذا لم يتم الاتصال بعد الحفظ؟",
          a: "تأكّد أن البيانات المدخلة صحيحة ومن البيئة الصحيحة. قد يحتاج حساب MISPAY لتفعيل من طرفهم — تواصل مع دعمهم.",
        },
      ],
    },
  ],
  troubleshootingItems: [
    {
      problem: "Invalid credentials — بيانات اعتماد خاطئة",
      cause: "Merchant ID أو Client ID أو Client Secret غير صحيح، أو تم إدخال مفاتيح Sandbox في بيئة Production أو العكس.",
      solution: "تحقّق من بيانات الاعتماد في Developer Tools بلوحة MISPAY. تأكّد من تطابق البيئة (sandbox/production) مع المفاتيح المدخلة.",
    },
    {
      problem: "Signature mismatch — توقيع Webhook غير متطابق",
      cause: "Webhook Secret المُدخَل لا يتطابق مع ما يُرسله MISPAY في رأس الطلب X-MISPAY-Signature.",
      solution: "انسخ Webhook Secret من لوحة MISPAY مجدداً وأدخله في حقل Webhook Secret في الإعداد. تأكّد من عدم وجود مسافات زائدة.",
    },
    {
      problem: "Callback not received — لم يصل Webhook",
      cause: "رابط Webhook غير صحيح، أو غير متاح من خوادم MISPAY، أو الخادم يُرجع كود خطأ.",
      solution: "انسخ Webhook URL من تبويب الإعداد وأضفه في لوحة MISPAY. تحقّق أنه HTTPS وعام الوصول دون قيود IP.",
    },
    {
      problem: "Payment declined — رُفض طلب الدفع",
      cause: "رُفض طلب التقسيط من MISPAY لأسباب تتعلق بحساب العميل أو سياسة الائتمان.",
      solution: "هذا قرار من MISPAY بناءً على تقييم العميل. لا يمكن تجاوزه — وجّه العميل لاختيار طريقة دفع أخرى.",
    },
    {
      problem: "Customer not eligible — العميل غير مؤهل",
      cause: "العميل لا يستوفي معايير MISPAY الائتمانية أو الهوياتية أو يتجاوز حدوده.",
      solution: "هذا تقييم من MISPAY. وجّه العميل لطريقة دفع بديلة وتأكّد من صحة بيانات العميل المُرسلة في الطلب.",
    },
    {
      problem: "Amount out of range — خارج نطاق المبلغ المسموح به",
      cause: "مبلغ الطلب أقل من الحد الأدنى أو أكبر من الحد الأقصى المسموح به لحساب التاجر.",
      solution: "تواصل مع MISPAY لمعرفة حدود المبالغ الخاصة بعقدك. أضف رسالة واضحة للعميل عند تجاوز الحد.",
    },
    {
      problem: "Unauthorized / 401",
      cause: "انتهت صلاحية الـ Token أو الحساب غير مفعّل أو المفاتيح ليست للبيئة الصحيحة.",
      solution: "تحقّق من صلاحية المفاتيح في لوحة MISPAY. تأكّد من تفعيل الحساب وتطابق البيئة. أعد توليد المفاتيح إن لزم.",
    },
    {
      problem: "Timeout — انتهت مهلة الاستجابة",
      cause: "خوادم MISPAY لا تستجيب خلال المهلة الزمنية، أو مشكلة في الشبكة.",
      solution: "أعد المحاولة بعد دقائق. إذا استمرت المشكلة، تواصل مع دعم MISPAY للتحقق من حالة الخدمة.",
    },
  ],
  supportIssueTypes: [
    { value: "invalid_credentials", label: "بيانات اعتماد غير صالحة (Invalid credentials)" },
    { value: "signature_mismatch", label: "توقيع Webhook غير متطابق (Signature mismatch)" },
    { value: "callback_not_received", label: "لم يصل Callback / Webhook" },
    { value: "payment_declined", label: "رُفض طلب الدفع (Payment declined)" },
    { value: "customer_not_eligible", label: "العميل غير مؤهل للتقسيط" },
    { value: "amount_out_of_range", label: "خارج نطاق المبلغ المسموح به" },
    { value: "unauthorized_401", label: "رفض الوصول — Unauthorized 401" },
    { value: "timeout", label: "انتهت مهلة الاتصال (Timeout)" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
