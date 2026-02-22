import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Zap, Shield, Clock, Building2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const AnimatedCounter = ({ target, suffix, inView }: { target: number; suffix: string; inView: boolean }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1800;
    const steps = 50;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.round(current * 10) / 10);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span className="tabular-nums font-english">
      {target % 1 !== 0 ? count.toFixed(1) : Math.round(count)}
      {suffix}
    </span>
  );
};

interface Metric {
  icon: LucideIcon;
  value: number;
  suffix: string;
  label: string;
  color: string;
}

const PowerStrip = () => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const metrics: Metric[] = [
    { icon: Shield, value: 100, suffix: "%", label: t("landing.kpis.zatcaReady"), color: "text-emerald-400" },
    { icon: Clock, value: 10, suffix: "s", label: t("landing.kpis.invoiceSpeed"), color: "text-sky-400" },
    { icon: Building2, value: 1200, suffix: "+", label: t("landing.kpis.companies"), color: "text-violet-400" },
    { icon: Zap, value: 99.9, suffix: "%", label: t("landing.kpis.uptime"), color: "text-amber-400" },
  ];

  return (
    <section ref={ref} className="relative py-16 md:py-20 bg-white overflow-hidden">

      <div className="relative max-w-5xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5, ease: "easeOut" }}
              className="group relative rounded-2xl border border-border/60 bg-muted/30 p-6 md:p-7 text-center transition-colors duration-300 hover:border-border hover:bg-muted/50"
            >
              {/* Icon */}
              <div className={`mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 ${m.color} transition-transform duration-300 group-hover:scale-110`}>
                <m.icon size={20} strokeWidth={1.8} />
              </div>

              {/* Value */}
              <p className="text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-none mb-1.5">
                <AnimatedCounter target={m.value} suffix={m.suffix} inView={isInView} />
              </p>

              {/* Label */}
              <p className="text-sm text-muted-foreground leading-snug">{m.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PowerStrip;
