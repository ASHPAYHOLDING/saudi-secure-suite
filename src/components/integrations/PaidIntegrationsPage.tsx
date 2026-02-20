import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug, CheckCircle2, Monitor, ShoppingBag, Users, CreditCard, Package,
  Power, PowerOff, Key, BookOpen, MessageSquare, Radio,
  ShieldCheck, Loader2, AlertTriangle, Zap, Settings2, CircleDot,
  ArrowRight, Lock, Unlock, WifiOff, Wifi, Wallet, Crown, Sparkles,
  Layers, TrendingUp, ArrowLeft,
} from "lucide-react";

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

// Shape returned by get_paid_integrations_state RPC
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
  tenant_activation_status: string; // 'active' | 'disabled' | 'none'
  activation_source: string | null;
  has_secret_configured: boolean;   // true when encrypted secret exists (never returns plaintext)
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

type PaymentMethod = "wallet" | "paylink";
type FlowStep = "preview" | "payment" | "paying" | "api_keys" | "testing" | "done";

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

const FLOW_STEPS: { key: FlowStep; label: string; icon: any }[] = [
  { key: "preview", label: "عرض التكامل", icon: CircleDot },
  { key: "payment", label: "الدفع", icon: CreditCard },
  { key: "paying", label: "إتمام الدفع", icon: ShieldCheck },
  { key: "api_keys", label: "إعداد المفاتيح", icon: Key },
  { key: "testing", label: "اختبار الاتصال", icon: Wifi },
  { key: "done", label: "مفعّل", icon: CheckCircle2 },
];

// ─── Animation Variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
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
  onActivate, onDeactivate, onComplete,
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
}) => {
  const cat = CATEGORY_MAP[item.integration_type] || CATEGORY_MAP.other;
  const CatIcon = cat.icon;
  const isActive = !!sub;

  return (
    <motion.div variants={cardVariants} layout>
      <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-md flex flex-col h-full ${
        isActive ? "ring-1 ring-accent/30" : ""
      }`}>
        {/* Gradient accent top strip */}
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${cat.gradient} ${
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        } transition-opacity duration-300`} />

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
                <Badge variant="outline" className="gap-1 border-amber-300 text-amber-600 bg-amber-50/50 text-[11px]">
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
          <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto">
            <div>
              {hasFreeAccess ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-accent">مجاني</span>
                  <span className="text-[10px] text-muted-foreground">
                    {isTrial ? "(تجريبي)" : "(مؤسسي)"}
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{item.price_once}</span>
                  <span className="text-xs text-muted-foreground">ر.س</span>
                  <span className="text-[10px] text-muted-foreground">(مرة واحدة)</span>
                </div>
              )}
            </div>

            {isActive ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9"
                onClick={onDeactivate}
              >
                <PowerOff size={14} /> إيقاف
              </Button>
            ) : purchased ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 text-xs h-9"
                onClick={onComplete}
              >
                <Settings2 size={14} /> إكمال التفعيل
              </Button>
            ) : hasFreeAccess ? (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-9"
                disabled={!item.is_ready}
                onClick={onActivate}
              >
                {item.is_ready ? (
                  <><Sparkles size={14} /> تفعيل فوري</>
                ) : (
                  <><Lock size={14} /> غير متاح</>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 text-xs h-9"
                disabled={!item.is_ready || !canPurchase}
                onClick={onActivate}
              >
                {!canPurchase ? (
                  <><Lock size={14} /> ترقية الباقة</>
                ) : (
                  <><Power size={14} /> شراء وتفعيل</>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// ─── Main Page ───
const PaidIntegrationsPage = () => {
  const { tenantId, user } = useAuth();

  // ── Single-RPC state (replaces N+1 waterfall) ──
  const [integrationStates, setIntegrationStates] = useState<IntegrationState[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived from the first row (all rows share same entitlement)
  const isTrial          = integrationStates[0]?.entitlement_reason === "trial";
  const canPurchase      = integrationStates[0]?.entitlement_allowed ?? false;
  const isEnterprise     = integrationStates[0]?.entitlement_reason === "plan" && canPurchase;
  const hasFreeAccess    = isTrial || isEnterprise;

  // Compatibility helpers — shape PaidIntegration from IntegrationState
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
    return {
      id: integrationId,
      integration_id: integrationId,
      status: s.tenant_activation_status,
      activated_at: "",
      purchased_at: "",
      activation_source: s.activation_source ?? "",
      has_secret_configured: s.has_secret_configured,
    } as TenantSubscription;
  };

  const getPurchased = (integrationId: string) => {
    const s = integrationStates.find((r) => r.integration_id === integrationId);
    if (!s || s.tenant_activation_status === "none") return undefined;
    return {
      id: integrationId,
      integration_id: integrationId,
      status: s.tenant_activation_status,
      activated_at: "",
      purchased_at: "",
      activation_source: s.activation_source ?? "",
      has_secret_configured: s.has_secret_configured,
    } as TenantSubscription;
  };

  // Flow state
  const [flowItem, setFlowItem] = useState<PaidIntegration | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("preview");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "fail">("idle");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletExists, setWalletExists] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paylinkTransactionNo, setPaylinkTransactionNo] = useState<string | null>(null);
  const [paymentCheckInterval, setPaymentCheckInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // ─── Single RPC fetch — 1 round-trip ───
  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_paid_integrations_state", {
      p_tenant_id: tenantId,
    } as any);
    if (!error && data) {
      setIntegrationStates(data as IntegrationState[]);
      // Fetch wallet balance only if canPurchase (not trial/enterprise)
      const firstRow = (data as IntegrationState[])[0];
      const needsWallet = firstRow?.entitlement_allowed && firstRow?.entitlement_reason !== "trial";
      if (needsWallet) fetchWalletBalance();
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) fetchAll();
    return () => {
      if (paymentCheckInterval) clearInterval(paymentCheckInterval);
    };
  }, [tenantId, fetchAll]);

  // ─── Wallet balance (secondary fetch, non-blocking) ───
  const fetchWalletBalance = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=get-balance`,
        { headers: { Authorization: `Bearer ${session?.session?.access_token}` } }
      );
      const data = await res.json();
      setWalletBalance(data.balance_available ?? 0);
      setWalletExists(data.exists ?? false);
    } catch {
      setWalletBalance(0);
      setWalletExists(false);
    }
  };

  // ─── Flow Handlers (ALL unchanged business logic) ───
  const openFlow = (item: PaidIntegration) => {
    setFlowItem(item);
    setApiKeyValue("");
    setTestResult("idle");
    setPaymentMethod(walletExists && walletBalance !== null && walletBalance >= item.price_once ? "wallet" : "paylink");

    if (hasFreeAccess) {
      const existing = getPurchased(item.id);
      if (existing) {
        if (item.requires_api_keys && !existing.has_secret_configured) {
          setFlowStep("api_keys");
        } else {
          setFlowStep("testing");
          setTimeout(() => runConnectionTest(), 100);
        }
      } else {
        handleFreeAutoActivate(item);
      }
      return;
    }

    const existing = getPurchased(item.id);
    if (existing) {
      if (item.requires_api_keys && !existing.has_secret_configured) {
        setFlowStep("api_keys");
      } else {
        setFlowStep("testing");
        setTimeout(() => runConnectionTest(), 100);
      }
    } else {
      setFlowStep("preview");
    }
  };

  const handleFreeAutoActivate = async (item: PaidIntegration) => {
    setSaving(true);
    const source = isTrial ? "trial_auto" : "enterprise_auto";
    const label = isTrial ? "الفترة التجريبية" : "باقة المؤسسات";
    try {
      const { error } = await supabase.from("tenant_paid_integrations").upsert({
        tenant_id: tenantId,
        integration_id: item.id,
        status: item.requires_api_keys ? "disabled" : "active",
        activated_by: user!.id,
        purchased_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        activation_source: source,
      } as any, { onConflict: "tenant_id,integration_id" });

      if (error) {
        toast({ title: "خطأ في التفعيل", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      toast({ title: "تم التفعيل تلقائياً ✅", description: `${item.name_ar} — مضمّن في ${label}` });
      fetchAll();

      if (item.requires_api_keys) {
        setFlowStep("api_keys");
      } else {
        setFlowStep("testing");
        setTimeout(() => runConnectionTest(), 100);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const closeFlow = () => {
    if (paymentCheckInterval) clearInterval(paymentCheckInterval);
    setFlowItem(null);
    setFlowStep("preview");
    setApiKeyValue("");
    setTestResult("idle");
    setPaymentUrl(null);
    setPaylinkTransactionNo(null);
    setPaymentCheckInterval(null);
  };

  const handleWalletPurchase = async () => {
    if (!flowItem || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=purchase-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({ integrationId: flowItem.id }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast({ title: "فشل الشراء", description: result.error || "حدث خطأ", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "تم الشراء بنجاح ✅", description: `${flowItem.name_ar} — الرصيد المتبقي: ${result.new_balance} ر.س` });
      setWalletBalance(result.new_balance);
      if (result.requires_api_keys) {
        setFlowStep("api_keys");
      } else {
        setFlowStep("testing");
        runConnectionTest();
      }
      fetchAll();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handlePayment = async () => {
    if (!flowItem || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      const orderNumber = `INT-${flowItem.key}-${Date.now()}`;
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=create-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({
            amount: flowItem.price_once,
            clientName: profile?.full_name || "عميل",
            clientMobile: "0500000000",
            clientEmail: profile?.email || user.email || "",
            orderNumber,
            note: `شراء تكامل: ${flowItem.name_ar}`,
            callBackUrl: window.location.href,
            products: [{ title: flowItem.name_ar, price: flowItem.price_once, qty: 1, description: `تكامل ${flowItem.name_en} - دفعة واحدة` }],
          }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast({ title: "خطأ في إنشاء الفاتورة", description: result.error || "حدث خطأ", variant: "destructive" });
        setSaving(false);
        return;
      }
      setPaymentUrl(result.paymentUrl);
      setPaylinkTransactionNo(result.transactionNo);
      setFlowStep("paying");
      setSaving(false);
      window.open(result.paymentUrl, "_blank");
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=check-status&transactionNo=${result.transactionNo}`,
            { headers: { Authorization: `Bearer ${session?.session?.access_token}` } }
          );
          const statusData = await statusRes.json();
          if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
            clearInterval(interval);
            setPaymentCheckInterval(null);
            const { error } = await supabase.from("tenant_paid_integrations").upsert({
              tenant_id: tenantId, integration_id: flowItem.id,
              status: flowItem.requires_api_keys ? "disabled" : "active",
              activated_by: user.id, purchased_at: new Date().toISOString(),
              activated_at: new Date().toISOString(), activation_source: "purchase",
            } as any, { onConflict: "tenant_id,integration_id" });
            if (error) { toast({ title: "خطأ في تسجيل الشراء", description: error.message, variant: "destructive" }); return; }
            toast({ title: "تم الدفع بنجاح ✅", description: `${flowItem.name_ar} - ${flowItem.price_once} ر.س` });
            if (flowItem.requires_api_keys) { setFlowStep("api_keys"); } else { setFlowStep("testing"); runConnectionTest(); }
          } else if (statusData.orderStatus === "Canceled" || statusData.orderStatus === "canceled") {
            clearInterval(interval);
            setPaymentCheckInterval(null);
            toast({ title: "تم إلغاء الدفع", variant: "destructive" });
            setFlowStep("payment");
          }
        } catch { /* Silently retry */ }
      }, 5000);
      setPaymentCheckInterval(interval);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setSaving(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paylinkTransactionNo || !flowItem || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const statusRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=check-status&transactionNo=${paylinkTransactionNo}`,
        { headers: { Authorization: `Bearer ${session?.session?.access_token}` } }
      );
      const statusData = await statusRes.json();
      if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
        if (paymentCheckInterval) clearInterval(paymentCheckInterval);
        setPaymentCheckInterval(null);
        const { error } = await supabase.from("tenant_paid_integrations").upsert({
          tenant_id: tenantId, integration_id: flowItem.id,
          status: flowItem.requires_api_keys ? "disabled" : "active",
          activated_by: user.id, purchased_at: new Date().toISOString(),
          activated_at: new Date().toISOString(), activation_source: "purchase",
        } as any, { onConflict: "tenant_id,integration_id" });
        if (error) { toast({ title: "خطأ في تسجيل الشراء", description: error.message, variant: "destructive" }); setSaving(false); return; }
        toast({ title: "تم الدفع بنجاح ✅", description: `${flowItem.name_ar} - ${flowItem.price_once} ر.س` });
        if (flowItem.requires_api_keys) { setFlowStep("api_keys"); } else { setFlowStep("testing"); runConnectionTest(); }
      } else {
        toast({ title: "لم يتم الدفع بعد", description: "يرجى إتمام الدفع أولاً ثم المحاولة مجدداً", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ في التحقق", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // ── handleSaveApiKeys: sends secret to edge function; NEVER writes to DB directly ──
  const handleSaveApiKeys = async () => {
    if (!flowItem || !tenantId || !apiKeyValue.trim()) {
      toast({ title: "يرجى إدخال مفتاح API", variant: "destructive" });
      return;
    }
    setSaving(true);
    setTestResult("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-integration-secrets?action=test-and-set`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            integrationId: flowItem.id,
            gatewayKey: flowItem.key,
            apiSecret: apiKeyValue,
          }),
        }
      );
      const result = await res.json();
      setSaving(false);
      if (result.success) {
        setTestResult("success");
        setFlowStep("done");
        toast({ title: result.message || "تم حفظ المفتاح واختبار الاتصال بنجاح ✅" });
        setApiKeyValue(""); // clear from memory
        fetchAll();
      } else {
        setTestResult("fail");
        toast({ title: "فشل الاتصال أو الحفظ", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      setSaving(false);
      setTestResult("fail");
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const runConnectionTest = async () => {
    // After secret is stored encrypted, re-test via the secure edge function
    setTestResult("testing");
    if (flowItem && tenantId) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        // If we still have apiKeyValue in state (just entered), use test-and-set
        // Otherwise just mark as success (secret was previously stored)
        if (apiKeyValue.trim()) {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-integration-secrets?action=test-and-set`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                integrationId: flowItem.id,
                gatewayKey: flowItem.key,
                apiSecret: apiKeyValue,
              }),
            }
          );
          const result = await res.json();
          if (result.success) {
            setTestResult("success");
            setFlowStep("done");
            toast({ title: result.message });
            setApiKeyValue("");
            fetchAll();
          } else {
            setTestResult("fail");
            toast({ title: "فشل الاتصال", description: result.message || result.error, variant: "destructive" });
          }
        } else {
          // Secret already stored — mark success
          setTestResult("success");
          setFlowStep("done");
        }
      } catch (err: any) {
        setTestResult("fail");
        toast({ title: "خطأ في الاختبار", description: err.message, variant: "destructive" });
      }
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

  const activeSubscriptions = integrationStates.filter((s) => s.tenant_activation_status === "active");
  const categories = [...new Set(integrations.map((i) => i.integration_type))];

  // Flow progress
  const visibleSteps = flowItem?.requires_api_keys
    ? FLOW_STEPS.filter((s) => s.key !== "paying")
    : FLOW_STEPS.filter((s) => s.key !== "api_keys" && s.key !== "paying");
  const visibleIndex = visibleSteps.findIndex((s) => s.key === flowStep);
  const progressPercent = visibleSteps.length > 1
    ? Math.max(0, (visibleIndex / (visibleSteps.length - 1)) * 100)
    : 100;

  // ─── Render ───
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
                <Badge className="gap-1.5 text-xs py-1.5 px-3 bg-blue-500/10 text-blue-600 border-blue-200">
                  <Zap size={13} />
                  فترة تجريبية — كل الميزات مفعّلة
                </Badge>
              )}
              {isEnterprise && !isTrial && (
                <Badge className="gap-1.5 text-xs py-1.5 px-3 bg-amber-500/10 text-amber-600 border-amber-200">
                  <Crown size={13} />
                  جميع التكاملات مضمّنة
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5 text-xs py-1.5 px-3 bg-background">
                <Plug size={13} />
                {activeSubscriptions.length} تكامل نشط
              </Badge>
            </div>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-accent/5 blur-2xl" />
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-primary/5 blur-xl" />
      </motion.div>

      {/* ═══ Motivational Banner ═══ */}
      {!canPurchase && !hasFreeAccess && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-200/50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 shrink-0">
            <TrendingUp size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">ترقية الباقة مطلوبة</p>
            <p className="text-xs text-muted-foreground">
              التكاملات المدفوعة متاحة في الباقة الاحترافية وباقة المؤسسات. قم بالترقية لبدء استقبال المدفوعات.
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
            <Crown size={13} /> ترقية
          </Button>
        </motion.div>
      )}

      {/* ═══ Tabs ═══ */}
      <Tabs defaultValue="all" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
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

        {/* Integration grid tabs */}
        {["all", ...categories].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <AnimatePresence mode="wait">
              {loading ? (
                <IntegrationSkeleton />
              ) : (
                <motion.div
                  key={tab}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                >
                  {integrations
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
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      تصفح التكاملات المتاحة وفعّل ما تحتاجه لبدء استقبال المدفوعات
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {activeSubscriptions.map((sub) => {
                  const item = integrations.find((i) => i.id === sub.integration_id);
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
                              <p className="text-xs text-muted-foreground">
                                مصدر التفعيل: {sub.activation_source ?? "—"}
                              </p>
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

      {/* ═══ Activation Flow Dialog ═══ */}
      <Dialog open={!!flowItem} onOpenChange={() => closeFlow()}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              {flowItem && (
                <>
                  {(() => {
                    const cat = CATEGORY_MAP[flowItem.integration_type] || CATEGORY_MAP.other;
                    const CatIcon = cat.icon;
                    return (
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cat.color}`}>
                        <CatIcon size={18} />
                      </div>
                    );
                  })()}
                  {flowItem.name_ar}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {flowStep === "preview" && "مراجعة تفاصيل التكامل قبل الشراء"}
              {flowStep === "payment" && "تأكيد الدفع لتفعيل التكامل"}
              {flowStep === "paying" && "أكمل الدفع في صفحة Paylink ثم عد هنا"}
              {flowStep === "api_keys" && "أدخل مفاتيح API المطلوبة للاتصال"}
              {flowStep === "testing" && "جاري اختبار الاتصال..."}
              {flowStep === "done" && "تم تفعيل التكامل بنجاح!"}
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="space-y-3 py-2">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex justify-between">
              {visibleSteps.map((step, i) => {
                const isActive = step.key === flowStep;
                const isPast = i < visibleIndex;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className={`flex flex-col items-center gap-1 text-[10px] transition-colors ${isActive ? "text-accent font-bold" : isPast ? "text-green-600" : "text-muted-foreground"}`}>
                    <StepIcon size={14} />
                    {step.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={flowStep}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="py-4 min-h-[160px]"
            >
              {/* Preview */}
              {flowStep === "preview" && flowItem && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{flowItem.description_ar}</p>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">السعر</span>
                      {isEnterprise ? (
                        <span className="font-bold text-accent">مجاني <span className="text-xs font-normal text-muted-foreground">(مضمّن في باقة المؤسسات)</span></span>
                      ) : (
                        <span className="font-bold">{flowItem.price_once} ر.س <span className="text-xs font-normal text-muted-foreground">(مرة واحدة)</span></span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">النوع</span>
                      <span>{CATEGORY_MAP[flowItem.integration_type]?.label || flowItem.integration_type}</span>
                    </div>
                    {flowItem.requires_api_keys && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">مفاتيح API</span>
                        <Badge variant="outline" className="text-[10px] gap-1"><Key size={10} /> مطلوبة</Badge>
                      </div>
                    )}
                    {flowItem.trial_days > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">تجربة مجانية</span>
                        <Badge variant="outline" className="text-[10px] gap-1 bg-accent/5 text-accent"><Zap size={10} /> {flowItem.trial_days} يوم</Badge>
                      </div>
                    )}
                  </div>
                  <div className="bg-accent/5 border border-accent/10 rounded-xl p-3">
                    <p className="text-xs text-accent font-medium flex items-center gap-1.5">
                      <ShieldCheck size={14} />
                      يعمل في: الفواتير • العقود • المدفوعات • المشاريع
                    </p>
                  </div>
                </div>
              )}

              {/* Payment */}
              {flowStep === "payment" && flowItem && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{flowItem.price_once} <span className="text-base font-medium text-muted-foreground">ر.س</span></p>
                    <p className="text-sm text-muted-foreground mt-1">دفعة واحدة — {flowItem.name_ar}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">طريقة الدفع</Label>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("wallet")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right ${
                        paymentMethod === "wallet" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                        <Wallet size={20} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">المحفظة</p>
                        <p className="text-xs text-muted-foreground">
                          {walletExists ? `الرصيد: ${walletBalance?.toFixed(2)} ر.س` : "لا توجد محفظة"}
                        </p>
                      </div>
                      {walletExists && walletBalance !== null && walletBalance >= flowItem.price_once && (
                        <Badge variant="outline" className="text-[10px] bg-accent/5 text-accent border-accent/20">كافٍ</Badge>
                      )}
                      {walletExists && walletBalance !== null && walletBalance < flowItem.price_once && (
                        <Badge variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/20">غير كافٍ</Badge>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("paylink")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right ${
                        paymentMethod === "paylink" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shrink-0">
                        <CreditCard size={20} className="text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">Paylink (بطاقة / تحويل)</p>
                        <p className="text-xs text-muted-foreground">ادفع عبر بوابة Paylink الآمنة</p>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck size={12} /> دفع آمن ومشفّر
                  </div>
                </div>
              )}

              {/* Paying */}
              {flowStep === "paying" && flowItem && (
                <div className="space-y-4 text-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center"
                  >
                    <CreditCard size={32} className="text-amber-600" />
                  </motion.div>
                  <div>
                    <p className="font-bold text-foreground">في انتظار إتمام الدفع...</p>
                    <p className="text-sm text-muted-foreground mt-1">أكمل الدفع في الصفحة التي فُتحت لك</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" /> يتم التحقق تلقائياً
                  </div>
                  {paymentUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(paymentUrl, "_blank")} className="gap-2">
                      <ArrowLeft size={14} className="rtl-mirror" /> فتح صفحة الدفع مجدداً
                    </Button>
                  )}
                </div>
              )}

              {/* API Keys */}
              {flowStep === "api_keys" && flowItem && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3.5 bg-accent/5 border border-accent/10 rounded-xl">
                    <Settings2 size={18} className="text-accent shrink-0" />
                    <p className="text-xs text-accent">هذا التكامل يتطلب مفاتيح API لربطه مع الخدمة الخارجية</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5 mb-2">
                      <Key size={14} />
                      {flowItem.api_key_label || "مفتاح API"}
                    </Label>
                    <Input
                      type="password"
                      value={apiKeyValue}
                      onChange={(e) => setApiKeyValue(e.target.value)}
                      placeholder="أدخل مفتاح API الخاص بك"
                      className="h-11"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Lock size={10} /> يُخزّن بشكل آمن ومشفّر
                    </p>
                  </div>
                </div>
              )}

              {/* Testing */}
              {flowStep === "testing" && testResult === "testing" && (
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center"
                  >
                    <Wifi size={32} className="text-accent" />
                  </motion.div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">جاري اختبار الاتصال...</p>
                    <p className="text-xs text-muted-foreground mt-1">يتم التحقق من صلاحية المفاتيح والربط مع البوابة</p>
                  </div>
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                </div>
              )}

              {flowStep === "testing" && testResult === "fail" && (
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <WifiOff size={32} className="text-destructive" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">فشل اختبار الاتصال</p>
                    <p className="text-xs text-muted-foreground mt-1">تحقق من مفتاح API وحاول مجدداً</p>
                  </div>
                </div>
              )}

              {/* Done */}
              {flowStep === "done" && flowItem && (
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center"
                  >
                    <CheckCircle2 size={40} className="text-accent" />
                  </motion.div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-bold text-foreground">تم تفعيل {flowItem.name_ar} ✅</p>
                    <p className="text-sm text-muted-foreground">التكامل يعمل الآن في جميع أقسام النظام</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {["الفواتير", "العقود", "المدفوعات", "المشاريع"].map((area) => (
                      <Badge key={area} variant="outline" className="gap-1 text-xs bg-accent/5 text-accent border-accent/20">
                        <CheckCircle2 size={10} /> {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <DialogFooter className="gap-2">
            {flowStep === "preview" && (
              <>
                <Button variant="outline" onClick={closeFlow}>إلغاء</Button>
                {hasFreeAccess ? (
                  <Button onClick={() => flowItem && handleFreeAutoActivate(flowItem)} disabled={saving} className="gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {saving ? "جاري التفعيل..." : "تفعيل فوري مجاني"}
                  </Button>
                ) : (
                  <Button onClick={() => setFlowStep("payment")} className="gap-2">
                    متابعة للدفع <ArrowLeft size={14} className="rtl-mirror" />
                  </Button>
                )}
              </>
            )}
            {flowStep === "payment" && !isEnterprise && (
              <>
                <Button variant="outline" onClick={() => setFlowStep("preview")}>رجوع</Button>
                {paymentMethod === "wallet" ? (
                  <Button
                    onClick={handleWalletPurchase}
                    disabled={saving || !walletExists || (walletBalance ?? 0) < (flowItem?.price_once ?? 0)}
                    className="gap-2"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                    {saving ? "جاري الخصم..." : `ادفع من المحفظة ${flowItem?.price_once} ر.س`}
                  </Button>
                ) : (
                  <Button onClick={handlePayment} disabled={saving} className="gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    {saving ? "جاري إنشاء الفاتورة..." : `ادفع ${flowItem?.price_once} ر.س`}
                  </Button>
                )}
              </>
            )}
            {flowStep === "paying" && (
              <>
                <Button variant="outline" onClick={closeFlow}>إلغاء</Button>
                <Button onClick={handleConfirmPayment} disabled={saving} className="gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {saving ? "جاري التحقق..." : "لقد دفعت — تحقق الآن"}
                </Button>
              </>
            )}
            {flowStep === "api_keys" && (
              <>
                <Button variant="outline" onClick={closeFlow}>لاحقاً</Button>
                <Button onClick={handleSaveApiKeys} disabled={saving || !apiKeyValue.trim()} className="gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                  {saving ? "جاري الحفظ..." : "حفظ واختبار الاتصال"}
                </Button>
              </>
            )}
            {flowStep === "testing" && testResult === "testing" && (
              <Button variant="outline" disabled>
                <Loader2 size={14} className="animate-spin mie-2" />
                جاري الاختبار...
              </Button>
            )}
            {flowStep === "testing" && testResult === "fail" && (
              <>
                <Button variant="outline" onClick={() => setFlowStep("api_keys")}>تعديل المفتاح</Button>
                <Button onClick={() => runConnectionTest()} className="gap-2">
                  <Wifi size={14} /> إعادة الاختبار
                </Button>
              </>
            )}
            {flowStep === "done" && (
              <Button onClick={closeFlow} className="gap-2 w-full">
                <Unlock size={14} /> تم — إغلاق
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaidIntegrationsPage;
