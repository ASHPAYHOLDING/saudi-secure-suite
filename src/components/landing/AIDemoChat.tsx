import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles } from "lucide-react";

const demoConversation = [
  { role: "user" as const, text: "كيف أرباحي هذا الربع؟" },
  { role: "ai" as const, text: "صافي الربح للربع الحالي ٤٨٧,٢٠٠ ﷼ بنمو ١٤٪ عن الربع السابق. هامش الربح ٣٢٪ وهو أعلى من متوسط القطاع." },
  { role: "user" as const, text: "أين أعلى المصروفات؟" },
  { role: "ai" as const, text: "أعلى ٣ بنود:\n١. رواتب: ١٨٠,٠٠٠ ﷼ (٣٧٪)\n٢. إيجارات: ٤٥,٠٠٠ ﷼ (٩٪)\n٣. تسويق: ٣٨,٠٠٠ ﷼ (٨٪ — ارتفع ٢٥٪)" },
  { role: "user" as const, text: "هل في شذوذ؟" },
  { role: "ai" as const, text: "⚠️ نعم — بند التسويق الرقمي ارتفع ٢٥٪ بدون زيادة مقابلة في الإيرادات. أنصح بمراجعة عقود الحملات الإعلانية." },
];

const AIDemoChat = () => {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= demoConversation.length) return;
    const delay = demoConversation[visibleCount]?.role === "ai" ? 1200 : 800;
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleCount]);

  const restart = () => setVisibleCount(0);

  return (
    <section className="py-20 md:py-28 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Sparkles size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">عرض تفاعلي</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-bold text-foreground mb-3"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            شاهد الذكاء المحاسبي <span className="text-gradient">أثناء العمل</span>
          </motion.h2>
          <p className="text-muted-foreground mx-auto max-w-lg" style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}>
            محادثة حقيقية توضح كيف يحلل المساعد الذكي أرقامك
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-lg mx-auto rounded-2xl border border-border bg-card shadow-elevated overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
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
            <button
              onClick={restart}
              className="text-xs text-muted-foreground hover:text-accent transition-colors px-3 py-2 min-h-[44px] rounded-lg border border-border"
            >
              إعادة التشغيل
            </button>
          </div>

          {/* Messages */}
          <div className="p-4 sm:p-5 space-y-3 min-h-[280px] sm:min-h-[300px] max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {demoConversation.slice(0, visibleCount).map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent/10 text-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {visibleCount < demoConversation.length && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-end"
              >
                <div className="flex gap-1 px-4 py-3">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AIDemoChat;
