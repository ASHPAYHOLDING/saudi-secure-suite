import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug, CheckCircle2, Monitor, ShoppingBag, Users, CreditCard, Package,
  Power, PowerOff, Key, BookOpen, MessageSquare, Radio,
  ShieldCheck, Loader2, AlertTriangle, Zap, Settings2,
  Lock, Wifi, Crown, Sparkles, Layers, TrendingUp, ExternalLink,
} from "lucide-react";
import { GATEWAY_DEFS } from "./PaymentGatewayWizard";
import { ALL_PROVIDERS } from "./IntegrationDetailPage";
import { getManifestByKey } from "@/integrations/manifests";

// ─── Types ───
interface PaidIntegration {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  integration_type: string;
  price_once: number;
  is_listed: boolean;
  is_ready: boolean;
  requires_api_keys: boolean;
  api_key_label: string;
  trial_days: number;
  has_service: boolean;
  has_api_client: boolean;
  has_test_connection: boolean;
}

interface IntegrationState {
  integration_id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  integration_type: string;
  price_once: number;
  sort_order: number;
  is_ready: boolean;
  requires_api_keys: boolean;
  api_key_label: string;
  trial_days: number;
  has_service: boolean;
  has_api_client: boolean;
  has_test_connection: boolean;
  tenant_activation_status: string;
  activation_source: string | null;
  has_secret_configured: boolean;
  entitlement_allowed: boolean;
  entitlement_reason: string;
  can_activate: boolean;
}

interface TenantSubscription {
  id: string;
  integration_id: string;
  status: string;
  activated_at: string;
  purchased_at: string;
  activation_source: string;
  has_secret_configured: boolean;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; gradient: string }> = {
  payment: { label: "بوابات دفع", icon: CreditCard, color: "bg-amber-500/10 text-amber-600", gradient: "from-amber-500/20 to-orange-500/10" },
  payment_gateway: { label: "بوابات دفع", icon: CreditCard, color: "bg-amber-500/10 text-amber-600", gradient: "from-amber-500/20 to-orange-500/10" },
  whatsapp: { label: "واتساب", icon: MessageSquare, color: "bg-green-500/10 text-green-600", gradient: "from-green-500/20 to-emerald-500/10" },
  accounting: { label: "محاسبة", icon: BookOpen, color: "bg-accent/10 text-accent", gradient: "from-accent/20 to-accent/5" },
  sms: { label: "رسائل SMS", icon: Radio, color: "bg-blue-500/10 text-blue-600", gradient: "from-blue-500/20 to-sky-500/10" },
  pos: { label: "نقاط البيع", icon: Monitor, color: "bg-purple-500/10 text-purple-600", gradient: "from-purple-500/20 to-violet-500/10" },
  ecommerce: { label: "متاجر إلكترونية", icon: ShoppingBag, color: "bg-indigo-500/10 text-indigo-600", gradient: "from-indigo-500/20 to-blue-500/10" },
  hr_payroll: { label: "موارد بشرية", icon: Users, color: "bg-emerald-500/10 text-emerald-600", gradient: "from-emerald-500/20 to-green-500/10" },
  other: { label: "أخرى", icon: Package, color: "bg-muted text-muted-foreground", gradient: "from-muted/50 to-muted/20" },
};

// ─── Animation Variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// ─── Skeleton Loader ───
const IntegrationSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <Card key={i} className="overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex items-center justify-between pt-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      </Card>
    ))}
  </div>
);

// ─── Integration Card Component ───
const IntegrationCard = ({
  item, sub, purchased, hasFreeAccess, isTrial, canPurchase,
  onActivate, onDeactivate, onComplete, onOpenDetail,
}: {
  item: PaidIntegration;
  sub: TenantSubscription | undefined;
  purchased: TenantSubscription | undefined;
  hasFreeAccess: boolean;
  isTrial: boolean;
  canPurchase: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onComplete: () => void;
  onOpenDetail?: () => void;
}) => {
  const cat = CATEGORY_MAP[item.integration_type] || CATEGORY_MAP.other;
  const CatIcon = cat.icon;
  const isActive = !!sub;
  const isPaymentGateway = item.integration_type === "payment_gateway";
  const hasDetailPage = isPaymentGateway && ALL_PROVIDERS.find((p) => p.integrationKey === item.key);

  return (
    <motion.div variants={cardVariants} layout>
      <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-md flex flex-col h-full ${isActive ? "ring-1 ring-accent/30" : ""}`}>
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${cat.gradient} ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity duration-300`} />
        <div className="p-5 sm:p-6 flex flex-col flex-1 gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <motion.div
              whileHover={{ scale: 1.08, rotate: -3 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${cat.color} shrink-0`}
            >
              <CatIcon size={24} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight flex items-center gap-2">
                {item.name_ar}
                {!item.is_ready && <Lock size={12} className="text-muted-foreground shrink-0" />}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-english" dir="ltr">{item.name_en}</p>
            </div>
            <div className="flex flex-col items-start gap-1 shrink-0">
              {isActive && (
                <Badge className="gap-1 bg-accent/10 text-accent border-accent/20 text-[11px]">
                  <CheckCircle2 size={11} /> مفعّل
                </Badge>
              )}
              {!isActive && purchased && (
                <Badge variant="outline" className="gap-1 border-border text-muted-foreground bg-muted/30 text-[11px]">
                  <Settings2 size={11} /> تم الشراء
                </Badge>
              )}
              {!item.is_ready && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <AlertTriangle size={10} /> قريباً
                </Badge>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">{item.description_ar}</p>

          {/* Meta tags */}
          <div className="flex flex-wrap gap-2">
            {item.requires_api_keys && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                <Key size={10} /> يتطلب مفاتيح API
              </span>
            )}
            {item.trial_days > 0 && !purchased && (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent bg-accent/5 rounded-md px-2 py-0.5">
                <Zap size={10} /> تجربة {item.trial_days} يوم
              </span>
            )}
          </div>

          {/* Price + Action */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto gap-2">
            <div>
              {hasFreeAccess ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-accent">مجاني</span>
                  <span className="text-[10px] text-muted-foreground">{isTrial ? "(تجريبي)" : "(مؤسسي)"}</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{item.price_once}</span>
                  <span className="text-xs text-muted-foreground">ر.س</span>
                  <span className="text-[10px] text-muted-foreground">(مرة واحدة)</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {hasDetailPage && isActive && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9 border-accent/30 text-accent hover:bg-accent/5" onClick={onOpenDetail}>
                  <ExternalLink size={13} /> الإعدادات
                </Button>
              )}
              {isActive && !hasDetailPage ? (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9" onClick={onDeactivate}>
                  <PowerOff size={14} /> إيقاف
                </Button>
              ) : isActive && hasDetailPage ? (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9" onClick={onDeactivate}>
                  <PowerOff size={14} />
                </Button>
              ) : purchased ? (
                <Button size="sm" variant="outline" className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 text-xs h-9" onClick={hasDetailPage ? onOpenDetail : onComplete}>
                  <Settings2 size={14} /> {hasDetailPage ? "إعداد" : "إكمال التفعيل"}
                </Button>
              ) : hasFreeAccess ? (
                <Button size="sm" className="gap-1.5 text-xs h-9" disabled={!item.is_ready} onClick={onActivate}>
                  {item.is_ready ? (
                    <><Sparkles size={14} /> {hasDetailPage ? "فتح الإعداد" : "تفعيل فوري"}</>
                  ) : (
                    <><Lock size={14} /> غير متاح</>
                  )}
                </Button>
              ) : (
                <Button size="sm" className="gap-1.5 text-xs h-9" disabled={!item.is_ready || !canPurchase} onClick={onActivate}>
                  {!canPurchase ? <><Lock size={14} /> ترقية الباقة</> : <><Power size={14} /> شراء وتفعيل</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// ─── Main Page ───
const PaidIntegrationsPage = () => {
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();

  const [integrationStates, setIntegrationStates] = useState<IntegrationState[]>([]);
  const [loading, setLoading] = useState(true);

  const isTrial       = integrationStates[0]?.entitlement_reason === "trial";
  const canPurchase   = integrationStates[0]?.entitlement_allowed ?? false;
  const isEnterprise  = integrationStates[0]?.entitlement_reason === "plan" && canPurchase;
  const hasFreeAccess = isTrial || isEnterprise;

  const toItem = (s: IntegrationState): PaidIntegration => ({
    id: s.integration_id,
    key: s.key,
    name_ar: s.name_ar,
    name_en: s.name_en,
    description_ar: s.description_ar,
    integration_type: s.integration_type,
    price_once: s.price_once,
    is_listed: true,
    is_ready: s.is_ready,
    requires_api_keys: s.requires_api_keys,
    api_key_label: s.api_key_label,
    trial_days: s.trial_days,
    has_service: s.has_service,
    has_api_client: s.has_api_client,
    has_test_connection: s.has_test_connection,
  });

  const integrations = integrationStates.map(toItem);

  const getSubscription = (integrationId: string) => {
    const s = integrationStates.find((r) => r.integration_id === integrationId);
    if (!s || s.tenant_activation_status !== "active") return undefined;
    return { id: integrationId, integration_id: integrationId, status: s.tenant_activation_status, activated_at: "", purchased_at: "", activation_source: s.activation_source ?? "", has_secret_configured: s.has_secret_configured } as TenantSubscription;
  };

  const getPurchased = (integrationId: string) => {
    const s = integrationStates.find((r) => r.integration_id === integrationId);
    if (!s || s.tenant_activation_status === "none") return undefined;
    return { id: integrationId, integration_id: integrationId, status: s.tenant_activation_status, activated_at: "", purchased_at: "", activation_source: s.activation_source ?? "", has_secret_configured: s.has_secret_configured } as TenantSubscription;
  };

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_paid_integrations_state", { p_tenant_id: tenantId } as any);
    if (!error && data) {
      setIntegrationStates(data as unknown as IntegrationState[]);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId, fetchAll]);

  // ── Navigate to setup page for any integration ──
  const openFlow = (item: PaidIntegration) => {
    // ✅ أولاً: تحقق إذا كان للمزود manifest في النظام الجديد
    const manifest = getManifestByKey(item.key);
    if (manifest) {
      // ✅ انتقل دائماً باستخدام providerId من manifest مباشرة — لا state قديم
      navigate(`/dashboard/integrations/${manifest.category}/${manifest.providerId}`);
      return;
    }

    // Payment gateway with dedicated provider page (legacy system)
    if (item.integration_type === "payment_gateway") {
      const providerDef = ALL_PROVIDERS.find((p) => p.integrationKey === item.key);
      if (providerDef) {
        // Auto-register entry first if needed
        if (tenantId && user && !getPurchased(item.id)) {
          const source = hasFreeAccess ? (isTrial ? "trial_auto" : "enterprise_auto") : "purchase_pending";
          supabase.from("tenant_paid_integrations").upsert({
            tenant_id: tenantId,
            integration_id: item.id,
            status: "disabled",
            activated_by: user.id,
            purchased_at: new Date().toISOString(),
            activated_at: new Date().toISOString(),
            activation_source: source,
          } as any, { onConflict: "tenant_id,integration_id" }).then(() => fetchAll());
        }
        navigate(`/dashboard/integrations/provider/${providerDef.id}`);
        return;
      }
      // Fallback: gateway setup page (for Stripe/Geidea old style)
      const gwDef = GATEWAY_DEFS.find((d) => d.integrationKey === item.key);
      if (gwDef) {
        navigate(`/dashboard/integrations/gateway/${gwDef.provider}`);
        return;
      }
    }
    // Generic integration flow page (fallback — item.id not undefined)
    if (item.id) {
      navigate(`/dashboard/integrations/setup/${item.id}`);
    } else {
      toast({ title: "خطأ", description: "معرّف التكامل غير متاح", variant: "destructive" });
    }
  };

  const handleDeactivate = async (integrationId: string) => {
    if (!confirm("هل تريد إيقاف هذا التكامل؟")) return;
    await supabase
      .from("tenant_paid_integrations")
      .update({ status: "disabled" } as any)
      .eq("tenant_id", tenantId!)
      .eq("integration_id", integrationId);
    toast({ title: "تم إيقاف التكامل" });
    fetchAll();
  };

  // استبعاد بوابات الدفع — لها قسم خاص في القائمة الجانبية
  const PAYMENT_TYPES = ["payment", "payment_gateway"];
  const integrations_filtered = integrations.filter((i) => !PAYMENT_TYPES.includes(i.integration_type));
  const activeSubscriptions = integrationStates.filter(
    (s) => s.tenant_activation_status === "active" && !PAYMENT_TYPES.includes(s.integration_type)
  );
  const categories = [...new Set(integrations_filtered.map((i) => i.integration_type))];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* ═══ Hero Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary/[0.04] via-accent/[0.06] to-primary/[0.02] border border-border/50 p-6 sm:p-8"
      >
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Layers size={22} className="text-accent" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">التكاملات المدفوعة</h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                وسّع أعمالك مع بوابات دفع احترافية — فعّل التكامل خلال دقائق وابدأ استقبال المدفوعات فوراً
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isTrial && (
                <Badge className="gap-1.5 text-xs py-1.5 px-3 bg-primary/10 text-primary border-primary/20">
                  <Zap size={13} /> فترة تجريبية — كل الميزات مفعّلة
                </Badge>
              )}
              {isEnterprise && !isTrial && (
                <Badge className="gap-1.5 text-xs py-1.5 px-3 bg-accent/10 text-accent border-accent/20">
                  <Crown size={13} /> جميع التكاملات مضمّنة
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3 bg-background">
                <Plug size={13} /> {activeSubscriptions.length} تكامل نشط
              </Badge>
            </div>
          </div>
        </div>
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-accent/5 blur-2xl" />
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-primary/5 blur-xl" />
      </motion.div>

      {/* ═══ Motivational Banner ═══ */}
      {!canPurchase && !hasFreeAccess && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <TrendingUp size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">ترقية الباقة مطلوبة</p>
            <p className="text-xs text-muted-foreground">التكاملات المدفوعة متاحة في الباقة الاحترافية وباقة المؤسسات.</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs">
            <Crown size={13} /> ترقية
          </Button>
        </motion.div>
      )}

      {/* ═══ Tabs ═══ */}
      <Tabs defaultValue="all" dir="rtl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg text-xs sm:text-sm">الكل</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="rounded-lg text-xs sm:text-sm">
                {CATEGORY_MAP[cat]?.label || cat}
              </TabsTrigger>
            ))}
            <TabsTrigger value="active" className="rounded-lg text-xs sm:text-sm">اشتراكاتي</TabsTrigger>
          </TabsList>
        </motion.div>

        {["all", ...categories].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <AnimatePresence mode="wait">
              {loading ? (
                <IntegrationSkeleton />
              ) : (
                <motion.div key={tab} variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {integrations_filtered
                    .filter((i) => tab === "all" || i.integration_type === tab)
                    .map((item) => (
                      <IntegrationCard
                        key={item.id}
                        item={item}
                        sub={getSubscription(item.id)}
                        purchased={getPurchased(item.id)}
                        hasFreeAccess={hasFreeAccess}
                        isTrial={isTrial}
                        canPurchase={canPurchase}
                        onActivate={() => openFlow(item)}
                        onDeactivate={() => handleDeactivate(item.id)}
                        onComplete={() => openFlow(item)}
                        onOpenDetail={() => {
                          // ✅ استخدم manifest أولاً — إذا لم يُوجد استخدم old provider route
                          const manifest = getManifestByKey(item.key);
                          if (manifest) {
                            navigate(`/dashboard/integrations/${manifest.category}/${manifest.providerId}`);
                            return;
                          }
                          const provDef = ALL_PROVIDERS.find((p) => p.integrationKey === item.key);
                          if (provDef) navigate(`/dashboard/integrations/provider/${provDef.id}`);
                        }}
                      />
                    ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}

        {/* Active tab */}
        <TabsContent value="active" className="mt-6">
          <AnimatePresence mode="wait">
            {activeSubscriptions.length === 0 ? (
              <motion.div variants={fadeUp} initial="hidden" animate="visible">
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Plug size={32} className="text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-medium">لا توجد تكاملات نشطة</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">تصفح التكاملات المتاحة وفعّل ما تحتاجه</p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeSubscriptions.map((sub) => {
                  const item = integrations_filtered.find((i) => i.id === sub.integration_id);
                  if (!item) return null;
                  const cat = CATEGORY_MAP[item.integration_type] || CATEGORY_MAP.other;
                  const CatIcon = cat.icon;
                  return (
                    <motion.div key={sub.integration_id} variants={cardVariants}>
                      <Card className="ring-1 ring-accent/20 overflow-hidden">
                        <div className={`h-1 bg-gradient-to-l ${cat.gradient}`} />
                        <CardContent className="pt-5 pb-5">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cat.color}`}>
                              <CatIcon size={22} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm">{item.name_ar}</p>
                              <p className="text-xs text-muted-foreground">مصدر التفعيل: {sub.activation_source ?? "—"}</p>
                            </div>
                            <Badge className="gap-1 bg-accent/10 text-accent border-accent/20 text-[10px]">
                              <Wifi size={10} /> متصل
                            </Badge>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10 text-xs h-8"
                              onClick={() => handleDeactivate(item.id)}
                            >
                              <PowerOff size={13} className="mie-1" /> إيقاف
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaidIntegrationsPage;
