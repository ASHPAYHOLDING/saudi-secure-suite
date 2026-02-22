import { motion } from "framer-motion";
import { Shield, Bot, Building2, Calculator, CheckCircle2, FileText, BarChart3 } from "lucide-react";

const highlights = [
  { icon: Shield, title: "جاهزية فورية للامتثال", desc: "ابدأ متوافقاً مع ZATCA من اليوم الأول — بدون إعدادات معقدة" },
  { icon: Calculator, title: "إقرار ضريبي بلا تدخل", desc: "حساب تلقائي لضريبة القيمة المضافة مع تنبيهات مواعيد الإقرار" },
  { icon: Bot, title: "رؤية مالية واضحة", desc: "ذكاء محاسبي يحلل بياناتك ويكشف الأنماط قبل أن تسأل" },
  { icon: Building2, title: "إعدادات أقل، إنتاجية أكثر", desc: "أدوار جاهزة وسلاسل موافقات مسبقة — فعّل وابدأ فوراً" },
];

const comparisons = [
  { feature: "فاتورة ZATCA Phase 2", available: true },
  { feature: "إقرار ضريبي تلقائي", available: true },
  { feature: "ذكاء محاسبي مدمج", available: true },
  { feature: "حوكمة مؤسسية", available: true },
  { feature: "تقارير تنفيذية", available: true },
  { feature: "Multi-Entity", available: true },
];

const WhyNumaxioSection = () => {
  return (
    <section id="why" className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            لماذا <span className="text-gradient">Numaxio؟</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            نظام واحد يربط الفوترة، الامتثال، والحوكمة — بدلاً من أدوات متفرقة وإعدادات لا تنتهي
          </motion.p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          {highlights.map((h, i) => (
            <motion.div
              key={h.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-3">
                <h.icon size={20} className="text-accent" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{h.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Feature table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-border bg-card shadow-card overflow-hidden max-w-2xl mx-auto"
        >
          <div className="grid grid-cols-[1fr_auto] text-sm font-bold border-b border-border bg-muted/30">
            <div className="p-4 text-foreground">الميزة</div>
            <div className="p-4 text-accent text-center min-w-[100px]">Numaxio</div>
          </div>
          {comparisons.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] text-sm border-b border-border/50 last:border-b-0">
              <div className="p-3.5 text-foreground">{row.feature}</div>
              <div className="p-3.5 flex items-center justify-center min-w-[100px]">
                <CheckCircle2 size={16} className="text-accent" />
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default WhyNumaxioSection;
