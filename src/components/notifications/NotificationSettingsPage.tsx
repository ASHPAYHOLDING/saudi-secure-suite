import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bell, MessageSquare, Mail, Loader2, CheckCircle2, XCircle, Send,
  Shield, AlertTriangle, Phone, Globe, ArrowLeft, ArrowRight,
  BarChart3, FileText, Zap, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";

// ── Types ──
interface Channel {
  channel: string;
  enabled: boolean;
  is_default: boolean;
}

interface WaAccount {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  business_name: string;
  status: string;
  last_error: string | null;
}

interface OutboxEntry {
  id: string;
  channel: string;
  template_key: string;
  recipient: string;
  status: string;
  error: string | null;
  block_reason: string | null;
  created_at: string;
  sent_at: string | null;
  provider_message_id: string | null;
}

interface RateLimit {
  channel: string;
  daily_limit: number;
  monthly_limit: number;
  daily_count: number;
  monthly_count: number;
}

interface WaTemplate {
  id: string;
  template_key: string;
  language: string;
  whatsapp_template_name: string;
  is_active: boolean;
}

const REQUIRED_TEMPLATES = [
  { key: "invoice_due", labelAr: "تذكير استحقاق الفاتورة", labelEn: "Invoice Due Reminder" },
  { key: "invoice_paid", labelAr: "تم سداد الفاتورة", labelEn: "Invoice Paid" },
  { key: "payment_reminder", labelAr: "تذكير بالدفع", labelEn: "Payment Reminder" },
  { key: "otp", labelAr: "رمز تحقق", labelEn: "OTP Verification" },
  { key: "approval_request", labelAr: "طلب موافقة", labelEn: "Approval Request" },
];

const NotificationSettingsPage = () => {
  const { tenantId, userRole } = useAuth();
  const { toast } = useToast();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const { entitlementsMap } = useEntitlementsContext();

  // Check entitlement for WhatsApp (professional+)
  const whatsappAllowed = entitlementsMap?.paid_integrations?.allowed ?? false;

  const [activeTab, setActiveTab] = useState("channels");
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [waAccount, setWaAccount] = useState<WaAccount | null>(null);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);

  // WhatsApp setup stepper
  const [setupStep, setSetupStep] = useState(0);
  const [setupForm, setSetupForm] = useState({ waba_id: "", phone_number_id: "", access_token: "" });
  const [verifying, setVerifying] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testTemplateName, setTestTemplateName] = useState("hello_world");

  // Log filters
  const [logFilter, setLogFilter] = useState({ status: "all", channel: "all" });

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [channelsRes, waRes, outboxRes, limitsRes, templatesRes] = await Promise.all([
        supabase.from("tenant_notification_channels").select("*").eq("tenant_id", tenantId),
        supabase.from("tenant_whatsapp_accounts").select("waba_id, phone_number_id, display_phone_number, business_name, status, last_error").eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("notification_outbox").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
        supabase.from("notification_rate_limits").select("*").eq("tenant_id", tenantId),
        supabase.from("whatsapp_templates").select("*").eq("tenant_id", tenantId),
      ]);

      setChannels((channelsRes.data || []).map((c: any) => ({ channel: c.channel, enabled: c.enabled, is_default: c.is_default })));
      setWaAccount(waRes.data as WaAccount | null);
      setOutbox((outboxRes.data || []) as OutboxEntry[]);
      setRateLimits((limitsRes.data || []) as RateLimit[]);
      setWaTemplates((templatesRes.data || []) as WaTemplate[]);

      if (waRes.data?.status === "active") {
        setSetupStep(2);
      }
    } catch (e) {
      console.error("Load error:", e);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime outbox updates
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("outbox-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_outbox", filter: `tenant_id=eq.${tenantId}` }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, loadData]);

  const toggleChannel = async (ch: string, enabled: boolean) => {
    if (!tenantId) return;
    await supabase.from("tenant_notification_channels").upsert(
      { tenant_id: tenantId, channel: ch, enabled, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,channel" }
    );
    toast({ title: isAr ? "تم التحديث" : "Updated" });
    loadData();
  };

  const setDefaultChannel = async (ch: string) => {
    if (!tenantId) return;
    // Reset all defaults, then set new
    for (const c of channels) {
      await supabase.from("tenant_notification_channels").upsert(
        { tenant_id: tenantId, channel: c.channel, is_default: c.channel === ch, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,channel" }
      );
    }
    toast({ title: isAr ? "تم تعيين القناة الافتراضية" : "Default channel set" });
    loadData();
  };

  const handleVerifyWhatsApp = async () => {
    if (!tenantId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-whatsapp-connection", {
        body: { tenant_id: tenantId, ...setupForm },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: isAr ? "تم التحقق بنجاح" : "Verification successful" });
        setSetupStep(2);
      } else {
        toast({ title: isAr ? "فشل التحقق" : "Verification failed", description: data?.error, variant: "destructive" });
      }
      loadData();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setVerifying(false);
  };

  const handleTestSend = async () => {
    if (!tenantId || !testPhone) return;
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-template", {
        body: {
          tenant_id: tenantId,
          to_phone: testPhone,
          template_name: testTemplateName,
          language_code: "ar",
          template_key: "test_send",
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: isAr ? "تم الإرسال بنجاح" : "Message sent successfully" });
      } else {
        toast({ title: isAr ? "فشل الإرسال" : "Send failed", description: data?.error, variant: "destructive" });
      }
      loadData();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setTestSending(false);
  };

  const getChannelIcon = (ch: string) => {
    if (ch === "whatsapp") return <MessageSquare size={18} className="text-green-600" />;
    if (ch === "email") return <Mail size={18} className="text-blue-600" />;
    return <Bell size={18} className="text-foreground" />;
  };

  const getChannelLabel = (ch: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      in_app: { ar: "إشعارات داخلية", en: "In-App" },
      email: { ar: "البريد الإلكتروني", en: "Email" },
      whatsapp: { ar: "واتساب", en: "WhatsApp" },
    };
    return isAr ? labels[ch]?.ar || ch : labels[ch]?.en || ch;
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; label: string }> = {
      sent: { variant: "outline", label: isAr ? "تم الإرسال" : "Sent" },
      failed: { variant: "destructive", label: isAr ? "فشل" : "Failed" },
      blocked: { variant: "secondary", label: isAr ? "محظور" : "Blocked" },
      queued: { variant: "default", label: isAr ? "في الانتظار" : "Queued" },
      retrying: { variant: "default", label: isAr ? "إعادة المحاولة" : "Retrying" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredLogs = outbox.filter((o) => {
    if (logFilter.status !== "all" && o.status !== logFilter.status) return false;
    if (logFilter.channel !== "all" && o.channel !== logFilter.channel) return false;
    return true;
  });

  const allChannels: Channel[] = [
    channels.find((c) => c.channel === "in_app") || { channel: "in_app", enabled: true, is_default: true },
    channels.find((c) => c.channel === "email") || { channel: "email", enabled: false, is_default: false },
    channels.find((c) => c.channel === "whatsapp") || { channel: "whatsapp", enabled: false, is_default: false },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bell size={22} />
          {isAr ? "إعدادات الإشعارات" : "Notification Settings"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr ? "إدارة قنوات الإشعارات والقوالب وسجل الإرسال." : "Manage notification channels, templates, and delivery logs."}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir={isAr ? "rtl" : "ltr"}>
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="channels" className="gap-1.5 min-h-[44px]">
            <Zap size={14} />
            {isAr ? "القنوات" : "Channels"}
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 min-h-[44px]">
            <MessageSquare size={14} />
            {isAr ? "واتساب" : "WhatsApp"}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 min-h-[44px]">
            <FileText size={14} />
            {isAr ? "القوالب" : "Templates"}
          </TabsTrigger>
          <TabsTrigger value="limits" className="gap-1.5 min-h-[44px]">
            <BarChart3 size={14} />
            {isAr ? "الحدود" : "Limits"}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 min-h-[44px]">
            <FileText size={14} />
            {isAr ? "السجل" : "Logs"}
          </TabsTrigger>
        </TabsList>

        {/* ── Channels Tab ── */}
        <TabsContent value="channels" className="space-y-4 mt-4">
          {allChannels.map((ch) => {
            const isWhatsApp = ch.channel === "whatsapp";
            const locked = isWhatsApp && !whatsappAllowed;

            return (
              <Card key={ch.channel}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {getChannelIcon(ch.channel)}
                      <div>
                        <p className="text-sm font-medium">{getChannelLabel(ch.channel)}</p>
                        {locked && (
                          <p className="text-xs text-amber-600">
                            {isAr ? "متاح في باقة الأعمال والمؤسسات" : "Available in Business & Enterprise plans"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {ch.is_default && (
                        <Badge variant="outline" className="text-xs">
                          {isAr ? "افتراضي" : "Default"}
                        </Badge>
                      )}
                      {!ch.is_default && ch.enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultChannel(ch.channel)}
                          className="text-xs h-8"
                        >
                          {isAr ? "تعيين افتراضي" : "Set Default"}
                        </Button>
                      )}
                      <Switch
                        checked={ch.enabled}
                        disabled={locked || ch.channel === "in_app"}
                        onCheckedChange={(v) => toggleChannel(ch.channel, v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── WhatsApp Setup Tab ── */}
        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          {!whatsappAllowed ? (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="py-8 text-center space-y-3">
                <AlertTriangle size={40} className="mx-auto text-amber-500" />
                <h3 className="font-semibold text-foreground">
                  {isAr ? "ترقية الباقة مطلوبة" : "Plan Upgrade Required"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {isAr
                    ? "قناة واتساب متاحة في باقة الأعمال والمؤسسات فقط. قم بترقية باقتك لتفعيل إرسال الإشعارات عبر واتساب."
                    : "WhatsApp channel is available in Business and Enterprise plans. Upgrade your plan to enable WhatsApp notifications."}
                </p>
                <Button variant="default" className="min-h-[44px]" onClick={() => window.location.href = "/dashboard/subscription"}>
                  {isAr ? "ترقية الباقة" : "Upgrade Plan"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Status */}
              {waAccount && (
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Phone size={18} className={waAccount.status === "active" ? "text-green-600" : "text-destructive"} />
                        <div>
                          <p className="text-sm font-medium">{waAccount.business_name || waAccount.display_phone_number}</p>
                          <p className="text-xs text-muted-foreground">{waAccount.display_phone_number}</p>
                        </div>
                      </div>
                      <Badge variant={waAccount.status === "active" ? "outline" : "destructive"}>
                        {waAccount.status === "active"
                          ? (isAr ? "متصل" : "Connected")
                          : (isAr ? "خطأ" : "Error")}
                      </Badge>
                    </div>
                    {waAccount.last_error && (
                      <p className="text-xs text-destructive mt-2 bg-destructive/5 p-2 rounded">
                        {waAccount.last_error}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Stepper */}
              <div className="flex items-center gap-2 py-2 flex-wrap">
                {[
                  isAr ? "١. بيانات الاتصال" : "1. Credentials",
                  isAr ? "٢. التحقق" : "2. Verify",
                  isAr ? "٣. القوالب" : "3. Templates",
                  isAr ? "٤. اختبار" : "4. Test",
                ].map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setSetupStep(i)}
                    className={`text-xs px-3 py-2 rounded-lg min-h-[36px] border transition-colors ${
                      setupStep === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Step 0: Credentials */}
              {setupStep === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isAr ? "بيانات Meta WhatsApp Cloud API" : "Meta WhatsApp Cloud API Credentials"}</CardTitle>
                    <CardDescription>
                      {isAr
                        ? "أدخل بيانات حساب WhatsApp Business الخاص بمنشأتك من لوحة Meta للمطورين."
                        : "Enter your WhatsApp Business account details from Meta Developer Dashboard."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>WABA ID</Label>
                      <Input
                        placeholder="1234567890"
                        value={setupForm.waba_id}
                        onChange={(e) => setSetupForm({ ...setupForm, waba_id: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number ID</Label>
                      <Input
                        placeholder="9876543210"
                        value={setupForm.phone_number_id}
                        onChange={(e) => setSetupForm({ ...setupForm, phone_number_id: e.target.value })}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? "Permanent Token" : "Permanent Token"}</Label>
                      <Input
                        type="password"
                        placeholder="EAAxxxxxx..."
                        value={setupForm.access_token}
                        onChange={(e) => setSetupForm({ ...setupForm, access_token: e.target.value })}
                        dir="ltr"
                      />
                      <p className="text-xs text-muted-foreground">
                        {isAr
                          ? "يتم تشفير التوكن وتخزينه بأمان ولا يُعرض مرة أخرى."
                          : "Token is encrypted and stored securely. It will never be displayed again."}
                      </p>
                    </div>
                    <Button
                      onClick={() => setSetupStep(1)}
                      disabled={!setupForm.waba_id || !setupForm.phone_number_id || !setupForm.access_token}
                      className="min-h-[44px] gap-1.5"
                    >
                      {isAr ? "التالي" : "Next"}
                      {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Step 1: Verify */}
              {setupStep === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isAr ? "التحقق من الاتصال" : "Verify Connection"}</CardTitle>
                    <CardDescription>
                      {isAr
                        ? "سيتم التحقق من صلاحية التوكن ورقم الهاتف عبر Meta API."
                        : "We'll verify your token and phone number via Meta API."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                      <p><span className="font-medium">WABA ID:</span> <span dir="ltr">{setupForm.waba_id}</span></p>
                      <p><span className="font-medium">Phone Number ID:</span> <span dir="ltr">{setupForm.phone_number_id}</span></p>
                      <p><span className="font-medium">Token:</span> ••••••{setupForm.access_token.slice(-6)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSetupStep(0)} className="min-h-[44px]">
                        {isAr ? "رجوع" : "Back"}
                      </Button>
                      <Button onClick={handleVerifyWhatsApp} disabled={verifying} className="min-h-[44px] gap-1.5">
                        {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {isAr ? "تحقق الآن" : "Verify Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Templates */}
              {setupStep === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isAr ? "قوالب واتساب المطلوبة" : "Required WhatsApp Templates"}</CardTitle>
                    <CardDescription>
                      {isAr
                        ? "تأكد أن هذه القوالب مسجلة في حساب Meta WhatsApp Business الخاص بك."
                        : "Make sure these templates are registered in your Meta WhatsApp Business account."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {REQUIRED_TEMPLATES.map((t) => {
                        const mapped = waTemplates.find((wt) => wt.template_key === t.key);
                        return (
                          <div key={t.key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                            <div>
                              <p className="text-sm font-medium">{isAr ? t.labelAr : t.labelEn}</p>
                              <p className="text-xs text-muted-foreground font-mono">{t.key}</p>
                            </div>
                            {mapped ? (
                              <Badge variant="outline" className="gap-1">
                                <CheckCircle2 size={12} className="text-green-600" />
                                {mapped.whatsapp_template_name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle size={12} />
                                {isAr ? "غير مربوط" : "Not Mapped"}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button onClick={() => setSetupStep(3)} className="mt-4 min-h-[44px]">
                      {isAr ? "التالي — اختبار الإرسال" : "Next — Test Send"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Test */}
              {setupStep === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{isAr ? "إرسال رسالة اختبار" : "Send Test Message"}</CardTitle>
                    <CardDescription>
                      {isAr ? "أدخل رقم هاتف لاختبار الإرسال عبر واتساب." : "Enter a phone number to test WhatsApp delivery."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{isAr ? "رقم الهاتف" : "Phone Number"}</Label>
                      <Input
                        placeholder="+966512345678"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        dir="ltr"
                        type="tel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{isAr ? "اسم القالب في Meta" : "Meta Template Name"}</Label>
                      <Input
                        placeholder="hello_world"
                        value={testTemplateName}
                        onChange={(e) => setTestTemplateName(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSetupStep(2)} className="min-h-[44px]">
                        {isAr ? "رجوع" : "Back"}
                      </Button>
                      <Button onClick={handleTestSend} disabled={testSending || !testPhone} className="min-h-[44px] gap-1.5">
                        {testSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {isAr ? "إرسال اختبار" : "Send Test"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Templates Tab ── */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isAr ? "قوالب واتساب" : "WhatsApp Templates"}</CardTitle>
              <CardDescription>
                {isAr
                  ? "قم بربط أسماء قوالب Meta بأحداث الإشعارات في النظام."
                  : "Map Meta template names to notification events in the system."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {waTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={40} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">{isAr ? "لا توجد قوالب مربوطة بعد." : "No templates mapped yet."}</p>
                  <p className="text-xs mt-1">{isAr ? "اذهب لتبويب واتساب لإعداد القوالب." : "Go to WhatsApp tab to set up templates."}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-start">{isAr ? "الحدث" : "Event"}</TableHead>
                        <TableHead className="text-start">{isAr ? "قالب Meta" : "Meta Template"}</TableHead>
                        <TableHead className="text-start">{isAr ? "اللغة" : "Language"}</TableHead>
                        <TableHead className="text-start">{isAr ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waTemplates.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">{t.template_key}</TableCell>
                          <TableCell dir="ltr">{t.whatsapp_template_name}</TableCell>
                          <TableCell>{t.language === "ar" ? "عربي" : "English"}</TableCell>
                          <TableCell>
                            <Badge variant={t.is_active ? "outline" : "secondary"}>
                              {t.is_active ? (isAr ? "نشط" : "Active") : (isAr ? "معطّل" : "Inactive")}
                            </Badge>
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

        {/* ── Limits Tab ── */}
        <TabsContent value="limits" className="space-y-4 mt-4">
          {rateLimits.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <BarChart3 size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">{isAr ? "لم يتم تعيين حدود إرسال بعد." : "No rate limits configured yet."}</p>
              </CardContent>
            </Card>
          ) : (
            rateLimits.map((rl) => {
              const dailyPct = rl.daily_limit > 0 ? (rl.daily_count / rl.daily_limit) * 100 : 0;
              const monthlyPct = rl.monthly_limit > 0 ? (rl.monthly_count / rl.monthly_limit) * 100 : 0;
              return (
                <Card key={rl.channel}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {getChannelIcon(rl.channel)}
                      {getChannelLabel(rl.channel)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{isAr ? "اليومي" : "Daily"}</span>
                        <span className={dailyPct >= 80 ? "text-amber-600 font-medium" : ""}>{rl.daily_count} / {rl.daily_limit}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${dailyPct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${Math.min(dailyPct, 100)}%` }}
                        />
                      </div>
                      {dailyPct >= 80 && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {isAr ? "اقتربت من الحد اليومي" : "Approaching daily limit"}
                        </p>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{isAr ? "الشهري" : "Monthly"}</span>
                        <span className={monthlyPct >= 80 ? "text-amber-600 font-medium" : ""}>{rl.monthly_count} / {rl.monthly_limit}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${monthlyPct >= 80 ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${Math.min(monthlyPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Logs Tab ── */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={logFilter.status} onValueChange={(v) => setLogFilter({ ...logFilter, status: v })}>
              <SelectTrigger className="w-[140px] min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? "كل الحالات" : "All Status"}</SelectItem>
                <SelectItem value="sent">{isAr ? "تم الإرسال" : "Sent"}</SelectItem>
                <SelectItem value="failed">{isAr ? "فشل" : "Failed"}</SelectItem>
                <SelectItem value="blocked">{isAr ? "محظور" : "Blocked"}</SelectItem>
                <SelectItem value="queued">{isAr ? "انتظار" : "Queued"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={logFilter.channel} onValueChange={(v) => setLogFilter({ ...logFilter, channel: v })}>
              <SelectTrigger className="w-[140px] min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? "كل القنوات" : "All Channels"}</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="in_app">{isAr ? "داخلي" : "In-App"}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} className="min-h-[44px] min-w-[44px]">
              <RefreshCw size={16} />
            </Button>
          </div>

          {filteredLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">{isAr ? "لا توجد سجلات." : "No logs found."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{isAr ? "القناة" : "Channel"}</TableHead>
                    <TableHead className="text-start">{isAr ? "القالب" : "Template"}</TableHead>
                    <TableHead className="text-start">{isAr ? "المستلم" : "Recipient"}</TableHead>
                    <TableHead className="text-start">{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-start">{isAr ? "الخطأ" : "Error"}</TableHead>
                    <TableHead className="text-start">{isAr ? "التاريخ" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getChannelIcon(log.channel)}
                          <span className="text-xs">{getChannelLabel(log.channel)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.template_key}</TableCell>
                      <TableCell dir="ltr" className="text-xs">{log.recipient}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={log.error || log.block_reason || ""}>
                        {log.error || log.block_reason || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationSettingsPage;
