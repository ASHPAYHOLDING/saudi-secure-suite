/**
 * IntegrationDetailPage
 * ─────────────────────
 * صفحة داخلية كاملة لكل تكامل — تقرأ 100% من manifest
 * Route: /dashboard/integrations/provider/:providerId
 *
 * ✅ مصدر الحقيقة الوحيد: manifest + URL param
 * ✅ key={providerId} يفرض remount كامل عند تغيير المزود
 * ✅ لا يوجد أي محتوى مزود ثابت (hardcoded) في هذا الملف
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Key, Eye, EyeOff, Loader2, CheckCircle2, XCircle,
  Wifi, WifiOff, Copy, Link as LinkIcon, ShieldCheck, Lock,
  CreditCard, AlertTriangle, BookOpen, HelpCircle, Settings,
  ChevronDown, ChevronUp, ExternalLink, Power, PowerOff,
  CheckCircle, MinusCircle, Globe, MapPin, Banknote, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getManifest, type IntegrationManifest } from "@/integrations/manifests";

// ─── Badge mapping ────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  local:      { label: "محلي",     icon: MapPin,  color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  global:     { label: "عالمي",    icon: Globe,   color: "bg-indigo-500/10 text-indigo-700 border-indigo-200" },
  bnpl:       { label: "BNPL",     icon: Banknote, color: "bg-lime-500/10 text-lime-700 border-lime-200" },
  wallet:     { label: "محفظة",    icon: Zap,     color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  pos:        { label: "نقاط بيع", icon: CreditCard, color: "bg-orange-500/10 text-orange-700 border-orange-200" },
  ecommerce:  { label: "متجر",    icon: Globe,   color: "bg-green-500/10 text-green-700 border-green-200" },
  marketing:  { label: "تسويق",   icon: Zap,     color: "bg-pink-500/10 text-pink-700 border-pink-200" },
};

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  { q: "هل يتم حفظ مفاتيحي بنص صريح؟", a: "لا. جميع المفاتيح تُشفَّر بـ AES-256-GCM قبل التخزين." },
  { q: "هل يمكن استخدام أكثر من بوابة؟", a: "نعم. يمكنك تفعيل عدة بوابات وتحديد الافتراضية لكل فاتورة." },
  { q: "كيف أتأكد أن Webhook يعمل؟", a: "انتقل لتبويب اختبار الاتصال واضغط تشغيل الاختبار." },
  { q: "ماذا يحدث إذا تكرر نفس الحدث؟", a: "النظام يطبق Idempotency — الأحداث المكررة تُتجاهل تلقائياً." },
];

const SECURITY_FEATURES = [
  { icon: ShieldCheck, label: "تشفير AES-256-GCM", desc: "كل الأسرار مشفرة في قاعدة البيانات" },
  { icon: Lock, label: "Idempotency كاملة", desc: "منع معالجة الأحداث المكررة" },
  { icon: CheckCircle2, label: "Amount & Currency Checks", desc: "التحقق من المبلغ والعملة قبل الاعتماد" },
  { icon: Globe, label: "Tenant Isolation", desc: "عزل كامل بين البيانات" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

// ─── Main Component ───────────────────────────────────────────────────────────
const IntegrationDetailPage = () => {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);
  // Support: /dashboard/integrations/provider/:id
  const providerId = pathParts[pathParts.length - 1] || "";
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

  // ✅ manifest هو المصدر الوحيد — لا يوجد أي ALL_PROVIDERS
  const manifest = useMemo(() => getManifest(providerId), [providerId]);

  // ── Credential state ──
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "saving" | "testing" | "done" | "error">("idle");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("setup");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ── Integration state from DB ──
  const [integrationState, setIntegrationState] = useState<{
    tenant_activation_status: string;
    has_secret_configured: boolean;
    integration_id: string;
  } | null>(null);
  const [loadingState, setLoadingState] = useState(true);

  const fetchState = useCallback(async () => {
    if (!tenantId || !manifest) return;
    setLoadingState(true);
    const { data } = await (supabase as any).rpc("get_paid_integrations_state", { p_tenant_id: tenantId });
    if (data) {
      const integKey = manifest.integrationKey;
      const match = (data as any[]).find((r: any) => r.key === integKey);
      if (match) setIntegrationState(match);
    }
    setLoadingState(false);
  }, [tenantId, manifest]);

  useEffect(() => { fetchState(); }, [fetchState]);

  // ─── Validation ──────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    if (!manifest) return false;
    const errs: Record<string, string> = {};
    for (const field of manifest.fields) {
      const val = (creds[field.key] || "").trim();
      if (field.required && !val) { errs[field.key] = `${field.label} مطلوب`; }
    }
    if (manifest.webhookSecretLabel) {
      if (!webhookSecret.trim()) {
        errs["webhook_secret"] = `${manifest.webhookSecretLabel} مطلوب`;
      } else if (webhookSecret.trim().length < 8) {
        errs["webhook_secret"] = "السر قصير جداً (8 أحرف على الأقل)";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [creds, webhookSecret, manifest]);

  // ─── Save credentials ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate() || !manifest) return;
    setSaving(true);
    setSaveStep("saving");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("غير مسجّل الدخول");
      const credPayload = Object.fromEntries(Object.entries(creds).map(([k, v]) => [k, v.trim()]));
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: manifest.providerId, credentials: credPayload, webhookSecret: webhookSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");

      setSaveStep("testing");
      const testRes = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: manifest.providerId }),
      });
      const testData = await testRes.json();
      setTestResult({ success: testData.success, message: testData.message });
      setSaveStep("done");
      toast({
        title: testData.success ? "تم الحفظ والاختبار بنجاح ✅" : "تم الحفظ — الاختبار فشل",
        description: testData.success
          ? `${manifest.name} جاهزة لاستقبال المدفوعات`
          : "تم حفظ البيانات. تحقق من المفاتيح وأعد الاختبار.",
        variant: testData.success ? "default" : "destructive",
      });
      fetchState();
    } catch (err: any) {
      setSaveStep("error");
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDeactivate = async () => {
    if (!integrationState || !tenantId) return;
    if (!confirm("هل تريد إيقاف هذا التكامل؟")) return;
    await (supabase as any)
      .from("tenant_paid_integrations")
      .update({ status: "disabled" })
      .eq("tenant_id", tenantId)
      .eq("integration_id", integrationState.integration_id);
    toast({ title: "تم إيقاف التكامل" });
    fetchState();
  };

  const webhookUrl = useMemo(() => {
    if (!manifest?.webhookPath) return "";
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co${manifest.webhookPath}`;
  }, [manifest?.webhookPath]);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "تم نسخ Webhook URL ✓" });
  };

  const toggleSecret = (key: string) => setShowSecrets((p) => ({ ...p, [key]: !p[key] }));

  const isActive = integrationState?.tenant_activation_status === "active";
  const hasSecret = integrationState?.has_secret_configured ?? false;

  // ─── Not found ─────────────────────────────────────────────────────────────
  if (!manifest) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <AlertTriangle size={48} className="mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">المزود "{providerId}" غير موجود في النظام.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/dashboard/integrations")}>
          <ArrowRight size={16} /> رجوع للتكاملات
        </Button>
      </div>
    );
  }

  const badgeList = manifest.badges || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/dashboard/integrations")} className="hover:text-foreground transition-colors">التكاملات</button>
        <span>/</span>
        <span>{manifest.category === "payment" ? "بوابات الدفع" : manifest.category}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{manifest.name}</span>
      </nav>

      {/* ── Header ── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Button variant="ghost" size="sm" className="gap-2 mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate("/dashboard/integrations")}>
          <ArrowRight size={16} /> رجوع للتكاملات
        </Button>

        <Card className="overflow-hidden border-border/50">
          <div className="h-1.5 bg-gradient-to-l from-primary/40 via-accent/50 to-primary/20" />
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                {manifest.logoPath ? (
                  <img src={manifest.logoPath} alt={manifest.nameEn} className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${manifest.color || "from-accent/10 to-accent/5"} flex items-center justify-center`}>
                    <Settings size={20} className="text-accent" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-foreground">{manifest.name}</h1>
                  <span className="text-sm text-muted-foreground" dir="ltr">{manifest.nameEn}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {badgeList.map((badge) => {
                    const cfg = BADGE_CONFIG[badge];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return (
                      <Badge key={badge} variant="outline" className={cn("text-xs border", cfg.color)}>
                        <Icon size={10} className="me-1" />{cfg.label}
                      </Badge>
                    );
                  })}
                  {isActive ? (
                    <Badge className="text-xs bg-accent/10 text-accent border-accent/20 border">
                      <Wifi size={10} className="me-1" /> متصل ونشط
                    </Badge>
                  ) : hasSecret ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-border bg-muted/40">
                      <Settings size={10} className="me-1" /> تم الإعداد — غير نشط
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <WifiOff size={10} className="me-1" /> غير متصل
                    </Badge>
                  )}
                </div>
                {manifest.description && <p className="text-sm text-muted-foreground leading-relaxed">{manifest.description}</p>}
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {isActive && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleDeactivate}>
                    <PowerOff size={14} /> إيقاف التكامل
                  </Button>
                )}
                {manifest.docsUrl && (
                  <a href={manifest.docsUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 w-full"><ExternalLink size={14} /> التوثيق الرسمي</Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="setup" className="rounded-lg gap-1.5 text-xs sm:text-sm"><Key size={14} /> الإعدادات</TabsTrigger>
          <TabsTrigger value="webhook" className="rounded-lg gap-1.5 text-xs sm:text-sm"><LinkIcon size={14} /> Webhook والأمان</TabsTrigger>
          <TabsTrigger value="test" className="rounded-lg gap-1.5 text-xs sm:text-sm"><Wifi size={14} /> اختبار الاتصال</TabsTrigger>
          <TabsTrigger value="guide" className="rounded-lg gap-1.5 text-xs sm:text-sm"><BookOpen size={14} /> دليل الاستخدام</TabsTrigger>
          <TabsTrigger value="faq" className="rounded-lg gap-1.5 text-xs sm:text-sm"><HelpCircle size={14} /> الأسئلة الشائعة</TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: الإعدادات ═══ */}
        <TabsContent value="setup">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader className="pb-4"><CardTitle className="text-base flex items-center gap-2"><Key size={16} className="text-accent" />بيانات الربط — {manifest.nameEn}</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted-foreground">
                    <Lock size={13} className="mt-0.5 shrink-0 text-accent" />
                    <span>جميع البيانات تُشفَّر بـ AES-256-GCM قبل التخزين.</span>
                  </div>

                  {manifest.fields.map((field) => (
                    <div key={`${manifest.providerId}-${field.key}`} className="space-y-1.5">
                      <Label className="text-xs font-medium">{field.label}{field.required && <span className="text-destructive ms-1">*</span>}</Label>
                      <div className="relative">
                        <Input
                          dir="ltr"
                          type={field.type === "password" && !showSecrets[field.key] ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={creds[field.key] || ""}
                          onChange={(e) => { setCreds((p) => ({ ...p, [field.key]: e.target.value })); if (fieldErrors[field.key]) setFieldErrors((p) => { const n = { ...p }; delete n[field.key]; return n; }); }}
                          className={cn("font-mono text-sm", field.type === "password" && "pe-10", fieldErrors[field.key] && "border-destructive")}
                          autoComplete="off"
                        />
                        {field.type === "password" && (
                          <button type="button" onClick={() => toggleSecret(field.key)} className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground" tabIndex={-1}>
                            {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                      {fieldErrors[field.key] && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors[field.key]}</p>}
                      {field.hint && !fieldErrors[field.key] && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
                    </div>
                  ))}

                  {manifest.webhookSecretLabel && (
                    <div className="space-y-1.5 pt-2 border-t border-border/50">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-accent" />{manifest.webhookSecretLabel}
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 py-0">مطلوب</Badge>
                      </Label>
                      <div className="relative">
                        <Input dir="ltr" type={showSecrets["ws"] ? "text" : "password"} placeholder="السر المشترك" value={webhookSecret} onChange={(e) => { setWebhookSecret(e.target.value); if (fieldErrors["webhook_secret"]) setFieldErrors((p) => { const n = { ...p }; delete n["webhook_secret"]; return n; }); }} className={cn("font-mono text-sm pe-10", fieldErrors["webhook_secret"] && "border-destructive")} autoComplete="off" />
                        <button type="button" onClick={() => toggleSecret("ws")} className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground" tabIndex={-1}>
                          {showSecrets["ws"] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {fieldErrors["webhook_secret"] ? <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={11} /> {fieldErrors["webhook_secret"]}</p> : manifest.webhookSecretHint && <p className="text-[11px] text-muted-foreground">{manifest.webhookSecretHint}</p>}
                    </div>
                  )}

                  <AnimatePresence>
                    {saveStep === "done" && testResult && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", testResult.success ? "bg-accent/10 border-accent/20 text-accent" : "bg-destructive/10 border-destructive/20 text-destructive")}>
                        {testResult.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{testResult.message}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-3 pt-2">
                    <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
                      {saving ? <><Loader2 size={15} className="animate-spin" />{saveStep === "saving" ? "جاري الحفظ..." : "جاري الاختبار..."}</> : <><Key size={15} />{hasSecret ? "تحديث وإعادة الاختبار" : "حفظ واختبار الاتصال"}</>}
                    </Button>
                    {isActive && <Button variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleDeactivate}><PowerOff size={14} /> تعطيل</Button>}
                  </div>

                  {saving && (
                    <div className="space-y-2">
                      <Progress value={saveStep === "saving" ? 40 : saveStep === "testing" ? 75 : 100} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className={cn(saveStep !== "idle" && "text-accent font-medium")}>التحقق</span>
                        <span className={cn((saveStep === "saving" || saveStep === "testing" || saveStep === "done") && "text-accent font-medium")}>حفظ آمن</span>
                        <span className={cn((saveStep === "testing" || saveStep === "done") && "text-accent font-medium")}>اختبار</span>
                        <span className={cn(saveStep === "done" && "text-accent font-medium")}>مفعّل</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BookOpen size={14} className="text-accent" />كيف تحصل على المفاتيح؟</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[`ادخل على لوحة تحكم ${manifest.nameEn}`, "انتقل إلى Developer / API", "انسخ المفاتيح المطلوبة", "الصقها وانقر حفظ"].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
                    </div>
                  ))}
                  {manifest.docsUrl && (
                    <a href={manifest.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent hover:underline pt-1">
                      <ExternalLink size={12} /> دليل الإعداد الرسمي
                    </a>
                  )}
                </CardContent>
              </Card>

              {manifest.supportedMethods && manifest.supportedMethods.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><CreditCard size={14} className="text-accent" />طرق الدفع المدعومة</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {manifest.supportedMethods.map((m) => <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>)}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!loadingState && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Power size={14} className="text-accent" />حالة التكامل</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">الحالة</span>
                      {isActive ? <Badge className="text-xs bg-accent/10 text-accent border border-accent/20"><CheckCircle size={9} className="me-1" /> نشط</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground"><MinusCircle size={9} className="me-1" /> غير نشط</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">المفاتيح</span>
                      {hasSecret ? <Badge className="text-xs bg-accent/10 text-accent border-accent/20 border"><Lock size={9} className="me-1" /> مشفّرة ✓</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">لم تُضَف بعد</Badge>}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ TAB 2: Webhook ═══ */}
        <TabsContent value="webhook">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardHeader className="pb-4"><CardTitle className="text-base flex items-center gap-2"><LinkIcon size={16} className="text-accent" />رابط الـ Webhook</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">أضف هذا الرابط في إعدادات {manifest.nameEn}.</p>
                  <div className="rounded-xl bg-muted/60 border p-4 space-y-3">
                    <p className="text-[11px] text-muted-foreground font-medium">Webhook URL:</p>
                    <p className="text-xs font-mono break-all text-foreground bg-background rounded-lg p-2 border" dir="ltr">{webhookUrl || "سيظهر بعد تسجيل الدخول"}</p>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={copyWebhook} disabled={!webhookUrl}>
                      {copied ? <CheckCircle2 size={12} className="text-accent" /> : <Copy size={12} />}{copied ? "تم النسخ ✓" : "نسخ الرابط"}
                    </Button>
                  </div>
                  {manifest.webhookSignatureHeader && (
                    <div className="rounded-xl bg-muted/40 border p-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Header التوقيع:</p>
                      <code className="text-sm font-mono text-foreground bg-background rounded-lg px-3 py-2 block border" dir="ltr">{manifest.webhookSignatureHeader}</code>
                    </div>
                  )}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                    <span>HMAC-SHA256 + timing-safe comparison + نافذة زمنية 5 دقائق لمنع Replay Attacks.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck size={14} className="text-accent" />ضمانات الأمان</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {SECURITY_FEATURES.map((feat) => (
                    <div key={feat.label} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5"><feat.icon size={13} className="text-accent" /></div>
                      <div><p className="text-xs font-medium text-foreground">{feat.label}</p><p className="text-[11px] text-muted-foreground">{feat.desc}</p></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══ TAB 3: اختبار الاتصال ═══ */}
        <TabsContent value="test">
          <Card>
            <CardHeader className="pb-4"><CardTitle className="text-base flex items-center gap-2"><Wifi size={16} className="text-accent" />اختبار الاتصال</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {!hasSecret && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 border text-muted-foreground text-sm">
                  <AlertTriangle size={15} className="shrink-0" />لم يتم إعداد المفاتيح بعد.
                </div>
              )}
              {testResult && (
                <div className={cn("flex items-center gap-2 p-3 rounded-lg text-sm border", testResult.success ? "bg-accent/10 border-accent/20 text-accent" : "bg-destructive/10 border-destructive/20 text-destructive")}>
                  {testResult.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{testResult.message}
                </div>
              )}
              {manifest.commonErrors && manifest.commonErrors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">أخطاء شائعة — {manifest.nameEn}</h4>
                  {manifest.commonErrors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30 border border-border/50 text-xs">
                      <code className="text-destructive font-mono shrink-0">{err.code}</code>
                      <span className="text-muted-foreground">→ {err.fix}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB 4: دليل الاستخدام — من manifest.docsSections ═══ */}
        <TabsContent value="guide">
          {manifest.docsSections.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">لا يوجد دليل متاح لهذا المزود بعد</p>
          ) : (
            <div className="space-y-6">
              {manifest.docsSections.map((section, si) => (
                <Card key={`${manifest.providerId}-guide-${si}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><BookOpen size={14} className="text-accent" />{section.title}</CardTitle>
                      {section.officialLink && (
                        <a href={section.officialLink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">
                          {section.officialLinkLabel || "الوثائق الرسمية"}<ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {section.steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{step.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
                          {step.tip && <p className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 mt-1.5">💡 {step.tip}</p>}
                        </div>
                      </div>
                    ))}
                    {section.faq.length > 0 && (
                      <div className="pt-3 border-t border-border/50 space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground">الأسئلة الشائعة</h4>
                        {section.faq.map((item, i) => (
                          <div key={i} className="space-y-1">
                            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between text-xs text-start font-medium hover:text-accent">
                              <span>{item.q}</span>{openFaq === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {openFaq === i && <p className="text-xs text-muted-foreground ps-2">{item.a}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB 5: FAQ عامة ═══ */}
        <TabsContent value="faq">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><HelpCircle size={16} className="text-accent" />الأسئلة الشائعة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
                  <button onClick={() => setOpenFaq(openFaq === (100 + i) ? null : 100 + i)} className="flex w-full items-center justify-between text-sm text-start font-medium hover:text-accent py-1">
                    <span>{item.q}</span>{openFaq === 100 + i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {openFaq === 100 + i && <p className="text-sm text-muted-foreground ps-2 pt-1">{item.a}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationDetailPage;
