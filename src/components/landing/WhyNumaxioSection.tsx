import { motion } from "framer-motion";
import { Shield, Bot, Building2, Calculator } from "lucide-react";
import { useTranslation } from "react-i18next";

const WhyNumaxioSection = () => {
  const { t } = useTranslation();

  const highlights = [
    { icon: Shield, title: t("landing.why.h1title"), desc: t("landing.why.h1desc") },
    { icon: Calculator, title: t("landing.why.h2title"), desc: t("landing.why.h2desc") },
    { icon: Bot, title: t("landing.why.h3title"), desc: t("landing.why.h3desc") },
    { icon: Building2, title: t("landing.why.h4title"), desc: t("landing.why.h4desc") },
  ];

  return (
    <section id="why" className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.why.title")} <span className="text-gradient">{t("landing.why.titleBrand")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.why.subtitle")}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {highlights.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 hover:border-accent/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-3 transition-colors group-hover:bg-accent/20">
                <h.icon size={20} className="text-accent" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{h.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyNumaxioSection;
