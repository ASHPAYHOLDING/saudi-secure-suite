import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialHealthScoreProps {
  collectionRate: number;
  profitMargin: number;
  overdueRatio: number;
  expenseRatio: number;
}

const FinancialHealthScore = ({
  collectionRate,
  profitMargin,
  overdueRatio,
  expenseRatio,
}: FinancialHealthScoreProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Calculate composite score (0-100)
  const score = Math.round(
    Math.min(100, Math.max(0,
      (collectionRate * 0.3) +
      (Math.max(0, Math.min(100, profitMargin + 50)) * 0.3) +
      (Math.max(0, 100 - overdueRatio * 10) * 0.2) +
      (Math.max(0, 100 - expenseRatio) * 0.2)
    ))
  );

  useEffect(() => {
    let frame: number;
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const getScoreColor = (s: number) => {
    if (s >= 75) return { text: "text-success", bg: "bg-success", label: "ممتاز" };
    if (s >= 50) return { text: "text-warning", bg: "bg-warning", label: "جيد" };
    return { text: "text-destructive", bg: "bg-destructive", label: "يحتاج تحسين" };
  };

  const { text, bg, label } = getScoreColor(score);
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const metrics = [
    { label: "التحصيل", value: collectionRate, suffix: "%", good: collectionRate >= 70 },
    { label: "هامش الربح", value: Math.round(profitMargin), suffix: "%", good: profitMargin >= 20 },
    { label: "نسبة التأخر", value: Math.round(overdueRatio), suffix: "%", good: overdueRatio <= 10 },
    { label: "نسبة المصروفات", value: Math.round(expenseRatio), suffix: "%", good: expenseRatio <= 70 },
  ];

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
            <Heart className="w-3.5 h-3.5 text-accent" />
          </div>
          الصحة المالية
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Circular gauge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative shrink-0"
          >
            <svg width="110" height="110" viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <motion.circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={`hsl(var(--${score >= 75 ? 'success' : score >= 50 ? 'warning' : 'destructive'}))`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold tabular-nums", text)}>{animatedScore}</span>
              <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
            </div>
          </motion.div>

          {/* Metrics breakdown */}
          <div className="flex-1 w-full grid grid-cols-2 gap-2.5">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/20"
              >
                <div className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                  m.good ? "bg-success/10" : "bg-destructive/10"
                )}>
                  {m.good
                    ? <TrendingUp className="w-3 h-3 text-success" />
                    : <TrendingDown className="w-3 h-3 text-destructive" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{m.label}</p>
                  <p className="text-xs font-bold tabular-nums text-foreground">{m.value}{m.suffix}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialHealthScore;
