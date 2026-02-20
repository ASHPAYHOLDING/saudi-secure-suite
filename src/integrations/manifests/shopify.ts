import type { IntegrationManifest } from "./types";

export const shopifyManifest: IntegrationManifest = {
  providerId: "shopify",
  name: "شوبيفاي",
  nameEn: "Shopify",
  category: "ecommerce",
  logoPath: undefined,
  color: "from-green-500/10 to-emerald-500/5",
  fields: [
    {
      key: "store_url",
      label: "رابط المتجر (Shop URL)",
      type: "text",
      placeholder: "your-store.myshopify.com",
      hint: "أدخل اسم متجرك فقط بدون https:// — مثال: myshop.myshopify.com",
      required: true,
    },
    {
      key: "admin_api_token",
      label: "Admin API Token",
      type: "password",
      placeholder: "shpat_xxxxxxxxxxxxxxxxxxxx",
      hint: "من Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "Webhook Secret",
      type: "password",
      placeholder: "سر التحقق من Webhook",
      hint: "تجده في إعدادات التطبيق تحت Webhooks → Signing secret",
      required: false,
    },
    {
      key: "api_version",
      label: "API Version",
      type: "text",
      placeholder: "2024-01",
      hint: "نسخة Shopify API — يُنصح بآخر إصدار مستقر",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/shopify-webhook",
  docsSections: [
    {
      title: "ربط متجر Shopify",
      officialLink: "https://shopify.dev/docs/apps/auth/admin-app-access-tokens",
      officialLinkLabel: "وثائق Shopify API",
      steps: [
        {
          title: "سجّل دخولك على Shopify Admin",
          desc: "اذهب إلى your-store.myshopify.com/admin وسجّل دخولك بحساب مالك المتجر أو حساب بصلاحيات كاملة.",
          tip: "تأكد أن الحساب لديه صلاحية 'Manage and install apps and channels'",
        },
        {
          title: "انتقل إلى إعدادات التطبيقات",
          desc: "من القائمة اختر Settings (الإعدادات) → Apps and sales channels → Develop apps.",
        },
        {
          title: "أنشئ تطبيقاً خاصاً (Custom App)",
          desc: "اضغط 'Create an app'، اختر اسماً مناسباً مثل 'ERP Integration'، ثم اضغط 'Create app'.",
        },
        {
          title: "حدّد صلاحيات API",
          desc: "اضغط 'Configure Admin API scopes' واختر الصلاحيات المطلوبة: read_orders, read_products, read_inventory, write_orders.",
          tip: "لا تمنح صلاحيات أكثر مما تحتاج — اتبع مبدأ الحد الأدنى من الصلاحيات",
        },
        {
          title: "ثبّت التطبيق واحصل على Token",
          desc: "بعد حفظ الصلاحيات، اضغط 'Install app' ثم 'Install'. ستظهر صفحة بها Admin API access token — انسخه فوراً (لن يُعرض مرة أخرى).",
        },
        {
          title: "أدخل البيانات هنا",
          desc: "الصق رابط متجرك وAdmin API Token في حقول الإعداد. سيتم تشفيرها وحفظها بأمان.",
        },
      ],
      faq: [
        {
          q: "ما هي الصلاحيات المطلوبة لـ API Token؟",
          a: "الحد الأدنى: read_orders, read_products, read_inventory. إضافياً: write_orders إذا أردت تحديث حالة الطلبات من النظام.",
        },
        {
          q: "لا أجد خيار 'Develop apps' في إعداداتي",
          a: "يجب تفعيل custom apps أولاً. اذهب إلى Settings → Apps and sales channels → ابحث عن Enable private apps أو Custom apps development وقم بتفعيله.",
        },
        {
          q: "هل يمكن مزامنة المخزون بشكل تلقائي؟",
          a: "نعم، بعد الإعداد الناجح يمكنك تفعيل مزامنة المخزون من إعدادات التكامل في النظام.",
        },
        {
          q: "ماذا يحدث إذا تجاوزت حدود API Shopify؟",
          a: "النظام يعمل بنظام الـ Retry التلقائي مع تأخير تدريجي (Exponential Backoff) لتجنب تجاوز حدود Shopify API.",
        },
        {
          q: "هل يعمل مع Shopify Plus؟",
          a: "نعم، يدعم النظام Shopify Basic وAdvanced وPlus. في حالة Plus قد تكون لديك صلاحيات API إضافية.",
        },
      ],
    },
    {
      title: "إعداد Webhook",
      steps: [
        {
          title: "احصل على رابط Webhook",
          desc: "رابط Webhook الخاص بمتجرك يظهر في صفحة الإعداد تحت قسم 'Webhook URL' — انسخه.",
        },
        {
          title: "أضف Webhook في Shopify",
          desc: "من Shopify Admin → Settings → Notifications → انزل للأسفل إلى Webhooks → اضغط Create webhook.",
        },
        {
          title: "اختر الأحداث",
          desc: "اختر الأحداث التي تريد مزامنتها: orders/create, orders/updated, products/update, inventory_levels/update.",
          tip: "ابدأ بـ orders/create فقط ثم أضف الباقي حسب حاجتك",
        },
        {
          title: "أدخل Signing Secret",
          desc: "بعد حفظ الـ Webhook، ستجد 'Signing secret' — انسخه وأدخله في حقل 'Webhook Secret' في الأعلى.",
        },
      ],
      faq: [
        {
          q: "لماذا نحتاج Webhook Secret؟",
          a: "يُستخدم للتحقق من أن الطلبات الواردة قادمة فعلاً من Shopify وليس من طرف ثالث. هذا ضروري للأمان.",
        },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "connection_failed", label: "فشل اختبار الاتصال" },
    { value: "invalid_token", label: "Admin API Token غير صالح" },
    { value: "orders_not_syncing", label: "الطلبات لا تتزامن" },
    { value: "inventory_mismatch", label: "عدم تطابق المخزون" },
    { value: "webhook_not_firing", label: "Webhook لا يصل" },
    { value: "products_missing", label: "منتجات مفقودة" },
    { value: "rate_limit", label: "تجاوز حد API Shopify" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
