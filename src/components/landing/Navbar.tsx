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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      const el = document.getElementById(href.replace("#", ""));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileOpen(false);
    },
    []
  );

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const ctaLabel = currentLang === "ar" ? "ابدأ مجاناً" : "Start Free";
  const loginLabel = currentLang === "ar" ? "تسجيل الدخول" : "Login";

  return (
    <>
      {/* Spacer to prevent content from hiding behind fixed header */}
      <div className="h-16" />

      <header
        className={cn(
          "fixed top-0 inset-inline-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-background/98 backdrop-blur-lg shadow-sm border-b border-border"
            : "bg-[hsl(220,25%,12%)]/95 backdrop-blur-md"
        )}
      >
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* ═══ Brand ═══ */}
          <Link to="/" className="flex items-center shrink-0">
            <NumaxioLogo variant={scrolled ? "dark" : "light"} size="sm" />
          </Link>

          {/* ═══ Desktop Nav (centered) ═══ */}
          <nav className="hidden lg:flex items-center gap-1 absolute inset-inline-start-1/2 -translate-x-1/2 rtl:translate-x-1/2">
            {links.map((link) => {
              const isActive = activeSection === link.href.replace("#", "");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={cn(
                    "relative text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap",
                    scrolled
                      ? isActive
                        ? "text-primary bg-primary/10"
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
          </nav>

          {/* ═══ Actions ═══ */}
          <div className="flex items-center gap-2">
            {/* Language */}
            <button
              onClick={toggleLanguage}
              className={cn(
                "hidden sm:flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                scrolled
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
              aria-label="Switch language"
            >
              <Globe size={16} />
            </button>

            {/* Login */}
            <Link to="/auth" className="hidden lg:block">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 rounded-lg font-medium",
                  scrolled
                    ? "text-foreground hover:bg-muted"
                    : "text-white hover:bg-white/10"
                )}
              >
                {loginLabel}
              </Button>
            </Link>

            {/* CTA */}
            <Link to="/auth" className="hidden sm:block">
              <Button
                size="sm"
                className="h-9 px-5 rounded-lg bg-accent text-accent-foreground font-bold hover:bg-accent/90 shadow-md transition-all"
              >
                {ctaLabel}
              </Button>
            </Link>

            {/* Mobile toggle */}
            <button
              className={cn(
                "lg:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                scrolled
                  ? "text-foreground hover:bg-muted"
                  : "text-white hover:bg-white/10"
              )}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Mobile Menu ═══ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, x: isRTL ? 300 : -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 300 : -300 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className={cn(
                "fixed top-0 bottom-0 z-50 w-[300px] bg-background shadow-2xl lg:hidden flex flex-col",
                isRTL ? "inset-inline-end-0 border-s border-border" : "inset-inline-start-0 border-e border-border"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between h-16 px-5 border-b border-border">
                <NumaxioLogo variant="dark" size="sm" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Links */}
              <div className="flex-1 overflow-y-auto py-3 px-3">
                {links.map((link) => {
                  const isActive = activeSection === link.href.replace("#", "");
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link.href)}
                      className={cn(
                        "flex items-center text-sm font-medium min-h-[44px] px-4 rounded-lg transition-colors mb-0.5",
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

              {/* Footer */}
              <div className="p-4 border-t border-border space-y-2">
                <button
                  onClick={() => { toggleLanguage(); setMobileOpen(false); }}
                  className="flex items-center gap-3 w-full min-h-[44px] px-4 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  <Globe size={16} />
                  {currentLang === "ar" ? "English" : "العربية"}
                </button>
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block">
                  <Button variant="outline" className="w-full h-11 rounded-lg">
                    {loginLabel}
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileOpen(false)} className="block">
                  <Button className="w-full h-11 rounded-lg bg-accent text-accent-foreground font-bold">
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
