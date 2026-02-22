import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, FileText, CheckCircle2, Calculator, Gauge, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

const ZATCAComplianceSection = () => {
  const { t } = useTranslation();

  const phases = [
    {
      title: t("landing.compliance.phase1"),
      subtitle: t("landing.compliance.phase1Sub"),
      icon: FileText,
      items: [t("landing.compliance.phase1_1"), t("landing.compliance.phase1_2"), t("landing.compliance.phase1_3"), t("landing.compliance.phase1_4")],
    },
    {
      title: t("landing.compliance.phase2"),
      subtitle: t("landing.compliance.phase2Sub"),
      icon: Shield,
      items: [t("landing.compliance.phase2_1"), t("landing.compliance.phase2_2"), t("landing.compliance.phase2_3"), t("landing.compliance.phase2_4")],
    },
  ];

  // Compliance checklist
  const checklistItems = [
    { label: "ZATCA Phase 2", default: true },
    { label: "VAT Auto-calc", default: true },
    { label: "XML Signing", default: true },
    { label: "QR/TLV", default: false },
    { label: "Digital Certificates", default: false },
  ];

  const [checked, setChecked] = useState<boolean[]>(checklistItems.map(c => c.default));
  const toggleCheck = (i: number) => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v));
  const score = Math.round((checked.filter(Boolean).length / checked.length) * 100);

  return (
    <section id="compliance" className="py-16 sm:py-20 md:py-24 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Shield size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">{t("landing.compliance.badge")}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground text-center"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.compliance.title")} <span className="text-gradient">{t("landing.compliance.titleHighlight")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground text-center"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.compliance.subtitle")}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
          {phases.map((phase, i) => (
            <motion.div
              key={phase.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <phase.icon size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{phase.title}</h3>
                  <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {phase.items.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 size={14} className="text-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Compliance Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto rounded-2xl border border-border bg-card p-6 shadow-card mb-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground">{t("landing.compliance.checklistTitle")}</h4>
            <span className={`text-sm font-bold ${score >= 80 ? "text-accent" : "text-warning"}`}>{score}%</span>
          </div>
          <div className="space-y-2">
            {checklistItems.map((item, i) => (
              <button
                key={item.label}
                onClick={() => toggleCheck(i)}
                className="flex items-center gap-3 w-full text-start py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors min-h-[44px]"
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                  checked[i] ? "bg-accent border-accent" : "border-border"
                }`}>
                  {checked[i] && <Check size={12} className="text-accent-foreground" />}
                </div>
                <span className={`text-sm ${checked[i] ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <Gauge size={22} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("landing.compliance.scoreTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("landing.compliance.scoreDesc")}</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <Calculator size={22} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{t("landing.compliance.vatTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("landing.compliance.vatDesc")}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ZATCAComplianceSection;
