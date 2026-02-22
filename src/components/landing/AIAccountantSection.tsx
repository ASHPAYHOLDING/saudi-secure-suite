import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles, Shield, ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const AIAccountantSection = () => {
  const { t } = useTranslation();
  const [activeChip, setActiveChip] = useState(0);

  const chips = [
    { label: t("landing.aiSection.chip1"), response: t("landing.aiSection.response1") },
    { label: t("landing.aiSection.chip2"), response: t("landing.aiSection.response2") },
    { label: t("landing.aiSection.chip3"), response: t("landing.aiSection.response3") },
  ];

  const capabilities = [
    { icon: TrendingUp, text: t("landing.aiSection.profitAnalysis") },
    { icon: AlertTriangle, text: t("landing.aiSection.anomalyDetection") },
    { icon: Shield, text: t("landing.aiSection.taxAlerts") },
  ];

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Chat UI */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <div className="rounded-2xl border border-border bg-card shadow-elevated p-5 max-w-lg mx-auto">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
                  <Bot size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{t("landing.aiSection.chatName")}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                    <span className="text-[11px] text-muted-foreground">{t("landing.aiSection.connected")}</span>
                  </div>
                </div>
              </div>

              {/* Chip question */}
              <div className="space-y-3 min-h-[160px]">
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-accent/10 text-foreground">
                    <p>{chips[activeChip].label}</p>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeChip}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-muted text-foreground">
                      <p className="whitespace-pre-line">{chips[activeChip].response}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Quick chips */}
              <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveChip(i)}
                    className={`text-[11px] rounded-full px-3 py-1.5 font-medium transition-colors min-h-[32px] ${
                      activeChip === i
                        ? "bg-accent text-accent-foreground"
                        : "bg-accent/10 text-accent hover:bg-accent/20"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
                {t("landing.aiSection.disclaimer")}
              </p>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-sm font-semibold text-accent">{t("landing.aiSection.badge")}</span>
            </div>
            <h2 className="font-bold text-foreground leading-tight" style={{ fontSize: "clamp(22px, 3vw, 36px)" }}>
              {t("landing.aiSection.title")}
              <br />
              <span className="text-gradient">{t("landing.aiSection.titleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-md" style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}>
              {t("landing.aiSection.subtitle")}
            </p>

            <div className="flex flex-wrap gap-3">
              {capabilities.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 min-h-[44px]">
                  <c.icon size={14} className="text-accent" />
                  <span className="text-xs font-medium text-foreground">{c.text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5">
              <Shield size={14} className="text-accent shrink-0" />
              <span className="text-xs text-muted-foreground">{t("landing.aiSection.accessNote")}</span>
            </div>

            <Link to="/auth">
              <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 min-h-[48px] text-base font-bold rounded-xl">
                {t("landing.aiSection.tryCta")}
                <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AIAccountantSection;
