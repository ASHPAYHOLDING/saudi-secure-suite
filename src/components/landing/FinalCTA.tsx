import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const FinalCTA = () => {
  const { t } = useTranslation();

  const assurances = [
    { icon: CheckCircle2, text: t("landing.finalCta.assurance1") },
    { icon: Shield, text: t("landing.finalCta.assurance2") },
    { icon: Zap, text: t("landing.finalCta.assurance3") },
  ];

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(220 30% 8%) 0%, hsl(220 35% 16%) 50%, hsl(172 40% 18%) 100%)" }}
        >
          <div className="relative p-8 md:p-16 lg:p-20 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-bold text-primary-foreground mb-5 leading-tight"
              style={{ fontSize: "clamp(22px, 3vw, 42px)" }}
            >
              {t("landing.finalCta.title")} <span className="text-accent">{t("landing.finalCta.titleHighlight")}</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto"
              style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
            >
              {t("landing.finalCta.subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-6 mb-10"
            >
              {assurances.map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-sm text-primary-foreground/80">
                  <item.icon size={16} className="text-accent" />
                  {item.text}
                </div>
              ))}
            </motion.div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-12 min-h-[48px] text-base font-bold rounded-xl">
                  {t("landing.finalCta.cta")}
                  <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
                </Button>
              </Link>
              <a href="#contact">
                <Button size="lg" className="border border-primary-foreground/20 bg-primary-foreground/[0.08] text-primary-foreground hover:bg-primary-foreground/[0.15] px-8 min-h-[48px] text-base backdrop-blur-sm rounded-xl">
                  {t("landing.finalCta.ctaSales")}
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
