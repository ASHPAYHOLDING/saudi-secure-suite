import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, FileText, Users, Wallet, Package, ShoppingCart, Calculator, BarChart3, Bot, Building2, CheckCircle2, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/hooks/useLanguage";

const MODULE_ICONS: Record<string, any> = {
  invoices: FileText,
  clients: Users,
  expenses: Wallet,
  inventory: Package,
  orders: ShoppingCart,
  journal: Calculator,
  reports: BarChart3,
  ai: Bot,
  governance: Building2,
};

const MODULE_KEYS = ["invoices", "clients", "expenses", "inventory", "orders", "journal", "reports", "ai", "governance"];

const ModulePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  if (!slug || !MODULE_KEYS.includes(slug)) {
    return <div className="min-h-screen flex items-center justify-center text-foreground">404</div>;
  }

  const Icon = MODULE_ICONS[slug];
  const title = t(`modulePage.${slug}.title`);
  const subtitle = t(`modulePage.${slug}.subtitle`);
  const features: string[] = [
    t(`modulePage.${slug}.f1`),
    t(`modulePage.${slug}.f2`),
    t(`modulePage.${slug}.f3`),
    t(`modulePage.${slug}.f4`),
    t(`modulePage.${slug}.f5`),
    t(`modulePage.${slug}.f6`),
  ];
  const benefitTitle = t(`modulePage.${slug}.benefitTitle`);
  const benefits: string[] = [
    t(`modulePage.${slug}.b1`),
    t(`modulePage.${slug}.b2`),
    t(`modulePage.${slug}.b3`),
  ];

  const currentIdx = MODULE_KEYS.indexOf(slug);
  const prevModule = currentIdx > 0 ? MODULE_KEYS[currentIdx - 1] : null;
  const nextModule = currentIdx < MODULE_KEYS.length - 1 ? MODULE_KEYS[currentIdx + 1] : null;

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <>
      <Helmet>
        <title>{title} — Numaxio ERP</title>
        <meta name="description" content={subtitle} />
      </Helmet>
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Navbar />
        <main>
          {/* Hero */}
          <section className="pt-24 pb-16 sm:pt-32 sm:pb-20 bg-secondary/30">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <Link to="/#features" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
                <BackArrow size={16} />
                {t("modulePage.backToModules")}
              </Link>

              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 text-accent mb-6"
                >
                  <Icon size={40} />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="font-bold text-foreground mb-4"
                  style={{ fontSize: "clamp(28px, 4vw, 48px)" }}
                >
                  {title}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="max-w-2xl text-muted-foreground leading-relaxed"
                  style={{ fontSize: "clamp(16px, 1.5vw, 20px)" }}
                >
                  {subtitle}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-8"
                >
                  <Button asChild size="lg" className="min-h-[48px] px-8 text-base">
                    <Link to="/auth">{t("modulePage.tryCta")}</Link>
                  </Button>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Features grid */}
          <section className="py-16 sm:py-20 md:py-24">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center font-bold text-foreground mb-12"
                style={{ fontSize: "clamp(22px, 3vw, 32px)" }}
              >
                {t("modulePage.featuresHeading")}
              </motion.h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <Zap size={18} className="text-accent" />
                      </div>
                      <p className="text-foreground font-medium leading-relaxed">{f}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Benefits */}
          <section className="py-16 sm:py-20 md:py-24 bg-secondary/30">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2 mb-6"
                >
                  <Shield size={14} className="text-accent" />
                  <span className="text-sm font-semibold text-accent">{benefitTitle}</span>
                </motion.div>

                <div className="space-y-4 mt-8">
                  {benefits.map((b, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 rounded-xl bg-card border border-border p-4"
                    >
                      <CheckCircle2 size={20} className="text-accent flex-shrink-0" />
                      <p className="text-foreground font-medium">{b}</p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  className="mt-10"
                >
                  <Button asChild size="lg" className="min-h-[48px] px-8 text-base">
                    <Link to="/auth">{t("modulePage.startNow")}</Link>
                  </Button>
                </motion.div>
              </div>
            </div>
          </section>

          {/* Module navigation */}
          <section className="py-12 border-t border-border">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              {prevModule ? (
                <Link
                  to={`/modules/${prevModule}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <BackArrow size={16} />
                  {t(`landing.modules.${prevModule}`)}
                </Link>
              ) : <div />}
              {nextModule ? (
                <Link
                  to={`/modules/${nextModule}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t(`landing.modules.${nextModule}`)}
                  {isRTL ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                </Link>
              ) : <div />}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default ModulePage;
