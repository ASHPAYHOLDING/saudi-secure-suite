import { motion } from "framer-motion";
import { Shield, Lock, Server, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const SecurityStrip = () => {
  const { t } = useTranslation();

  const items = [
    { icon: Server, text: t("landing.security.hosting") },
    { icon: Lock, text: t("landing.security.encryption") },
    { icon: Shield, text: t("landing.security.zatca") },
    { icon: CheckCircle2, text: t("landing.security.backup") },
  ];

  return (
    <section className="py-10 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-10"
        >
          {items.map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 min-h-[44px]">
              <item.icon size={16} className="text-accent shrink-0" />
              <span className="text-xs sm:text-sm text-foreground font-medium">{item.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default SecurityStrip;
