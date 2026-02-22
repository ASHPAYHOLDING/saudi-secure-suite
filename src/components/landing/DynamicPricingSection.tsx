import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles, Building2, User, Briefcase, Crown, TrendingDown, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import EnterpriseEstimator from "./EnterpriseEstimator";

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
  business: Briefcase,
  professional: Briefcase,
  enterprise: Building2,
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: "للمنشآت الناشئة التي تبدأ رحلتها",
  business: "الأنسب للشركات المتوسطة والنامية",
  professional: "الأنسب للشركات المتوسطة والنامية",
  enterprise: "مرونة أعلى، تخصيص أكبر، ودعم مخصص حسب احتياجك.",
};

const getAllFeatures = (plans: Plan[]): string[] => {
  const allFeatures: string[] = [];
  plans.forEach((plan) => {
    const features = Array.isArray(plan.features) ? plan.features : [];
    features.forEach((f: string) => {
      if (!f.includes("كل مميزات") && !allFeatures.includes(f)) {
        allFeatures.push(f);
      }
    });
  });
  return allFeatures;
};

const planHasFeature = (plan: Plan, feature: string, allPlans: Plan[]): boolean => {
  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
  if (features.includes(feature)) return true;
  if (plan.slug === "enterprise") {
    const proPlan = allPlans.find((p) => p.slug === "business" || p.slug === "professional");
    if (proPlan) {
      const proFeatures = Array.isArray(proPlan.features) ? (proPlan.features as string[]) : [];
      return proFeatures.includes(feature);
    }
  }
  return false;
};

const INITIAL_FEATURES_COUNT = 4;

const DynamicPricingSection = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loading, setLoading] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});

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

  const toggleExpand = (planId: string) => {
    setExpandedPlans((prev) => ({ ...prev, [planId]: !prev[planId] }));
  };

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
      <section id="pricing" className="py-16 sm:py-20 md:py-24 bg-secondary/30">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </section>
    );
  }

  const allFeatures = getAllFeatures(plans);

  return (
    <section id="pricing" className="py-12 sm:py-16 md:py-24 bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 sm:mb-12 md:mb-16 text-center">
          <div className="mb-3 sm:mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 sm:px-5 sm:py-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs sm:text-sm font-semibold text-accent">الأسعار</span>
          </div>
          <h2 className="mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center">
            اختر الباقة المناسبة لنموك
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base md:text-lg text-muted-foreground text-center">
            ابدأ مجاناً لمدة 14 يوم. بدون بطاقة بنكية. سعر المؤسس لأول 100 عميل.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center mb-8 sm:mb-10 md:mb-12">
          <div className="inline-flex items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 bg-card border border-border rounded-xl sm:rounded-2xl shadow-sm w-full max-w-[340px] sm:max-w-none sm:w-auto">
            {(["monthly", "quarterly", "yearly"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`relative flex-1 sm:flex-none px-3 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 min-h-[40px] sm:min-h-[44px] ${
                  cycle === c
                    ? "gradient-accent text-accent-foreground shadow-accent-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {CYCLE_LABELS[c]}
                {c === "yearly" && (
                  <span className="mis-1 text-[9px] sm:text-[10px] font-bold bg-accent/20 text-accent px-1 sm:px-1.5 py-0.5 rounded-full">
                    الأوفر
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Cards - Swipeable on mobile, grid on larger screens */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 mx-auto max-w-sm sm:max-w-none">
          {plans.map((plan) => {
            const isPopular = plan.slug === "business" || plan.slug === "professional";
            const price = getPrice(plan);
            const monthlyEq = getMonthlyEquivalent(plan);
            const savingsPct = getSavingsPercent(plan);
            const savingsAmt = getSavingsAmount(plan);
            const isEnterprise = plan.slug === "enterprise" && plan.price_monthly === 0;
            const PlanIcon = PLAN_ICONS[plan.slug] || User;
            const description = PLAN_DESCRIPTIONS[plan.slug] || "";
            const isExpanded = expandedPlans[plan.id] || false;

            const comparisonItems = allFeatures.map((f) => ({
              label: f,
              has: planHasFeature(plan, f, plans),
            }));
            const visibleItems = isExpanded ? comparisonItems : comparisonItems.slice(0, INITIAL_FEATURES_COUNT);
            const hasMore = comparisonItems.length > INITIAL_FEATURES_COUNT;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl transition-all duration-300 ${
                  isPopular
                    ? "border-2 border-accent bg-card shadow-elevated lg:scale-[1.03] z-10 p-5 sm:p-6 lg:p-8"
                    : "border border-border bg-card shadow-card p-4 sm:p-5 lg:p-7"
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 inset-inline-start-1/2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full gradient-accent px-4 py-1 sm:px-5 sm:py-1.5 text-[10px] sm:text-xs font-bold text-accent-foreground shadow-accent-glow whitespace-nowrap">
                    <Crown size={11} className="inline mis-1 -mt-0.5" />
                    الأكثر طلباً
                  </div>
                )}

                {/* Plan Header */}
                <div className={`${isPopular ? "pt-2" : "pt-0"} mb-3 sm:mb-4`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isPopular ? "bg-accent/20" : "bg-accent/10"}`}>
                      <PlanIcon size={14} className="text-accent" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground">{plan.name_ar}</h3>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{description}</p>
                </div>

                {/* Price */}
                <div className="mb-3 sm:mb-4">
                  {isEnterprise ? (
                    <div className="space-y-3">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        يبدأ من{" "}
                        <span className="font-bold text-foreground text-base sm:text-lg">١٬٩٩٩</span>{" "}
                        ر.س / شهرياً
                      </p>
                      <EnterpriseEstimator />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${plan.id}-${cycle}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tabular-nums"
                          >
                            {price.toLocaleString("ar-SA")}
                          </motion.span>
                        </AnimatePresence>
                        <div className="flex flex-col">
                          <span className="text-xs sm:text-sm font-medium text-muted-foreground">ر.س</span>
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground">/ {CYCLE_LABELS[cycle]}</span>
                        </div>
                      </div>

                      {cycle !== "monthly" && (
                        <div className="mt-1.5 sm:mt-2 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] sm:text-xs text-muted-foreground">
                              أي ≈ <span className="font-semibold text-foreground">{monthlyEq.toLocaleString("ar-SA")}</span> ر.س/شهر
                            </span>
                            {savingsPct > 0 && (
                              <Badge className="bg-accent/10 text-accent text-[9px] sm:text-[10px] gap-0.5 px-1.5 py-0">
                                <TrendingDown size={9} />
                                وفّر {savingsPct}%
                              </Badge>
                            )}
                          </div>
                          {savingsAmt > 0 && (
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                              بدلاً من <span className="line-through">{(plan.price_monthly * (cycle === "yearly" ? 12 : 3)).toLocaleString("ar-SA")}</span> ر.س — توفير <span className="font-semibold text-accent">{savingsAmt.toLocaleString("ar-SA")} ر.س</span>
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Limits */}
                {!isEnterprise && (
                  <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
                    {plan.max_users && (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                        حتى {plan.max_users} مستخدم
                      </span>
                    )}
                    {plan.max_invoices && (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                        {plan.max_invoices} فاتورة/شهر
                      </span>
                    )}
                    {plan.max_storage_gb && (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground">
                        {plan.max_storage_gb} GB تخزين
                      </span>
                    )}
                  </div>
                )}
                {isEnterprise && (
                  <div className="mb-3 sm:mb-4">
                    <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium text-accent">
                      كل شيء غير محدود
                    </span>
                  </div>
                )}

                {/* CTA */}
                <Link to={isEnterprise ? "#contact" : "/auth"} className="block mb-2 sm:mb-3">
                  <Button
                    className={`w-full py-3 sm:py-4 md:py-5 text-xs sm:text-sm transition-shadow duration-300 ${
                      isPopular
                        ? "gradient-accent text-accent-foreground shadow-accent-glow"
                        : isEnterprise
                        ? "gradient-accent text-accent-foreground shadow-accent-glow"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {isEnterprise ? "اطلب عرض سعر" : "ابدأ تجربتك المجانية"}
                  </Button>
                </Link>
                {isEnterprise && (
                  <a
                    href="#pricing-comparison"
                    className="block text-center text-[11px] sm:text-xs text-accent hover:text-accent/80 transition-colors mb-2 sm:mb-3"
                  >
                    شاهد مقارنة الباقات ↓
                  </a>
                )}

                {/* Features */}
                <div className="mt-auto space-y-0 border-t border-border/40 pt-3 sm:pt-4">
                  {visibleItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start gap-2 py-1.5 sm:py-2 text-xs sm:text-sm border-b border-border/20 last:border-b-0"
                    >
                      {item.has ? (
                        <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-accent/10 shrink-0 mt-0.5">
                          <Check size={10} className="text-accent sm:hidden" />
                          <Check size={12} className="text-accent hidden sm:block" />
                        </div>
                      ) : (
                        <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-muted/60 shrink-0 mt-0.5">
                          <X size={10} className="text-muted-foreground/50 sm:hidden" />
                          <X size={12} className="text-muted-foreground/50 hidden sm:block" />
                        </div>
                      )}
                      <span className={`leading-snug ${item.has ? "text-foreground" : "text-muted-foreground/60 line-through decoration-muted-foreground/30"}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}

                  {hasMore && (
                    <button
                      onClick={() => toggleExpand(plan.id)}
                      className="flex items-center justify-center gap-1.5 w-full pt-2 pb-1 text-[11px] sm:text-xs font-medium text-accent hover:text-accent/80 transition-colors min-h-[40px]"
                    >
                      <span>{isExpanded ? "عرض أقل" : `عرض الكل (${comparisonItems.length})`}</span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ChevronDown size={13} />
                      </motion.div>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6 sm:mt-8 md:mt-10 space-y-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            جميع الأسعار بالريال السعودي (SAR) · شاملة ضريبة القيمة المضافة 15%
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            تشفير SSL · نسخ احتياطي يومي · دعم ZATCA · تحديثات مجانية
          </p>
        </div>
      </div>
    </section>
  );
};

export default DynamicPricingSection;
