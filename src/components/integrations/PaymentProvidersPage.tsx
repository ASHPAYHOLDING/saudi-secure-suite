import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2, Circle, Loader2, Plug, RefreshCw, Save,
  TestTube2, Copy, Eye, EyeOff, AlertTriangle, Link as LinkIcon,
  Shield, Zap, Globe, ChevronDown, ExternalLink, Lock, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/payments/BrandLogo";

/* ─── Types ─────────────────────────────────────────────── */
type ProviderStatus = "disconnected" | "connected" | "tested" | "active" | "disabled";

interface ProviderRecord {
  status: ProviderStatus;
  last_tested_at: string | null;
  has_webhook_secret: boolean;
}

interface ProviderDef {
  key: "tap" | "moyasar" | "hyperpay" | "stripe" | "geidea";
  label: string;
  labelAr: string;
  tagline: string;
  description: string;
  website: string;
  accentCss: string;          // raw CSS colour for the accent dot / border tint
  methods: string[];
  webhookFn?: string;
  credentialFields: { key: string; label: string; placeholder: string; hint?: string; secret?: boolean }[];
  setupSteps: string[];
}

/* ─── Status config ──────────────────────────────────────── */
const STATUS_CONFIG: Record<ProviderStatus, { label: string; dotClass: string; badgeClass: string; icon: any }> = {
  disconnected: {
    label: "غير متصل",
    dotClass: "bg-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
    icon: Circle,
  },
  connected: {
    label: "متصل",
    dotClass: "bg-info",
    badgeClass: "bg-info/10 text-info border-info/30",
    icon: Plug,
  },
  tested: {
    label: "بانتظار التفعيل",
    dotClass: "bg-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/30",
    icon: TestTube2,
  },
  active: {
    label: "نشط",
    dotClass: "bg-success",
    badgeClass: "bg-success/10 text-success border-success/30",
    icon: CheckCircle2,
  },
  disabled: {
    label: "معطل",
    dotClass: "bg-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    icon: AlertTriangle,
  },
};

/* ─── Provider definitions ───────────────────────────────── */
const PROVIDERS: ProviderDef[] = [
  {
    key: "tap",
    label: "Tap Payments",
    labelAr: "تاب للمدفوعات",
    tagline: "بوابة الخليج الأولى",
    description: "بوابة الدفع الرائدة في منطقة الخليج العربي. تأسست في الكويت وتخدم أكثر من 8 دول في المنطقة. تدعم جميع طرق الدفع المحلية والدولية.",
    website: "https://tap.company",
    accentCss: "#0070C0",
    methods: ["مدى", "فيزا", "ماستركارد", "Apple Pay", "KNET", "Benefit"],
    credentialFields: [
      { key: "secret_key", label: "Secret Key", placeholder: "sk_live_xxxxxxxx", hint: "تجدها في لوحة Tap → Developers → API Keys", secret: true },
      { key: "publishable_key", label: "Publishable Key", placeholder: "pk_live_xxxxxxxx", hint: "المفتاح العام الآمن للواجهة" },
    ],
    setupSteps: [
      "سجّل في tap.company واحصل على حساب Business",
      "انتقل إلى Developers → API Keys وانسخ المفاتيح",
      "في Developers → Webhooks، أضف Webhook URL من الأسفل",
      "حدد أحداث: AUTHORIZE, CAPTURE, VOID, REFUND",
    ],
  },
  {
    key: "moyasar",
    label: "Moyasar",
    labelAr: "ميسّر",
    tagline: "الحل السعودي المحلي",
    description: "منصة دفع سعودية متكاملة مرخصة من ساما. تقدم تجربة دفع سلسة باللغة العربية مع دعم كامل لمدى وApple Pay.",
    website: "https://moyasar.com",
    accentCss: "#047857",
    methods: ["مدى", "فيزا", "ماستركارد", "Apple Pay", "STC Pay"],
    credentialFields: [
      { key: "secret_key", label: "Secret Key (sk_...)", placeholder: "sk_test_xxxxxxxxxxxxxxxx", hint: "من لوحة moyasar.com → API Keys", secret: true },
      { key: "publishable_key", label: "Publishable Key (pk_...)", placeholder: "pk_test_xxxxxxxxxxxxxxxx", hint: "المفتاح العام للـ Checkout" },
    ],
    setupSteps: [
      "سجّل في moyasar.com وأكمل التحقق من الهوية التجارية",
      "انتقل إلى Settings → API Keys وانسخ المفاتيح",
      "في Settings → Webhooks، أضف Webhook URL وانسخ الـ Secret",
      "اختبر بالبطاقة 4111111111111111 في بيئة الاختبار",
    ],
  },
  {
    key: "hyperpay",
    label: "HyperPay",
    labelAr: "هايبر باي",
    tagline: "بوابة متعددة الأسواق",
    description: "منصة دفع عالمية متخصصة في منطقة MENA وأوروبا. تقدم checkout مستضاف وAPI مرن مع دعم لأكثر من 150 طريقة دفع حول العالم.",
    website: "https://hyperpay.com",
    accentCss: "#6D28D9",
    methods: ["مدى", "فيزا", "ماستركارد", "Apple Pay", "SADAD"],
    credentialFields: [
      { key: "access_token", label: "Access Token", placeholder: "OGE4294174b7ecb28...", hint: "من لوحة HyperPay → Administration → Account Data", secret: true },
      { key: "entity_id", label: "Entity ID", placeholder: "8a8294174b7ecb28014b9699220015ca", hint: "معرف الكيان لنوع المعاملة (DEBIT)" },
    ],
    setupSteps: [
      "تواصل مع فريق HyperPay لفتح حساب تاجر",
      "احصل على Access Token و Entity ID من لوحة الإدارة",
      "في Administration → Webhooks، أضف رابط Webhook URL",
      "اختبر بالبيانات التجريبية المقدمة من HyperPay",
    ],
  },
  {
    key: "stripe",
    label: "Stripe",
    labelAr: "سترايب",
    tagline: "بوابة الشركات التقنية العالمية",
    description: "أقوى بنية تحتية للدفع في العالم. تثق بها أكبر الشركات التقنية. تدعم أكثر من 135 عملة مع Checkout متوافق تلقائياً مع PCI-DSS.",
    website: "https://stripe.com",
    accentCss: "#635BFF",
    methods: ["فيزا", "ماستركارد", "Apple Pay", "Google Pay", "SEPA", "135+ عملة"],
    webhookFn: "stripe-webhook",
    credentialFields: [
      { key: "secret_key", label: "Secret Key (sk_...)", placeholder: "sk_live_xxxxxxxxxxxxxxxx", hint: "من dashboard.stripe.com → Developers → API Keys", secret: true },
      { key: "publishable_key", label: "Publishable Key (pk_...)", placeholder: "pk_live_xxxxxxxxxxxxxxxx", hint: "المفتاح العام الآمن" },
    ],
    setupSteps: [
      "سجّل في stripe.com وفعّل حسابك",
      "في Developers → API Keys، انسخ Secret Key و Publishable Key",
      "في Developers → Webhooks، أضف Endpoint URL من الأسفل",
      "اختر الأحداث: payment_intent.succeeded, checkout.session.completed",
      "انسخ Signing Secret من الـ Webhook الجديد",
    ],
  },
  {
    key: "geidea",
    label: "Geidea",
    labelAr: "جيدة",
    tagline: "بوابة الدفع السعودية الرائدة",
    description: "شركة تقنية مالية سعودية رائدة مرخصة من ساما. متخصصة في حلول نقاط البيع والتجارة الإلكترونية وحلول الدفع B2B للسوق السعودية.",
    website: "https://geidea.net",
    accentCss: "#EA580C",
    methods: ["مدى", "فيزا", "ماستركارد", "Apple Pay", "STC Pay", "BNPL"],
    webhookFn: "geidea-webhook",
    credentialFields: [
      { key: "merchant_public_key", label: "Merchant Public Key", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", hint: "من Geidea Merchant Portal → Integration → Keys" },
      { key: "api_password", label: "API Password", placeholder: "Password123!", hint: "كلمة مرور API من نفس الصفحة", secret: true },
    ],
    setupSteps: [
      "تواصل مع Geidea لفتح حساب تاجر (geidea.net)",
      "في Merchant Portal → Integration، انسخ Merchant Public Key و API Password",
      "في Notification URLs، أضف Webhook URL من الأسفل",
      "اختبر بالبطاقة المقدمة من Geidea في بيئة UAT",
    ],
  },
];

/* ─── Sub-components ─────────────────────────────────────── */

/** Horizontally-scrollable payment method chips */
const MethodChips = ({ methods }: { methods: string[] }) => (
  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 mt-1.5">
    {methods.map((m) => (
      <span
        key={m}
        className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap"
      >
        {m}
      </span>
    ))}
  </div>
);

/** Connection state badge */
const StatusBadge = ({
  status,
  saving,
}: {
  status: ProviderStatus;
  saving: boolean;
}) => {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
        cfg.badgeClass
      )}
    >
      {saving ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotClass)} />
      )}
      {cfg.label}
    </span>
  );
};

/* ─── Main Component ─────────────────────────────────────── */
const PaymentProvidersPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [providerRecords, setProviderRecords] = useState<Record<string, ProviderRecord>>({});
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});
  const [webhookSecrets, setWebhookSecrets] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  /* ── Load providers ── */
  useEffect(() => {
    if (!user) return;
    const load = async () => {
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
        .select("provider, status, last_tested_at, webhook_secret_encrypted")
        .eq("tenant_id", member.tenant_id);

      const map: Record<string, ProviderRecord> = {};
      for (const r of records || []) {
        map[r.provider] = {
          status: r.status as ProviderStatus,
          last_tested_at: r.last_tested_at,
          has_webhook_secret: !!r.webhook_secret_encrypted,
        };
      }
      setProviderRecords(map);

      const autoExpand: Record<string, boolean> = {};
      for (const key of Object.keys(map)) {
        if (map[key].status !== "disconnected") autoExpand[key] = true;
      }
      setExpanded(autoExpand);
      setLoading(false);
    };
    load();
  }, [user]);

  /* ── Handlers ── */
  const handleCredentialChange = useCallback((provider: string, field: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [provider]: { ...(prev[provider] || {}), [field]: value } }));
    if (autosaveTimers.current[provider]) clearTimeout(autosaveTimers.current[provider]);
    autosaveTimers.current[provider] = setTimeout(() => handleSave(provider), 1200);
  }, []);

  const handleWebhookSecretChange = useCallback((provider: string, value: string) => {
    setWebhookSecrets((prev) => ({ ...prev, [provider]: value }));
    if (autosaveTimers.current[`ws_${provider}`]) clearTimeout(autosaveTimers.current[`ws_${provider}`]);
    autosaveTimers.current[`ws_${provider}`] = setTimeout(() => handleSave(provider), 1200);
  }, []);

  const handleSave = async (provider: string) => {
    const creds = credentials[provider];
    if (!creds || !Object.values(creds).some((v) => v && v.trim())) return;
    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ provider, credentials: creds, webhookSecret: webhookSecrets[provider] || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setProviderRecords((p) => ({
        ...p,
        [provider]: { ...p[provider], status: "connected", has_webhook_secret: !!(webhookSecrets[provider]) },
      }));
      toast({ title: "✅ تم الحفظ", description: `تم حفظ بيانات ${provider} بتشفير AES-256-GCM` });
    } catch (err: any) {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleTest = async (provider: string) => {
    setTesting((p) => ({ ...p, [provider]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success) {
        setProviderRecords((p) => ({
          ...p,
          [provider]: { ...p[provider], status: "tested", last_tested_at: new Date().toISOString() },
        }));
        toast({ title: "✅ نجاح الاختبار", description: data.message });
      } else {
        toast({ title: "فشل الاختبار", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setTesting((p) => ({ ...p, [provider]: false }));
    }
  };

  const getWebhookUrl = (providerKey: string) => {
    if (!tenantId) return "";
    const fn = PROVIDERS.find((p) => p.key === providerKey)?.webhookFn;
    return fn
      ? `${supabaseUrl}/functions/v1/${fn}?tenant_id=${tenantId}`
      : `${supabaseUrl}/functions/v1/payment-webhook?provider=${providerKey}&tenant_id=${tenantId}`;
  };

  const copyWebhookUrl = (providerKey: string) => {
    const url = getWebhookUrl(providerKey);
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "تم النسخ ✓", description: "تم نسخ Webhook URL" });
  };

  const toggleExpand = (key: string) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const connectedCount = Object.values(providerRecords).filter(
    (r) => r.status !== "disconnected"
  ).length;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-background" dir="rtl">

      {/* ══════════════ HERO ══════════════ */}
      <div className="relative overflow-hidden border-b border-border bg-card">
        {/* subtle grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* teal glow blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -start-20 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative z-10 mx-auto max-w-5xl px-5 py-9 sm:px-8">
          {/* Trust badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {[
              { icon: Shield, label: "مشفّر AES-256-GCM" },
              { icon: Lock, label: "PCI-DSS متوافق" },
              { icon: Zap, label: "Webhooks آنية" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon size={10} className="text-accent" />
                {label}
              </span>
            ))}
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            بوابات الدفع
          </h1>
          <p className="mb-7 max-w-lg text-sm leading-relaxed text-muted-foreground">
            أحضر بوابتك الخاصة (BYO Gateway) — تُخزَّن جميع المفاتيح مشفرة ولا تمر أبداً عبر المتصفح. يتم تحديث الفاتورة تلقائياً عند إتمام الدفع عبر Webhook آمن.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-6">
            {[
              { icon: Globe, value: PROVIDERS.length, label: "بوابات مدعومة", iconClass: "text-accent" },
              { icon: CheckCircle2, value: connectedCount, label: "متصلة", iconClass: "text-success" },
              { icon: Shield, value: "AES-GCM", label: "مستوى الأمان", iconClass: "text-info" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <s.icon size={15} className={s.iconClass} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-base font-bold leading-tight text-foreground">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-5 py-5 sm:px-8">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 mt-0.5">
              <Info size={14} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="mb-3 text-xs font-semibold text-foreground">كيف يعمل النظام؟</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { n: "1", title: "أدخل المفاتيح", desc: "من لوحة إعدادات المزود" },
                  { n: "2", title: "تشفير فوري", desc: "AES-256-GCM على الخادم" },
                  { n: "3", title: "أنشئ فاتورة", desc: "يُرسل طلب الدفع للمزود" },
                  { n: "4", title: "تحديث تلقائي", desc: "Webhook يُحدّث الفاتورة فوراً" },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                      {s.n}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ PROVIDERS LIST ══════════════ */}
      <div className="mx-auto max-w-5xl space-y-3 px-5 py-6 sm:px-8">
        {PROVIDERS.map((provider, idx) => {
          const record = providerRecords[provider.key];
          const status = record?.status ?? "disconnected";
          const isSaving = saving[provider.key];
          const isTesting = testing[provider.key];
          const isExpanded = expanded[provider.key];
          const isConnected = status !== "disconnected";

          return (
            <motion.div
              key={provider.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.055 }}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              {/* ── Card header (always visible) ── */}
              <button
                type="button"
                className="flex w-full cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-start"
                onClick={() => toggleExpand(provider.key)}
                aria-expanded={isExpanded}
              >
                {/* Left cluster: logo + info */}
                <div className="flex min-w-0 items-center gap-4">
                  {/* Logo — fixed container so logos don't resize card */}
                  <div className="flex h-10 w-28 shrink-0 items-center justify-start sm:w-36">
                    <BrandLogo provider={provider.key} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground">{provider.labelAr}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{provider.label}</span>
                      <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {provider.tagline}
                      </span>
                    </div>
                    {/* Methods — horizontal scroll on mobile */}
                    <MethodChips methods={provider.methods} />
                  </div>
                </div>

                {/* Right cluster: status + chevron */}
                <div className="flex shrink-0 items-center gap-2.5">
                  <StatusBadge status={status} saving={!!isSaving} />
                  <ChevronDown
                    size={15}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                </div>
              </button>

              {/* ── Expanded panel ── */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5 border-t border-border/60 px-5 pb-5 pt-5">

                      {/* Description */}
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {provider.description}
                      </p>

                      {/* Two-column: guide + credentials */}
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

                        {/* Setup guide */}
                        <div className="rounded-xl border border-border bg-muted/30 p-4 lg:col-span-2">
                          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                            <Zap size={11} className="text-accent" />
                            دليل الإعداد السريع
                          </p>
                          <ol className="space-y-2.5">
                            {provider.setupSteps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent mt-px">
                                  {i + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ol>
                          <a
                            href={provider.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-4 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                          >
                            <ExternalLink size={10} />
                            فتح موقع {provider.label}
                          </a>
                        </div>

                        {/* Credentials */}
                        <div className="space-y-3.5 lg:col-span-3">
                          {provider.credentialFields.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label className="text-xs font-medium">{field.label}</Label>
                              <div className="relative">
                                <Input
                                  type={field.secret && !showSecrets[`${provider.key}_${field.key}`] ? "password" : "text"}
                                  placeholder={field.placeholder}
                                  value={credentials[provider.key]?.[field.key] ?? ""}
                                  onChange={(e) => handleCredentialChange(provider.key, field.key, e.target.value)}
                                  className="bg-background pe-10 font-mono text-sm"
                                  dir="ltr"
                                />
                                {field.secret && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowSecrets((p) => ({
                                        ...p,
                                        [`${provider.key}_${field.key}`]: !p[`${provider.key}_${field.key}`],
                                      }))
                                    }
                                    className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                                  >
                                    {showSecrets[`${provider.key}_${field.key}`] ? (
                                      <EyeOff size={13} />
                                    ) : (
                                      <Eye size={13} />
                                    )}
                                  </button>
                                )}
                              </div>
                              {field.hint && (
                                <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                  <Info size={9} className="mt-0.5 shrink-0" />
                                  {field.hint}
                                </p>
                              )}
                            </div>
                          ))}

                          {/* Webhook secret */}
                          <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5 text-xs font-medium">
                              <Shield size={10} className="text-warning" />
                              Webhook Secret
                              <span className="font-normal text-muted-foreground">(للتحقق من الطلبات)</span>
                            </Label>
                            <div className="relative">
                              <Input
                                type={showSecrets[`${provider.key}_ws`] ? "text" : "password"}
                                placeholder="whsec_... أو السر المشترك من لوحة المزود"
                                value={webhookSecrets[provider.key] ?? ""}
                                onChange={(e) => handleWebhookSecretChange(provider.key, e.target.value)}
                                className="bg-background pe-10 font-mono text-sm"
                                dir="ltr"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowSecrets((p) => ({ ...p, [`${provider.key}_ws`]: !p[`${provider.key}_ws`] }))
                                }
                                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                              >
                                {showSecrets[`${provider.key}_ws`] ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            </div>
                            {record?.has_webhook_secret ? (
                              <p className="flex items-center gap-1 text-[10px] text-success">
                                <CheckCircle2 size={9} /> تم ضبط Webhook Secret
                              </p>
                            ) : isConnected ? (
                              <p className="flex items-center gap-1 text-[10px] text-warning">
                                <AlertTriangle size={9} /> لم يُعدّ Webhook Secret — ستُرفض جميع الـ Webhooks
                              </p>
                            ) : null}
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleSave(provider.key)}
                              disabled={!!isSaving}
                              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                            >
                              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              حفظ آمن
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTest(provider.key)}
                              disabled={!!isTesting || status === "disconnected"}
                              className="gap-2"
                            >
                              {isTesting ? <Loader2 size={12} className="animate-spin" /> : <TestTube2 size={12} />}
                              اختبار الاتصال
                            </Button>

                            {isConnected && tenantId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyWebhookUrl(provider.key)}
                                className="gap-2 text-muted-foreground hover:text-foreground"
                              >
                                <Copy size={12} />
                                نسخ Webhook URL
                              </Button>
                            )}
                          </div>

                          {/* Webhook URL display */}
                          {isConnected && tenantId && (
                            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                                <LinkIcon size={9} />
                                Webhook URL — أضفه في لوحة {provider.label}
                              </p>
                              <div className="flex items-center gap-2">
                                <code
                                  className="flex-1 break-all rounded bg-background px-2 py-1.5 text-[10px] font-mono text-foreground"
                                  dir="ltr"
                                >
                                  {getWebhookUrl(provider.key)}
                                </code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 p-0"
                                  onClick={() => copyWebhookUrl(provider.key)}
                                >
                                  <Copy size={11} />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Last tested */}
                          {record?.last_tested_at && (
                            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <RefreshCw size={9} />
                              آخر اختبار:{" "}
                              {new Date(record.last_tested_at).toLocaleString("ar-SA")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* ══════════════ SECURITY FOOTER ══════════════ */}
        <div className="rounded-2xl border border-border bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10">
              <Shield size={16} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="mb-3 text-sm font-semibold text-foreground">أمان على مستوى المؤسسات</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { icon: Lock, title: "تشفير AES-256-GCM", desc: "جميع المفاتيح تُشفَّر قبل التخزين ولا تُقرأ أبداً من قاعدة البيانات" },
                  { icon: Shield, title: "التحقق من Webhook", desc: "HMAC-SHA256 يتحقق من كل طلب Webhook — الطلبات المزوّرة تُرفض فوراً" },
                  { icon: Zap, title: "عزل التنانت", desc: "كل مستأجر له مفتاح تشفير منفصل — لا مشاركة للبيانات بين الحسابات" },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <item.icon size={12} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentProvidersPage;
