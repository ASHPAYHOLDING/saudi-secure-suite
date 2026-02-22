import { useState, useEffect, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Menu, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLockup from "@/components/landing/BrandLockup";
import MobileDrawer from "@/components/landing/MobileDrawer";
import type { NavItem } from "@/components/landing/MobileDrawer";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";
import { scrollToSection } from "@/lib/scrollToSection";

/* ── Single source of truth for nav items ── */
const navLinks: Record<string, NavItem[]> = {
  ar: [
    { label: "الرئيسية", href: "#home" },
    { label: "المميزات", href: "#features" },
    { label: "لماذا Numaxio", href: "#why" },
    { label: "الامتثال", href: "#compliance" },
    { label: "الأسعار", href: "#pricing" },
    { label: "تواصل معنا", href: "#contact" },
  ],
  en: [
    { label: "Home", href: "#home" },
    { label: "Features", href: "#features" },
    { label: "Why Numaxio", href: "#why" },
    { label: "Compliance", href: "#compliance" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" },
  ],
};

const sectionIds = ["home", "features", "why", "compliance", "pricing", "contact"];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const { currentLang, toggleLanguage } = useLanguage();

  const links = navLinks[currentLang === "ar" ? "ar" : "en"];
  const ctaLabel = currentLang === "ar" ? "ابدأ مجاناً" : "Start Free";
  const loginLabel = currentLang === "ar" ? "تسجيل الدخول" : "Login";

  /* ── Scroll detection ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Section observer ── */
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  /* ── Desktop nav click ── */
  const handleDesktopNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      scrollToSection(href.replace("#", ""));
    },
    []
  );

  /* ── Mobile nav click: close drawer first, then scroll ── */
  const handleMobileNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileOpen(false);
      // Wait for drawer close animation (300ms) before scrolling
      scrollToSection(href.replace("#", ""), 320);
    },
    []
  );

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full h-16 transition-colors duration-300 border-b",
          scrolled
            ? "bg-background border-border shadow-sm"
            : "bg-[hsl(220,25%,8%)] border-white/5"
        )}
      >
        <div className="max-w-7xl mx-auto h-full grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 md:px-10">

          {/* ═══ 1 · Brand ═══ */}
          <Link to="/" className="shrink-0 flex items-center">
            <BrandLockup variant={scrolled ? "dark" : "light"} />
          </Link>

          {/* ═══ 2 · Center Nav (desktop) ═══ */}
          <nav className="hidden lg:flex items-center justify-center gap-1.5 min-w-0">
            {links.map((link) => {
              const isActive = activeSection === link.href.replace("#", "");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleDesktopNavClick(e, link.href)}
                  className={cn(
                    "text-sm font-medium px-3 xl:px-4 py-2 rounded-md transition-colors whitespace-nowrap",
                    scrolled
                      ? isActive
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      : isActive
                        ? "text-white bg-white/15"
                        : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Spacer for mobile */}
          <div className="lg:hidden" />

          {/* ═══ 3 · Actions ═══ */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            <button
              onClick={toggleLanguage}
              className={cn(
                "hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors",
                scrolled
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                  : "text-white/60 hover:text-white hover:bg-white/[0.08]"
              )}
              aria-label="Switch language"
            >
              <Globe size={16} />
            </button>

            <Link to="/auth" className="hidden lg:inline-flex">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 rounded-md font-medium",
                  scrolled
                    ? "text-foreground hover:bg-muted"
                    : "text-white/90 hover:text-white hover:bg-white/[0.08]"
                )}
              >
                {loginLabel}
              </Button>
            </Link>

            <Link to="/auth" className="hidden sm:inline-flex">
              <Button
                size="sm"
                className="h-9 px-4 rounded-md bg-accent text-accent-foreground font-bold hover:bg-accent/90 transition-colors"
              >
                {ctaLabel}
              </Button>
            </Link>

            {/* Mobile hamburger */}
            <button
              className={cn(
                "lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors",
                scrolled
                  ? "text-foreground hover:bg-muted"
                  : "text-white/80 hover:text-white hover:bg-white/[0.08]"
              )}
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Mobile Drawer ═══ */}
      <MobileDrawer
        open={mobileOpen}
        onClose={closeMobile}
        links={links}
        activeSection={activeSection}
        onNavClick={handleMobileNavClick}
        currentLang={currentLang}
        onToggleLanguage={toggleLanguage}
        ctaLabel={ctaLabel}
        loginLabel={loginLabel}
      />
    </>
  );
};

export default memo(Navbar);
