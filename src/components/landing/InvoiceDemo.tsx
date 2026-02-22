import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FileText, User, Package, CheckCircle2, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const InvoiceDemo = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);

  const reset = () => setStep(0);
  const startDemo = () => {
    setStep(1);
    setTimeout(() => setStep(2), 1200);
    setTimeout(() => setStep(3), 2400);
    setTimeout(() => setStep(4), 5500);
  };

  const steps = [
    { icon: User, title: t("landing.invoice.step1"), detail: t("landing.invoice.step1Detail"), minStep: 1 },
    { icon: Package, title: t("landing.invoice.step2"), detail: t("landing.invoice.step2Detail"), minStep: 2 },
  ];

  return (
    <section id="demo" className="py-16 sm:py-20 md:py-24 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground text-center"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.invoice.title")} <span className="text-gradient">{t("landing.invoice.titleHighlight")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground text-center"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.invoice.subtitle")}
          </motion.p>
        </div>

        {/* Stepper indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 max-w-md mx-auto">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-colors ${
                step >= s ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`h-0.5 flex-1 rounded-full transition-colors ${step >= s + 1 ? "bg-accent" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-elevated">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/40" />
                <div className="w-3 h-3 rounded-full bg-warning/40" />
                <div className="w-3 h-3 rounded-full bg-accent/60" />
              </div>
              <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-0.5 rounded-full mx-auto">
                {t("landing.invoice.demoLabel")}
              </span>
            </div>

            <div className="space-y-4 min-h-[280px]">
              {steps.map((s) => (
                <div key={s.title} className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-300 ${
                  step >= s.minStep ? "border-accent/30 bg-accent/5" : "border-border"
                }`}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
                    step >= s.minStep ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    <s.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <AnimatePresence>
                      {step >= s.minStep && (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-xs text-accent mt-0.5 truncate">
                          {s.detail}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  {step >= s.minStep && <CheckCircle2 size={18} className="text-accent shrink-0" />}
                </div>
              ))}

              {/* Step 3: Issuing */}
              <div className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-300 ${
                step >= 3 ? (step >= 4 ? "border-accent/30 bg-accent/5" : "border-warning/30 bg-warning/5") : "border-border"
              }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
                  step >= 4 ? "bg-accent text-accent-foreground" : step >= 3 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {step === 3 ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {step >= 4 ? t("landing.invoice.issued") : step === 3 ? t("landing.invoice.issuing") : t("landing.invoice.step3")}
                  </p>
                  <AnimatePresence>
                    {step === 3 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 3, ease: "easeInOut" }} className="h-full rounded-full bg-accent" />
                        </div>
                        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                          <span>{t("landing.invoice.xmlSign")}</span>
                          <span>{t("landing.invoice.qrCode")}</span>
                          <span>{t("landing.invoice.zatcaOk")}</span>
                        </div>
                      </motion.div>
                    )}
                    {step >= 4 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mt-1">
                        <Shield size={12} className="text-accent" />
                        <span className="text-xs text-accent">{t("landing.invoice.issuedDetail")}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {step >= 4 && <CheckCircle2 size={18} className="text-accent shrink-0" />}
              </div>
            </div>

            <div className="mt-6 text-center">
              {step === 0 ? (
                <Button onClick={startDemo} size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 min-h-[48px]">
                  {t("landing.invoice.startDemo")}
                </Button>
              ) : step >= 4 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button onClick={reset} variant="outline" size="lg" className="min-h-[48px]">
                    {t("landing.invoice.restart")}
                  </Button>
                </motion.div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvoiceDemo;
