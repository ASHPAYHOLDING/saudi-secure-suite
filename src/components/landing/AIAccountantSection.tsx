import { motion } from "framer-motion";
import { Bot, Sparkles, Shield, ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const messages = [
  { role: "user" as const, text: "كيف أرباحي هذا الشهر؟" },
  { role: "ai" as const, text: "صافي الربح ١٦٢,٦٠٠ ﷼ — انخفاض ١٢٪ مقارنة بالشهر الماضي بسبب ارتفاع المصاريف التشغيلية. أنصح بمراجعة بند الإيجارات." },
  { role: "user" as const, text: "هل في شذوذ؟" },
  { role: "ai" as const, text: "⚠️ بند التسويق الرقمي ارتفع ٤٠٪ بدون زيادة مقابلة في الإيرادات. أنصح بمراجعة عقود الحملات." },
];

const capabilities = [
  { icon: TrendingUp, text: "تحليل ربحية فوري" },
  { icon: AlertTriangle, text: "كشف شذوذ تلقائي" },
  { icon: Shield, text: "تنبيهات ضريبية" },
];

const AIAccountantSection = () => {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
                  <p className="text-sm font-bold text-foreground">المساعد المالي الذكي</p>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                    <span className="text-[11px] text-muted-foreground">متصل</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
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

              <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
                {["احسب ضريبة هذا الربع", "لماذا انخفضت الأرباح؟", "مقارنة شهرية"].map((ex) => (
                  <span key={ex} className="text-[11px] bg-accent/10 text-accent rounded-full px-3 py-1.5 font-medium">
                    {ex}
                  </span>
                ))}
              </div>
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
              <span className="text-sm font-semibold text-accent">AI محاسبي مدمج</span>
            </div>
            <h2 className="font-bold text-foreground leading-tight" style={{ fontSize: "clamp(22px, 3vw, 36px)" }}>
              مستشارك المالي
              <br />
              <span className="text-gradient">يعمل 24/7</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-md" style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}>
              اسأل بلغتك العادية عن أي شيء مالي — وسيجيبك بالأرقام والتوصيات الفورية.
            </p>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-3">
              {capabilities.map((c) => (
                <div key={c.text} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 min-h-[44px]">
                  <c.icon size={14} className="text-accent" />
                  <span className="text-xs font-medium text-foreground">{c.text}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5">
              <Shield size={14} className="text-accent shrink-0" />
              <span className="text-xs text-muted-foreground">
                متاح فقط لأدوار: Owner, CFO — لحماية البيانات الحساسة
              </span>
            </div>

            <Link to="/auth">
              <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 min-h-[48px] text-base font-bold rounded-xl">
                جرّب المساعد الذكي
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
