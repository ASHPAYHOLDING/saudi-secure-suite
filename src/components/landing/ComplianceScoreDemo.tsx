import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, CheckCircle2 } from "lucide-react";

const steps = [
  { label: "تسجيل ضريبي", points: 20 },
  { label: "فوترة إلكترونية", points: 22 },
  { label: "فصل مهام", points: 15 },
  { label: "سجل تدقيق", points: 10 },
  { label: "إقفال فترات", points: 11 },
];

const ComplianceScoreDemo = () => {
  const [enabled, setEnabled] = useState<boolean[]>(steps.map((_, i) => i < 3));

  const score = steps.reduce((sum, s, i) => sum + (enabled[i] ? s.points : 0), 0);

  const toggle = (index: number) => {
    setEnabled((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const barColor = score >= 90 ? "bg-emerald-500" : score >= 70 ? "bg-accent" : "bg-amber-500";

  return (
    <section className="py-20 md:py-28 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-10 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-bold text-foreground mb-3"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            درجة الامتثال <span className="text-gradient">التفاعلية</span>
          </motion.h2>
          <p className="text-muted-foreground mx-auto max-w-lg" style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}>
            فعّل عناصر الامتثال وشاهد درجتك ترتفع فوراً
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card"
        >
          {/* Score display */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <Shield size={20} className="text-accent" />
              </div>
              <span className="text-sm font-bold text-foreground">Compliance Score</span>
            </div>
            <span className="text-2xl font-bold text-foreground">{score}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full bg-muted mb-6 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Toggleable checklist */}
          <div className="space-y-3">
            {steps.map((step, i) => (
              <button
                key={step.label}
                onClick={() => toggle(i)}
                className="flex items-center gap-3 w-full text-start rounded-xl border border-border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <CheckCircle2
                  size={18}
                  className={enabled[i] ? "text-accent" : "text-muted-foreground/30"}
                />
                <span className={`text-sm font-medium ${enabled[i] ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                <span className="ms-auto text-xs text-muted-foreground">+{step.points}%</span>
              </button>
            ))}
          </div>

          {score >= 90 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5"
            >
              <Shield size={16} className="text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">جاهز للتدقيق — Audit Ready</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ComplianceScoreDemo;
