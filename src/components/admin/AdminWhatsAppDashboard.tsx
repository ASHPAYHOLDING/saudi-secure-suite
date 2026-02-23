import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Search, RefreshCw, CheckCircle, XCircle,
  Clock, Eye, AlertTriangle, Shield, Phone, Globe, Settings, BarChart3,
  Loader2, Send, ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface MessageLog {
  id: string;
  tenant_id: string;
  to_phone: string;
  provider_message_id: string | null;
  template_key: string;
  template_name: string | null;
  language_code: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
}

interface PlatformConfig {
  id: string;
  provider: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  business_name: string;
  is_active: boolean;
}

const statusConfig: Record<string, { icon: any; label: string; color: string }> = {
  queued: { icon: Clock, label: "في الانتظار", color: "bg-muted text-muted-foreground" },
  sent: { icon: Send, label: "مُرسل", color: "bg-primary/10 text-primary" },
  delivered: { icon: CheckCircle, label: "تم التسليم", color: "bg-emerald-500/10 text-emerald-600" },
  read: { icon: Eye, label: "مقروء", color: "bg-blue-500/10 text-blue-600" },
  failed: { icon: XCircle, label: "فشل", color: "bg-destructive/10 text-destructive" },
};

const AdminWhatsAppDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, read: 0, failed: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState("monitoring");

  // Config form state
  const [configForm, setConfigForm] = useState({
    provider: "meta_cloud",
    waba_id: "",
    phone_number_id: "",
    display_phone_number: "",
    business_name: "Numaxio",
    access_token: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, configRes] = await Promise.all([
        supabase.from("whatsapp_message_log").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("platform_whatsapp_config").select("id, provider, waba_id, phone_number_id, display_phone_number, business_name, is_active").limit(1).maybeSingle(),
      ]);

      if (logsRes.data) {
        setMessages(logsRes.data as any);
        const s = { sent: 0, delivered: 0, read: 0, failed: 0, total: logsRes.data.length };
        for (const m of logsRes.data) {
          const st = (m as any).status;
          if (st === "sent") s.sent++;
          else if (st === "delivered") s.delivered++;
          else if (st === "read") s.read++;
          else if (st === "failed") s.failed++;
        }
        setStats(s);
      }

      if (configRes.data) {
        setPlatformConfig(configRes.data as any);
        setConfigForm(prev => ({
          ...prev,
          provider: configRes.data.provider || "meta_cloud",
          waba_id: configRes.data.waba_id || "",
          phone_number_id: configRes.data.phone_number_id || "",
          display_phone_number: configRes.data.display_phone_number || "",
          business_name: configRes.data.business_name || "Numaxio",
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel("wa-msg-log-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_message_log" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let result = messages;
    if (statusFilter !== "all") result = result.filter(m => m.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.to_phone.includes(q) || m.template_key.toLowerCase().includes(q) ||
        (m.template_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [messages, statusFilter, searchQuery]);

  const deliveryRate = stats.total > 0 ? Math.round(((stats.delivered + stats.read) / stats.total) * 100) : 0;
  const readRate = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare size={24} className="text-emerald-600" />
            مركز واتساب
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            مراقبة القناة الرسمية وإعدادات المنصة
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الرسائل", value: stats.total, icon: MessageSquare, color: "text-foreground" },
          { label: "مُرسل", value: stats.sent, icon: Send, color: "text-primary" },
          { label: "تم التسليم", value: stats.delivered, icon: CheckCircle, color: "text-emerald-600" },
          { label: "مقروء", value: stats.read, icon: Eye, color: "text-blue-600" },
          { label: "فشل", value: stats.failed, icon: XCircle, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/50`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivery rates */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">معدل التسليم</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-foreground">{deliveryRate}%</p>
              <CheckCircle size={20} className="text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">معدل القراءة</p>
            <div className="flex items-center gap-2">
              <p className="text-3xl font-bold text-foreground">{readRate}%</p>
              <Eye size={20} className="text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="monitoring" className="gap-1.5">
            <BarChart3 size={14} /> سجل الرسائل
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings size={14} /> إعدادات المنصة
          </TabsTrigger>
        </TabsList>

        {/* ── Monitoring Tab ── */}
        <TabsContent value="monitoring" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">الكل</SelectItem>
                <SelectItem value="sent" className="text-xs">مُرسل</SelectItem>
                <SelectItem value="delivered" className="text-xs">تم التسليم</SelectItem>
                <SelectItem value="read" className="text-xs">مقروء</SelectItem>
                <SelectItem value="failed" className="text-xs">فشل</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                placeholder="بحث بالهاتف أو القالب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-8 h-8 text-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare size={32} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد رسائل</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {filtered.map(m => {
                  const sc = statusConfig[m.status] || statusConfig.queued;
                  const Icon = sc.icon;
                  return (
                    <Card key={m.id} className="overflow-hidden">
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sc.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground font-mono" dir="ltr">
                              {m.to_phone}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {m.template_key}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {m.language_code}
                            </Badge>
                          </div>
                          {m.error_message && (
                            <p className="text-xs text-destructive mt-1 truncate">{m.error_message}</p>
                          )}
                          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>{format(new Date(m.created_at), "dd/MM HH:mm", { locale: ar })}</span>
                            {m.delivered_at && <span className="text-emerald-600">✓ تسليم {format(new Date(m.delivered_at), "HH:mm")}</span>}
                            {m.read_at && <span className="text-blue-600">✓ قراءة {format(new Date(m.read_at), "HH:mm")}</span>}
                          </div>
                        </div>
                        <Badge className={`${sc.color} border-0 text-[10px] shrink-0`}>{sc.label}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ── Config Tab ── */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe size={18} />
                إعدادات القناة الرسمية (Option A)
              </CardTitle>
              <CardDescription>
                إعدادات رقم واتساب المنصة الرسمي — يُستخدم كقناة افتراضية لجميع الشركات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {platformConfig ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={platformConfig.is_active ? "default" : "secondary"}>
                      {platformConfig.is_active ? "مفعّل" : "معطّل"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      المزود: {platformConfig.provider === "meta_cloud" ? "Meta Cloud API" : platformConfig.provider}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">WABA ID</p>
                      <p className="font-mono text-foreground">{platformConfig.waba_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Phone Number ID</p>
                      <p className="font-mono text-foreground">{platformConfig.phone_number_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">الرقم</p>
                      <p className="font-mono text-foreground" dir="ltr">{platformConfig.display_phone_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">اسم النشاط</p>
                      <p className="text-foreground">{platformConfig.business_name}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <Shield size={32} className="mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    لم يتم إعداد قناة واتساب الرسمية بعد
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    لتفعيل إرسال واتساب عبر المنصة، يرجى إضافة بيانات Meta WhatsApp Business API
                    من لوحة الإعدادات المتقدمة.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance info */}
          <Card className="border-amber-200/50 bg-amber-50/30 dark:bg-amber-900/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">متطلبات الامتثال</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>• يجب الحصول على موافقة المستلم (Opt-in) قبل الإرسال</li>
                    <li>• يجب استخدام قوالب معتمدة فقط (Templates)</li>
                    <li>• يجب توفير آلية إلغاء الاشتراك (Opt-out)</li>
                    <li>• يُحظر إرسال رسائل تسويقية بدون موافقة صريحة</li>
                    <li>• يتم تسجيل كل عملية إرسال في سجل المراجعة</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminWhatsAppDashboard;
