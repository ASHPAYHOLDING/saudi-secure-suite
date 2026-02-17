import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Scale, ArrowRight, Clock, Headphones, Zap, Activity, BarChart3, AlertCircle, Award, Settings } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const slaMetrics = [
  { label: "وقت التشغيل المضمون", value: "99.9%", icon: Activity },
  { label: "زمن الاستجابة", value: "<200ms", icon: Zap },
  { label: "وقت الاستجابة للدعم", value: "<4 ساعات", icon: Clock },
  { label: "نافذة الصيانة", value: "الجمعة 2-4 ص", icon: Settings },
];

const sections = [
  {
    icon: Activity,
    title: "مستوى التوفر والتشغيل",
    items: [
      "نضمن توفر المنصة بنسبة 99.9% شهرياً (لا يتجاوز وقت التوقف 43 دقيقة شهرياً).",
      "يتم استثناء فترات الصيانة المجدولة المُعلن عنها مسبقاً بـ 48 ساعة.",
      "النسخ الاحتياطي التلقائي كل 6 ساعات مع الاحتفاظ بنسخ آخر 30 يوماً.",
      "خوادم متعددة المناطق لضمان الاستمرارية في حالات الطوارئ.",
    ],
  },
  {
    icon: Headphones,
    title: "مستويات الدعم الفني",
    items: [
      "الدعم الأساسي (مجاني): بريد إلكتروني خلال أيام العمل، استجابة خلال 24 ساعة.",
      "الدعم المتقدم (الاحترافية): دردشة مباشرة + بريد، استجابة خلال 4 ساعات.",
      "الدعم المؤسسي (المؤسسات): مدير حساب مخصص + هاتف، استجابة خلال ساعة.",
      "جميع المستويات تشمل الوصول لقاعدة المعرفة والتوثيق التقني.",
    ],
  },
  {
    icon: AlertCircle,
    title: "تصنيف الأعطال والاستجابة",
    items: [
      "حرج (P1): المنصة غير متاحة بالكامل → استجابة خلال 30 دقيقة، حل خلال 4 ساعات.",
      "مرتفع (P2): ميزة أساسية معطلة → استجابة خلال ساعة، حل خلال 8 ساعات.",
      "متوسط (P3): مشكلة جزئية لا تمنع العمل → استجابة خلال 4 ساعات، حل خلال 24 ساعة.",
      "منخفض (P4): طلب تحسين أو سؤال عام → استجابة خلال 24 ساعة، حل خلال 5 أيام.",
    ],
  },
  {
    icon: BarChart3,
    title: "مؤشرات الأداء",
    items: [
      "زمن تحميل الصفحات: أقل من 2 ثانية للصفحات الرئيسية.",
      "زمن معالجة الفواتير: أقل من 3 ثوانٍ لإنشاء وحفظ الفاتورة.",
      "زمن إنشاء التقارير: أقل من 10 ثوانٍ للتقارير القياسية.",
      "سعة التخزين: حسب خطة الاشتراك مع إمكانية الترقية.",
    ],
  },
  {
    icon: Award,
    title: "التعويضات",
    items: [
      "إذا انخفض التوفر عن 99.9%: رصيد 10% من قيمة الاشتراك الشهري.",
      "إذا انخفض التوفر عن 99.5%: رصيد 25% من قيمة الاشتراك الشهري.",
      "إذا انخفض التوفر عن 99.0%: رصيد 50% من قيمة الاشتراك الشهري.",
      "يجب تقديم طلب التعويض خلال 30 يوماً من تاريخ الحادثة.",
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const SLA = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="relative gradient-hero pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, hsl(172 66% 36% / 0.08) 0%, transparent 70%)" }}
          />
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2"
          >
            <Scale size={16} className="text-accent" />
            <span className="text-sm font-semibold text-accent">التزامنا بجودة الخدمة</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-white mb-4 text-center"
          >
            اتفاقية مستوى الخدمة
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-lg max-w-2xl mx-auto mb-10 text-center"
          >
            نلتزم بتقديم خدمة موثوقة وعالية الأداء مع ضمانات واضحة وشفافة
          </motion.p>

          {/* SLA Metrics Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {slaMetrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                whileHover={{ y: -4, scale: 1.03 }}
                className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center"
              >
                <metric.icon size={20} className="text-accent mx-auto mb-2" />
                <p className="text-2xl font-bold text-white font-english mb-1">{metric.value}</p>
                <p className="text-[11px] text-white/50">{metric.label}</p>
              </motion.div>
            ))}
          </motion.div>
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
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="group rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card hover:shadow-elevated transition-all duration-300"
              >
                <div className="flex items-start gap-4 mb-5">
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: -5 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300"
                  >
                    <section.icon size={22} />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground pt-2">{section.title}</h2>
                </div>

                <div className="mr-16 space-y-3">
                  {section.items.map((item, j) => (
                    <motion.div
                      key={j}
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: j * 0.06 }}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 rounded-2xl border border-accent/20 bg-accent/5 p-8 text-center"
          >
            <h3 className="text-xl font-bold text-foreground mb-3">هل لديك استفسار حول اتفاقية الخدمة؟</h3>
            <p className="text-sm text-muted-foreground mb-6">فريقنا جاهز للإجابة على جميع أسئلتك</p>
            <a
              href="mailto:support@numaxio.com"
              className="inline-flex items-center gap-2 gradient-accent text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-accent-glow hover:opacity-90 transition-all"
            >
              <Headphones size={16} />
              تواصل مع فريق الدعم
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SLA;
