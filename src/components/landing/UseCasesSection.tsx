import { motion } from "framer-motion";
import { ShoppingBag, Briefcase, HardHat, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

const UseCasesSection = () => {
  const { t } = useTranslation();

  const cases = [
    { icon: ShoppingBag, title: t("landing.useCases.trade"), desc: t("landing.useCases.tradeDesc") },
    { icon: Briefcase, title: t("landing.useCases.services"), desc: t("landing.useCases.servicesDesc") },
    { icon: HardHat, title: t("landing.useCases.construction"), desc: t("landing.useCases.constructionDesc") },
  ];

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Layers size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">{t("landing.useCases.badge")}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground text-center"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.useCases.title")} <span className="text-gradient">{t("landing.useCases.titleHighlight")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground text-center"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.useCases.subtitle")}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {cases.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 hover:border-accent/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent mb-4 transition-colors group-hover:bg-accent/20">
                <c.icon size={24} />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
