import type { IntegrationManifest } from "./types";

/**
 * Madfu — مزود تقسيط BNPL سعودي
 * يعمل عبر Token-based API (InitToken endpoint)
 * POST https://api.staging.madfu.com.sa/merchants/token/init
 */
export const madfuManifest: IntegrationManifest = {
  providerId: "madfu",
  name: "مدفوع — تقسيط BNPL",
  nameEn: "Madfu (BNPL)",
  category: "bnpl",
  logoPath: "/brands/payment/madfu.svg",
  color: "from-emerald-600/10 to-emerald-500/5",
  fields: [
    {
      key: "base_url",
      label: "Base URL",
      type: "url",
      placeholder: "https://api.staging.madfu.com.sa",
      hint: "بيئة Staging: https://api.staging.madfu.com.sa — بيئة Prod: https://api.madfu.com.sa",
      required: false,
    },
    {
      key: "merchant_id",
      label: "Merchant ID",
      type: "text",
      placeholder: "معرّف التاجر من لوحة Madfu",
      hint: "تجده في لوحة التحكم تحت إعدادات الحساب → معرّف التاجر",
      required: false,
    },
    {
      key: "client_id",
      label: "Client ID",
      type: "text",
      placeholder: "client_xxxx",
      hint: "مُعرّف التطبيق (Client Application ID)",
      required: false,
    },
    {
      key: "client_secret",
      label: "Client Secret",
      type: "password",
      placeholder: "secret_xxxx",
      hint: "المفتاح السري — لا تشاركه مع أحد. يُشفَّر بـ AES-256-GCM فور الحفظ",
      required: true,
    },
    {
      key: "username",
      label: "اسم المستخدم (Username)",
      type: "text",
      placeholder: "اسم مستخدم حساب التاجر",
      hint: "قد يكون بريدك الإلكتروني المسجّل في Madfu",
      required: false,
    },
    {
      key: "password",
      label: "كلمة المرور (Password)",
      type: "password",
      placeholder: "كلمة مرور حساب التاجر",
      hint: "كلمة المرور المستخدمة لتسجيل الدخول إلى منصة Madfu",
      required: false,
    },
  ],
  webhookPath: "/functions/v1/madfu-webhook",
  supportsConnectionTest: true,
  docsSections: [
    {
      title: "نبذة عن Madfu وطريقة عمله",
      officialLink: "https://madfuapis.readme.io",
      officialLinkLabel: "وثائق Madfu API",
      steps: [
        {
          title: "ما هي خدمة Madfu؟",
          desc: "Madfu (مدفو) هي منصة تقسيط BNPL سعودية تتيح للعملاء تأجيل وتقسيط مدفوعاتهم بدون فوائد. يحصل التاجر على المبلغ كاملاً فور تأكيد الطلب.",
          tip: "Madfu مرخصة من البنك المركزي السعودي (SAMA)",
        },
        {
          title: "كيف يعمل تكامل Madfu مع نومكسيو؟",
          desc: "يستخدم النظام نقطة InitToken لاسترداد رمز الجلسة المشفَّر، ثم يستخدمه في كل عملية دفع. يُخزَّن الرمز مشفَّراً ويُجدَّد تلقائياً عند انتهاء صلاحيته.",
        },
        {
          title: "تقدّم بطلب شراكة مع Madfu",
          desc: "اذهب إلى موقع madfu.com.sa وتواصل مع فريق المبيعات أو سجّل كتاجر. ستستلم بيانات الاعتماد بعد إكمال التحقق.",
          tip: "يُنصح باستخدام بيئة Staging أولاً للتجربة",
        },
        {
          title: "احصل على بيانات اعتماد API",
          desc: "بعد الموافقة على الشراكة، ستستلم: Merchant ID، Client ID، Client Secret — استخدم هذه البيانات في النموذج أدناه.",
        },
        {
          title: "اختبر الاتصال",
          desc: "اضغط 'اختبار الاتصال' في تبويب الإعداد. سيُرسَل طلب إلى InitToken endpoint ويُعرض الناتج فوراً.",
          tip: "إذا نجح الاختبار، يُعني ذلك أن بياناتك صحيحة والنظام جاهز للاستخدام",
        },
      ],
      faq: [
        {
          q: "ليش فشل اختبار الاتصال؟",
          a: "الأسباب الشائعة: (1) Client Secret أو Password خاطئ، (2) الحساب غير مفعَّل على Madfu، (3) تُستخدم بيانات Staging مع رابط Prod أو العكس. تحقق من كل حقل وأعد المحاولة.",
        },
        {
          q: "هل نستخدم Staging ولا Production؟",
          a: "ابدأ دائماً بـ Staging (https://api.staging.madfu.com.sa) للاختبار. عند الانتقال للإنتاج، غيّر Base URL إلى https://api.madfu.com.sa واستخدم بيانات Production.",
        },
        {
          q: "هل التوكن له صلاحية؟ وكيف نجددها؟",
          a: "نعم، رمز الجلسة (Token) له صلاحية محدودة. نومكسيو تُجدِّده تلقائياً عند كل عملية. إذا انتهت صلاحيته، يُعيد النظام اتصالاً جديداً باستخدام بيانات الاعتماد المحفوظة.",
        },
        {
          q: "هل بياناتي محفوظة بأمان؟",
          a: "نعم. جميع البيانات الحساسة (Client Secret، Password) مشفَّرة بـ AES-256-GCM ولا تُعرض نصياً في أي وقت. حتى سجلات التدقيق تُخفي القيم الحساسة.",
        },
        {
          q: "ما طرق الدفع التي يدعمها Madfu؟",
          a: "يدعم Madfu التقسيط عبر: بطاقات مدى، فيزا، ماستركارد — بدون فوائد للعميل وبضمان كامل للتاجر.",
        },
      ],
    },
    {
      title: "الأمان والخصوصية",
      steps: [
        {
          title: "تشفير بيانات الاعتماد",
          desc: "جميع الحقول من نوع password تُشفَّر فوراً بمجرد الحفظ باستخدام AES-256-GCM. لا يمكن لأي مستخدم رؤيتها — حتى مسؤول النظام.",
          tip: "لا تُرسل بيانات Madfu عبر البريد الإلكتروني أو الرسائل",
        },
        {
          title: "عزل البيانات per-tenant",
          desc: "بيانات اعتمادك مرتبطة بحسابك فقط. لا يمكن لأي مؤسسة أخرى الوصول إليها — مُؤمَّنة بـ Row Level Security على مستوى قاعدة البيانات.",
        },
        {
          title: "سجل التدقيق",
          desc: "كل اختبار اتصال أو تغيير في الإعدادات يُسجَّل في Audit Log مع توقيت وهوية المستخدم، بدون حفظ أي قيم سرية.",
        },
      ],
      faq: [
        {
          q: "من يستطيع رؤية بيانات Madfu؟",
          a: "فقط أنت وأصحاب الصلاحيات في مؤسستك. حتى نومكسيو لا تستطيع رؤية Client Secret بعد حفظه.",
        },
      ],
    },
  ],
  supportIssueTypes: [
    { value: "auth_failed", label: "فشل المصادقة (Auth / Token)" },
    { value: "token_expired", label: "انتهت صلاحية التوكن" },
    { value: "network_error", label: "مشكلة في الشبكة / Timeout" },
    { value: "invalid_credentials", label: "بيانات اعتماد غير صالحة" },
    { value: "staging_prod_mismatch", label: "خلط بين بيئة Staging والإنتاج" },
    { value: "payment_rejected", label: "رفض طلب التقسيط" },
    { value: "webhook_issue", label: "مشكلة في Webhook" },
    { value: "other", label: "مشكلة أخرى" },
  ],
};
