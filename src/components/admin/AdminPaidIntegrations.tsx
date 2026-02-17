import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plug, Plus, Pencil, Trash2, Monitor, ShoppingBag, Users, CreditCard, Package } from "lucide-react";

interface PaidIntegration {
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  category: string;
  icon_name: string;
  monthly_price: number;
  currency: string;
  is_available: boolean;
  requires_api_key: boolean;
  api_key_label: string;
  sort_order: number;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any }> = {
  pos: { label: "نقاط البيع", icon: Monitor },
  ecommerce: { label: "متاجر إلكترونية", icon: ShoppingBag },
  hr_payroll: { label: "موارد بشرية", icon: Users },
  payment_gateway: { label: "بوابات دفع", icon: CreditCard },
  other: { label: "أخرى", icon: Package },
};

const AdminPaidIntegrations = () => {
  const [integrations, setIntegrations] = useState<PaidIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<PaidIntegration | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    key: "", name_ar: "", name_en: "", description_ar: "", description_en: "",
    category: "other", monthly_price: 0, is_available: true, requires_api_key: false,
    api_key_label: "", sort_order: 0, icon_name: "Plug",
  });
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("paid_integrations")
      .select("*")
      .order("sort_order");
    setIntegrations((data as any[]) || []);

    // Fetch subscriber counts
    const { data: subs } = await supabase
      .from("tenant_paid_integrations")
      .select("integration_id")
      .eq("status", "active");
    const counts: Record<string, number> = {};
    (subs || []).forEach((s: any) => {
      counts[s.integration_id] = (counts[s.integration_id] || 0) + 1;
    });
    setSubscriberCounts(counts);
    setLoading(false);
  };

  const openCreate = () => {
    setFormData({
      key: "", name_ar: "", name_en: "", description_ar: "", description_en: "",
      category: "other", monthly_price: 0, is_available: true, requires_api_key: false,
      api_key_label: "", sort_order: integrations.length + 1, icon_name: "Plug",
    });
    setCreateDialog(true);
  };

  const openEdit = (item: PaidIntegration) => {
    setFormData({
      key: item.key, name_ar: item.name_ar, name_en: item.name_en,
      description_ar: item.description_ar || "", description_en: item.description_en || "",
      category: item.category, monthly_price: item.monthly_price, is_available: item.is_available,
      requires_api_key: item.requires_api_key, api_key_label: item.api_key_label || "",
      sort_order: item.sort_order, icon_name: item.icon_name || "Plug",
    });
    setEditDialog(item);
  };

  const handleSave = async () => {
    if (!formData.key || !formData.name_ar) {
      toast({ title: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editDialog) {
      await supabase
        .from("paid_integrations")
        .update({
          name_ar: formData.name_ar, name_en: formData.name_en,
          description_ar: formData.description_ar, description_en: formData.description_en,
          category: formData.category, monthly_price: formData.monthly_price,
          is_available: formData.is_available, requires_api_key: formData.requires_api_key,
          api_key_label: formData.api_key_label, sort_order: formData.sort_order,
          icon_name: formData.icon_name,
        } as any)
        .eq("id", editDialog.id);
      toast({ title: "تم تحديث التكامل" });
      setEditDialog(null);
    } else {
      await supabase.from("paid_integrations").insert({
        key: formData.key, name_ar: formData.name_ar, name_en: formData.name_en,
        description_ar: formData.description_ar, description_en: formData.description_en,
        category: formData.category, monthly_price: formData.monthly_price,
        is_available: formData.is_available, requires_api_key: formData.requires_api_key,
        api_key_label: formData.api_key_label, sort_order: formData.sort_order,
        icon_name: formData.icon_name,
      } as any);
      toast({ title: "تم إضافة التكامل" });
      setCreateDialog(false);
    }
    setSaving(false);
    fetchIntegrations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل تريد حذف هذا التكامل؟")) return;
    await supabase.from("paid_integrations").delete().eq("id", id);
    toast({ title: "تم حذف التكامل" });
    fetchIntegrations();
  };

  const toggleAvailability = async (id: string, val: boolean) => {
    await supabase.from("paid_integrations").update({ is_available: val } as any).eq("id", id);
    fetchIntegrations();
  };

  const totalRevenue = integrations.reduce((sum, i) => {
    const count = subscriberCounts[i.id] || 0;
    return sum + count * i.monthly_price;
  }, 0);

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
              <Label>التصنيف</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>السعر الشهري (ر.س)</Label>
              <Input type="number" value={formData.monthly_price} onChange={(e) => setFormData({ ...formData, monthly_price: Number(e.target.value) })} />
            </div>
            <div>
              <Label>الترتيب</Label>
              <Input type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={formData.is_available} onCheckedChange={(v) => setFormData({ ...formData, is_available: v })} />
              متاح للاشتراك
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={formData.requires_api_key} onCheckedChange={(v) => setFormData({ ...formData, requires_api_key: v })} />
              يتطلب مفتاح API
            </label>
          </div>
          {formData.requires_api_key && (
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة التكاملات المدفوعة</h1>
          <p className="text-muted-foreground mt-1">إدارة كتالوج التكاملات الخارجية وأسعارها ومشتركيها</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> إضافة تكامل</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">إجمالي التكاملات</p>
            <p className="text-2xl font-bold">{integrations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">تكاملات متاحة</p>
            <p className="text-2xl font-bold text-green-600">{integrations.filter(i => i.is_available).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">إجمالي المشتركين</p>
            <p className="text-2xl font-bold text-primary">{Object.values(subscriberCounts).reduce((a, b) => a + b, 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">الإيراد الشهري المتوقع</p>
            <p className="text-2xl font-bold text-accent">{totalRevenue.toLocaleString()} ر.س</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">كتالوج التكاملات</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التكامل</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>السعر الشهري</TableHead>
                <TableHead>المشتركين</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((item) => {
                const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;
                const CatIcon = cat.icon;
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
                    <TableCell className="font-medium">{item.monthly_price} ر.س</TableCell>
                    <TableCell>
                      <Badge variant="outline">{subscriberCounts[item.id] || 0} مشترك</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={item.is_available} onCheckedChange={(v) => toggleAvailability(item.id, v)} />
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

      <FormDialog open={createDialog || !!editDialog} onClose={() => { setCreateDialog(false); setEditDialog(null); }} />
    </div>
  );
};

export default AdminPaidIntegrations;
