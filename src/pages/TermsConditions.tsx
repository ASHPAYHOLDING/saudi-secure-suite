import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, ArrowRight, CheckCircle, AlertTriangle, Gavel, CreditCard, Ban, RefreshCw, Scale, ShieldCheck } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const sections = [
  {
    icon: CheckCircle,
    title: "القبول والموافقة",
    items: [
      "باستخدامك لمنصة نيوماكسيو، فإنك توافق على الالتزام بهذه الشروط والأحكام.",
      "يجب أن يكون عمرك 18 عاماً أو أكثر لاستخدام المنصة.",
      "أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك.",
      "يُعد استخدامك المستمر للمنصة بعد أي تحديث للشروط موافقة على التغييرات.",
    ],
  },
  {
    icon: Gavel,
    title: "الاستخدام المسموح",
    items: [
      "استخدام المنصة لأغراض محاسبية ومالية مشروعة فقط.",
      "إدخال بيانات صحيحة ودقيقة في جميع الفواتير والعقود والمستندات.",
      "الالتزام بجميع الأنظمة والقوانين السعودية المتعلقة بالفوترة الإلكترونية.",
      "عدم استخدام المنصة لأي أنشطة غير قانونية أو احتيالية.",
    ],
  },
  {
    icon: Ban,
    title: "الاستخدام المحظور",
    items: [
      "محاولة اختراق أو التلاعب بأنظمة المنصة أو بنيتها التحتية.",
      "مشاركة حسابك مع أطراف غير مصرح لها بالوصول.",
      "استخدام المنصة لإصدار فواتير وهمية أو مضللة.",
      "نسخ أو توزيع أو بيع أي جزء من المنصة أو محتواها.",
      "تحميل ملفات ضارة أو فيروسات أو أي برمجيات خبيثة.",
    ],
  },
  {
    icon: CreditCard,
    title: "الاشتراكات والدفع",
    items: [
      "تتوفر خطط اشتراك متعددة تناسب مختلف أحجام المنشآت.",
      "يتم التجديد تلقائياً ما لم يتم إلغاء الاشتراك قبل نهاية الفترة الحالية.",
      "جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة (15%).",
      "يحق لنا تعديل الأسعار مع إشعار مسبق بـ 30 يوماً على الأقل.",
    ],
  },
  {
    icon: RefreshCw,
    title: "سياسة الإلغاء والاسترداد",
    items: [
      "يمكنك إلغاء اشتراكك في أي وقت من خلال إعدادات الحساب.",
      "عند الإلغاء، يظل حسابك نشطاً حتى نهاية فترة الفوترة الحالية.",
      "الاشتراكات السنوية قابلة للاسترداد خلال أول 30 يوماً فقط.",
      "لن يتم استرداد أي مبالغ بعد انقضاء فترة الضمان المحددة.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "حدود المسؤولية",
    items: [
      "نسعى لتوفير خدمة متاحة على مدار الساعة، لكن لا نضمن عدم انقطاع الخدمة.",
      "لا نتحمل مسؤولية أي خسائر ناتجة عن إدخال بيانات خاطئة من المستخدم.",
      "مسؤوليتنا القصوى لا تتجاوز قيمة الاشتراك المدفوع في آخر 12 شهراً.",
      "لا نتحمل مسؤولية أي أضرار غير مباشرة أو تبعية.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "الملكية الفكرية",
    items: [
      "جميع حقوق الملكية الفكرية للمنصة محفوظة لشركة نيوماكسيو.",
      "يحتفظ المستخدم بملكية بياناته وفواتيره وعقوده المنشأة على المنصة.",
      "نمنحك ترخيصاً محدوداً وغير حصري لاستخدام المنصة وفقاً لهذه الشروط.",
      "لا يجوز استخدام علامتنا التجارية أو شعارنا دون إذن كتابي مسبق.",
    ],
  },
  {
    icon: Scale,
    title: "القانون الحاكم",
    items: [
      "تخضع هذه الشروط لأنظمة وقوانين المملكة العربية السعودية.",
      "أي نزاع يُحل ودياً أولاً، وفي حال تعذر ذلك يُحال للجهات القضائية المختصة بالرياض.",
      "تُعد النسخة العربية من هذه الشروط هي النسخة المعتمدة في حال وجود تعارض.",
      "يحق لنا تعديل هذه الشروط مع إشعار المستخدمين عبر البريد الإلكتروني.",
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const TermsConditions = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="relative gradient-hero pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, hsl(205 80% 50% / 0.06) 0%, transparent 70%)" }}
          />
        </div>

        <div className="container relative mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2"
          >
            <FileText size={16} className="text-accent" />
            <span className="text-sm font-semibold text-accent">الإطار القانوني</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-white mb-4"
          >
            الشروط والأحكام
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-lg max-w-2xl mx-auto mb-6"
          >
            يرجى قراءة هذه الشروط بعناية قبل استخدام منصة نيوماكسيو المحاسبية
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
            className="space-y-6"
          >
            {sections.map((section, i) => (
              <motion.div
                key={section.title}
                variants={cardVariants}
                className="group relative rounded-2xl border border-border bg-card overflow-hidden shadow-card transition-all duration-300 hover:shadow-elevated"
              >
                {/* Accent line */}
                <div className="absolute top-0 right-0 h-full w-1 bg-accent/0 group-hover:bg-accent transition-all duration-500" />

                <div className="p-6 md:p-8">
                  <div className="flex items-start gap-4 mb-5">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
                    >
                      <section.icon size={22} />
                    </motion.div>
                    <div>
                      <span className="text-xs font-english text-accent/50 block mb-0.5">
                        المادة {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                    </div>
                  </div>

                  <div className="mr-16 space-y-3">
                    {section.items.map((item, j) => (
                      <motion.div
                        key={j}
                        initial={{ opacity: 0, x: 10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: j * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px] font-bold font-english">
                          {j + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-muted-foreground">{item}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsConditions;
