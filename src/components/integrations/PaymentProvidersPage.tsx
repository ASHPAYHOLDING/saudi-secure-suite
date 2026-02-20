import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Circle, Loader2, Plug, RefreshCw, Save,
  TestTube2, Copy, Eye, EyeOff, AlertTriangle, Link as LinkIcon,
  Shield, Zap, Globe, ChevronDown, ChevronUp, ExternalLink, Lock, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  logoColor: string;
  accentColor: string;
  borderColor: string;
  bgGradient: string;
  methods: string[];
  webhookFn?: string;
  credentialFields: { key: string; label: string; placeholder: string; hint?: string; secret?: boolean }[];
  setupSteps: string[];
}

// SVG Logos as inline components
const TapLogo = () => (
  <svg viewBox="0 0 120 40" className="h-7 w-auto" fill="none">
    <rect width="120" height="40" rx="8" fill="#1A1A2E"/>
    <text x="14" y="27" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="18" fill="#00D4FF">tap</text>
    <text x="52" y="27" fontFamily="'Inter',sans-serif" fontWeight="300" fontSize="12" fill="#9CA3AF">payments</text>
  </svg>
);

const MoyasarLogo = () => (
  <svg viewBox="0 0 140 40" className="h-7 w-auto" fill="none">
    <rect width="140" height="40" rx="8" fill="#065F46"/>
    <circle cx="22" cy="20" r="10" fill="#10B981"/>
    <circle cx="22" cy="20" r="6" fill="#065F46"/>
    <circle cx="22" cy="20" r="3" fill="#10B981"/>
    <text x="38" y="27" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="15" fill="white">moyasar</text>
  </svg>
);

const HyperPayLogo = () => (
  <svg viewBox="0 0 140 40" className="h-7 w-auto" fill="none">
    <rect width="140" height="40" rx="8" fill="#1E1B4B"/>
    <polygon points="14,8 28,8 35,20 28,32 14,32 7,20" fill="#7C3AED"/>
    <text x="42" y="27" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="15" fill="white">HyperPay</text>
  </svg>
);

const StripeLogo = () => (
  <svg viewBox="0 0 100 40" className="h-7 w-auto" fill="none">
    <rect width="100" height="40" rx="8" fill="#635BFF"/>
    <text x="16" y="27" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="18" fill="white">stripe</text>
  </svg>
);

const GeidealLogo = () => (
  <svg viewBox="0 0 120 40" className="h-7 w-auto" fill="none">
    <rect width="120" height="40" rx="8" fill="#FF6B00"/>
    <text x="12" y="27" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="17" fill="white">Geidea</text>
    <circle cx="102" cy="12" r="6" fill="white" opacity="0.3"/>
    <circle cx="102" cy="12" r="3" fill="white"/>
  </svg>
);

const PROVIDER_LOGOS: Record<string, React.FC> = {
  tap: TapLogo,
  moyasar: MoyasarLogo,
  hyperpay: HyperPayLogo,
  stripe: StripeLogo,
  geidea: GeidealLogo,
};

const PROVIDERS: ProviderDef[] = [
  {
    key: "tap",
    label: "Tap Payments",
    labelAr: "تاب للمدفوعات",
    tagline: "بوابة الخليج الأولى",
    description: "بوابة الدفع الرائدة في منطقة الخليج العربي. تأسست في الكويت وتخدم أكثر من 8 دول في المنطقة. تدعم جميع طرق الدفع المحلية والدولية.",
    website: "https://tap.company",
    logoColor: "#1A1A2E",
    accentColor: "hsl(195 100% 50%)",
    borderColor: "border-blue-400/30",
    bgGradient: "from-blue-950/20 to-cyan-950/10",
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
    description: "منصة دفع سعودية متكاملة مرخصة من مؤسسة النقد العربي السعودي (ساما). تقدم تجربة دفع سلسة باللغة العربية مع دعم كامل لمدى وApple Pay.",
    website: "https://moyasar.com",
    logoColor: "#065F46",
    accentColor: "hsl(152 69% 31%)",
    borderColor: "border-emerald-400/30",
    bgGradient: "from-emerald-950/20 to-green-950/10",
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
    logoColor: "#1E1B4B",
    accentColor: "hsl(263 69% 52%)",
    borderColor: "border-violet-400/30",
    bgGradient: "from-violet-950/20 to-purple-950/10",
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
    description: "أقوى بنية تحتية للدفع في العالم. تثق بها أكبر الشركات التقنية. تدعم أكثر من 135 عملة مع Checkout مستضاف يتوافق تلقائياً مع PCI-DSS.",
    website: "https://stripe.com",
    logoColor: "#635BFF",
    accentColor: "hsl(245 100% 67%)",
    borderColor: "border-indigo-400/30",
    bgGradient: "from-indigo-950/20 to-violet-950/10",
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
    logoColor: "#FF6B00",
    accentColor: "hsl(24 100% 50%)",
    borderColor: "border-orange-400/30",
    bgGradient: "from-orange-950/20 to-amber-950/10",
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

const STATUS_CONFIG: Record<ProviderStatus, { label: string; color: string; bg: string; icon: any }> = {
  disconnected: { label: "غير متصل", color: "text-muted-foreground", bg: "bg-muted/50", icon: Circle },
  connected: { label: "متصل", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", icon: Plug },
  tested: { label: "تم الاختبار", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", icon: TestTube2 },
  active: { label: "نشط", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  disabled: { label: "معطل", color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
};

// Payment method icons
const PaymentMethodBadge = ({ method }: { method: string }) => (
  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
    {method}
  </span>
);

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

      // Auto-expand connected providers
      const autoExpand: Record<string, boolean> = {};
      for (const key of Object.keys(map)) {
        if (map[key].status !== "disconnected") autoExpand[key] = true;
      }
      setExpanded(autoExpand);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCredentialChange = useCallback((provider: string, field: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [field]: value },
    }));
    if (autosaveTimers.current[provider]) clearTimeout(autosaveTimers.current[provider]);
    autosaveTimers.current[provider] = setTimeout(() => { handleSave(provider); }, 1200);
  }, []);

  const handleWebhookSecretChange = useCallback((provider: string, value: string) => {
    setWebhookSecrets((prev) => ({ ...prev, [provider]: value }));
    if (autosaveTimers.current[`ws_${provider}`]) clearTimeout(autosaveTimers.current[`ws_${provider}`]);
    autosaveTimers.current[`ws_${provider}`] = setTimeout(() => { handleSave(provider); }, 1200);
  }, []);

  const handleSave = async (provider: string) => {
    const creds = credentials[provider];
    if (!creds || Object.keys(creds).length === 0) return;
    const hasValues = Object.values(creds).some((v) => v && v.trim());
    if (!hasValues) return;

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
    const dedicatedFn = PROVIDERS.find((p) => p.key === providerKey)?.webhookFn;
    if (dedicatedFn) return `${supabaseUrl}/functions/v1/${dedicatedFn}?tenant_id=${tenantId}`;
    return `${supabaseUrl}/functions/v1/payment-webhook?provider=${providerKey}&tenant_id=${tenantId}`;
  };

  const copyWebhookUrl = (providerKey: string) => {
    const url = getWebhookUrl(providerKey);
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "تم النسخ ✓", description: "تم نسخ Webhook URL" });
  };

  const toggleExpand = (key: string) => {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  };

  const connectedCount = Object.values(providerRecords).filter(r => r.status !== "disconnected").length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ═══════════════════ HERO HEADER ═══════════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(220,30%,10%)] via-[hsl(220,35%,16%)] to-[hsl(172,50%,20%)]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-blue-500 blur-3xl" />
        </div>
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "linear-gradient(hsl(0,0%,100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,100%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 px-6 py-10 max-w-5xl mx-auto">
          {/* Top badges */}
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
              <Shield size={11} className="text-accent" />
              مشفّرة AES-256-GCM
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
              <Lock size={11} className="text-accent" />
              PCI-DSS متوافق
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
              <Zap size={11} className="text-amber-400" />
              Webhooks آنية
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
            بوابات الدفع
            <span className="block text-accent text-lg font-medium mt-1">أحضر بوابتك الخاصة • BYO Gateway</span>
          </h1>
          <p className="text-white/60 text-sm max-w-xl leading-relaxed mb-8">
            ربط حسابك مع أي بوابة دفع مدعومة. تُخزَّن جميع المفاتيح مشفرة ولا تمر أبداً عبر المتصفح.
            سيتم تحديث الفاتورة تلقائياً عند إتمام الدفع عبر Webhook آمن.
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20">
                <Globe size={16} className="text-accent" />
              </div>
              <div>
                <p className="text-xs text-white/40">بوابات مدعومة</p>
                <p className="text-lg font-bold text-white">{PROVIDERS.length}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">متصلة</p>
                <p className="text-lg font-bold text-white">{connectedCount}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                <Shield size={16} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">مستوى الأمان</p>
                <p className="text-sm font-bold text-white">AES-GCM</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <div className="bg-muted/30 border-b border-border">
        <div className="px-6 py-5 max-w-5xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 shrink-0 mt-0.5">
              <Info size={16} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-3">كيف يعمل النظام؟</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {[
                  { n: "1", title: "أدخل المفاتيح", desc: "أدخل بيانات الاعتماد من لوحة المزود" },
                  { n: "2", title: "تشفير فوري", desc: "تُشفَّر المفاتيح بـ AES-256-GCM على الخادم" },
                  { n: "3", title: "أنشئ فاتورة", desc: "عند الدفع تُرسل الإشارة للمزود" },
                  { n: "4", title: "تحديث تلقائي", desc: "Webhook يحدّث الفاتورة فور إتمام الدفع" },
                ].map(step => (
                  <div key={step.n} className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold shrink-0">
                      {step.n}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{step.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ PROVIDERS LIST ═══════════════════ */}
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-4">
        {PROVIDERS.map((provider, idx) => {
          const record = providerRecords[provider.key];
          const status = record?.status || "disconnected";
          const StatusIcon = STATUS_CONFIG[status].icon;
          const isSaving = saving[provider.key];
          const isTesting = testing[provider.key];
          const isExpanded = expanded[provider.key];
          const LogoComponent = PROVIDER_LOGOS[provider.key];
          const isConnected = status !== "disconnected";

          return (
            <motion.div
              key={provider.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={cn(
                "rounded-2xl border overflow-hidden transition-shadow duration-200",
                isConnected ? "shadow-md" : "shadow-sm",
                provider.borderColor,
                "bg-card"
              )}
            >
              {/* ─── Card Header (always visible) ─── */}
              <div
                className={cn(
                  "flex items-center justify-between p-5 cursor-pointer select-none",
                  `bg-gradient-to-l ${provider.bgGradient}`
                )}
                onClick={() => toggleExpand(provider.key)}
              >
                <div className="flex items-center gap-4">
                  {/* Logo */}
                  <div className="shrink-0">
                    <LogoComponent />
                  </div>
                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground">{provider.labelAr}</h3>
                      <span className="text-xs text-muted-foreground font-normal">{provider.label}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                        {provider.tagline}
                      </span>
                    </div>
                    {/* Payment methods */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {provider.methods.map(m => <PaymentMethodBadge key={m} method={m} />)}
                    </div>
                  </div>
                </div>

                {/* Right side: status + chevron */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    STATUS_CONFIG[status].bg, STATUS_CONFIG[status].color
                  )}>
                    <StatusIcon size={11} />
                    {STATUS_CONFIG[status].label}
                    {isSaving && <Loader2 size={10} className="animate-spin" />}
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </div>
              </div>

              {/* ─── Expanded Content ─── */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-5 border-t border-border/50 pt-5">
                      {/* Description */}
                      <p className="text-sm text-muted-foreground leading-relaxed">{provider.description}</p>

                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                        {/* ── Setup Guide ── */}
                        <div className="lg:col-span-2 rounded-xl border border-border bg-muted/30 p-4">
                          <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                            <Zap size={12} className="text-accent" />
                            دليل الإعداد السريع
                          </p>
                          <ol className="space-y-2.5">
                            {provider.setupSteps.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold text-accent mt-0.5">
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
                            onClick={e => e.stopPropagation()}
                            className="mt-3 flex items-center gap-1 text-[11px] text-accent hover:underline"
                          >
                            <ExternalLink size={10} />
                            فتح موقع {provider.label}
                          </a>
                        </div>

                        {/* ── Credentials ── */}
                        <div className="lg:col-span-3 space-y-3">
                          {provider.credentialFields.map((field) => (
                            <div key={field.key} className="space-y-1.5">
                              <Label className="text-xs font-medium">{field.label}</Label>
                              <div className="relative">
                                <Input
                                  type={field.secret && !showSecrets[`${provider.key}_${field.key}`] ? "password" : "text"}
                                  placeholder={field.placeholder}
                                  value={credentials[provider.key]?.[field.key] || ""}
                                  onChange={(e) => handleCredentialChange(provider.key, field.key, e.target.value)}
                                  className="bg-background font-mono text-sm pe-10"
                                  dir="ltr"
                                />
                                {field.secret && (
                                  <button
                                    type="button"
                                    onClick={() => setShowSecrets((p) => ({
                                      ...p,
                                      [`${provider.key}_${field.key}`]: !p[`${provider.key}_${field.key}`],
                                    }))}
                                    className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                                  >
                                    {showSecrets[`${provider.key}_${field.key}`] ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                )}
                              </div>
                              {field.hint && (
                                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                                  <Info size={10} className="mt-0.5 shrink-0" />{field.hint}
                                </p>
                              )}
                            </div>
                          ))}

                          {/* Webhook Secret */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                              <Shield size={11} className="text-amber-500" />
                              Webhook Secret
                              <span className="font-normal text-muted-foreground">(مطلوب للتحقق من الطلبات)</span>
                            </Label>
                            <div className="relative">
                              <Input
                                type={showSecrets[`${provider.key}_ws`] ? "text" : "password"}
                                placeholder="السر المشترك من لوحة إعدادات المزود (whsec_...)"
                                value={webhookSecrets[provider.key] || ""}
                                onChange={(e) => handleWebhookSecretChange(provider.key, e.target.value)}
                                className="bg-background font-mono text-sm pe-10"
                                dir="ltr"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecrets((p) => ({ ...p, [`${provider.key}_ws`]: !p[`${provider.key}_ws`] }))}
                                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                              >
                                {showSecrets[`${provider.key}_ws`] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            {record?.has_webhook_secret ? (
                              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={10} /> تم ضبط Webhook Secret
                              </p>
                            ) : status !== "disconnected" ? (
                              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                                <AlertTriangle size={10} /> لم يتم إعداد Webhook Secret — ستُرفض جميع الـ Webhooks
                              </p>
                            ) : null}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => handleSave(provider.key)}
                              disabled={isSaving}
                              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                            >
                              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                              حفظ آمن
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTest(provider.key)}
                              disabled={isTesting || status === "disconnected"}
                              className="gap-2"
                            >
                              {isTesting ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />}
                              اختبار الاتصال
                            </Button>

                            {isConnected && tenantId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyWebhookUrl(provider.key)}
                                className="gap-2 text-muted-foreground hover:text-foreground"
                              >
                                <Copy size={13} />
                                نسخ Webhook URL
                              </Button>
                            )}
                          </div>

                          {/* Webhook URL */}
                          {isConnected && tenantId && (
                            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                              <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                                <LinkIcon size={10} />
                                Webhook URL — أضفه في لوحة {provider.label}
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-[10px] font-mono text-foreground break-all bg-background rounded px-2 py-1.5" dir="ltr">
                                  {getWebhookUrl(provider.key)}
                                </code>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => copyWebhookUrl(provider.key)}>
                                  <Copy size={12} />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Last tested */}
                          {record?.last_tested_at && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <RefreshCw size={10} />
                              آخر اختبار: {new Date(record.last_tested_at).toLocaleString("ar-SA")}
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

        {/* ═══════════════════ SECURITY FOOTER ═══════════════════ */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/40 to-muted/20 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 shrink-0">
              <Shield size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">أمان على مستوى المؤسسات</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {[
                  { icon: Lock, title: "تشفير AES-256-GCM", desc: "جميع المفاتيح تُشفَّر قبل التخزين ولا تُقرأ أبداً من قاعدة البيانات" },
                  { icon: Shield, title: "التحقق من Webhook", desc: "HMAC-SHA256 يتحقق من كل طلب Webhook — الطلبات المزوّرة تُرفض فوراً" },
                  { icon: Zap, title: "عزل التنانت", desc: "كل مستأجر له مفتاح تشفير منفصل — لا مشاركة للبيانات بين الحسابات" },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                      <item.icon size={13} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
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
