import { useState, useEffect, useMemo } from "react";
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
  Search, Shield, Zap, Lock, CheckCircle2, Circle,
  Settings2, TestTube2, Plus, Filter, AlertTriangle,
  ExternalLink, Copy, ClipboardCheck, Globe, CreditCard,
  Sparkles, ArrowRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/payments/BrandLogo";
import PaymentProvidersPage from "./PaymentProvidersPage";

/* ─── Types ─────────────────────────────────────────────── */
type ProviderStatus = "disconnected" | "connected" | "tested" | "active" | "disabled";

interface ProviderRecord {
  status: ProviderStatus;
  last_tested_at: string | null;
  has_webhook_secret: boolean;
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
  methodIcons?: string[];
  featured?: boolean;
  popularity?: number; // 1-5
}

/* ─── Provider catalog (6 بوابات فقط) ───────────────────── */
const PROVIDERS: ProviderDef[] = [
  // ── محلية ──
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
  },
  {
    key: "telr",
    label: "Telr",
    labelAr: "تيلر",
    tagline: "بوابة الإمارات والشرق الأوسط",
    description: "بوابة دفع رائدة في الإمارات وجنوب آسيا. تقدم حلول متكاملة للبطاقات ومحافظ الدفع الرقمية مع دعم قوي لمنطقة الإمارات والخليج.",
    website: "https://telr.com",
    accentColor: "#E63946",
    category: "local",
    methods: ["فيزا", "ماستركارد", "Apple Pay", "بطاقات محلية"],
    popularity: 3,
  },
  // ── عالمية ──
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
  },
  // ── BNPL ──
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
  },
];

/* ─── Category config ────────────────────────────────────── */
const CATEGORIES = [
  { key: "all",    label: "الكل",            icon: Globe, count: PROVIDERS.length },
  { key: "local",  label: "🇸🇦 بوابات محلية", icon: null,  count: PROVIDERS.filter(p => p.category === "local").length },
  { key: "global", label: "🌍 بوابات عالمية", icon: null,  count: PROVIDERS.filter(p => p.category === "global").length },
  { key: "bnpl",   label: "💳 تقسيط BNPL",   icon: null,  count: PROVIDERS.filter(p => p.category === "bnpl").length },
];

/* ─── Filter config ──────────────────────────────────────── */
const STATUS_FILTERS = [
  { key: "all",          label: "الكل" },
  { key: "connected",    label: "متصل" },
  { key: "disconnected", label: "غير متصل" },
];

/* ─── Status config ──────────────────────────────────────── */
const STATUS_CONFIG = {
  disconnected: { label: "غير متصل",       dotColor: "bg-muted-foreground/60", badgeClass: "bg-muted text-muted-foreground",      barColor: "bg-muted-foreground/30" },
  connected:    { label: "متصل",            dotColor: "bg-info",               badgeClass: "bg-info/10 text-info",                barColor: "bg-info"                },
  tested:       { label: "بانتظار التفعيل", dotColor: "bg-warning",            badgeClass: "bg-warning/10 text-warning",           barColor: "bg-warning"             },
  active:       { label: "نشط",             dotColor: "bg-success",            badgeClass: "bg-success/10 text-success",           barColor: "bg-success"             },
  disabled:     { label: "معطل",            dotColor: "bg-destructive",        badgeClass: "bg-destructive/10 text-destructive",   barColor: "bg-destructive"         },
};

/* ─── Security Badges ────────────────────────────────────── */
const SECURITY_BADGES = [
  { icon: Lock,    label: "AES-256-GCM",          desc: "تشفير عسكري للمفاتيح"         },
  { icon: Shield,  label: "PCI-DSS Ready",         desc: "بنية تحتية آمنة للدفع"        },
  { icon: Zap,     label: "Secure Webhooks",       desc: "تحقق رقمي من كل حدث"          },
  { icon: CheckCircle2, label: "Idempotency",      desc: "حماية من التكرار والازدواجية" },
];

/* ════════════════════════════════════════════════════════════
   Card Component
   ════════════════════════════════════════════════════════════ */
const ProviderCard = ({
  provider,
  record,
  onConfigure,
  onTest,
  testing,
}: {
  provider: ProviderDef;
  record?: ProviderRecord;
  onConfigure: () => void;
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
      onClick={onConfigure}
    >
      {/* ── Status top bar ── */}
      <div className={cn("h-1 w-full transition-colors duration-500", cfg.barColor)} />

      {/* ── Card body ── */}
      <div className="flex flex-col flex-1 p-5 gap-4">

        {/* Header row: logo + status badge */}
        <div className="flex items-start justify-between gap-3">
          {/* Logo container */}
          <div className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-background p-2 shadow-sm",
            "transition-all duration-300 group-hover:shadow-md",
            !isConnected && "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"
          )}>
            <BrandLogo provider={provider.key} className="h-9 w-auto max-w-[44px] object-contain" />
          </div>

          {/* Status badge + featured */}
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
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
              {provider.label}
            </h3>
          </div>
          <p className="text-xs font-medium text-muted-foreground">{provider.tagline}</p>
        </div>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
          {provider.description}
        </p>

        {/* Method chips */}
        <div className="flex flex-wrap gap-1.5">
          {provider.methods.slice(0, 4).map((m) => (
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

        {/* Category badge */}
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

          {/* Website link */}
          <a
            href={provider.website}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="border-t border-border bg-muted/30 px-5 py-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {isConnected ? (
          <>
            <Button
              size="sm"
              variant="default"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={onConfigure}
            >
              <Settings2 size={13} />
              إدارة
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1.5 text-xs h-8"
              onClick={onTest}
              disabled={testing}
            >
              {testing ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <TestTube2 size={13} />
              )}
              اختبار
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            className="w-full gap-2 text-xs h-8"
            onClick={onConfigure}
          >
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
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
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
  const [loading, setLoading] = useState(true);
  const [providerRecords, setProviderRecords] = useState<Record<string, ProviderRecord>>({});
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [configureProvider, setConfigureProvider] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  /* ── Load provider statuses ── */
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

      const { data: records } = await supabase
        .from("tenant_payment_providers")
        .select("provider, status, last_tested_at, webhook_secret_encrypted")
        .eq("tenant_id", member.tenant_id)
        .in("provider", PROVIDERS.map(p => p.key));

      const map: Record<string, ProviderRecord> = {};
      for (const r of records || []) {
        map[r.provider] = {
          status: r.status as ProviderStatus,
          last_tested_at: r.last_tested_at,
          has_webhook_secret: !!r.webhook_secret_encrypted,
        };
      }
      setProviderRecords(map);
      setLoading(false);
    };
    load();
  }, [user]);

  /* ── Test connection ── */
  const handleTest = async (providerKey: string) => {
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

  /* ── Filtered providers ── */
  const filtered = useMemo(() => {
    return PROVIDERS.filter(p => {
      const catMatch = activeTab === "all" || p.category === activeTab;
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "connected" && (providerRecords[p.key]?.status ?? "disconnected") !== "disconnected") ||
        (statusFilter === "disconnected" && (providerRecords[p.key]?.status ?? "disconnected") === "disconnected");
      const searchMatch =
        !search ||
        p.label.toLowerCase().includes(search.toLowerCase()) ||
        p.labelAr.includes(search) ||
        p.tagline.includes(search) ||
        p.methods.some(m => m.includes(search));
      return catMatch && statusMatch && searchMatch;
    });
  }, [activeTab, statusFilter, search, providerRecords]);

  /* ── Connected count ── */
  const connectedCount = PROVIDERS.filter(
    p => (providerRecords[p.key]?.status ?? "disconnected") !== "disconnected"
  ).length;

  /* ── If configure modal is open, show PaymentProvidersPage (reuse existing) ── */
  if (configureProvider) {
    return (
      <div className="min-h-screen bg-background">
        {/* Back bar */}
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-6 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => setConfigureProvider(null)}
            >
              <ArrowRight size={14} className="rtl:rotate-0 ltr:rotate-180" />
              العودة إلى السوق
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">
              إعداد {PROVIDERS.find(p => p.key === configureProvider)?.label}
            </span>
          </div>
        </div>
        <PaymentProvidersPage />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ════════ Hero Header ════════ */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-muted/30 to-background px-6 py-10">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-20 -end-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -start-10 h-48 w-48 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          {/* Title row */}
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

            {/* Connected counter */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground tabular-nums">{connectedCount}</p>
                <p className="text-xs text-muted-foreground">من {PROVIDERS.length} متصل</p>
              </div>
              <div className="h-12 w-px bg-border hidden sm:block" />
              <Button size="sm" className="gap-2 hidden sm:flex">
                <Plus size={14} />
                إضافة بوابة
              </Button>
            </div>
          </div>

          {/* Security badges */}
          <div className="mt-6 flex flex-wrap gap-2">
            {SECURITY_BADGES.map((badge) => (
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

      {/* ════════ Filters & Search ════════ */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث عن بوابة دفع..."
                className="ps-9 h-9 text-sm bg-muted/40 border-border"
              />
            </div>

            {/* Status filter chips */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter size={14} className="text-muted-foreground" />
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    statusFilter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════════ Main Content ════════ */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab list */}
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

          {/* Tab content (all in one to avoid layout shift) */}
          {CATEGORIES.map(cat => (
            <TabsContent key={cat.key} value={cat.key} className="mt-0">
              {/* Results count */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {loading ? "جاري التحميل..." : `${filtered.length} بوابة`}
                  {search && <span className="ms-1">· نتائج "{search}"</span>}
                </p>
              </div>

              {/* Grid */}
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
                <motion.div
                  layout
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filtered.map((provider) => (
                      <ProviderCard
                        key={provider.key}
                        provider={provider}
                        record={providerRecords[provider.key]}
                        onConfigure={() => setConfigureProvider(provider.key)}
                        onTest={() => handleTest(provider.key)}
                        testing={testing[provider.key] ?? false}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* ── BYO Model info banner ── */}
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
