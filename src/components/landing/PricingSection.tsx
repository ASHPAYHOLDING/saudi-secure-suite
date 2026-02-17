import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "أساسي",
    nameEn: "Starter",
    price: "199",
    period: "شهرياً",
    description: "مثالي للمهنيين المستقلين والمشاريع الصغيرة",
    features: [
      "حتى 3 مستخدمين",
      "100 فاتورة شهرياً",
      "إدارة العملاء",
      "QR Code متوافق مع ZATCA",
      "تقارير أساسية",
      "دعم عبر البريد",
    ],
    highlighted: false,
  },
  {
    name: "احترافي",
    nameEn: "Professional",
    price: "499",
    period: "شهرياً",
    description: "للشركات الصغيرة والمتوسطة",
    features: [
      "حتى 15 مستخدم",
      "فواتير غير محدودة",
      "إدارة العقود والعملاء",
      "ختم إلكتروني رسمي",
      "تقارير متقدمة وتحليلات",
      "دعم أولوية عبر الهاتف",
      "سجل مراجعة كامل",
      "تخصيص هوية الشركة",
    ],
    highlighted: true,
  },
  {
    name: "مؤسسي",
    nameEn: "Enterprise",
    price: "تواصل معنا",
    period: "",
    description: "للمؤسسات الكبيرة والجهات الحكومية",
    features: [
      "مستخدمين غير محدود",
      "كل مميزات الاحترافي",
      "مدير حساب مخصص",
      "تكامل API كامل",
      "SLA مضمون 99.9%",
      "تدريب وتأهيل الفريق",
      "بيئة مخصصة",
    ],
    highlighted: false,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-28 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Sparkles size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">الأسعار</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl" style={{ textAlign: "center" }}
          >
            خطط تناسب حجم منشأتك
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-lg text-muted-foreground"
          >
            ابدأ مجاناً لمدة 14 يوم. بدون بطاقة ائتمان. بدون التزام.
          </motion.p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              whileHover={{ y: -8 }}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-2 border-accent bg-card shadow-elevated scale-[1.04] z-10"
                  : "border border-border bg-card shadow-card hover:shadow-elevated"
              }`}
            >
              {plan.highlighted && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full gradient-accent px-5 py-1.5 text-xs font-bold text-accent-foreground shadow-accent-glow"
                >
                  الأكثر شيوعاً
                </motion.div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground font-english mt-1">{plan.nameEn}</p>
              </div>

              <div className="mb-2 flex items-baseline gap-1">
                {plan.period ? (
                  <>
                    <span className="text-5xl font-bold text-foreground font-english">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">﷼ / {plan.period}</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                )}
              </div>

              <p className="mb-8 text-sm text-muted-foreground">{plan.description}</p>

              <Link to="/auth">
                <motion.div whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Button
                    className={`mb-8 w-full py-6 text-base transition-shadow duration-300 ${
                      plan.highlighted
                        ? "gradient-accent text-accent-foreground shadow-accent-glow hover:shadow-[0_8px_30px_-4px_hsl(172_66%_36%/0.5)]"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md"
                    }`}
                  >
                    {plan.period ? "ابدأ تجربتك المجانية" : "تواصل مع المبيعات"}
                  </Button>
                </motion.div>
              </Link>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-foreground">
                    <Check size={16} className="text-accent shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
