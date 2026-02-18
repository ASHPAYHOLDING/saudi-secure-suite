import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Building2, User, Briefcase, Crown, TrendingDown } from "lucide-react";
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

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: User,
  professional: Briefcase,
  enterprise: Building2,
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: "للمنشآت الناشئة والمتاجر الصغيرة",
  professional: "الأنسب للشركات المتوسطة والنامية",
  enterprise: "للمنشآت الكبرى والجهات الحكومية",
};

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

  const getPrice = (plan: Plan): number => {
    if (cycle === "yearly" && plan.price_yearly) return plan.price_yearly;
    if (cycle === "quarterly" && plan.price_quarterly) return plan.price_quarterly;
    return plan.price_monthly;
  };

  const getMonthlyEquivalent = (plan: Plan): number => {
    if (cycle === "yearly" && plan.price_yearly) return Math.round(plan.price_yearly / 12);
    if (cycle === "quarterly" && plan.price_quarterly) return Math.round(plan.price_quarterly / 3);
    return plan.price_monthly;
  };

  const getSavingsPercent = (plan: Plan): number => {
    if (cycle === "yearly" && plan.price_yearly) {
      const fullPrice = plan.price_monthly * 12;
      return Math.round(((fullPrice - plan.price_yearly) / fullPrice) * 100);
    }
    if (cycle === "quarterly" && plan.price_quarterly) {
      const fullPrice = plan.price_monthly * 3;
      return Math.round(((fullPrice - plan.price_quarterly) / fullPrice) * 100);
    }
    return 0;
  };

  const getSavingsAmount = (plan: Plan): number => {
    if (cycle === "yearly" && plan.price_yearly) return plan.price_monthly * 12 - plan.price_yearly;
    if (cycle === "quarterly" && plan.price_quarterly) return plan.price_monthly * 3 - plan.price_quarterly;
    return 0;
  };

  if (loading) {
    return (
      <section id="pricing" className="py-20 sm:py-28 bg-secondary/30" dir="rtl">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-10 sm:mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Sparkles size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">الأسعار</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-3xl font-bold text-foreground md:text-5xl text-center"
          >
            خطط تناسب حجم منشأتك
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-base sm:text-lg text-muted-foreground text-center"
          >
            ابدأ مجاناً لمدة 14 يوم. بدون بطاقة ائتمان. بدون التزام.
          </motion.p>
        </div>

        {/* Billing Cycle Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center mb-10 sm:mb-12"
        >
          <div className="inline-flex items-center gap-1 p-1.5 bg-card border border-border rounded-2xl shadow-sm">
            {(["monthly", "quarterly", "yearly"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`relative px-4 sm:px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 min-h-[44px] ${
                  cycle === c
                    ? "gradient-accent text-accent-foreground shadow-accent-glow"
                    : "text-muted-foreground hover:text-foreground"
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
        </motion.div>

        {/* Plan Cards */}
        <div className="space-y-5 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 max-w-6xl mx-auto items-start">
          {plans.map((plan, i) => {
            const isPopular = plan.slug === "professional";
            const price = getPrice(plan);
            const monthlyEq = getMonthlyEquivalent(plan);
            const savingsPct = getSavingsPercent(plan);
            const savingsAmt = getSavingsAmount(plan);
            const features = Array.isArray(plan.features) ? plan.features : [];
            const isEnterprise = plan.slug === "enterprise" && plan.price_monthly === 0;
            const PlanIcon = PLAN_ICONS[plan.slug] || User;
            const description = PLAN_DESCRIPTIONS[plan.slug] || "";

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className={`relative rounded-2xl p-6 sm:p-8 transition-all duration-300 ${
                  isPopular
                    ? "border-2 border-accent bg-card shadow-elevated sm:scale-[1.04] z-10"
                    : "border border-border bg-card shadow-card"
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full gradient-accent px-5 py-1.5 text-xs font-bold text-accent-foreground shadow-accent-glow whitespace-nowrap"
                  >
                    <Crown size={12} className="inline ml-1 -mt-0.5" />
                    الأكثر طلباً
                  </motion.div>
                )}

                {/* Plan Name */}
                <div className="mb-5 pt-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                      <PlanIcon size={16} className="text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">{plan.name_ar}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>

                {/* Price Block */}
                <div className="mb-5">
                  {isEnterprise ? (
                    <span className="text-2xl font-bold text-foreground">تواصل معنا</span>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${plan.id}-${cycle}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25 }}
                            className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums"
                          >
                            {price.toLocaleString("ar-SA")}
                          </motion.span>
                        </AnimatePresence>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-muted-foreground">ر.س</span>
                          <span className="text-[11px] text-muted-foreground">/ {CYCLE_LABELS[cycle]}</span>
                        </div>
                      </div>

                      {/* Monthly equivalent + Savings */}
                      {cycle !== "monthly" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-2 space-y-1"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              أي ≈ <span className="font-semibold text-foreground">{monthlyEq.toLocaleString("ar-SA")}</span> ر.س/شهر
                            </span>
                            {savingsPct > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] gap-0.5">
                                <TrendingDown size={10} />
                                وفّر {savingsPct}%
                              </Badge>
                            )}
                          </div>
                          {savingsAmt > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              بدلاً من <span className="line-through">{(plan.price_monthly * (cycle === "yearly" ? 12 : 3)).toLocaleString("ar-SA")}</span> ر.س — توفير <span className="font-semibold text-emerald-600 dark:text-emerald-400">{savingsAmt.toLocaleString("ar-SA")} ر.س</span>
                            </p>
                          )}
                        </motion.div>
                      )}
                    </>
                  )}
                </div>

                {/* Limits Pills */}
                {!isEnterprise && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {plan.max_users && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        حتى {plan.max_users} مستخدم
                      </span>
                    )}
                    {plan.max_invoices && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {plan.max_invoices} فاتورة/شهر
                      </span>
                    )}
                    {plan.max_storage_gb && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        {plan.max_storage_gb} GB تخزين
                      </span>
                    )}
                  </div>
                )}
                {isEnterprise && (
                  <div className="mb-5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                      كل شيء غير محدود
                    </span>
                  </div>
                )}

                {/* CTA */}
                <Link to="/auth">
                  <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                    <Button
                      className={`mb-6 w-full py-6 text-base transition-shadow duration-300 ${
                        isPopular
                          ? "gradient-accent text-accent-foreground shadow-accent-glow"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {isEnterprise ? "تواصل مع المبيعات" : "ابدأ تجربتك المجانية"}
                    </Button>
                  </motion.div>
                </Link>

                {/* Features */}
                <ul className="space-y-2.5">
                  {features.map((f: string, fi: number) => (
                    <li key={fi} className="flex items-center gap-2.5 text-sm text-foreground">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 shrink-0">
                        <Check size={12} className="text-accent" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Trust + Tax Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 sm:mt-10 space-y-1.5"
        >
          <p className="text-xs text-muted-foreground">
            جميع الأسعار بالريال السعودي (SAR) · شاملة ضريبة القيمة المضافة 15%
          </p>
          <p className="text-xs text-muted-foreground">
            تشفير SSL · نسخ احتياطي يومي · دعم ZATCA · تحديثات مجانية
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default DynamicPricingSection;