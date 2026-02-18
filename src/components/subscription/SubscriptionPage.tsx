import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, Crown, Clock, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertTriangle, History, Zap, Shield, Calendar,
  Wallet, Building2, Loader2, Upload, Copy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

const STATUS_MAP: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  active: { label: "نشط", class: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={14} /> },
  trial: { label: "تجريبي", class: "bg-amber-100 text-amber-700", icon: <Clock size={14} /> },
  past_due: { label: "فترة سماح", class: "bg-red-100 text-red-700", icon: <AlertTriangle size={14} /> },
  cancelled: { label: "ملغي", class: "bg-muted text-muted-foreground", icon: <AlertTriangle size={14} /> },
  expired: { label: "منتهي", class: "bg-muted text-muted-foreground", icon: <AlertTriangle size={14} /> },
};

const CYCLE_LABELS: Record<string, string> = { monthly: "شهري", quarterly: "ربع سنوي", yearly: "سنوي" };
const ACTION_LABELS: Record<string, string> = {
  upgrade: "ترقية", downgrade: "تخفيض", cancel: "إلغاء", renew: "تجديد",
  extend: "تمديد", status_change: "تغيير حالة", plan_change: "تغيير خطة", cycle_change: "تغيير دورة",
};

const SubscriptionPage = () => {
  const { user, tenantId } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
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

  const fetchData = async () => {
    if (!tenantId) return;
    const [plansRes, subRes, logsRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("subscriptions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("subscription_logs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (subRes.data) {
      setSubscription(subRes.data as Subscription);
      setSelectedCycle(subRes.data.billing_cycle);
    }
    if (logsRes.data) setLogs(logsRes.data as SubLog[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tenantId]);

  const currentPlan = plans.find((p) => p.id === subscription?.plan_id);

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

      // ── Wallet Payment ──
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
      }

      // ── Paylink (Card Payment) ──
      else if (paymentMethod === "paylink") {
        const orderNum = `SUB-${Date.now()}`;
        // Webhook URL for Paylink to call after payment (server-side verification)
        const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-webhook?action=webhook`;
        // Redirect URL for user after payment (just UI feedback)
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

        // Store pending request so we can activate after callback
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

        // Redirect to payment page
        window.open(response.data.paymentUrl, "_blank");
        toast({ title: "تم إنشاء رابط الدفع", description: "تم فتح صفحة الدفع في نافذة جديدة" });
      }

      // ── Bank Transfer ──
      else if (paymentMethod === "bank_transfer") {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl" style={{ direction: "rtl", textAlign: "right" }}>
      <div className="text-right">
        <h1 className="text-2xl font-bold text-foreground text-right">إدارة الاشتراك</h1>
        <p className="text-sm text-muted-foreground text-right">عرض وإدارة خطة اشتراكك الحالية</p>
      </div>

      {/* Current Subscription Card */}
      {subscription && currentPlan && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-accent via-accent/60 to-transparent" />
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                      <Crown className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{currentPlan.name_ar}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={STATUS_MAP[subscription.status]?.class || ""}>
                          {STATUS_MAP[subscription.status]?.icon}
                          <span className="mr-1">{STATUS_MAP[subscription.status]?.label || subscription.status}</span>
                        </Badge>
                        <Badge variant="outline">{CYCLE_LABELS[subscription.billing_cycle]}</Badge>
                        {subscription.cancel_at_period_end && (
                          <Badge variant="destructive">سيتم الإلغاء</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {currentPlan.max_users && (
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-foreground">{currentPlan.max_users}</p>
                        <p className="text-xs text-muted-foreground">مستخدم</p>
                      </div>
                    )}
                    {currentPlan.max_invoices && (
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-foreground">{currentPlan.max_invoices}</p>
                        <p className="text-xs text-muted-foreground">فاتورة/شهر</p>
                      </div>
                    )}
                    {currentPlan.max_storage_gb && (
                      <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                        <p className="text-lg font-bold text-foreground">{currentPlan.max_storage_gb} GB</p>
                        <p className="text-xs text-muted-foreground">تخزين</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
                      <p className="text-lg font-bold text-foreground">{currentPlan.grace_period_days}</p>
                      <p className="text-xs text-muted-foreground">يوم سماح</p>
                    </div>
                  </div>
                </div>

                <div className="text-start space-y-2 min-w-[180px]">
                  <p className="text-3xl font-bold text-foreground">
                    {getPlanPrice(currentPlan, subscription.billing_cycle).toLocaleString("ar-SA")}
                    <span className="text-sm font-normal text-muted-foreground mr-1">ر.س/{CYCLE_LABELS[subscription.billing_cycle]}</span>
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>المتبقي: {daysRemaining} يوم</span>
                      <span>{progressPct}%</span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      ينتهي: {new Date(subscription.current_period_end).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                </div>
              </div>

              {subscription.status === "past_due" && subscription.grace_ends_at && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle size={16} className="inline ml-1" />
                  فترة السماح تنتهي في {new Date(subscription.grace_ends_at).toLocaleDateString("ar-SA")} — يرجى تجديد الاشتراك لتجنب الإيقاف
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="plans" className="space-y-4" dir="rtl">
        <TabsList>
          <TabsTrigger value="plans" className="gap-1"><Zap size={14} /> الخطط المتاحة</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History size={14} /> سجل الاشتراك</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans">
          {/* Cycle Selector */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {(["monthly", "quarterly", "yearly"] as const).map((cycle) => (
              <Button
                key={cycle}
                size="sm"
                variant={selectedCycle === cycle ? "default" : "outline"}
                onClick={() => setSelectedCycle(cycle)}
              >
                {CYCLE_LABELS[cycle]}
                {cycle === "yearly" && <Badge className="mr-1 bg-emerald-100 text-emerald-700 text-[10px]">وفّر 20%</Badge>}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" dir="rtl" style={{ direction: "rtl" }}>
            {plans.map((plan, i) => {
              const isCurrent = plan.id === subscription?.plan_id;
              const price = getPlanPrice(plan, selectedCycle);
              const monthlyEq = getMonthlyEquivalent(plan, selectedCycle);
              const features = Array.isArray(plan.features) ? plan.features : [];

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className={`relative h-full flex flex-col ${isCurrent ? "border-accent ring-1 ring-accent/30" : ""}`} dir="rtl" style={{ direction: "rtl", textAlign: "right" }}>
                    {isCurrent && (
                      <div className="absolute -top-3 right-4">
                        <Badge className="bg-accent text-accent-foreground">خطتك الحالية</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg text-right">{plan.name_ar}</CardTitle>
                      <div className="mt-2 text-right">
                        <span className="text-3xl font-bold text-foreground">{price.toLocaleString("ar-SA")}</span>
                        <span className="text-sm text-muted-foreground me-1">ر.س/{CYCLE_LABELS[selectedCycle]}</span>
                        {selectedCycle !== "monthly" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ≈ {Math.round(monthlyEq).toLocaleString("ar-SA")} ر.س/شهر
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <div className="space-y-2 text-sm text-right">
                        {plan.max_users && (
                          <div className="flex items-center gap-2" style={{ direction: "rtl" }}>
                            <CheckCircle2 size={14} className="text-accent shrink-0" />
                            <span>{plan.max_users} مستخدم</span>
                          </div>
                        )}
                        {plan.max_invoices && (
                          <div className="flex items-center gap-2" style={{ direction: "rtl" }}>
                            <CheckCircle2 size={14} className="text-accent shrink-0" />
                            <span>{plan.max_invoices} فاتورة/شهر</span>
                          </div>
                        )}
                        {plan.max_storage_gb && (
                          <div className="flex items-center gap-2" style={{ direction: "rtl" }}>
                            <CheckCircle2 size={14} className="text-accent shrink-0" />
                            <span>{plan.max_storage_gb} GB تخزين</span>
                          </div>
                        )}
                        {features.map((f: string, fi: number) => (
                          <div key={fi} className="flex items-center gap-2" style={{ direction: "rtl" }}>
                            <CheckCircle2 size={14} className="text-accent shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 text-muted-foreground" style={{ direction: "rtl" }}>
                          <Shield size={14} className="shrink-0" />
                          <span>فترة سماح {plan.grace_period_days} يوم</span>
                        </div>
                      </div>

                      <div className="pt-3">
                        {isCurrent ? (
                          <Button variant="outline" className="w-full" disabled>
                            خطتك الحالية
                          </Button>
                        ) : plan.slug === "enterprise" ? (
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => window.open("mailto:sales@numaxio.com?subject=طلب باقة المؤسسي", "_blank")}
                          >
                            <Building2 size={16} className="ml-1" /> تواصل مع المبيعات
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            variant={(currentPlan?.sort_order || 0) < plan.sort_order ? "default" : "outline"}
                            onClick={() => setUpgradeDialog(plan)}
                          >
                            {(currentPlan?.sort_order || 0) < plan.sort_order ? (
                              <><ArrowUpRight size={16} className="ml-1" /> ترقية</>
                            ) : (
                              <><ArrowDownRight size={16} className="ml-1" /> تخفيض</>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {subscription && !subscription.cancel_at_period_end && subscription.status === "active" && (
            <div className="mt-6 text-center">
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleCancel}>
                إلغاء الاشتراك عند نهاية الفترة
              </Button>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History size={18} className="text-accent" />
                سجل التغييرات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد تغييرات مسجلة</div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => {
                    const planName = (planId: string | null) => plans.find((p) => p.id === planId)?.name_ar || "";
                    return (
                      <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Calendar size={14} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between">
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
                          {log.notes && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-1.5 mt-1">{log.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upgrade/Downgrade Dialog */}
      <Dialog open={!!upgradeDialog} onOpenChange={(open) => { if (!open) { setUpgradeDialog(null); setDiscountedPrice(null); setDiscountCode(""); setPaymentMethod("wallet"); setBankReference(""); setReceiptFile(null); } }}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {upgradeDialog && (currentPlan?.sort_order || 0) < upgradeDialog.sort_order ? "ترقية" : "تخفيض"} الاشتراك
            </DialogTitle>
          </DialogHeader>
          {upgradeDialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
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
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">السعر:</span>
                  <div className="text-left">
                    {discountedPrice !== null ? (
                      <>
                        <span className="text-sm text-muted-foreground line-through mr-2">
                          {getPlanPrice(upgradeDialog, selectedCycle).toLocaleString("ar-SA")} ر.س
                        </span>
                        <span className="text-lg font-bold text-accent">{discountedPrice.toLocaleString("ar-SA")} ر.س</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold">{getPlanPrice(upgradeDialog, selectedCycle).toLocaleString("ar-SA")} ر.س</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Discount Code Input */}
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

              {/* Payment Method Tabs */}
              <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} dir="rtl">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="wallet" className="gap-1 text-xs">
                    <Wallet size={14} />
                    المحفظة
                  </TabsTrigger>
                  <TabsTrigger value="paylink" className="gap-1 text-xs">
                    <CreditCard size={14} />
                    بطاقة دفع
                  </TabsTrigger>
                  <TabsTrigger value="bank_transfer" className="gap-1 text-xs">
                    <Building2 size={14} />
                    تحويل بنكي
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="wallet" className="mt-3">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                    <Wallet size={14} className="inline ml-1 text-primary" />
                    سيتم خصم <span className="font-bold">{(discountedPrice ?? getPlanPrice(upgradeDialog, selectedCycle)).toLocaleString("ar-SA")} ر.س</span> من رصيد محفظتك الرقمية.
                  </div>
                </TabsContent>

                <TabsContent value="paylink" className="mt-3">
                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm text-foreground space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-accent" />
                      <span className="font-medium">الدفع عبر بوابة الدفع الإلكتروني</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      سيتم فتح صفحة دفع آمنة لإتمام العملية بالبطاقة البنكية. المبلغ: <span className="font-bold">{(discountedPrice ?? getPlanPrice(upgradeDialog, selectedCycle)).toLocaleString("ar-SA")} ر.س</span>
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="bank_transfer" className="mt-3">
                  <BankTransferForm
                    amount={discountedPrice ?? getPlanPrice(upgradeDialog, selectedCycle)}
                    bankReference={bankReference}
                    onBankReferenceChange={setBankReference}
                    receiptFile={receiptFile}
                    onReceiptFileChange={setReceiptFile}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUpgradeDialog(null); setDiscountedPrice(null); setDiscountCode(""); setPaymentMethod("wallet"); setBankReference(""); setReceiptFile(null); }}>إلغاء</Button>
            <Button onClick={() => upgradeDialog && handleUpgrade(upgradeDialog)} disabled={upgrading} className="gap-1">
              {upgrading ? <Loader2 size={14} className="animate-spin" /> : (
                paymentMethod === "wallet" ? <Wallet size={14} /> :
                paymentMethod === "paylink" ? <CreditCard size={14} /> :
                <Building2 size={14} />
              )}
              {paymentMethod === "wallet" ? "دفع وتأكيد الترقية" :
               paymentMethod === "paylink" ? "الدفع بالبطاقة" :
               "إرسال طلب الترقية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionPage;
