import type { IntegrationManifest } from "./types";

export const woocommerceManifest: IntegrationManifest = {
  providerId: "woocommerce",
  name: "ووكومرس",
  nameEn: "WooCommerce",
  category: "ecommerce",
  logoPath: undefined,
  color: "from-purple-500/10 to-violet-500/5",
  description: "ربط متجرك على ووكومرس (WordPress) لمزامنة الطلبات والمنتجات والمخزون تلقائياً مع نظام نومكسيو.",
  benefits: [
    "مزامنة تلقائية للطلبات من WooCommerce إلى الفواتير",
    "تحديث المخزون في الاتجاهين",
    "استيراد بيانات العملاء تلقائياً",
    "تقارير مبيعات موحّدة تشمل WooCommerce",
    "إشعارات فورية عند استلام طلبات جديدة",
  ],
  requirements: [
    "متجر WooCommerce مفعّل على WordPress (إصدار 5.0+)",
    "WooCommerce إصدار 7.0 أو أعلى",
    "شهادة SSL (HTTPS) مفعّلة على المتجر",
    "صلاحيات Administrator أو Shop Manager على WordPress",
    "إعدادات REST API مفعّلة (مفعّلة افتراضياً)",
  ],
  fields: [
    {
      key: "store_url",
      label: "رابط المتجر",
      type: "url",
      placeholder: "https://your-store.com",
      hint: "رابط متجرك الكامل مع https:// — مثال: https://myshop.com",
      required: true,
    },
    {
      key: "consumer_key",
      label: "Consumer Key",
      type: "password",
      placeholder: "ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "من WordPress → WooCommerce → Settings → Advanced → REST API → Add Key",
      required: true,
    },
    {
      key: "consumer_secret",
      label: "Consumer Secret",
      type: "password",
      placeholder: "cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "يظهر مرة واحدة فقط عند إنشاء المفتاح — احفظه فوراً",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "Secret للتحقق من Webhook",
      hint: "من WooCommerce → Settings → Advanced → Webhooks → Secret",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/woocommerce-webhook",
  supportsConnectionTest: false,
  docsSections: [
    {
      title: "ربط متجر WooCommerce",
      officialLink: "https://woocommerce.com/document/woocommerce-rest-api/",
      officialLinkLabel: "وثائق WooCommerce REST API",
      steps: [
        {
          title: "سجّل دخولك على WordPress",
          desc: "اذهب إلى your-store.com/wp-admin وسجّل دخولك بحساب لديه صلاحيات المدير.",
          tip: "تأكد أن WooCommerce مثبّت ومفعّل — تحقق من Plugins",
        },
        {
          title: "أنشئ مفتاح REST API",
          desc: "من WooCommerce → Settings → Advanced → REST API → Add Key. اختر اسماً مناسباً مثل 'Numaxio Integration'.",
        },
        {
          title: "اختر الصلاحيات",
          desc: "اختر 'Read/Write' للصلاحيات لتمكين المزامنة الكاملة. اضغط Generate API Key.",
          tip: "Consumer Key و Consumer Secret يظهران مرة واحدة فقط — انسخهما فوراً قبل مغادرة الصفحة",
        },
        {
          title: "أدخل البيانات هنا",
          desc: "الصق رابط المتجر و Consumer Key و Consumer Secret في حقول الإعداد.",
        },
        {
          title: "أعد Webhook (اختياري)",
          desc: "من WooCommerce → Settings → Advanced → Webhooks → Add Webhook. اختر Topic: Order updated، Status: Active، Secret: أنشئ كلمة سر عشوائية.",
          tip: "Webhook يُسرّع المزامنة — بدونه ستتم المزامنة كل 15 دقيقة",
        },
      ],
      faq: [
        {
          q: "ما إصدار WooCommerce المطلوب؟",
          a: "الإصدار 7.0 أو أعلى. يمكنك التحقق من WooCommerce → Status → WooCommerce version.",
        },
        {
          q: "هل يعمل مع WooCommerce Subscriptions؟",
          a: "نعم، يتم استيراد طلبات الاشتراك كفواتير متكررة تلقائياً.",
        },
        {
          q: "هل يمكن مزامنة المنتجات في الاتجاهين؟",
          a: "حالياً المزامنة من WooCommerce إلى نومكسيو فقط. تحديث الاتجاه العكسي قيد التطوير.",
        },
        {
          q: "ماذا لو كان المتجر على HTTP وليس HTTPS؟",
          a: "REST API يتطلب HTTPS. فعّل شهادة SSL أولاً — معظم استضافات WordPress تقدمها مجاناً.",
        },
        {
          q: "هل يدعم WooCommerce Multi-vendor (Dokan/WCFM)؟",
          a: "نعم، الطلبات تُستورد من المتجر الرئيسي بغض النظر عن البائع الفرعي.",
        },
      ],
    },
  ],
  troubleshootingItems: [
    {
      problem: "خطأ 401 Unauthorized عند اختبار الاتصال",
      cause: "Consumer Key أو Consumer Secret غير صحيح أو منتهي الصلاحية.",
      solution: "أنشئ مفتاح REST API جديد من WooCommerce → Settings → Advanced → REST API وأعد إدخال البيانات.",
    },
    {
      problem: "خطأ 404 عند الاتصال",
      cause: "رابط المتجر غير صحيح أو Permalinks غير مفعّلة.",
      solution: "تأكد من الرابط. اذهب إلى WordPress → Settings → Permalinks واختر أي خيار غير 'Plain' ثم احفظ.",
    },
    {
      problem: "الطلبات لا تظهر بعد المزامنة",
      cause: "مفتاح API ليس لديه صلاحيات كافية أو الطلبات في حالة غير مدعومة.",
      solution: "تأكد أن صلاحيات المفتاح 'Read/Write'. الطلبات بحالة 'processing' أو 'completed' فقط يتم مزامنتها.",
    },
    {
      problem: "Webhook لا يصل إلى نومكسيو",
      cause: "جدار حماية أو إضافة أمان على WordPress تمنع الطلبات الخارجية.",
      solution: "أضف URL الـ Webhook إلى القائمة البيضاء في إضافات الأمان (Wordfence/Sucuri). تأكد أن الخادم يدعم cURL.",
    },
    {
      problem: "بطء في المزامنة أو timeout",
      cause: "عدد كبير من المنتجات أو موارد الخادم محدودة.",
      solution: "تحقق من حدود PHP (max_execution_time ≥ 120). فعّل Webhook للمزامنة الفورية بدلاً من الجدولة.",
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اتصال REST API" },
    { value: "orders_not_syncing", label: "الطلبات لا تتزامن" },
    { value: "products_missing", label: "منتجات مفقودة" },
    { value: "inventory_mismatch", label: "عدم تطابق المخزون" },
    { value: "webhook_not_firing", label: "Webhook لا يصل" },
    { value: "ssl_error", label: "خطأ SSL/HTTPS" },
    { value: "authentication_error", label: "خطأ مصادقة (401/403)" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
