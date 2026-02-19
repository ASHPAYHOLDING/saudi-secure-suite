import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Crown, Clock, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertTriangle, History, Zap, Shield, Calendar,
  Wallet, Building2, Loader2, Upload, Copy, Sparkles, TrendingUp,
  Users, FileText, HardDrive, ShieldCheck, Star, BarChart3,
  Stamp, Headphones, Phone, ScrollText, Palette, UserCog,
  Globe, GraduationCap, Server, Handshake, Award, Lock, QrCode,
  ChevronDown, Check, X, Plug, Rocket, Gift, ArrowLeft, ArrowRight,
  BadgeCheck, Flame, CircleDollarSign, Timer, RefreshCw
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import DiscountCodeInput from "./DiscountCodeInput";
import BankTransferForm from "./BankTransferForm";
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

const PLAN_META: Record<string, { popular?: boolean; tagline: string; gradient: string; summaryBadge?: string; icon: React.ReactNode; color: string; highlights?: string[] }> = {
  starter: { tagline: "للمنشآت الناشئة والمتاجر الصغيرة", gradient: "from-accent/10 via-accent/5 to-transparent", icon: <Zap size={22} />, color: "text-accent" },
  professional: { popular: true, tagline: "الأكثر طلباً — اختيار ٧٥٪ من عملائنا", gradient: "from-accent/15 via-accent/5 to-transparent", summaryBadge: "جميع الميزات مضمّنة", icon: <Crown size={22} />, color: "text-accent", highlights: ["أدوات متقدمة للنمو", "دعم أولوية"] },
  enterprise: { tagline: "للمنشآت الكبرى والجهات الحكومية", gradient: "from-primary/15 via-primary/5 to-transparent", summaryBadge: "جميع الميزات + التكاملات", icon: <Building2 size={22} />, color: "text-primary", highlights: ["كل التكاملات المدفوعة مجاناً", "مدير حساب مخصص", "SLA مضمون"] },
};

const FEATURE_LABELS: Record<string, string> = {
  invoices_basic: "الفواتير الإلكترونية",
  customers: "إدارة العملاء",
  zatca_phase1: "توافق ZATCA المرحلة 1",
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
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planEntitlements, setPlanEntitlements] = useState<PlanEntitlement[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [logs, setLogs] = useState<SubLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeDialog, setUpgradeDialog] = useState<Plan | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string>("monthly");
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const [discountCode, setDiscountCode] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paylink" | "bank_transfer">("wallet");
  const [bankReference, setBankReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [upgrading, setUpgrading] = useState(false);
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

  // ─── Business Logic (unchanged) ───
  const handleUpgrade = async (plan: Plan) => {
    if (!subscription || !user || !tenantId) return;
    if (plan.slug === "enterprise") {
      toast({ title: "تواصل معنا", description: "باقة المؤسسي تتطلب التواصل مع فريق المبيعات", variant: "default" });
      return;
    }
    setUpgrading(true);
    const idempotencyKey = `${tenantId}-${plan.id}-${selectedCycle}-${Date.now()}`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "خطأ", description: "يرجى تسجيل الدخول أولاً", variant: "destructive" });
        setUpgrading(false);
        return;
      }

      const finalAmount = discountedPrice ?? getPlanPrice(plan, selectedCycle);

      if (paymentMethod === "wallet") {
        const response = await supabase.functions.invoke("upgrade-subscription", {
          body: {
            plan_id: plan.id,
            billing_cycle: selectedCycle,
            discount_code: discountedPrice !== null ? discountCode : undefined,
            idempotency_key: idempotencyKey,
          },
        });

        if (response.error || !response.data?.success) {
          if (response.data?.already_processed) {
            toast({ title: "تنبيه", description: "تمت معالجة هذا الطلب مسبقاً" });
            setUpgradeDialog(null);
            fetchData();
            setUpgrading(false);
            return;
          }
          const errMsg = response.data?.error || response.error?.message || "فشلت العملية";
          if (response.data?.insufficient_balance) {
            toast({
              title: "رصيد غير كافي",
              description: `المطلوب: ${response.data.required} ر.س — المتاح: ${response.data.available} ر.س. يرجى شحن المحفظة أولاً`,
              variant: "destructive",
            });
          } else if (response.data?.needs_wallet) {
            toast({ title: "خطأ", description: "يرجى إنشاء محفظة رقمية أولاً من قسم المحفظة", variant: "destructive" });
          } else {
            toast({ title: "خطأ", description: errMsg, variant: "destructive" });
          }
          setUpgrading(false);
          return;
        }

        toast({ title: "تم بنجاح ✅", description: response.data.message });
      } else if (paymentMethod === "paylink") {
        const orderNum = `SUB-${Date.now()}`;
        const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-webhook?action=webhook`;
        const callbackUrl = `${window.location.origin}/dashboard/subscription?upgrade=pending&plan_id=${plan.id}&cycle=${selectedCycle}`;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", user.id)
          .maybeSingle();

        const response = await supabase.functions.invoke("paylink-gateway?action=create-invoice", {
          body: {
            amount: finalAmount,
            clientName: profile?.full_name || "عميل",
            clientMobile: profile?.phone || "0500000000",
            clientEmail: profile?.email || "",
            orderNumber: orderNum,
            callBackUrl: callbackUrl,
            note: `ترقية اشتراك إلى ${plan.name_ar}`,
            products: [{ title: `اشتراك ${plan.name_ar} - ${CYCLE_LABELS[selectedCycle]}`, price: finalAmount, qty: 1 }],
          },
        });

        if (response.error || !response.data?.success) {
          toast({ title: "خطأ", description: response.data?.error || "فشل إنشاء رابط الدفع", variant: "destructive" });
          setUpgrading(false);
          return;
        }

        await supabase.from("subscription_upgrade_requests").insert({
          tenant_id: tenantId,
          requested_by: user.id,
          plan_id: plan.id,
          billing_cycle: selectedCycle,
          amount: finalAmount,
          discount_code: discountCode || null,
          payment_method: "paylink",
          bank_reference: response.data.transactionNo,
          status: "pending",
          notes: `Paylink Transaction: ${response.data.transactionNo}`,
        });

        window.open(response.data.paymentUrl, "_blank");
        toast({ title: "تم إنشاء رابط الدفع", description: "تم فتح صفحة الدفع في نافذة جديدة" });
      } else if (paymentMethod === "bank_transfer") {
        if (!bankReference.trim()) {
          toast({ title: "خطأ", description: "يرجى إدخال رقم مرجع التحويل", variant: "destructive" });
          setUpgrading(false);
          return;
        }

        let receiptUrl: string | null = null;
        let receiptFilename: string | null = null;

        if (receiptFile) {
          const fileExt = receiptFile.name.split('.').pop();
          const filePath = `subscription-receipts/${tenantId}/${Date.now()}.${fileExt}`;
          const { error: uploadErr } = await supabase.storage.from("private-files").upload(filePath, receiptFile);
          if (!uploadErr) {
            receiptUrl = filePath;
            receiptFilename = receiptFile.name;
          }
        }

        const { error: reqErr } = await supabase.from("subscription_upgrade_requests").insert({
          tenant_id: tenantId,
          requested_by: user.id,
          plan_id: plan.id,
          billing_cycle: selectedCycle,
          amount: finalAmount,
          discount_code: discountCode || null,
          payment_method: "bank_transfer",
          bank_reference: bankReference.trim(),
          receipt_url: receiptUrl,
          receipt_filename: receiptFilename,
          status: "pending",
        });

        if (reqErr) {
          toast({ title: "خطأ", description: reqErr.message, variant: "destructive" });
          setUpgrading(false);
          return;
        }

        toast({ title: "تم إرسال الطلب ✅", description: "سيتم مراجعة التحويل البنكي واعتماد الترقية بعد التحقق" });
      }

      setUpgradeDialog(null);
      setDiscountedPrice(null);
      setDiscountCode("");
      setBankReference("");
      setReceiptFile(null);
      setPaymentMethod("wallet");
      fetchData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "حدث خطأ غير متوقع", variant: "destructive" });
    }
    setUpgrading(false);
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

  const resetDialogState = () => {
    setUpgradeDialog(null);
    setDiscountedPrice(null);
    setDiscountCode("");
    setPaymentMethod("wallet");
    setBankReference("");
    setReceiptFile(null);
  };

  if (loading) return <SubscriptionSkeleton />;

  const allFeatureKeys = getAllFeatureKeys();
  const isHighestPlan = currentPlan && plans.every(p => p.sort_order <= (currentPlan.sort_order || 0));
  const currentMeta = currentPlan ? (PLAN_META[currentPlan.slug] || PLAN_META.starter) : PLAN_META.starter;

  // ─── Payment Dialog Content ───
  const PaymentContent = () => upgradeDialog ? (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-bl from-accent/5 via-background to-background border border-accent/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">من:</span>
          <span className="font-medium">{currentPlan?.name_ar}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">إلى:</span>
          <span className="font-bold text-accent">{upgradeDialog.name_ar}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">الدورة:</span>
          <span>{CYCLE_LABELS[selectedCycle]}</span>
        </div>
        <div className="border-t border-border/50 pt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">السعر:</span>
          <div className="text-left">
            {discountedPrice !== null ? (
              <>
                <span className="text-sm text-muted-foreground line-through mr-2">
                  {getPlanPrice(upgradeDialog, selectedCycle).toLocaleString("ar-SA")} ر.س
                </span>
                <span className="text-xl font-bold text-accent">{discountedPrice.toLocaleString("ar-SA")} ر.س</span>
              </>
            ) : (
              <span className="text-xl font-bold">{getPlanPrice(upgradeDialog, selectedCycle).toLocaleString("ar-SA")} ر.س</span>
            )}
          </div>
        </div>
      </div>

      <DiscountCodeInput
        planId={upgradeDialog.id}
        originalPrice={getPlanPrice(upgradeDialog, selectedCycle)}
        onDiscountApplied={(res) => {
          if (res.success && res.amount_after !== undefined) {
            setDiscountedPrice(res.amount_after);
            setDiscountCode(res.code || "");
          } else {
            setDiscountedPrice(null);
            setDiscountCode("");
          }
        }}
      />

      {/* Payment Method Selector */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-muted/50 rounded-xl">
          {([
            { value: "paylink" as const, icon: CreditCard, label: "بطاقة" },
            { value: "wallet" as const, icon: Wallet, label: "محفظة" },
            { value: "bank_transfer" as const, icon: Building2, label: "تحويل" },
          ]).map((method) => (
            <button
              key={method.value}
              onClick={() => setPaymentMethod(method.value)}
              className={`flex flex-col items-center gap-1.5 py-3 sm:py-2.5 px-2 rounded-xl text-xs font-medium transition-all duration-200 min-h-[56px] sm:min-h-0 sm:flex-row sm:gap-2 ${
                paymentMethod === method.value
                  ? "bg-background shadow-lg shadow-accent/5 text-accent ring-1 ring-accent/20"
                  : "text-muted-foreground active:scale-95 hover:text-foreground"
              }`}
            >
              <method.icon size={18} className="sm:w-4 sm:h-4" />
              <span>{method.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={paymentMethod}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {paymentMethod === "wallet" && (
              <div className="rounded-xl border border-primary/20 bg-gradient-to-bl from-primary/5 to-transparent p-4 text-sm text-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet size={16} className="text-primary" />
                  </div>
                  <span className="font-semibold">الدفع من المحفظة الرقمية</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  سيتم خصم <span className="font-bold text-foreground">{(discountedPrice ?? getPlanPrice(upgradeDialog, selectedCycle)).toLocaleString("ar-SA")} ر.س</span> من رصيد محفظتك فوراً.
                </p>
              </div>
            )}

            {paymentMethod === "paylink" && (
              <div className="rounded-xl border border-accent/20 bg-gradient-to-bl from-accent/5 to-transparent p-4 text-sm text-foreground space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <CreditCard size={16} className="text-accent" />
                  </div>
                  <span className="font-semibold">الدفع عبر بوابة الدفع الإلكتروني</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  سيتم فتح صفحة دفع آمنة لإتمام العملية. المبلغ: <span className="font-bold text-foreground">{(discountedPrice ?? getPlanPrice(upgradeDialog, selectedCycle)).toLocaleString("ar-SA")} ر.س</span>
                </p>
              </div>
            )}

            {paymentMethod === "bank_transfer" && (
              <BankTransferForm
                amount={discountedPrice ?? getPlanPrice(upgradeDialog, selectedCycle)}
                bankReference={bankReference}
                onBankReferenceChange={setBankReference}
                receiptFile={receiptFile}
                onReceiptFileChange={setReceiptFile}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  ) : null;

  const PaymentFooter = () => (
    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
      <Button variant="outline" onClick={resetDialogState} className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm rounded-xl">
        إلغاء
      </Button>
      <Button
        onClick={() => upgradeDialog && handleUpgrade(upgradeDialog)}
        disabled={upgrading}
        className="w-full sm:w-auto gap-2 h-12 sm:h-10 text-base sm:text-sm rounded-xl shadow-lg shadow-accent/10"
      >
        {upgrading ? <Loader2 size={16} className="animate-spin" /> : (
          paymentMethod === "wallet" ? <Wallet size={16} /> :
          paymentMethod === "paylink" ? <CreditCard size={16} /> :
          <Building2 size={16} />
        )}
        {paymentMethod === "wallet" ? "دفع وتأكيد الترقية" :
         paymentMethod === "paylink" ? "الدفع بالبطاقة" :
         "إرسال طلب الترقية"}
      </Button>
    </div>
  );

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
                  if (nextPlan) setUpgradeDialog(nextPlan);
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
            {/* Cycle Selector */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center gap-1 p-1.5 bg-muted/50 rounded-xl border border-border/50">
                {(["monthly", "quarterly", "yearly"] as const).map((cycle) => {
                  const maxSavings = plans.reduce((max, plan) => {
                    if (cycle === "yearly" && plan.price_yearly && plan.price_monthly > 0) {
                      const full = plan.price_monthly * 12;
                      return Math.max(max, Math.round(((full - plan.price_yearly) / full) * 100));
                    }
                    if (cycle === "quarterly" && plan.price_quarterly && plan.price_monthly > 0) {
                      const full = plan.price_monthly * 3;
                      return Math.max(max, Math.round(((full - plan.price_quarterly) / full) * 100));
                    }
                    return max;
                  }, 0);

                  return (
                    <button
                      key={cycle}
                      onClick={() => setSelectedCycle(cycle)}
                      className={`relative px-4 sm:px-5 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedCycle === cycle
                          ? "bg-background text-foreground shadow-lg shadow-accent/5"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {CYCLE_LABELS[cycle]}
                      {maxSavings > 0 && (
                        <span className="absolute -top-2 -left-1 text-[10px] font-bold text-emerald-600 bg-emerald-100 rounded-full px-1.5 py-0.5">
                          -{maxSavings}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" dir="rtl" style={{ direction: "rtl" }}>
              {plans.map((plan, i) => {
                const isCurrent = plan.id === subscription?.plan_id;
                const price = getPlanPrice(plan, selectedCycle);
                const monthlyEq = getMonthlyEquivalent(plan, selectedCycle);
                const meta = PLAN_META[plan.slug] || { popular: false, tagline: "", gradient: "from-muted/50 to-transparent", icon: <Zap size={22} />, color: "text-muted-foreground", highlights: [] as string[] };
                const isPopular = !!meta.popular && !isCurrent;

                const planFeatures = allFeatureKeys.map((key) => ({
                  key,
                  label: FEATURE_LABELS[key] || key,
                  enabled: isFeatureEnabled(plan.id, key),
                  limit: getFeatureLimit(plan.id, key),
                }));

                const sortedFeatures = [...planFeatures].sort((a, b) => {
                  if (a.enabled && !b.enabled) return -1;
                  if (!a.enabled && b.enabled) return 1;
                  return 0;
                });

                const isExpanded = expandedPlans[plan.id] || false;
                const visibleItems = isExpanded ? sortedFeatures : sortedFeatures.slice(0, INITIAL_VISIBLE);
                const hasMore = sortedFeatures.length > INITIAL_VISIBLE;
                const enabledCount = countEnabledFeatures(plan.id);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={isPopular ? "relative z-10 lg:scale-[1.02]" : ""}
                  >
                    <Card
                      className={`relative h-full flex flex-col transition-all duration-300 overflow-hidden rounded-2xl ${
                        isCurrent ? "border-accent ring-2 ring-accent/20 shadow-xl shadow-accent/5" :
                        isPopular ? "border-accent/40 ring-2 ring-accent/10 shadow-xl shadow-accent/10" :
                        plan.slug === "enterprise" ? "border-primary/30 ring-1 ring-primary/10 shadow-lg" :
                        "border-border/50 hover:border-accent/20 hover:shadow-md"
                      }`}
                      dir="rtl"
                      style={{ direction: "rtl", textAlign: "right" }}
                    >
                      {/* Top gradient */}
                      <div className={`absolute top-0 left-0 right-0 ${isPopular ? "h-1.5" : "h-1"} bg-gradient-to-l ${
                        isPopular ? "from-accent via-accent/80 to-accent/50" : meta.gradient
                      }`} />

                      {/* Badges */}
                      <div className="absolute -top-0 right-4 flex items-center gap-2">
                        {isCurrent && (
                          <Badge className="bg-accent text-accent-foreground flex items-center gap-1 rounded-b-lg rounded-t-none px-3 py-1.5 text-xs shadow-md">
                            <Sparkles size={10} />
                            خطتك الحالية
                          </Badge>
                        )}
                        {isPopular && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
                            <Badge className="bg-gradient-to-l from-accent to-accent/80 text-accent-foreground flex items-center gap-1.5 rounded-b-lg rounded-t-none px-4 py-1.5 text-xs shadow-lg font-bold">
                              <Flame size={12} />
                              الأكثر طلباً ⭐
                            </Badge>
                          </motion.div>
                        )}
                      </div>

                      <CardHeader className="pb-3 pt-7">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} border border-border/50`}>
                            <span className={meta.color}>{meta.icon}</span>
                          </div>
                          <div>
                            <CardTitle className="text-lg text-right">{plan.name_ar}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{meta.tagline}</p>
                          </div>
                        </div>

                        {/* Enterprise / Popular highlights */}
                        {meta.highlights && meta.highlights.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {meta.highlights.map((h, hi) => (
                              <motion.div
                                key={hi}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 + hi * 0.05 + 0.2 }}
                              >
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] py-0.5 ${
                                    plan.slug === "enterprise"
                                      ? "border-primary/20 bg-primary/5 text-primary"
                                      : "border-accent/20 bg-accent/5 text-accent"
                                  }`}
                                >
                                  {h.includes("التكاملات") ? <Gift size={10} className="ml-1" /> : <Star size={10} className="ml-1" />}
                                  {h}
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 text-right">
                          {plan.slug === "enterprise" ? (
                            <span className="text-2xl font-bold text-foreground">تواصل معنا</span>
                          ) : (
                            <>
                              <div className="flex items-baseline gap-1">
                                <AnimatedPrice value={price} />
                                <span className="text-sm text-muted-foreground">ر.س/{CYCLE_LABELS[selectedCycle]}</span>
                              </div>
                              {selectedCycle !== "monthly" && (
                                <div className="mt-1 space-y-0.5">
                                  <p className="text-xs text-muted-foreground">
                                    ≈ {Math.round(monthlyEq).toLocaleString("ar-SA")} ر.س/شهر
                                  </p>
                                  {(() => {
                                    const fullPrice = selectedCycle === "yearly" ? plan.price_monthly * 12 : plan.price_monthly * 3;
                                    const savings = fullPrice - price;
                                    const savingsPct = Math.round((savings / fullPrice) * 100);
                                    if (savings <= 0) return null;
                                    return (
                                      <motion.div
                                        initial={{ opacity: 0, x: 5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                                      >
                                        🎉 وفّر {savings.toLocaleString("ar-SA")} ر.س ({savingsPct}%)
                                      </motion.div>
                                    );
                                  })()}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 space-y-3">
                        {/* Quota badges */}
                        <div className="flex flex-wrap gap-2">
                          {getFeatureLimit(plan.id, "max_users") && (
                            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.1 + 0.15 }}
                              className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-xs font-medium border border-border/30">
                              <Users size={12} className="text-accent" />
                              <span>{getFeatureLimit(plan.id, "max_users") || "∞"} مستخدم</span>
                            </motion.div>
                          )}
                          {plan.max_invoices && (
                            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.1 + 0.2 }}
                              className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-xs font-medium border border-border/30">
                              <FileText size={12} className="text-accent" />
                              <span>{plan.max_invoices} فاتورة/شهر</span>
                            </motion.div>
                          )}
                          {getFeatureLimit(plan.id, "max_storage_gb") && (
                            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.1 + 0.25 }}
                              className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1.5 text-xs font-medium border border-border/30">
                              <HardDrive size={12} className="text-accent" />
                              <span>{getFeatureLimit(plan.id, "max_storage_gb")} GB</span>
                            </motion.div>
                          )}
                        </div>

                        <div className="border-t border-border/30" />

                        {/* Feature list */}
                        <div className="space-y-0 text-sm text-right">
                          <AnimatePresence initial={false}>
                            {visibleItems.map((item, fi) => (
                              <motion.div
                                key={item.key}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, delay: fi * 0.02 }}
                                className="overflow-hidden"
                              >
                                <div
                                  className="flex items-center gap-2.5 py-2 border-b border-border/10 last:border-b-0"
                                  style={{ direction: "rtl" }}
                                >
                                  {item.enabled ? (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 shrink-0">
                                      <Check size={12} className="text-accent" />
                                    </div>
                                  ) : (
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 shrink-0">
                                      <X size={12} className="text-muted-foreground/30" />
                                    </div>
                                  )}
                                  <span className={item.enabled ? "text-foreground" : "text-muted-foreground/40 line-through decoration-muted-foreground/15"}>
                                    {item.label}
                                    {item.enabled && item.limit !== null && (
                                      <span className="text-xs text-muted-foreground mr-1">({item.limit})</span>
                                    )}
                                  </span>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>

                          {hasMore && (
                            <motion.button
                              onClick={() => setExpandedPlans((prev) => ({ ...prev, [plan.id]: !prev[plan.id] }))}
                              className="flex items-center justify-center gap-1.5 w-full pt-3 pb-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors min-h-[44px]"
                              whileTap={{ scale: 0.97 }}
                            >
                              <span>{isExpanded ? "عرض أقل" : `عرض الكل (${sortedFeatures.length})`}</span>
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                                <ChevronDown size={14} />
                              </motion.div>
                            </motion.button>
                          )}
                        </div>

                        {/* CTA */}
                        <div className="pt-3">
                          {isCurrent ? (
                            <Button variant="outline" className="w-full gap-2 h-12 sm:h-10 text-base sm:text-sm rounded-xl" disabled>
                              <CheckCircle2 size={16} />
                              خطتك الحالية
                            </Button>
                          ) : plan.slug === "enterprise" ? (
                            <Button
                              className="w-full gap-2 h-12 sm:h-10 text-base sm:text-sm rounded-xl"
                              variant="outline"
                              onClick={() => window.open("mailto:sales@numaxio.com?subject=طلب باقة المؤسسي", "_blank")}
                            >
                              <Building2 size={16} /> تواصل مع المبيعات
                            </Button>
                          ) : (
                            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                className={`w-full gap-2 h-12 sm:h-10 text-base sm:text-sm rounded-xl ${
                                  isPopular ? "shadow-lg shadow-accent/15" : ""
                                }`}
                                variant={(currentPlan?.sort_order || 0) < plan.sort_order ? "default" : "outline"}
                                onClick={() => setUpgradeDialog(plan)}
                              >
                                {(currentPlan?.sort_order || 0) < plan.sort_order ? (
                                  <><ArrowUpRight size={16} /> ترقية الآن</>
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

            {subscription && !subscription.cancel_at_period_end && subscription.status === "active" && (
              <div className="mt-8 text-center">
                <Button variant="ghost" className="text-destructive/70 hover:text-destructive h-11 sm:h-10 text-sm" onClick={handleCancel}>
                  إلغاء الاشتراك عند نهاية الفترة
                </Button>
              </div>
            )}

            {/* ROI Calculator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8"
            >
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
                if (nextPlan) setUpgradeDialog(nextPlan);
              }}
            >
              <Rocket size={18} />
              ترقية باقتك الآن
            </Button>
          </motion.div>
        )}

        {/* Extra bottom padding on mobile for fixed CTA */}
        {isMobile && currentPlan && !isHighestPlan && <div className="h-20" />}

        {/* ═══════ Upgrade Dialog / Drawer ═══════ */}
        {isMobile ? (
          <Drawer open={!!upgradeDialog} onOpenChange={(open) => { if (!open) resetDialogState(); }}>
            <DrawerContent dir="rtl" className="max-h-[90vh]">
              <DrawerHeader className="text-right">
                <DrawerTitle className="flex items-center gap-2">
                  <Rocket size={18} className="text-accent" />
                  {upgradeDialog && (currentPlan?.sort_order || 0) < upgradeDialog.sort_order ? "ترقية" : "تخفيض"} الاشتراك
                </DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-2 overflow-y-auto">
                <PaymentContent />
              </div>
              <DrawerFooter>
                <PaymentFooter />
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!upgradeDialog} onOpenChange={(open) => { if (!open) resetDialogState(); }}>
            <DialogContent dir="rtl" className="sm:max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Rocket size={18} className="text-accent" />
                  {upgradeDialog && (currentPlan?.sort_order || 0) < upgradeDialog.sort_order ? "ترقية" : "تخفيض"} الاشتراك
                </DialogTitle>
              </DialogHeader>
              <PaymentContent />
              <DialogFooter className="gap-2">
                <PaymentFooter />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SubscriptionPage;
