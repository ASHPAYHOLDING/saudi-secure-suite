import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Tag, BarChart3, Eye, FileText, TrendingUp, Calendar, DollarSign } from "lucide-react";

interface Discount {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  eligible_plan_ids: string[] | null;
  created_at: string;
}

interface Usage {
  id: string;
  discount_id: string;
  tenant_id: string;
  subscription_id: string;
  used_at: string;
  amount_before: number;
  amount_after: number;
}

interface Plan {
  id: string;
  name_ar: string;
}

const AdminDiscountCodes = () => {
  const { user } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [allUsage, setAllUsage] = useState<Usage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("codes");

  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    max_uses: "",
    starts_at: new Date().toISOString().slice(0, 16),
    expires_at: "",
    eligible_plan_ids: [] as string[],
  });

  const fetchData = async () => {
    const [discRes, planRes, allUsageRes] = await Promise.all([
      supabase.from("subscription_discounts").select("*").order("created_at", { ascending: false }),
      supabase.from("subscription_plans").select("id, name_ar").eq("is_active", true),
      supabase.from("subscription_discount_usage").select("*").order("used_at", { ascending: false }),
    ]);
    if (discRes.data) setDiscounts(discRes.data as Discount[]);
    if (planRes.data) setPlans(planRes.data as Plan[]);
    if (allUsageRes.data) setAllUsage(allUsageRes.data as Usage[]);
    setLoading(false);
  };

  const fetchUsage = async (discountId: string) => {
    const { data } = await supabase
      .from("subscription_discount_usage")
      .select("*")
      .eq("discount_id", discountId)
      .order("used_at", { ascending: false });
    if (data) setUsage(data as Usage[]);
    setUsageOpen(discountId);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!user || !form.code || !form.discount_value || !form.expires_at) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("subscription_discounts").insert({
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      starts_at: form.starts_at,
      expires_at: form.expires_at,
      eligible_plan_ids: form.eligible_plan_ids.length > 0 ? form.eligible_plan_ids : null,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم", description: "تم إنشاء كود الخصم بنجاح" });
    setCreateOpen(false);
    setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", starts_at: new Date().toISOString().slice(0, 16), expires_at: "", eligible_plan_ids: [] });
    fetchData();
  };

  const toggleActive = async (discount: Discount) => {
    const { error } = await supabase
      .from("subscription_discounts")
      .update({ is_active: !discount.is_active })
      .eq("id", discount.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم", description: `تم ${discount.is_active ? "تعطيل" : "تفعيل"} الكود` });
    fetchData();
  };

  const getPlanName = (id: string) => plans.find(p => p.id === id)?.name_ar || id.slice(0, 8);

  // Report calculations
  const totalAllSavings = allUsage.reduce((sum, u) => sum + (u.amount_before - u.amount_after), 0);
  const totalAllUsageCount = allUsage.length;
  const uniqueTenants = new Set(allUsage.map(u => u.tenant_id)).size;
  const avgDiscount = totalAllUsageCount > 0 ? totalAllSavings / totalAllUsageCount : 0;
  const usageTotalSavings = usage.reduce((sum, u) => sum + (u.amount_before - u.amount_after), 0);

  const codeUsageMap = discounts.map(d => ({
    ...d,
    usageCount: allUsage.filter(u => u.discount_id === d.id).length,
    totalSaved: allUsage.filter(u => u.discount_id === d.id).reduce((s, u) => s + (u.amount_before - u.amount_after), 0),
  })).sort((a, b) => b.usageCount - a.usageCount);

  const usageByMonth: Record<string, { count: number; saved: number }> = {};
  allUsage.forEach(u => {
    const month = new Date(u.used_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
    if (!usageByMonth[month]) usageByMonth[month] = { count: 0, saved: 0 };
    usageByMonth[month].count++;
    usageByMonth[month].saved += u.amount_before - u.amount_after;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">أكواد الخصم</h1>
          <p className="text-sm text-muted-foreground">إدارة أكواد خصم الاشتراكات</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus size={16} />
          كود جديد
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="codes" className="gap-2"><Tag size={14} /> الأكواد</TabsTrigger>
          <TabsTrigger value="report" className="gap-2"><FileText size={14} /> تقرير شامل</TabsTrigger>
        </TabsList>

        {/* Codes Tab */}
        <TabsContent value="codes" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{discounts.length}</p>
                <p className="text-xs text-muted-foreground">إجمالي الأكواد</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{discounts.filter(d => d.is_active).length}</p>
                <p className="text-xs text-muted-foreground">أكواد مفعلة</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{discounts.reduce((s, d) => s + d.used_count, 0)}</p>
                <p className="text-xs text-muted-foreground">إجمالي الاستخدامات</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">
                  {discounts.filter(d => new Date(d.expires_at) < new Date()).length}
                </p>
                <p className="text-xs text-muted-foreground">أكواد منتهية</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">القيمة</TableHead>
                    <TableHead className="text-right">الاستخدام</TableHead>
                    <TableHead className="text-right">الصلاحية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.map((d) => {
                    const isExpired = new Date(d.expires_at) < new Date();
                    const isMaxed = d.max_uses !== null && d.used_count >= d.max_uses;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono font-bold">{d.code}</TableCell>
                        <TableCell>{d.discount_type === "percentage" ? "نسبة %" : "مبلغ ثابت"}</TableCell>
                        <TableCell>{d.discount_value}{d.discount_type === "percentage" ? "%" : " ر.س"}</TableCell>
                        <TableCell>
                          <span className={isMaxed ? "text-destructive font-bold" : ""}>
                            {d.used_count}/{d.max_uses ?? "∞"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{new Date(d.starts_at).toLocaleDateString("ar-SA")}</div>
                          <div className={isExpired ? "text-destructive" : "text-muted-foreground"}>
                            → {new Date(d.expires_at).toLocaleDateString("ar-SA")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!d.is_active ? (
                            <Badge variant="secondary">معطل</Badge>
                          ) : isExpired ? (
                            <Badge variant="destructive">منتهي</Badge>
                          ) : isMaxed ? (
                            <Badge variant="outline">مستنفد</Badge>
                          ) : (
                            <Badge variant="default">مفعل</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => fetchUsage(d.id)}>
                              <Eye size={14} />
                            </Button>
                            <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {discounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد أكواد خصم بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Tab */}
        <TabsContent value="report" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <TrendingUp size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalAllUsageCount}</p>
                  <p className="text-xs text-muted-foreground">إجمالي الاستخدامات</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <DollarSign size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalAllSavings.toLocaleString("ar-SA")} <span className="text-sm font-normal">ر.س</span></p>
                  <p className="text-xs text-muted-foreground">إجمالي الخصومات الممنوحة</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Tag size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{uniqueTenants}</p>
                  <p className="text-xs text-muted-foreground">منشآت مستفيدة</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <BarChart3 size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{avgDiscount.toFixed(0)} <span className="text-sm font-normal">ر.س</span></p>
                  <p className="text-xs text-muted-foreground">متوسط الخصم</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp size={18} />
                أكثر الأكواد استخداماً
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">القيمة</TableHead>
                    <TableHead className="text-right">عدد الاستخدامات</TableHead>
                    <TableHead className="text-right">إجمالي الخصم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codeUsageMap.map((d, i) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono font-bold">{d.code}</TableCell>
                      <TableCell>{d.discount_type === "percentage" ? "نسبة %" : "مبلغ ثابت"}</TableCell>
                      <TableCell>{d.discount_value}{d.discount_type === "percentage" ? "%" : " ر.س"}</TableCell>
                      <TableCell><Badge variant="secondary">{d.usageCount}</Badge></TableCell>
                      <TableCell className="font-bold">{d.totalSaved.toLocaleString("ar-SA")} ر.س</TableCell>
                      <TableCell>
                        {d.is_active ? <Badge variant="default">مفعل</Badge> : <Badge variant="secondary">معطل</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {codeUsageMap.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Usage by Month */}
          {Object.keys(usageByMonth).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar size={18} />
                  الاستخدام حسب الشهر
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الشهر</TableHead>
                      <TableHead className="text-right">عدد الاستخدامات</TableHead>
                      <TableHead className="text-right">إجمالي الخصم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(usageByMonth).map(([month, data]) => (
                      <TableRow key={month}>
                        <TableCell className="font-medium">{month}</TableCell>
                        <TableCell><Badge variant="secondary">{data.count}</Badge></TableCell>
                        <TableCell className="font-bold">{data.saved.toLocaleString("ar-SA")} ر.س</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Full Usage Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText size={18} />
                سجل الاستخدام الكامل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">المنشأة</TableHead>
                    <TableHead className="text-right">السعر قبل</TableHead>
                    <TableHead className="text-right">السعر بعد</TableHead>
                    <TableHead className="text-right">التوفير</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsage.map((u) => {
                    const disc = discounts.find(d => d.id === u.discount_id);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono font-bold">{disc?.code ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{u.tenant_id.slice(0, 8)}...</TableCell>
                        <TableCell>{u.amount_before} ر.س</TableCell>
                        <TableCell className="font-bold">{u.amount_after} ر.س</TableCell>
                        <TableCell className="font-bold text-primary">{(u.amount_before - u.amount_after).toLocaleString("ar-SA")} ر.س</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(u.used_at).toLocaleString("ar-SA")}</TableCell>
                      </TableRow>
                    );
                  })}
                  {allUsage.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لم يتم استخدام أي كود خصم بعد</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag size={18} />
              إنشاء كود خصم جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الكود *</Label>
                <Input placeholder="SAVE20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>نوع الخصم *</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية %</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت (ر.س)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>القيمة *</Label>
                <Input type="number" placeholder={form.discount_type === "percentage" ? "20" : "50"} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الحد الأقصى للاستخدام</Label>
                <Input type="number" placeholder="غير محدود" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>يبدأ من *</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>ينتهي في *</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            {plans.length > 0 && (
              <div className="space-y-2">
                <Label>الخطط المؤهلة (اتركها فارغة لجميع الخطط)</Label>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => {
                    const selected = form.eligible_plan_ids.includes(p.id);
                    return (
                      <Badge key={p.id} variant={selected ? "default" : "outline"} className="cursor-pointer"
                        onClick={() => setForm({ ...form, eligible_plan_ids: selected ? form.eligible_plan_ids.filter(id => id !== p.id) : [...form.eligible_plan_ids, p.id] })}>
                        {p.name_ar}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate}>إنشاء الكود</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog open={!!usageOpen} onOpenChange={() => setUsageOpen(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 size={18} />
              تقرير الاستخدام — {discounts.find(d => d.id === usageOpen)?.code}
            </DialogTitle>
          </DialogHeader>
          {usage.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">لم يتم استخدام هذا الكود بعد</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-sm text-muted-foreground">إجمالي التوفير</p>
                <p className="text-2xl font-bold text-primary">{usageTotalSavings.toLocaleString("ar-SA")} ر.س</p>
              </div>
              {usage.map((u) => (
                <div key={u.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المنشأة:</span>
                    <span className="font-mono text-xs">{u.tenant_id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">قبل:</span>
                    <span>{u.amount_before} ر.س</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">بعد:</span>
                    <span className="font-bold text-primary">{u.amount_after} ر.س</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-left">
                    {new Date(u.used_at).toLocaleString("ar-SA")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscountCodes;
