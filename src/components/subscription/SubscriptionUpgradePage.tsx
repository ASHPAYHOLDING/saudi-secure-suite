import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Rocket, Wallet, Building2, Loader2, ArrowRight,
  CheckCircle2, AlertTriangle, Crown, Zap, Shield, Calendar,
  Check, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { toast } from "@/hooks/use-toast";
import DiscountCodeInput from "./DiscountCodeInput";
import BankTransferForm from "./BankTransferForm";

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
}

const CYCLE_LABELS: Record<string, string> = { monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };

const PLAN_QUICK_FEATURES: Record<string, string[]> = {
  starter: ["2 مستخدمين", "100 فاتورة / شهر", "5GB تخزين", "تقارير أساسية", "ZATCA Phase 1", "فرع واحد"],
  business: ["15 مستخدم", "فواتير غير محدودة", "100GB تخزين", "ZATCA Phase 2", "AI محاسبي", "5 فروع", "نظام موافقات"],
  professional: ["15 مستخدم", "فواتير غير محدودة", "100GB تخزين", "ZATCA Phase 2", "AI محاسبي", "5 فروع", "نظام موافقات"],
  enterprise: ["مستخدمين غير محدود", "فواتير غير محدودة", "تخزين مخصص", "AI متقدم", "سير عمل مخصص", "تمويل داخلي", "مدير حساب", "SLA 99.9%"],
};

const SubscriptionUpgradePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan_id");
  const { user, tenantId } = useAuth();
  const { invalidate: invalidateEntitlements } = useEntitlementsContext();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const [selectedCycle, setSelectedCycle] = useState<string>("monthly");
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const [discountCode, setDiscountCode] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paylink" | "bank_transfer">("wallet");
  const [bankReference, setBankReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (!tenantId || !planId) return;
    const fetchData = async () => {
      const [planRes, allPlansRes, subRes] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("id", planId).maybeSingle(),
        supabase.from("subscription_plans").select("*").eq("is_active", true),
        supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (planRes.data) setPlan(planRes.data as Plan);
      if (subRes.data) {
        setSubscription(subRes.data as Subscription);
        setSelectedCycle(subRes.data.billing_cycle);
        if (allPlansRes.data) {
          const cp = (allPlansRes.data as Plan[]).find(p => p.id === subRes.data.plan_id);
          if (cp) setCurrentPlan(cp);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [tenantId, planId]);

  const getPlanPrice = (p: Plan, cycle: string) => {
    if (cycle === "yearly" && p.price_yearly) return p.price_yearly;
    if (cycle === "quarterly" && p.price_quarterly) return p.price_quarterly;
    return p.price_monthly;
  };

  const handleUpgrade = async () => {
    if (!subscription || !user || !tenantId || !plan) return;
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

        let responseData = response.data;
        if (response.error && !responseData) {
          try {
            const ctx = (response.error as any)?.context;
            if (ctx && typeof ctx.json === "function") {
              responseData = await ctx.json();
            }
          } catch { /* ignore */ }
        }

        if (response.error || !responseData?.success) {
          if (responseData?.already_processed) {
            toast({ title: "تنبيه", description: "تمت معالجة هذا الطلب مسبقاً" });
            navigate("/dashboard/subscription");
            return;
          }
          const errMsg = responseData?.error || response.error?.message || "فشلت العملية";
          if (responseData?.insufficient_balance) {
            toast({ title: "رصيد غير كافي", description: `المطلوب: ${responseData.required} ر.س — المتاح: ${responseData.available} ر.س`, variant: "destructive" });
          } else if (responseData?.needs_wallet) {
            toast({ title: "خطأ", description: "يرجى إنشاء محفظة رقمية أولاً من قسم المحفظة", variant: "destructive" });
          } else {
            toast({ title: "خطأ", description: errMsg, variant: "destructive" });
          }
          setUpgrading(false);
          return;
        }

        toast({ title: "تم بنجاح ✅", description: response.data.message });
        invalidateEntitlements();
      } else if (paymentMethod === "paylink") {
        const orderNum = `SUB-${Date.now()}`;
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
          tenant_id: tenantId, requested_by: user.id, plan_id: plan.id,
          billing_cycle: selectedCycle, amount: finalAmount,
          discount_code: discountCode || null, payment_method: "paylink",
          bank_reference: response.data.transactionNo, status: "pending",
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
          if (!uploadErr) { receiptUrl = filePath; receiptFilename = receiptFile.name; }
        }

        const { error: reqErr } = await supabase.from("subscription_upgrade_requests").insert({
          tenant_id: tenantId, requested_by: user.id, plan_id: plan.id,
          billing_cycle: selectedCycle, amount: finalAmount,
          discount_code: discountCode || null, payment_method: "bank_transfer",
          bank_reference: bankReference.trim(), receipt_url: receiptUrl,
          receipt_filename: receiptFilename, status: "pending",
        });

        if (reqErr) {
          toast({ title: "خطأ", description: reqErr.message, variant: "destructive" });
          setUpgrading(false);
          return;
        }
        toast({ title: "تم إرسال الطلب ✅", description: "سيتم مراجعة التحويل البنكي واعتماد الترقية بعد التحقق" });
      }

      navigate("/dashboard/subscription");
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message || "حدث خطأ غير متوقع", variant: "destructive" });
    }
    setUpgrading(false);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto" dir="rtl">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted/40 animate-pulse rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto text-center" dir="rtl">
        <div className="py-20 space-y-4">
          <AlertTriangle size={48} className="mx-auto text-muted-foreground/40" />
          <p className="text-lg text-muted-foreground">لم يتم العثور على الباقة المطلوبة</p>
          <Button variant="outline" onClick={() => navigate("/dashboard/subscription")}>
            العودة للاشتراكات
          </Button>
        </div>
      </div>
    );
  }

  const isUpgrade = (currentPlan?.sort_order || 0) < plan.sort_order;
  const quickFeatures = PLAN_QUICK_FEATURES[plan.slug] || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6" dir="rtl" style={{ direction: "rtl", textAlign: "right" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {isUpgrade ? "ترقية الاشتراك" : "تغيير الباقة"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isUpgrade ? "الترقية" : "التغيير"} إلى باقة {plan.name_ar}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/subscription")} className="gap-2 rounded-xl">
          <ArrowRight size={16} />
          العودة
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Right Column - Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Plan Card */}
          <Card className="overflow-hidden border-accent/20">
            <div className="h-1 bg-gradient-to-l from-accent to-accent/60" />
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 text-2xl">
                  {plan.slug === "enterprise" ? "🏢" : plan.slug === "starter" ? "⚡" : "👑"}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{plan.name_ar}</h3>
                  <p className="text-xs text-muted-foreground">{plan.name_en}</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2">
                {quickFeatures.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Check size={11} />
                    </div>
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
                {quickFeatures.length > 5 && (
                  <li className="text-xs text-muted-foreground pr-7">+ {quickFeatures.length - 5} ميزة إضافية</li>
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">ملخص الطلب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">من:</span>
                <span className="font-medium">{currentPlan?.name_ar || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">إلى:</span>
                <span className="font-bold text-accent">{plan.name_ar}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">الدورة:</span>
                <span>{CYCLE_LABELS[selectedCycle]}</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                <span className="text-muted-foreground">الإجمالي:</span>
                <div className="text-left">
                  {discountedPrice !== null ? (
                    <>
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        {getPlanPrice(plan, selectedCycle).toLocaleString("ar-SA")} ر.س
                      </span>
                      <span className="text-xl font-bold text-accent">{discountedPrice.toLocaleString("ar-SA")} ر.س</span>
                    </>
                  ) : (
                    <span className="text-xl font-bold">{getPlanPrice(plan, selectedCycle).toLocaleString("ar-SA")} ر.س</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Left Column - Payment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 space-y-5"
        >
          {/* Billing Cycle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} className="text-accent" />
                دورة الفوترة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {(["monthly", "quarterly", "yearly"] as const).map((cycle) => {
                  const price = getPlanPrice(plan, cycle);
                  const available = cycle === "monthly" || (cycle === "quarterly" && plan.price_quarterly) || (cycle === "yearly" && plan.price_yearly);
                  if (!available) return null;
                  return (
                    <button
                      key={cycle}
                      onClick={() => { setSelectedCycle(cycle); setDiscountedPrice(null); setDiscountCode(""); }}
                      className={`relative p-3 rounded-xl text-center transition-all duration-200 border-2 ${
                        selectedCycle === cycle
                          ? "border-accent bg-accent/5 shadow-md"
                          : "border-border/50 hover:border-accent/30"
                      }`}
                    >
                      <p className="text-xs font-medium text-muted-foreground">{CYCLE_LABELS[cycle]}</p>
                      <p className={`text-lg font-bold mt-1 ${selectedCycle === cycle ? "text-accent" : "text-foreground"}`}>
                        {price.toLocaleString("ar-SA")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">ر.س</p>
                      {cycle === "yearly" && (
                        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-0 text-[9px] px-2 py-0">
                          وفر 20%
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Discount Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield size={16} className="text-accent" />
                كود خصم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DiscountCodeInput
                planId={plan.id}
                originalPrice={getPlanPrice(plan, selectedCycle)}
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
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard size={16} className="text-accent" />
                طريقة الدفع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        سيتم خصم <span className="font-bold text-foreground">{(discountedPrice ?? getPlanPrice(plan, selectedCycle)).toLocaleString("ar-SA")} ر.س</span> من رصيد محفظتك فوراً.
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
                        سيتم فتح صفحة دفع آمنة لإتمام العملية. المبلغ: <span className="font-bold text-foreground">{(discountedPrice ?? getPlanPrice(plan, selectedCycle)).toLocaleString("ar-SA")} ر.س</span>
                      </p>
                    </div>
                  )}

                  {paymentMethod === "bank_transfer" && (
                    <BankTransferForm
                      amount={discountedPrice ?? getPlanPrice(plan, selectedCycle)}
                      bankReference={bankReference}
                      onBankReferenceChange={setBankReference}
                      receiptFile={receiptFile}
                      onReceiptFileChange={setReceiptFile}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/subscription")}
              className="w-full sm:w-auto h-12 rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full sm:flex-1 gap-2 h-12 rounded-xl shadow-lg shadow-accent/10 text-base font-bold"
            >
              {upgrading ? <Loader2 size={18} className="animate-spin" /> : (
                paymentMethod === "wallet" ? <Wallet size={18} /> :
                paymentMethod === "paylink" ? <CreditCard size={18} /> :
                <Building2 size={18} />
              )}
              {paymentMethod === "wallet" ? "دفع وتأكيد الترقية" :
               paymentMethod === "paylink" ? "الدفع بالبطاقة" :
               "إرسال طلب الترقية"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SubscriptionUpgradePage;
