import { useEffect, useState } from "react";
import {
  ToggleRight, Search, Plus, Trash2, Save, Building2, Shield,
  Layers, Settings2, BarChart3, Plug, ShieldCheck, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface FeatureFlag {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description: string;
  category: string;
  is_enabled_globally: boolean;
  enabled_plans: string[];
  created_at: string;
  updated_at: string;
}

interface TenantOverride {
  id: string;
  tenant_id: string;
  feature_key: string;
  is_enabled: boolean;
  overridden_by: string;
  notes: string | null;
  created_at: string;
  tenant_name?: string;
}

interface Plan {
  id: string;
  name_ar: string;
  slug: string;
}

interface Tenant {
  id: string;
  name: string;
  status: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  modules: { label: "الوحدات", icon: Layers, color: "bg-blue-100 text-blue-700" },
  features: { label: "المميزات", icon: Sparkles, color: "bg-purple-100 text-purple-700" },
  integrations: { label: "التكاملات", icon: Plug, color: "bg-amber-100 text-amber-700" },
  analytics: { label: "التحليلات", icon: BarChart3, color: "bg-emerald-100 text-emerald-700" },
  compliance: { label: "الامتثال", icon: ShieldCheck, color: "bg-red-100 text-red-700" },
  general: { label: "عام", icon: Settings2, color: "bg-muted text-muted-foreground" },
};

const AdminFeatureToggles = () => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [overrides, setOverrides] = useState<TenantOverride[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Create/Edit flag dialog
  const [flagDialog, setFlagDialog] = useState(false);
  const [editFlag, setEditFlag] = useState<FeatureFlag | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formGlobal, setFormGlobal] = useState(false);
  const [formPlans, setFormPlans] = useState<string[]>([]);

  // Tenant override dialog
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overrideFeature, setOverrideFeature] = useState<FeatureFlag | null>(null);
  const [overrideTenant, setOverrideTenant] = useState("");
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideNotes, setOverrideNotes] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [flagsRes, overridesRes, plansRes, tenantsRes] = await Promise.all([
      supabase.from("feature_flags").select("*").order("category").order("name_ar"),
      supabase.from("tenant_feature_overrides").select("*").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, name_ar, slug"),
      supabase.from("tenants").select("id, name, status").order("name"),
    ]);

    if (flagsRes.data) setFlags(flagsRes.data.map(f => ({ ...f, enabled_plans: f.enabled_plans || [] })));
    if (overridesRes.data) {
      const tenantMap: Record<string, string> = {};
      tenantsRes.data?.forEach(t => { tenantMap[t.id] = t.name; });
      setOverrides(overridesRes.data.map(o => ({ ...o, tenant_name: tenantMap[o.tenant_id] || "غير معروف" })));
    }
    if (plansRes.data) setPlans(plansRes.data);
    if (tenantsRes.data) setTenants(tenantsRes.data);
    setLoading(false);
  };

  // Toggle global
  const toggleGlobal = async (flag: FeatureFlag) => {
    const newVal = !flag.is_enabled_globally;
    const { error } = await supabase
      .from("feature_flags")
      .update({ is_enabled_globally: newVal })
      .eq("id", flag.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_enabled_globally: newVal } : f));
    toast({ title: newVal ? "تم التفعيل" : "تم التعطيل", description: `${flag.name_ar} - ${newVal ? "مفعّل عالمياً" : "معطّل عالمياً"}` });
  };

  // Save flag (create/edit)
  const openCreateFlag = () => {
    setEditFlag(null);
    setFormKey("");
    setFormNameAr("");
    setFormNameEn("");
    setFormDesc("");
    setFormCategory("general");
    setFormGlobal(false);
    setFormPlans([]);
    setFlagDialog(true);
  };

  const openEditFlag = (flag: FeatureFlag) => {
    setEditFlag(flag);
    setFormKey(flag.key);
    setFormNameAr(flag.name_ar);
    setFormNameEn(flag.name_en);
    setFormDesc(flag.description || "");
    setFormCategory(flag.category);
    setFormGlobal(flag.is_enabled_globally);
    setFormPlans(flag.enabled_plans);
    setFlagDialog(true);
  };

  const saveFlag = async () => {
    if (!formKey || !formNameAr) {
      toast({ title: "خطأ", description: "المفتاح والاسم العربي مطلوبان", variant: "destructive" });
      return;
    }

    if (editFlag) {
      const { error } = await supabase.from("feature_flags").update({
        name_ar: formNameAr,
        name_en: formNameEn,
        description: formDesc,
        category: formCategory,
        is_enabled_globally: formGlobal,
        enabled_plans: formPlans,
      }).eq("id", editFlag.id);

      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      toast({ title: "تم الحفظ", description: "تم تحديث الميزة بنجاح" });
    } else {
      const { error } = await supabase.from("feature_flags").insert({
        key: formKey,
        name_ar: formNameAr,
        name_en: formNameEn,
        description: formDesc,
        category: formCategory,
        is_enabled_globally: formGlobal,
        enabled_plans: formPlans,
      });

      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      toast({ title: "تمت الإضافة", description: "تم إضافة الميزة بنجاح" });
    }

    setFlagDialog(false);
    fetchAll();
  };

  const deleteFlag = async (flag: FeatureFlag) => {
    const { error } = await supabase.from("feature_flags").delete().eq("id", flag.id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setFlags(prev => prev.filter(f => f.id !== flag.id));
    toast({ title: "تم الحذف", description: `تم حذف ${flag.name_ar}` });
  };

  // Tenant overrides
  const openOverrideDialog = (flag: FeatureFlag) => {
    setOverrideFeature(flag);
    setOverrideTenant("");
    setOverrideEnabled(true);
    setOverrideNotes("");
    setOverrideDialog(true);
  };

  const saveOverride = async () => {
    if (!overrideFeature || !overrideTenant || !user) return;

    const { error } = await supabase.from("tenant_feature_overrides").upsert({
      tenant_id: overrideTenant,
      feature_key: overrideFeature.key,
      is_enabled: overrideEnabled,
      overridden_by: user.id,
      notes: overrideNotes || null,
    }, { onConflict: "tenant_id,feature_key" });

    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    toast({ title: "تم الحفظ", description: "تم تطبيق التخصيص للمنشأة" });
    setOverrideDialog(false);
    fetchAll();
  };

  const deleteOverride = async (override: TenantOverride) => {
    const { error } = await supabase.from("tenant_feature_overrides").delete().eq("id", override.id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setOverrides(prev => prev.filter(o => o.id !== override.id));
    toast({ title: "تم الحذف", description: "تم إزالة التخصيص" });
  };

  const togglePlan = (planId: string) => {
    setFormPlans(prev => prev.includes(planId) ? prev.filter(p => p !== planId) : [...prev, planId]);
  };

  // Update plan assignment for a flag
  const updateFlagPlans = async (flag: FeatureFlag, planId: string) => {
    const newPlans = flag.enabled_plans.includes(planId)
      ? flag.enabled_plans.filter(p => p !== planId)
      : [...flag.enabled_plans, planId];

    const { error } = await supabase.from("feature_flags").update({ enabled_plans: newPlans }).eq("id", flag.id);
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled_plans: newPlans } : f));
  };

  const filtered = flags.filter(f => {
    const matchSearch = f.name_ar.includes(search) || f.name_en.toLowerCase().includes(search.toLowerCase()) || f.key.includes(search);
    const matchCat = categoryFilter === "all" || f.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(flags.map(f => f.category))];
  const enabledCount = flags.filter(f => f.is_enabled_globally).length;
  const overrideCount = overrides.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ToggleRight className="text-accent" size={28} />
            إدارة المميزات
          </h1>
          <p className="text-sm text-muted-foreground">تحكم بالمميزات على مستوى المنصة والخطط والمنشآت</p>
        </div>
        <Button onClick={openCreateFlag} className="gap-2">
          <Plus size={16} /> إضافة ميزة
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-100 p-2"><Layers size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{flags.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي المميزات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-100 p-2"><ToggleRight size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold">{enabledCount}</p>
              <p className="text-xs text-muted-foreground">مفعّل عالمياً</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2"><Building2 size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{overrideCount}</p>
              <p className="text-xs text-muted-foreground">تخصيصات للمنشآت</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-purple-100 p-2"><Shield size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-xs text-muted-foreground">فئات</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags">🔧 المميزات</TabsTrigger>
          <TabsTrigger value="plans">📋 مصفوفة الخطط</TabsTrigger>
          <TabsTrigger value="overrides">🏢 تخصيصات المنشآت</TabsTrigger>
        </TabsList>

        {/* --- Tab 1: Feature Flags --- */}
        <TabsContent value="flags" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="بحث عن ميزة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الميزة</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-center">تفعيل عالمي</TableHead>
                  <TableHead className="text-center">الخطط</TableHead>
                  <TableHead className="text-center">تخصيصات</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(flag => {
                  const cat = CATEGORY_MAP[flag.category] || CATEGORY_MAP.general;
                  const CatIcon = cat.icon;
                  const flagOverrides = overrides.filter(o => o.feature_key === flag.key);

                  return (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{flag.name_ar}</p>
                          <p className="text-xs text-muted-foreground">{flag.key}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${cat.color}`}>
                          <CatIcon size={12} /> {cat.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={flag.is_enabled_globally}
                          onCheckedChange={() => toggleGlobal(flag)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">
                          {flag.enabled_plans.length}/{plans.length}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {flagOverrides.length > 0 ? (
                          <Badge variant="secondary">{flagOverrides.length}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openOverrideDialog(flag)} title="تخصيص لمنشأة">
                            <Building2 size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditFlag(flag)} title="تعديل">
                            <Settings2 size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteFlag(flag)} title="حذف">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      لا توجد مميزات
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* --- Tab 2: Plan Matrix --- */}
        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مصفوفة المميزات حسب الخطط</CardTitle>
              <CardDescription>اضغط على الخلية لتفعيل أو تعطيل ميزة في خطة معينة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right min-w-[200px]">الميزة</TableHead>
                      <TableHead className="text-center min-w-[80px]">عالمي</TableHead>
                      {plans.map(p => (
                        <TableHead key={p.id} className="text-center min-w-[100px]">{p.name_ar}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flags.map(flag => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => { const c = CATEGORY_MAP[flag.category] || CATEGORY_MAP.general; const I = c.icon; return <I size={14} className="text-muted-foreground" />; })()}
                            <span className="font-medium text-sm">{flag.name_ar}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={flag.is_enabled_globally}
                            onCheckedChange={() => toggleGlobal(flag)}
                          />
                        </TableCell>
                        {plans.map(p => (
                          <TableCell key={p.id} className="text-center">
                            <Checkbox
                              checked={flag.enabled_plans.includes(p.id)}
                              onCheckedChange={() => updateFlagPlans(flag, p.id)}
                              disabled={flag.is_enabled_globally}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Tab 3: Tenant Overrides --- */}
        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تخصيصات المنشآت</CardTitle>
              <CardDescription>تجاوزات فردية للمنشآت بغض النظر عن الخطة</CardDescription>
            </CardHeader>
            <CardContent>
              {overrides.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  لا توجد تخصيصات حالياً. يمكنك إضافة تخصيص من تبويب المميزات.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المنشأة</TableHead>
                      <TableHead className="text-right">الميزة</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                      <TableHead className="text-center">التاريخ</TableHead>
                      <TableHead className="text-center">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map(o => {
                      const featureName = flags.find(f => f.key === o.feature_key)?.name_ar || o.feature_key;
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.tenant_name}</TableCell>
                          <TableCell>{featureName}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={o.is_enabled ? "default" : "destructive"}>
                              {o.is_enabled ? "مفعّل" : "معطّل"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {o.notes || "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {new Date(o.created_at).toLocaleDateString("ar-SA")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOverride(o)}>
                              <Trash2 size={14} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Flag Dialog */}
      <Dialog open={flagDialog} onOpenChange={setFlagDialog}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editFlag ? "تعديل الميزة" : "إضافة ميزة جديدة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المفتاح (key)</Label>
                <Input value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="feature_key" disabled={!!editFlag} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربية</Label>
                <Input value={formNameAr} onChange={(e) => setFormNameAr(e.target.value)} placeholder="الاسم بالعربية" />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input value={formNameEn} onChange={(e) => setFormNameEn(e.target.value)} placeholder="English name" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="وصف مختصر للميزة" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formGlobal} onCheckedChange={setFormGlobal} />
              <Label>تفعيل عالمي (لجميع المنشآت)</Label>
            </div>
            {!formGlobal && (
              <div className="space-y-2">
                <Label>تفعيل في الخطط</Label>
                <div className="flex flex-wrap gap-3">
                  {plans.map(p => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={formPlans.includes(p.id)} onCheckedChange={() => togglePlan(p.id)} />
                      <span className="text-sm">{p.name_ar}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialog(false)}>إلغاء</Button>
            <Button onClick={saveFlag} className="gap-2"><Save size={16} /> حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tenant Override Dialog */}
      <Dialog open={overrideDialog} onOpenChange={setOverrideDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تخصيص ميزة لمنشأة</DialogTitle>
          </DialogHeader>
          {overrideFeature && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">{overrideFeature.name_ar}</p>
                <p className="text-xs text-muted-foreground">{overrideFeature.key}</p>
              </div>
              <div className="space-y-2">
                <Label>المنشأة</Label>
                <Select value={overrideTenant} onValueChange={setOverrideTenant}>
                  <SelectTrigger><SelectValue placeholder="اختر المنشأة" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={overrideEnabled} onCheckedChange={setOverrideEnabled} />
                <Label>{overrideEnabled ? "تفعيل الميزة" : "تعطيل الميزة"}</Label>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} placeholder="سبب التخصيص..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialog(false)}>إلغاء</Button>
            <Button onClick={saveOverride} disabled={!overrideTenant} className="gap-2"><Save size={16} /> حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFeatureToggles;
