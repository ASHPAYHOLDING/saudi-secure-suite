import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Building2, User, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface Plan {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  price_monthly: number;
  price_quarterly: number | null;
  price_yearly: number | null;
  max_users: number | null;
  max_invoices: number | null;
  max_storage_gb: number | null;
  features: any;
  sort_order: number;
  grace_period_days: number;
}

type BillingCycle = "monthly" | "quarterly" | "yearly";

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  yearly: "سنوي",
};

const AUDIENCE_TAGS = [
  { icon: User, label: "للأفراد", slug: "starter" },
  { icon: Briefcase, label: "للمستقلين والشركات الصغيرة", slug: "professional" },
  { icon: Building2, label: "للمؤسسات", slug: "enterprise" },
];

const DynamicPricingSection = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setPlans(data as Plan[]);
        setLoading(false);
      });
  }, []);

  const getPrice = (plan: Plan) => {
    if (cycle === "yearly" && plan.price_yearly) return plan.price_yearly;
    if (cycle === "quarterly" && plan.price_quarterly) return plan.price_quarterly;
    return plan.price_monthly;
  };

  const getMonthly = (plan: Plan) => {
    if (cycle === "yearly" && plan.price_yearly) return Math.round(plan.price_yearly / 12);
    if (cycle === "quarterly" && plan.price_quarterly) return Math.round(plan.price_quarterly / 3);
    return plan.price_monthly;
  };

  const getSavings = (plan: Plan) => {
    if (cycle === "yearly" && plan.price_yearly) {
      const full = plan.price_monthly * 12;
      return Math.round(((full - plan.price_yearly) / full) * 100);
    }
    if (cycle === "quarterly" && plan.price_quarterly) {
      const full = plan.price_monthly * 3;
      return Math.round(((full - plan.price_quarterly) / full) * 100);
    }
    return 0;
  };

  if (loading) {
    return (
      <section id="pricing" className="py-28 bg-secondary/30" dir="rtl">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-28 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
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
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl text-center"
          >
            خطط تناسب حجم منشأتك
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-lg text-muted-foreground text-center"
          >
            ابدأ مجاناً لمدة 14 يوم. بدون بطاقة ائتمان. بدون التزام.
          </motion.p>
        </div>

        {/* Billing cycle toggle */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {(["monthly", "quarterly", "yearly"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                cycle === c
                  ? "gradient-accent text-accent-foreground shadow-accent-glow"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-accent/30"
              }`}
            >
              {CYCLE_LABELS[c]}
              {c === "yearly" && (
                <span className="mr-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded-full">
                  الأوفر
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto items-start">
          {plans.map((plan, i) => {
            const isMiddle = i === 1;
            const price = getPrice(plan);
            const monthly = getMonthly(plan);
            const savings = getSavings(plan);
            const features = Array.isArray(plan.features) ? plan.features : [];
            const isEnterprise = plan.slug === "enterprise" && plan.price_monthly === 0;
            const audience = AUDIENCE_TAGS[i] || AUDIENCE_TAGS[0];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ y: -8 }}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  isMiddle
                    ? "border-2 border-accent bg-card shadow-elevated scale-[1.04] z-10"
                    : "border border-border bg-card shadow-card hover:shadow-elevated"
                }`}
              >
                {isMiddle && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full gradient-accent px-5 py-1.5 text-xs font-bold text-accent-foreground shadow-accent-glow"
                  >
                    الأكثر شيوعاً
                  </motion.div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <audience.icon size={16} className="text-accent" />
                    <span className="text-[11px] text-muted-foreground">{audience.label}</span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{plan.name_ar}</h3>
                  <p className="text-xs text-muted-foreground font-english mt-0.5">{plan.name_en}</p>
                </div>

                <div className="mb-2 flex items-baseline gap-1">
                  {isEnterprise ? (
                    <span className="text-2xl font-bold text-foreground">تواصل معنا</span>
                  ) : (
                    <>
                      <span className="text-5xl font-bold text-foreground font-english">
                        {price.toLocaleString("ar-SA")}
                      </span>
                      <span className="text-sm text-muted-foreground">﷼ / {CYCLE_LABELS[cycle]}</span>
                    </>
                  )}
                </div>

                {!isEnterprise && cycle !== "monthly" && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">
                      ≈ {monthly.toLocaleString("ar-SA")} ﷼/شهر
                    </span>
                    {savings > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                        وفّر {savings}%
                      </Badge>
                    )}
                  </div>
                )}

                {/* Limits */}
                <div className="mb-6 space-y-1 text-xs text-muted-foreground">
                  {plan.max_users && <p>حتى {plan.max_users} مستخدم</p>}
                  {plan.max_invoices && <p>حتى {plan.max_invoices} فاتورة/شهر</p>}
                  {plan.max_storage_gb && <p>{plan.max_storage_gb} GB تخزين</p>}
                  {!plan.max_users && !plan.max_invoices && <p>كل شيء غير محدود</p>}
                </div>

                <Link to="/auth">
                  <motion.div whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                    <Button
                      className={`mb-6 w-full py-6 text-base transition-shadow duration-300 ${
                        isMiddle
                          ? "gradient-accent text-accent-foreground shadow-accent-glow hover:shadow-[0_8px_30px_-4px_hsl(172_66%_36%/0.5)]"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md"
                      }`}
                    >
                      {isEnterprise ? "تواصل مع المبيعات" : "ابدأ تجربتك المجانية — 14 يوم"}
                    </Button>
                  </motion.div>
                </Link>

                <ul className="space-y-3">
                  {features.map((f: string, fi: number) => (
                    <li key={fi} className="flex items-center gap-3 text-sm text-foreground">
                      <Check size={16} className="text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground mt-10"
        >
          جميع الخطط تشمل: تشفير SSL · نسخ احتياطي يومي · دعم ZATCA · تحديثات مجانية
        </motion.p>
      </div>
    </section>
  );
};

export default DynamicPricingSection;
