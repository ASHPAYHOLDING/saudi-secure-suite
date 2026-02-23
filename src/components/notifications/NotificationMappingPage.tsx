import { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bell, MessageSquare, Mail, Loader2, Shield, AlertTriangle,
  FileText, Receipt, UserCheck, Lock, Heart, Eye,
  CheckCircle2, XCircle, Search, Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";

// ── Types ──
interface NotificationEvent {
  key: string;
  name_ar: string;
  name_en: string;
  category: string;
  severity: string;
  description_ar: string | null;
  description_en: string | null;
  allowed_channels: string[];
  default_channels: string[];
  default_email_mode: string;
  enabled: boolean;
  channels: string[];
  email_mode: string;
  audience: string;
  custom_recipients: any;
  has_override: boolean;
}

interface OutboxEntry {
  id: string;
  event_key: string;
  channel: string;
  email_mode: string | null;
  recipient: any;
  payload: any;
  status: string;
  error: string | null;
  created_at: string;
}

const CATEGORIES = [
  { key: "billing", icon: Receipt, labelAr: "الفوترة", labelEn: "Billing" },
  { key: "approvals", icon: UserCheck, labelAr: "الموافقات", labelEn: "Approvals" },
  { key: "security", icon: Lock, labelAr: "الأمان", labelEn: "Security" },
  { key: "hr", icon: Heart, labelAr: "الموارد البشرية", labelEn: "HR" },
];

const CHANNEL_MAP: Record<string, { icon: typeof Bell; labelAr: string; labelEn: string; color: string }> = {
  in_app: { icon: Bell, labelAr: "داخلي", labelEn: "In-App", color: "text-foreground" },
  email: { icon: Mail, labelAr: "بريد", labelEn: "Email", color: "text-blue-600" },
  whatsapp: { icon: MessageSquare, labelAr: "واتساب", labelEn: "WhatsApp", color: "text-green-600" },
};

const AUDIENCE_OPTIONS = [
  { value: "owner_only", labelAr: "المالك فقط", labelEn: "Owner Only" },
  { value: "admins", labelAr: "المدراء", labelEn: "Admins" },
  { value: "finance", labelAr: "المالية", labelEn: "Finance" },
  { value: "hr", labelAr: "الموارد البشرية", labelEn: "HR" },
  { value: "custom", labelAr: "مخصص", labelEn: "Custom" },
];

const EMAIL_MODE_OPTIONS = [
  { value: "platform", labelAr: "منصة", labelEn: "Platform" },
  { value: "tenant_smtp", labelAr: "SMTP المنشأة", labelEn: "Company SMTP" },
];

const NotificationMappingPage = () => {
  const { tenantId, userRole } = useAuth();
  const { toast } = useToast();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";

  const [activeCategory, setActiveCategory] = useState("billing");
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState({ status: "all", channel: "all", search: "" });

  const canEdit = userRole === "owner" || userRole === "admin";

  const loadEvents = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_notification_events_for_tenant", {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      setEvents(Array.isArray(data) ? (data as unknown as NotificationEvent[]) : []);
    } catch (e: any) {
      console.error("Load events error:", e);
    }
    setLoading(false);
  }, [tenantId]);

  const loadOutbox = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase
        .from("notification_event_outbox")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      setOutbox((data || []) as OutboxEntry[]);
    } catch (e) {
      console.error("Load outbox error:", e);
    }
  }, [tenantId]);

  useEffect(() => {
    loadEvents();
    loadOutbox();
  }, [loadEvents, loadOutbox]);

  const categoryEvents = useMemo(
    () => events.filter((e) => e.category === activeCategory),
    [events, activeCategory]
  );

  const handleToggleEnabled = async (eventKey: string, enabled: boolean) => {
    if (!tenantId || !canEdit) return;
    setSaving(eventKey);
    try {
      const { error } = await supabase.from("tenant_notification_preferences").upsert(
        { tenant_id: tenantId, event_key: eventKey, enabled, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,event_key" }
      );
      if (error) throw error;
      toast({ title: isAr ? "تم التحديث" : "Updated" });
      loadEvents();
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleUpdateChannels = async (eventKey: string, channels: string[]) => {
    if (!tenantId || !canEdit) return;
    setSaving(eventKey);
    try {
      const { error } = await supabase.from("tenant_notification_preferences").upsert(
        { tenant_id: tenantId, event_key: eventKey, channels, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,event_key" }
      );
      if (error) throw error;
      loadEvents();
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleUpdateEmailMode = async (eventKey: string, emailMode: string) => {
    if (!tenantId || !canEdit) return;
    setSaving(eventKey);
    try {
      const { error } = await supabase.from("tenant_notification_preferences").upsert(
        { tenant_id: tenantId, event_key: eventKey, email_mode: emailMode, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,event_key" }
      );
      if (error) throw error;
      loadEvents();
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleUpdateAudience = async (eventKey: string, audience: string) => {
    if (!tenantId || !canEdit) return;
    setSaving(eventKey);
    try {
      const { error } = await supabase.from("tenant_notification_preferences").upsert(
        { tenant_id: tenantId, event_key: eventKey, audience, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,event_key" }
      );
      if (error) throw error;
      loadEvents();
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const toggleChannel = (event: NotificationEvent, ch: string) => {
    const current = event.channels || [];
    const next = current.includes(ch) ? current.filter((c) => c !== ch) : [...current, ch];
    handleUpdateChannels(event.key, next);
  };

  const getSeverityBadge = (severity: string) => {
    const map: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      info: { variant: "secondary", label: isAr ? "عادي" : "Info" },
      warn: { variant: "outline", label: isAr ? "تحذير" : "Warning" },
      critical: { variant: "destructive", label: isAr ? "حرج" : "Critical" },
    };
    const s = map[severity] || { variant: "secondary" as const, label: severity };
    return <Badge variant={s.variant} className="text-[10px] px-1.5">{s.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      sent: { variant: "outline", label: isAr ? "تم الإرسال" : "Sent" },
      failed: { variant: "destructive", label: isAr ? "فشل" : "Failed" },
      skipped: { variant: "secondary", label: isAr ? "تم تخطيه" : "Skipped" },
      queued: { variant: "default", label: isAr ? "في الانتظار" : "Queued" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
  };

  // Permission guard — read-only for non-editors
  if (!canEdit) {
    // Read-only mode for non-editors is handled inline
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredLogs = outbox.filter((o) => {
    if (logFilter.status !== "all" && o.status !== logFilter.status) return false;
    if (logFilter.channel !== "all" && o.channel !== logFilter.channel) return false;
    if (logFilter.search && !o.event_key.includes(logFilter.search)) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell size={22} />
          {isAr ? "خريطة الإشعارات" : "Notification Mapping"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "تحكم في أي إشعار يُرسل عبر أي قناة ولمن."
            : "Control which notifications are sent via which channels and to whom."}
        </p>
        {!canEdit && (
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Eye size={14} />
            {isAr ? "وضع القراءة فقط — تواصل مع المالك لتعديل الإعدادات." : "Read-only mode — contact owner to change settings."}
          </div>
        )}
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} dir={isAr ? "rtl" : "ltr"}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = events.filter((e) => e.category === cat.key).length;
            return (
              <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 min-h-[44px]">
                <Icon size={14} />
                {isAr ? cat.labelAr : cat.labelEn}
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="logs" className="gap-1.5 min-h-[44px]">
            <FileText size={14} />
            {isAr ? "السجل" : "Logs"}
          </TabsTrigger>
        </TabsList>

        {/* ── Category Event Tabs ── */}
        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.key} value={cat.key} className="space-y-3 mt-4">
            {categoryEvents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell size={32} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {isAr ? "لا توجد أحداث في هذه الفئة." : "No events in this category."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              categoryEvents.map((event) => (
                <Card key={event.key} className={!event.enabled ? "opacity-60" : ""}>
                  <CardContent className="py-4 space-y-3">
                    {/* Row 1: Title + Enable toggle */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">
                            {isAr ? event.name_ar : event.name_en}
                          </p>
                          {getSeverityBadge(event.severity)}
                          {event.has_override && (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                              {isAr ? "مخصص" : "Customized"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isAr ? event.description_ar : event.description_en}
                        </p>
                      </div>
                      <Switch
                        checked={event.enabled}
                        disabled={!canEdit || saving === event.key}
                        onCheckedChange={(v) => handleToggleEnabled(event.key, v)}
                      />
                    </div>

                    {event.enabled && (
                      <>
                        {/* Row 2: Channel chips */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground min-w-fit">
                            {isAr ? "القنوات:" : "Channels:"}
                          </span>
                          {Object.entries(CHANNEL_MAP).map(([ch, info]) => {
                            const Icon = info.icon;
                            const isAllowed = event.allowed_channels.includes(ch);
                            const isActive = event.channels.includes(ch);
                            return (
                              <button
                                key={ch}
                                disabled={!canEdit || !isAllowed || saving === event.key}
                                onClick={() => toggleChannel(event, ch)}
                                className={`
                                  inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                                  border transition-all min-h-[32px]
                                  ${isActive
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-muted/30 border-border text-muted-foreground"}
                                  ${!isAllowed ? "opacity-40 cursor-not-allowed" : canEdit ? "hover:bg-primary/5 cursor-pointer" : "cursor-default"}
                                `}
                              >
                                <Icon size={12} className={isActive ? info.color : ""} />
                                {isAr ? info.labelAr : info.labelEn}
                                {isActive && <CheckCircle2 size={10} />}
                                {!isAllowed && <Lock size={10} />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Row 3: Email mode + Audience */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {event.channels.includes("email") && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{isAr ? "وضع البريد:" : "Email mode:"}</span>
                              <Select
                                value={event.email_mode}
                                onValueChange={(v) => handleUpdateEmailMode(event.key, v)}
                                disabled={!canEdit || saving === event.key}
                              >
                                <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EMAIL_MODE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value} className="text-xs">
                                      {isAr ? o.labelAr : o.labelEn}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{isAr ? "الجمهور:" : "Audience:"}</span>
                            <Select
                              value={event.audience}
                              onValueChange={(v) => handleUpdateAudience(event.key, v)}
                              disabled={!canEdit || saving === event.key}
                            >
                              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AUDIENCE_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value} className="text-xs">
                                    {isAr ? o.labelAr : o.labelEn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}

        {/* ── Logs Tab ── */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} />
                {isAr ? "سجل الإشعارات" : "Notification Logs"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Filter size={14} className="text-muted-foreground" />
                  <Select value={logFilter.status} onValueChange={(v) => setLogFilter((p) => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">{isAr ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="sent" className="text-xs">{isAr ? "تم الإرسال" : "Sent"}</SelectItem>
                      <SelectItem value="failed" className="text-xs">{isAr ? "فشل" : "Failed"}</SelectItem>
                      <SelectItem value="queued" className="text-xs">{isAr ? "في الانتظار" : "Queued"}</SelectItem>
                      <SelectItem value="skipped" className="text-xs">{isAr ? "تم تخطيه" : "Skipped"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={logFilter.channel} onValueChange={(v) => setLogFilter((p) => ({ ...p, channel: v }))}>
                  <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">{isAr ? "كل القنوات" : "All Channels"}</SelectItem>
                    <SelectItem value="in_app" className="text-xs">{isAr ? "داخلي" : "In-App"}</SelectItem>
                    <SelectItem value="email" className="text-xs">{isAr ? "بريد" : "Email"}</SelectItem>
                    <SelectItem value="whatsapp" className="text-xs">{isAr ? "واتساب" : "WhatsApp"}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[150px]">
                  <Search size={14} className="absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={logFilter.search}
                    onChange={(e) => setLogFilter((p) => ({ ...p, search: e.target.value }))}
                    placeholder={isAr ? "بحث بالحدث..." : "Search event..."}
                    className="h-8 ps-7 text-xs"
                  />
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {isAr ? "لا توجد سجلات." : "No logs found."}
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start text-xs">{isAr ? "الحدث" : "Event"}</TableHead>
                        <TableHead className="text-start text-xs">{isAr ? "القناة" : "Channel"}</TableHead>
                        <TableHead className="text-start text-xs">{isAr ? "الحالة" : "Status"}</TableHead>
                        <TableHead className="text-start text-xs">{isAr ? "الخطأ" : "Error"}</TableHead>
                        <TableHead className="text-start text-xs">{isAr ? "التاريخ" : "Date"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs font-mono">{log.event_key}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              {CHANNEL_MAP[log.channel] && (() => {
                                const Icon = CHANNEL_MAP[log.channel].icon;
                                return <Icon size={12} className={CHANNEL_MAP[log.channel].color} />;
                              })()}
                              {isAr ? CHANNEL_MAP[log.channel]?.labelAr : CHANNEL_MAP[log.channel]?.labelEn || log.channel}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                            {log.error || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground" dir="ltr">
                            {new Date(log.created_at).toLocaleString(isAr ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationMappingPage;
