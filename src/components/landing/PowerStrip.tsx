import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Zap, Shield, Clock, Building2 } from "lucide-react";

const metrics = [
  { icon: Clock, value: 10, suffix: "s", label: "إصدار فاتورة", color: "text-accent" },
  { icon: Shield, value: 100, suffix: "%", label: "ZATCA Phase 2", color: "text-emerald-500" },
  { icon: Zap, value: 99.9, suffix: "%", label: "وقت التشغيل", color: "text-blue-500" },
  { icon: Building2, value: 1200, suffix: "+", label: "منشأة سعودية", color: "text-amber-500" },
];

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
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section className="py-6 bg-background border-y border-border/50" dir="rtl" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="flex items-center gap-3 justify-center py-3"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 ${m.color}`}>
                <m.icon size={18} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${m.color}`}>
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
