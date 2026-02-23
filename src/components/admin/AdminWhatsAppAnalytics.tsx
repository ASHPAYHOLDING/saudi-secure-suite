import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Search, RefreshCw, CheckCircle, XCircle,
  Clock, Eye, Send, Loader2, AlertTriangle, Phone,
  Calendar, Filter, BarChart3, ArrowUpDown, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface MessageLog {
  id: string;
  tenant_id: string;
  to_phone: string;
  provider_message_id: string | null;
  template_key: string;
  template_name: string | null;
  language_code: string;
  event_key: string | null;
  recipient_type: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  buttons_payload: any;
  provider_status_payload: any;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
}

interface StatusHistory {
  id: string;
  status: string;
  occurred_at: string;
  provider_payload: any;
}

const STATUS_CONFIG: Record<string, { icon: any; labelAr: string; labelEn: string; color: string }> = {
  queued: { icon: Clock, labelAr: "في الانتظار", labelEn: "Queued", color: "bg-muted text-muted-foreground" },
  sent: { icon: Send, labelAr: "مُرسل", labelEn: "Sent", color: "bg-primary/10 text-primary" },
  delivered: { icon: CheckCircle, labelAr: "تم التسليم", labelEn: "Delivered", color: "bg-emerald-500/10 text-emerald-600" },
  read: { icon: Eye, labelAr: "مقروء", labelEn: "Read", color: "bg-blue-500/10 text-blue-600" },
  failed: { icon: XCircle, labelAr: "فشل", labelEn: "Failed", color: "bg-destructive/10 text-destructive" },
};

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  const prefix = phone.startsWith("+") ? phone.slice(0, 4) : phone.slice(0, 3);
  const suffix = phone.slice(-4);
  return `${prefix}****${suffix}`;
}

const AdminWhatsAppAnalytics = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const locale = isRTL ? ar : enUS;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Drawer state
  const [selectedMessage, setSelectedMessage] = useState<MessageLog | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("whatsapp_message_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      setMessages((data as any[]) || []);
    } catch (err: any) {
      console.error(err);
      toast({ title: isRTL ? "خطأ في تحميل البيانات" : "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, toast, isRTL]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("wa-analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_message_log" }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchMessages]);

  // Load status history for drawer
  const openDrawer = async (msg: MessageLog) => {
    setSelectedMessage(msg);
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("notification_message_status_history")
        .select("*")
        .eq("message_id", msg.id)
        .order("occurred_at", { ascending: true });
      setStatusHistory((data as any[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filters
  const filtered = useMemo(() => {
    let result = messages;
    if (statusFilter !== "all") result = result.filter(m => m.status === statusFilter);
    if (eventFilter !== "all") result = result.filter(m => m.event_key === eventFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.to_phone.includes(q) ||
        m.template_key.toLowerCase().includes(q) ||
        (m.template_name || "").toLowerCase().includes(q) ||
        (m.event_key || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [messages, statusFilter, eventFilter, searchQuery]);

  // KPIs
  const stats = useMemo(() => {
    const s = { total: messages.length, sent: 0, delivered: 0, read: 0, failed: 0 };
    for (const m of messages) {
      if (m.status === "sent") s.sent++;
      else if (m.status === "delivered") s.delivered++;
      else if (m.status === "read") s.read++;
      else if (m.status === "failed") s.failed++;
    }
    return s;
  }, [messages]);

  const deliveryRate = stats.total > 0 ? Math.round(((stats.delivered + stats.read) / stats.total) * 100) : 0;
  const readRate = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;
  const failureRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;

  // Unique event keys for filter
  const eventKeys = useMemo(() => {
    const keys = new Set<string>();
    messages.forEach(m => { if (m.event_key) keys.add(m.event_key); });
    return Array.from(keys);
  }, [messages]);

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={24} className="text-emerald-600" />
            {isRTL ? "تحليلات واتساب" : "WhatsApp Analytics"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "مراقبة تسليم الرسائل وتحليلات الأداء" : "Message delivery monitoring and performance analytics"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMessages} disabled={loading} className="gap-1.5">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {isRTL ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { labelAr: "إجمالي", labelEn: "Total", value: stats.total, icon: MessageSquare, color: "text-foreground" },
          { labelAr: "مُرسل", labelEn: "Sent", value: stats.sent, icon: Send, color: "text-primary" },
          { labelAr: "تم التسليم", labelEn: "Delivered", value: stats.delivered, icon: CheckCircle, color: "text-emerald-600" },
          { labelAr: "مقروء", labelEn: "Read", value: stats.read, icon: Eye, color: "text-blue-600" },
          { labelAr: "فشل", labelEn: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive" },
          { labelAr: "معدل القراءة", labelEn: "Read Rate", value: `${readRate}%`, icon: Eye, color: "text-blue-600" },
          { labelAr: "معدل الفشل", labelEn: "Failure Rate", value: `${failureRate}%`, icon: AlertTriangle, color: "text-destructive" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-muted/50">
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{isRTL ? s.labelAr : s.labelEn}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={14} className="text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder={isRTL ? "الحالة" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{isRTL ? "الكل" : "All"}</SelectItem>
                <SelectItem value="queued" className="text-xs">{isRTL ? "في الانتظار" : "Queued"}</SelectItem>
                <SelectItem value="sent" className="text-xs">{isRTL ? "مُرسل" : "Sent"}</SelectItem>
                <SelectItem value="delivered" className="text-xs">{isRTL ? "تم التسليم" : "Delivered"}</SelectItem>
                <SelectItem value="read" className="text-xs">{isRTL ? "مقروء" : "Read"}</SelectItem>
                <SelectItem value="failed" className="text-xs">{isRTL ? "فشل" : "Failed"}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder={isRTL ? "نوع الحدث" : "Event Type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{isRTL ? "كل الأحداث" : "All Events"}</SelectItem>
                {eventKeys.map(ek => (
                  <SelectItem key={ek} value={ek} className="text-xs">{ek}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-32 h-8 text-xs"
              placeholder={isRTL ? "من" : "From"}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-32 h-8 text-xs"
              placeholder={isRTL ? "إلى" : "To"}
            />

            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                placeholder={isRTL ? "بحث بالهاتف أو القالب..." : "Search phone or template..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="ps-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare size={16} />
            {isRTL ? `آخر ${filtered.length} رسالة` : `Last ${filtered.length} messages`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد رسائل" : "No messages"}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "المستلم" : "Recipient"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "الحدث" : "Event"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "القالب" : "Template"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "اللغة" : "Lang"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "الأزرار" : "Buttons"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "تاريخ الإنشاء" : "Created"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "تم التسليم" : "Delivered"}</TableHead>
                    <TableHead className="text-xs">{isRTL ? "القراءة" : "Read"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(m => {
                    const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.queued;
                    const Icon = sc.icon;
                    return (
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-muted/60"
                        onClick={() => openDrawer(m)}
                      >
                        <TableCell>
                          <Badge className={`${sc.color} border-0 text-[10px] gap-1`}>
                            <Icon size={10} />
                            {isRTL ? sc.labelAr : sc.labelEn}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {maskPhone(m.to_phone)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {m.event_key || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">
                          {m.template_name || m.template_key}
                        </TableCell>
                        <TableCell className="text-xs">{m.language_code}</TableCell>
                        <TableCell>
                          {m.buttons_payload ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-0">
                              CTA
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(m.created_at), "dd/MM HH:mm", { locale })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.delivered_at ? format(new Date(m.delivered_at), "HH:mm", { locale }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.read_at ? format(new Date(m.read_at), "HH:mm", { locale }) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!selectedMessage} onOpenChange={(open) => { if (!open) setSelectedMessage(null); }}>
        <SheetContent side={isRTL ? "left" : "right"} className="w-full sm:max-w-lg overflow-y-auto">
          {selectedMessage && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Phone size={18} />
                  {isRTL ? "تفاصيل الرسالة" : "Message Details"}
                </SheetTitle>
                <SheetDescription>
                  {maskPhone(selectedMessage.to_phone)} — {selectedMessage.template_name || selectedMessage.template_key}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Status badge */}
                {(() => {
                  const sc = STATUS_CONFIG[selectedMessage.status] || STATUS_CONFIG.queued;
                  const Icon = sc.icon;
                  return (
                    <Badge className={`${sc.color} border-0 text-sm gap-1.5 py-1 px-3`}>
                      <Icon size={14} />
                      {isRTL ? sc.labelAr : sc.labelEn}
                    </Badge>
                  );
                })()}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{isRTL ? "الحدث" : "Event"}</p>
                    <p className="font-medium text-foreground">{selectedMessage.event_key || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{isRTL ? "نوع المستلم" : "Recipient Type"}</p>
                    <p className="font-medium text-foreground">{selectedMessage.recipient_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{isRTL ? "اللغة" : "Language"}</p>
                    <p className="font-medium text-foreground">{selectedMessage.language_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Provider ID</p>
                    <p className="font-mono text-foreground text-xs truncate" dir="ltr">
                      {selectedMessage.provider_message_id || "—"}
                    </p>
                  </div>
                </div>

                {/* Timestamps */}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">
                    {isRTL ? "التوقيتات" : "Timestamps"}
                  </p>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { label: isRTL ? "إنشاء" : "Created", ts: selectedMessage.created_at },
                      { label: isRTL ? "إرسال" : "Sent", ts: selectedMessage.sent_at },
                      { label: isRTL ? "تسليم" : "Delivered", ts: selectedMessage.delivered_at },
                      { label: isRTL ? "قراءة" : "Read", ts: selectedMessage.read_at },
                      { label: isRTL ? "فشل" : "Failed", ts: selectedMessage.failed_at },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono text-foreground" dir="ltr">
                          {item.ts ? format(new Date(item.ts), "dd/MM/yyyy HH:mm:ss", { locale }) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {selectedMessage.error_message && (
                  <>
                    <Separator />
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-destructive mb-1">
                        {isRTL ? "خطأ" : "Error"} ({selectedMessage.error_code || "—"})
                      </p>
                      <p className="text-xs text-destructive/80">{selectedMessage.error_message}</p>
                    </div>
                  </>
                )}

                {/* Buttons payload */}
                {selectedMessage.buttons_payload && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">
                        {isRTL ? "الأزرار التفاعلية" : "Interactive Buttons"}
                      </p>
                      <div className="space-y-1">
                        {(Array.isArray(selectedMessage.buttons_payload)
                          ? selectedMessage.buttons_payload
                          : []
                        ).map((btn: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded-md p-2">
                            <Badge variant="outline" className="text-[10px]">{btn.type || "url"}</Badge>
                            <span className="font-medium text-foreground">{btn.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Status History */}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">
                    {isRTL ? "سجل الحالات" : "Status History"}
                  </p>
                  {historyLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : statusHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      {isRTL ? "لا يوجد سجل" : "No history"}
                    </p>
                  ) : (
                    <div className="relative space-y-0">
                      {statusHistory.map((sh, idx) => {
                        const sc = STATUS_CONFIG[sh.status] || STATUS_CONFIG.queued;
                        const Icon = sc.icon;
                        return (
                          <div key={sh.id} className="flex gap-3 pb-3">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${sc.color}`}>
                                <Icon size={12} />
                              </div>
                              {idx < statusHistory.length - 1 && (
                                <div className="w-px flex-1 bg-border mt-1" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">
                                  {isRTL ? sc.labelAr : sc.labelEn}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                                  {format(new Date(sh.occurred_at), "dd/MM HH:mm:ss")}
                                </span>
                              </div>
                              {sh.provider_payload && (
                                <pre className="text-[10px] text-muted-foreground mt-1 bg-muted/50 rounded p-1.5 overflow-x-auto max-w-full">
                                  {JSON.stringify(sh.provider_payload, null, 1)}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminWhatsAppAnalytics;
