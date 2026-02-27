import { useEffect, useState, useMemo, useCallback } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  Mail, Search, Eye, Copy, Pencil, History, Check, X,
  Loader2, Shield, Variable, LayoutTemplate, Globe, FileText
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
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";

interface PlatformTemplate {
  id: string;
  email_type: string;
  name_ar: string;
  name_en: string;
  category: string;
  subject_template: string;
  body_html: string;
  body_text: string;
  variables: { key: string; label_ar: string; label_en: string }[];
  allow_tenant_override: boolean;
  is_active: boolean;
}

interface TenantOverride {
  id: string;
  tenant_id: string;
  template_definition_id: string;
  locale: string;
  status: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  version: number;
  published_at: string | null;
  created_at: string;
}

const SAMPLE_DATA: Record<string, string> = {
  company_name: "شركة المثال",
  user_name: "أحمد محمد",
  title: "عنوان الإشعار",
  message: "هذه رسالة تجريبية لمعاينة القالب.",
  cta_label: "عرض التفاصيل",
  cta_url: "#",
  date: new Date().toLocaleDateString("ar-SA"),
  severity: "warning",
  customer_name: "عميل تجريبي",
  invoice_number: "INV-2026-001",
  amount: "5,000.00",
  currency: "ر.س",
};

function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

const TenantEmailTemplatesPage = () => {
  const { tenantId, userRole, user } = useAuth();
  const { toast } = useToast();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PlatformTemplate[]>([]);
  const [overrides, setOverrides] = useState<TenantOverride[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [editDialog, setEditDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [selected, setSelected] = useState<PlatformTemplate | null>(null);
  const [editTab, setEditTab] = useState("html");
  const [saving, setSaving] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<"ar" | "en">("ar");

  const [form, setForm] = useState({
    subject: "",
    html_body: "",
    text_body: "",
    locale: "ar" as "ar" | "en",
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [tplRes, overRes] = await Promise.all([
      supabase.from("email_template_definitions" as any).select("*").eq("is_active", true).order("category").order("name_ar"),
      supabase.from("tenant_email_template_overrides" as any).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    ]);

    if (tplRes.data) setTemplates(tplRes.data as any[]);
    if (overRes.data) setOverrides(overRes.data as any[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (!t.allow_tenant_override) return false;
      const matchSearch = t.name_ar.includes(search) || (t.name_en || "").toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [templates, search, categoryFilter]);

  const getOverride = (templateId: string, locale: string) => {
    return overrides.find(o => o.template_definition_id === templateId && o.locale === locale && o.status === "published");
  };

  const getDraftOverride = (templateId: string, locale: string) => {
    return overrides.find(o => o.template_definition_id === templateId && o.locale === locale && o.status === "draft");
  };

  const openCustomize = (t: PlatformTemplate) => {
    setSelected(t);
    const existing = getOverride(t.id, "ar") || getDraftOverride(t.id, "ar");
    setForm({
      subject: existing?.subject || t.subject_template,
      html_body: existing?.html_body || t.body_html,
      text_body: existing?.text_body || t.body_text,
      locale: "ar",
    });
    setEditTab("html");
    setEditDialog(true);
  };

  const openPreview = (t: PlatformTemplate) => {
    setSelected(t);
    setPreviewLocale("ar");
    setPreviewDialog(true);
  };

  const getPreviewHtml = () => {
    if (!selected) return "";
    const override = getOverride(selected.id, previewLocale);
    const html = override?.html_body || selected.body_html;
    return replaceVariables(html, SAMPLE_DATA);
  };

  const handleSave = async (publish = false) => {
    if (!tenantId || !selected || !user) return;
    setSaving(true);
    try {
      const existing = overrides.find(
        o => o.template_definition_id === selected.id && o.locale === form.locale
      );

      const nextVersion = existing ? existing.version + 1 : 1;

      const data: any = {
        tenant_id: tenantId,
        template_definition_id: selected.id,
        locale: form.locale,
        subject: form.subject,
        html_body: form.html_body,
        text_body: form.text_body || null,
        version: nextVersion,
        status: publish ? "published" : "draft",
        created_by: user.id,
        published_at: publish ? new Date().toISOString() : null,
      };

      // Archive old published version if publishing
      if (publish && existing?.status === "published") {
        await supabase.from("tenant_email_template_overrides" as any)
          .update({ status: "archived" } as any)
          .eq("id", existing.id);
      }

      const { error } = await supabase.from("tenant_email_template_overrides" as any).insert(data);
      if (error) throw error;

      toast({
        title: publish
          ? (isAr ? "تم النشر" : "Published")
          : (isAr ? "تم الحفظ كمسودة" : "Saved as draft"),
      });
      setEditDialog(false);
      fetchData();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // Owner guard
  if (userRole !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground text-sm max-w-md">
          {isAr ? "هذه الصفحة متاحة لمالك المنشأة فقط." : "This page is available to the tenant owner only."}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <LayoutTemplate size={22} />
          {isAr ? "قوالب البريد الإلكتروني" : "Email Templates"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "خصّص قوالب البريد الإلكتروني المرسلة باسم منشأتك. يمكنك نسخ القالب الافتراضي وتعديله."
            : "Customize email templates sent on behalf of your organization. Copy and modify default templates."}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder={isAr ? "بحث..." : "Search..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isAr ? "كل الفئات" : "All"}</SelectItem>
            <SelectItem value="financial">{isAr ? "مالية" : "Financial"}</SelectItem>
            <SelectItem value="general">{isAr ? "عامة" : "General"}</SelectItem>
            <SelectItem value="security">{isAr ? "أمنية" : "Security"}</SelectItem>
            <SelectItem value="notification">{isAr ? "إشعارات" : "Notifications"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates List */}
      <Card>
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{isAr ? "القالب" : "Template"}</TableHead>
                <TableHead className="text-center">{isAr ? "الفئة" : "Category"}</TableHead>
                <TableHead className="text-center">{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-center">{isAr ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    {isAr ? "لا توجد قوالب قابلة للتخصيص" : "No customizable templates"}
                  </TableCell>
                </TableRow>
              ) : filtered.map(t => {
                const pubOverride = getOverride(t.id, "ar");
                const draftOverride = getDraftOverride(t.id, "ar");
                const hasCustom = !!pubOverride;
                const hasDraft = !!draftOverride;

                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{isAr ? t.name_ar : (t.name_en || t.name_ar)}</p>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">{t.email_type}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">{t.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasCustom ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs">
                          {isAr ? "مخصص" : "Custom"}
                        </Badge>
                      ) : hasDraft ? (
                        <Badge variant="secondary" className="text-xs">
                          {isAr ? "مسودة" : "Draft"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {isAr ? "افتراضي" : "Default"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => openPreview(t)}>
                          <Eye size={13} />
                          <span className="text-xs">{isAr ? "معاينة" : "Preview"}</span>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => openCustomize(t)}>
                          <Pencil size={13} />
                          <span className="text-xs">{isAr ? "تخصيص" : "Customize"}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Variables Reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Variable size={16} />
            {isAr ? "المتغيرات المتاحة" : "Available Variables"}
          </CardTitle>
          <CardDescription className="text-xs">
            {isAr ? "استخدم هذه المتغيرات في القوالب بصيغة {{variable}}" : "Use these variables in templates as {{variable}}"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["company_name", "user_name", "title", "message", "cta_label", "cta_url", "date", "severity",
              "customer_name", "invoice_number", "amount", "currency"].map(v => (
              <Badge key={v} variant="outline" className="text-xs font-mono">{`{{${v}}}`}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={18} />
              {isAr ? `تخصيص: ${selected?.name_ar}` : `Customize: ${selected?.name_en || selected?.name_ar}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label>{isAr ? "اللغة" : "Locale"}</Label>
                <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v as "ar" | "en" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-[2] space-y-2">
                <Label>{isAr ? "عنوان البريد" : "Subject"}</Label>
                <Input
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  dir={form.locale === "ar" ? "rtl" : "ltr"}
                />
              </div>
            </div>

            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList>
                <TabsTrigger value="html" className="gap-1 text-xs">
                  <FileText size={12} /> HTML
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-1 text-xs">
                  <Mail size={12} /> {isAr ? "نص عادي" : "Text"}
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1 text-xs">
                  <Eye size={12} /> {isAr ? "معاينة" : "Preview"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="html">
                <Textarea
                  rows={16}
                  className="font-mono text-xs"
                  dir="ltr"
                  value={form.html_body}
                  onChange={e => setForm({ ...form, html_body: e.target.value })}
                />
              </TabsContent>

              <TabsContent value="text">
                <Textarea
                  rows={10}
                  className="text-sm"
                  dir={form.locale === "ar" ? "rtl" : "ltr"}
                  value={form.text_body}
                  onChange={e => setForm({ ...form, text_body: e.target.value })}
                  placeholder={isAr ? "نسخة نصية (اختياري)" : "Plain text version (optional)"}
                />
              </TabsContent>

              <TabsContent value="preview">
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <div className="p-2 border-b flex items-center gap-2 bg-card">
                    <Globe size={14} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {isAr ? "معاينة مباشرة" : "Live Preview"}
                    </span>
                  </div>
                  <div className="p-4">
                    <div
                      className="max-w-[600px] mx-auto"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(replaceVariables(form.html_body, SAMPLE_DATA)) }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={saving}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving} className="gap-1">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isAr ? "حفظ كمسودة" : "Save Draft"}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving} className="gap-1">
              {saving && <Loader2 size={14} className="animate-spin" />}
              <Check size={14} />
              {isAr ? "نشر" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              {isAr ? `معاينة: ${selected?.name_ar}` : `Preview: ${selected?.name_en || selected?.name_ar}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant={previewLocale === "ar" ? "default" : "outline"}
              onClick={() => setPreviewLocale("ar")}
              className="text-xs h-7"
            >
              العربية (RTL)
            </Button>
            <Button
              size="sm"
              variant={previewLocale === "en" ? "default" : "outline"}
              onClick={() => setPreviewLocale("en")}
              className="text-xs h-7"
            >
              English (LTR)
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden bg-[#F6F7F9]">
            <div
              className="max-w-[600px] mx-auto p-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(getPreviewHtml()) }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantEmailTemplatesPage;
