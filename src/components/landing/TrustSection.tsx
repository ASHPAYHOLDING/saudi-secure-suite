import { motion } from "framer-motion";
import { Star, Quote, Shield } from "lucide-react";

const testimonials = [
  {
    name: "م. عبدالله الشهراني",
    role: "مدير مالي — شركة تقنية",
    content: "نيوماكسيو وفّر علينا 80% من وقت إعداد الفواتير. الامتثال التلقائي مع ZATCA كان السبب الرئيسي لاختيارنا.",
    rating: 5,
  },
  {
    name: "أ. نورة القحطاني",
    role: "محاسبة أولى — مجموعة تجارية",
    content: "أفضل نظام ERP عربي استخدمته. التقارير المالية والذكاء الاصطناعي المدمج غيّر طريقة عملنا بالكامل.",
    rating: 5,
  },
  {
    name: "أ. فهد الدوسري",
    role: "صاحب مؤسسة — قطاع الاستشارات",
    content: "من أول يوم أصدرنا فواتير احترافية بختم إلكتروني. الدعم الفني السعودي ممتاز — يردون بالثواني.",
    rating: 5,
  },
];

const logos = ["stc", "أرامكو", "الراجحي", "البنك الأهلي", "NEOM", "STC Pay"];

const TrustSection = () => {
  return (
    <section className="py-24 md:py-32 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        {/* Trust logos */}
        <div className="mb-16 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-xs text-muted-foreground uppercase tracking-widest mb-6"
          >
            موثوق من شركات سعودية رائدة
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-center gap-8 md:gap-12 flex-wrap"
          >
            {logos.map((logo, i) => (
              <motion.div
                key={logo}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="px-4 py-2 rounded-lg bg-muted/30 border border-border/50"
              >
                <span className="text-sm font-medium text-muted-foreground/60">{logo}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Testimonials header */}
        <div className="mb-14 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Star size={14} className="text-accent fill-accent" />
            <span className="text-sm font-semibold text-accent">آراء عملائنا</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-foreground md:text-5xl"
          >
            ماذا يقول عملاؤنا
          </motion.h2>
        </div>

        {/* Testimonial cards */}
        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ y: -6 }}
              className="rounded-2xl border border-border bg-card p-8 shadow-card transition-shadow hover:shadow-elevated"
            >
              <Quote size={28} className="text-accent/20 mb-4" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed text-foreground mb-6">"{t.content}"</p>
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-accent text-accent-foreground text-sm font-bold">
                    {t.name.split(" ").pop()?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
