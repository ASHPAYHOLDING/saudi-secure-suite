/**
 * IntegrationsMarketplace — Premium Enterprise Integrations Marketplace
 * Full redesign: status-aware cards, pricing badges, skeleton loading,
 * expanded categories, connected status, responsive grid.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAllManifests,
  type IntegrationManifest,
} from "@/integrations/manifests";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Search, CheckCircle2, Plug, CreditCard, ShoppingBag,
  Monitor, Repeat2, Globe, Megaphone, ArrowLeft,
  Calculator, Truck, Phone, Sparkles, Filter, X,
} from "lucide-react";

// ── Categories (expanded) ──
const CATEGORIES = [
  { key: "all", label: "الكل", labelEn: "All", icon: Plug, emoji: "🔌" },
  { key: "payment", label: "بوابات الدفع", labelEn: "Payment", icon: CreditCard, emoji: "💳" },
  { key: "bnpl", label: "تقسيط BNPL", labelEn: "BNPL", icon: Repeat2, emoji: "🔄" },
  { key: "pos", label: "نقاط البيع", labelEn: "POS", icon: Monitor, emoji: "📱" },
  { key: "ecommerce", label: "التجارة الإلكترونية", labelEn: "E-commerce", icon: ShoppingBag, emoji: "🛒" },
  { key: "marketing", label: "التسويق", labelEn: "Marketing", icon: Megaphone, emoji: "📣" },
  { key: "accounting", label: "المحاسبة", labelEn: "Accounting", icon: Calculator, emoji: "📊" },
  { key: "shipping", label: "الشحن", labelEn: "Shipping", icon: Truck, emoji: "🚚" },
  { key: "communications", label: "الاتصالات", labelEn: "Communications", icon: Phone, emoji: "📞" },
];

// ── Marketing cards (not manifest-based) ──
const MARKETING_CARDS: MarketingCardData[] = [
  {
    id: "tiktok", route: "/dashboard/integrations/marketing/tiktok",
    name: "TikTok Conversion API", nameEn: "TikTok CAPI",
    logo: "/brands/marketing/tiktok.svg", category: "marketing",
    desc: "تتبع التحويلات وإرسال الأحداث إلى TikTok من السيرفر.",
    descEn: "Track conversions and send events to TikTok server-side.",
    pricing: "free",
  },
  {
    id: "meta", route: "/dashboard/integrations/marketing/meta",
    name: "Meta Pixel + Conversions API", nameEn: "Meta CAPI",
    logo: "/brands/marketing/meta.svg", category: "marketing",
    desc: "تتبع التحويلات على Facebook/Instagram عبر Pixel وCAPI.",
    descEn: "Track Facebook/Instagram conversions via Pixel + CAPI.",
    pricing: "free",
  },
  {
    id: "facebook_capi", route: "/dashboard/integrations/marketing/facebook-capi",
    name: "Facebook CAPI", nameEn: "Facebook CAPI",
    logo: "/brands/marketing/facebook.svg", category: "marketing",
    desc: "أحداث التحويل من السيرفر بدون Pixel — تجاوز Ad Blockers.",
    descEn: "Server-side conversion events without Pixel.",
    pricing: "free",
  },
  {
    id: "x", route: "/dashboard/integrations/marketing/x",
    name: "X Pixel", nameEn: "X (Twitter) Pixel",
    logo: "/brands/marketing/x.svg", category: "marketing",
    desc: "تتبع التحويلات والجماهير على X (تويتر).",
    descEn: "Track conversions and audiences on X.",
    pricing: "free",
  },
  {
    id: "gtm", route: "/dashboard/integrations/marketing/gtm",
    name: "Google Tag Manager", nameEn: "Google Tag Manager",
    logo: "/brands/marketing/google-tag-manager.svg", category: "marketing",
    desc: "أدر جميع تاقات التتبع من مكان واحد.",
    descEn: "Manage all tracking tags from one place.",
    pricing: "free",
  },
  {
    id: "google_ads", route: "/dashboard/integrations/marketing/google-ads",
    name: "Google Ads Conversions", nameEn: "Google Ads",
    logo: "/brands/marketing/google-ads.svg", category: "marketing",
    desc: "ارفع تحويلات Google Ads من السيرفر.",
    descEn: "Upload Google Ads conversions server-side.",
    pricing: "free",
  },
  {
    id: "meta_catalog", route: "/dashboard/integrations/marketing/meta-catalog",
    name: "Meta Catalog", nameEn: "Meta Product Catalog",
    logo: "/brands/marketing/meta.svg", category: "marketing",
    desc: "زامن كاتالوج منتجاتك مع Facebook & Instagram Shop.",
    descEn: "Sync your product catalog with Facebook & Instagram Shop.",
    pricing: "free",
  },
  {
    id: "x_catalog", route: "/dashboard/integrations/marketing/x-catalog",
    name: "X Catalog", nameEn: "X Product Catalog",
    logo: "/brands/marketing/x.svg", category: "marketing",
    desc: "زامن كاتالوج منتجاتك مع X Ads.",
    descEn: "Sync product catalog with X Ads.",
    pricing: "free",
  },
];

interface MarketingCardData {
  id: string;
  route: string;
  name: string;
  nameEn: string;
  logo: string;
  category: string;
  desc: string;
  descEn: string;
  pricing: "free" | "paid" | "plan_required";
}

type PricingFilter = "all" | "free" | "paid";
type StatusFilter = "all" | "connected" | "not_connected";

const GLOBAL_PAYMENT_IDS = ["stripe", "paypal"];

// ── Animations ──
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
};
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

// ── Skeleton Card ──
const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </div>
  </Card>
);

// ── Integration Card ──
const IntegrationCard = ({
  manifest,
  isConnected,
  isRTL,
  onClick,
}: {
  manifest: IntegrationManifest;
  isConnected: boolean;
  isRTL: boolean;
  onClick: () => void;
}) => {
  const isGlobal = GLOBAL_PAYMENT_IDS.includes(manifest.providerId);
  const isBnpl = manifest.category === "bnpl";

  return (
    <motion.div variants={cardVariants} layout>
      <Card
        className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-accent/30 flex flex-col h-full bg-card"
        onClick={onClick}
      >
        {/* Top accent bar */}
        <div
          className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${manifest.color || "from-accent/40 to-accent/10"} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />

        <div className="p-5 flex flex-col flex-1 gap-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            {manifest.logoPath ? (
              <div className="h-14 w-14 rounded-2xl border border-border/40 bg-background flex items-center justify-center shrink-0 overflow-hidden p-1.5 shadow-sm">
                <img
                  src={manifest.logoPath}
                  alt={manifest.nameEn}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div
                className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${manifest.color || "from-accent/10 to-accent/5"} flex items-center justify-center shrink-0 text-accent font-bold text-base shadow-sm`}
              >
                {manifest.nameEn.slice(0, 2)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-1">
                {manifest.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                {manifest.nameEn}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2rem]">
            {manifest.description || (isRTL ? "إعداد وربط التكامل" : "Setup and connect integration")}
          </p>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Connected status */}
            {isConnected ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] gap-1 border-0">
                <CheckCircle2 size={10} />
                {isRTL ? "متصل" : "Connected"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50 gap-1">
                <Plug size={9} />
                {isRTL ? "غير متصل" : "Not connected"}
              </Badge>
            )}

            {/* Category badges */}
            {isBnpl && (
              <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border-0">
                {isRTL ? "تقسيط" : "BNPL"}
              </Badge>
            )}
            {isGlobal && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1">
                <Globe size={9} /> {isRTL ? "عالمي" : "Global"}
              </Badge>
            )}
            {manifest.category === "marketing" && (
              <Badge className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent border-0">
                {isRTL ? "تسويق" : "Marketing"}
              </Badge>
            )}

            {/* Pricing badge */}
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 border-border/40 text-muted-foreground"
            >
              {isRTL ? "مجاني" : "Free"}
            </Badge>
          </div>

          {/* CTA row */}
          <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-auto">
            <div className="flex items-center gap-1.5">
              {manifest.webhookPath && (
                <span className="text-[10px] text-muted-foreground/60 bg-muted/40 rounded px-1.5 py-0.5">
                  Webhook
                </span>
              )}
              {manifest.fields.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60 bg-muted/40 rounded px-1.5 py-0.5">
                  {manifest.fields.length} {isRTL ? "حقل" : "fields"}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant={isConnected ? "outline" : "default"}
              className="gap-1.5 text-xs h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              {isConnected
                ? (isRTL ? "إدارة" : "Manage")
                : (isRTL ? "تفعيل" : "Activate")}
              <ArrowLeft size={12} className="rtl:rotate-0 ltr:rotate-180" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// ── Marketing Integration Card ──
const MarketingIntegrationCard = ({
  card,
  isConnected,
  isRTL,
  onClick,
}: {
  card: MarketingCardData;
  isConnected: boolean;
  isRTL: boolean;
  onClick: () => void;
}) => (
  <motion.div variants={cardVariants} layout>
    <Card
      className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:ring-1 hover:ring-accent/30 flex flex-col h-full bg-card"
      onClick={onClick}
    >
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-accent/30 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 rounded-2xl border border-border/40 bg-background flex items-center justify-center shrink-0 overflow-hidden p-1.5 shadow-sm">
            <img
              src={card.logo}
              alt={card.nameEn}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-1">
              {card.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
              {card.nameEn}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2rem]">
          {isRTL ? card.desc : card.descEn}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {isConnected ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] gap-1 border-0">
              <CheckCircle2 size={10} /> {isRTL ? "متصل" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50 gap-1">
              <Plug size={9} /> {isRTL ? "غير متصل" : "Not connected"}
            </Badge>
          )}
          <Badge className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent border-0">
            {isRTL ? "تسويق" : "Marketing"}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border/40 text-muted-foreground">
            {isRTL ? "مجاني" : "Free"}
          </Badge>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-auto">
          <span className="text-[10px] text-muted-foreground/50 font-mono">{card.id}</span>
          <Button
            size="sm"
            variant={isConnected ? "outline" : "default"}
            className="gap-1.5 text-xs h-8 px-3"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            {isConnected ? (isRTL ? "إدارة" : "Manage") : (isRTL ? "تفعيل" : "Activate")}
            <ArrowLeft size={12} className="rtl:rotate-0 ltr:rotate-180" />
          </Button>
        </div>
      </div>
    </Card>
  </motion.div>
);

// ── Main Page ──
const IntegrationsMarketplace = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectedKeys, setConnectedKeys] = useState<Set<string>>(new Set());

  // Fetch connected integrations
  const fetchConnected = useCallback(async () => {
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("tenant_integrations" as any)
      .select("integration_key")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (data) {
      setConnectedKeys(new Set((data as any[]).map((d: any) => d.integration_key)));
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchConnected(); }, [fetchConnected]);

  const allManifests = useMemo(() => getAllManifests(), []);

  const isManifestConnected = (m: IntegrationManifest) =>
    connectedKeys.has(m.integrationKey || "") || connectedKeys.has(m.providerId);

  const isMktConnected = (card: MarketingCardData) =>
    connectedKeys.has(`mkt_${card.id}`) || connectedKeys.has(card.id);

  // Filter manifests
  const filtered = useMemo(() => {
    let list = allManifests;

    // Category
    if (activeCategory !== "all") {
      list = list.filter((m) => m.category === activeCategory);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.includes(q) ||
          m.nameEn.toLowerCase().includes(q) ||
          m.providerId.toLowerCase().includes(q) ||
          (m.description?.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === "connected") {
      list = list.filter((m) => isManifestConnected(m));
    } else if (statusFilter === "not_connected") {
      list = list.filter((m) => !isManifestConnected(m));
    }

    return list;
  }, [allManifests, activeCategory, search, statusFilter, connectedKeys]);

  // Filter marketing cards
  const filteredMkt = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "marketing") return [];
    let cards = MARKETING_CARDS;
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter(
        (c) => c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.id.includes(q)
      );
    }
    if (statusFilter === "connected") {
      cards = cards.filter((c) => isMktConnected(c));
    } else if (statusFilter === "not_connected") {
      cards = cards.filter((c) => !isMktConnected(c));
    }
    return cards;
  }, [activeCategory, search, statusFilter, connectedKeys]);

  const totalCount = filtered.length + filteredMkt.length;
  const connectedCount = allManifests.filter(isManifestConnected).length +
    MARKETING_CARDS.filter(isMktConnected).length;

  const hasActiveFilters = pricingFilter !== "all" || statusFilter !== "all";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 shadow-sm">
              <Sparkles size={22} className="text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {isRTL ? "مركز التكاملات" : "Integrations Center"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {allManifests.length + MARKETING_CARDS.length} {isRTL ? "تكامل متاح" : "integrations available"}
                {connectedCount > 0 && (
                  <> · <span className="text-emerald-600 font-medium">{connectedCount} {isRTL ? "متصل" : "connected"}</span></>
                )}
              </p>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              {connectedCount} {isRTL ? "نشط" : "active"}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1.5 px-2.5 py-1">
              <Plug size={12} className="text-muted-foreground" />
              {allManifests.length + MARKETING_CARDS.length - connectedCount} {isRTL ? "متاح" : "available"}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* ── Search + Filters ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder={isRTL ? "ابحث عن تكامل... (Shopify, Moyasar, TikTok...)" : "Search integrations..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pe-10 bg-card"
              dir="rtl"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
          </Button>
        </div>

        {/* Advanced filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                {/* Status filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isRTL ? "الحالة" : "Status"}
                  </label>
                  <div className="flex gap-1.5">
                    {(["all", "connected", "not_connected"] as StatusFilter[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={statusFilter === s ? "default" : "outline"}
                        className="text-xs h-7 px-2.5"
                        onClick={() => setStatusFilter(s)}
                      >
                        {s === "all" && (isRTL ? "الكل" : "All")}
                        {s === "connected" && (isRTL ? "متصل" : "Connected")}
                        {s === "not_connected" && (isRTL ? "غير متصل" : "Not connected")}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Pricing filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {isRTL ? "التسعير" : "Pricing"}
                  </label>
                  <div className="flex gap-1.5">
                    {(["all", "free", "paid"] as PricingFilter[]).map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={pricingFilter === p ? "default" : "outline"}
                        className="text-xs h-7 px-2.5"
                        onClick={() => setPricingFilter(p)}
                      >
                        {p === "all" && (isRTL ? "الكل" : "All")}
                        {p === "free" && (isRTL ? "مجاني" : "Free")}
                        {p === "paid" && (isRTL ? "مدفوع" : "Paid")}
                      </Button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1 text-destructive self-end"
                    onClick={() => {
                      setPricingFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    <X size={12} /> {isRTL ? "مسح الفلاتر" : "Clear"}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Category Tabs ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="h-auto p-1 flex-wrap gap-0.5 bg-muted/50 w-full justify-start">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="gap-1.5 text-xs px-3 py-1.5 data-[state=active]:shadow-sm"
              >
                <span>{cat.emoji}</span>
                {isRTL ? cat.label : cat.labelEn}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </motion.div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </motion.div>
        ) : totalCount === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
              <Search size={28} className="text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-foreground font-medium">
                {isRTL ? "لم يُعثر على نتائج" : "No results found"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? (isRTL ? `لم يُعثر على تكامل يطابق "${search}"` : `No integration matching "${search}"`) : (isRTL ? "لا توجد تكاملات في هذا التصنيف" : "No integrations in this category")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setActiveCategory("all");
                setPricingFilter("all");
                setStatusFilter("all");
              }}
            >
              {isRTL ? "إعادة ضبط الفلتر" : "Reset filters"}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filtered.map((m) => (
              <IntegrationCard
                key={m.providerId}
                manifest={m}
                isConnected={isManifestConnected(m)}
                isRTL={isRTL}
                onClick={() => navigate(`/dashboard/integrations/${m.providerId}`)}
              />
            ))}
            {filteredMkt.map((card) => (
              <MarketingIntegrationCard
                key={card.id}
                card={card}
                isConnected={isMktConnected(card)}
                isRTL={isRTL}
                onClick={() => navigate(card.route)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      {!loading && totalCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-6 pt-4 border-t border-border/30 text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-accent" />
            {totalCount} {isRTL ? "تكامل معروض" : "shown"}
          </span>
          <span className="flex items-center gap-1.5">
            <Plug size={12} />
            {isRTL ? "كل مزود له صفحة إعداد خاصة" : "Each provider has a dedicated setup page"}
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default IntegrationsMarketplace;
