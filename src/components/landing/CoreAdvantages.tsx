import { useState } from "react";
import { FileText, Bot, Building2, ChevronDown, QrCode, FileSignature, Receipt, Zap, TrendingUp, AlertTriangle, Bell, BarChart3, ShieldCheck, Crown, Search, GitBranch } from "lucide-react";

interface Pillar {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  features: { icon: React.ElementType; label: string }[];
}

const pillars: Pillar[] = [
  {
    icon: FileText,
    title: "🧾 امتثال سعودي تلقائي",
    subtitle: "توافق كامل مع هيئة الزكاة والضريبة بدون أي جهد يدوي",
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
    <section className="py-16 sm:py-20 md:py-24 bg-background" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl">
            لماذا نيوماكسيو <span className="text-gradient">مختلف؟</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            ثلاث ركائز أساسية تميزنا عن أي نظام محاسبي آخر في السوق السعودي
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((pillar, i) => {
            const isOpen = expanded === i;
            return (
              <div
                key={pillar.title}
                className="group relative rounded-2xl border border-border bg-card shadow-card overflow-hidden cursor-pointer transition-shadow duration-200 hover:shadow-elevated hover:border-accent/20"
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                <div className="relative p-7">
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-foreground">{pillar.title}</h3>
                      <ChevronDown
                        size={18}
                        className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.subtitle}</p>
                  </div>

                  {isOpen && (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CoreAdvantages;
