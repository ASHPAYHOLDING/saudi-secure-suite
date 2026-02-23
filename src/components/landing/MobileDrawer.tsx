import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Globe,
  HelpCircle,
  LogIn,
  Home,
  LayoutGrid,
  ShieldCheck,
  DollarSign,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

/* ── Types ── */
export interface NavItem {
  label: string;
  href: string;
  icon?: React.ElementType;
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  links: NavItem[];
  activeSection: string;
  onNavClick: (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  currentLang: string;
  onToggleLanguage: () => void;
  ctaLabel: string;
  loginLabel: string;
}

/* ── Icon map for landing sections ── */
const sectionIconMap: Record<string, React.ElementType> = {
  "#home": Home,
  "#features": LayoutGrid,
  "#why": Sparkles,
  "#compliance": ShieldCheck,
  "#pricing": DollarSign,
  "#contact": Phone,
};

const MobileDrawer = ({
  open,
  onClose,
  links,
  activeSection,
  onNavClick,
  currentLang,
  onToggleLanguage,
  ctaLabel,
  loginLabel,
}: MobileDrawerProps) => {
  const isRTL = currentLang === "ar";
  const [searchQuery, setSearchQuery] = useState("");

  /* Filter links by search */
  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return links;
    const q = searchQuery.toLowerCase();
    return links.filter((l) => l.label.toLowerCase().includes(q));
  }, [links, searchQuery]);

  /* Reset search on close */
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSearchQuery("");
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/* side="left" = inline-start → right in RTL, left in LTR */}
      <SheetContent
        side="left"
        className="w-[min(340px,88vw)] p-0 flex flex-col gap-0 overflow-hidden [&>button.absolute]:hidden"
      >
        {/* Accessible title (hidden visually) */}
        <VisuallyHidden.Root>
          <SheetTitle>
            {isRTL ? "القائمة الرئيسية" : "Main menu"}
          </SheetTitle>
        </VisuallyHidden.Root>

        {/* ── Header ── */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
          <span
            className="text-lg font-semibold tracking-[0.05em] leading-none select-none shrink-0 text-foreground"
            aria-label="Numaxio"
          >
            NUMA<span className="text-[hsl(var(--accent))]">XIO</span>
          </span>

          <button
            onClick={onClose}
            className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={isRTL ? "إغلاق القائمة" : "Close menu"}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <div className="relative">
            <Search
              size={15}
              className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? "ابحث في القائمة…" : "Search menu…"}
              className={cn(
                "w-full h-10 rounded-lg border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground",
                "ps-9 pe-3 outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
              )}
            />
          </div>
        </div>

        {/* ── Nav links ── */}
        <nav
          className="flex-1 overflow-y-auto py-2 px-3"
          aria-label={isRTL ? "التنقل الرئيسي" : "Main navigation"}
        >
          {filteredLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isRTL ? "لا توجد نتائج" : "No results"}
            </p>
          ) : (
            <ul className="space-y-0.5" role="list">
              {filteredLinks.map((link) => {
                const isActive = activeSection === link.href.replace("#", "");
                const Icon = link.icon || sectionIconMap[link.href];
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={(e) => onNavClick(e, link.href)}
                      className={cn(
                        "flex items-center gap-3 text-sm font-medium min-h-[44px] px-3 rounded-lg transition-colors text-start",
                        isActive
                          ? "text-primary bg-primary/10 font-semibold"
                          : "text-foreground hover:bg-muted active:bg-muted/80"
                      )}
                    >
                      {Icon && (
                        <Icon
                          size={16}
                          className={cn(
                            "shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                      )}
                      <span className="truncate">{link.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* ── Footer actions ── */}
        <div className="shrink-0 border-t border-border">
          {/* Utility row */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
            {/* Language toggle */}
            <button
              onClick={() => {
                onToggleLanguage();
                onClose();
              }}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label={isRTL ? "Switch to English" : "التبديل للعربية"}
            >
              <Globe size={15} />
              <span>{isRTL ? "EN" : "ع"}</span>
            </button>

            {/* Help */}
            <Link
              to="#contact"
              onClick={(e) => onNavClick(e, "#contact")}
              className="inline-flex items-center gap-2 min-h-[44px] px-3 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label={isRTL ? "المساعدة" : "Help"}
            >
              <HelpCircle size={15} />
              <span>{isRTL ? "مساعدة" : "Help"}</span>
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="p-3 space-y-2">
            <Link to="/auth" onClick={onClose} className="block">
              <Button
                variant="outline"
                className="w-full h-11 rounded-lg text-sm font-medium gap-2"
              >
                <LogIn size={15} className="rtl-mirror" />
                {loginLabel}
              </Button>
            </Link>

            <Link to="/auth" onClick={onClose} className="block">
              <Button className="w-full h-11 rounded-lg bg-accent text-accent-foreground font-bold text-sm">
                {ctaLabel}
              </Button>
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileDrawer;
