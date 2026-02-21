import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FileText, Bot, Building2, ChevronDown, QrCode, FileSignature, Receipt, Zap, TrendingUp, AlertTriangle, Bell, BarChart3, ShieldCheck, Crown, Search, GitBranch } from "lucide-react";

interface Pillar {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  features: { icon: React.ElementType; label: string }[];
}

const pillars: Pillar[] = [
  {
    icon: FileText,
    title: "🧾 امتثال سعودي تلقائي",
    subtitle: "توافق كامل مع هيئة الزكاة والضريبة بدون أي جهد يدوي",
    color: "from-emerald-500/20 to-teal-500/20",
    features: [
      { icon: FileSignature, label: "توقيع XML تلقائي" },
      { icon: QrCode, label: "QR Code بتشفير TLV" },
      { icon: Zap, label: "تكامل ZATCA API مباشر" },
      { icon: Receipt, label: "أتمتة ضريبة القيمة المضافة" },
    ],
  },
  {
    icon: Bot,
    title: "🤖 AI محاسبي ذكي",
    subtitle: "ذكاء اصطناعي مدمج يحلل بياناتك ويوصيك بقرارات أفضل",
    color: "from-blue-500/20 to-indigo-500/20",
    features: [
      { icon: TrendingUp, label: "تحليل ربحية فوري" },
      { icon: AlertTriangle, label: "كشف شذوذ المصروفات" },
      { icon: Bell, label: "تنبيهات ضريبية استباقية" },
      { icon: BarChart3, label: "مساعد تقارير ذكي" },
    ],
  },
  {
    icon: Building2,
    title: "🏛️ حوكمة مؤسسية",
    subtitle: "أدوات متقدمة لإدارة الشركات الكبرى والمنشآت متعددة الفروع",
    color: "from-violet-500/20 to-purple-500/20",
    features: [
      { icon: Crown, label: "قوالب أدوار مؤسسية (CFO, Auditor)" },
      { icon: ShieldCheck, label: "درجة الامتثال المؤسسي" },
      { icon: Search, label: "لوحة الذكاء التنفيذي" },
      { icon: GitBranch, label: "سجلات تدقيق شاملة" },
    ],
  },
];

const CoreAdvantages = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="py-24 md:py-32 bg-background" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-3xl font-bold text-foreground md:text-5xl"
          >
            لماذا نيوماكسيو <span className="text-gradient">مختلف؟</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-2xl text-lg text-muted-foreground"
          >
            ثلاث ركائز أساسية تميزنا عن أي نظام محاسبي آخر في السوق السعودي
          </motion.p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {pillars.map((pillar, i) => {
            const isOpen = expanded === i;
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-2xl border border-border bg-card shadow-card overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-elevated hover:border-accent/20"
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                {/* Gradient bg */}
                <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gradient-to-br ${pillar.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl`} />

                <div className="relative p-7">
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-foreground">{pillar.title}</h3>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown size={18} className="text-muted-foreground" />
                      </motion.div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.subtitle}</p>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 pt-4 border-t border-border">
                          {pillar.features.map((f) => (
                            <div key={f.label} className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                                <f.icon size={14} className="text-accent" />
                              </div>
                              <span className="text-sm text-foreground">{f.label}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CoreAdvantages;
