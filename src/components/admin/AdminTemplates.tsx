import { useEffect, useState, useMemo } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  FileText, Search, Plus, Lock, Unlock, Eye, Pencil, Trash2,
  Copy, Check, X, LayoutTemplate, Mail, Bell, FileSignature,
  Receipt, ChevronDown, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Template {
  id: string;
  category: string;
  name_ar: string;
  name_en: string;
  description: string;
  body_html: string;
  placeholders: any[];
  is_default: boolean;
  is_locked: boolean;
  allow_tenant_customization: boolean;
  status: string;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "invoice", label: "فواتير", icon: Receipt, color: "bg-emerald-100 text-emerald-700" },
  { value: "contract", label: "عقود", icon: FileSignature, color: "bg-blue-100 text-blue-700" },
  { value: "email", label: "بريد إلكتروني", icon: Mail, color: "bg-purple-100 text-purple-700" },
  { value: "notification", label: "إشعارات", icon: Bell, color: "bg-amber-100 text-amber-700" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "bg-emerald-100 text-emerald-700" },
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground" },
  archived: { label: "مؤرشف", color: "bg-red-100 text-red-700" },
};

const EMPTY_TEMPLATE: Omit<Template, "id" | "created_by" | "updated_by" | "created_at" | "updated_at"> = {
  category: "invoice",
  name_ar: "",
  name_en: "",
  description: "",
  body_html: "",
  placeholders: [],
  is_default: false,
  is_locked: false,
  allow_tenant_customization: true,
  status: "draft",
};

const AdminTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editDialog, setEditDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("platform_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTemplates(data as Template[]);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = t.name_ar.includes(search) || t.name_en.toLowerCase().includes(search.toLowerCase()) || t.description?.includes(search);
      const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [templates, search, categoryFilter, statusFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    templates.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, [templates]);

  const openCreate = () => {
    setSelectedTemplate(null);
    setForm(EMPTY_TEMPLATE);
    setEditDialog(true);
  };

  const openEdit = (t: Template) => {
    setSelectedTemplate(t);
    setForm({
      category: t.category,
      name_ar: t.name_ar,
      name_en: t.name_en,
      description: t.description || "",
      body_html: t.body_html,
      placeholders: t.placeholders,
      is_default: t.is_default,
      is_locked: t.is_locked,
      allow_tenant_customization: t.allow_tenant_customization,
      status: t.status,
    });
    setEditDialog(true);
  };

  const openPreview = (t: Template) => {
    setSelectedTemplate(t);
    setPreviewDialog(true);
  };

  const openDelete = (t: Template) => {
    setSelectedTemplate(t);
    setDeleteDialog(true);
  };

  const handleSave = async () => {
    if (!form.name_ar.trim()) {
      toast({ title: "خطأ", description: "اسم القالب مطلوب", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (selectedTemplate) {
        const { error } = await supabase
          .from("platform_templates")
          .update({ ...form, updated_by: user?.id } as any)
          .eq("id", selectedTemplate.id);
        if (error) throw error;
        toast({ title: "تم التحديث", description: "تم تحديث القالب بنجاح" });
      } else {
        const { error } = await supabase
          .from("platform_templates")
          .insert({ ...form, created_by: user?.id } as any);
        if (error) throw error;
        toast({ title: "تم الإنشاء", description: "تم إنشاء القالب بنجاح" });
      }
      setEditDialog(false);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    const { error } = await supabase.from("platform_templates").delete().eq("id", selectedTemplate.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف", description: "تم حذف القالب" });
      fetchTemplates();
    }
    setDeleteDialog(false);
  };

  const toggleLock = async (t: Template) => {
    const { error } = await supabase
      .from("platform_templates")
      .update({ is_locked: !t.is_locked, updated_by: user?.id } as any)
      .eq("id", t.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t.is_locked ? "تم فتح القفل" : "تم القفل", description: t.is_locked ? "يمكن للمنشآت تعديل هذا القالب الآن" : "تم قفل القالب — لا يمكن تعديله من المنشآت" });
      fetchTemplates();
    }
  };

  const toggleDefault = async (t: Template) => {
    const { error } = await supabase
      .from("platform_templates")
      .update({ is_default: !t.is_default, updated_by: user?.id } as any)
      .eq("id", t.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      fetchTemplates();
    }
  };

  const duplicateTemplate = async (t: Template) => {
    const { error } = await supabase
      .from("platform_templates")
      .insert({
        category: t.category,
        name_ar: t.name_ar + " (نسخة)",
        name_en: t.name_en ? t.name_en + " (copy)" : "",
        description: t.description,
        body_html: t.body_html,
        placeholders: t.placeholders,
        is_default: false,
        is_locked: false,
        allow_tenant_customization: t.allow_tenant_customization,
        status: "draft",
        created_by: user?.id,
      } as any);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم النسخ", description: "تم نسخ القالب بنجاح" });
      fetchTemplates();
    }
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

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
            <LayoutTemplate className="text-accent" size={28} />
            إدارة القوالب
          </h1>
          <p className="text-sm text-muted-foreground">إنشاء وإدارة قوالب الفواتير والعقود والبريد والإشعارات على مستوى المنصة</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> قالب جديد
        </Button>
      </div>

      {/* Category KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <Card key={cat.value} className="cursor-pointer hover:border-accent/50 transition-colors" onClick={() => setCategoryFilter(cat.value === categoryFilter ? "all" : cat.value)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-lg p-2 ${cat.color}`}><Icon size={20} /></div>
                <div>
                  <p className="text-2xl font-bold">{categoryCounts[cat.value] || 0}</p>
                  <p className="text-xs text-muted-foreground">{cat.label}</p>
                </div>
                {categoryFilter === cat.value && <Badge variant="outline" className="mr-auto text-xs">مُفلتر</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="بحث بالاسم أو الوصف..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">القالب</TableHead>
                <TableHead className="text-center">النوع</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center">افتراضي</TableHead>
                <TableHead className="text-center">القفل</TableHead>
                <TableHead className="text-center">تخصيص المنشآت</TableHead>
                <TableHead className="text-center">التحديث</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => {
                const catInfo = getCategoryInfo(t.category);
                const CatIcon = catInfo.icon;
                const st = STATUS_MAP[t.status] || STATUS_MAP.draft;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CatIcon size={16} className="text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{t.name_ar}</p>
                          {t.name_en && <p className="text-xs text-muted-foreground">{t.name_en}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${catInfo.color}`}>{catInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="ghost" onClick={() => toggleDefault(t)} className="h-7 w-7 p-0">
                        {t.is_default ? <Check size={14} className="text-emerald-600" /> : <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="ghost" onClick={() => toggleLock(t)} className="h-7 w-7 p-0">
                        {t.is_locked ? <Lock size={14} className="text-destructive" /> : <Unlock size={14} className="text-muted-foreground" />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${t.allow_tenant_customization ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {t.allow_tenant_customization ? "مسموح" : "ممنوع"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {new Date(t.updated_at).toLocaleDateString("ar-SA")}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openPreview(t)} className="h-7 w-7 p-0" title="معاينة"><Eye size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-7 w-7 p-0" title="تعديل"><Pencil size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicateTemplate(t)} className="h-7 w-7 p-0" title="نسخ"><Copy size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openDelete(t)} className="h-7 w-7 p-0 text-destructive" title="حذف"><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    لا توجد قوالب — أنشئ قالبًا جديدًا للبدء
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate size={18} className="text-accent" />
              {selectedTemplate ? "تعديل القالب" : "إنشاء قالب جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربية *</Label>
                <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} placeholder="قالب فاتورة ضريبية" />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} placeholder="Tax Invoice Template" dir="ltr" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="وصف مختصر للقالب" />
            </div>

            <div className="space-y-2">
              <Label>محتوى القالب (HTML)</Label>
              <Textarea
                value={form.body_html}
                onChange={e => setForm({ ...form, body_html: e.target.value })}
                placeholder="<div dir='rtl'>...</div>"
                className="min-h-[200px] font-mono text-sm"
                dir="ltr"
              />
            </div>

            <div className="flex gap-6 flex-wrap pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_default} onCheckedChange={v => setForm({ ...form, is_default: v })} />
                <Label className="text-sm">قالب افتراضي</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_locked} onCheckedChange={v => setForm({ ...form, is_locked: v })} />
                <Label className="text-sm">مقفل</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.allow_tenant_customization} onCheckedChange={v => setForm({ ...form, allow_tenant_customization: v })} />
                <Label className="text-sm">السماح بتخصيص المنشآت</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setEditDialog(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Preview Dialog ─── */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} className="text-accent" />
              معاينة القالب: {selectedTemplate?.name_ar}
            </DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">النوع: </span><Badge className={`text-xs ${getCategoryInfo(selectedTemplate.category).color}`}>{getCategoryInfo(selectedTemplate.category).label}</Badge></div>
                <div><span className="text-muted-foreground">الحالة: </span><Badge className={`text-xs ${(STATUS_MAP[selectedTemplate.status] || STATUS_MAP.draft).color}`}>{(STATUS_MAP[selectedTemplate.status] || STATUS_MAP.draft).label}</Badge></div>
                <div className="flex items-center gap-1"><span className="text-muted-foreground">افتراضي: </span>{selectedTemplate.is_default ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-muted-foreground" />}</div>
                <div className="flex items-center gap-1"><span className="text-muted-foreground">مقفل: </span>{selectedTemplate.is_locked ? <Lock size={14} className="text-destructive" /> : <Unlock size={14} className="text-muted-foreground" />}</div>
              </div>
              {selectedTemplate.description && (
                <div className="text-sm"><span className="text-muted-foreground">الوصف: </span>{selectedTemplate.description}</div>
              )}
              <div className="rounded-lg border p-4 bg-card">
                <p className="text-xs text-muted-foreground mb-2">المحتوى:</p>
                <div
                  className="prose prose-sm max-w-none"
                  dir="rtl"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedTemplate.body_html || "<p class='text-muted-foreground'>لا يوجد محتوى</p>") }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={18} />
              حذف القالب
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف القالب <strong>{selectedTemplate?.name_ar}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTemplates;
