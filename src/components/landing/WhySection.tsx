import { motion } from "framer-motion";
import { CheckCircle2, TrendingUp, Clock, HeadphonesIcon } from "lucide-react";

const reasons = [
  {
    icon: CheckCircle2,
    title: "متوافق مع ZATCA",
    description: "فواتير إلكترونية بتشفير TLV متوافقة مع المرحلة الأولى والثانية من متطلبات هيئة الزكاة والضريبة والجمارك.",
    stat: "100%",
    statLabel: "توافق نظامي",
  },
  {
    icon: TrendingUp,
    title: "زيادة كفاءة الأعمال",
    description: "أتمتة كاملة للفواتير والعقود والحسابات. وفّر وقتك وركّز على نمو أعمالك بدلاً من الأعمال الورقية.",
    stat: "80%",
    statLabel: "توفير في الوقت",
  },
  {
    icon: Clock,
    title: "جاهز في دقائق",
    description: "سجّل حسابك وابدأ بإصدار الفواتير خلال دقائق. لا حاجة لتثبيت أي برامج أو إعدادات معقدة.",
    stat: "5",
    statLabel: "دقائق للبدء",
  },
  {
    icon: HeadphonesIcon,
    title: "دعم فني سعودي",
    description: "فريق دعم متخصص يتحدث العربية متاح لمساعدتك في أي وقت عبر الهاتف أو البريد أو المحادثة.",
    stat: "24/7",
    statLabel: "دعم متواصل",
  },
];

const WhySection = () => {
  return (
    <section id="why" className="py-28 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <span className="text-sm font-semibold text-accent">لماذا نيوماكسيو؟</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl"
          >
            الخيار الأمثل للمنشآت السعودية
          </motion.h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, x: i % 2 === 0 ? 40 : -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className="flex gap-6 rounded-2xl border border-border bg-card p-8 shadow-card transition-shadow hover:shadow-elevated"
            >
              <div className="shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-accent text-accent-foreground shadow-accent-glow">
                  <reason.icon size={28} />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-bold text-foreground">{reason.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{reason.description}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-accent font-english">{reason.stat}</span>
                  <span className="text-sm text-muted-foreground">{reason.statLabel}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
