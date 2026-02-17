import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Mail, Search, Plus, Eye, Pencil, Copy, Trash2, History,
  RotateCcw, Power, PowerOff, Shield, ChevronDown, Variable,
  Wallet, Receipt, AlertTriangle, Bell, Lock, Unlock, Check, X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  email_type: string;
  name_ar: string;
  name_en: string;
  description: string | null;
  category: string;
  subject_template: string;
  body_html: string;
  body_text: string;
  variables: { key: string; label_ar: string; label_en: string }[];
  sender_key: string;
  is_active: boolean;
  is_system: boolean;
  allow_tenant_override: boolean;
  current_version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  subject_template: string;
  body_html: string;
  body_text: string;
  change_summary: string | null;
  changed_by: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "financial", label: "مالية", icon: Wallet, color: "bg-emerald-100 text-emerald-700" },
  { value: "general", label: "عامة", icon: Mail, color: "bg-blue-100 text-blue-700" },
  { value: "security", label: "أمنية", icon: Shield, color: "bg-red-100 text-red-700" },
  { value: "notification", label: "إشعارات", icon: Bell, color: "bg-amber-100 text-amber-700" },
];

const SENDER_MAP: Record<string, { label: string; email: string }> = {
  "no-reply": { label: "No-Reply", email: "no-reply@numaxio.com" },
  billing: { label: "Billing", email: "billing@numaxio.com" },
  security: { label: "Security", email: "security@numaxio.com" },
};

const SAMPLE_DATA: Record<string, string> = {
  company_name: "شركة المثال التقنية",
  vat_number: "300000000000003",
  cr_number: "1010000000",
  customer_name: "أحمد محمد العلي",
  invoice_number: "INV-202602-0042",
  invoice_date: "2026-02-17",
  due_date: "2026-03-17",
  subtotal: "10,000.00",
  vat_total: "1,500.00",
  grand_total: "11,500.00",
  currency: "ر.س",
  amount: "5,000.00",
  payment_date: "2026-02-17",
  payment_method: "تحويل بنكي",
  reference_number: "REF-98765",
  remaining_balance: "6,500.00",
  credit_note_number: "CN-202602-0001",
  credit_date: "2026-02-17",
  reason: "خطأ في الكمية",
  attempt_date: "2026-02-17",
  failure_reason: "رصيد غير كافٍ",
  transaction_type_label: "إيداع",
  amount_sign: "+",
  balance_before: "2,500.00",
  balance_after: "7,500.00",
  reason_label: "شحن رصيد",
  user_name: "محمد أحمد",
  ip_address: "192.168.1.100",
  device: "Chrome / Windows",
  timestamp: "2026-02-17 14:30",
  alert_type: "new_login",
  access_token: "demo-token-xxxx",
};

function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

// Formal email wrapper for preview
function wrapForPreview(bodyHtml: string, companyName?: string, vatNumber?: string): string {
  return `<div dir="rtl" style="font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;background:#f4f5f7;">
  <div style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:17px;font-weight:600;">معاينة القالب</h1>
      ${companyName ? `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${companyName}${vatNumber ? ` | الرقم الضريبي: ${vatNumber}` : ''}</p>` : ''}
    </div>
    <div style="padding:24px;">${bodyHtml}</div>
  </div>
</div>`;
}

const AdminEmailTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [editDialog, setEditDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [versionsDialog, setVersionsDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [editTab, setEditTab] = useState("html");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email_type: "",
    name_ar: "",
    name_en: "",
    description: "",
    category: "general",
    subject_template: "",
    body_html: "",
    body_text: "",
    sender_key: "no-reply",
    is_active: true,
    allow_tenant_override: true,
  });

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_template_definitions" as any)
      .select("*")
      .order("category")
      .order("name_ar");
    if (data) setTemplates(data as any[]);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = t.name_ar.includes(search) || t.name_en.toLowerCase().includes(search.toLowerCase()) || t.email_type.includes(search);
      const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [templates, search, categoryFilter]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    templates.forEach(t => { c[t.category] = (c[t.category] || 0) + 1; });
    return c;
  }, [templates]);

  const openCreate = () => {
    setSelected(null);
    setForm({
      email_type: "", name_ar: "", name_en: "", description: "", category: "general",
      subject_template: "", body_html: "", body_text: "", sender_key: "no-reply",
      is_active: true, allow_tenant_override: true,
    });
    setEditTab("html");
    setEditDialog(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setSelected(t);
    setForm({
      email_type: t.email_type,
      name_ar: t.name_ar,
      name_en: t.name_en,
      description: t.description || "",
      category: t.category,
      subject_template: t.subject_template,
      body_html: t.body_html,
      body_text: t.body_text,
      sender_key: t.sender_key,
      is_active: t.is_active,
      allow_tenant_override: t.allow_tenant_override,
    });
    setEditTab("html");
    setEditDialog(true);
  };

  const openPreview = (t: EmailTemplate) => {
    setSelected(t);
    setPreviewDialog(true);
  };

  const openVersions = async (t: EmailTemplate) => {
    setSelected(t);
    const { data } = await supabase
      .from("email_template_versions" as any)
      .select("*")
      .eq("template_id", t.id)
      .order("version_number", { ascending: false });
    setVersions((data || []) as any[]);
    setVersionsDialog(true);
  };

  const restoreVersion = async (v: TemplateVersion) => {
    if (!selected) return;
    const { error } = await supabase
      .from("email_template_definitions" as any)
      .update({
        subject_template: v.subject_template,
        body_html: v.body_html,
        body_text: v.body_text,
        updated_by: user?.id,
      } as any)
      .eq("id", selected.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تمت الاستعادة", description: `تم استعادة النسخة ${v.version_number}` });
      setVersionsDialog(false);
      fetchTemplates();
    }
  };

  const handleSave = async () => {
    if (!form.name_ar.trim() || !form.email_type.trim()) {
      toast({ title: "خطأ", description: "الاسم ونوع البريد مطلوبان", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (selected) {
        const { error } = await supabase
          .from("email_template_definitions" as any)
          .update({ ...form, updated_by: user?.id } as any)
          .eq("id", selected.id);
        if (error) throw error;
        toast({ title: "تم الحفظ", description: "تم تحديث القالب (نسخة جديدة تلقائية)" });
      } else {
        const { error } = await supabase
          .from("email_template_definitions" as any)
          .insert({ ...form, created_by: user?.id, is_system: false } as any);
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
    if (!selected) return;
    if (selected.is_system) {
      toast({ title: "غير مسموح", description: "لا يمكن حذف قالب نظامي", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("email_template_definitions" as any).delete().eq("id", selected.id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف" });
      fetchTemplates();
    }
    setDeleteDialog(false);
  };

  const toggleActive = async (t: EmailTemplate) => {
    const { error } = await supabase
      .from("email_template_definitions" as any)
      .update({ is_active: !t.is_active, updated_by: user?.id } as any)
      .eq("id", t.id);
    if (!error) {
      toast({ title: t.is_active ? "تم التعطيل" : "تم التفعيل" });
      fetchTemplates();
    }
  };

  const duplicateTemplate = async (t: EmailTemplate) => {
    const { error } = await supabase
      .from("email_template_definitions" as any)
      .insert({
        email_type: t.email_type + "_copy_" + Date.now(),
        name_ar: t.name_ar + " (نسخة)",
        name_en: t.name_en ? t.name_en + " (copy)" : "",
        description: t.description,
        category: t.category,
        subject_template: t.subject_template,
        body_html: t.body_html,
        body_text: t.body_text,
        variables: t.variables,
        sender_key: t.sender_key,
        is_active: false,
        is_system: false,
        allow_tenant_override: t.allow_tenant_override,
        created_by: user?.id,
      } as any);
    if (!error) {
      toast({ title: "تم النسخ", description: "تم نسخ القالب بنجاح (معطّل)" });
      fetchTemplates();
    }
  };

  const getCat = (c: string) => CATEGORIES.find(x => x.value === c) || CATEGORIES[0];

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
            <Mail className="text-accent" size={28} />
            محرك قوالب البريد
          </h1>
          <p className="text-sm text-muted-foreground">إدارة قوالب البريد الإلكتروني التشغيلية والمالية مع دعم المتغيرات والإصدارات</p>
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
          <Input placeholder="بحث بالاسم أو النوع..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      <Card>
        <ScrollArea className="h-[520px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">القالب</TableHead>
                <TableHead className="text-center">الفئة</TableHead>
                <TableHead className="text-center">المرسل</TableHead>
                <TableHead className="text-center">الحالة</TableHead>
                <TableHead className="text-center">تخصيص</TableHead>
                <TableHead className="text-center">النسخة</TableHead>
                <TableHead className="text-center">المتغيرات</TableHead>
                <TableHead className="text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => {
                const catInfo = getCat(t.category);
                const CatIcon = catInfo.icon;
                const sender = SENDER_MAP[t.sender_key] || SENDER_MAP["no-reply"];
                return (
                  <TableRow key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CatIcon size={16} className="text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{t.name_ar}</p>
                          <p className="text-xs text-muted-foreground font-mono" dir="ltr">{t.email_type}</p>
                        </div>
                        {t.is_system && <Badge variant="outline" className="text-[10px] px-1">نظامي</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-xs ${catInfo.color}`}>{catInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs font-mono text-muted-foreground">{sender.email}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(t)} className="h-7 px-2 gap-1">
                        {t.is_active ? <Power size={13} className="text-emerald-600" /> : <PowerOff size={13} className="text-muted-foreground" />}
                        <span className="text-xs">{t.is_active ? "نشط" : "معطل"}</span>
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${t.allow_tenant_override ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                        {t.allow_tenant_override ? "مسموح" : "ممنوع"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs font-mono">v{t.current_version}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs gap-1">
                        <Variable size={11} />
                        {t.variables?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button size="sm" variant="ghost" onClick={() => openPreview(t)} className="h-7 w-7 p-0" title="معاينة"><Eye size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-7 w-7 p-0" title="تعديل"><Pencil size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openVersions(t)} className="h-7 w-7 p-0" title="الإصدارات"><History size={14} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicateTemplate(t)} className="h-7 w-7 p-0" title="نسخ"><Copy size={14} /></Button>
                        {!t.is_system && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelected(t); setDeleteDialog(true); }} className="h-7 w-7 p-0 text-destructive" title="حذف"><Trash2 size={14} /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    لا توجد قوالب
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* ─── Edit Dialog ─── */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={18} className="text-accent" />
              {selected ? `تعديل: ${selected.name_ar}` : "إنشاء قالب بريد جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربية *</Label>
                <Input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>نوع البريد (email_type) *</Label>
                <Input value={form.email_type} onChange={e => setForm({ ...form, email_type: e.target.value })} dir="ltr" className="font-mono text-sm" disabled={!!selected} />
              </div>
              <div className="space-y-2">
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المرسل</Label>
                <Select value={form.sender_key} onValueChange={v => setForm({ ...form, sender_key: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SENDER_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="وصف مختصر لهذا القالب" />
            </div>

            <Separator />

            {/* Subject */}
            <div className="space-y-2">
              <Label>عنوان الرسالة (يدعم متغيرات {"{{variable}}"})</Label>
              <Input value={form.subject_template} onChange={e => setForm({ ...form, subject_template: e.target.value })} dir="rtl" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">المعاينة: {replaceVariables(form.subject_template, SAMPLE_DATA)}</p>
            </div>

            {/* Body Tabs */}
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="text">نص عادي</TabsTrigger>
                <TabsTrigger value="preview">معاينة مباشرة</TabsTrigger>
                {selected && <TabsTrigger value="variables">المتغيرات ({selected.variables?.length || 0})</TabsTrigger>}
              </TabsList>

              <TabsContent value="html" className="space-y-2">
                <Label>محتوى HTML (يدعم متغيرات {"{{variable}}"})</Label>
                <Textarea
                  value={form.body_html}
                  onChange={e => setForm({ ...form, body_html: e.target.value })}
                  className="min-h-[280px] font-mono text-xs leading-relaxed"
                  dir="ltr"
                />
              </TabsContent>

              <TabsContent value="text" className="space-y-2">
                <Label>نص عادي (للعملاء الذين لا يدعمون HTML)</Label>
                <Textarea
                  value={form.body_text}
                  onChange={e => setForm({ ...form, body_text: e.target.value })}
                  className="min-h-[200px] text-sm"
                  dir="rtl"
                />
              </TabsContent>

              <TabsContent value="preview">
                <div className="rounded-lg border overflow-hidden bg-muted/30">
                  <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground flex items-center justify-between">
                    <span>معاينة مباشرة (ببيانات تجريبية)</span>
                    <Badge variant="outline" className="text-[10px]">RTL</Badge>
                  </div>
                  <div className="p-4">
                    <div
                      className="bg-white rounded-lg shadow-sm"
                      dangerouslySetInnerHTML={{
                        __html: wrapForPreview(
                          replaceVariables(form.body_html, SAMPLE_DATA),
                          SAMPLE_DATA.company_name,
                          SAMPLE_DATA.vat_number
                        )
                      }}
                    />
                  </div>
                </div>
              </TabsContent>

              {selected && (
                <TabsContent value="variables">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المتغير</TableHead>
                          <TableHead className="text-right">التسمية بالعربية</TableHead>
                          <TableHead className="text-right">التسمية بالإنجليزية</TableHead>
                          <TableHead className="text-right">القيمة التجريبية</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selected.variables || []).map((v: any) => (
                          <TableRow key={v.key}>
                            <TableCell className="font-mono text-xs" dir="ltr">{`{{${v.key}}}`}</TableCell>
                            <TableCell className="text-sm">{v.label_ar}</TableCell>
                            <TableCell className="text-sm text-muted-foreground" dir="ltr">{v.label_en}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{SAMPLE_DATA[v.key] || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* Switches */}
            <div className="flex gap-6 flex-wrap pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                <Label className="text-sm">نشط</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.allow_tenant_override} onCheckedChange={v => setForm({ ...form, allow_tenant_override: v })} />
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
              معاينة: {selected?.name_ar}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">العنوان:</span> <strong>{replaceVariables(selected.subject_template, SAMPLE_DATA)}</strong></p>
                <p><span className="text-muted-foreground">المرسل:</span> <span className="font-mono text-xs">{SENDER_MAP[selected.sender_key]?.email}</span></p>
                <p><span className="text-muted-foreground">النسخة:</span> <Badge variant="secondary" className="text-xs">v{selected.current_version}</Badge></p>
              </div>
              <Separator />
              <div className="rounded-lg border overflow-hidden">
                <div
                  className="bg-white"
                  dangerouslySetInnerHTML={{
                    __html: wrapForPreview(
                      replaceVariables(selected.body_html, SAMPLE_DATA),
                      SAMPLE_DATA.company_name,
                      SAMPLE_DATA.vat_number
                    )
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Versions Dialog ─── */}
      <Dialog open={versionsDialog} onOpenChange={setVersionsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={18} className="text-accent" />
              سجل الإصدارات: {selected?.name_ar}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {versions.map(v => (
                <Card key={v.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">v{v.version_number}</Badge>
                        {v.version_number === selected?.current_version && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">الحالية</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleDateString("ar-SA")} {new Date(v.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {v.version_number !== selected?.current_version && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => restoreVersion(v)}>
                            <RotateCcw size={12} /> استعادة
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{v.change_summary || "—"}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate" dir="ltr">{v.subject_template}</p>
                  </CardContent>
                </Card>
              ))}
              {versions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">لا توجد إصدارات سابقة</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Dialog ─── */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 size={18} /> حذف القالب
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف القالب <strong>{selected?.name_ar}</strong>؟ سيتم حذف جميع الإصدارات المرتبطة.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete}>حذف نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailTemplates;
