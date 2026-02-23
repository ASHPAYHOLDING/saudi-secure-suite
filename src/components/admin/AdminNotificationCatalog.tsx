import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Bell, Mail, MessageSquare, Loader2, CheckCircle2, XCircle,
  AlertTriangle, FileText, Plus, Eye, Edit, Receipt, UserCheck, Lock, Heart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NotifEvent {
  key: string;
  name_ar: string;
  name_en: string;
  category: string;
  severity: string;
  is_active: boolean;
  allowed_channels: string[];
  default_channels: string[];
  default_email_mode: string;
  description_ar: string | null;
  description_en: string | null;
}

interface Template {
  id: string;
  event_key: string;
  channel: string;
  lang: string;
  subject: string | null;
  body: string;
  is_platform_default: boolean;
  is_active: boolean;
  version: number;
}

const CATEGORIES = [
  { key: "billing", icon: Receipt, label: "الفوترة" },
  { key: "approvals", icon: UserCheck, label: "الموافقات" },
  { key: "security", icon: Lock, label: "الأمان" },
  { key: "hr", icon: Heart, label: "الموارد البشرية" },
];

const AdminNotificationCatalog = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState("catalog");
  const [events, setEvents] = useState<NotifEvent[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState({ subject: "", body: "", lang: "ar", channel: "in_app", event_key: "" });
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, tmplRes] = await Promise.all([
        supabase.from("notification_events").select("*").order("category").order("key"),
        supabase.from("notification_event_templates").select("*").eq("is_platform_default", true).order("event_key").order("channel").order("lang"),
      ]);
      setEvents((evRes.data || []) as NotifEvent[]);
      setTemplates((tmplRes.data || []) as Template[]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleEventActive = async (key: string, isActive: boolean) => {
    const { error } = await supabase.from("notification_events").update({ is_active: isActive }).eq("key", key);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم التحديث" });
      loadData();
    }
  };

  const openEditTemplate = (tmpl?: Template) => {
    if (tmpl) {
      setEditingTemplate(tmpl);
      setEditForm({ subject: tmpl.subject || "", body: tmpl.body, lang: tmpl.lang, channel: tmpl.channel, event_key: tmpl.event_key });
    } else {
      setEditingTemplate(null);
      setEditForm({ subject: "", body: "", lang: "ar", channel: "in_app", event_key: events[0]?.key || "" });
    }
    setDialogOpen(true);
  };

  const saveTemplate = async () => {
    if (!editForm.body.trim() || !editForm.event_key) {
      toast({ title: "يرجى ملء جميع الحقول", variant: "destructive" });
      return;
    }
    if (editingTemplate) {
      const { error } = await supabase.from("notification_event_templates").update({
        subject: editForm.subject || null,
        body: editForm.body,
      }).eq("id", editingTemplate.id);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("notification_event_templates").insert({
        event_key: editForm.event_key,
        channel: editForm.channel,
        lang: editForm.lang,
        subject: editForm.subject || null,
        body: editForm.body,
        is_platform_default: true,
        is_active: true,
      });
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "تم الحفظ" });
    setDialogOpen(false);
    loadData();
  };

  // Health check: events missing templates
  const healthIssues = events.filter((e) => e.is_active).filter((e) => {
    const eventTemplates = templates.filter((t) => t.event_key === e.key && t.is_active);
    return eventTemplates.length === 0;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell size={22} />
          إدارة كتالوج الإشعارات
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة أحداث النظام والقوالب الافتراضية للمنصة.
        </p>
      </div>

      {/* Health panel */}
      {healthIssues.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                {healthIssues.length} حدث/أحداث بدون قوالب
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {healthIssues.map((e) => (
                <Badge key={e.key} variant="outline" className="text-[10px] border-destructive/30">
                  {e.name_ar} ({e.key})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="catalog" className="gap-1.5 min-h-[44px]">
            <Bell size={14} /> الكتالوج
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 min-h-[44px]">
            <FileText size={14} /> القوالب
          </TabsTrigger>
        </TabsList>

        {/* ── Catalog Tab ── */}
        <TabsContent value="catalog" className="mt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start text-xs">الحدث</TableHead>
                  <TableHead className="text-start text-xs">الفئة</TableHead>
                  <TableHead className="text-start text-xs">الأهمية</TableHead>
                  <TableHead className="text-start text-xs">القنوات المسموحة</TableHead>
                  <TableHead className="text-start text-xs">القنوات الافتراضية</TableHead>
                  <TableHead className="text-start text-xs">القوالب</TableHead>
                  <TableHead className="text-start text-xs">مفعّل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => {
                  const tmplCount = templates.filter((t) => t.event_key === e.key && t.is_active).length;
                  const catInfo = CATEGORIES.find((c) => c.key === e.category);
                  return (
                    <TableRow key={e.key}>
                      <TableCell>
                        <div>
                          <p className="text-xs font-medium">{e.name_ar}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{e.key}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {catInfo && <catInfo.icon size={12} />}
                          <span className="text-xs">{catInfo?.label || e.category}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.severity === "critical" ? "destructive" : e.severity === "warn" ? "outline" : "secondary"} className="text-[10px]">
                          {e.severity === "critical" ? "حرج" : e.severity === "warn" ? "تحذير" : "عادي"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(e.allowed_channels || []).map((ch) => (
                            <Badge key={ch} variant="outline" className="text-[10px]">{ch}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(e.default_channels || []).map((ch) => (
                            <Badge key={ch} variant="secondary" className="text-[10px]">{ch}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tmplCount > 0 ? "outline" : "destructive"} className="text-[10px]">
                          {tmplCount > 0 ? `${tmplCount} قالب` : "لا يوجد"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={e.is_active}
                          onCheckedChange={(v) => toggleEventActive(e.key, v)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Templates Tab ── */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">القوالب الافتراضية للمنصة (AR/EN)</p>
            <Button size="sm" className="min-h-[44px] gap-1.5" onClick={() => openEditTemplate()}>
              <Plus size={14} />
              إضافة قالب
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start text-xs">الحدث</TableHead>
                  <TableHead className="text-start text-xs">القناة</TableHead>
                  <TableHead className="text-start text-xs">اللغة</TableHead>
                  <TableHead className="text-start text-xs">الموضوع</TableHead>
                  <TableHead className="text-start text-xs">المحتوى</TableHead>
                  <TableHead className="text-start text-xs">الإصدار</TableHead>
                  <TableHead className="text-start text-xs">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs font-mono">{t.event_key}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{t.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{t.lang.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{t.subject || "—"}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{t.body}</TableCell>
                    <TableCell className="text-xs">v{t.version}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditTemplate(t)}>
                        <Edit size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit/Create Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "تعديل القالب" : "إضافة قالب جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingTemplate && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">الحدث</Label>
                  <Select value={editForm.event_key} onValueChange={(v) => setEditForm((p) => ({ ...p, event_key: v }))}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.key} value={e.key} className="text-xs">{e.name_ar} ({e.key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">القناة</Label>
                    <Select value={editForm.channel} onValueChange={(v) => setEditForm((p) => ({ ...p, channel: v }))}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_app" className="text-xs">داخلي</SelectItem>
                        <SelectItem value="email" className="text-xs">بريد</SelectItem>
                        <SelectItem value="whatsapp" className="text-xs">واتساب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">اللغة</Label>
                    <Select value={editForm.lang} onValueChange={(v) => setEditForm((p) => ({ ...p, lang: v }))}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar" className="text-xs">العربية</SelectItem>
                        <SelectItem value="en" className="text-xs">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label className="text-xs">الموضوع (اختياري)</Label>
              <Input
                value={editForm.subject}
                onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                className="text-xs"
                placeholder="موضوع البريد..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المحتوى</Label>
              <Textarea
                value={editForm.body}
                onChange={(e) => setEditForm((p) => ({ ...p, body: e.target.value }))}
                className="text-xs min-h-[120px] font-mono"
                dir="auto"
                placeholder="استخدم {{variable}} للمتغيرات..."
              />
              <p className="text-[10px] text-muted-foreground">
                المتغيرات المتاحة: {"{{invoice_number}}, {{amount}}, {{currency}}, {{due_date}}, {{recipient_name}}, {{company_name}}, {{otp_code}}"}
              </p>
            </div>
            <Button className="w-full min-h-[44px]" onClick={saveTemplate}>
              {editingTemplate ? "تحديث القالب" : "إنشاء القالب"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminNotificationCatalog;
