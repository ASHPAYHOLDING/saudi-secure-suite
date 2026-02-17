import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, ArrowRight, Lock, Eye, Database, UserCheck, Server, Bell, Trash2, Globe } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const sections = [
  {
    icon: Database,
    title: "البيانات التي نجمعها",
    content: [
      "معلومات الحساب: الاسم، البريد الإلكتروني، رقم الهاتف، واسم المنشأة عند التسجيل.",
      "بيانات الاستخدام: سجلات الدخول، الصفحات المزارة، والإجراءات المتخذة داخل المنصة.",
      "البيانات المالية: الفواتير، العقود، وبيانات العملاء التي تدخلها في النظام.",
      "البيانات التقنية: عنوان IP، نوع المتصفح، ونظام التشغيل لأغراض الأمان.",
    ],
  },
  {
    icon: Eye,
    title: "كيف نستخدم بياناتك",
    content: [
      "تقديم وتحسين خدمات المنصة المحاسبية وتخصيص تجربتك.",
      "معالجة الفواتير والعقود والتقارير المالية الخاصة بمنشأتك.",
      "التواصل معك بشأن تحديثات الخدمة والإشعارات الأمنية المهمة.",
      "الامتثال للمتطلبات التنظيمية السعودية بما في ذلك متطلبات ZATCA.",
    ],
  },
  {
    icon: Lock,
    title: "حماية البيانات والأمان",
    content: [
      "تشفير جميع البيانات أثناء النقل والتخزين باستخدام بروتوكولات TLS 1.3 وAES-256.",
      "خوادم مستضافة في مراكز بيانات معتمدة داخل المملكة العربية السعودية.",
      "مراجعات أمنية دورية واختبارات اختراق لضمان سلامة الأنظمة.",
      "نظام صلاحيات متعدد المستويات لحماية البيانات الحساسة.",
    ],
  },
  {
    icon: UserCheck,
    title: "حقوقك",
    content: [
      "الوصول إلى بياناتك الشخصية وطلب نسخة منها في أي وقت.",
      "تصحيح أو تحديث معلوماتك الشخصية عبر إعدادات الحساب.",
      "طلب حذف حسابك وجميع البيانات المرتبطة به وفقاً للأنظمة المعمول بها.",
      "الاعتراض على معالجة بياناتك لأغراض التسويق المباشر.",
    ],
  },
  {
    icon: Server,
    title: "مشاركة البيانات",
    content: [
      "لا نبيع بياناتك الشخصية لأي طرف ثالث تحت أي ظرف.",
      "قد نشارك البيانات مع مزودي خدمات موثوقين لتشغيل المنصة بموجب اتفاقيات سرية.",
      "قد نفصح عن البيانات عند الطلب القانوني من الجهات الحكومية المختصة.",
      "في حال الاندماج أو الاستحواذ، سيتم إخطارك مسبقاً بأي تغييرات.",
    ],
  },
  {
    icon: Bell,
    title: "ملفات تعريف الارتباط",
    content: [
      "نستخدم ملفات تعريف الارتباط الأساسية لضمان عمل المنصة بشكل صحيح.",
      "ملفات تعريف الارتباط التحليلية لفهم كيفية استخدام المنصة وتحسينها.",
      "يمكنك التحكم في إعدادات ملفات تعريف الارتباط عبر متصفحك.",
      "تعطيل بعض ملفات تعريف الارتباط قد يؤثر على وظائف معينة في المنصة.",
    ],
  },
  {
    icon: Trash2,
    title: "الاحتفاظ بالبيانات",
    content: [
      "نحتفظ ببيانات حسابك طوال فترة اشتراكك النشط في المنصة.",
      "البيانات المالية يتم الاحتفاظ بها لمدة 10 سنوات وفقاً للأنظمة السعودية.",
      "سجلات المراجعة تُحفظ لمدة لا تقل عن 5 سنوات للامتثال التنظيمي.",
      "عند إغلاق الحساب، يتم حذف البيانات غير المطلوبة قانونياً خلال 90 يوماً.",
    ],
  },
  {
    icon: Globe,
    title: "التحديثات والتواصل",
    content: [
      "قد نُحدّث هذه السياسة من وقت لآخر وسنُخطرك بأي تغييرات جوهرية.",
      "النسخة المحدثة تُنشر دائماً على هذه الصفحة مع تاريخ آخر تحديث.",
      "استمرارك في استخدام المنصة بعد التحديث يُعد قبولاً للتغييرات.",
      "للاستفسارات حول الخصوصية، تواصل معنا على privacy@numaxio.com.",
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="relative gradient-hero pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle, hsl(172 66% 36% / 0.08) 0%, transparent 70%)" }}
          />
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2"
          >
            <Shield size={16} className="text-accent" />
            <span className="text-sm font-semibold text-accent">حماية بياناتك أولويتنا</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-white mb-4 text-center"
          >
            سياسة الخصوصية
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-lg max-w-2xl mx-auto mb-6 text-center"
          >
            نلتزم بحماية خصوصيتك وبياناتك وفقاً لأعلى المعايير الدولية والأنظمة السعودية
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/40 text-sm"
          >
            آخر تحديث: فبراير 2026
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors mb-12"
          >
            <ArrowRight size={14} />
            العودة للرئيسية
          </Link>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {sections.map((section, i) => (
              <motion.div
                key={section.title}
                variants={sectionVariants}
                whileHover={{ scale: 1.01 }}
                className="group rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card transition-all duration-300 hover:shadow-elevated hover:border-accent/20"
              >
                <div className="flex items-start gap-4 mb-5">
                  <motion.div
                    whileHover={{ rotate: 10 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors"
                  >
                    <section.icon size={22} />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      <span className="text-accent/60 font-english ml-2">{String(i + 1).padStart(2, "0")}.</span>
                      {section.title}
                    </h2>
                  </div>
                </div>
                <ul className="space-y-3 mr-16">
                  {section.content.map((item, j) => (
                    <motion.li
                      key={j}
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: j * 0.05 }}
                      className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/40" />
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
