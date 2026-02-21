import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Bot, ArrowLeft, Sparkles, Shield, TrendingUp, AlertTriangle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

const capabilities = [
  { icon: TrendingUp, label: "تصنيف المصروفات تلقائياً" },
  { icon: AlertTriangle, label: "كشف الشذوذ والأنماط المشبوهة" },
  { icon: Bell, label: "تنبيهات ضريبية واستباقية" },
];

const messages = [
  { role: "user" as const, text: "كيف أرباحي هذا الشهر؟" },
  { role: "ai" as const, text: "صافي الربح ١٦٢,٦٠٠ ﷼ — انخفاض ١٢٪ مقارنة بالشهر الماضي بسبب ارتفاع المصاريف التشغيلية. أنصح بمراجعة بند الإيجارات." },
  { role: "user" as const, text: "ما هي أعلى 3 مصاريف؟" },
  { role: "ai" as const, text: "1. رواتب: ٤٥,٠٠٠ ﷼\n2. إيجار: ١٢,٠٠٠ ﷼\n3. تسويق رقمي: ٨,٥٠٠ ﷼ (+٤٠٪)" },
];

const AISection = () => {
  return (
    <section className="py-20 md:py-28 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center max-w-6xl mx-auto">
          {/* Chat UI */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <div className="rounded-2xl border border-border bg-card shadow-elevated p-5 max-w-lg mx-auto">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
                  <Bot size={18} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">المساعد المالي الذكي</p>
                  <p className="text-[10px] text-accent">متاح لـ Owner & CFO فقط</p>
                </div>
                <span className="mr-auto relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
              </div>

              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user" ? "bg-accent/10 text-foreground" : "bg-muted text-foreground"
                    }`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-sm font-semibold text-accent">AI محاسبي مدمج</span>
            </div>
            <h2 className="text-3xl font-bold text-foreground md:text-5xl leading-tight">
              اسأل بياناتك
              <br />
              <span className="text-gradient">بلغة طبيعية</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md">
              محاسب ذكي يحلل بياناتك المالية ويعطيك توصيات فورية. متاح حصرياً للمالك والمدير المالي.
            </p>

            {/* Capabilities */}
            <div className="space-y-3">
              {capabilities.map((cap) => (
                <div key={cap.label} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                    <cap.icon size={14} className="text-accent" />
                  </div>
                  <span className="text-sm text-foreground">{cap.label}</span>
                </div>
              ))}
            </div>

            {/* Access note */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <Shield size={14} className="text-amber-500 shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400">
                متاح فقط لأدوار: Owner, CFO — لحماية البيانات الحساسة
              </span>
            </div>

            <Link to="/auth">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-6">
                  جرّب المساعد الذكي
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AISection;
