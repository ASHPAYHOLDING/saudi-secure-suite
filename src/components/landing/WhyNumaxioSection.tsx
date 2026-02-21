import { motion } from "framer-motion";
import { CheckCircle2, X, Shield, Bot, Building2, Calculator } from "lucide-react";

const comparisons = [
  { feature: "ZATCA Phase 2 مدمج", numaxio: true, others: false },
  { feature: "إقرار ضريبي آلي", numaxio: true, others: false },
  { feature: "AI محاسبي مدمج", numaxio: true, others: false },
  { feature: "حوكمة مؤسسية سعودية", numaxio: true, others: false },
  { feature: "واجهة عربية أصلية RTL", numaxio: true, others: "جزئي" },
  { feature: "دعم Multi-Entity", numaxio: true, others: true },
  { feature: "تقارير مالية", numaxio: true, others: true },
];

const highlights = [
  { icon: Shield, title: "ZATCA Phase 2 جاهز", desc: "توقيع XML رقمي وتكامل مباشر مع بوابة هيئة الزكاة" },
  { icon: Calculator, title: "إقرار ضريبي آلي", desc: "حساب وإعداد إقرارات ضريبة القيمة المضافة تلقائياً" },
  { icon: Bot, title: "AI محاسبي", desc: "محاسب ذكي يحلل بياناتك ويكشف الشذوذ والأنماط" },
  { icon: Building2, title: "حوكمة مؤسسية", desc: "أدوار مسبقة التهيئة وسلاسل موافقات وسجل تدقيق شامل" },
];

const WhyNumaxioSection = () => {
  return (
    <section id="why" className="py-20 md:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            لماذا <span className="text-gradient">Numaxio</span>؟
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            مقارنة مباشرة مع الأنظمة العالمية — الفرق واضح
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

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-border bg-card shadow-card overflow-hidden max-w-3xl mx-auto"
        >
          <div className="grid grid-cols-3 text-center text-sm font-bold border-b border-border bg-muted/30">
            <div className="p-4 text-start text-foreground">الميزة</div>
            <div className="p-4 text-accent">Numaxio</div>
            <div className="p-4 text-muted-foreground">Zoho / Odoo</div>
          </div>
          {comparisons.map((row, i) => (
            <div key={i} className="grid grid-cols-3 text-center text-sm border-b border-border/50 last:border-b-0">
              <div className="p-3.5 text-start text-foreground">{row.feature}</div>
              <div className="p-3.5 flex items-center justify-center">
                {row.numaxio ? <CheckCircle2 size={18} className="text-accent" /> : <X size={18} className="text-muted-foreground/40" />}
              </div>
              <div className="p-3.5 flex items-center justify-center">
                {row.others === true ? (
                  <CheckCircle2 size={18} className="text-muted-foreground/60" />
                ) : row.others === false ? (
                  <X size={18} className="text-muted-foreground/40" />
                ) : (
                  <span className="text-xs text-amber-500 font-medium">{row.others}</span>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default WhyNumaxioSection;
