import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Crown, ShieldCheck, GitBranch, KeyRound, Gauge, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const EnterpriseGovernanceSection = () => {
  const { t } = useTranslation();

  const roles = [
    { name: t("landing.governance.accountant"), nameEn: "Accountant" },
    { name: t("landing.governance.cfo"), nameEn: "CFO" },
    { name: t("landing.governance.auditor"), nameEn: "Auditor" },
    { name: t("landing.governance.cashier"), nameEn: "Cashier" },
  ];

  const features = [
    { icon: GitBranch, title: t("landing.governance.approvals"), desc: t("landing.governance.approvalsDesc") },
    { icon: ShieldCheck, title: t("landing.governance.auditLog"), desc: t("landing.governance.auditLogDesc") },
    { icon: KeyRound, title: t("landing.governance.multiEntity"), desc: t("landing.governance.multiEntityDesc") },
    { icon: Gauge, title: t("landing.governance.complianceScore"), desc: t("landing.governance.complianceScoreDesc") },
  ];

  const approvalSteps = [
    t("landing.governance.step1"),
    t("landing.governance.step2"),
    t("landing.governance.step3"),
  ];

  return (
    <section className="py-16 sm:py-20 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom right, hsl(220 30% 8%), hsl(220 35% 12%), hsl(220 30% 8%))" }} />

      <div className="max-w-6xl relative mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2"
          >
            <Building2 size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">{t("landing.governance.badge")}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-primary-foreground text-center"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.governance.title")} <span className="text-gradient">{t("landing.governance.titleHighlight")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-primary-foreground/70 text-center"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.governance.subtitle")}
          </motion.p>
        </div>

        {/* Role templates */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          {roles.map((role, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 rounded-xl border border-primary-foreground/[0.08] bg-primary-foreground/[0.03] px-5 py-3 min-h-[44px]"
            >
              <Crown size={14} className="text-accent" />
              <div>
                <p className="text-sm font-bold text-primary-foreground">{role.name}</p>
                <p className="text-[10px] text-primary-foreground/40 font-english" dir="ltr">{role.nameEn}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Approval Flow Mini-Visual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-sm mx-auto mb-12 rounded-2xl border border-primary-foreground/[0.08] bg-primary-foreground/[0.03] p-6"
        >
          <p className="text-xs font-bold text-accent mb-4 text-center">{t("landing.governance.approvalFlow")}</p>
          <div className="flex items-center justify-center gap-2">
            {approvalSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
                    <span className="text-xs font-bold text-accent">{i + 1}</span>
                  </div>
                  <span className="text-[10px] text-primary-foreground/60">{step}</span>
                </div>
                {i < approvalSteps.length - 1 && (
                  <ArrowLeft size={14} className="text-accent/40 rtl-mirror shrink-0 mb-4" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Features grid */}
        <div className="grid gap-5 sm:grid-cols-2 max-w-4xl mx-auto mb-12">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-primary-foreground/[0.08] bg-primary-foreground/[0.03] backdrop-blur-sm p-6 transition-all hover:border-accent/20 hover:bg-primary-foreground/[0.05]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 mb-4">
                <f.icon size={18} className="text-accent" />
              </div>
              <h3 className="text-base font-bold text-primary-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-primary-foreground/70">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-sm p-6 text-center"
        >
          <p className="text-sm text-accent mb-4">{t("landing.governance.enterpriseNote")}</p>
          <Link to="/auth">
            <Button size="lg" className="gradient-accent text-accent-foreground font-bold px-10 min-h-[48px] text-base shadow-accent-glow rounded-xl">
              {t("landing.governance.enterpriseCta")}
              <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default EnterpriseGovernanceSection;
