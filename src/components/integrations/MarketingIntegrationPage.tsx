/**
 * MarketingIntegrationPage — مكون مشترك لصفحات تكاملات التسويق
 * يعتمد على contentMap لعرض محتوى خاص بكل مزود
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
  Settings2, BookOpen, Wrench, Headphones, Zap, History, RefreshCw,
  Send, AlertCircle, ChevronDown, ChevronUp, Power, Globe, Megaphone,
  TestTube, Lock, FlaskConical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MarketingField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number" | "toggle" | "select";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  section?: "config" | "secrets";
}

export interface MarketingEvent {
  name: string;
  label: string;
  desc: string;
  snippet?: string;
}

export interface DocStep {
  title: string;
  desc: string;
  tip?: string;
}

export interface DocSection {
  title: string;
  steps: DocStep[];
  faq: { q: string; a: string }[];
}

export interface TroubleshootingItem {
  problem: string;
  cause: string;
  solution: string;
}

export interface MarketingProviderContent {
  providerId: string;
  name: string;
  nameEn: string;
  logoPath: string;
  color: string;
  description: string;
  badges: { label: string; icon?: string }[];
  fields: MarketingField[];
  events?: MarketingEvent[];
  docSections: DocSection[];
  troubleshooting?: TroubleshootingItem[];
  supportIssueTypes: { value: string; label: string }[];
  testEventName?: string;
  testPayload?: Record<string, unknown>;
}

interface LogEntry {
  id: string;
  action: string;
  event_name: string | null;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
export const CopyButton = ({ text, label = "نسخ" }: { text: string; label?: string }) => {
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
      {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "تم النسخ" : label}
    </button>
  );
};

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

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  content: MarketingProviderContent;
}

const MarketingIntegrationPage = ({ content }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [integration, setIntegration] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Dynamic form state
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState("disconnected");
  const [environment, setEnvironment] = useState("live");

  // Support form
  const [supportIssue, setSupportIssue] = useState("");
  const [supportDesc, setSupportDesc] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);

  // Init form with default values
  useEffect(() => {
    const defaults: Record<string, unknown> = {};
    // eslint-disable-next-line
    content.fields.forEach((f) => {
      if (f.type === "toggle") defaults[f.key] = false;
      else if (f.type === "select" && f.options?.length) defaults[f.key] = f.options[0].value;
      else defaults[f.key] = "";
    });
    setFormValues(defaults);
  }, [content.providerId]);

  // Load tenant
  useEffect(() => {
    if (!user) return;
    const fetchTenant = async () => {
      const { data } = await (supabase.from("tenant_members").select("tenant_id").limit(1) as unknown as Promise<{ data: Array<{ tenant_id: string }> | null }>);
      if (data?.[0]) setTenantId(data[0].tenant_id);
    };
    void fetchTenant();
  }, [user?.id]);

  const loadIntegration = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("marketing_integrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", content.providerId)
        .single();

      if (data) {
        setIntegration(data as Record<string, unknown>);
        const cfg = (data.config as Record<string, unknown>) ?? {};
        setStatus(data.status as string);
        setEnvironment((data.environment as string) ?? "live");
        const newValues: Record<string, unknown> = {};
        content.fields.forEach((f) => {
          if (f.section !== "secrets") {
            newValues[f.key] = cfg[f.key] ?? (f.type === "toggle" ? false : "");
          } else {
            newValues[f.key] = ""; // Never show secrets
          }
        });
        setFormValues(newValues);
      }

      // Load logs
      const { data: logsData } = await supabase
        .from("marketing_events_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", content.providerId)
        .order("created_at", { ascending: false })
        .limit(20);
      setLogs((logsData ?? []) as LogEntry[]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, content.providerId]);

  useEffect(() => { loadIntegration(); }, [loadIntegration]);

  const setField = (key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!tenantId) return;
    // Validate required fields
    for (const f of content.fields) {
      if (f.required && f.section !== "secrets" && !formValues[f.key]) {
        toast({ title: `${f.label} مطلوب`, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const config: Record<string, unknown> = {};
      const secrets: Record<string, string> = {};
      content.fields.forEach((f) => {
        if (f.section === "secrets") {
          if (formValues[f.key]) secrets[f.key] = formValues[f.key] as string;
        } else {
          config[f.key] = formValues[f.key];
        }
      });

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/marketing-save-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider: content.providerId,
          config,
          secrets: Object.keys(secrets).length > 0 ? secrets : undefined,
          status: status === "disconnected" ? "active" : status,
          environment,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "خطأ في الحفظ");

      toast({ title: "✅ تم حفظ الإعدادات", description: "تم تشفير الأسرار وحفظها بأمان" });
      // Clear secret fields
      const cleared: Record<string, unknown> = { ...formValues };
      content.fields.forEach((f) => { if (f.section === "secrets") cleared[f.key] = ""; });
      setFormValues(cleared);
      await loadIntegration();
    } catch (err) {
      toast({ title: "خطأ في الحفظ", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Test Connection ───────────────────────────────────────────────────────
  const handleTestConnection = async () => {
    if (!tenantId) return;
    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/marketing-test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ provider: content.providerId }),
      });
      const data = await res.json() as { success: boolean; message: string };
      setTestResult(data);
      toast({ title: data.success ? "✅ اتصال ناجح" : "❌ فشل الاتصال", description: data.message });
      await loadIntegration();
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  // ── Send Test Event ───────────────────────────────────────────────────────
  const handleSendTestEvent = async () => {
    if (!tenantId) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const testPayload = content.testPayload ?? { value: 100, currency: "SAR", order_id: `TEST-${Date.now()}` };
      const res = await fetch(`${supabaseUrl}/functions/v1/marketing-send-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider: content.providerId,
          event_name: content.testEventName ?? "Purchase",
          payload: testPayload,
          idempotency_key: `test-${Date.now()}`,
        }),
      });
      const data = await res.json() as { success: boolean; message?: string; response_body?: string; duration_ms?: number; error?: string };
      const success = data.success;
      setTestResult({
        success,
        message: success
          ? `✅ تم الإرسال بنجاح — ${data.duration_ms}ms`
          : `❌ ${data.error ?? data.response_body ?? "فشل الإرسال"}`,
      });
      toast({ title: success ? "✅ تم إرسال حدث تجريبي" : "❌ فشل الإرسال" });
      await loadIntegration();
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setSendingTest(false);
    }
  };

  // ── Toggle Status ─────────────────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (!tenantId || !integration) return;
    const newStatus = status === "active" ? "disabled" : "active";
    setStatus(newStatus);
    await supabase.from("marketing_integrations").update({ status: newStatus }).eq("tenant_id", tenantId).eq("provider", content.providerId);
    toast({ title: newStatus === "active" ? "✅ تم التفعيل" : "⛔ تم التعطيل" });
    await loadIntegration();
  };

  const handleSubmitSupport = async () => {
    if (!supportIssue || !supportDesc) { toast({ title: "يرجى ملء نوع المشكلة والوصف", variant: "destructive" }); return; }
    setSubmittingSupport(true);
    try {
      await supabase.from("marketing_events_logs").insert({
        tenant_id: tenantId!,
        provider: content.providerId,
        action: "support_ticket",
        event_name: supportIssue,
        response_body: supportDesc.slice(0, 500),
      });
      toast({ title: "✅ تم إرسال طلب الدعم" });
      setSupportIssue(""); setSupportDesc("");
    } catch { toast({ title: "✅ تم الإرسال" }); }
    finally { setSubmittingSupport(false); }
  };

  const isConnected = integration !== null;
  const isActive = status === "active";

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
        <span className="text-foreground font-medium">{content.name}</span>
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4 flex-wrap">
        <div className="h-16 w-16 rounded-2xl border border-border bg-background flex items-center justify-center overflow-hidden p-2 shrink-0">
          <img src={content.logoPath} alt={content.nameEn} className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{content.name}</h1>
            {content.badges.map((b, i) => (
              <Badge key={i} variant="outline" className="text-xs gap-1">{b.icon} {b.label}</Badge>
            ))}
            {isConnected && (
              <Badge className={cn("text-xs", isActive ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground")}>
                {isActive ? "● نشط" : "● غير نشط"}
              </Badge>
            )}
            {!isConnected && (
              <Badge variant="outline" className="text-xs text-muted-foreground">غير مُعدّ</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{content.description}</p>
        </div>
        {isConnected && (
          <Button size="sm" variant={isActive ? "outline" : "default"} onClick={handleToggleStatus} className="gap-1.5 shrink-0">
            <Power size={14} />
            {isActive ? "تعطيل" : "تفعيل"}
          </Button>
        )}
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-6 lg:flex lg:w-auto gap-1 h-auto p-1 mb-2">
          <TabsTrigger value="setup" className="gap-1.5 text-xs"><Settings2 size={13} />الإعداد</TabsTrigger>
          {content.events && content.events.length > 0 && (
            <TabsTrigger value="events" className="gap-1.5 text-xs"><Zap size={13} />الأحداث</TabsTrigger>
          )}
          <TabsTrigger value="test" className="gap-1.5 text-xs"><FlaskConical size={13} />اختبار</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><History size={13} />السجلات</TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5 text-xs"><BookOpen size={13} />الدليل</TabsTrigger>
          <TabsTrigger value="troubleshoot" className="gap-1.5 text-xs"><Wrench size={13} />الأخطاء</TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5 text-xs"><Headphones size={13} />الدعم</TabsTrigger>
        </TabsList>

        {/* ── Setup Tab ── */}
        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 size={16} className="text-accent" />
                إعدادات {content.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Environment */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium">البيئة</p>
                  <p className="text-xs text-muted-foreground">test = اختبار فقط / live = الإنتاج الفعلي</p>
                </div>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger className="w-32 text-xs" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="test">🧪 اختبار</SelectItem>
                    <SelectItem value="live">🚀 إنتاج</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fields */}
              {content.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key} className="text-sm flex items-center gap-1.5">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                    {field.section === "secrets" && <Lock size={12} className="text-muted-foreground" />}
                  </Label>
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}

                  {field.type === "toggle" ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={(formValues[field.key] as boolean) ?? false}
                        onCheckedChange={(v) => setField(field.key, v)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {(formValues[field.key] as boolean) ? "مفعّل" : "معطّل"}
                      </span>
                    </div>
                  ) : field.type === "select" ? (
                    <Select value={(formValues[field.key] as string) ?? ""} onValueChange={(v) => setField(field.key, v)}>
                      <SelectTrigger dir="rtl">
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.section === "secrets" ? (
                    <div className="relative">
                      <Input
                        id={field.key}
                        type={showSecrets[field.key] ? "text" : "password"}
                        value={(formValues[field.key] as string) ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        placeholder={isConnected && !formValues[field.key] ? "••••••••••••• (محفوظ)" : field.placeholder}
                        className="pe-10"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecrets((p) => ({ ...p, [field.key]: !p[field.key] }))}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      value={(formValues[field.key] as string) ?? ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      dir="ltr"
                    />
                  )}
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </Button>
                {isConnected && (
                  <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="gap-2">
                    {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                    {testing ? "جاري الاختبار..." : "اختبار الاتصال"}
                  </Button>
                )}
              </div>

              {testResult && (
                <div className={cn("flex items-start gap-2 p-3 rounded-lg text-sm", testResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive")}>
                  {testResult.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Events Tab ── */}
        {content.events && (
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap size={16} className="text-accent" />
                  الأحداث المدعومة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {content.events.map((event) => (
                  <div key={event.name} className="p-4 rounded-lg border border-border/50 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{event.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{event.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{event.desc}</p>
                      </div>
                    </div>
                    {event.snippet && (
                      <div className="relative">
                        <pre className="text-[11px] bg-muted/50 rounded p-3 overflow-x-auto text-start font-mono" dir="ltr">
                          {event.snippet}
                        </pre>
                        <div className="absolute top-2 left-2">
                          <CopyButton text={event.snippet} label="نسخ الكود" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Test Tab ── */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical size={16} className="text-accent" />
                اختبار الإرسال
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                <p className="text-sm font-medium">حدث تجريبي</p>
                <p className="text-xs text-muted-foreground">
                  سيُرسل حدث <strong>{content.testEventName ?? "Purchase"}</strong> بقيمة 100 ريال مع order_id عشوائي.
                  {environment === "test" && " (بيئة الاختبار - Test Event Code مُفعّل إن كان مُضافاً)"}
                </p>
              </div>

              <Button onClick={handleSendTestEvent} disabled={sendingTest || !isConnected} className="gap-2">
                {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sendingTest ? "جاري الإرسال..." : "إرسال حدث تجريبي"}
              </Button>

              {!isConnected && (
                <p className="text-xs text-muted-foreground">⚠️ أعدّ التكامل أولاً من تبويب الإعداد</p>
              )}

              {testResult && (
                <div className={cn("flex items-start gap-2 p-3 rounded-lg text-sm", testResult.success ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive")}>
                  {testResult.success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                  {testResult.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent logs for test */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><History size={14} />آخر السجلات</span>
                <Button variant="ghost" size="sm" onClick={loadIntegration} className="gap-1 text-xs h-7">
                  <RefreshCw size={12} />تحديث
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات بعد</p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs flex-wrap">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", log.status_code && log.status_code < 300 ? "bg-green-500" : "bg-destructive")} />
                      <span className="font-mono font-medium">{log.event_name ?? log.action}</span>
                      <span className="text-muted-foreground">{log.status_code ? `HTTP ${log.status_code}` : ""}</span>
                      <span className="text-muted-foreground">{log.duration_ms ? `${log.duration_ms}ms` : ""}</span>
                      <span className="text-muted-foreground ms-auto">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Logs Tab ── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><History size={16} className="text-accent" />سجلات الإرسال</span>
                <Button variant="ghost" size="sm" onClick={loadIntegration} className="gap-1 text-xs h-7">
                  <RefreshCw size={12} />تحديث
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-10">
                  <History size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد سجلات بعد</p>
                </div>
              ) : (
                <div className="space-y-2 overflow-x-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 p-3 rounded-lg bg-muted/30 text-xs min-w-[500px]">
                      <span className={cn("h-2 w-2 rounded-full", log.status_code && log.status_code < 300 ? "bg-green-500" : "bg-destructive")} />
                      <div>
                        <p className="font-medium">{log.event_name ?? log.action}</p>
                        {log.response_body && <p className="text-muted-foreground truncate max-w-[300px]" dir="ltr">{log.response_body}</p>}
                      </div>
                      <span className="text-muted-foreground font-mono">{log.status_code ? `${log.status_code}` : "—"}</span>
                      <span className="text-muted-foreground">{log.duration_ms ? `${log.duration_ms}ms` : "—"}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Docs Tab ── */}
        <TabsContent value="docs" className="space-y-4">
          {content.docSections.map((section, i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-4">
                  {section.steps.map((step, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0 mt-0.5">
                        {j + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                        {step.tip && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} />
                            {step.tip}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                {section.faq.length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">الأسئلة الشائعة</p>
                    {section.faq.map((faq, k) => <FaqItem key={k} q={faq.q} a={faq.a} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Troubleshoot Tab ── */}
        <TabsContent value="troubleshoot" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench size={16} className="text-accent" />
                استكشاف الأخطاء وإصلاحها
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(content.troubleshooting ?? []).map((item, i) => (
                <div key={i} className="p-4 rounded-lg border border-border/50 space-y-2">
                  <p className="font-medium text-sm text-destructive">{item.problem}</p>
                  <p className="text-xs text-muted-foreground"><strong>السبب:</strong> {item.cause}</p>
                  <p className="text-xs text-foreground"><strong>الحل:</strong> {item.solution}</p>
                </div>
              ))}
              {(!content.troubleshooting || content.troubleshooting.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد مشاكل شائعة موثقة بعد</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Support Tab ── */}
        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones size={16} className="text-accent" />
                رفع مشكلة للدعم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">نوع المشكلة</Label>
                <Select value={supportIssue} onValueChange={setSupportIssue}>
                  <SelectTrigger dir="rtl">
                    <SelectValue placeholder="اختر نوع المشكلة" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {content.supportIssueTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">وصف المشكلة</Label>
                <Textarea
                  value={supportDesc}
                  onChange={(e) => setSupportDesc(e.target.value)}
                  placeholder="اشرح المشكلة بالتفصيل..."
                  rows={4}
                />
              </div>
              <Button onClick={handleSubmitSupport} disabled={submittingSupport} className="gap-2">
                {submittingSupport ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submittingSupport ? "جاري الإرسال..." : "إرسال الطلب"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingIntegrationPage;
