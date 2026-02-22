import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Shield, Bot, Building2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const kpis = [
  { labelKey: "الإيرادات الشهرية", value: "٢٤٥,٠٠٠ ﷼", trend: "+12%" },
  { labelKey: "صافي الربح", value: "١٦٢,٦٠٠ ﷼", trend: "+8%" },
  { labelKey: "DSO", value: "٢٣ يوم", trend: "-3" },
  { labelKey: "درجة الامتثال", value: "٩٤٪", trend: "A+" },
];

const DashboardMock = () => (
  <div className="relative rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm shadow-2xl p-4 lg:p-5">
    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
        <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
        <div className="w-2.5 h-2.5 rounded-full bg-accent/60" />
      </div>
      <div className="flex-1 text-center">
        <span className="text-[10px] text-white/50 bg-white/5 px-3 py-0.5 rounded-full font-english" dir="ltr">
          app.numaxio.com/dashboard
        </span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 lg:gap-3 mb-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.labelKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + i * 0.1 }}
          className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-2.5 lg:p-3"
        >
          <p className="text-[10px] text-white/60 mb-1">{kpi.labelKey}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-white/90 text-xs lg:text-sm">{kpi.value}</span>
            <span className="text-[10px] font-semibold text-accent">{kpi.trend}</span>
          </div>
        </motion.div>
      ))}
    </div>

    <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 mb-3">
      <Shield size={14} className="text-accent" />
      <span className="text-[11px] text-accent font-medium">ZATCA Phase 2 — متوافق ✓</span>
      <span className="ms-auto text-[10px] text-accent/80">آخر مزامنة: الآن</span>
    </div>

    <div className="rounded-xl bg-white/[0.08] border border-accent/20 p-3">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={12} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-accent font-semibold mb-0.5">توصية AI</p>
          <p className="text-[11px] text-white/80 leading-relaxed">
            لاحظت ارتفاع DSO بمقدار 3 أيام. يُوصى بتفعيل التحصيل الذكي لـ 4 عملاء متأخرين.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const BadgeCarousel = () => {
  const { t } = useTranslation();
  const items = [
    t("landing.hero.carousel1"),
    t("landing.hero.carousel2"),
    t("landing.hero.carousel3"),
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 3000);
    return () => clearInterval(timer);
  }, [items.length]);

  return (
    <div className="h-6 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-inline-0 text-xs text-white/80 font-medium"
        >
          {items[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

const HeroSection = () => {
  const { t } = useTranslation();

  const trustBadges = [
    { icon: Shield, label: t("landing.hero.trustZatca") },
    { icon: Bot, label: t("landing.hero.trustAi") },
    { icon: Building2, label: t("landing.hero.trustGov") },
    { icon: Server, label: t("landing.hero.trustHost") },
  ];

  return (
    <section className="relative gradient-hero overflow-hidden min-h-[70vh] lg:min-h-screen">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 0h60v60H0z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[10%] end-[10%] w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(172 66% 50% / 0.12), transparent 70%)" }}
        />
      </div>

      <div className="max-w-6xl relative mx-auto flex items-center px-4 sm:px-6 lg:px-8 pt-24 pb-16 z-20 min-h-[inherit]">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
          <div className="space-y-6 md:space-y-8 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-xs font-semibold text-accent">
                  {t("landing.hero.badge")}
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-bold text-white"
              style={{ fontSize: "clamp(24px, 4vw, 52px)", lineHeight: 1.3, overflowWrap: "anywhere" }}
            >
              <span className="text-accent">{t("landing.hero.title1")}</span>
              <br />
              <span>{t("landing.hero.title2")}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-lg text-white/90"
              style={{ fontSize: "clamp(14px, 1.5vw, 18px)", lineHeight: 1.8 }}
            >
              {t("landing.hero.subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-8 sm:px-10 min-h-[48px] text-base font-bold rounded-xl w-full sm:w-auto">
                  {t("landing.hero.cta")}
                  <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" className="border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.15] px-8 min-h-[48px] text-base backdrop-blur-sm gap-2 rounded-xl w-full sm:w-auto">
                  <Play size={16} className="fill-current" />
                  {t("landing.hero.ctaDemo")}
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-3 sm:gap-4 pt-2"
            >
              {trustBadges.map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3 py-2 min-h-[44px]">
                  <item.icon size={14} className="text-accent shrink-0" />
                  <span className="text-xs text-white font-medium whitespace-nowrap">{item.label}</span>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <BadgeCarousel />
            </motion.div>
          </div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden md:block"
          >
            <DashboardMock />
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-inline-0">
        <svg viewBox="0 0 1440 80" className="w-full h-auto block" preserveAspectRatio="none">
          <path fill="hsl(var(--background))" d="M0,50 C360,80 720,30 1080,50 C1260,65 1380,40 1440,50 L1440,80 L0,80 Z" />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
