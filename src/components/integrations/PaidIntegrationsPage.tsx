import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plug, CheckCircle2, Monitor, ShoppingBag, Users, CreditCard, Package, Power, PowerOff, Key, BookOpen, MessageSquare, Radio } from "lucide-react";

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
}

interface TenantSubscription {
  id: string;
  integration_id: string;
  status: string;
  activated_at: string;
  api_key_encrypted: string | null;
}

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

const PaidIntegrationsPage = () => {
  const { tenantId, user } = useAuth();
  const [integrations, setIntegrations] = useState<PaidIntegration[]>([]);
  const [subscriptions, setSubscriptions] = useState<TenantSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activateDialog, setActivateDialog] = useState<PaidIntegration | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: catalog }, { data: subs }] = await Promise.all([
      supabase.from("paid_integrations").select("*").eq("is_listed", true).order("sort_order"),
      supabase.from("tenant_paid_integrations").select("*").eq("tenant_id", tenantId!),
    ]);
    setIntegrations((catalog as any[]) || []);
    setSubscriptions((subs as any[]) || []);
    setLoading(false);
  };

  const getSubscription = (integrationId: string) =>
    subscriptions.find((s) => s.integration_id === integrationId && s.status === "active");

  const handleActivate = async () => {
    if (!activateDialog || !tenantId || !user) return;
    if (activateDialog.requires_api_keys && !apiKeyValue.trim()) {
      toast({ title: "يرجى إدخال مفتاح API", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("tenant_paid_integrations").upsert({
      tenant_id: tenantId,
      integration_id: activateDialog.id,
      status: "active",
      activated_by: user.id,
      activated_at: new Date().toISOString(),
      api_key_encrypted: apiKeyValue || null,
    } as any, { onConflict: "tenant_id,integration_id" });

    if (error) {
      toast({ title: "خطأ في التفعيل", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `تم تفعيل ${activateDialog.name_ar} بنجاح ✅` });
    }
    setSaving(false);
    setActivateDialog(null);
    setApiKeyValue("");
    fetchAll();
  };

  const handleDeactivate = async (integrationId: string) => {
    if (!confirm("هل تريد إلغاء هذا التكامل؟ سيتم إيقافه فوراً.")) return;
    await supabase
      .from("tenant_paid_integrations")
      .update({ status: "disabled" } as any)
      .eq("tenant_id", tenantId!)
      .eq("integration_id", integrationId);
    toast({ title: "تم إلغاء التكامل" });
    fetchAll();
  };

  const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
  const totalCost = activeSubscriptions.reduce((sum, sub) => {
    const integration = integrations.find((i) => i.id === sub.integration_id);
    return sum + (integration?.price_once || 0);
  }, 0);

  const categories = [...new Set(integrations.map((i) => i.integration_type))];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
          {totalCost > 0 && (
            <Badge className="gap-1 text-sm py-1.5 px-3 bg-primary/10 text-primary border-primary/20">
              {totalCost} ر.س
            </Badge>
          )}
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
                  return (
                    <Card key={item.id} className={sub ? "border-primary/30 bg-primary/[0.02]" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cat.color}`}>
                              <CatIcon size={22} />
                            </div>
                            <div>
                              <CardTitle className="text-base">{item.name_ar}</CardTitle>
                              <p className="text-xs text-muted-foreground">{item.name_en}</p>
                            </div>
                          </div>
                          {sub && (
                            <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200">
                              <CheckCircle2 size={12} /> مفعّل
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <CardDescription className="text-sm leading-relaxed">{item.description_ar}</CardDescription>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <span className="text-lg font-bold text-foreground">{item.price_once}</span>
                            <span className="text-sm text-muted-foreground mr-1">ر.س</span>
                          </div>
                          {sub ? (
                            <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDeactivate(item.id)}>
                              <PowerOff size={14} /> إلغاء
                            </Button>
                          ) : (
                            <Button size="sm" className="gap-1" onClick={() => { setActivateDialog(item); setApiKeyValue(""); }}>
                              <Power size={14} /> تفعيل
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
                        <div>
                          <p className="font-semibold">{item.name_ar}</p>
                          <p className="text-xs text-muted-foreground">{item.price_once} ر.س</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-muted-foreground">
                          مفعّل منذ {new Date(sub.activated_at).toLocaleDateString("ar-SA")}
                        </p>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeactivate(item.id)}>
                          إلغاء
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

      {/* Activate Dialog */}
      <Dialog open={!!activateDialog} onOpenChange={() => setActivateDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تفعيل {activateDialog?.name_ar}</DialogTitle>
            <DialogDescription>
              سيتم تفعيل هذا التكامل بتكلفة {activateDialog?.price_once} ر.س.
            </DialogDescription>
          </DialogHeader>
          {activateDialog?.requires_api_keys && (
            <div className="space-y-3 py-4">
              <div>
                <Label className="flex items-center gap-1">
                  <Key size={14} />
                  {activateDialog.api_key_label || "مفتاح API"}
                </Label>
                <Input
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder="أدخل مفتاح API الخاص بك"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">يُخزّن بشكل آمن ومشفّر</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog(null)}>إلغاء</Button>
            <Button onClick={handleActivate} disabled={saving}>
              {saving ? "جاري التفعيل..." : `تفعيل - ${activateDialog?.price_once} ر.س`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaidIntegrationsPage;