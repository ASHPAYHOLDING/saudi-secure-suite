import { useState, useEffect, useCallback, useMemo } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  LayoutTemplate, Eye, Pencil, Plus, Search, Loader2, Copy,
  Send, Monitor, Smartphone, Globe, Variable, FileText,
  CheckCircle2, AlertTriangle, History, Mail, MessageSquare, Bell,
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Template {
  id: string;
  event_key: string;
  channel: string;
  lang: string;
  scope: string;
  tenant_id: string | null;
  subject: string | null;
  title: string | null;
  body: string;
  body_html: string | null;
  body_text: string | null;
  variables_schema: Record<string, { label_ar: string; label_en: string; example: string }>;
  is_active: boolean;
  is_platform_default: boolean;
  version: number;
  created_at: string;
}

interface EventDef {
  key: string;
  name_ar: string;
  name_en: string;
  category: string;
}

const CHANNEL_ICONS: Record<string, any> = { email: Mail, in_app: Bell, whatsapp: MessageSquare };
const CHANNEL_LABELS: Record<string, string> = { email: "بريد", in_app: "داخلي", whatsapp: "واتساب" };

function replaceVars(tpl: string, vars: Record<string, string>, schema: Record<string, any>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in vars && vars[key]) return vars[key];
    if (schema[key]?.example) return schema[key].example;
    return "—";
  });
}

const AdminTemplateStudio = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [events, setEvents] = useState<EventDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all");

  // Editor state
  const [editing, setEditing] = useState<Template | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState("html");
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const [form, setForm] = useState({
    subject: "",
    title: "",
    body: "",
    body_html: "",
    body_text: "",
    event_key: "",
    channel: "email" as string,
    lang: "ar" as string,
  });

  const [varOverrides, setVarOverrides] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tmplRes, evRes] = await Promise.all([
      supabase.from("notification_event_templates").select("*").eq("scope", "platform").order("event_key").order("channel").order("lang"),
      supabase.from("notification_events").select("key, name_ar, name_en, category").order("category").order("key"),
    ]);
    setTemplates((tmplRes.data || []) as unknown as Template[]);
    setEvents((evRes.data || []) as EventDef[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = t.event_key.includes(search) || (t.subject || "").includes(search);
      const matchChannel = channelFilter === "all" || t.channel === channelFilter;
      const matchLang = langFilter === "all" || t.lang === langFilter;
      return matchSearch && matchChannel && matchLang;
    });
  }, [templates, search, channelFilter, langFilter]);

  const healthIssues = useMemo(() => {
    return events.filter(e => {
      const hasEmailAr = templates.some(t => t.event_key === e.key && t.channel === "email" && t.lang === "ar" && t.is_active);
      const hasEmailEn = templates.some(t => t.event_key === e.key && t.channel === "email" && t.lang === "en" && t.is_active);
      return !hasEmailAr || !hasEmailEn;
    });
  }, [events, templates]);

  const eventMap = useMemo(() => new Map(events.map(e => [e.key, e])), [events]);

  const openEditor = (tmpl?: Template) => {
    if (tmpl) {
      setEditing(tmpl);
      setForm({
        subject: tmpl.subject || "",
        title: tmpl.title || "",
        body: tmpl.body || "",
        body_html: tmpl.body_html || "",
        body_text: tmpl.body_text || "",
        event_key: tmpl.event_key,
        channel: tmpl.channel,
        lang: tmpl.lang,
      });
      setVarOverrides({});
    } else {
      setEditing(null);
      setForm({ subject: "", title: "", body: "", body_html: "", body_text: "", event_key: events[0]?.key || "", channel: "email", lang: "ar" });
      setVarOverrides({});
    }
    setEditorTab("html");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.event_key || !form.body) {
      toast({ title: "يرجى ملء الحقول المطلوبة", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("notification_event_templates").update({
          subject: form.subject || null,
          title: form.title || null,
          body: form.body,
          body_html: form.body_html || null,
          body_text: form.body_text || null,
          updated_at: new Date().toISOString(),
        } as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notification_event_templates").insert({
          event_key: form.event_key,
          channel: form.channel,
          lang: form.lang,
          subject: form.subject || null,
          title: form.title || null,
          body: form.body,
          body_html: form.body_html || null,
          body_text: form.body_text || null,
          is_platform_default: true,
          is_active: true,
          scope: "platform",
        } as any);
        if (error) throw error;
      }
      toast({ title: "تم الحفظ بنجاح" });
      setEditorOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDuplicate = async (tmpl: Template) => {
    const newLang = tmpl.lang === "ar" ? "en" : "ar";
    const exists = templates.some(t => t.event_key === tmpl.event_key && t.channel === tmpl.channel && t.lang === newLang);
    if (exists) {
      toast({ title: `القالب بلغة ${newLang === "ar" ? "العربية" : "الإنجليزية"} موجود بالفعل`, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("notification_event_templates").insert({
      event_key: tmpl.event_key,
      channel: tmpl.channel,
      lang: newLang,
      subject: tmpl.subject,
      title: tmpl.title,
      body: tmpl.body,
      body_html: tmpl.body_html,
      body_text: tmpl.body_text,
      variables_schema: tmpl.variables_schema,
      is_platform_default: true,
      is_active: true,
      scope: "platform",
    } as any);
    if (error) toast({ title: "خطأ", description: error.message, variant: "destructive" });
    else { toast({ title: "تم النسخ" }); loadData(); }
  };

  const handleTestSend = async () => {
    if (!testEmail || !editing) return;
    setTesting(true);
    try {
      const schema = editing.variables_schema || {};
      const vars = { ...Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.example])), ...varOverrides };
      const { data, error } = await supabase.functions.invoke("template-preview", {
        body: { action: "test_send", to_email: testEmail, event_key: editing.event_key, lang: editing.lang, variables: vars },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "تم إرسال البريد التجريبي بنجاح" });
      setTestDialogOpen(false);
    } catch (err: any) {
      toast({ title: "فشل الإرسال", description: err.message, variant: "destructive" });
    }
    setTesting(false);
  };

  const insertVariable = (key: string) => {
    setForm(f => ({ ...f, body_html: f.body_html + `{{${key}}}` }));
  };

  const currentSchema = editing?.variables_schema || {};
  const previewVars = { ...Object.fromEntries(Object.entries(currentSchema).map(([k, v]) => [k, v.example])), ...varOverrides };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <LayoutTemplate size={22} />
            استوديو القوالب
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة قوالب الإشعارات للمنصة — بريد إلكتروني، داخلي، واتساب (AR/EN)
          </p>
        </div>
        <Button className="min-h-[44px] gap-1.5" onClick={() => openEditor()}>
          <Plus size={14} />
          قالب جديد
        </Button>
      </div>

      {/* Health Panel */}
      {healthIssues.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                {healthIssues.length} حدث بدون قوالب بريد كاملة (AR+EN)
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {healthIssues.slice(0, 8).map(e => (
                <Badge key={e.key} variant="outline" className="text-[10px] border-destructive/30">
                  {e.name_ar} ({e.key})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input placeholder="بحث بالحدث أو الموضوع..." value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل القنوات</SelectItem>
            <SelectItem value="email">بريد</SelectItem>
            <SelectItem value="in_app">داخلي</SelectItem>
            <SelectItem value="whatsapp">واتساب</SelectItem>
          </SelectContent>
        </Select>
        <Select value={langFilter} onValueChange={setLangFilter}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل اللغات</SelectItem>
            <SelectItem value="ar">العربية</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      <Card>
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start text-xs">الحدث</TableHead>
                <TableHead className="text-center text-xs">القناة</TableHead>
                <TableHead className="text-center text-xs">اللغة</TableHead>
                <TableHead className="text-start text-xs">الموضوع</TableHead>
                <TableHead className="text-center text-xs">HTML</TableHead>
                <TableHead className="text-center text-xs">الإصدار</TableHead>
                <TableHead className="text-center text-xs">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    لا توجد قوالب
                  </TableCell>
                </TableRow>
              ) : filtered.map(t => {
                const ev = eventMap.get(t.event_key);
                const ChIcon = CHANNEL_ICONS[t.channel] || Bell;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <p className="text-xs font-medium">{ev?.name_ar || t.event_key}</p>
                        <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{t.event_key}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ChIcon size={10} />
                        {CHANNEL_LABELS[t.channel] || t.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px]">{t.lang.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{t.subject || t.title || "—"}</TableCell>
                    <TableCell className="text-center">
                      {t.body_html ? (
                        <CheckCircle2 size={14} className="text-primary mx-auto" />
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">v{t.version}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditor(t)} title="تعديل">
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDuplicate(t)} title="نسخ للغة أخرى">
                          <Copy size={13} />
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

      {/* ── Editor Dialog ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate size={18} />
              {editing ? `تعديل: ${eventMap.get(editing.event_key)?.name_ar || editing.event_key}` : "قالب جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Meta fields */}
            {!editing && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الحدث</Label>
                  <Select value={form.event_key} onValueChange={v => setForm(f => ({ ...f, event_key: v }))}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {events.map(e => <SelectItem key={e.key} value={e.key} className="text-xs">{e.name_ar} ({e.key})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">القناة</Label>
                  <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email" className="text-xs">بريد</SelectItem>
                      <SelectItem value="in_app" className="text-xs">داخلي</SelectItem>
                      <SelectItem value="whatsapp" className="text-xs">واتساب</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">اللغة</Label>
                  <Select value={form.lang} onValueChange={v => setForm(f => ({ ...f, lang: v }))}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar" className="text-xs">العربية</SelectItem>
                      <SelectItem value="en" className="text-xs">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Subject + Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">الموضوع (بريد)</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} dir={form.lang === "ar" ? "rtl" : "ltr"} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">العنوان (داخلي)</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} dir={form.lang === "ar" ? "rtl" : "ltr"} className="text-sm" />
              </div>
            </div>

            {/* Tabs: HTML / Text / Schema / Preview */}
            <Tabs value={editorTab} onValueChange={setEditorTab}>
              <div className="flex items-center justify-between">
                <TabsList className="h-8">
                  <TabsTrigger value="html" className="text-xs h-7 gap-1"><FileText size={11} /> HTML</TabsTrigger>
                  <TabsTrigger value="text" className="text-xs h-7 gap-1"><Mail size={11} /> نص</TabsTrigger>
                  <TabsTrigger value="schema" className="text-xs h-7 gap-1"><Variable size={11} /> المتغيرات</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs h-7 gap-1"><Eye size={11} /> معاينة</TabsTrigger>
                </TabsList>

                {editorTab === "preview" && (
                  <div className="flex items-center gap-2">
                    <Button variant={previewMode === "desktop" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewMode("desktop")}>
                      <Monitor size={13} />
                    </Button>
                    <Button variant={previewMode === "mobile" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" onClick={() => setPreviewMode("mobile")}>
                      <Smartphone size={13} />
                    </Button>
                  </div>
                )}
              </div>

              <TabsContent value="html" className="mt-2">
                {/* Variable insertion bar */}
                {editing?.variables_schema && Object.keys(editing.variables_schema).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(editing.variables_schema).map(([key, meta]) => (
                      <Button key={key} variant="outline" size="sm" className="h-6 px-2 text-[10px] font-mono gap-1" onClick={() => insertVariable(key)}>
                        <Plus size={9} />{`{{${key}}}`}
                      </Button>
                    ))}
                  </div>
                )}
                <Textarea rows={14} className="font-mono text-xs" dir="ltr" value={form.body_html} onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))} />
              </TabsContent>

              <TabsContent value="text" className="mt-2 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">المحتوى (نص عادي)</Label>
                  <Textarea rows={6} className="text-sm" dir={form.lang === "ar" ? "rtl" : "ltr"} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نسخة نصية بديلة</Label>
                  <Textarea rows={4} className="text-sm" dir={form.lang === "ar" ? "rtl" : "ltr"} value={form.body_text} onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} />
                </div>
              </TabsContent>

              <TabsContent value="schema" className="mt-2">
                {Object.keys(currentSchema).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">لا توجد متغيرات معرّفة لهذا القالب</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">عدّل القيم التجريبية للمعاينة:</p>
                    {Object.entries(currentSchema).map(([key, meta]) => (
                      <div key={key} className="grid grid-cols-3 gap-2 items-center">
                        <Badge variant="outline" className="text-[10px] font-mono justify-center">{`{{${key}}}`}</Badge>
                        <span className="text-xs text-muted-foreground">{meta.label_ar}</span>
                        <Input
                          className="h-7 text-xs"
                          dir="auto"
                          value={varOverrides[key] ?? meta.example}
                          onChange={e => setVarOverrides(v => ({ ...v, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="preview" className="mt-2">
                <div className="border rounded-lg overflow-hidden bg-muted/20">
                  <div className="p-2 border-b flex items-center gap-2 bg-card">
                    <Globe size={13} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {form.lang === "ar" ? "RTL — العربية" : "LTR — English"}
                    </span>
                    {form.subject && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="text-[10px] text-foreground truncate max-w-[300px]">
                          {replaceVars(form.subject, previewVars, currentSchema)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="p-4 flex justify-center bg-muted/30">
                    <div
                      className="bg-background shadow-sm"
                      style={{ width: previewMode === "mobile" ? 375 : 600, minHeight: 300, borderRadius: 8, overflow: "hidden" }}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(form.body_html
                          ? replaceVars(form.body_html, previewVars, currentSchema)
                          : `<div style="padding:24px;font-size:14px;direction:${form.lang === "ar" ? "rtl" : "ltr"}">${replaceVars(form.body, previewVars, currentSchema)}</div>`),
                      }}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="gap-2 flex-wrap border-t pt-4">
            {editing && (
              <Button variant="outline" className="gap-1.5 min-h-[44px]" onClick={() => { setTestEmail(""); setTestDialogOpen(true); }}>
                <Send size={14} />
                إرسال تجريبي
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 min-h-[44px]">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {editing ? "حفظ التعديلات" : "إنشاء القالب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send size={16} />
              إرسال بريد تجريبي
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input type="email" dir="ltr" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" />
            </div>
            <p className="text-[10px] text-muted-foreground">سيتم إرسال القالب بالقيم التجريبية.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleTestSend} disabled={testing || !testEmail} className="w-full min-h-[44px] gap-1.5">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTemplateStudio;
