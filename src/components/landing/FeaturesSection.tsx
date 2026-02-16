import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  FileText,
  Calculator,
  Shield,
  BarChart3,
  Stamp,
  Users,
  FileSignature,
  ShieldCheck,
  Globe,
  Zap,
  Lock,
  Cloud,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "فواتير إلكترونية ZATCA",
    description: "إصدار فواتير ضريبية متوافقة مع هيئة الزكاة والدخل المرحلة الأولى والثانية مع QR Code بتشفير TLV.",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: Calculator,
    title: "حساب الضريبة تلقائياً",
    description: "حساب ضريبة القيمة المضافة 15% تلقائياً على كل بند مع تفصيل كامل للمبالغ والخصومات.",
    color: "from-blue-500/20 to-indigo-500/20",
  },
  {
    icon: FileSignature,
    title: "إدارة العقود",
    description: "إنشاء وتتبع العقود مع العملاء، قوالب جاهزة، تواريخ انتهاء، وتوقيع إلكتروني.",
    color: "from-violet-500/20 to-purple-500/20",
  },
  {
    icon: Users,
    title: "إدارة العملاء",
    description: "قاعدة بيانات شاملة للعملاء مع السجل التجاري والرقم الضريبي وسجل المعاملات.",
    color: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: Stamp,
    title: "ختم إلكتروني رسمي",
    description: "ختم رقمي معتمد يُضاف تلقائياً على الفواتير والعقود مع بيانات المنشأة.",
    color: "from-rose-500/20 to-pink-500/20",
  },
  {
    icon: BarChart3,
    title: "تقارير وتحليلات مالية",
    description: "لوحة تحكم بإحصائيات حية: الإيرادات، الضريبة المستحقة، الفواتير المتأخرة، وأداء المنشأة.",
    color: "from-cyan-500/20 to-sky-500/20",
  },
  {
    icon: ShieldCheck,
    title: "امتثال سعودي كامل",
    description: "متوافق مع أنظمة ZATCA، هيئة الزكاة والضريبة، ومتطلبات الفوترة الإلكترونية السعودية.",
    color: "from-green-500/20 to-emerald-500/20",
  },
  {
    icon: Lock,
    title: "أمان وخصوصية مطلقة",
    description: "تشفير كامل للبيانات، عزل تام بين المنشآت، وسجل مراجعة لكل عملية في النظام.",
    color: "from-slate-500/20 to-gray-500/20",
  },
  {
    icon: Cloud,
    title: "سحابي بالكامل",
    description: "لا حاجة لسيرفرات. يعمل من أي مكان عبر المتصفح مع نسخ احتياطية تلقائية.",
    color: "from-sky-500/20 to-blue-500/20",
  },
];

const FeaturesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="py-28 bg-background" dir="rtl">
      <div className="container mx-auto px-4" ref={ref}>
        {/* Header */}
        <div className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Zap size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">مميزات المنصة</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl"
          >
            كل ما تحتاجه منشأتك
            <br />
            <span className="text-gradient">في منصة واحدة</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-2xl text-lg text-muted-foreground"
          >
            صممنا نيوماكسيو خصيصاً للمنشآت السعودية مع مراعاة المتطلبات النظامية وأعلى معايير الأداء
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="group relative rounded-2xl border border-border bg-card p-8 shadow-card transition-shadow duration-300 hover:shadow-elevated overflow-hidden"
            >
              {/* Gradient blob */}
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl`} />
              
              <div className="relative">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-accent-glow group-hover:scale-110">
                  <feature.icon size={24} />
                </div>
                <h3 className="mb-3 text-lg font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
