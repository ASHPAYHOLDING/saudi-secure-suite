import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  CheckCircle2, TrendingUp, Clock, HeadphonesIcon,
  Rocket, ShieldCheck, Cpu, Globe,
} from "lucide-react";

const reasons = [
  {
    icon: ShieldCheck,
    title: "امتثال ZATCA كامل",
    description: "فواتير إلكترونية متوافقة تماماً مع المرحلة الأولى والثانية من هيئة الزكاة والضريبة والجمارك. لا تحتاج لنظام خارجي.",
    stat: "100%",
    statLabel: "توافق نظامي",
    gradient: "from-emerald-500/10 to-teal-500/10",
  },
  {
    icon: TrendingUp,
    title: "أتمتة تامة لأعمالك",
    description: "من الفاتورة للعقد للتقرير — كل شيء مؤتمت. وفّر ساعات عمل يومياً وركّز على نمو أعمالك بدلاً من الأعمال الورقية.",
    stat: "80%",
    statLabel: "توفير في الوقت",
    gradient: "from-blue-500/10 to-indigo-500/10",
  },
  {
    icon: Rocket,
    title: "جاهز خلال 5 دقائق",
    description: "سجّل حسابك وابدأ فوراً. لا تثبيت ولا إعدادات معقدة — واجهة بسيطة مع قوالب جاهزة ودعم كامل بالعربية.",
    stat: "5",
    statLabel: "دقائق للبدء",
    gradient: "from-violet-500/10 to-purple-500/10",
  },
  {
    icon: HeadphonesIcon,
    title: "دعم فني سعودي متخصص",
    description: "فريق دعم يتحدث العربية متاح دائماً عبر الهاتف والبريد والمحادثة. نذاكر دعم مع تتبع ومتابعة.",
    stat: "24/7",
    statLabel: "دعم متواصل",
    gradient: "from-amber-500/10 to-orange-500/10",
  },
  {
    icon: Cpu,
    title: "ذكاء اصطناعي مدمج",
    description: "اسأل النظام بلغة طبيعية عن بياناتك المالية. تحليلات ذكية وتوصيات فورية لتحسين أداء منشأتك.",
    stat: "AI",
    statLabel: "مساعد ذكي",
    gradient: "from-pink-500/10 to-rose-500/10",
  },
  {
    icon: Globe,
    title: "سحابي وثنائي اللغة",
    description: "يعمل من أي مكان عبر المتصفح. واجهة كاملة بالعربية والإنجليزية مع دعم RTL احترافي وتعدد العملات.",
    stat: "2",
    statLabel: "لغة مدعومة",
    gradient: "from-cyan-500/10 to-sky-500/10",
  },
];

const WhySection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="why" className="py-24 md:py-32 bg-background" dir="rtl">
      <div className="container mx-auto px-4" ref={ref}>
        <div className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <CheckCircle2 size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">لماذا نيوماكسيو؟</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl text-center"
          >
            الخيار الأمثل <span className="text-gradient">للمنشآت السعودية</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-2xl text-lg text-muted-foreground"
          >
            أكثر من مجرد نظام محاسبي — منصة متكاملة تنمو مع منشأتك
          </motion.p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`group relative rounded-2xl border border-border bg-card p-7 shadow-card transition-all duration-300 hover:shadow-elevated hover:border-accent/20 overflow-hidden`}
            >
              <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${reason.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl`} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-accent text-accent-foreground shadow-accent-glow transition-transform duration-300 group-hover:scale-110">
                    <reason.icon size={24} />
                  </div>
                  <div className="text-end">
                    <span className="text-3xl font-bold text-accent font-english">{reason.stat}</span>
                    <p className="text-[11px] text-muted-foreground">{reason.statLabel}</p>
                  </div>
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{reason.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{reason.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhySection;
