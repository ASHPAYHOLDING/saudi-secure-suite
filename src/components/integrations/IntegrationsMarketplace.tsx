/**
 * IntegrationsMarketplace — Premium Enterprise Integrations Marketplace
 * Redesigned with glassmorphism, per-category empty states,
 * enhanced card design, and polished filter UX.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
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
  Settings, Zap, Package,
} from "lucide-react";

// ── Categories ──
const CATEGORIES = [
  { key: "all", label: "الكل", labelEn: "All", icon: Plug, emoji: "🔌", emptyMsg: "لا توجد تكاملات حالياً", emptyMsgEn: "No integrations available" },
  { key: "accounting", label: "المحاسبة", labelEn: "Accounting", icon: Calculator, emoji: "📊", emptyMsg: "لا توجد تكاملات محاسبية بعد", emptyMsgEn: "No accounting integrations yet" },
  { key: "payment", label: "بوابات الدفع", labelEn: "Payment", icon: CreditCard, emoji: "💳", emptyMsg: "لا توجد بوابات دفع", emptyMsgEn: "No payment gateways" },
  { key: "pos", label: "نقاط البيع", labelEn: "POS", icon: Monitor, emoji: "📱", emptyMsg: "لا توجد تكاملات نقاط بيع", emptyMsgEn: "No POS integrations" },
  { key: "ecommerce", label: "التجارة الإلكترونية", labelEn: "E-commerce", icon: ShoppingBag, emoji: "🛒", emptyMsg: "لا توجد تكاملات تجارة إلكترونية", emptyMsgEn: "No e-commerce integrations" },
  { key: "marketing", label: "التسويق", labelEn: "Marketing", icon: Megaphone, emoji: "📣", emptyMsg: "لا توجد تكاملات تسويقية", emptyMsgEn: "No marketing integrations" },
  { key: "shipping", label: "الشحن", labelEn: "Shipping", icon: Truck, emoji: "🚚", emptyMsg: "لا توجد تكاملات شحن", emptyMsgEn: "No shipping integrations" },
  { key: "communications", label: "الاتصالات", labelEn: "Communications", icon: Phone, emoji: "📞", emptyMsg: "لا توجد تكاملات اتصالات", emptyMsgEn: "No communication integrations" },
  { key: "bnpl", label: "تقسيط BNPL", labelEn: "BNPL", icon: Repeat2, emoji: "🔄", emptyMsg: "لا توجد تكاملات تقسيط", emptyMsgEn: "No BNPL integrations" },
];

// ── Marketing cards ──
const MARKETING_CARDS: MarketingCardData[] = [
  { id: "tiktok", route: "/dashboard/integrations/marketing/tiktok", name: "TikTok Conversion API", nameEn: "TikTok CAPI", logo: "/brands/marketing/tiktok.svg", category: "marketing", desc: "تتبع التحويلات وإرسال الأحداث إلى TikTok من السيرفر.", descEn: "Track conversions and send events to TikTok server-side.", pricing: "free" },
  { id: "meta", route: "/dashboard/integrations/marketing/meta", name: "Meta Pixel + Conversions API", nameEn: "Meta CAPI", logo: "/brands/marketing/meta.svg", category: "marketing", desc: "تتبع التحويلات على Facebook/Instagram عبر Pixel وCAPI.", descEn: "Track Facebook/Instagram conversions via Pixel + CAPI.", pricing: "free" },
  { id: "facebook_capi", route: "/dashboard/integrations/marketing/facebook-capi", name: "Facebook CAPI", nameEn: "Facebook CAPI", logo: "/brands/marketing/facebook.svg", category: "marketing", desc: "أحداث التحويل من السيرفر بدون Pixel — تجاوز Ad Blockers.", descEn: "Server-side conversion events without Pixel.", pricing: "free" },
  { id: "x", route: "/dashboard/integrations/marketing/x", name: "X Pixel", nameEn: "X (Twitter) Pixel", logo: "/brands/marketing/x.svg", category: "marketing", desc: "تتبع التحويلات والجماهير على X (تويتر).", descEn: "Track conversions and audiences on X.", pricing: "free" },
  { id: "gtm", route: "/dashboard/integrations/marketing/gtm", name: "Google Tag Manager", nameEn: "Google Tag Manager", logo: "/brands/marketing/google-tag-manager.svg", category: "marketing", desc: "أدر جميع تاقات التتبع من مكان واحد.", descEn: "Manage all tracking tags from one place.", pricing: "free" },
  { id: "google_ads", route: "/dashboard/integrations/marketing/google-ads", name: "Google Ads Conversions", nameEn: "Google Ads", logo: "/brands/marketing/google-ads.svg", category: "marketing", desc: "ارفع تحويلات Google Ads من السيرفر.", descEn: "Upload Google Ads conversions server-side.", pricing: "free" },
  { id: "meta_catalog", route: "/dashboard/integrations/marketing/meta-catalog", name: "Meta Catalog", nameEn: "Meta Product Catalog", logo: "/brands/marketing/meta.svg", category: "marketing", desc: "زامن كاتالوج منتجاتك مع Facebook & Instagram Shop.", descEn: "Sync your product catalog with Facebook & Instagram Shop.", pricing: "free" },
  { id: "x_catalog", route: "/dashboard/integrations/marketing/x-catalog", name: "X Catalog", nameEn: "X Product Catalog", logo: "/brands/marketing/x.svg", category: "marketing", desc: "زامن كاتالوج منتجاتك مع X Ads.", descEn: "Sync product catalog with X Ads.", pricing: "free" },
];

interface MarketingCardData {
  id: string; route: string; name: string; nameEn: string;
  logo: string; category: string; desc: string; descEn: string;
  pricing: "free" | "paid" | "plan_required";
}

type PricingFilter = "all" | "free" | "paid";
type StatusFilter = "all" | "connected" | "not_connected";

const GLOBAL_PAYMENT_IDS = ["stripe", "paypal"];

// ── Animations ──
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 28 } },
};
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};

// ── Skeleton Card ──
const SkeletonCard = () => (
  <Card className="overflow-hidden border-border/40">
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg mt-2" />
    </div>
  </Card>
);

// ── Per-category Empty State ──
const CategoryEmptyState = ({
  category,
  isRTL,
  onReset,
}: {
  category: typeof CATEGORIES[number];
  isRTL: boolean;
  onReset: () => void;
}) => {
  const Icon = category.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full flex flex-col items-center justify-center py-24 gap-5 text-center"
    >
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted/60 border border-border/30">
          <Icon size={36} className="text-muted-foreground/40" />
        </div>
        <div className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border/50 shadow-sm text-lg">
          {category.emoji}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-foreground font-semibold text-base">
          {isRTL ? category.emptyMsg : category.emptyMsgEn}
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {isRTL
            ? "جرب تغيير التصنيف أو إزالة الفلاتر لعرض المزيد"
            : "Try changing the category or removing filters to see more"}
        </p>
      </div>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onReset}>
        <X size={13} />
        {isRTL ? "إعادة ضبط" : "Reset"}
      </Button>
    </motion.div>
  );
};

// ── Integration Card (Premium) ──
const IntegrationCard = ({
  manifest, isConnected, isRTL, onClick,
}: {
  manifest: IntegrationManifest; isConnected: boolean; isRTL: boolean; onClick: () => void;
}) => {
  const isGlobal = GLOBAL_PAYMENT_IDS.includes(manifest.providerId);
  const isBnpl = manifest.category === "bnpl";

  return (
    <motion.div variants={cardVariants} layout>
      <Card
        className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1 border-border/40 hover:border-accent/30 flex flex-col h-full bg-card/80 backdrop-blur-sm"
        onClick={onClick}
      >
        {/* Connected indicator */}
        {isConnected && (
          <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-l from-emerald-500 to-emerald-400" />
        )}

        <div className="p-5 flex flex-col flex-1 gap-3.5">
          {/* Logo + Name */}
          <div className="flex items-start gap-3.5">
            {manifest.logoPath ? (
              <div className="h-14 w-14 rounded-2xl border border-border/30 bg-background/80 flex items-center justify-center shrink-0 overflow-hidden p-2 shadow-sm group-hover:shadow-md transition-shadow">
                <img
                  src={manifest.logoPath}
                  alt={manifest.nameEn}
                  className="w-full h-full object-contain ltr:transform-none rtl:transform-none"
                  style={{ transform: "none" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ) : (
              <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${manifest.color || "from-accent/15 to-accent/5"} flex items-center justify-center shrink-0 text-accent font-bold text-sm shadow-sm`}>
                {manifest.nameEn.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-1">
                {manifest.name}
              </h3>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono" dir="ltr">
                {manifest.nameEn}
              </p>
            </div>
            {/* Status dot */}
            <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background ${isConnected ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">
            {manifest.description || (isRTL ? "إعداد وربط التكامل مع نظامك" : "Setup and connect integration with your system")}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {isConnected ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1 border-0 font-medium">
                <CheckCircle2 size={10} />
                {isRTL ? "متصل" : "Connected"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 gap-1">
                <Plug size={9} />
                {isRTL ? "غير متصل" : "Not connected"}
              </Badge>
            )}
            {isBnpl && (
              <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border-0">
                {isRTL ? "تقسيط" : "BNPL"}
              </Badge>
            )}
            {isGlobal && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 border-border/40">
                <Globe size={9} /> {isRTL ? "عالمي" : "Global"}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border/30 text-muted-foreground/60">
              {isRTL ? "مجاني" : "Free"}
            </Badge>
          </div>

          {/* CTA */}
          <div className="pt-3 mt-auto">
            <Button
              size="sm"
              variant={isConnected ? "outline" : "default"}
              className="w-full gap-1.5 text-xs h-9"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              {isConnected ? (
                <><Settings size={13} /> {isRTL ? "إدارة" : "Manage"}</>
              ) : (
                <><Zap size={13} /> {isRTL ? "تفعيل" : "Activate"}</>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// ── Marketing Card (Premium) ──
const MarketingIntegrationCard = ({
  card, isConnected, isRTL, onClick,
}: {
  card: MarketingCardData; isConnected: boolean; isRTL: boolean; onClick: () => void;
}) => (
  <motion.div variants={cardVariants} layout>
    <Card
      className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1 border-border/40 hover:border-accent/30 flex flex-col h-full bg-card/80 backdrop-blur-sm"
      onClick={onClick}
    >
      {isConnected && (
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-l from-emerald-500 to-emerald-400" />
      )}
      <div className="p-5 flex flex-col flex-1 gap-3.5">
        <div className="flex items-start gap-3.5">
          <div className="h-14 w-14 rounded-2xl border border-border/30 bg-background/80 flex items-center justify-center shrink-0 overflow-hidden p-2 shadow-sm group-hover:shadow-md transition-shadow">
            <img
              src={card.logo} alt={card.nameEn}
              className="w-full h-full object-contain"
              style={{ transform: "none" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-1">{card.name}</h3>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono" dir="ltr">{card.nameEn}</p>
          </div>
          <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background ${isConnected ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {isRTL ? card.desc : card.descEn}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {isConnected ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1 border-0 font-medium">
              <CheckCircle2 size={10} /> {isRTL ? "متصل" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-border/40 gap-1">
              <Plug size={9} /> {isRTL ? "غير متصل" : "Not connected"}
            </Badge>
          )}
          <Badge className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent border-0">
            📣 {isRTL ? "تسويق" : "Marketing"}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border/30 text-muted-foreground/60">
            {isRTL ? "مجاني" : "Free"}
          </Badge>
        </div>
        <div className="pt-3 mt-auto">
          <Button
            size="sm"
            variant={isConnected ? "outline" : "default"}
            className="w-full gap-1.5 text-xs h-9"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            {isConnected ? (
              <><Settings size={13} /> {isRTL ? "إدارة" : "Manage"}</>
            ) : (
              <><Zap size={13} /> {isRTL ? "تفعيل" : "Activate"}</>
            )}
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

  const filtered = useMemo(() => {
    let list = allManifests;
    if (activeCategory !== "all") list = list.filter((m) => m.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        m.name.includes(q) || m.nameEn.toLowerCase().includes(q) ||
        m.providerId.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)
      );
    }
    if (statusFilter === "connected") list = list.filter((m) => isManifestConnected(m));
    else if (statusFilter === "not_connected") list = list.filter((m) => !isManifestConnected(m));
    return list;
  }, [allManifests, activeCategory, search, statusFilter, connectedKeys]);

  const filteredMkt = useMemo(() => {
    if (activeCategory !== "all" && activeCategory !== "marketing") return [];
    let cards = MARKETING_CARDS;
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter((c) => c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.id.includes(q));
    }
    if (statusFilter === "connected") cards = cards.filter((c) => isMktConnected(c));
    else if (statusFilter === "not_connected") cards = cards.filter((c) => !isMktConnected(c));
    return cards;
  }, [activeCategory, search, statusFilter, connectedKeys]);

  const totalCount = filtered.length + filteredMkt.length;
  const connectedCount = allManifests.filter(isManifestConnected).length + MARKETING_CARDS.filter(isMktConnected).length;
  const totalAvailable = allManifests.length + MARKETING_CARDS.length;
  const hasActiveFilters = pricingFilter !== "all" || statusFilter !== "all";
  const activeCat = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  const resetAll = () => {
    setSearch("");
    setActiveCategory("all");
    setPricingFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1440px] mx-auto" dir="rtl">
      {/* ── Premium Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-accent/8 via-background to-primary/5 border border-border/30 p-6 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-primary/10 shadow-lg shadow-accent/10">
                <Sparkles size={26} className="text-accent" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {isRTL ? "مركز التكاملات" : "Integrations Center"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isRTL
                    ? `اكتشف وفعّل ${totalAvailable} تكامل لتوسيع نظامك`
                    : `Discover and activate ${totalAvailable} integrations to extend your system`}
                </p>
              </div>
            </div>
            {/* Stats */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-background/60 border border-border/30 backdrop-blur-sm">
                <span className="text-xl font-bold text-emerald-600">{connectedCount}</span>
                <span className="text-[10px] text-muted-foreground">{isRTL ? "نشط" : "Active"}</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-background/60 border border-border/30 backdrop-blur-sm">
                <span className="text-xl font-bold text-foreground">{totalAvailable}</span>
                <span className="text-[10px] text-muted-foreground">{isRTL ? "متاح" : "Available"}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Search + Filter Toggle ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
            <Input
              placeholder={isRTL ? "ابحث عن تكامل... (اسم، تصنيف، كلمات مفتاحية)" : "Search integrations by name, category, keywords..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pe-10 bg-card/80 backdrop-blur-sm border-border/40 h-11"
              dir="rtl"
            />
          </div>
          <Button
            variant={showFilters || hasActiveFilters ? "default" : "outline"}
            className="h-11 gap-2 px-4 shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={15} />
            <span className="hidden sm:inline text-sm">
              {isRTL ? "فلاتر" : "Filters"}
            </span>
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-foreground text-[10px] font-bold">
                {(pricingFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-6 p-5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 shadow-sm">
                {/* Status */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-muted-foreground" />
                    {isRTL ? "الحالة" : "Status"}
                  </label>
                  <div className="flex gap-1.5">
                    {(["all", "connected", "not_connected"] as StatusFilter[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={statusFilter === s ? "default" : "outline"}
                        className="text-xs h-8 px-3 rounded-lg"
                        onClick={() => setStatusFilter(s)}
                      >
                        {s === "all" && (isRTL ? "الكل" : "All")}
                        {s === "connected" && (isRTL ? "متصل ✓" : "Connected ✓")}
                        {s === "not_connected" && (isRTL ? "غير متصل" : "Not connected")}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CreditCard size={12} className="text-muted-foreground" />
                    {isRTL ? "التسعير" : "Pricing"}
                  </label>
                  <div className="flex gap-1.5">
                    {(["all", "free", "paid"] as PricingFilter[]).map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={pricingFilter === p ? "default" : "outline"}
                        className="text-xs h-8 px-3 rounded-lg"
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
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => { setPricingFilter("all"); setStatusFilter("all"); }}
                    >
                      <X size={12} /> {isRTL ? "مسح الفلاتر" : "Clear all"}
                    </Button>
                  </div>
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
        transition={{ delay: 0.12 }}
      >
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="h-auto p-1.5 flex-wrap gap-1 bg-muted/40 w-full justify-start rounded-xl border border-border/20">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="gap-1.5 text-xs px-3.5 py-2 rounded-lg data-[state=active]:shadow-md data-[state=active]:bg-background transition-all"
              >
                <span className="text-sm">{cat.emoji}</span>
                <span>{isRTL ? cat.label : cat.labelEn}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </motion.div>

      {/* ── Results count bar ── */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between"
        >
          <p className="text-xs text-muted-foreground">
            {isRTL
              ? `عرض ${totalCount} تكامل${activeCategory !== "all" ? ` في ${activeCat.label}` : ""}`
              : `Showing ${totalCount} integration${totalCount !== 1 ? "s" : ""}${activeCategory !== "all" ? ` in ${activeCat.labelEn}` : ""}`}
          </p>
          {(search || hasActiveFilters) && (
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground" onClick={resetAll}>
              <X size={11} /> {isRTL ? "مسح الكل" : "Clear all"}
            </Button>
          )}
        </motion.div>
      )}

      {/* ── Cards Grid ── */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </motion.div>
        ) : totalCount === 0 ? (
          <CategoryEmptyState category={activeCat} isRTL={isRTL} onReset={resetAll} />
        ) : (
          <motion.div
            key={`grid-${activeCategory}`}
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
          transition={{ delay: 0.25 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 border-t border-border/20 text-xs text-muted-foreground/60"
        >
          <span className="flex items-center gap-1.5">
            <Package size={12} />
            {totalCount} {isRTL ? "تكامل معروض" : "shown"}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="flex items-center gap-1.5">
            <Zap size={12} />
            {isRTL ? "كل مزود له صفحة إعداد وإدارة مستقلة" : "Each provider has dedicated setup & manage pages"}
          </span>
        </motion.div>
      )}
    </div>
  );
};

export default IntegrationsMarketplace;
