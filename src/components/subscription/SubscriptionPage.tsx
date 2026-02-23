import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Crown, Clock, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertTriangle, History, Zap, Shield, Calendar,
  Wallet, Building2, Sparkles, TrendingUp,
  Users, FileText, HardDrive, ShieldCheck, Star, BarChart3,
  Stamp, Headphones, Phone, ScrollText, Palette, UserCog,
  Globe, GraduationCap, Server, Handshake, Lock,
  Check, X, Rocket,
  BadgeCheck, CircleDollarSign, Timer, RefreshCw
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ROICalculator from "./ROICalculator";

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
  grace_period_days: number;
  sort_order: number;
}

interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  grace_ends_at: string | null;
  created_at: string;
}

interface SubLog {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
  old_plan_id: string | null;
  new_plan_id: string | null;
}

interface PlanEntitlement {
  plan_id: string;
  feature_key: string;
  is_enabled: boolean;
  limit_value: number | null;
}

const STATUS_MAP: Record<string, { label: string; class: string; icon: React.ReactNode; pulse?: boolean }> = {
  active: { label: "نشط", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: <CheckCircle2 size={14} />, pulse: true },
  trial: { label: "تجريبي", class: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <Clock size={14} />, pulse: true },
  past_due: { label: "فترة سماح", class: "bg-red-500/10 text-red-600 border-red-500/20", icon: <AlertTriangle size={14} /> },
  cancelled: { label: "ملغي", class: "bg-muted text-muted-foreground border-border", icon: <AlertTriangle size={14} /> },
  expired: { label: "منتهي", class: "bg-muted text-muted-foreground border-border", icon: <AlertTriangle size={14} /> },
};

const CYCLE_LABELS: Record<string, string> = { monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };
const ACTION_LABELS: Record<string, string> = {
  upgrade: "ترقية", downgrade: "تخفيض", cancel: "إلغاء", renew: "تجديد",
  extend: "تمديد", status_change: "تغيير حالة", plan_change: "تغيير خطة", cycle_change: "تغيير دورة",
};

const PLAN_META: Record<string, { popular?: boolean; tagline: string; gradient: string; summaryBadge?: string; icon: React.ReactNode; color: string; highlights?: string[]; emoji: string; valueTag?: string }> = {
  starter: { emoji: "⚡", tagline: "للمنشآت الناشئة والمتاجر الصغيرة", gradient: "from-slate-500/10 via-slate-500/5 to-transparent", icon: <Zap size={24} />, color: "text-slate-600 dark:text-slate-400" },
  business: { emoji: "👑", popular: true, tagline: "الأكثر طلباً — اختيار ٧٥٪ من عملائنا", gradient: "from-accent/20 via-accent/8 to-transparent", summaryBadge: "جميع الميزات مضمّنة", icon: <Crown size={24} />, color: "text-accent", highlights: ["ZATCA Phase 2 كامل", "AI محاسبي", "نظام موافقات", "دعم أولوية"], valueTag: "أفضل توازن بين السعر والقيمة" },
  professional: { emoji: "👑", popular: true, tagline: "الأكثر طلباً — اختيار ٧٥٪ من عملائنا", gradient: "from-accent/20 via-accent/8 to-transparent", summaryBadge: "جميع الميزات مضمّنة", icon: <Crown size={24} />, color: "text-accent", highlights: ["ZATCA Phase 2 كامل", "AI محاسبي", "نظام موافقات", "دعم أولوية"], valueTag: "أفضل توازن بين السعر والقيمة" },
  enterprise: { emoji: "🏢", tagline: "للمنشآت الكبرى والجهات الحكومية", gradient: "from-primary/15 via-primary/5 to-transparent", summaryBadge: "جميع الميزات + التكاملات", icon: <Building2 size={24} />, color: "text-primary", highlights: ["كل التكاملات المدفوعة مجاناً", "مدير حساب مخصص", "SLA مضمون"] },
};

// Static pricing display per plan slug (UI only, psychological pricing)
const STATIC_PRICING: Record<string, { monthly: string; yearly: string; yearlyNote: string; enterpriseNote?: string }> = {
  starter:      { monthly: "149", yearly: "119",  yearlyNote: "تُحسب سنوياً" },
  business:     { monthly: "399", yearly: "319",  yearlyNote: "تُحسب سنوياً" },
  professional: { monthly: "399", yearly: "319",  yearlyNote: "تُحسب سنوياً" },
  enterprise:   { monthly: "999", yearly: "799",  yearlyNote: "تُحسب سنوياً" },
};

// Feature highlights per plan for the new design (static, UI only)
const PLAN_QUICK_FEATURES: Record<string, string[]> = {
  starter:      ["2 مستخدمين", "100 فاتورة / شهر", "5GB تخزين", "تقارير أساسية", "ZATCA Phase 1", "فرع واحد"],
  business:     ["15 مستخدم", "فواتير غير محدودة", "100GB تخزين", "ZATCA Phase 2", "AI محاسبي", "5 فروع", "نظام موافقات"],
  professional: ["15 مستخدم", "فواتير غير محدودة", "100GB تخزين", "ZATCA Phase 2", "AI محاسبي", "5 فروع", "نظام موافقات"],
  enterprise:   ["مستخدمين غير محدود", "فواتير غير محدودة", "تخزين مخصص", "AI متقدم", "سير عمل مخصص", "تمويل داخلي", "مدير حساب", "SLA 99.9%"],
};

// Comparison table rows (UI only)
const COMPARISON_ROWS = [
  { label: "المستخدمون", starter: "2", business: "15", enterprise: "غير محدود" },
  { label: "الفواتير / شهر", starter: "100", business: "غير محدود", enterprise: "غير محدود" },
  { label: "التخزين", starter: "5GB", business: "100GB", enterprise: "مخصص" },
  { label: "الفروع", starter: "1", business: "5", enterprise: "غير محدود" },
  { label: "ZATCA Phase 2", starter: false, business: true, enterprise: true },
  { label: "إقرار ضريبي آلي", starter: false, business: true, enterprise: true },
  { label: "AI محاسبي", starter: false, business: "أساسي", enterprise: "متقدم" },
  { label: "نظام موافقات", starter: false, business: true, enterprise: true },
  { label: "التقارير", starter: "أساسية", business: "متقدمة", enterprise: "AI + تخصيص" },
  { label: "تكاملات مدفوعة", starter: false, business: true, enterprise: true },
  { label: "دعم أولوية", starter: false, business: true, enterprise: true },
  { label: "مدير حساب", starter: false, business: false, enterprise: true },
  { label: "SLA مخصص", starter: false, business: false, enterprise: true },
  { label: "API متقدمة", starter: false, business: false, enterprise: true },
  { label: "تمويل داخلي", starter: false, business: false, enterprise: true },
];

const FEATURE_LABELS: Record<string, string> = {
  invoices_basic: "الفواتير الإلكترونية",
  customers: "إدارة العملاء",
  zatca_phase1: "توافق ZATCA المرحلة 1",
  zatca_phase2: "توافق ZATCA المرحلة 2",
  limited_reports: "تقارير أساسية",
  expenses: "إدارة المصروفات",
  quotations: "عروض الأسعار",
  payment_reminders: "تذكيرات الدفع",
  contracts: "إدارة العقود",
  advanced_reports: "تقارير متقدمة",
  hr: "الموارد البشرية",
  accounting_advanced: "المحاسبة المتقدمة",
  wallet: "المحفظة الرقمية",
  paid_integrations: "التكاملات المدفوعة",
  inventory: "إدارة المخزون",
  branches: "إدارة الفروع",
  sales_orders: "أوامر البيع",
  purchase_orders: "أوامر الشراء",
  delivery_notes: "إشعارات التوصيل",
  journal_entries: "القيود اليومية",
  stamp: "الختم الإلكتروني",
  branding: "تخصيص الهوية",
  audit_log: "سجل المراجعة",
  team_management: "إدارة الفريق",
  analytics: "التحليلات",
  numaxio_pay: "بوابة دفع نيوماكسيو",
  max_users: "عدد المستخدمين",
  max_storage_gb: "مساحة التخزين",
  sla_support: "دعم SLA مضمون",
  dedicated_support: "مدير حساب مخصص",
  api_access: "وصول API كامل",
  unlimited_everything: "كل شيء غير محدود",
  ai_accounting: "AI محاسبي",
  approvals_enabled: "نظام الموافقات",
  custom_workflows: "سير عمل مخصص",
  internal_financing: "تمويل داخلي",
  vat_auto_return: "إقرار ضريبي آلي",
};

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  invoices_basic: <FileText size={14} />,
  customers: <Users size={14} />,
  expenses: <CircleDollarSign size={14} />,
  quotations: <ScrollText size={14} />,
  contracts: <Handshake size={14} />,
  inventory: <Server size={14} />,
  branches: <Building2 size={14} />,
  team_management: <UserCog size={14} />,
  analytics: <BarChart3 size={14} />,
  branding: <Palette size={14} />,
  stamp: <Stamp size={14} />,
  audit_log: <Shield size={14} />,
  wallet: <Wallet size={14} />,
  numaxio_pay: <CreditCard size={14} />,
  hr: <GraduationCap size={14} />,
  api_access: <Globe size={14} />,
  sla_support: <Headphones size={14} />,
  dedicated_support: <Phone size={14} />,
};

const QUOTA_KEYS = new Set(["max_users", "max_storage_gb", "max_invoices"]);
const EXCLUDED_FROM_LIST = new Set(["max_users", "max_storage_gb"]);
const INITIAL_VISIBLE = 6;

const MOTIVATIONAL_MESSAGES = [
  { text: "استثمر في نمو أعمالك 🚀", sub: "الأدوات المناسبة تصنع الفارق" },
  { text: "باقتك الحالية ممتازة", sub: "الترقية تعني وقت أقل وجهد أقل" },
  { text: "أكثر من 500 شركة تثق بنيوماكسيو", sub: "انضم لمجتمع الأعمال الذكي" },
];

/* ─── Animated Counter ─── */
const AnimatedPrice = ({ value }: { value: number }) => {
  const animated = useCountUp(value, 600);
  return <span className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums">{animated.toLocaleString("ar-SA")}</span>;
};

/* ─── Skeleton Loader ─── */
const SubscriptionSkeleton = () => (
  <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto" dir="rtl">
    {/* Header skeleton */}
    <div className="space-y-3">
      <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
      <div className="h-4 w-64 bg-muted/60 animate-pulse rounded-md" />
    </div>
    {/* Summary card skeleton */}
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-muted animate-pulse rounded-2xl" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-36 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-48 bg-muted/60 animate-pulse rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-muted/30 p-4 space-y-2">
            <div className="h-8 w-12 bg-muted animate-pulse rounded mx-auto" />
            <div className="h-3 w-16 bg-muted/60 animate-pulse rounded mx-auto" />
          </div>
        ))}
      </div>
      <div className="h-3 w-full bg-muted/40 animate-pulse rounded-full" />
    </div>
    {/* Plans skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="h-6 w-28 bg-muted animate-pulse rounded-lg" />
          <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
          <div className="space-y-2">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-4 w-full bg-muted/40 animate-pulse rounded" />
            ))}
          </div>
          <div className="h-12 w-full bg-muted animate-pulse rounded-xl" />
        </div>
      ))}
    </div>
  </div>
);

const SubscriptionPage = () => {
  const { user, tenantId } = useAuth();
  const { invalidate: invalidateEntitlements } = useEntitlementsContext();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planEntitlements, setPlanEntitlements] = useState<PlanEntitlement[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [logs, setLogs] = useState<SubLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<string>("monthly");
  const [expandedPlans, setExpandedPlans] = useState<Record<string, boolean>>({});
  const [usage, setUsage] = useState<any>(null);
  const [activeMotivation, setActiveMotivation] = useState(0);

  const fetchData = async () => {
    if (!tenantId) return;
    const [plansRes, subRes, logsRes, entRes, usageRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("subscription_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      supabase.from("plan_entitlements").select("plan_id, feature_key, is_enabled, limit_value"),
      supabase.rpc("get_tenant_usage_summary", { _tenant_id: tenantId }),
    ]);
    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (subRes.data) {
      setSubscription(subRes.data as Subscription);
      setSelectedCycle(subRes.data.billing_cycle);
    }
    if (logsRes.data) setLogs(logsRes.data as SubLog[]);
    if (entRes.data) setPlanEntitlements(entRes.data as PlanEntitlement[]);
    if (usageRes.data) setUsage(usageRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  // Rotate motivational messages
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMotivation((prev) => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentPlan = plans.find((p) => p.id === subscription?.plan_id);

  const getEntitlementsForPlan = (planId: string) =>
    planEntitlements.filter((e) => e.plan_id === planId);

  const isFeatureEnabled = (planId: string, featureKey: string): boolean => {
    const ent = planEntitlements.find((e) => e.plan_id === planId && e.feature_key === featureKey);
    return ent?.is_enabled ?? false;
  };

  const getFeatureLimit = (planId: string, featureKey: string): number | null => {
    const ent = planEntitlements.find((e) => e.plan_id === planId && e.feature_key === featureKey);
    return ent?.limit_value ?? null;
  };

  const getAllFeatureKeys = (): string[] => {
    const keys = new Set<string>();
    planEntitlements.forEach((e) => {
      if (!EXCLUDED_FROM_LIST.has(e.feature_key)) {
        keys.add(e.feature_key);
      }
    });
    return Array.from(keys);
  };

  const getPlanPrice = (plan: Plan, cycle: string) => {
    if (cycle === "yearly" && plan.price_yearly) return plan.price_yearly;
    if (cycle === "quarterly" && plan.price_quarterly) return plan.price_quarterly;
    return plan.price_monthly;
  };

  const getMonthlyEquivalent = (plan: Plan, cycle: string) => {
    if (cycle === "yearly" && plan.price_yearly) return plan.price_yearly / 12;
    if (cycle === "quarterly" && plan.price_quarterly) return plan.price_quarterly / 3;
    return plan.price_monthly;
  };

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / 86400000))
    : 0;

  const totalDays = subscription
    ? Math.ceil((new Date(subscription.current_period_end).getTime() - new Date(subscription.current_period_start).getTime()) / 86400000)
    : 1;

  const progressPct = totalDays > 0 ? Math.round(((totalDays - daysRemaining) / totalDays) * 100) : 0;

  const navigateToUpgrade = (plan: Plan) => {
    navigate(`/dashboard/subscription/upgrade?plan_id=${plan.id}`);
  };

  const handleCancel = async () => {
    if (!subscription || !user) return;

    try {
      const response = await supabase.functions.invoke("cancel-subscription");

      if (response.error || !response.data?.success) {
        const errMsg = response.data?.error || response.error?.message || "فشلت العملية";
        toast({ title: "خطأ", description: errMsg, variant: "destructive" });
        return;
      }

      toast({ title: "تم", description: response.data.message });
      fetchData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "حدث خطأ غير متوقع", variant: "destructive" });
    }
  };

  if (loading) return <SubscriptionSkeleton />;

  const allFeatureKeys = getAllFeatureKeys();
  const isHighestPlan = currentPlan && plans.every(p => p.sort_order <= (currentPlan.sort_order || 0));
  const currentMeta = currentPlan ? (PLAN_META[currentPlan.slug] || PLAN_META.starter) : PLAN_META.starter;

  const countEnabledFeatures = (planId: string) =>
    planEntitlements.filter((e) => e.plan_id === planId && e.is_enabled && !EXCLUDED_FROM_LIST.has(e.feature_key)).length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-6xl mx-auto" dir="rtl" style={{ direction: "rtl", textAlign: "right" }}>

        {/* ═══════ 1️⃣ Smart Header ═══════ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">إدارة اشتراكك</h1>
            <p className="text-sm text-muted-foreground">عرض تفاصيل باقتك والترقية بخطوة واحدة</p>
          </div>
          <div className="flex items-center gap-2">
            {subscription && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                <Badge
                  variant="outline"
                  className={`${STATUS_MAP[subscription.status]?.class || ""} px-3 py-1.5 text-sm font-semibold border gap-1.5`}
                >
                  {STATUS_MAP[subscription.status]?.pulse && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                    </span>
                  )}
                  {STATUS_MAP[subscription.status]?.label || subscription.status}
                </Badge>
              </motion.div>
            )}
            {currentPlan && !isHighestPlan && (
              <Button
                size="sm"
                className="gap-2 rounded-xl shadow-lg shadow-accent/10 h-10 px-5"
                onClick={() => {
                  const nextPlan = plans.find(p => p.sort_order > (currentPlan.sort_order || 0));
                  if (nextPlan) navigateToUpgrade(nextPlan);
                }}
              >
                <Rocket size={16} />
                ترقية الآن
              </Button>
            )}
          </div>
        </motion.div>

        {/* ═══════ 2️⃣ Animated Summary Card ═══════ */}
        {subscription && currentPlan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="relative overflow-hidden border-0 shadow-xl shadow-accent/5 bg-gradient-to-bl from-card via-card to-accent/[0.02]">
              {/* Decorative elements */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-l from-accent via-primary/60 to-accent/30" />
              <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />
              <div className="absolute -bottom-16 -right-16 w-32 h-32 rounded-full bg-primary/5 blur-2xl" />

              <CardContent className="relative p-5 sm:p-7">
                <div className="flex flex-col gap-5">
                  {/* Plan info row */}
                  <div className="flex items-start gap-4">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${currentMeta.gradient} border border-accent/10 shrink-0`}
                    >
                      <span className={currentMeta.color}>{currentMeta.icon}</span>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{currentPlan.name_ar}</h2>
                        {currentPlan.slug !== "starter" && (
                          <Crown size={18} className="text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{currentMeta.tagline}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">{CYCLE_LABELS[subscription.billing_cycle]}</Badge>
                        {subscription.cancel_at_period_end && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle size={10} />
                            سيتم الإلغاء
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price + Progress */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">السعر الحالي</p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedPrice value={getPlanPrice(currentPlan, subscription.billing_cycle)} />
                        <span className="text-sm text-muted-foreground">ر.س / {CYCLE_LABELS[subscription.billing_cycle]}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Timer size={14} />
                          <span>المتبقي: <span className="font-bold text-foreground">{daysRemaining} يوم</span></span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{progressPct}%</span>
                      </div>
                      <div className="relative">
                        <Progress value={progressPct} className="h-2.5 rounded-full" />
                        {progressPct > 80 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute -top-1 -right-1"
                            style={{ right: `${100 - progressPct}%` }}
                          >
                            <span className="flex h-4 w-4">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
                            </span>
                          </motion.div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>التجديد: {new Date(subscription.current_period_end).toLocaleDateString("ar-SA")}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <RefreshCw size={12} />
                          <span>تلقائي</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quota Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { icon: Users, value: getFeatureLimit(currentPlan.id, "max_users"), label: "مستخدم", show: !!getFeatureLimit(currentPlan.id, "max_users") },
                      { icon: FileText, value: currentPlan.max_invoices, label: "فاتورة/شهر", show: !!currentPlan.max_invoices },
                      { icon: HardDrive, value: getFeatureLimit(currentPlan.id, "max_storage_gb"), label: "GB تخزين", show: !!getFeatureLimit(currentPlan.id, "max_storage_gb") },
                      { icon: ShieldCheck, value: currentPlan.grace_period_days, label: "يوم سماح", show: true },
                    ].filter(q => q.show).map((q, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + idx * 0.05 }}
                        className="rounded-xl bg-muted/30 border border-border/50 p-3 text-center hover:bg-muted/50 transition-colors"
                      >
                        <q.icon size={16} className="mx-auto mb-1.5 text-accent" />
                        <p className="text-xl font-bold text-foreground tabular-nums">{q.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{q.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Grace period warning */}
                {subscription.status === "past_due" && subscription.grace_ends_at && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3"
                  >
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">تنبيه مهم</p>
                      <p className="text-xs mt-1">
                        فترة السماح تنتهي في {new Date(subscription.grace_ends_at).toLocaleDateString("ar-SA")} — يرجى تجديد الاشتراك لتجنب الإيقاف
                      </p>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══════ 3️⃣ Current Plan Features ═══════ */}
        {currentPlan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BadgeCheck size={18} className="text-accent" />
                    مميزات باقتك الحالية
                  </CardTitle>
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 size={10} />
                    {countEnabledFeatures(currentPlan.id)} ميزة مفعّلة
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {allFeatureKeys.map((key, idx) => {
                    const enabled = isFeatureEnabled(currentPlan.id, key);
                    const limit = getFeatureLimit(currentPlan.id, key);
                    const label = FEATURE_LABELS[key] || key;
                    const icon = FEATURE_ICONS[key];

                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                      >
                        {enabled ? (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/30 transition-colors group">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 shrink-0 group-hover:bg-accent/15 transition-colors">
                              {icon || <Check size={14} className="text-accent" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-foreground">{label}</span>
                              {limit !== null && (
                                <span className="text-xs text-muted-foreground mr-1">({limit})</span>
                              )}
                            </div>
                            <CheckCircle2 size={14} className="text-accent/60 shrink-0" />
                          </div>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2.5 p-2.5 rounded-xl opacity-50 cursor-pointer hover:opacity-70 transition-opacity">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 shrink-0">
                                  <Lock size={14} className="text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/30 flex-1">
                                  {label}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]" dir="rtl">
                              <p className="text-xs">هذه الميزة متاحة في الباقات الأعلى. قم بالترقية للاستفادة منها.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══════ 6️⃣ Motivational Banner ═══════ */}
        {currentPlan && !isHighestPlan && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-accent/10 via-primary/5 to-accent/5 border border-accent/10 p-5 sm:p-6"
          >
            <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
            <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-primary/10 blur-2xl" />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeMotivation}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="relative text-center space-y-2"
              >
                <p className="text-lg sm:text-xl font-bold text-foreground">
                  {MOTIVATIONAL_MESSAGES[activeMotivation].text}
                </p>
                <p className="text-sm text-muted-foreground">
                  {MOTIVATIONAL_MESSAGES[activeMotivation].sub}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-1.5 mt-4 relative">
              {MOTIVATIONAL_MESSAGES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveMotivation(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeMotivation ? "w-6 bg-accent" : "w-1.5 bg-accent/30"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════ Main Tabs ═══════ */}
        <Tabs defaultValue="plans" className="space-y-5" dir="rtl">
          <TabsList className="w-full sm:w-auto bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="plans" className="gap-1.5 flex-1 sm:flex-initial h-10 sm:h-9 text-sm rounded-lg data-[state=active]:shadow-md"><Zap size={14} /> الخطط</TabsTrigger>
            <TabsTrigger value="usage" className="gap-1.5 flex-1 sm:flex-initial h-10 sm:h-9 text-sm rounded-lg data-[state=active]:shadow-md"><TrendingUp size={14} /> الاستخدام</TabsTrigger>
            <TabsTrigger value="compare" className="gap-1.5 flex-1 sm:flex-initial h-10 sm:h-9 text-sm rounded-lg data-[state=active]:shadow-md"><BarChart3 size={14} /> مقارنة</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 flex-1 sm:flex-initial h-10 sm:h-9 text-sm rounded-lg data-[state=active]:shadow-md"><History size={14} /> السجل</TabsTrigger>
          </TabsList>

          {/* ═══════ 4️⃣ Plans Tab ═══════ */}
          <TabsContent value="plans">

            {/* ── Billing Toggle ── */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <p className="text-sm text-muted-foreground">اختر دورة الفوترة</p>
              <div className="inline-flex items-center gap-1 p-1.5 bg-muted/60 rounded-2xl border border-border/50 shadow-sm">
                <button
                  onClick={() => setSelectedCycle("monthly")}
                  className={`relative px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    selectedCycle === "monthly"
                      ? "bg-background text-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  شهري
                </button>
                <button
                  onClick={() => setSelectedCycle("yearly")}
                  className={`relative px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                    selectedCycle === "yearly"
                      ? "bg-background text-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  سنوي
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full px-2 py-0.5">
                    وفر 20%
                  </span>
                </button>
              </div>
            </div>

            {/* ── Plan Cards (RTL: أساسي | احترافي | مؤسسي) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch" dir="rtl">
              {plans.map((plan, i) => {
                const isCurrent = plan.id === subscription?.plan_id;
                const meta = PLAN_META[plan.slug] || { emoji: "⚡", popular: false, tagline: "", gradient: "from-muted/50 to-transparent", icon: <Zap size={24} />, color: "text-muted-foreground" };
                const isPopular = !!meta.popular;
                const staticPricing = STATIC_PRICING[plan.slug];
                const displayPrice = selectedCycle === "yearly" ? staticPricing?.yearly : staticPricing?.monthly;
                const quickFeatures = PLAN_QUICK_FEATURES[plan.slug] || [];

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className={`relative flex flex-col ${isPopular ? "md:-mt-3 md:mb-[-12px] z-10" : ""}`}
                  >
                    <Card
                      className={`relative h-full flex flex-col transition-all duration-300 overflow-hidden rounded-2xl ${
                        isPopular
                          ? "border-accent ring-2 ring-accent/30 shadow-2xl shadow-accent/15 md:scale-[1.05]"
                          : isCurrent
                          ? "border-accent/60 ring-1 ring-accent/20 shadow-xl shadow-accent/10"
                          : plan.slug === "enterprise"
                          ? "border-primary/30 ring-1 ring-primary/10 shadow-lg"
                          : "border-border/60 hover:border-accent/30 hover:shadow-lg"
                      }`}
                    >
                      {/* Top color bar */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${
                        isPopular
                          ? "bg-gradient-to-l from-accent to-accent/60"
                          : plan.slug === "enterprise"
                          ? "bg-gradient-to-l from-primary to-primary/60"
                          : "bg-gradient-to-l from-muted-foreground/20 to-transparent"
                      }`} />

                      {/* Badge: الأكثر طلباً */}
                      {isPopular && (
                        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-0">
                          <motion.div
                            initial={{ scale: 0, y: -10 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ delay: 0.4, type: "spring" }}
                          >
                            <Badge className="bg-gradient-to-l from-accent to-accent/80 text-accent-foreground flex items-center gap-1.5 rounded-b-xl rounded-t-none px-4 py-1.5 text-xs shadow-lg font-bold">
                              <Star size={11} />
                              ⭐ الأكثر طلباً
                            </Badge>
                          </motion.div>
                        </div>
                      )}

                      {/* Current plan badge */}
                      {isCurrent && !isPopular && (
                        <div className="absolute top-0 right-4">
                          <Badge className="bg-accent text-accent-foreground flex items-center gap-1 rounded-b-lg rounded-t-none px-3 py-1 text-[11px] shadow-md">
                            <Sparkles size={9} />
                            خطتك الحالية
                          </Badge>
                        </div>
                      )}
                      {isCurrent && isPopular && (
                        <div className="absolute top-7 left-3">
                          <Badge className="bg-accent text-accent-foreground flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] shadow-md">
                            <Sparkles size={9} />
                            الحالية
                          </Badge>
                        </div>
                      )}

                      <CardHeader className={`pb-4 ${isPopular ? "pt-10" : "pt-8"}`}>
                        {/* Icon + Name */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${
                            isPopular
                              ? "bg-accent/10 border border-accent/20"
                              : plan.slug === "enterprise"
                              ? "bg-primary/10 border border-primary/20"
                              : "bg-muted/60 border border-border/50"
                          }`}>
                            {meta.emoji}
                          </div>
                          <div>
                            <CardTitle className={`text-xl font-bold ${isPopular ? "text-accent" : plan.slug === "enterprise" ? "text-primary" : "text-foreground"}`}>
                              {plan.name_ar}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.tagline}</p>
                          </div>
                        </div>

                        {/* Value tag for professional */}
                        {'valueTag' in meta && meta.valueTag && (
                          <div className="mb-3">
                            <span className="text-xs text-accent font-medium bg-accent/8 border border-accent/15 rounded-full px-3 py-1">
                              {(meta as any).valueTag}
                            </span>
                          </div>
                        )}

                        {/* Price */}
                        <div className="mt-2">
                          {false ? (
                            <div />
                          ) : (
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className={`text-4xl font-black ${isPopular ? "text-accent" : "text-foreground"}`}>
                                  {displayPrice}
                                </span>
                                <span className="text-sm text-muted-foreground">ر.س/شهر</span>
                              </div>
                              {selectedCycle === "yearly" && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-xs text-muted-foreground line-through">{staticPricing?.monthly} ر.س</span>
                                  <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-0 text-[10px] px-2 py-0.5 font-bold">
                                    وفر 20%
                                  </Badge>
                                </div>
                              )}
                              {selectedCycle === "yearly" && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{staticPricing?.yearlyNote}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col pb-6 pt-0 gap-5">
                        {/* Divider */}
                        <div className={`h-px ${isPopular ? "bg-accent/20" : "bg-border/50"}`} />

                        {/* Quick features list */}
                        <ul className="space-y-2.5 flex-1">
                          {quickFeatures.map((feature, fi) => (
                            <motion.li
                              key={fi}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 + fi * 0.04 + 0.2 }}
                              className="flex items-center gap-2.5 text-sm"
                            >
                              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                isPopular
                                  ? "bg-accent/15 text-accent"
                                  : plan.slug === "enterprise"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                <Check size={11} className="font-bold" />
                              </div>
                              <span className="text-foreground/85">{feature}</span>
                            </motion.li>
                          ))}
                        </ul>

                        {/* CTAs */}
                        <div className="space-y-2 mt-auto pt-2">
                          {isCurrent ? (
                            <Button variant="outline" className="w-full gap-2 h-12 rounded-xl font-semibold" disabled>
                              <CheckCircle2 size={16} />
                              خطتك الحالية
                            </Button>
                          ) : isPopular ? (
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                className="w-full gap-2 h-13 rounded-xl font-bold text-base shadow-xl shadow-accent/25 bg-accent hover:bg-accent/90"
                                onClick={() => navigateToUpgrade(plan)}
                              >
                                {(currentPlan?.sort_order || 0) < plan.sort_order ? (
                                  <><Rocket size={18} /> اشترك الآن</>
                                ) : (
                                  <><ArrowDownRight size={18} /> تخفيض</>
                                )}
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                variant="outline"
                                className="w-full gap-2 h-12 rounded-xl font-semibold border-2"
                                onClick={() => navigateToUpgrade(plan)}
                              >
                                {(currentPlan?.sort_order || 0) < plan.sort_order ? (
                                  <><ArrowUpRight size={16} /> ابدأ الآن</>
                                ) : (
                                  <><ArrowDownRight size={16} /> تخفيض</>
                                )}
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Quick Comparison Table ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-10"
            >
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-foreground">مقارنة سريعة بين الباقات</h3>
                <p className="text-sm text-muted-foreground mt-1">تعرّف على الفروقات الجوهرية بين كل باقة</p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-border/50 shadow-sm">
                <table className="w-full text-sm" dir="rtl">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-right py-4 px-5 font-semibold text-foreground min-w-[160px]">الميزة</th>
                      {plans.map((plan) => {
                        const meta = PLAN_META[plan.slug];
                        const isPopular = !!meta?.popular;
                        return (
                          <th key={plan.id} className={`text-center py-4 px-4 font-bold min-w-[110px] ${isPopular ? "text-accent" : "text-foreground"}`}>
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-lg">{meta?.emoji}</span>
                              <span className="text-xs">{plan.name_ar}</span>
                              {isPopular && (
                                <Badge className="bg-accent/10 text-accent border-accent/20 text-[9px] px-1.5 py-0 mt-0.5">الأكثر طلباً</Badge>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_ROWS.map((row, ri) => (
                      <tr key={ri} className={`border-b border-border/30 ${ri % 2 === 0 ? "bg-background" : "bg-muted/10"} hover:bg-muted/20 transition-colors`}>
                        <td className="py-3.5 px-5 font-medium text-foreground/85">{row.label}</td>
                        {(["starter", "business", "enterprise"] as const).map((slug) => {
                          const val = row[slug];
                          const isPopularCol = slug === "business";
                          return (
                            <td key={slug} className={`py-3.5 px-4 text-center ${isPopularCol ? "bg-accent/[0.03]" : ""}`}>
                              {typeof val === "boolean" ? (
                                val ? (
                                  <div className="flex items-center justify-center">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                                      <Check size={13} className="text-emerald-600 dark:text-emerald-400 font-bold" />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50 text-lg font-light">—</span>
                                )
                              ) : (
                                <span className={`text-xs font-semibold ${isPopularCol ? "text-accent" : "text-foreground/70"}`}>
                                  {val}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Cancel + ROI */}
            {subscription && !subscription.cancel_at_period_end && subscription.status === "active" && (
              <div className="mt-8 text-center">
                <Button variant="ghost" className="text-destructive/70 hover:text-destructive h-11 sm:h-10 text-sm" onClick={handleCancel}>
                  إلغاء الاشتراك عند نهاية الفترة
                </Button>
              </div>
            )}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8">
              <ROICalculator />
            </motion.div>
          </TabsContent>

          {/* ═══════ Compare Tab ═══════ */}
          <TabsContent value="compare">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={18} className="text-accent" />
                  مصفوفة مقارنة الميزات
                </CardTitle>
                <CardDescription>مقارنة شاملة لجميع الميزات حسب الباقة</CardDescription>
              </CardHeader>
              <CardContent className="-mx-2 sm:mx-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" dir="rtl">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-right py-3 px-2 sm:px-4 font-medium text-muted-foreground min-w-[140px] sm:min-w-[180px]">الميزة</th>
                        {plans.map((plan) => (
                          <th key={plan.id} className="text-center py-3 px-2 sm:px-4 font-semibold text-foreground min-w-[80px] sm:min-w-[100px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs sm:text-sm">{plan.name_ar}</span>
                              {plan.id === subscription?.plan_id && (
                                <Badge className="bg-accent text-accent-foreground text-[9px] px-1.5 py-0">الحالية</Badge>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allFeatureKeys.map((key, idx) => (
                        <motion.tr
                          key={key}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2.5 px-2 sm:px-4 text-right text-foreground text-xs sm:text-sm">
                            {FEATURE_LABELS[key] || key}
                          </td>
                          {plans.map((plan) => {
                            const enabled = isFeatureEnabled(plan.id, key);
                            const limit = getFeatureLimit(plan.id, key);
                            return (
                              <td key={plan.id} className="py-2.5 px-2 sm:px-4 text-center">
                                {enabled ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10">
                                      <Check size={12} className="text-accent" />
                                    </div>
                                    {limit !== null && (
                                      <span className="text-[10px] text-muted-foreground">{limit}</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/40">
                                      <X size={12} className="text-muted-foreground/25" />
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ Usage Tab ═══════ */}
          <TabsContent value="usage">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp size={18} className="text-accent" />
                  استخدام الموارد
                </CardTitle>
                <CardDescription>
                  {usage?.is_trial
                    ? "الفترة التجريبية — جميع الحدود غير مفعّلة"
                    : "مراقبة استهلاك الموارد حسب باقتك الحالية"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {usage ? (
                  <>
                    {([
                      {
                        key: "users",
                        label: "المستخدمون",
                        icon: Users,
                        current: usage.users?.current ?? 0,
                        limit: usage.users?.limit,
                        unlimited: usage.users?.unlimited,
                        unit: "مستخدم",
                      },
                      {
                        key: "invoices",
                        label: "الفواتير الشهرية",
                        icon: FileText,
                        current: usage.invoices_monthly?.current ?? 0,
                        limit: usage.invoices_monthly?.limit,
                        unlimited: usage.invoices_monthly?.unlimited,
                        unit: "فاتورة",
                      },
                      {
                        key: "storage",
                        label: "التخزين",
                        icon: HardDrive,
                        current: usage.storage_gb?.current ?? 0,
                        limit: usage.storage_gb?.limit,
                        unlimited: usage.storage_gb?.unlimited,
                        unit: "GB",
                      },
                    ] as const).map((item, idx) => {
                      const pct = item.unlimited || !item.limit
                        ? 0
                        : Math.min(100, Math.round((item.current / item.limit) * 100));
                      const isWarning = !item.unlimited && item.limit && pct >= 80 && pct < 100;
                      const isCritical = !item.unlimited && item.limit && pct >= 100;

                      return (
                        <motion.div
                          key={item.key}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="space-y-2.5 p-4 rounded-xl bg-muted/20 border border-border/30"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                isCritical ? "bg-destructive/10" : isWarning ? "bg-amber-500/10" : "bg-accent/10"
                              }`}>
                                <item.icon size={18} className={
                                  isCritical ? "text-destructive" : isWarning ? "text-amber-600" : "text-accent"
                                } />
                              </div>
                              <span className="font-medium text-sm text-foreground">{item.label}</span>
                            </div>
                            <div className="text-left text-sm">
                              {usage.is_trial ? (
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">غير محدود (تجريبي)</Badge>
                              ) : item.unlimited ? (
                                <Badge variant="outline" className="text-xs">غير محدود</Badge>
                              ) : (
                                <span className={`font-bold ${isCritical ? "text-destructive" : isWarning ? "text-amber-600" : "text-foreground"}`}>
                                  {item.current} / {item.limit} {item.unit}
                                </span>
                              )}
                            </div>
                          </div>

                          {!usage.is_trial && !item.unlimited && item.limit && (
                            <>
                              <Progress
                                value={pct}
                                className={`h-2.5 ${
                                  isCritical ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-amber-500" : ""
                                }`}
                              />
                              <AnimatePresence>
                                {isWarning && !isCritical && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400"
                                  >
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span>تحذير: وصلت إلى {pct}% من الحد المسموح. يُنصح بالترقية قريباً.</span>
                                  </motion.div>
                                )}
                                {isCritical && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                                  >
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span>تم الوصول للحد الأقصى! لن تتمكن من إضافة المزيد. يرجى ترقية الباقة.</span>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </motion.div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">جارٍ تحميل بيانات الاستخدام...</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════ History Tab ═══════ */}
          <TabsContent value="history">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History size={18} className="text-accent" />
                  سجل التغييرات
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <History size={40} className="mx-auto text-muted-foreground/30" />
                    <p>لا توجد تغييرات مسجلة</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log, idx) => {
                      const planName = (planId: string | null) => plans.find((p) => p.id === planId)?.name_ar || "";
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="flex items-start gap-3 rounded-xl border border-border/50 p-4 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50">
                            <Calendar size={16} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                              <span className="font-medium text-sm">{ACTION_LABELS[log.action] || log.action}</span>
                              <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
                            </div>
                            {log.old_plan_id && log.new_plan_id && (
                              <p className="text-xs text-muted-foreground">{planName(log.old_plan_id)} ← {planName(log.new_plan_id)}</p>
                            )}
                            {log.old_status && log.new_status && (
                              <p className="text-xs text-muted-foreground">
                                {STATUS_MAP[log.old_status]?.label || log.old_status} ← {STATUS_MAP[log.new_status]?.label || log.new_status}
                              </p>
                            )}
                            {log.notes && <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 mt-1">{log.notes}</p>}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ═══════ Mobile Fixed CTA ═══════ */}
        {isMobile && currentPlan && !isHighestPlan && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-2xl"
          >
            <Button
              className="w-full gap-2 h-14 text-base rounded-xl shadow-lg shadow-accent/20"
              onClick={() => {
                const nextPlan = plans.find(p => p.sort_order > (currentPlan.sort_order || 0));
                if (nextPlan) navigateToUpgrade(nextPlan);
              }}
            >
              <Rocket size={18} />
              ترقية باقتك الآن
            </Button>
          </motion.div>
        )}

        {/* Extra bottom padding on mobile for fixed CTA */}
        {isMobile && currentPlan && !isHighestPlan && <div className="h-20" />}

      </div>
    </TooltipProvider>
  );
};

export default SubscriptionPage;
