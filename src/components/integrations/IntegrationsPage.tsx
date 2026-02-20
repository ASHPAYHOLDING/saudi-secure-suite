/**
 * IntegrationsPage — كتالوج التكاملات
 * صفحة عرض (cards) مع فلترة + بحث + تصنيفات
 * لا توجد أي Help موحد — كل مزود له صفحته الخاصة
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getAllManifests, type IntegrationManifest } from "@/integrations/manifests";
import {
  Search, ArrowLeft, CheckCircle2, Plug,
  CreditCard, ShoppingBag, Monitor, Repeat2, Globe, Megaphone,
} from "lucide-react";

// ── تصنيفات العرض ─────────────────────────────────────────────────────────────
const CATEGORIES: { key: string; label: string; icon: any; emoji: string }[] = [
  { key: "all", label: "الكل", icon: Plug, emoji: "🔌" },
  { key: "payment", label: "بوابات محلية", icon: CreditCard, emoji: "🇸🇦" },
  { key: "bnpl", label: "تقسيط BNPL", icon: Repeat2, emoji: "💳" },
  { key: "ecommerce", label: "متاجر إلكترونية", icon: ShoppingBag, emoji: "🛒" },
  { key: "pos", label: "نقاط البيع", icon: Monitor, emoji: "📱" },
  { key: "marketing", label: "التسويق", icon: Megaphone, emoji: "📣" },
];

// بوابات الدفع العالمية
const GLOBAL_PAYMENT_IDS = ["stripe", "paypal"];

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 280, damping: 28 } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

// ── Provider Card ──────────────────────────────────────────────────────────────
const ProviderCard = ({ manifest, onOpen }: { manifest: IntegrationManifest; onOpen: () => void }) => {
  const isGlobal = GLOBAL_PAYMENT_IDS.includes(manifest.providerId);
  const isBnpl = manifest.category === "bnpl";

  return (
    <motion.div variants={cardVariants} layout>
      <Card
        className="group relative overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300 hover:ring-1 hover:ring-accent/30 flex flex-col h-full"
        onClick={onOpen}
      >
        {/* شريط اللون العلوي */}
        <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-l ${manifest.color || "from-accent/30 to-accent/10"} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

        <div className="p-5 flex flex-col flex-1 gap-4">
          {/* Header: شعار + اسم */}
          <div className="flex items-center gap-3">
            {manifest.logoPath ? (
              <div className="h-12 w-12 rounded-xl border border-border/30 bg-background flex items-center justify-center shrink-0 overflow-hidden p-1">
                <img
                  src={manifest.logoPath}
                  alt={manifest.nameEn}
                  className="w-full h-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="h-full w-full rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground text-xs font-bold">${manifest.nameEn.slice(0, 2)}</div>`; }}
                />
              </div>
            ) : (
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${manifest.color || "from-accent/10 to-accent/5"} flex items-center justify-center shrink-0 text-accent font-bold text-sm`}>
                {manifest.nameEn.slice(0, 2)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground leading-tight">{manifest.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{manifest.nameEn}</p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
      {isBnpl && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20">
                  تقسيط
                </Badge>
              )}
              {manifest.category === "marketing" && (
                <Badge className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent border-accent/20">
                  تسويق
                </Badge>
              )}
              {isGlobal && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1">
                  <Globe size={9} /> عالمي
                </Badge>
              )}
            </div>
          </div>

          {/* حقول الإعداد — عدد الحقول */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
              {manifest.fields.length} حقل إعداد
            </span>
            {manifest.webhookPath && (
              <span className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
                Webhook
              </span>
            )}
            <span className="text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
              {manifest.docsSections.length} قسم دليل
            </span>
          </div>

          {/* زر الفتح */}
          <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-auto">
            <code className="text-[10px] text-muted-foreground/50 font-mono">{manifest.providerId}</code>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs h-8 text-accent hover:bg-accent/5 hover:text-accent group-hover:translate-x-[-2px] transition-transform"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
            >
              الإعداد والتفاصيل
              <ArrowLeft size={12} />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// ── الصفحة الرئيسية ───────────────────────────────────────────────────────────
const IntegrationsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const allManifests = useMemo(() => getAllManifests(), []);

  const filtered = useMemo(() => {
    let list = allManifests;
    if (activeCategory === "all") {
      // كل الفئات
    } else {
      list = list.filter((m) => m.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.includes(q) ||
          m.nameEn.toLowerCase().includes(q) ||
          m.providerId.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allManifests, activeCategory, search]);

  // تقسيم حسب التصنيف للعرض المجمّع
  const localPayment = filtered.filter((m) => m.category === "payment" && !GLOBAL_PAYMENT_IDS.includes(m.providerId));
  const globalPayment = filtered.filter((m) => m.category === "payment" && GLOBAL_PAYMENT_IDS.includes(m.providerId));
  const bnpl = filtered.filter((m) => m.category === "bnpl");
  const ecommerce = filtered.filter((m) => m.category === "ecommerce");
  const pos = filtered.filter((m) => m.category === "pos");
  const marketing = filtered.filter((m) => m.category === "marketing");

  const openProvider = (manifest: IntegrationManifest) => {
    navigate(`/dashboard/integrations/${manifest.category}/${manifest.providerId}`);
  };

  const renderSection = (title: string, emoji: string, items: IntegrationManifest[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <h2 className="font-bold text-foreground">{title}</h2>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {items.map((m) => (
            <ProviderCard key={m.providerId} manifest={m} onOpen={() => openProvider(m)} />
          ))}
        </motion.div>
      </div>
    );
  };

  const showGrouped = activeCategory === "all" && !search.trim();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <Plug size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">مركز التكاملات</h1>
            <p className="text-sm text-muted-foreground">{allManifests.length} تكامل متاح — اختر مزوداً لعرض تفاصيله وإعداده</p>
          </div>
        </div>
      </motion.div>

      {/* ── بحث + فلترة ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث عن مزود... (Shopify, Moyasar, ...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-10"
            dir="rtl"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? "default" : "outline"}
              size="sm"
              className="gap-1.5 shrink-0 text-xs"
              onClick={() => setActiveCategory(cat.key)}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ── المحتوى ── */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <Search size={40} className="text-muted-foreground/20" />
            <p className="text-muted-foreground">لم يُعثر على نتائج لـ "{search}"</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setActiveCategory("all"); }}>
              إعادة ضبط الفلتر
            </Button>
          </motion.div>
        ) : showGrouped ? (
          <motion.div key="grouped" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
            {renderSection("بوابات دفع محلية 🇸🇦", "🇸🇦", localPayment)}
            {renderSection("بوابات دفع عالمية", "🌍", globalPayment)}
            {renderSection("تقسيط BNPL", "💳", bnpl)}
            {renderSection("متاجر إلكترونية", "🛒", ecommerce)}
            {renderSection("نقاط البيع", "📱", pos)}
            {renderSection("التسويق", "📣", marketing)}
          </motion.div>
        ) : (
          <motion.div
            key="flat"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filtered.map((m) => (
              <ProviderCard key={m.providerId} manifest={m} onOpen={() => openProvider(m)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer stats */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-border/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-accent" /> {allManifests.length} مزود مدعوم</span>
        <span className="flex items-center gap-1.5"><Plug size={12} /> كل مزود له صفحة إعداد خاصة</span>
      </div>
    </div>
  );
};

export default IntegrationsPage;
