import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

const navLinks = {
  ar: [
    { label: "المميزات", href: "#features" },
    { label: "لماذا Numaxio", href: "#why" },
    { label: "الامتثال", href: "#compliance" },
    { label: "الأسعار", href: "#pricing" },
    { label: "تواصل معنا", href: "#contact" },
  ],
  en: [
    { label: "Features", href: "#features" },
    { label: "Why Numaxio", href: "#why" },
    { label: "Compliance", href: "#compliance" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" },
  ],
};

const sectionIds = ["features", "why", "compliance", "pricing", "contact"];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const { currentLang, isRTL, toggleLanguage } = useLanguage();

  const links = navLinks[currentLang === "ar" ? "ar" : "en"];

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

  /* ── Smooth scroll ── */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      const el = document.getElementById(href.replace("#", ""));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileOpen(false);
    },
    []
  );

  /* ── Lock body scroll on mobile open ── */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const ctaLabel = currentLang === "ar" ? "ابدأ مجاناً" : "Start Free";
  const loginLabel = currentLang === "ar" ? "تسجيل الدخول" : "Login";

  return (
    <>
      <header
        className={cn(
          "fixed top-0 inset-inline-0 z-50 h-16 transition-all duration-500",
          scrolled
            ? "bg-background/95 backdrop-blur-xl shadow-[0_1px_3px_hsl(var(--foreground)/0.08)] border-b border-border/60"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto h-full grid grid-cols-[auto_1fr_auto] items-center px-4 sm:px-6 lg:px-8 gap-4">

          {/* ═══ Zone 1 · Brand ═══ */}
          <Link to="/" className="flex items-center shrink-0">
            <NumaxioLogo variant={scrolled ? "dark" : "light"} size="sm" />
          </Link>

          {/* ═══ Zone 2 · Desktop Nav ═══ */}
          <nav className="hidden lg:flex items-center justify-center">
            <div
              className={cn(
                "flex items-center rounded-full px-1.5 py-1 transition-all duration-500",
                scrolled
                  ? "bg-muted/60 border border-border/40"
                  : "bg-white/[0.08] border border-white/[0.12] backdrop-blur-sm"
              )}
            >
              {links.map((link) => {
                const isActive = activeSection === link.href.replace("#", "");
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className={cn(
                      "relative text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap",
                      scrolled
                        ? isActive
                          ? "text-accent bg-accent/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        : isActive
                          ? "text-white bg-white/15"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          </nav>

          {/* ═══ Zone 3 · Actions ═══ */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className={cn(
                "hidden sm:flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300",
                scrolled
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted border border-border/40"
                  : "text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
              )}
              aria-label="Switch language"
            >
              <Globe size={16} />
            </button>

            {/* Login — desktop */}
            <Link to="/auth" className="hidden lg:block">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-4 rounded-full font-medium transition-all duration-300",
                  scrolled
                    ? "text-foreground hover:bg-muted"
                    : "text-white hover:bg-white/10"
                )}
              >
                {loginLabel}
              </Button>
            </Link>

            {/* CTA — desktop */}
            <Link to="/auth" className="hidden lg:block">
              <Button
                size="sm"
                className="h-9 px-5 rounded-full gradient-accent text-accent-foreground font-bold shadow-[0_2px_12px_hsl(172_66%_36%/0.35)] hover:shadow-[0_4px_20px_hsl(172_66%_36%/0.5)] transition-all duration-300"
              >
                {ctaLabel}
              </Button>
            </Link>

            {/* Mobile menu button */}
            <button
              className={cn(
                "lg:hidden flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300",
                scrolled
                  ? "text-foreground hover:bg-muted border border-border/40"
                  : "text-white hover:bg-white/10 border border-white/10"
              )}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════
          Mobile Overlay Menu
         ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 280 : -280 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 280 : -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className={cn(
                "fixed top-0 bottom-0 z-50 w-[280px] sm:w-[320px] bg-background border-border shadow-2xl lg:hidden flex flex-col",
                isRTL ? "inset-inline-end-0 border-s" : "inset-inline-start-0 border-e"
              )}
            >
              {/* Mobile header */}
              <div className="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
                <NumaxioLogo variant="dark" size="sm" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mobile nav links */}
              <div className="flex-1 overflow-y-auto py-4 px-3">
                <div className="space-y-1">
                  {links.map((link) => {
                    const isActive = activeSection === link.href.replace("#", "");
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={(e) => handleNavClick(e, link.href)}
                        className={cn(
                          "flex items-center gap-3 text-sm font-medium min-h-[44px] px-4 rounded-xl transition-all duration-200",
                          isActive
                            ? "text-accent bg-accent/10 font-semibold"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Mobile footer actions */}
              <div className="p-4 border-t border-border space-y-3 shrink-0">
                <button
                  onClick={() => { toggleLanguage(); setMobileOpen(false); }}
                  className="flex items-center gap-3 w-full min-h-[44px] px-4 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors"
                >
                  <Globe size={16} />
                  {currentLang === "ar" ? "English" : "العربية"}
                </button>
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block">
                  <Button variant="outline" className="w-full h-11 rounded-xl">
                    {loginLabel}
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block">
                  <Button className="w-full h-12 rounded-xl gradient-accent text-accent-foreground font-bold shadow-[0_2px_12px_hsl(172_66%_36%/0.35)]">
                    {ctaLabel}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
