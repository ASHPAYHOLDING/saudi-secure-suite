/**
 * ProviderDetailPage — صفحة تفاصيل مزود التكامل
 *
 * ✅ مصدر الحقيقة الوحيد: URL pathname
 *    Route: /dashboard/integrations/:category/:provider
 *    segments بعد split+filter: [dashboard, integrations, category, provider]
 *
 * ✅ key={location.pathname} في Dashboard يُعيد mount هذا الـ component عند كل تغيير route
 * ✅ كل sub-component يحمل key={providerId} لمنع أي state قديم
 * ✅ queryKey تشمل [tenantId, category, providerId] — لا cache مشترك
 * ✅ لا fallback — manifest غير موجود = NotFound واضحة
 */

import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Copy, ExternalLink, Wifi, WifiOff, BookOpen, Headphones,
  Settings2, Info, ChevronDown, ChevronUp, ClipboardCopy,
  Send, AlertCircle, Zap, History, RefreshCw, Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getManifest, type IntegrationManifest } from "@/integrations/manifests";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

// ── مكون FAQ ──────────────────────────────────────────────────────────────────
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-3 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── مكون نسخ ──────────────────────────────────────────────────────────────────
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
    >
      {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
};

// ── Tab 1: الإعداد والتفعيل ────────────────────────────────────────────────────
// key={`setup-tab-${providerId}`} على هذا المكون يُعيد mount كل state عند تغيير المزود
const SetupTab = ({
  manifest, tenantId, providerId, category,
}: { manifest: IntegrationManifest; tenantId: string; providerId: string; category: string }) => {
  // ✅ كل state هنا يُعاد إنشاؤه من الصفر عند كل mount جديد (بسبب key prop)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");

  const webhookUrl = useMemo(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return manifest.webhookPath
      ? `https://${projectId}.supabase.co${manifest.webhookPath}`
      : "";
  }, [manifest.webhookPath]);

  // تأكد أن الـ providerId في هذا المكون يطابق manifest.providerId
  // (يجب أن يكونا متطابقَين دائماً بسبب key prop من الأب)
  useEffect(() => {
    if (providerId !== manifest.providerId) {
      console.warn(`[SetupTab] providerId mismatch: param=${providerId}, manifest=${manifest.providerId}`);
    }
  }, [providerId, manifest.providerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provider-save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tenant_id: tenantId, provider: manifest.providerId, credentials: fieldValues }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ في الحفظ");
      toast({ title: "✅ تم حفظ الإعدادات بأمان" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    // تحقق أن هذا المزود يدعم اختبار الاتصال عبر edge function
    if (!manifest.supportsConnectionTest) {
      toast({
        title: "اختبار الاتصال غير متاح",
        description: `مزود ${manifest.nameEn} لا يدعم اختبار الاتصال التلقائي حالياً. تحقق من صحة بياناتك يدوياً.`,
        variant: "destructive",
      });
      return;
    }
    setTestStatus("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provider-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tenant_id: tenantId, provider: manifest.providerId }),
        }
      );
      const data = await res.json();
      const success = res.ok && data.success;
      setTestStatus(success ? "success" : "failed");
      await supabase.from("connection_test_logs" as any).insert({
        tenant_id: tenantId, category, provider: manifest.providerId,
        status: success ? "success" : "failed", details: data,
      });
      if (success) toast({ title: "✅ اتصال ناجح!" });
      else toast({ title: "❌ فشل الاتصال", description: data.error || "تحقق من بيانات الاعتماد", variant: "destructive" });
    } catch (err: any) {
      setTestStatus("failed");
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const allRequiredFilled = manifest.fields.filter((f) => f.required).every((f) => !!fieldValues[f.key]?.trim());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 size={18} className="text-accent" />
            بيانات الربط — {manifest.nameEn}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {manifest.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد حقول إعداد لهذا المزود</p>
          ) : (
            manifest.fields.map((field) => (
              <div key={`${manifest.providerId}-${field.key}`} className="space-y-1.5">
                <Label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ms-1">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    type={field.type === "password" && !showSecret[field.key] ? "password" : "text"}
                    placeholder={field.placeholder}
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    dir="ltr"
                    className="text-left font-mono"
                  />
                  {field.type === "password" && (
                    <button
                      type="button"
                      className="absolute inset-y-0 start-3 flex items-center text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                    >
                      {showSecret[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
                {field.hint && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {field.hint}
                  </p>
                )}
              </div>
            ))
          )}

          <div className="flex gap-3 pt-2 flex-wrap">
            <Button onClick={handleSave} disabled={saving || !allRequiredFilled} className="gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              حفظ الإعدادات
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testStatus === "testing"} className="gap-2">
              {testStatus === "testing" ? <Loader2 size={15} className="animate-spin" /> :
               testStatus === "success" ? <Wifi size={15} className="text-green-500" /> :
               testStatus === "failed" ? <WifiOff size={15} className="text-destructive" /> :
               <Wifi size={15} />}
              اختبار الاتصال
            </Button>
          </div>
        </CardContent>
      </Card>

      {webhookUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              Webhook URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              أضف هذا الرابط كـ Webhook في لوحة تحكم {manifest.nameEn}:
            </p>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 border border-border/50">
              <code className="text-xs flex-1 break-all font-mono text-foreground" dir="ltr">{webhookUrl}</code>
              <CopyButton text={webhookUrl} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Tab 2: دليل المزود ────────────────────────────────────────────────────────
// يقرأ من manifest.docsSections — محتوى خاص بكل مزود
const GuideTab = ({ manifest }: { manifest: IntegrationManifest }) => (
  <div className="space-y-6">
    {manifest.docsSections.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-10">لا يوجد دليل متاح لهذا المزود بعد</p>
    ) : (
      manifest.docsSections.map((section, si) => (
        <div key={`${manifest.providerId}-section-${si}`} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <BookOpen size={16} className="text-accent" />
              {section.title}
            </h3>
            {section.officialLink && (
              <a href={section.officialLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline">
                {section.officialLinkLabel || "الوثائق الرسمية"}
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent font-bold text-sm shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                  {step.tip && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1.5">
                      <Info size={11} className="mt-0.5 shrink-0" />
                      {step.tip}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {section.faq.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">الأسئلة الشائعة</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {section.faq.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
              </CardContent>
            </Card>
          )}
        </div>
      ))
    )}
  </div>
);

// ── Tab 3: اختبار الاتصال ─────────────────────────────────────────────────────
// key={`test-tab-${providerId}`} — queryKey يشمل providerId لمنع cache مزود آخر
const TestTab = ({
  manifest, tenantId, providerId, category,
}: { manifest: IntegrationManifest; tenantId: string; providerId: string; category: string }) => {
  const queryClient = useQueryClient();
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [lastResult, setLastResult] = useState<any>(null);

  // ✅ queryKey يشمل [tenantId, category, providerId] — لا cache مشترك بين providers
  const { data: testLogs, isLoading, refetch } = useQuery({
    queryKey: ["integration-test-logs", tenantId, category, providerId],
    queryFn: async () => {
      const { data } = await supabase
        .from("connection_test_logs" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", providerId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!tenantId && !!providerId,
    staleTime: 0, // لا cache — دائماً من الخادم
    gcTime: 0,    // ✅ لا يحتفظ بالبيانات في الذاكرة بعد unmount
  });

  const runTest = async () => {
    // تحقق أن هذا المزود يدعم اختبار الاتصال التلقائي
    if (!manifest.supportsConnectionTest) {
      toast({
        title: "اختبار الاتصال غير متاح",
        description: `مزود ${manifest.nameEn} لا يدعم اختبار الاتصال التلقائي حالياً.`,
        variant: "destructive",
      });
      return;
    }
    setTestStatus("testing");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provider-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tenant_id: tenantId, provider: providerId }),
        }
      );
      const data = await res.json();
      const success = res.ok && data.success;
      setTestStatus(success ? "success" : "failed");
      setLastResult(data);
      await supabase.from("connection_test_logs" as any).insert({
        tenant_id: tenantId, category, provider: providerId,
        status: success ? "success" : "failed", details: data,
      });
      // ✅ إبطال cache لهذا المزود فقط
      queryClient.invalidateQueries({ queryKey: ["integration-test-logs", tenantId, category, providerId] });
      if (success) toast({ title: "✅ اتصال ناجح!" });
      else toast({ title: "❌ فشل الاتصال", description: data.error, variant: "destructive" });
    } catch (err: any) {
      setTestStatus("failed");
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi size={16} className="text-accent" />
            اختبار الاتصال — {manifest.nameEn}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={runTest} disabled={testStatus === "testing"} className="gap-2">
              {testStatus === "testing" ? <Loader2 size={15} className="animate-spin" /> :
               testStatus === "success" ? <CheckCircle2 size={15} className="text-green-500" /> :
               testStatus === "failed" ? <XCircle size={15} className="text-destructive" /> :
               <Wifi size={15} />}
              {testStatus === "testing" ? "جاري الاختبار..." : "اختبر الاتصال الآن"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw size={14} />
              تحديث السجلات
            </Button>
          </div>

          {testStatus !== "idle" && lastResult && (
            <div className={cn(
              "rounded-lg border p-4 text-sm",
              testStatus === "success" ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" :
              "bg-destructive/5 border-destructive/20"
            )}>
              <p className="font-medium mb-2 flex items-center gap-2">
                {testStatus === "success" ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-destructive" />}
                {testStatus === "success" ? "الاتصال ناجح" : "فشل الاتصال"}
              </p>
              {lastResult.error && <p className="text-muted-foreground text-xs">{lastResult.error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل الاختبارات السابقة */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <History size={14} />
            سجل الاختبارات السابقة ({manifest.nameEn})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : !testLogs || testLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد سجلات اختبار لهذا المزود بعد</p>
          ) : (
            <div className="space-y-2">
              {(testLogs as any[]).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    {log.status === "success"
                      ? <CheckCircle2 size={14} className="text-green-500" />
                      : <XCircle size={14} className="text-destructive" />}
                    <span className="text-sm">{log.status === "success" ? "ناجح" : "فاشل"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {log.created_at ? format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ar }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ── Tab 3.5: استكشاف الأخطاء (Troubleshooting) ───────────────────────────────
const TroubleshootingTab = ({ manifest }: { manifest: IntegrationManifest }) => {
  const [copiedDiag, setCopiedDiag] = useState(false);
  const { tenantId } = useAuth();

  const copyDiagnostics = () => {
    const info = {
      provider: manifest.providerId,
      provider_name: manifest.nameEn,
      tenant_id: tenantId ? `${tenantId.slice(0, 8)}...` : "unknown",
      collected_at: new Date().toISOString(),
      note: "No secrets included",
    };
    navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2000);
    toast({ title: "✅ تم نسخ معلومات التشخيص" });
  };

  const items = manifest.troubleshootingItems;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-accent" />
          <h3 className="font-semibold text-foreground">استكشاف الأخطاء الشائعة — {manifest.nameEn}</h3>
        </div>
        <Button variant="outline" size="sm" onClick={copyDiagnostics} className="gap-2 text-xs">
          {copiedDiag ? <CheckCircle2 size={13} className="text-green-500" /> : <ClipboardCopy size={13} />}
          {copiedDiag ? "تم النسخ" : "نسخ معلومات التشخيص"}
        </Button>
      </div>

      {!items || items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">لا توجد مشاكل موثّقة لهذا المزود بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="font-semibold text-sm text-foreground">{item.problem}</p>
                  </div>
                  <div className="ms-5 space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">السبب: </span>
                      {item.cause}
                    </p>
                    <div className="flex items-start gap-1.5 bg-accent/5 border border-accent/10 rounded px-2.5 py-1.5">
                      <CheckCircle2 size={12} className="text-accent mt-0.5 shrink-0" />
                      <p className="text-xs text-foreground/80">
                        <span className="font-medium">الحل: </span>
                        {item.solution}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Tab 4: الدعم ورفع مشكلة ─────────────────────────────────────────────────
// key={`support-tab-${providerId}`} — كل state يُعاد من الصفر عند تغيير المزود
const SupportTab = ({
  manifest, tenantId, providerId, category,
}: { manifest: IntegrationManifest; tenantId: string; providerId: string; category: string }) => {
  // ✅ كل state هنا يبدأ نظيفاً بسبب key prop من الأب
  const [issueType, setIssueType] = useState("");
  const [message, setMessage] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const collectDiagnostics = async () => {
    setCollecting(true);
    try {
      // ✅ filter بـ provider محدد — لا بيانات مزود آخر
      const { data: testLogs } = await supabase
        .from("connection_test_logs" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", manifest.providerId)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: providerData } = await (supabase as any)
        .from("tenant_payment_providers")
        .select("provider, is_active, environment, fee_percent, fee_fixed, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .eq("provider", manifest.providerId)
        .maybeSingle();

      const report = {
        provider: manifest.providerId,
        provider_name: manifest.nameEn,
        category,
        collected_at: new Date().toISOString(),
        connection_test_logs: (testLogs || []).slice(0, 5),
        provider_config: providerData
          ? { ...providerData, credentials: "*** MASKED ***" }
          : null,
      };

      setDiagnostics(report);
      toast({ title: "✅ تم جمع بيانات التشخيص" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setCollecting(false);
  };

  const handleSubmit = async () => {
    if (!issueType || !message.trim()) {
      toast({ title: "يرجى اختيار نوع المشكلة وكتابة الوصف", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("integration_support_tickets" as any)
        .insert({
          tenant_id: tenantId,
          category,
          provider: manifest.providerId,
          issue_type: issueType,
          message: message.trim(),
          diagnostics: diagnostics || null,
        });
      if (error) throw error;
      toast({ title: "✅ تم إرسال تذكرة الدعم", description: "سيتواصل معك فريق الدعم قريباً" });
      setIssueType("");
      setMessage("");
      setDiagnostics(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Headphones size={16} className="text-accent" />
            رفع تذكرة دعم — {manifest.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>نوع المشكلة</Label>
            {/* ✅ key على Select يُعيد ضبطه عند تغيير providerId */}
            <Select key={`issue-select-${manifest.providerId}`} value={issueType} onValueChange={setIssueType}>
              <SelectTrigger>
                <SelectValue placeholder="اختر نوع المشكلة..." />
              </SelectTrigger>
              <SelectContent>
                {manifest.supportIssueTypes.length === 0 ? (
                  <SelectItem value="_none" disabled>لا توجد أنواع محددة</SelectItem>
                ) : (
                  manifest.supportIssueTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>وصف المشكلة</Label>
            <Textarea
              placeholder={`صف المشكلة التي تواجهها مع ${manifest.name} بالتفصيل...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertCircle size={14} className="text-amber-500" />
              بيانات التشخيص التلقائي
            </p>
            <p className="text-xs text-muted-foreground">
              يجمع سجلات {manifest.nameEn} فقط. لا تُعرض أي أسرار أو مفاتيح.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={collectDiagnostics} disabled={collecting} className="gap-2 text-xs">
                {collecting ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                جمع التشخيص تلقائياً
              </Button>
              {diagnostics && (
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2)); toast({ title: "✅ تم نسخ التقرير" }); }} className="gap-2 text-xs">
                  <ClipboardCopy size={13} />
                  نسخ التقرير
                </Button>
              )}
            </div>
            {diagnostics && (
              <div className="mt-2 rounded-md bg-muted/50 border border-border/50 p-3 max-h-40 overflow-auto">
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                  {JSON.stringify(diagnostics, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !issueType || !message.trim()} className="gap-2 w-full">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            إرسال تذكرة الدعم
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
/**
 * ✅ مسار موحّد: /dashboard/integrations/:key
 *    يُعاد mount بالكامل عند كل تغيير route بفضل key={location.pathname}
 */
const ProviderDetailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState("setup");

  // ✅ المصدر الوحيد: آخر segment من URL = providerId
  // /dashboard/integrations/tap → "tap"
  // /dashboard/integrations/payment/tap → "tap" (legacy redirect compat)
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const providerParam = pathSegments[pathSegments.length - 1] ?? "";

  // ✅ تحميل manifest بدون أي fallback — null = NotFound
  const manifest: IntegrationManifest | null = useMemo(
    () => (providerParam ? getManifest(providerParam) : null),
    [providerParam]
  );
  
  // category من manifest دائماً
  const effectiveCategory = manifest?.category || "";

  // ── صفحة NotFound واضحة ─────────────────────────────────────────────────────
  if (!manifest || !providerParam) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center" dir="rtl">
        <AlertCircle size={48} className="text-muted-foreground/30" />
        <div>
          <p className="font-medium text-foreground text-lg">لم يُعثر على هذا المزود</p>
          <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block font-mono">
            {location.pathname}
          </code>
          <p className="text-sm text-muted-foreground mt-2">
            المزود "<strong>{providerParam || "غير محدد"}</strong>" غير مسجّل في النظام.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/integrations")} className="gap-2">
          <ArrowRight size={16} />
          العودة للتكاملات
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground shrink-0">
          <ArrowRight size={16} />
          رجوع
        </Button>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {manifest.logoPath ? (
            <img
              src={manifest.logoPath}
              alt={manifest.nameEn}
              className="h-10 w-10 object-contain rounded-lg shrink-0 bg-background border border-border/30 p-1"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${manifest.color || "from-accent/10 to-accent/5"} flex items-center justify-center shrink-0`}>
              <Settings2 size={20} className="text-accent" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight">{manifest.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-sm text-muted-foreground">{manifest.nameEn}</span>
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                {manifest.providerId}
              </code>
            </div>
          </div>
          <Badge variant="outline" className="ms-auto capitalize shrink-0">{effectiveCategory}</Badge>
        </div>
      </motion.div>

      {/* ── Overview: Description + Benefits + Requirements ── */}
      {(manifest.description || manifest.benefits?.length || manifest.requirements?.length) && (
        <Card>
          <CardContent className="p-5 space-y-4">
            {manifest.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{manifest.description}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {manifest.benefits && manifest.benefits.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Zap size={12} className="text-accent" />
                    الفوائد
                  </h4>
                  <ul className="space-y-1">
                    {manifest.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {manifest.requirements && manifest.requirements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Info size={12} className="text-amber-500" />
                    المتطلبات
                  </h4>
                  <ul className="space-y-1">
                    {manifest.requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertCircle size={11} className="mt-0.5 shrink-0 text-amber-500/70" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ Debug bar — وضع التطوير فقط (مخفي للمستخدم العادي) */}
      {import.meta.env.DEV && (
        <div className="text-[10px] text-muted-foreground/50 font-mono bg-muted/30 px-2 py-1 rounded border border-dashed border-border/30 select-none">
          DEV ▸ provider=<strong>{manifest.providerId}</strong> | category={effectiveCategory} | fields={manifest.fields.length} | guide={manifest.docsSections.length} | support={manifest.supportIssueTypes.length} | tenant={tenantId?.slice(0, 8)}
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full grid grid-cols-4 h-11">
          <TabsTrigger value="setup" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 size={14} />
            الإعداد
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5 text-xs sm:text-sm">
            <BookOpen size={14} />
            الدليل
          </TabsTrigger>
          <TabsTrigger value="troubleshoot" className="gap-1.5 text-xs sm:text-sm">
            <Wrench size={14} />
            استكشاف الأخطاء
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5 text-xs sm:text-sm">
            <Headphones size={14} />
            الدعم
          </TabsTrigger>
        </TabsList>

        {/* ✅ key على كل Tab component يضمن full remount + state reset عند تغيير المزود */}
        <TabsContent value="setup" className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`setup-${manifest.providerId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <SetupTab
                key={`setup-tab-${manifest.providerId}`}
                manifest={manifest}
                tenantId={tenantId!}
                providerId={manifest.providerId}
                category={effectiveCategory}
              />
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="guide" className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`guide-${manifest.providerId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <GuideTab key={`guide-tab-${manifest.providerId}`} manifest={manifest} />
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="troubleshoot" className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`troubleshoot-${manifest.providerId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <TroubleshootingTab key={`troubleshoot-tab-${manifest.providerId}`} manifest={manifest} />
            </motion.div>
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`support-${manifest.providerId}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <SupportTab
                key={`support-tab-${manifest.providerId}`}
                manifest={manifest}
                tenantId={tenantId!}
                providerId={manifest.providerId}
                category={effectiveCategory}
              />
            </motion.div>
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProviderDetailPage;
