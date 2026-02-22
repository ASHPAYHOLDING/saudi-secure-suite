import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Minus,
  Sparkles,
  User,
  Briefcase,
  Building2,
  Crown,
  ChevronDown,
  FileText,
  HardDrive,
  Users,
  Layers,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/* ─── Types ─── */
interface Plan {
  id: string;
  name_ar: string;
  slug: string;
  price_monthly: number;
  max_users: number | null;
  max_invoices: number | null;
  max_storage_gb: number | null;
  features: any;
  sort_order: number;
}

/* ─── Helpers ─── */
const toAr = (n: number) => {
  const ar = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return n.toLocaleString("en-US").replace(/\d/g, (d) => ar[+d]);
};

const PLAN_ICON: Record<string, React.ElementType> = {
  starter: User,
  business: Briefcase,
  enterprise: Building2,
};

const PLAN_TAGLINE: Record<string, string> = {
  starter: "انطلق بثقة مع الأدوات الأساسية",
  business: "كل ما تحتاجه لنمو أعمالك",
  enterprise: "مرونة كاملة وتحكم مطلق",
};

const PLAN_LIMITS: Record<string, { users: string; invoices: string; storage: string; entities: string }> = {
  starter: { users: "٢", invoices: "١٠٠ / شهر", storage: "٥ GB", entities: "١" },
  business: { users: "١٥", invoices: "غير محدود", storage: "١٠٠ GB", entities: "٥" },
  enterprise: { users: "غير محدود", invoices: "غير محدود", storage: "غير محدود", entities: "غير محدود" },
};

/* ─── Comparison Data ─── */
interface FeatureRow {
  label: string;
  starter: boolean;
  business: boolean;
  enterprise: boolean;
}

interface FeatureGroup {
  title: string;
  rows: FeatureRow[];
}

const COMPARISON: FeatureGroup[] = [
  {
    title: "الفوترة والضرائب",
    rows: [
      { label: "فواتير إلكترونية", starter: true, business: true, enterprise: true },
      { label: "QR متوافق مع ZATCA Phase 1", starter: true, business: true, enterprise: true },
      { label: "ZATCA Phase 2 كامل", starter: false, business: true, enterprise: true },
      { label: "إقرار ضريبي آلي", starter: false, business: true, enterprise: true },
      { label: "فواتير غير محدودة", starter: false, business: true, enterprise: true },
    ],
  },
  {
    title: "العملاء والموردون",
    rows: [
      { label: "إدارة العملاء", starter: true, business: true, enterprise: true },
      { label: "إدارة العقود", starter: false, business: true, enterprise: true },
      { label: "بوابات دفع متعددة", starter: false, business: true, enterprise: true },
      { label: "جميع بوابات الدفع", starter: false, business: false, enterprise: true },
    ],
  },
  {
    title: "القيود والتقارير",
    rows: [
      { label: "تقارير أساسية", starter: true, business: true, enterprise: true },
      { label: "تقارير متقدمة + تحليلات", starter: false, business: true, enterprise: true },
      { label: "شجرة حسابات مخصصة", starter: false, business: false, enterprise: true },
    ],
  },
  {
    title: "الحوكمة والصلاحيات",
    rows: [
      { label: "سجل مراجعة", starter: false, business: true, enterprise: true },
      { label: "نظام موافقات", starter: false, business: true, enterprise: true },
      { label: "ختم إلكتروني", starter: false, business: true, enterprise: true },
      { label: "سير عمل مخصص", starter: false, business: false, enterprise: true },
      { label: "هيكل مؤسسي", starter: false, business: false, enterprise: true },
    ],
  },
  {
    title: "الذكاء المحاسبي",
    rows: [
      { label: "AI محاسبي أساسي", starter: false, business: true, enterprise: true },
      { label: "AI محاسبي متقدم", starter: false, business: false, enterprise: true },
    ],
  },
  {
    title: "التكاملات والدعم",
    rows: [
      { label: "دعم عبر البريد", starter: true, business: true, enterprise: true },
      { label: "مدير حساب مخصص", starter: false, business: false, enterprise: true },
      { label: "API كامل", starter: false, business: false, enterprise: true },
      { label: "SLA 99.9%", starter: false, business: false, enterprise: true },
    ],
  },
];

/* ─── Component ─── */
const DynamicPricingSection = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

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

  const toggleGroup = (i: number) =>
    setOpenGroups((prev) => ({ ...prev, [i]: !prev[i] }));

  if (loading) {
    return (
      <section id="pricing" className="py-16 sm:py-20 md:py-24 bg-secondary/30">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-16 sm:py-20 md:py-28 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ─── Header ─── */}
        <div className="mb-10 sm:mb-14 md:mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-xs sm:text-sm font-semibold text-accent">الأسعار</span>
          </div>
          <h2 className="mb-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground text-center">
            اختر الباقة المناسبة لنموك
          </h2>
          <p className="mx-auto max-w-lg text-sm sm:text-base md:text-lg text-muted-foreground text-center">
            ابدأ مجاناً لمدة ١٤ يوم. بدون بطاقة بنكية.
          </p>
        </div>

        {/* ─── Cards ─── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 mx-auto max-w-sm sm:max-w-none">
          {plans.map((plan) => {
            const isPopular = plan.slug === "business";
            const isEnterprise = plan.slug === "enterprise";
            const Icon = PLAN_ICON[plan.slug] || User;
            const tagline = PLAN_TAGLINE[plan.slug] || "";
            const limits = PLAN_LIMITS[plan.slug];
            const price = isEnterprise ? 999 : plan.price_monthly;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: plan.sort_order * 0.1 }}
                className={`relative flex flex-col rounded-2xl transition-all ${
                  isPopular
                    ? "border-2 border-accent bg-card shadow-elevated lg:scale-[1.04] z-10"
                    : "border border-border bg-card shadow-card"
                }`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 rounded-full gradient-accent px-5 py-1.5 text-[11px] font-bold text-accent-foreground shadow-accent-glow whitespace-nowrap">
                    <Crown size={12} className="inline me-1 -mt-0.5" />
                    الأكثر طلباً
                  </div>
                )}

                <div className="p-5 sm:p-6 lg:p-8 flex flex-col flex-1">
                  {/* Plan Name */}
                  <div className={`${isPopular ? "pt-2" : ""} mb-5`}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isPopular ? "bg-accent/20" : "bg-accent/10"}`}>
                        <Icon size={16} className="text-accent" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">{plan.name_ar}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
                        {toAr(price)}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground">ر.س</span>
                        <span className="text-[11px] text-muted-foreground">/ شهرياً</span>
                      </div>
                    </div>
                  </div>

                  {/* Limits Chips */}
                  {limits && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      <Chip icon={Users} label={`${limits.users} مستخدم`} />
                      <Chip icon={FileText} label={`${limits.invoices} فاتورة`} />
                      <Chip icon={HardDrive} label={`${limits.storage} تخزين`} />
                      <Chip icon={Layers} label={`${limits.entities} كيان`} />
                    </div>
                  )}

                  {/* CTA */}
                  <Link to="/auth" className="block mb-3">
                    <Button
                      className={`w-full h-12 text-sm font-semibold transition-shadow ${
                        isPopular || isEnterprise
                          ? "gradient-accent text-accent-foreground shadow-accent-glow hover:shadow-lg"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {isEnterprise ? "ابدأ الآن" : "ابدأ تجربتك المجانية"}
                    </Button>
                  </Link>
                  <a
                    href="#pricing-comparison"
                    className="block text-center text-xs text-accent hover:text-accent/80 transition-colors mb-4"
                  >
                    مقارنة الباقات
                  </a>

                  {/* Features */}
                  <div className="mt-auto border-t border-border/40 pt-4 space-y-0">
                    {(Array.isArray(plan.features) ? plan.features as string[] : [])
                      .filter((f) => !f.startsWith("كل مميزات"))
                      .slice(0, 6)
                      .map((f) => (
                        <div key={f} className="flex items-start gap-2.5 py-2 text-sm">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 mt-0.5">
                            <Check size={12} className="text-accent" />
                          </div>
                          <span className="text-foreground leading-snug">{f}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* VAT Note */}
        <p className="text-center text-[11px] sm:text-xs text-muted-foreground mt-6 sm:mt-8">
          الأسعار لا تشمل ضريبة القيمة المضافة إن وجدت.
        </p>

        {/* ─── Comparison Table ─── */}
        <div id="pricing-comparison" className="mt-16 sm:mt-20 md:mt-24 scroll-mt-20">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground text-center mb-8 sm:mb-10">
            مقارنة تفصيلية بين الباقات
          </h3>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-start p-4 font-semibold text-foreground w-2/5">الميزة</th>
                  {["أساسي", "الأعمال", "المؤسسي"].map((name) => (
                    <th key={name} className="p-4 text-center font-semibold text-foreground">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((group, gi) => (
                  <GroupRows key={gi} group={group} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Accordion */}
          <div className="md:hidden space-y-3">
            {COMPARISON.map((group, gi) => {
              const isOpen = openGroups[gi] ?? false;
              return (
                <div key={gi} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => toggleGroup(gi)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-foreground"
                  >
                    <span>{group.title}</span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <ChevronDown size={16} className="text-muted-foreground" />
                    </motion.div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      {group.rows.map((row, ri) => (
                        <div key={ri} className="space-y-1.5">
                          <p className="text-xs font-medium text-foreground">{row.label}</p>
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                            <CellMobile label="أساسي" has={row.starter} />
                            <CellMobile label="الأعمال" has={row.business} />
                            <CellMobile label="المؤسسي" has={row.enterprise} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 sm:mt-10">
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            تشفير SSL · نسخ احتياطي يومي · دعم ZATCA · تحديثات مجانية
          </p>
        </div>
      </div>
    </section>
  );
};

/* ─── Small components ─── */

const Chip = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
    <Icon size={11} className="shrink-0" />
    {label}
  </span>
);

const GroupRows = ({ group }: { group: FeatureGroup }) => (
  <>
    <tr className="bg-muted/20">
      <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-accent">
        {group.title}
      </td>
    </tr>
    {group.rows.map((row, i) => (
      <tr key={i} className="border-b border-border/30 last:border-b-0">
        <td className="px-4 py-3 text-foreground">{row.label}</td>
        <td className="px-4 py-3 text-center">
          <CellIcon has={row.starter} />
        </td>
        <td className="px-4 py-3 text-center">
          <CellIcon has={row.business} />
        </td>
        <td className="px-4 py-3 text-center">
          <CellIcon has={row.enterprise} />
        </td>
      </tr>
    ))}
  </>
);

const CellIcon = ({ has }: { has: boolean }) =>
  has ? (
    <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent/10">
      <Check size={12} className="text-accent" />
    </div>
  ) : (
    <Minus size={14} className="inline text-muted-foreground/40" />
  );

const CellMobile = ({ label, has }: { label: string; has: boolean }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="text-muted-foreground">{label}</span>
    {has ? (
      <div className="h-4 w-4 rounded-full bg-accent/10 flex items-center justify-center">
        <Check size={10} className="text-accent" />
      </div>
    ) : (
      <Minus size={12} className="text-muted-foreground/40" />
    )}
  </div>
);

export default DynamicPricingSection;
