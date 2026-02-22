import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Zap, Shield, Clock, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const AnimatedCounter = ({ target, suffix, inView }: { target: number; suffix: string; inView: boolean }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const steps = 40;
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

const PowerStrip = () => {
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const metrics = [
    { icon: Clock, value: 10, suffix: "s", label: t("landing.kpis.invoiceSpeed") },
    { icon: Shield, value: 100, suffix: "%", label: t("landing.kpis.zatcaReady") },
    { icon: Zap, value: 99.9, suffix: "%", label: t("landing.kpis.uptime") },
    { icon: Building2, value: 1200, suffix: "+", label: t("landing.kpis.companies") },
  ];

  return (
    <section className="py-6 bg-background border-y border-border/50" ref={ref}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="flex items-center gap-3 justify-center py-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <m.icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-bold text-accent">
                  <AnimatedCounter target={m.value} suffix={m.suffix} inView={isInView} />
                </p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PowerStrip;
