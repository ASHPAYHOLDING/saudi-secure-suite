import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Menu, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      const id = href.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setMobileOpen(false);
    },
    []
  );

  const ctaLabel = currentLang === "ar" ? "ابدأ مجاناً" : "Start Free";
  const loginLabel = currentLang === "ar" ? "تسجيل الدخول" : "Login";
  const menuLabel = currentLang === "ar" ? "القائمة" : "Menu";

  return (
    <header className="fixed top-0 inset-inline-0 z-50 h-16">
      {/* Background layer — always visible */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          scrolled
            ? "bg-background shadow-md border-b border-border"
            : "bg-black/30 backdrop-blur-md"
        }`}
      />

      {/* Content */}
      <div className="relative max-w-6xl mx-auto grid h-16 items-center px-4 sm:px-6 lg:px-8 grid-cols-[auto_1fr_auto]">
        {/* Zone 1: Brand */}
        <Link to="/" className="flex items-center shrink-0">
          <NumaxioLogo variant={scrolled ? "dark" : "light"} size="sm" />
        </Link>

        {/* Zone 2: Centered nav (desktop) */}
        <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 min-w-0">
          {links.map((link) => {
            const isActive = activeSection === link.href.replace("#", "");
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`relative text-sm font-medium transition-colors whitespace-nowrap px-3 min-h-[44px] flex items-center ${
                  scrolled
                    ? isActive
                      ? "text-accent"
                      : "text-muted-foreground hover:text-foreground"
                    : isActive
                      ? "text-white"
                      : "text-white/70 hover:text-white"
                }`}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute bottom-1 inset-inline-0 mx-3 h-0.5 bg-accent rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center justify-end gap-2">
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
                scrolled
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              aria-label="Switch language"
            >
              <Globe size={18} />
            </button>
            <Link to="/auth">
              <Button
                variant="ghost"
                size="sm"
                className={`min-h-[44px] ${
                  scrolled
                    ? "text-foreground hover:bg-muted"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {loginLabel}
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="sm"
                className="min-h-[44px] gradient-accent text-accent-foreground shadow-accent-glow rounded-xl px-6 font-bold"
              >
                {ctaLabel}
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors ${
              scrolled ? "text-foreground" : "text-white"
            }`}
            onClick={() => setMobileOpen(true)}
            aria-label={menuLabel}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={isRTL ? "right" : "left"}
          className="w-[280px] sm:w-[320px] bg-background border-border p-0"
        >
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-4 border-b border-border">
            <SheetTitle className="text-base font-bold text-foreground">
              Numaxio
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1 px-4 py-4">
            {links.map((link) => {
              const isActive = activeSection === link.href.replace("#", "");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`text-sm font-medium py-3 min-h-[44px] flex items-center rounded-lg px-3 transition-colors ${
                    isActive
                      ? "text-accent bg-accent/10"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 px-4 py-4 border-t border-border mt-auto">
            <button
              onClick={() => {
                toggleLanguage();
                setMobileOpen(false);
              }}
              className="min-h-[44px] flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 rounded-lg hover:bg-muted transition-colors"
            >
              <Globe size={16} />
              {currentLang === "ar" ? "English" : "العربية"}
            </button>
            <Link to="/auth" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" className="w-full min-h-[44px]">
                {loginLabel}
              </Button>
            </Link>
            <Link to="/auth" onClick={() => setMobileOpen(false)}>
              <Button className="w-full gradient-accent text-accent-foreground min-h-[48px] rounded-xl font-bold">
                {ctaLabel}
              </Button>
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default Navbar;
