import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "أساسي",
    nameEn: "Starter",
    price: "199",
    period: "شهرياً",
    description: "مثالي لرواد الأعمال والمشاريع الصغيرة",
    features: [
      "حتى 5 مستخدمين",
      "تقارير أساسية",
      "دعم عبر البريد",
      "تخزين 5 جيجابايت",
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
      "حتى 25 مستخدم",
      "تقارير متقدمة",
      "دعم أولوية 24/7",
      "تخزين 50 جيجابايت",
      "API كامل",
      "تكاملات خارجية",
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
      "تقارير مخصصة",
      "مدير حساب خاص",
      "تخزين غير محدود",
      "SLA مضمون",
      "تخصيص كامل",
    ],
    highlighted: false,
  },
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent"
          >
            الأسعار
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-3xl font-bold text-foreground md:text-4xl"
          >
            خطط تناسب جميع الأحجام
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
          >
            ابدأ مجاناً لمدة 14 يوم. لا حاجة لبطاقة ائتمان.
          </motion.p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-2 border-accent bg-card shadow-elevated scale-[1.03]"
                  : "border border-border bg-card shadow-card hover:shadow-card-hover"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-semibold text-accent-foreground">
                  الأكثر شيوعاً
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="text-xs text-muted-foreground font-english">{plan.nameEn}</p>
              </div>

              <div className="mb-2 flex items-baseline gap-1">
                {plan.period ? (
                  <>
                    <span className="text-4xl font-bold text-foreground font-english">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">ر.س / {plan.period}</span>
                  </>
                ) : (
                  <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                )}
              </div>

              <p className="mb-8 text-sm text-muted-foreground">{plan.description}</p>

              <Link to="/dashboard">
                <Button
                  className={`mb-8 w-full ${
                    plan.highlighted
                      ? "gradient-accent text-accent-foreground shadow-accent-glow hover:opacity-90"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {plan.period ? "ابدأ الآن" : "تواصل معنا"}
                </Button>
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
