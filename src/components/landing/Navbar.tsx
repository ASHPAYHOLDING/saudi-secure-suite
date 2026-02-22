import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

const navLinks = {
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
  const { currentLang, isRTL, toggleLanguage } = useLanguage();

  const links = navLinks[currentLang === "ar" ? "ar" : "en"];

  /* ── Scroll ── */
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
      if (href === "#home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const el = document.getElementById(href.replace("#", ""));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setMobileOpen(false);
    },
    []
  );

  /* ── Body scroll lock ── */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const ctaLabel = currentLang === "ar" ? "ابدأ مجاناً" : "Start Free";
  const loginLabel = currentLang === "ar" ? "تسجيل الدخول" : "Login";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full h-16 transition-colors duration-300",
        scrolled
          ? "bg-background/95 backdrop-blur-lg border-b border-border shadow-sm"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto h-full grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">

        {/* ═══ 1 · Brand (inline-start) ═══ */}
        <Link to="/" className="shrink-0 flex items-center">
          <NumaxioLogo variant={scrolled ? "dark" : "light"} size="sm" />
        </Link>

        {/* ═══ 2 · Center Nav ═══ */}
        <nav className="hidden lg:flex items-center justify-center gap-1 min-w-0">
          {links.map((link) => {
            const isActive = activeSection === link.href.replace("#", "");
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
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

        {/* Empty spacer for mobile when nav is hidden */}
        <div className="lg:hidden" />

        {/* ═══ 3 · Actions (inline-end) ═══ */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Language */}
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

          {/* Login — desktop */}
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

          {/* CTA */}
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
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ═══ Mobile Drawer ═══ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 300 : -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 300 : -300 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={cn(
                "fixed top-0 bottom-0 z-50 w-[min(300px,85vw)] bg-background shadow-2xl lg:hidden flex flex-col",
                isRTL
                  ? "inset-inline-end-0 border-s border-border"
                  : "inset-inline-start-0 border-e border-border"
              )}
              role="dialog"
              aria-modal="true"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between h-16 px-4 border-b border-border shrink-0">
                <NumaxioLogo variant="dark" size="sm" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer links */}
              <div className="flex-1 overflow-y-auto py-2 px-3">
                {links.map((link) => {
                  const isActive = activeSection === link.href.replace("#", "");
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={cn(
                        "flex items-center text-sm font-medium min-h-[44px] px-3 rounded-md transition-colors",
                        isActive
                          ? "text-primary bg-primary/10 font-semibold"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>

              {/* Drawer footer */}
              <div className="p-4 border-t border-border space-y-2 shrink-0">
                <button
                  onClick={() => { toggleLanguage(); setMobileOpen(false); }}
                  className="flex items-center gap-3 w-full min-h-[44px] px-3 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  <Globe size={16} />
                  {currentLang === "ar" ? "English" : "العربية"}
                </button>
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block">
                  <Button variant="outline" className="w-full h-11 rounded-md">
                    {loginLabel}
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block">
                  <Button className="w-full h-11 rounded-md bg-accent text-accent-foreground font-bold">
                    {ctaLabel}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
