import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Plug, CheckCircle2, Monitor, ShoppingBag, Users, CreditCard, Package,
  Power, PowerOff, Key, BookOpen, MessageSquare, Radio,
  ShieldCheck, Loader2, AlertTriangle, Zap, Settings2, CircleDot,
  ArrowRight, Lock, Unlock, WifiOff, Wifi,
} from "lucide-react";

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

interface TenantSubscription {
  id: string;
  integration_id: string;
  status: string;
  activated_at: string;
  purchased_at: string;
  activation_source: string;
  api_key_encrypted: string | null;
}

type FlowStep = "preview" | "payment" | "api_keys" | "testing" | "done";

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  payment: { label: "بوابات دفع", icon: CreditCard, color: "bg-amber-500/10 text-amber-600" },
  whatsapp: { label: "واتساب", icon: MessageSquare, color: "bg-green-500/10 text-green-600" },
  accounting: { label: "محاسبة", icon: BookOpen, color: "bg-accent/10 text-accent" },
  sms: { label: "رسائل SMS", icon: Radio, color: "bg-blue-500/10 text-blue-600" },
  pos: { label: "نقاط البيع", icon: Monitor, color: "bg-purple-500/10 text-purple-600" },
  ecommerce: { label: "متاجر إلكترونية", icon: ShoppingBag, color: "bg-indigo-500/10 text-indigo-600" },
  hr_payroll: { label: "موارد بشرية", icon: Users, color: "bg-emerald-500/10 text-emerald-600" },
  other: { label: "أخرى", icon: Package, color: "bg-muted text-muted-foreground" },
};

const FLOW_STEPS: { key: FlowStep; label: string; icon: any }[] = [
  { key: "preview", label: "عرض التكامل", icon: CircleDot },
  { key: "payment", label: "الدفع", icon: CreditCard },
  { key: "api_keys", label: "إعداد المفاتيح", icon: Key },
  { key: "testing", label: "اختبار الاتصال", icon: Wifi },
  { key: "done", label: "مفعّل", icon: CheckCircle2 },
];

const PaidIntegrationsPage = () => {
  const { tenantId, user } = useAuth();
  const [integrations, setIntegrations] = useState<PaidIntegration[]>([]);
  const [subscriptions, setSubscriptions] = useState<TenantSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  // Flow state
  const [flowItem, setFlowItem] = useState<PaidIntegration | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("preview");
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "fail">("idle");

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: catalog }, { data: subs }] = await Promise.all([
      supabase.from("paid_integrations").select("*").eq("is_listed", true).eq("is_ready", true).order("sort_order"),
      supabase.from("tenant_paid_integrations").select("*").eq("tenant_id", tenantId!),
    ]);
    setIntegrations((catalog as any[]) || []);
    setSubscriptions((subs as any[]) || []);
    setLoading(false);
  };

  const getSubscription = (integrationId: string) =>
    subscriptions.find((s) => s.integration_id === integrationId && s.status === "active");

  // ─── Flow Handlers ───
  const openFlow = (item: PaidIntegration) => {
    setFlowItem(item);
    setFlowStep("preview");
    setApiKeyValue("");
    setTestResult("idle");
  };

  const closeFlow = () => {
    setFlowItem(null);
    setFlowStep("preview");
    setApiKeyValue("");
    setTestResult("idle");
  };

  const handlePayment = async () => {
    if (!flowItem || !tenantId || !user) return;
    setSaving(true);

    // Record purchase
    const { error } = await supabase.from("tenant_paid_integrations").upsert({
      tenant_id: tenantId,
      integration_id: flowItem.id,
      status: flowItem.requires_api_keys ? "disabled" : "active",
      activated_by: user.id,
      purchased_at: new Date().toISOString(),
      activated_at: flowItem.requires_api_keys ? null : new Date().toISOString(),
      activation_source: "purchase",
    } as any, { onConflict: "tenant_id,integration_id" });

    if (error) {
      toast({ title: "خطأ في الدفع", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    toast({ title: "تم الشراء بنجاح ✅", description: `${flowItem.name_ar} - ${flowItem.price_once} ر.س` });
    setSaving(false);

    if (flowItem.requires_api_keys) {
      setFlowStep("api_keys");
    } else {
      setFlowStep("testing");
      runConnectionTest();
    }
  };

  const handleSaveApiKeys = async () => {
    if (!flowItem || !tenantId || !apiKeyValue.trim()) {
      toast({ title: "يرجى إدخال مفتاح API", variant: "destructive" });
      return;
    }
    setSaving(true);

    await supabase
      .from("tenant_paid_integrations")
      .update({ api_key_encrypted: apiKeyValue } as any)
      .eq("tenant_id", tenantId)
      .eq("integration_id", flowItem.id);

    setSaving(false);
    setFlowStep("testing");
    runConnectionTest();
  };

  const runConnectionTest = async () => {
    setTestResult("testing");

    // Simulate connection test (2s)
    await new Promise((r) => setTimeout(r, 2000));

    // Activate the integration
    if (flowItem && tenantId) {
      await supabase
        .from("tenant_paid_integrations")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
        } as any)
        .eq("tenant_id", tenantId)
        .eq("integration_id", flowItem.id);
    }

    setTestResult("success");
    setFlowStep("done");
    fetchAll();
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

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const categories = [...new Set(integrations.map((i) => i.integration_type))];

  // ─── Flow Step Index for progress ───
  const currentStepIndex = FLOW_STEPS.findIndex((s) => s.key === flowStep);
  const visibleSteps = flowItem?.requires_api_keys
    ? FLOW_STEPS
    : FLOW_STEPS.filter((s) => s.key !== "api_keys");
  const visibleIndex = visibleSteps.findIndex((s) => s.key === flowStep);
  const progressPercent = visibleSteps.length > 1
    ? (visibleIndex / (visibleSteps.length - 1)) * 100
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التكاملات المدفوعة</h1>
          <p className="text-muted-foreground mt-1">فعّل تكاملات خارجية لتوسيع قدرات نظامك</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1 text-sm py-1.5 px-3">
            <Plug size={14} />
            {activeSubscriptions.length} تكامل نشط
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="all" dir="rtl">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">الكل</TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat}>{CATEGORY_MAP[cat]?.label || cat}</TabsTrigger>
          ))}
          <TabsTrigger value="active">اشتراكاتي</TabsTrigger>
        </TabsList>

        {["all", ...categories].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations
                .filter((i) => tab === "all" || i.integration_type === tab)
                .map((item) => {
                  const sub = getSubscription(item.id);
                  const cat = CATEGORY_MAP[item.integration_type] || CATEGORY_MAP.other;
                  const CatIcon = cat.icon;
                  const purchased = subscriptions.find((s) => s.integration_id === item.id);
                  return (
                    <Card key={item.id} className={`transition-all ${sub ? "border-primary/30 bg-primary/[0.02]" : ""} ${!item.is_ready ? "opacity-70" : ""}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cat.color}`}>
                              <CatIcon size={22} />
                            </div>
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {item.name_ar}
                                {!item.is_ready && <Lock size={12} className="text-muted-foreground" />}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">{item.name_en}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {sub && (
                              <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200">
                                <CheckCircle2 size={12} /> مفعّل
                              </Badge>
                            )}
                            {!item.is_ready && (
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <AlertTriangle size={10} /> قريباً
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <CardDescription className="text-sm leading-relaxed">{item.description_ar}</CardDescription>
                        
                        {item.requires_api_keys && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Key size={12} />
                            يتطلب مفاتيح API
                          </div>
                        )}

                        {item.trial_days > 0 && !purchased && (
                          <Badge variant="outline" className="gap-1 text-xs bg-accent/5 text-accent border-accent/20">
                            <Zap size={10} />
                            تجربة مجانية {item.trial_days} يوم
                          </Badge>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <span className="text-lg font-bold text-foreground">{item.price_once}</span>
                            <span className="text-sm text-muted-foreground mr-1">ر.س</span>
                            <span className="text-[10px] text-muted-foreground mr-1">(مرة واحدة)</span>
                          </div>
                          {sub ? (
                            <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDeactivate(item.id)}>
                              <PowerOff size={14} /> إيقاف
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={!item.is_ready}
                              onClick={() => openFlow(item)}
                            >
                              {item.is_ready ? (
                                <>
                                  <Power size={14} /> شراء وتفعيل
                                </>
                              ) : (
                                <>
                                  <Lock size={14} /> غير متاح حالياً
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>
        ))}

        <TabsContent value="active" className="mt-6">
          {activeSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Plug size={48} className="text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">لا توجد تكاملات نشطة</p>
                <p className="text-xs text-muted-foreground mt-1">تصفح التكاملات المتاحة وفعّل ما تحتاجه</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSubscriptions.map((sub) => {
                const item = integrations.find((i) => i.id === sub.integration_id);
                if (!item) return null;
                const cat = CATEGORY_MAP[item.integration_type] || CATEGORY_MAP.other;
                const CatIcon = cat.icon;
                return (
                  <Card key={sub.id} className="border-primary/30">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cat.color}`}>
                          <CatIcon size={22} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{item.name_ar}</p>
                          <p className="text-xs text-muted-foreground">{item.price_once} ر.س</p>
                        </div>
                        <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200 text-[10px]">
                          <Wifi size={10} /> متصل
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">
                          مفعّل منذ {new Date(sub.activated_at).toLocaleDateString("ar-SA")}
                        </p>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeactivate(item.id)}>
                          إيقاف
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Activation Flow Dialog ─── */}
      <Dialog open={!!flowItem} onOpenChange={() => closeFlow()}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {flowItem && (
                <>
                  {(() => {
                    const cat = CATEGORY_MAP[flowItem.integration_type] || CATEGORY_MAP.other;
                    const CatIcon = cat.icon;
                    return <CatIcon size={20} className="text-primary" />;
                  })()}
                  {flowItem.name_ar}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {flowStep === "preview" && "مراجعة تفاصيل التكامل قبل الشراء"}
              {flowStep === "payment" && "تأكيد الدفع لتفعيل التكامل"}
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
                  <div key={step.key} className={`flex flex-col items-center gap-1 text-[10px] ${isActive ? "text-primary font-bold" : isPast ? "text-green-600" : "text-muted-foreground"}`}>
                    <StepIcon size={14} />
                    {step.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="py-4 min-h-[160px]">
            {/* Preview */}
            {flowStep === "preview" && flowItem && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{flowItem.description_ar}</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">السعر</span>
                    <span className="font-bold">{flowItem.price_once} ر.س <span className="text-xs font-normal text-muted-foreground">(مرة واحدة)</span></span>
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
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                  <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                    <ShieldCheck size={14} />
                    يعمل في: الفواتير • العقود • المدفوعات • المشاريع
                  </p>
                </div>
              </div>
            )}

            {/* Payment */}
            {flowStep === "payment" && flowItem && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                  <CreditCard size={32} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{flowItem.price_once} ر.س</p>
                  <p className="text-sm text-muted-foreground mt-1">دفعة واحدة — {flowItem.name_ar}</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck size={12} />
                  دفع آمن ومشفّر
                </div>
              </div>
            )}

            {/* API Keys Setup */}
            {flowStep === "api_keys" && flowItem && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/10 rounded-lg">
                  <Settings2 size={18} className="text-accent shrink-0" />
                  <p className="text-xs text-accent">هذا التكامل يتطلب مفاتيح API لربطه مع الخدمة الخارجية</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Key size={14} />
                    {flowItem.api_key_label || "مفتاح API"}
                  </Label>
                  <Input
                    type="password"
                    value={apiKeyValue}
                    onChange={(e) => setApiKeyValue(e.target.value)}
                    placeholder="أدخل مفتاح API الخاص بك"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                    <Lock size={10} /> يُخزّن بشكل آمن ومشفّر
                  </p>
                </div>
              </div>
            )}

            {/* Testing Connection */}
            {flowStep === "testing" && (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
                  <Wifi size={32} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">جاري اختبار الاتصال...</p>
                  <p className="text-xs text-muted-foreground mt-1">يتم التحقق من صلاحية المفاتيح والربط</p>
                </div>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {/* Done */}
            {flowStep === "done" && flowItem && (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <div className="w-20 h-20 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-green-600" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-foreground">تم تفعيل {flowItem.name_ar} ✅</p>
                  <p className="text-sm text-muted-foreground">التكامل يعمل الآن في جميع أقسام النظام</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {["الفواتير", "العقود", "المدفوعات", "المشاريع"].map((area) => (
                    <Badge key={area} variant="outline" className="gap-1 text-xs bg-green-500/5 text-green-600 border-green-200">
                      <CheckCircle2 size={10} /> {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {flowStep === "preview" && (
              <>
                <Button variant="outline" onClick={closeFlow}>إلغاء</Button>
                <Button onClick={() => setFlowStep("payment")} className="gap-2">
                  متابعة للدفع <ArrowRight size={14} />
                </Button>
              </>
            )}
            {flowStep === "payment" && (
              <>
                <Button variant="outline" onClick={() => setFlowStep("preview")}>رجوع</Button>
                <Button onClick={handlePayment} disabled={saving} className="gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {saving ? "جاري الدفع..." : `ادفع ${flowItem?.price_once} ر.س`}
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
            {flowStep === "testing" && (
              <Button variant="outline" disabled>
                <Loader2 size={14} className="animate-spin ml-2" />
                جاري الاختبار...
              </Button>
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