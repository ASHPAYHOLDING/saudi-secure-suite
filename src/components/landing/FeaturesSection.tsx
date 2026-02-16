import { motion } from "framer-motion";
import { Shield, Users, BarChart3, Lock, Cloud, Smartphone } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "عزل بيانات كامل",
    description: "كل شركة بيئة مستقلة تماماً. لا اختلاط بيانات نهائياً مع Row-Level Security.",
  },
  {
    icon: Users,
    title: "Multi-Tenant حقيقي",
    description: "إدارة عدد لا محدود من الشركات والعملاء في نظام واحد بكفاءة عالية.",
  },
  {
    icon: BarChart3,
    title: "تقارير وتحليلات",
    description: "لوحة تحكم شاملة مع إحصائيات فورية وتقارير مخصصة لكل Tenant.",
  },
  {
    icon: Lock,
    title: "أمان مؤسسي",
    description: "تشفير كامل، مصادقة متعددة العوامل، وسجل تدقيق لكل عملية.",
  },
  {
    icon: Cloud,
    title: "سحابي بالكامل",
    description: "لا حاجة لسيرفرات محلية. النظام يعمل من أي مكان وفي أي وقت.",
  },
  {
    icon: Smartphone,
    title: "متجاوب 100%",
    description: "يعمل بسلاسة على الكمبيوتر والجوال والتابلت بنفس الكفاءة.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-background" dir="rtl">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-16 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent"
          >
            المميزات
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-3xl font-bold text-foreground md:text-4xl"
          >
            كل ما تحتاجه في منصة واحدة
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
          >
            مصمم خصيصاً للشركات السعودية مع مراعاة أعلى معايير الأمان والأداء
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group rounded-xl border border-border bg-card p-8 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <feature.icon size={22} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
