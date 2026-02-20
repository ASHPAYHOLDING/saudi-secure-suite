import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Shield, Zap, Lock, CheckCircle2, XCircle,
  Settings2, TestTube2, Plus, Filter, AlertTriangle,
  ExternalLink, Globe, CreditCard,
  Sparkles, ArrowRight, Eye, EyeOff, Power, PowerOff,
  Clock, Webhook, Key, RefreshCw, CheckCheck, ChevronDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/payments/BrandLogo";

/* ─── Types ─────────────────────────────────────────────── */
type ProviderStatus = "disconnected" | "connected" | "tested" | "active" | "disabled";

interface ProviderRecord {
  id?: string;
  status: ProviderStatus;
  last_tested_at: string | null;
  has_webhook_secret: boolean;
  has_api_key: boolean;
  has_secret_key: boolean;
  last_webhook_at?: string | null;
  signature_verified?: boolean;
}

interface ProviderDef {
  key: "paytabs" | "myfatoorah" | "telr" | "paypal" | "tabby" | "tamara";
  label: string;
  labelAr: string;
  tagline: string;
  description: string;
  website: string;
  accentColor: string;
  category: "local" | "global" | "bnpl";
  methods: string[];
  featured?: boolean;
  popularity?: number;
  fieldLabels?: {
    apiKey?: string;
    secretKey?: string;
    webhookSecret?: string;
  };
}

/* ─── Provider catalog ───────────────────────────────────── */
const PROVIDERS: ProviderDef[] = [
  {
    key: "paytabs",
    label: "PayTabs",
    labelAr: "بيتابس",
    tagline: "بوابة الشرق الأوسط الشاملة",
    description: "شركة تقنية مالية رائدة في منطقة الشرق الأوسط وأفريقيا. تقدم حلول دفع شاملة مع دعم لأكثر من 168 عملة وتكامل سريع مع متاجر الإنترنت.",
    website: "https://www.paytabs.com",
    accentColor: "#1A3C78",
    category: "local",
    methods: ["مدى", "فيزا", "ماستركارد", "Apple Pay", "SADAD", "KNET"],
    featured: true,
    popularity: 5,
    fieldLabels: { apiKey: "Profile ID", secretKey: "Server Key", webhookSecret: "Webhook Secret" },
  },
  {
    key: "myfatoorah",
    label: "MyFatoorah",
    labelAr: "ماي فاتورة",
    tagline: "بوابة الكويت والخليج",
    description: "منصة فاتورة إلكترونية ومدفوعات رائدة في الكويت والخليج. تدعم KNET والبطاقات المحلية والدولية مع واجهة عربية متكاملة وFatoorahPay.",
    website: "https://myfatoorah.com",
    accentColor: "#00B4A0",
    category: "local",
    methods: ["KNET", "مدى", "فيزا", "ماستركارد", "Apple Pay", "Benefit"],
    popularity: 4,
    fieldLabels: { apiKey: "API Token", webhookSecret: "Webhook Secret" },
  },
  {
    key: "telr",
    label: "Telr",
    labelAr: "تيلر",
    tagline: "بوابة الإمارات والشرق الأوسط",
    description: "بوابة دفع رائدة في الإمارات وجنوب آسيا. تقدم حلول متكاملة للبطاقات ومحافظ الدفع الرقمية مع دعم قوي لمنطقة الإمارات والخليج.",
    website: "https://telr.com",
    accentColor: "#CC0000",
    category: "local",
    methods: ["فيزا", "ماستركارد", "Apple Pay", "بطاقات محلية"],
    popularity: 3,
    fieldLabels: { apiKey: "Store ID", secretKey: "Auth Key", webhookSecret: "Webhook Key" },
  },
  {
    key: "paypal",
    label: "PayPal",
    labelAr: "باي بال",
    tagline: "المدفوعات الدولية الأشهر",
    description: "منصة الدفع الإلكتروني الأشهر عالمياً مع أكثر من 400 مليون مستخدم. مثالية للمدفوعات الدولية والتجارة الإلكترونية العابرة للحدود.",
    website: "https://paypal.com",
    accentColor: "#003087",
    category: "global",
    methods: ["PayPal", "فيزا", "ماستركارد", "Venmo", "Pay Later"],
    featured: true,
    popularity: 5,
    fieldLabels: { apiKey: "Client ID", secretKey: "Client Secret", webhookSecret: "Webhook ID" },
  },
  {
    key: "tabby",
    label: "Tabby",
    labelAr: "تابي",
    tagline: "اشترِ الآن وادفع لاحقاً",
    description: "منصة BNPL الرائدة في الشرق الأوسط. تتيح للعملاء تقسيم مشترياتهم على 4 دفعات بدون فوائد. مرخصة من ساما وتخدم السعودية والإمارات والكويت.",
    website: "https://tabby.ai",
    accentColor: "#3DCC91",
    category: "bnpl",
    methods: ["4 أقساط", "بدون فوائد", "مدى", "فيزا"],
    featured: true,
    popularity: 5,
    fieldLabels: { apiKey: "Public Key", secretKey: "Secret Key", webhookSecret: "Webhook Secret" },
  },
  {
    key: "tamara",
    label: "Tamara",
    labelAr: "تمارا",
    tagline: "حلول الدفع المرنة",
    description: "منصة BNPL سعودية رائدة ومرخصة من ساما. توفر خيارات دفع مرنة بالتقسيط بدون بطاقات ائتمان. تخدم أكثر من 10 مليون مستخدم في المنطقة.",
    website: "https://tamara.co",
    accentColor: "#00D4AA",
    category: "bnpl",
    methods: ["BNPL", "3-4 أقساط", "STC Pay", "مدى"],
    popularity: 4,
    fieldLabels: { apiKey: "API Token", secretKey: "Notification Key", webhookSecret: "Webhook Secret" },
  },
];

/* ─── Category / Filter configs ─────────────────────────── */
const CATEGORIES = [
  { key: "all",    label: "الكل",            count: PROVIDERS.length },
  { key: "local",  label: "🇸🇦 بوابات محلية", count: PROVIDERS.filter(p => p.category === "local").length },
  { key: "global", label: "🌍 بوابات عالمية", count: PROVIDERS.filter(p => p.category === "global").length },
  { key: "bnpl",   label: "💳 تقسيط BNPL",   count: PROVIDERS.filter(p => p.category === "bnpl").length },
];

const STATUS_FILTERS = [
  { key: "all",          label: "الكل" },
  { key: "connected",    label: "متصل فقط" },
  { key: "disconnected", label: "غير متصل" },
  { key: "bnpl",         label: "BNPL فقط" },
];

const STATUS_CONFIG: Record<ProviderStatus, { label: string; dotColor: string; badgeClass: string; barColor: string }> = {
  disconnected: { label: "غير متصل",       dotColor: "bg-muted-foreground/60", badgeClass: "bg-muted text-muted-foreground",      barColor: "bg-muted-foreground/30" },
  connected:    { label: "متصل",            dotColor: "bg-info",               badgeClass: "bg-info/10 text-info",                barColor: "bg-info"                },
  tested:       { label: "بانتظار التفعيل", dotColor: "bg-warning",            badgeClass: "bg-warning/10 text-warning",           barColor: "bg-warning"             },
  active:       { label: "نشط",             dotColor: "bg-success",            badgeClass: "bg-success/10 text-success",           barColor: "bg-success"             },
  disabled:     { label: "معطل",            dotColor: "bg-destructive",        badgeClass: "bg-destructive/10 text-destructive",   barColor: "bg-destructive"         },
};

const SECURITY_BADGES = [
  { icon: Lock,         label: "AES-256-GCM",    desc: "تشفير عسكري للمفاتيح"        },
  { icon: Shield,       label: "PCI-DSS Ready",  desc: "بنية تحتية آمنة للدفع"       },
  { icon: Zap,          label: "Secure Webhooks", desc: "تحقق رقمي من كل حدث"         },
  { icon: CheckCircle2, label: "Idempotency",     desc: "حماية من التكرار والازدواجية" },
];

/* ─── Masked input helper ────────────────────────────────── */
const maskValue = (value: string) => {
  if (!value || value.length <= 4) return "••••••••";
  return "••••••••" + value.slice(-4);
};

/* ════════════════════════════════════════════════════════════
   Provider Drawer Component
   ════════════════════════════════════════════════════════════ */
interface DrawerProps {
  provider: ProviderDef | null;
  record?: ProviderRecord;
  tenantId: string | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const ProviderDrawer = ({ provider, record, tenantId, open, onClose, onRefresh }: DrawerProps) => {
  const { toast } = useToast();
  const [apiKey, setApiKey]           = useState("");
  const [secretKey, setSecretKey]     = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showApiKey, setShowApiKey]         = useState(false);
  const [showSecretKey, setShowSecretKey]   = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // reset state when provider changes
  useEffect(() => {
    if (open) {
      setApiKey(""); setSecretKey(""); setWebhookSecret("");
      setShowApiKey(false); setShowSecretKey(false); setShowWebhookSecret(false);
      setTestResult(null);
    }
  }, [open, provider?.key]);

  if (!provider) return null;

  const status       = record?.status ?? "disconnected";
  const cfg          = STATUS_CONFIG[status];
  const isConnected  = status !== "disconnected";
  const isActive     = status === "active";
  const labels       = provider.fieldLabels ?? {};

  /* ── Save credentials ── */
  const handleSave = async () => {
    if (!apiKey && !secretKey && !webhookSecret) {
      toast({ title: "لا يوجد تغييرات", description: "أدخل قيمة واحدة على الأقل لحفظها", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider: provider.key,
          ...(apiKey        && { api_key: apiKey }),
          ...(secretKey     && { secret_key: secretKey }),
          ...(webhookSecret && { webhook_secret: webhookSecret }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast({ title: "✅ تم الحفظ بنجاح", description: "تم تشفير البيانات وحفظها بأمان" });
      setApiKey(""); setSecretKey(""); setWebhookSecret("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Test connection ── */
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ provider: provider.key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      const success = !!data.success;
      setTestResult({ success, message: data.message || (success ? "الاتصال ناجح" : "فشل الاتصال") });
      if (success) {
        toast({ title: "✅ الاتصال ناجح", description: data.message || `تم التحقق من ${provider.label} بنجاح` });
        onRefresh();
      } else {
        toast({ title: "⚠️ فشل الاختبار", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
      toast({ title: "خطأ في الاختبار", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  /* ── Disable / re-enable ── */
  const handleToggleDisable = async () => {
    if (!tenantId) return;
    setDisabling(true);
    const newStatus = status === "disabled" ? "connected" : "disabled";
    try {
      const { error } = await supabase
        .from("tenant_payment_providers")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .eq("provider", provider.key);
      if (error) throw error;
      toast({
        title: newStatus === "disabled" ? "⛔ تم تعطيل البوابة" : "✅ تم إعادة تفعيل البوابة",
        description: `${provider.label} — ${newStatus === "disabled" ? "لن تعالج مدفوعات جديدة" : "جاهزة للاستخدام"}`,
        variant: newStatus === "disabled" ? "destructive" : "default",
      });
      onRefresh();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setDisabling(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto p-0 flex flex-col gap-0"
        dir="rtl"
      >
        {/* ── Header with gradient ── */}
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5"
          style={{ background: `linear-gradient(135deg, ${provider.accentColor}18 0%, transparent 70%)` }}
        >
          <div
            className="pointer-events-none absolute -top-10 -start-10 h-40 w-40 rounded-full opacity-20 blur-2xl"
            style={{ background: provider.accentColor }}
          />

          <SheetHeader className="relative space-y-0">
            {/* Logo + Status */}
            <div className="flex items-start justify-between mb-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-background p-3 shadow-md"
                style={isConnected ? { boxShadow: `0 4px 20px ${provider.accentColor}30` } : {}}
              >
                <BrandLogo
                  provider={provider.key}
                  className={cn("h-12 w-auto max-w-[56px] object-contain", !isConnected && "grayscale opacity-60")}
                />
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                cfg.badgeClass
              )}>
                <span className={cn("h-2 w-2 rounded-full", cfg.dotColor, isActive && "animate-pulse")} />
                {cfg.label}
              </span>
            </div>

            {/* Title */}
            <SheetTitle className="text-xl font-bold text-foreground text-start">
              {provider.label}
              <span className="ms-2 text-sm font-normal text-muted-foreground">{provider.labelAr}</span>
            </SheetTitle>
            <SheetDescription className="text-start text-xs text-muted-foreground mt-1 leading-relaxed">
              {provider.description}
            </SheetDescription>

            {/* Method chips */}
            <div className="flex flex-wrap gap-1.5 pt-3">
              {provider.methods.map(m => (
                <span
                  key={m}
                  className="inline-flex items-center rounded-full border border-border bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {m}
                </span>
              ))}
            </div>

            {/* Website link */}
            <a
              href={provider.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 pt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={11} />
              {provider.website.replace("https://", "")}
            </a>
          </SheetHeader>
        </div>

        <Separator />

        {/* ── Connection Status Info ── */}
        {isConnected && (
          <div className="px-6 py-4 bg-muted/20">
            <div className="grid grid-cols-3 gap-3">
              {/* Last test */}
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-center">
                <Clock size={14} className="text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">آخر اختبار</p>
                <p className="text-[11px] font-semibold text-foreground">
                  {record?.last_tested_at
                    ? new Date(record.last_tested_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })
                    : "—"}
                </p>
              </div>
              {/* Last webhook */}
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-center">
                <Webhook size={14} className="text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">آخر Webhook</p>
                <p className="text-[11px] font-semibold text-foreground">
                  {record?.last_webhook_at
                    ? new Date(record.last_webhook_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })
                    : "—"}
                </p>
              </div>
              {/* Signature status */}
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-3 text-center">
                <Shield size={14} className={record?.has_webhook_secret ? "text-success" : "text-muted-foreground"} />
                <p className="text-[10px] text-muted-foreground">التوقيع</p>
                <p className={cn("text-[11px] font-semibold", record?.has_webhook_secret ? "text-success" : "text-muted-foreground")}>
                  {record?.has_webhook_secret ? "محمي" : "غير مفعّل"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Credential fields ── */}
        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Security note */}
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <Lock size={13} className="text-primary shrink-0" />
            <p className="text-[11px] text-primary leading-relaxed">
              يتم تشفير جميع القيم بـ AES-256-GCM قبل التخزين. لا تُعرض القيم الكاملة أبداً.
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Key size={13} className="text-muted-foreground" />
              {labels.apiKey ?? "API Key"}
              {record?.has_api_key && (
                <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <CheckCheck size={9} /> محفوظ
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={record?.has_api_key ? maskValue("configured") : `أدخل ${labels.apiKey ?? "API Key"}...`}
                className="pe-10 font-mono text-sm bg-muted/30"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(p => !p)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Secret Key (if provider has it) */}
          {labels.secretKey && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Key size={13} className="text-muted-foreground" />
                {labels.secretKey}
                {record?.has_secret_key && (
                  <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                    <CheckCheck size={9} /> محفوظ
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showSecretKey ? "text" : "password"}
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                  placeholder={record?.has_secret_key ? maskValue("configured") : `أدخل ${labels.secretKey}...`}
                  className="pe-10 font-mono text-sm bg-muted/30"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(p => !p)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSecretKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Webhook size={13} className="text-muted-foreground" />
              {labels.webhookSecret ?? "Webhook Secret"}
              {record?.has_webhook_secret && (
                <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  <CheckCheck size={9} /> محفوظ
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                type={showWebhookSecret ? "text" : "password"}
                value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                placeholder={record?.has_webhook_secret ? maskValue("configured") : `أدخل ${labels.webhookSecret ?? "Webhook Secret"}...`}
                className="pe-10 font-mono text-sm bg-muted/30"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowWebhookSecret(p => !p)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showWebhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground pe-1">
              يُستخدم للتحقق من توقيع الـ Webhooks الواردة من {provider.label}
            </p>
          </div>

          {/* Test Result feedback */}
          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4",
                  testResult.success
                    ? "border-success/30 bg-success/5 text-success"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                )}
              >
                {testResult.success
                  ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  : <XCircle size={16} className="shrink-0 mt-0.5" />
                }
                <div>
                  <p className="text-xs font-semibold">
                    {testResult.success ? "الاتصال ناجح" : "فشل الاتصال"}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">{testResult.message}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Action Buttons ── */}
        <div className="border-t border-border bg-muted/20 px-6 py-4 space-y-3">
          {/* Save button */}
          <Button
            className="w-full gap-2"
            onClick={handleSave}
            disabled={saving || (!apiKey && !secretKey && !webhookSecret)}
          >
            {saving ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Lock size={14} />
            )}
            {saving ? "جاري الحفظ المشفّر..." : "حفظ البيانات المشفّرة"}
          </Button>

          {/* Test + Disable row */}
          {isConnected && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 text-sm"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <TestTube2 size={13} />
                )}
                {testing ? "جاري الاختبار..." : "اختبار الاتصال"}
              </Button>

              <Button
                variant="outline"
                className={cn(
                  "flex-1 gap-2 text-sm",
                  status === "disabled"
                    ? "border-success/40 text-success hover:bg-success/10"
                    : "border-destructive/40 text-destructive hover:bg-destructive/10"
                )}
                onClick={handleToggleDisable}
                disabled={disabling}
              >
                {disabling ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : status === "disabled" ? (
                  <Power size={13} />
                ) : (
                  <PowerOff size={13} />
                )}
                {status === "disabled" ? "إعادة تفعيل" : "تعطيل"}
              </Button>
            </div>
          )}

          {/* Security indicators */}
          <div className="flex items-center justify-center gap-4 pt-1">
            {[
              { icon: Lock, label: "AES-256-GCM" },
              { icon: Shield, label: "مشفّر" },
              { icon: Zap, label: "آمن" },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-1 text-muted-foreground">
                <b.icon size={10} />
                <span className="text-[10px] font-medium">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ════════════════════════════════════════════════════════════
   Provider Card Component
   ════════════════════════════════════════════════════════════ */
const ProviderCard = ({
  provider,
  record,
  onOpen,
  onTest,
  testing,
}: {
  provider: ProviderDef;
  record?: ProviderRecord;
  onOpen: () => void;
  onTest: () => void;
  testing: boolean;
}) => {
  const status = record?.status ?? "disconnected";
  const cfg = STATUS_CONFIG[status];
  const isConnected = status !== "disconnected";
  const isActive = status === "active";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm
                 hover:-translate-y-1 hover:shadow-lg hover:border-primary/40
                 transition-all duration-300 ease-out cursor-pointer"
      onClick={onOpen}
    >
      {/* Status top bar */}
      <div className={cn("h-1 w-full transition-colors duration-500", cfg.barColor)} />

      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-background p-2 shadow-sm",
            "transition-all duration-300 group-hover:shadow-md",
            !isConnected && "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"
          )}>
            <BrandLogo provider={provider.key} className="h-9 w-auto max-w-[44px] object-contain" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              cfg.badgeClass
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotColor, isActive && "animate-pulse")} />
              {cfg.label}
            </span>
            {provider.featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                <Sparkles size={9} /> مميّز
              </span>
            )}
          </div>
        </div>

        {/* Name + tagline */}
        <div className="space-y-0.5">
          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
            {provider.label}
          </h3>
          <p className="text-xs font-medium text-muted-foreground">{provider.tagline}</p>
        </div>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {provider.description}
        </p>

        {/* Method chips */}
        <div className="flex flex-wrap gap-1.5">
          {provider.methods.slice(0, 4).map(m => (
            <span
              key={m}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                provider.category === "bnpl"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-border bg-muted/60 text-muted-foreground"
              )}
            >
              {m}
            </span>
          ))}
          {provider.methods.length > 4 && (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              +{provider.methods.length - 4}
            </span>
          )}
        </div>

        {/* Category + website */}
        <div className="flex items-center gap-2">
          {provider.category === "bnpl" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
              <CreditCard size={10} /> BNPL
            </span>
          )}
          {provider.category === "local" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              🇸🇦 محلية
            </span>
          )}
          {provider.category === "global" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
              <Globe size={10} /> عالمية
            </span>
          )}
          <a
            href={provider.website}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto text-muted-foreground hover:text-foreground transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {isConnected ? (
          <>
            <Button size="sm" variant="default" className="flex-1 gap-1.5 text-xs h-8" onClick={onOpen}>
              <Settings2 size={13} />
              إدارة
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-8" onClick={onTest} disabled={testing}>
              {testing
                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <TestTube2 size={13} />}
              اختبار
            </Button>
          </>
        ) : (
          <Button size="sm" className="w-full gap-2 text-xs h-8" onClick={onOpen}>
            <Plus size={13} />
            تفعيل البوابة
            <ArrowRight size={12} className="ms-auto rtl:rotate-180" />
          </Button>
        )}
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════
   Skeleton Card
   ════════════════════════════════════════════════════════════ */
const SkeletonCard = () => (
  <div className="rounded-2xl border border-border bg-card overflow-hidden">
    <div className="h-1 w-full bg-muted animate-pulse" />
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
    <div className="border-t border-border bg-muted/30 px-5 py-3">
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   Main Marketplace Page
   ════════════════════════════════════════════════════════════ */
const PaymentMarketplace = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-synced state
  const [activeTab, setActiveTab]       = useState(searchParams.get("tab") || "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("filter") || "all");
  const [searchInput, setSearchInput]   = useState(searchParams.get("q") || "");
  const [search, setSearch]             = useState(searchParams.get("q") || ""); // debounced

  const [loading, setLoading]         = useState(true);
  const [tenantId, setTenantId]       = useState<string | null>(null);
  const [providerRecords, setProviderRecords] = useState<Record<string, ProviderRecord>>({});
  const [testing, setTesting]         = useState<Record<string, boolean>>({});
  const [drawerProvider, setDrawerProvider] = useState<ProviderDef | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  /* ── Load provider statuses ── */
  const loadProviders = async () => {
    if (!user) return;
    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) { setLoading(false); return; }
    setTenantId(member.tenant_id);

    const { data: records } = await supabase
      .from("tenant_payment_providers")
      .select("provider, status, last_tested_at, webhook_secret_encrypted, credentials_encrypted")
      .eq("tenant_id", member.tenant_id)
      .in("provider", PROVIDERS.map(p => p.key));

    const map: Record<string, ProviderRecord> = {};
    for (const r of records || []) {
      map[r.provider] = {
        status: r.status as ProviderStatus,
        last_tested_at: r.last_tested_at,
        has_webhook_secret: !!r.webhook_secret_encrypted,
        has_api_key: !!r.credentials_encrypted,
        has_secret_key: !!r.credentials_encrypted,
      };
    }
    setProviderRecords(map);
    setLoading(false);
  };

  useEffect(() => { loadProviders(); }, [user]);

  /* ── Search debounce 300ms ── */
  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        val ? next.set("q", val) : next.delete("q");
        return next;
      }, { replace: true });
    }, 300);
  }, [setSearchParams]);

  /* ── Sync tab & filter to URL ── */
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      tab === "all" ? next.delete("tab") : next.set("tab", tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleFilterChange = useCallback((filter: string) => {
    setStatusFilter(filter);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      filter === "all" ? next.delete("filter") : next.set("filter", filter);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  /* ── Quick test from card ── */
  const handleQuickTest = async (providerKey: string) => {
    setTesting(p => ({ ...p, [providerKey]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ provider: providerKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      if (data.success) {
        setProviderRecords(p => ({ ...p, [providerKey]: { ...p[providerKey], status: "tested" } }));
        toast({ title: "✅ الاتصال ناجح", description: data.message || `تم التحقق من ${providerKey} بنجاح` });
      } else {
        toast({ title: "⚠️ فشل الاختبار", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ في الاختبار", description: err.message, variant: "destructive" });
    } finally {
      setTesting(p => ({ ...p, [providerKey]: false }));
    }
  };

  /* ── Filtered providers (memoized, uses debounced `search`) ── */
  const filtered = useMemo(() => PROVIDERS.filter(p => {
    const catMatch    = activeTab === "all" || p.category === activeTab;
    const recStatus   = providerRecords[p.key]?.status ?? "disconnected";
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "connected"    && recStatus !== "disconnected") ||
      (statusFilter === "disconnected" && recStatus === "disconnected") ||
      (statusFilter === "bnpl"         && p.category === "bnpl");
    const q = search.toLowerCase();
    const searchMatch =
      !q ||
      p.label.toLowerCase().includes(q) ||
      p.labelAr.includes(search) ||
      p.tagline.includes(search) ||
      p.methods.some(m => m.toLowerCase().includes(q));
    return catMatch && statusMatch && searchMatch;
  }), [activeTab, statusFilter, search, providerRecords]);

  const connectedCount = PROVIDERS.filter(
    p => (providerRecords[p.key]?.status ?? "disconnected") !== "disconnected"
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* ════════ Provider Drawer ════════ */}
      <ProviderDrawer
        provider={drawerProvider}
        record={drawerProvider ? providerRecords[drawerProvider.key] : undefined}
        tenantId={tenantId}
        open={!!drawerProvider}
        onClose={() => setDrawerProvider(null)}
        onRefresh={loadProviders}
      />

      {/* ════════ Hero Header ════════ */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-muted/30 to-background px-6 py-10">
        <div className="pointer-events-none absolute -top-20 -end-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -start-10 h-48 w-48 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 p-2">
                  <CreditCard size={18} className="text-primary" />
                </span>
                <h1 className="text-2xl font-bold text-foreground">سوق بوابات الدفع</h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg">
                اربط حساب بوابة الدفع الخاصة بك بأمان كامل. نحن نوفّر البنية التحتية والتشفير والربط — أنت تتحكم بالمفاتيح.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground tabular-nums">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">من {PROVIDERS.length} متصل</p>
              </div>
              <div className="h-12 w-px bg-border hidden sm:block" />
              <Button size="sm" className="gap-2 hidden sm:flex" onClick={() => setDrawerProvider(PROVIDERS[0])}>
                <Plus size={14} />
                إضافة بوابة
              </Button>
            </div>
          </div>

          {/* Security badges */}
          <div className="mt-6 flex flex-wrap gap-2">
            {SECURITY_BADGES.map(badge => (
              <div
                key={badge.label}
                className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-sm"
              >
                <badge.icon size={12} className="text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-foreground">{badge.label}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">· {badge.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════ Sticky Search & Filter Bar ════════ */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

            {/* Search input with clear button */}
            <div className="relative flex-1">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="ابحث عن بوابة دفع، طريقة دفع..."
                className="ps-9 pe-8 h-9 text-sm bg-muted/40 border-border"
              />
              {searchInput && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="مسح البحث"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <Filter size={14} className="text-muted-foreground hidden sm:block" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 h-9 text-sm font-medium transition-colors outline-none",
                      statusFilter === "all"
                        ? "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
                        : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
                    )}
                  >
                    <Filter size={13} className="shrink-0" />
                    <span>{STATUS_FILTERS.find(f => f.key === statusFilter)?.label ?? "الكل"}</span>
                    <ChevronDown size={13} className="shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  className="w-48 bg-background border border-border shadow-lg rounded-xl z-50 p-1"
                >
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={handleFilterChange}>
                    {STATUS_FILTERS.map(f => (
                      <DropdownMenuRadioItem
                        key={f.key}
                        value={f.key}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none
                                   hover:bg-muted focus:bg-muted data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                      >
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          f.key === "all"          && "bg-muted-foreground",
                          f.key === "connected"    && "bg-success",
                          f.key === "disconnected" && "bg-muted-foreground/50",
                          f.key === "bnpl"         && "bg-success",
                        )} />
                        {f.label}
                        {/* Count badge */}
                        <span className="ms-auto text-[10px] font-bold tabular-nums text-muted-foreground">
                          {f.key === "all"          && PROVIDERS.length}
                          {f.key === "connected"    && Object.values(providerRecords).filter(r => r.status !== "disconnected").length}
                          {f.key === "disconnected" && (PROVIDERS.length - Object.values(providerRecords).filter(r => r.status !== "disconnected").length)}
                          {f.key === "bnpl"         && PROVIDERS.filter(p => p.category === "bnpl").length}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Active filter chip */}
              {(statusFilter !== "all" || search) && (
                <button
                  onClick={() => { handleFilterChange("all"); handleSearchChange(""); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 h-9 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X size={11} />
                  مسح
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════ Main Content ════════ */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 h-auto p-1 bg-muted/60 gap-1 flex flex-wrap">
            {CATEGORIES.map(cat => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {cat.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  activeTab === cat.key ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground"
                )}>
                  {cat.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map(cat => (
            <TabsContent key={cat.key} value={cat.key} className="mt-0">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {loading ? "جاري التحميل..." : `${filtered.length} بوابة`}
                  {search && <span className="ms-1">· نتائج "{search}"</span>}
                </p>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 rounded-full bg-muted p-4">
                    <Search size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-base font-semibold text-foreground">لا توجد نتائج</p>
                  <p className="mt-1 text-sm text-muted-foreground">جرّب تغيير معايير البحث أو الفلترة</p>
                  <Button variant="ghost" size="sm" className="mt-4" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                    مسح الفلاتر
                  </Button>
                </div>
              ) : (
                <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {filtered.map(provider => (
                      <ProviderCard
                        key={provider.key}
                        provider={provider}
                        record={providerRecords[provider.key]}
                        onOpen={() => setDrawerProvider(provider)}
                        onTest={() => handleQuickTest(provider.key)}
                        testing={testing[provider.key] ?? false}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* ════════ Enterprise Security Section ════════ */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-5xl px-6 pb-10 pt-4"
        >
          {/* Header */}
          <div className="mb-5 text-center">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Shield size={11} />
              أمان المؤسسات
            </div>
            <h2 className="text-lg font-bold text-foreground">أمان على مستوى المؤسسات</h2>
            <p className="mt-1 text-sm text-muted-foreground">جميع بيانات التكامل محمية بمعايير أمنية عالمية</p>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                icon: <Lock size={18} />,
                emoji: "🔐",
                title: "تشفير AES-256-GCM",
                desc: "جميع المفاتيح مشفرة بمعيار التشفير الحكومي الأمريكي",
                color: "text-violet-500",
                bg: "bg-violet-500/8",
                border: "border-violet-500/20",
              },
              {
                icon: <CheckCheck size={18} />,
                emoji: "🧾",
                title: "Audit Logs",
                desc: "تسجيل كامل لكل عملية وصول وتغيير في الإعدادات",
                color: "text-blue-500",
                bg: "bg-blue-500/8",
                border: "border-blue-500/20",
              },
              {
                icon: <RefreshCw size={18} />,
                emoji: "🔁",
                title: "Idempotency",
                desc: "حماية من تكرار المعاملات المالية عبر معرفات فريدة",
                color: "text-teal-500",
                bg: "bg-teal-500/8",
                border: "border-teal-500/20",
              },
              {
                icon: <Shield size={18} />,
                emoji: "🛡",
                title: "HMAC Signature",
                desc: "التحقق من صحة كل Webhook بتوقيع رقمي مشفر",
                color: "text-green-500",
                bg: "bg-green-500/8",
                border: "border-green-500/20",
              },
              {
                icon: <Eye size={18} />,
                emoji: "🚫",
                title: "لا Plaintext",
                desc: "لا يُخزَّن أي مفتاح كنص صريح في قاعدة البيانات",
                color: "text-rose-500",
                bg: "bg-rose-500/8",
                border: "border-rose-500/20",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-xl border p-4 transition-all duration-200",
                  "bg-gradient-to-br from-background to-muted/30 hover:shadow-md",
                  card.border,
                )}
              >
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110", card.bg, card.color)}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{card.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{card.desc}</p>
                </div>
                {/* subtle glow on hover */}
                <div className={cn("pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100", card.bg)} style={{ filter: "blur(12px)" }} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* BYO Model banner */}
        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Shield size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">نموذج "أحضر بوابتك الخاصة" — BYO Gateway</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                كل شركة تربط حسابها الخاص مع مزود الدفع مباشرة. نحن نوفّر الربط التقني، التشفير (AES-256-GCM)، التحقق من الـ Webhooks، ومنع التكرار. لا يوجد مفاتيح مشتركة — بياناتك معزولة تماماً ومشفّرة على خوادمنا الآمنة.
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
              <a href="https://docs.numaxio.com/payment-gateways" target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} />
                الوثائق
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMarketplace;
