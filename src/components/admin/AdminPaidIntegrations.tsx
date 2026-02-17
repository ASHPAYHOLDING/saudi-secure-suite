import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Plug, Plus, Pencil, Trash2, Monitor, ShoppingBag, Users, CreditCard, Package,
  DollarSign, TrendingUp, Clock, BarChart3, BookOpen, Crown, Loader2, MessageSquare, Radio,
  CheckCircle2, XCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface PaidIntegration {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  integration_type: string;
  icon_name: string;
  price_once: number;
  currency: string;
  is_listed: boolean;
  is_ready: boolean;
  requires_api_keys: boolean;
  api_key_label: string;
  sort_order: number;
  trial_days: number;
  included_in_plans: string[];
  has_service: boolean;
  has_api_client: boolean;
  has_test_connection: boolean;
}

interface SubPlan {
  id: string;
  slug: string;
  name_ar: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any }> = {
  payment: { label: "بوابات دفع", icon: CreditCard },
  whatsapp: { label: "واتساب", icon: MessageSquare },
  accounting: { label: "محاسبة", icon: BookOpen },
  sms: { label: "رسائل SMS", icon: Radio },
  pos: { label: "نقاط البيع", icon: Monitor },
  ecommerce: { label: "متاجر إلكترونية", icon: ShoppingBag },
  hr_payroll: { label: "موارد بشرية", icon: Users },
  other: { label: "أخرى", icon: Package },
};

const CHART_COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--secondary-foreground))",
  "hsl(var(--muted-foreground))",
  "hsl(160, 60%, 45%)",
];

const AdminPaidIntegrations = () => {
  const [integrations, setIntegrations] = useState<PaidIntegration[]>([]);
  const [plans, setPlans] = useState<SubPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<PaidIntegration | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [trialCounts, setTrialCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("catalog");

  const [formData, setFormData] = useState({
    key: "", name_ar: "", name_en: "", description_ar: "", description_en: "",
    integration_type: "other", price_once: 0, is_listed: true, is_ready: false,
    requires_api_keys: false, api_key_label: "", sort_order: 0, icon_name: "Plug",
    trial_days: 0, included_in_plans: [] as string[],
    has_service: false, has_api_client: false, has_test_connection: false,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    const [intRes, planRes, subsRes] = await Promise.all([
      supabase.from("paid_integrations").select("*").order("sort_order"),
      supabase.from("subscription_plans").select("id, slug, name_ar").eq("is_active", true).order("sort_order"),
      supabase.from("tenant_paid_integrations").select("integration_id, status"),
    ]);

    setIntegrations((intRes.data as any[]) || []);
    setPlans((planRes.data as SubPlan[]) || []);

    const active: Record<string, number> = {};
    const trials: Record<string, number> = {};
    ((subsRes.data as any[]) || []).forEach((s) => {
      if (s.status === "active") active[s.integration_id] = (active[s.integration_id] || 0) + 1;
      if (s.status === "trial") trials[s.integration_id] = (trials[s.integration_id] || 0) + 1;
    });
    setSubscriberCounts(active);
    setTrialCounts(trials);
    setLoading(false);
  };

  // ─── Revenue Metrics (aggregated, no tenant data) ───
  const metrics = useMemo(() => {
    const totalSubs = Object.values(subscriberCounts).reduce((a, b) => a + b, 0);
    const totalTrials = Object.values(trialCounts).reduce((a, b) => a + b, 0);
    const totalRevenue = integrations.reduce((sum, i) => sum + (subscriberCounts[i.id] || 0) * i.price_once, 0);

    const byCategoryData = Object.entries(CATEGORY_MAP).map(([key, { label }]) => {
      const catIntegrations = integrations.filter((i) => i.integration_type === key);
      const revenue = catIntegrations.reduce((s, i) => s + (subscriberCounts[i.id] || 0) * i.price_once, 0);
      const subs = catIntegrations.reduce((s, i) => s + (subscriberCounts[i.id] || 0), 0);
      return { name: label, revenue, subscribers: subs };
    }).filter((d) => d.subscribers > 0);

    const perIntegrationData = integrations
      .map((i) => ({
        name: i.name_ar,
        subscribers: subscriberCounts[i.id] || 0,
        trials: trialCounts[i.id] || 0,
        revenue: (subscriberCounts[i.id] || 0) * i.price_once,
      }))
      .filter((d) => d.subscribers > 0 || d.trials > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return { totalSubs, totalTrials, totalRevenue, byCategoryData, perIntegrationData };
  }, [integrations, subscriberCounts, trialCounts]);

  // ─── Form Handlers ───
  const openCreate = () => {
    setFormData({
      key: "", name_ar: "", name_en: "", description_ar: "", description_en: "",
      integration_type: "other", price_once: 0, is_listed: true, is_ready: false,
      requires_api_keys: false, api_key_label: "", sort_order: integrations.length + 1,
      icon_name: "Plug", trial_days: 0, included_in_plans: [],
      has_service: false, has_api_client: false, has_test_connection: false,
    });
    setCreateDialog(true);
  };

  const openEdit = (item: PaidIntegration) => {
    setFormData({
      key: item.key, name_ar: item.name_ar, name_en: item.name_en,
      description_ar: item.description_ar || "", description_en: item.description_en || "",
      integration_type: item.integration_type, price_once: item.price_once,
      is_listed: item.is_listed, is_ready: item.is_ready,
      requires_api_keys: item.requires_api_keys, api_key_label: item.api_key_label || "",
      sort_order: item.sort_order, icon_name: item.icon_name || "Plug",
      trial_days: item.trial_days || 0, included_in_plans: item.included_in_plans || [],
      has_service: item.has_service || false, has_api_client: item.has_api_client || false, has_test_connection: item.has_test_connection || false,
    });
    setEditDialog(item);
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name_ar) {
      toast({ title: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name_ar: formData.name_ar, name_en: formData.name_en,
      description_ar: formData.description_ar, description_en: formData.description_en,
      integration_type: formData.integration_type, price_once: formData.price_once,
      is_listed: formData.is_listed, is_ready: formData.is_ready,
      requires_api_keys: formData.requires_api_keys, api_key_label: formData.api_key_label,
      sort_order: formData.sort_order, icon_name: formData.icon_name,
      trial_days: formData.trial_days, included_in_plans: formData.included_in_plans,
      has_service: formData.has_service, has_api_client: formData.has_api_client, has_test_connection: formData.has_test_connection,
    };

    if (editDialog) {
      await supabase.from("paid_integrations").update(payload as any).eq("id", editDialog.id);
      toast({ title: "تم تحديث التكامل" });
      setEditDialog(null);
    } else {
      await supabase.from("paid_integrations").insert({ ...payload, key: formData.key } as any);
      toast({ title: "تم إضافة التكامل" });
      setCreateDialog(false);
    }
    setSaving(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف هذا التكامل؟")) return;
    await supabase.from("paid_integrations").delete().eq("id", id);
    toast({ title: "تم حذف التكامل" });
    fetchAll();
  };

  const toggleListed = async (id: string, val: boolean) => {
    await supabase.from("paid_integrations").update({ is_listed: val } as any).eq("id", id);
    fetchAll();
  };

  const toggleReady = async (id: string, val: boolean) => {
    if (val) {
      const item = integrations.find((i) => i.id === id);
      if (!item?.has_service || !item?.has_api_client || !item?.has_test_connection) {
        toast({ title: "لا يمكن التفعيل", description: "يجب أن يكون has_service و has_api_client و has_test_connection = true", variant: "destructive" });
        return;
      }
    }
    await supabase.from("paid_integrations").update({ is_ready: val } as any).eq("id", id);
    fetchAll();
  };

  const togglePlan = (slug: string) => {
    setFormData((prev) => ({
      ...prev,
      included_in_plans: prev.included_in_plans.includes(slug)
        ? prev.included_in_plans.filter((s) => s !== slug)
        : [...prev.included_in_plans, slug],
    }));
  };

  // ─── Form Dialog ───
  const FormDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editDialog ? "تعديل تكامل" : "إضافة تكامل جديد"}</DialogTitle>
          <DialogDescription>تعبئة بيانات التكامل المدفوع</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>المفتاح الفريد *</Label>
              <Input value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} placeholder="pos_foodics" disabled={!!editDialog} />
            </div>
            <div>
              <Label>نوع التكامل</Label>
              <Select value={formData.integration_type} onValueChange={(v) => setFormData({ ...formData, integration_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الاسم (عربي) *</Label>
              <Input value={formData.name_ar} onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })} />
            </div>
            <div>
              <Label>الاسم (إنجليزي)</Label>
              <Input value={formData.name_en} onChange={(e) => setFormData({ ...formData, name_en: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>الوصف (عربي)</Label>
            <Textarea value={formData.description_ar} onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })} rows={2} />
          </div>

          {/* Pricing & Trial */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>السعر (مرة واحدة) ر.س</Label>
              <Input type="number" value={formData.price_once} onChange={(e) => setFormData({ ...formData, price_once: Number(e.target.value) })} />
            </div>
            <div>
              <Label>فترة تجربة (أيام)</Label>
              <Input type="number" value={formData.trial_days} onChange={(e) => setFormData({ ...formData, trial_days: Number(e.target.value) })} placeholder="0 = بدون تجربة" />
            </div>
            <div>
              <Label>الترتيب</Label>
              <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
            </div>
          </div>

          {/* Plan Assignment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Crown size={14} className="text-accent" />
              مضمّن في الخطط (مجاناً)
            </Label>
            <p className="text-xs text-muted-foreground">المشتركون في هذه الخطط يحصلون على التكامل مجاناً</p>
            <div className="flex flex-wrap gap-3 pt-1">
              {plans.map((plan) => (
                <label key={plan.slug} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={formData.included_in_plans.includes(plan.slug)}
                    onCheckedChange={() => togglePlan(plan.slug)}
                  />
                  {plan.name_ar}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <Label className="text-sm font-semibold">متطلبات الجاهزية (is_ready)</Label>
            <p className="text-[10px] text-muted-foreground">لا يمكن تفعيل is_ready إلا إذا كانت الثلاثة = true</p>
            <div className="flex items-center gap-6 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={formData.has_service} onCheckedChange={(v) => setFormData({ ...formData, has_service: v })} />
                has_service 🔧
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={formData.has_api_client} onCheckedChange={(v) => setFormData({ ...formData, has_api_client: v })} />
                has_api_client 🔌
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={formData.has_test_connection} onCheckedChange={(v) => setFormData({ ...formData, has_test_connection: v })} />
                has_test_connection ✅
              </label>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={formData.is_ready}
                disabled={!(formData.has_service && formData.has_api_client && formData.has_test_connection)}
                onCheckedChange={(v) => setFormData({ ...formData, is_ready: v })}
              />
              جاهز تقنياً 🔥
              {!(formData.has_service && formData.has_api_client && formData.has_test_connection) && (
                <span className="text-[10px] text-destructive">(يتطلب الثلاثة أعلاه)</span>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={formData.is_listed} onCheckedChange={(v) => setFormData({ ...formData, is_listed: v })} />
              يظهر للبيع
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={formData.requires_api_keys} onCheckedChange={(v) => setFormData({ ...formData, requires_api_keys: v })} />
              يتطلب مفاتيح API
            </label>
          </div>
          {formData.requires_api_keys && (
            <div>
              <Label>تسمية مفتاح API</Label>
              <Input value={formData.api_key_label} onChange={(e) => setFormData({ ...formData, api_key_label: e.target.value })} placeholder="مثال: مفتاح API فودكس" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة التكاملات المدفوعة</h1>
          <p className="text-muted-foreground mt-1">تسعير، خطط، تجارب مجانية، ومقاييس الإيرادات</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> إضافة تكامل</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">إجمالي التكاملات</span>
            </div>
            <p className="text-2xl font-bold">{integrations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-primary" />
              <span className="text-xs text-muted-foreground">مشتركين فعّالين</span>
            </div>
            <p className="text-2xl font-bold text-primary">{metrics.totalSubs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-accent" />
              <span className="text-xs text-muted-foreground">تجارب مجانية</span>
            </div>
            <p className="text-2xl font-bold text-accent">{metrics.totalTrials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-accent" />
              <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
            </div>
            <p className="text-2xl font-bold text-accent">{metrics.totalRevenue.toLocaleString()} <span className="text-sm font-normal">ر.س</span></p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="catalog" className="gap-2"><Package size={14} /> الكتالوج</TabsTrigger>
          <TabsTrigger value="revenue" className="gap-2"><BarChart3 size={14} /> الإيرادات</TabsTrigger>
        </TabsList>

        {/* ─── Catalog Tab ─── */}
        <TabsContent value="catalog" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">كتالوج التكاملات</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التكامل</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>تجربة</TableHead>
                    <TableHead>مضمّن في</TableHead>
                    <TableHead>المشتركين</TableHead>
                    <TableHead>الجاهزية</TableHead>
                    <TableHead>جاهز 🔥</TableHead>
                    <TableHead>يظهر للبيع</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((item) => {
                    const cat = CATEGORY_MAP[item.integration_type] || CATEGORY_MAP.other;
                    const CatIcon = cat.icon;
                    const includedPlans = (item.included_in_plans || [])
                      .map((slug) => plans.find((p) => p.slug === slug)?.name_ar)
                      .filter(Boolean);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                              <CatIcon size={18} className="text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{item.name_ar}</p>
                              <p className="text-xs text-muted-foreground">{item.name_en}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{cat.label}</Badge></TableCell>
                        <TableCell className="font-medium">{item.price_once} ر.س</TableCell>
                        <TableCell>
                          {item.trial_days > 0 ? (
                            <Badge className="bg-accent/10 text-accent border-accent/20">{item.trial_days} يوم</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {includedPlans.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {includedPlans.map((name) => (
                                <Badge key={name} variant="outline" className="text-[10px]">{name}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{subscriberCounts[item.id] || 0}</Badge>
                            {(trialCounts[item.id] || 0) > 0 && (
                              <Badge className="bg-accent/10 text-accent text-[10px]">{trialCounts[item.id]} تجربة</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span title="has_service" className={`text-[10px] px-1 rounded ${item.has_service ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>SVC</span>
                            <span title="has_api_client" className={`text-[10px] px-1 rounded ${item.has_api_client ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>API</span>
                            <span title="has_test_connection" className={`text-[10px] px-1 rounded ${item.has_test_connection ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>TST</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={item.is_ready}
                              disabled={!(item.has_service && item.has_api_client && item.has_test_connection)}
                              onCheckedChange={(v) => toggleReady(item.id, v)}
                            />
                            {item.is_ready ? (
                              <CheckCircle2 size={14} className="text-green-500" />
                            ) : (
                              <XCircle size={14} className="text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch checked={item.is_listed} onCheckedChange={(v) => toggleListed(item.id, v)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil size={14} /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Revenue Tab ─── */}
        <TabsContent value="revenue" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue per Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" />
                  الإيراد حسب التكامل
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.perIntegrationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.perIntegrationData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(val: number) => [`${val.toLocaleString()} ر.س`, "الإيراد"]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">لا يوجد اشتراكات بعد</p>
                )}
              </CardContent>
            </Card>

            {/* Distribution by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp size={16} className="text-accent" />
                  التوزيع حسب النوع
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.byCategoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={metrics.byCategoryData}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {metrics.byCategoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => [`${val.toLocaleString()} ر.س`, "الإيراد"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">لا يوجد بيانات</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Subscribers & Trials Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تفاصيل الاشتراكات والتجارب</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التكامل</TableHead>
                    <TableHead>مشتركين فعّالين</TableHead>
                    <TableHead>تجارب مجانية</TableHead>
                    <TableHead>الإيراد</TableHead>
                    <TableHead>معدل التحويل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((item) => {
                    const subs = subscriberCounts[item.id] || 0;
                    const trials = trialCounts[item.id] || 0;
                    const revenue = subs * item.price_once;
                    const convRate = (subs + trials) > 0 ? ((subs / (subs + trials)) * 100).toFixed(0) : "—";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name_ar}</TableCell>
                        <TableCell><Badge variant="outline">{subs}</Badge></TableCell>
                        <TableCell>
                          {trials > 0 ? <Badge className="bg-accent/10 text-accent">{trials}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="font-medium">{revenue.toLocaleString()} ر.س</TableCell>
                        <TableCell>
                          {convRate !== "—" ? <Badge variant="secondary">{convRate}%</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormDialog open={createDialog || !!editDialog} onClose={() => { setCreateDialog(false); setEditDialog(null); }} />
    </div>
  );
};

export default AdminPaidIntegrations;