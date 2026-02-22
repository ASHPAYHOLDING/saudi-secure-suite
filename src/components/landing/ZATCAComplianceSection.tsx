import { motion } from "framer-motion";
import { Shield, FileText, CheckCircle2, Calculator, Gauge } from "lucide-react";

const phases = [
  {
    title: "ZATCA Phase 1",
    subtitle: "الفوترة الإلكترونية — متاح لجميع الباقات",
    icon: FileText,
    items: [
      "فواتير إلكترونية بصيغة XML معتمدة",
      "QR Code بتشفير TLV تلقائي",
      "أرشفة آمنة ومشفرة لجميع الفواتير",
      "احتساب ضريبة القيمة المضافة تلقائياً",
    ],
  },
  {
    title: "ZATCA Phase 2",
    subtitle: "التكامل المباشر — متاح في باقة الأعمال+",
    icon: Shield,
    items: [
      "توقيع XML رقمي موثّق (XAdES-BES)",
      "ربط مباشر مع API هيئة الزكاة",
      "مزامنة لحظية لحالة كل فاتورة",
      "شهادات رقمية مُدارة وتُجدَّد تلقائياً",
    ],
  },
];

const ZATCAComplianceSection = () => {
  return (
    <section id="compliance" className="py-20 md:py-24 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Shield size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">الامتثال السعودي</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            امتثال سعودي كامل… <span className="text-gradient">بدون صداع</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            كل ما تحتاجه للتوافق مع هيئة الزكاة والضريبة والجمارك — مؤتمت بالكامل
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
              className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <phase.icon size={20} className="text-accent" />
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

        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <Gauge size={22} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">درجة الامتثال</p>
              <p className="text-xs text-muted-foreground">تقييم فوري من 0 إلى 100% لجاهزية منشأتك التنظيمية</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <Calculator size={22} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">إقرار ضريبي بلا تدخل</p>
              <p className="text-xs text-muted-foreground">حساب تلقائي لضريبة القيمة المضافة مع تنبيهات قبل موعد الإقرار</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ZATCAComplianceSection;
