/**
 * IntegrationFlowPage
 * ────────────────────
 * صفحة كاملة لتفعيل التكامل (شراء + API Keys + اختبار)
 * Route: /dashboard/integrations/setup/:integrationId
 *
 * بديل عن Dialog في PaidIntegrationsPage
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight, ChevronLeft, Loader2, CheckCircle2, Wifi, WifiOff,
  CreditCard, Key, Lock, ShieldCheck, Sparkles, Wallet, Power,
  Settings2, CircleDot, Unlock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type FlowStep = "preview" | "payment" | "paying" | "api_keys" | "testing" | "done";

const FLOW_STEPS: { key: FlowStep; label: string; icon: any }[] = [
  { key: "preview",  label: "عرض التكامل",   icon: CircleDot },
  { key: "payment",  label: "الدفع",          icon: CreditCard },
  { key: "paying",   label: "إتمام الدفع",    icon: ShieldCheck },
  { key: "api_keys", label: "إعداد المفاتيح", icon: Key },
  { key: "testing",  label: "اختبار الاتصال", icon: Wifi },
  { key: "done",     label: "مفعّل",          icon: CheckCircle2 },
];

interface IntegrationState {
  integration_id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  integration_type: string;
  price_once: number;
  is_ready: boolean;
  requires_api_keys: boolean;
  api_key_label: string;
  trial_days: number;
  tenant_activation_status: string;
  activation_source: string | null;
  has_secret_configured: boolean;
  entitlement_allowed: boolean;
  entitlement_reason: string;
  can_activate: boolean;
}

const IntegrationFlowPage = () => {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();

  const [integrationState, setIntegrationState] = useState<IntegrationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [flowStep, setFlowStep] = useState<FlowStep>("preview");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "fail">("idle");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paylink">("paylink");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletExists, setWalletExists] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paylinkTransactionNo, setPaylinkTransactionNo] = useState<string | null>(null);

  const isTrial       = integrationState?.entitlement_reason === "trial";
  const isEnterprise  = integrationState?.entitlement_reason === "plan" && integrationState?.entitlement_allowed;
  const hasFreeAccess = isTrial || isEnterprise;
  const isPurchased   = integrationState?.tenant_activation_status !== "none";

  const fetchState = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_paid_integrations_state", { p_tenant_id: tenantId } as any);
    if (data) {
      const match = (data as any[]).find((r: any) => r.integration_id === integrationId);
      if (match) {
        setIntegrationState(match as IntegrationState);
        // Set initial flow step based on state
        if (match.tenant_activation_status !== "none") {
          if (match.requires_api_keys && !match.has_secret_configured) {
            setFlowStep("api_keys");
          } else if (match.tenant_activation_status === "active") {
            setFlowStep("done");
          } else {
            setFlowStep("api_keys");
          }
        }
      }
    }
    setLoading(false);
  }, [tenantId, integrationId]);

  const fetchWalletBalance = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchState();
    fetchWalletBalance();
  }, [fetchState, fetchWalletBalance]);

  const handleFreeAutoActivate = async () => {
    if (!integrationState) return;
    setSaving(true);
    const source = isTrial ? "trial_auto" : "enterprise_auto";
    const label = isTrial ? "الفترة التجريبية" : "باقة المؤسسات";
    try {
      const { error } = await supabase.from("tenant_paid_integrations").upsert({
        tenant_id: tenantId,
        integration_id: integrationState.integration_id,
        status: integrationState.requires_api_keys ? "disabled" : "active",
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

      toast({ title: "تم التفعيل تلقائياً ✅", description: `${integrationState.name_ar} — مضمّن في ${label}` });
      fetchState();

      if (integrationState.requires_api_keys) {
        setFlowStep("api_keys");
      } else {
        setFlowStep("done");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleWalletPurchase = async () => {
    if (!integrationState || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=purchase-integration`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({ integrationId: integrationState.integration_id }),
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast({ title: "فشل الشراء", description: result.error || "حدث خطأ", variant: "destructive" });
        setSaving(false);
        return;
      }
      toast({ title: "تم الشراء بنجاح ✅", description: `${integrationState.name_ar} — الرصيد المتبقي: ${result.new_balance} ر.س` });
      setWalletBalance(result.new_balance);
      fetchState();
      if (result.requires_api_keys) {
        setFlowStep("api_keys");
      } else {
        setFlowStep("done");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handlePaylink = async () => {
    if (!integrationState || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      const orderNumber = `INT-${integrationState.key}-${Date.now()}`;
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=create-invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
          body: JSON.stringify({
            amount: integrationState.price_once,
            clientName: profile?.full_name || "عميل",
            clientMobile: "0500000000",
            clientEmail: profile?.email || user.email || "",
            orderNumber,
            note: `شراء تكامل: ${integrationState.name_ar}`,
            callBackUrl: window.location.href,
            products: [{ title: integrationState.name_ar, price: integrationState.price_once, qty: 1, description: `تكامل ${integrationState.name_en}` }],
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
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setSaving(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paylinkTransactionNo || !integrationState || !tenantId || !user) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const statusRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=check-status&transactionNo=${paylinkTransactionNo}`,
        { headers: { Authorization: `Bearer ${session?.session?.access_token}` } }
      );
      const statusData = await statusRes.json();
      if (statusData.orderStatus === "Paid" || statusData.orderStatus === "paid") {
        await supabase.from("tenant_paid_integrations").upsert({
          tenant_id: tenantId, integration_id: integrationState.integration_id,
          status: integrationState.requires_api_keys ? "disabled" : "active",
          activated_by: user.id, purchased_at: new Date().toISOString(),
          activated_at: new Date().toISOString(), activation_source: "purchase",
        } as any, { onConflict: "tenant_id,integration_id" });
        toast({ title: "تم الدفع بنجاح ✅", description: `${integrationState.name_ar} - ${integrationState.price_once} ر.س` });
        fetchState();
        if (integrationState.requires_api_keys) setFlowStep("api_keys"); else setFlowStep("done");
      } else {
        toast({ title: "لم يتم الدفع بعد", description: "يرجى إتمام الدفع أولاً ثم المحاولة مجدداً", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ في التحقق", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleSaveApiKeys = async () => {
    if (!integrationState || !tenantId || !apiKeyValue.trim()) {
      toast({ title: "يرجى إدخال مفتاح API", variant: "destructive" });
      return;
    }
    setSaving(true);
    setTestResult("testing");
    setFlowStep("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-integration-secrets?action=test-and-set`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            integrationId: integrationState.integration_id,
            gatewayKey: integrationState.key,
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
        setApiKeyValue("");
        fetchState();
      } else {
        setTestResult("fail");
        setFlowStep("testing");
        toast({ title: "فشل الاتصال أو الحفظ", description: result.message || result.error, variant: "destructive" });
      }
    } catch (err: any) {
      setSaving(false);
      setTestResult("fail");
      setFlowStep("testing");
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  // Progress
  const visibleSteps = integrationState?.requires_api_keys
    ? FLOW_STEPS.filter((s) => s.key !== "paying")
    : FLOW_STEPS.filter((s) => s.key !== "api_keys" && s.key !== "paying");
  const visibleIndex = visibleSteps.findIndex((s) => s.key === flowStep);
  const progressPercent = visibleSteps.length > 1
    ? Math.max(0, (visibleIndex / (visibleSteps.length - 1)) * 100)
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integrationState) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <p className="text-muted-foreground">التكامل غير موجود.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard/paid-integrations")}>
          <ArrowRight size={16} /> رجوع
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6" dir="rtl">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => navigate("/dashboard/paid-integrations")}
          className="hover:text-foreground transition-colors"
        >
          التكاملات
        </button>
        <ChevronLeft size={14} className="rtl:rotate-180" />
        <span className="text-foreground font-medium">{integrationState.name_ar}</span>
      </nav>

      {/* ── Back button ── */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/dashboard/paid-integrations")}
      >
        <ArrowRight size={16} /> رجوع للتكاملات
      </Button>

      {/* ── Main Card ── */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-lg font-bold text-foreground">{integrationState.name_ar}</h1>
            <p className="text-sm text-muted-foreground" dir="ltr">{integrationState.name_en}</p>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex justify-between">
              {visibleSteps.map((step, i) => {
                const isActive = step.key === flowStep;
                const isPast = i < visibleIndex;
                const StepIcon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={`flex flex-col items-center gap-1 text-[10px] transition-colors ${
                      isActive ? "text-accent font-bold" : isPast ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
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
              className="min-h-[200px]"
            >
              {/* Preview */}
              {flowStep === "preview" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{integrationState.description_ar}</p>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">السعر</span>
                      {isEnterprise ? (
                        <span className="font-bold text-accent">مجاني <span className="text-xs font-normal text-muted-foreground">(مضمّن في باقة المؤسسات)</span></span>
                      ) : (
                        <span className="font-bold">{integrationState.price_once} ر.س <span className="text-xs font-normal text-muted-foreground">(مرة واحدة)</span></span>
                      )}
                    </div>
                    {integrationState.requires_api_keys && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">مفاتيح API</span>
                        <Badge variant="outline" className="text-[10px] gap-1"><Key size={10} /> مطلوبة</Badge>
                      </div>
                    )}
                    {integrationState.trial_days > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">تجربة مجانية</span>
                        <Badge variant="outline" className="text-[10px] gap-1 bg-accent/5 text-accent">{integrationState.trial_days} يوم</Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => navigate("/dashboard/paid-integrations")} className="flex-1">
                      إلغاء
                    </Button>
                    {hasFreeAccess ? (
                      <Button onClick={handleFreeAutoActivate} disabled={saving} className="flex-1 gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {saving ? "جاري التفعيل..." : "تفعيل فوري مجاني"}
                      </Button>
                    ) : (
                      <Button onClick={() => setFlowStep("payment")} className="flex-1 gap-2">
                        متابعة للدفع <ArrowRight size={14} className="rtl-mirror" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Payment */}
              {flowStep === "payment" && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{integrationState.price_once} <span className="text-base font-medium text-muted-foreground">ر.س</span></p>
                    <p className="text-sm text-muted-foreground mt-1">دفعة واحدة — {integrationState.name_ar}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">طريقة الدفع</Label>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("wallet")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right ${paymentMethod === "wallet" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"}`}
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
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("paylink")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-right ${paymentMethod === "paylink" ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"}`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shrink-0">
                        <CreditCard size={20} className="text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">Paylink</p>
                        <p className="text-xs text-muted-foreground">ادفع عبر بوابة Paylink الآمنة</p>
                      </div>
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => setFlowStep("preview")} className="flex-1">رجوع</Button>
                    {paymentMethod === "wallet" ? (
                      <Button
                        onClick={handleWalletPurchase}
                        disabled={saving || !walletExists || (walletBalance ?? 0) < integrationState.price_once}
                        className="flex-1 gap-2"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
                        {saving ? "جاري الخصم..." : `ادفع من المحفظة ${integrationState.price_once} ر.س`}
                      </Button>
                    ) : (
                      <Button onClick={handlePaylink} disabled={saving} className="flex-1 gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        {saving ? "جاري إنشاء الفاتورة..." : `ادفع ${integrationState.price_once} ر.س`}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Paying */}
              {flowStep === "paying" && (
                <div className="space-y-4 text-center py-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center"
                  >
                    <CreditCard size={32} className="text-primary" />
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
                      فتح صفحة الدفع مجدداً
                    </Button>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => navigate("/dashboard/paid-integrations")} className="flex-1">إلغاء</Button>
                    <Button onClick={handleConfirmPayment} disabled={saving} className="flex-1 gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {saving ? "جاري التحقق..." : "لقد دفعت — تحقق الآن"}
                    </Button>
                  </div>
                </div>
              )}

              {/* API Keys */}
              {flowStep === "api_keys" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3.5 bg-accent/5 border border-accent/10 rounded-xl">
                    <Settings2 size={18} className="text-accent shrink-0" />
                    <p className="text-xs text-accent">هذا التكامل يتطلب مفاتيح API لربطه مع الخدمة الخارجية</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5 mb-2">
                      <Key size={14} />
                      {integrationState.api_key_label || "مفتاح API"}
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
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={() => navigate("/dashboard/paid-integrations")} className="flex-1">لاحقاً</Button>
                    <Button onClick={handleSaveApiKeys} disabled={saving || !apiKeyValue.trim()} className="flex-1 gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                      {saving ? "جاري الحفظ..." : "حفظ واختبار الاتصال"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Testing */}
              {flowStep === "testing" && testResult === "testing" && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
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
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <WifiOff size={32} className="text-destructive" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">فشل اختبار الاتصال</p>
                    <p className="text-xs text-muted-foreground mt-1">تحقق من مفتاح API وحاول مجدداً</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setFlowStep("api_keys")}>تعديل المفتاح</Button>
                    <Button onClick={handleSaveApiKeys} className="gap-2">
                      <Wifi size={14} /> إعادة الاختبار
                    </Button>
                  </div>
                </div>
              )}

              {/* Done */}
              {flowStep === "done" && (
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
                    <p className="text-lg font-bold text-foreground">تم تفعيل {integrationState.name_ar} ✅</p>
                    <p className="text-sm text-muted-foreground">التكامل يعمل الآن في جميع أقسام النظام</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {["الفواتير", "العقود", "المدفوعات", "المشاريع"].map((area) => (
                      <Badge key={area} variant="outline" className="gap-1 text-xs bg-accent/5 text-accent border-accent/20">
                        <CheckCircle2 size={10} /> {area}
                      </Badge>
                    ))}
                  </div>
                  <Button onClick={() => navigate("/dashboard/paid-integrations")} className="w-full gap-2 mt-2">
                    <Unlock size={14} /> العودة للتكاملات
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationFlowPage;
