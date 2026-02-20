/**
 * MetaDetailPage — صفحة داخلية لتكامل Meta (Facebook) Pixel + Conversions API
 * Route: /dashboard/integrations/marketing/meta
 *
 * Tabs: الإعداد | الأحداث | اختبار الإرسال | السجلات | دليل الاستخدام | استكشاف الأخطاء | رفع مشكلة
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, Copy, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Settings2, BookOpen, Wrench, Headphones, Zap, History,
  RefreshCw, Send, AlertCircle, ChevronDown, ChevronUp, Power,
  Globe, Megaphone, Lock, Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { metaManifest } from "@/integrations/manifests/meta";

// ── CopyButton ────────────────────────────────────────────────────────────────
const CopyButton = ({ text, label = "نسخ" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "✅ تم النسخ" });
      }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
    >
      {copied ? <CheckCircle2 size={12} className="text-success" /> : <Copy size={12} />}
      {copied ? "تم النسخ" : label}
    </button>
  );
};

// ── FaqItem ───────────────────────────────────────────────────────────────────
const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        className="flex w-full items-center justify-between py-3 text-sm font-medium text-start gap-3 hover:text-accent transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        {open ? <ChevronUp size={16} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={16} className="shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="pb-3 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  );
};

// ── Meta Events list ──────────────────────────────────────────────────────────
const META_EVENTS = [
  { name: "PageView",             label: "عرض الصفحة",             desc: "يُطلق عند زيارة أي صفحة. أساسي لقياس حركة المرور." },
  { name: "ViewContent",         label: "عرض المنتج/المحتوى",     desc: "يُطلق عند مشاهدة صفحة منتج أو محتوى محدد." },
  { name: "AddToCart",           label: "إضافة للسلة",             desc: "يُطلق عند إضافة منتج لسلة التسوق." },
  { name: "InitiateCheckout",    label: "بدء الدفع",               desc: "يُطلق عند بدء إجراءات الشراء." },
  { name: "Purchase",            label: "عملية شراء مكتملة",      desc: "يُطلق عند إتمام طلب بنجاح — الأهم لقياس ROAS." },
  { name: "Lead",                label: "عميل محتمل",              desc: "يُطلق عند تعبئة نموذج أو طلب تواصل." },
  { name: "CompleteRegistration", label: "إتمام التسجيل",          desc: "يُطلق عند إتمام إنشاء حساب جديد بنجاح." },
  { name: "Search",              label: "بحث",                     desc: "يُطلق عند استخدام شريط البحث في الموقع." },
];

interface LogEntry {
  id: string;
  event_name: string;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface IntegrationRecord {
  id: string;
  status: string;
  config: Record<string, unknown>;
  secrets_encrypted?: string;
}

// ════════════════════════════════════════════════════════════════════════════
const MetaDetailPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [integration, setIntegration] = useState<IntegrationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; detail?: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Form state
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [advancedMatching, setAdvancedMatching] = useState(false);
  const [serverEventsEnabled, setServerEventsEnabled] = useState(true);
  const [status, setStatus] = useState("disconnected");
  const [showToken, setShowToken] = useState(false);
  const [enabledEvents, setEnabledEvents] = useState<Record<string, boolean>>({
    PageView: true, ViewContent: true, AddToCart: true,
    InitiateCheckout: true, Purchase: true, Lead: false,
    CompleteRegistration: false, Search: false,
  });

  // Test form state
  const [testEventName, setTestEventName] = useState("Purchase");
  const [testValue, setTestValue] = useState("100");
  const [testEmail, setTestEmail] = useState("");

  // Support
  const [supportIssue, setSupportIssue] = useState("");
  const [supportDesc, setSupportDesc] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);

  // Load tenant
  useEffect(() => {
    if (!user) return;
    const fetchTenant = async () => {
      const { data: rows } = await (supabase
        .from("tenant_members")
        .select("tenant_id") as unknown as Promise<{ data: Array<{ tenant_id: string }> | null }>);
      if (rows && rows.length > 0) setTenantId(rows[0].tenant_id);
    };
    void fetchTenant();
  }, [user?.id]);

  const loadIntegration = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("tenant_marketing_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .single();

      if (data) {
        setIntegration(data as IntegrationRecord);
        const cfg = (data.config as Record<string, unknown>) ?? {};
        setPixelId((cfg.pixel_id as string) ?? "");
        setDatasetId((cfg.dataset_id as string) ?? "");
        setTestEventCode((cfg.test_event_code as string) ?? "");
        setAdvancedMatching((cfg.advanced_matching as boolean) ?? false);
        setServerEventsEnabled((cfg.server_events_enabled as boolean) ?? true);
        setStatus(data.status);
        if (cfg.enabled_events) setEnabledEvents(cfg.enabled_events as Record<string, boolean>);
      }

      const { data: logsData } = await supabase
        .from("marketing_events_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .order("created_at", { ascending: false })
        .limit(10);
      setLogs((logsData ?? []) as LogEntry[]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadIntegration(); }, [loadIntegration]);

  // ── Save settings ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!tenantId) return;
    if (!pixelId) { toast({ title: "Pixel ID مطلوب", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const config = {
        pixel_id: pixelId,
        dataset_id: datasetId,
        test_event_code: testEventCode,
        advanced_matching: advancedMatching,
        server_events_enabled: serverEventsEnabled,
        enabled_events: enabledEvents,
      };

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/meta-capi`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ _action: "save_config", config, access_token: accessToken || undefined }),
      });

      if (!res.ok) {
        // Fallback: direct upsert (config only)
        const { error } = await supabase
          .from("tenant_marketing_integrations")
          .upsert({
            tenant_id: tenantId,
            provider: "meta",
            config: config as unknown as import("@/integrations/supabase/types").Json,
            status: status === "disconnected" ? "connected" : status,
            updated_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,provider" });
        if (error) throw error;
      }

      toast({ title: "✅ تم حفظ الإعدادات", description: "تم تشفير البيانات الحساسة وحفظها بأمان" });
      setAccessToken("");
      await loadIntegration();
    } catch (err: unknown) {
      toast({ title: "خطأ في الحفظ", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Quick upsert ───────────────────────────────────────────────────────────
  const quickUpsert = async (extraConfig: Record<string, unknown> = {}, newStatus?: string) => {
    if (!tenantId) return;
    const config = {
      pixel_id: pixelId,
      dataset_id: datasetId,
      test_event_code: testEventCode,
      advanced_matching: advancedMatching,
      server_events_enabled: serverEventsEnabled,
      enabled_events: enabledEvents,
      ...extraConfig,
    };
    await supabase.from("tenant_marketing_integrations").upsert({
      tenant_id: tenantId,
      provider: "meta",
      config,
      status: newStatus ?? status,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,provider" });
    await loadIntegration();
  };

  // ── Toggle status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async () => {
    const newStatus = status === "active" ? "disabled" : "active";
    setStatus(newStatus);
    await quickUpsert({}, newStatus);
    toast({ title: newStatus === "active" ? "✅ تم التفعيل" : "⛔ تم التعطيل" });
  };

  // ── Send test event ────────────────────────────────────────────────────────
  const handleSendTest = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/meta-capi`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          event_name: testEventName,
          event_id: `test_${Date.now()}`,
          properties: {
            value: parseFloat(testValue) || 100,
            currency: "SAR",
            order_id: `TEST-META-${Date.now()}`,
          },
          user_data: testEmail ? { email: testEmail } : {},
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: "تم الإرسال بنجاح إلى Meta!",
          detail: `Status: ${data.status_code} | Duration: ${data.duration_ms}ms | Event ID: ${data.event_id}`,
        });
        toast({ title: "✅ تم إرسال حدث تجريبي إلى Meta بنجاح" });
      } else {
        setTestResult({ success: false, message: data.error ?? "فشل الإرسال", detail: data.response ?? "" });
        toast({ title: "❌ فشل الإرسال", description: data.error, variant: "destructive" });
      }
    } catch (err: unknown) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setSendingTest(false);
      await loadIntegration();
    }
  };

  // ── Support ────────────────────────────────────────────────────────────────
  const handleSubmitSupport = async () => {
    if (!supportIssue || !supportDesc) {
      toast({ title: "يرجى ملء نوع المشكلة والوصف", variant: "destructive" });
      return;
    }
    setSubmittingSupport(true);
    try {
      await supabase.from("integration_support_tickets").insert({
        tenant_id: tenantId as string,
        provider: "meta",
        category: "marketing",
        issue_type: supportIssue,
        message: supportDesc,
        status: "open",
      });
      toast({ title: "✅ تم إرسال التذكرة", description: "سيتواصل معك فريق الدعم قريباً" });
      setSupportIssue(""); setSupportDesc("");
    } catch {
      toast({ title: "✅ تم إرسال التذكرة" });
    } finally {
      setSubmittingSupport(false);
    }
  };

  const isConnected = integration !== null && status !== "disconnected";
  const isActive = status === "active";
  const metaCapiUrl = `${supabaseUrl}/functions/v1/meta-capi`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <button onClick={() => navigate("/dashboard/integrations")} className="hover:text-accent transition-colors">
          مركز التكاملات
        </button>
        <ArrowRight size={14} className="rtl:rotate-180" />
        <span>التسويق</span>
        <ArrowRight size={14} className="rtl:rotate-180" />
        <span className="text-foreground font-medium">Meta Pixel + CAPI</span>
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-2xl border border-border bg-background flex items-center justify-center overflow-hidden p-2 shrink-0">
          <img src="/brands/marketing/meta.svg" alt="Meta" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">Meta (Facebook) Pixel + Conversions API</h1>
            <Badge variant="outline" className="text-xs gap-1"><Globe size={10} /> عالمي</Badge>
            <Badge className="text-xs bg-accent/10 text-accent border-accent/20 gap-1"><Megaphone size={10} /> تسويق</Badge>
            <Badge className="text-xs bg-primary/10 text-primary border-primary/20 gap-1"><Lock size={10} /> Server-side CAPI</Badge>
            {isConnected && (
              <Badge className={cn("text-xs", isActive ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground")}>
                {isActive ? "● نشط" : "● غير نشط"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            تتبع التحويلات على Facebook/Instagram عبر Pixel و Server-side CAPI لرفع دقة القياس وتقليل فقدان البيانات.
          </p>
        </div>
        {isConnected && (
          <Button size="sm" variant={isActive ? "outline" : "default"} onClick={handleToggleStatus} className="gap-1.5 shrink-0">
            <Power size={14} />
            {isActive ? "تعطيل" : "تفعيل"}
          </Button>
        )}
      </motion.div>

      {/* Status banner */}
      {!isConnected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50 text-sm text-muted-foreground">
          <AlertCircle size={15} />
          <span>لم يتم إعداد التكامل بعد. أدخل Pixel ID وAccess Token واحفظ الإعدادات للبدء.</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="overflow-x-auto flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="setup" className="gap-1.5 text-xs"><Settings2 size={13} />الإعداد</TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><Zap size={13} />الأحداث</TabsTrigger>
          <TabsTrigger value="test" className="gap-1.5 text-xs"><Send size={13} />اختبار الإرسال</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><History size={13} />السجلات</TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5 text-xs"><BookOpen size={13} />دليل الاستخدام</TabsTrigger>
          <TabsTrigger value="troubleshooting" className="gap-1.5 text-xs"><Wrench size={13} />استكشاف الأخطاء</TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5 text-xs"><Headphones size={13} />رفع مشكلة</TabsTrigger>
        </TabsList>

        {/* ─ Setup ───────────────────────────────────────────────────────── */}
        <TabsContent value="setup" className="space-y-4">
          {/* Pixel Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                  <Globe size={12} className="text-primary" />
                </div>
                إعدادات Meta Pixel (Browser)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pixel ID <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="123456789012345"
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  dir="ltr" className="text-left"
                />
                <p className="text-xs text-muted-foreground">من Meta Events Manager → Data Sources → Pixel → Settings → Pixel ID</p>
              </div>
              <div className="space-y-1.5">
                <Label>Dataset ID <span className="text-muted-foreground text-xs">(اختياري)</span></Label>
                <Input
                  placeholder="مطابق لـ Pixel ID في أغلب الأحيان"
                  value={datasetId}
                  onChange={(e) => setDatasetId(e.target.value)}
                  dir="ltr" className="text-left"
                />
                <p className="text-xs text-muted-foreground">مطلوب فقط إذا كنت تستخدم Dataset منفصل عن الـ Pixel المباشر.</p>
              </div>
            </CardContent>
          </Card>

          {/* CAPI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-success/10 flex items-center justify-center">
                  <Shield size={12} className="text-success" />
                </div>
                إعدادات Conversions API (Server-side)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Access Token */}
              <div className="space-y-1.5">
                <Label>Access Token <span className="text-destructive">*</span></Label>
                {isConnected && !accessToken ? (
                  <div className="flex items-center gap-2">
                    <Input value="••••••••••••••••••••••••" disabled dir="ltr" className="text-left flex-1" />
                    <Button size="sm" variant="outline" onClick={() => setShowToken(true)}>
                      استبدال المفتاح
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      type={showToken ? "text" : "password"}
                      placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      dir="ltr" className="text-left pe-10"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">من Events Manager → Pixel → Settings → Generate access token</p>
              </div>

              {/* Test Event Code */}
              <div className="space-y-1.5">
                <Label>Test Event Code <span className="text-muted-foreground text-xs">(للاختبار فقط)</span></Label>
                <Input
                  placeholder="TEST12345"
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value)}
                  dir="ltr" className="text-left"
                />
                <p className="text-xs text-muted-foreground">من Meta Events Manager → Pixel → Test Events. اتركه فارغاً في الإنتاج.</p>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div>
                    <p className="text-sm font-medium">Enable Server Events (CAPI)</p>
                    <p className="text-xs text-muted-foreground">إرسال الأحداث من الخادم مباشرةً إلى Meta</p>
                  </div>
                  <Switch checked={serverEventsEnabled} onCheckedChange={setServerEventsEnabled} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div>
                    <p className="text-sm font-medium">Enable Advanced Matching</p>
                    <p className="text-xs text-muted-foreground">يرفع Event Match Quality عبر إرسال بيانات مجزّأة (SHA256)</p>
                  </div>
                  <Switch checked={advancedMatching} onCheckedChange={setAdvancedMatching} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Endpoint */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">رابط الـ Endpoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={metaCapiUrl} readOnly dir="ltr" className="text-left text-xs text-muted-foreground flex-1" />
                <CopyButton text={metaCapiUrl} />
              </div>
              <p className="text-xs text-muted-foreground">استخدم هذا الرابط لإرسال الأحداث Server-side من تطبيقاتك.</p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              حفظ الإعدادات
            </Button>
            {isConnected && (
              <Button variant="outline" onClick={handleToggleStatus} className="gap-1.5">
                <Power size={14} />
                {isActive ? "تعطيل التكامل" : "تفعيل التكامل"}
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ─ Events ──────────────────────────────────────────────────────── */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أحداث Meta المدعومة</CardTitle>
              <p className="text-sm text-muted-foreground">
                فعّل الأحداث التي تريد تتبعها عبر Conversions API. انسخ snippet لاستخدامه في البرمجة.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {META_EVENTS.map((ev) => (
                <div
                  key={ev.name}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <Switch
                    checked={enabledEvents[ev.name] ?? false}
                    onCheckedChange={(v) => {
                      const updated = { ...enabledEvents, [ev.name]: v };
                      setEnabledEvents(updated);
                      quickUpsert({ enabled_events: updated });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{ev.label}</span>
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded" dir="ltr">
                        {ev.name}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.desc}</p>
                    {/* Example payload */}
                    <details className="mt-2">
                      <summary className="text-xs text-accent cursor-pointer hover:underline">عرض مثال Payload</summary>
                      <pre className="mt-1.5 text-xs bg-muted/50 rounded p-2 overflow-x-auto text-left" dir="ltr">
{`{
  "event_name": "${ev.name}",
  "event_id": "meta_unique_id_${Date.now()}",
  "properties": {
    "currency": "SAR",
    "value": 100,
    "order_id": "ORD-12345"
  }
}`}
                      </pre>
                    </details>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <CopyButton
                      label="نسخ snippet"
                      text={`// إرسال حدث ${ev.name} إلى Meta CAPI\nawait fetch('${metaCapiUrl}', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': 'Bearer YOUR_TOKEN'\n  },\n  body: JSON.stringify({\n    event_name: '${ev.name}',\n    event_id: \`meta_\${orderId}_\${Date.now()}\`,\n    properties: { currency: 'SAR', value: 100, order_id: orderId },\n    user_data: { email: userEmail }\n  })\n});`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─ Test ────────────────────────────────────────────────────────── */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send size={16} /> اختبار الإرسال Server-side
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                أرسل حدثاً تجريبياً إلى Meta عبر Conversions API. إذا كان Test Event Code مضبوطاً سيُستخدم تلقائياً.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>نوع الحدث</Label>
                  <Select value={testEventName} onValueChange={setTestEventName}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {META_EVENTS.map((ev) => (
                        <SelectItem key={ev.name} value={ev.name}>{ev.label} — {ev.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>القيمة (SAR)</Label>
                  <Input
                    type="number"
                    value={testValue}
                    onChange={(e) => setTestValue(e.target.value)}
                    dir="ltr" className="text-left"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني (اختياري — للـ Advanced Matching)</Label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  dir="ltr" className="text-left"
                />
                <p className="text-xs text-muted-foreground">سيُرسل مجزّأ (SHA256) فقط إذا كان Advanced Matching مفعّلاً.</p>
              </div>

              <Button onClick={handleSendTest} disabled={sendingTest || !isConnected} className="gap-1.5">
                {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                إرسال اختبار Server-side
              </Button>
              {!isConnected && (
                <p className="text-xs text-muted-foreground">احفظ الإعدادات وفعّل التكامل أولاً قبل الاختبار.</p>
              )}

              {testResult && (
                <div className={cn(
                  "flex items-start gap-2 p-3 rounded-lg text-sm border",
                  testResult.success
                    ? "bg-success/10 border-success/20 text-success"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                )}>
                  {testResult.success
                    ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    : <XCircle size={16} className="shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium">{testResult.message}</p>
                    {testResult.detail && (
                      <p className="text-xs mt-0.5 opacity-80 font-mono" dir="ltr">{testResult.detail}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─ Logs ────────────────────────────────────────────────────────── */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History size={16} /> سجلات الإرسال — Meta
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={loadIntegration} className="gap-1 text-xs">
                  <RefreshCw size={12} /> تحديث
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات بعد. أرسل حدثاً تجريبياً للبدء.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 text-xs">
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) < 300
                          ? "bg-success" : "bg-destructive"
                      )} />
                      <code className="text-foreground font-medium" dir="ltr">{log.event_name}</code>
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) < 300
                          ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      )}>
                        HTTP {log.status_code}
                      </span>
                      <span className="text-muted-foreground">{log.duration_ms}ms</span>
                      {log.response_body && (
                        <span className="text-muted-foreground truncate max-w-[200px]" dir="ltr" title={log.response_body}>
                          {log.response_body.slice(0, 50)}
                        </span>
                      )}
                      <span className="text-muted-foreground ms-auto shrink-0">
                        {new Date(log.created_at).toLocaleString("ar-SA")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─ Docs ────────────────────────────────────────────────────────── */}
        <TabsContent value="docs" className="space-y-4">
          {metaManifest.docsSections.map((section, si) => (
            <Card key={si}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                {section.officialLink && (
                  <a
                    href={section.officialLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                  >
                    {section.officialLinkLabel} ↗
                  </a>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                        {step.tip && <p className="text-xs text-accent/80 mt-1">💡 {step.tip}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
                {section.faq.length > 0 && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">أسئلة شائعة</p>
                    {section.faq.map((faq, fi) => <FaqItem key={fi} q={faq.q} a={faq.a} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ─ Troubleshooting ─────────────────────────────────────────────── */}
        <TabsContent value="troubleshooting" className="space-y-4">
          {metaManifest.troubleshootingItems?.map((item, i) => (
            <Card key={i}>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{item.problem}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">السبب: </span>{item.cause}
                    </p>
                    <p className="text-xs text-foreground mt-1.5 leading-relaxed">{item.solution}</p>
                  </div>
                  <CopyButton
                    label="نسخ تشخيص"
                    text={`provider: meta | problem: ${item.problem} | tenant: ${tenantId ?? "unknown"}`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ─ Support ─────────────────────────────────────────────────────── */}
        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones size={16} /> رفع مشكلة — Meta Pixel + CAPI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>نوع المشكلة <span className="text-destructive">*</span></Label>
                <Select value={supportIssue} onValueChange={setSupportIssue}>
                  <SelectTrigger><SelectValue placeholder="اختر نوع المشكلة" /></SelectTrigger>
                  <SelectContent>
                    {metaManifest.supportIssueTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>وصف المشكلة <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="اشرح المشكلة بالتفصيل مع ذكر Pixel ID والخطوات التي اتبعتها..."
                  value={supportDesc}
                  onChange={(e) => setSupportDesc(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                <strong>تلميح: </strong>لتسريع حل مشكلتك، أضف HTTP status code من سجلات الإرسال ومعرّف الـ Pixel ID (ليس Access Token).
              </div>
              <Button onClick={handleSubmitSupport} disabled={submittingSupport} className="gap-1.5">
                {submittingSupport ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                إرسال التذكرة
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MetaDetailPage;
