import { motion } from "framer-motion";
import { FileText, Wallet, Package, BarChart3, Bot, Building2, ArrowLeft, Users, ShoppingCart, Calculator } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ERPModulesSection = () => {
  const { t } = useTranslation();

  const modules = [
    { icon: FileText, title: t("landing.modules.invoices"), desc: t("landing.modules.invoicesDesc") },
    { icon: Users, title: t("landing.modules.clients"), desc: t("landing.modules.clientsDesc") },
    { icon: Wallet, title: t("landing.modules.expenses"), desc: t("landing.modules.expensesDesc") },
    { icon: Package, title: t("landing.modules.inventory"), desc: t("landing.modules.inventoryDesc") },
    { icon: ShoppingCart, title: t("landing.modules.orders"), desc: t("landing.modules.ordersDesc") },
    { icon: Calculator, title: t("landing.modules.journal"), desc: t("landing.modules.journalDesc") },
    { icon: BarChart3, title: t("landing.modules.reports"), desc: t("landing.modules.reportsDesc") },
    { icon: Bot, title: t("landing.modules.ai"), desc: t("landing.modules.aiDesc") },
    { icon: Building2, title: t("landing.modules.governance"), desc: t("landing.modules.governanceDesc") },
  ];

  return (
    <section id="features" className="py-16 sm:py-20 md:py-24 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Package size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">{t("landing.modules.badge")}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.modules.title")} <span className="text-gradient">{t("landing.modules.titleHighlight")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.modules.subtitle")}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {modules.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1 hover:border-accent/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent mb-4 transition-colors group-hover:bg-accent/20">
                <m.icon size={22} />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
              <Link to="/auth" className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1 min-h-[44px]">
                {t("landing.modules.explore")}
                <ArrowLeft size={14} className="rtl-mirror" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ERPModulesSection;
