import { motion } from "framer-motion";
import { Shield, FileText, CheckCircle2, Bell, Calculator } from "lucide-react";

const phases = [
  {
    title: "ZATCA Phase 1",
    subtitle: "الفوترة الإلكترونية — متاح لجميع الباقات",
    icon: FileText,
    color: "border-accent/30 bg-accent/5",
    iconBg: "bg-accent/10 text-accent",
    items: [
      "توليد فواتير إلكترونية XML",
      "QR Code بتشفير TLV",
      "أرشفة آمنة لجميع الفواتير",
      "تقارير ضريبة القيمة المضافة",
    ],
  },
  {
    title: "ZATCA Phase 2",
    subtitle: "التكامل المباشر — متاح في باقة الأعمال+",
    icon: Shield,
    color: "border-emerald-500/30 bg-emerald-500/5",
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    items: [
      "توقيع XML رقمي (XAdES-BES)",
      "تكامل مباشر مع بوابة ZATCA API",
      "مزامنة لحظية للحالة",
      "شهادات رقمية مُدارة",
    ],
  },
];

const ComplianceSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-5 py-2"
          >
            <Shield size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">الامتثال السعودي</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 text-3xl font-bold text-foreground md:text-5xl"
          >
            بوابة الامتثال <span className="text-gradient">الشاملة</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-base sm:text-lg text-muted-foreground"
          >
            توافق كامل مع هيئة الزكاة والضريبة والجمارك — بدون أي جهد يدوي
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
          {phases.map((phase, i) => (
            <motion.div
              key={phase.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl border ${phase.color} p-6 md:p-8`}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${phase.iconBg}`}>
                  <phase.icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{phase.title}</h3>
                  <p className="text-xs text-muted-foreground">{phase.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {phase.items.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 size={14} className="text-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* VAT automation strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row items-center gap-4"
        >
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Calculator size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">أتمتة ضريبة القيمة المضافة</p>
              <p className="text-xs text-muted-foreground">حساب تلقائي + تذكيرات مواعيد الإقرار</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:mr-auto">
            <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent">
              <Bell size={10} />
              تنبيهات ضريبية
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={10} />
              إقرار تلقائي
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ComplianceSection;
