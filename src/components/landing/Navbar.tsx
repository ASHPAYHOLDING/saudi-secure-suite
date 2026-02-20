import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { RamadanBadge } from "@/components/ramadan";
import { useTheme } from "@/theme/ThemeProvider";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { seasonalTheme } = useTheme();
  const isRamadan = seasonalTheme === "ramadan";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { label: "المميزات", href: "#features" },
    { label: "لماذا نيوماكسيو", href: "#why" },
    { label: "الأسعار", href: "#pricing" },
    { label: "آراء العملاء", href: "#testimonials" },
    { label: "تواصل معنا", href: "#contact" },
  ];

  return (
    <nav
      dir="rtl"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-border/50 bg-background/90 backdrop-blur-xl shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex h-18 items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2.5"
          >
            <NumaxioLogo variant={scrolled ? "dark" : "light"} size="sm" />
            {/* Ramadan badge بجوار اللوجو في الـ Navbar */}
            {scrolled ? (
              <RamadanBadge size="sm" text="رمضان كريم 🌙" />
            ) : (
              isRamadan && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    borderColor: "hsl(var(--ramadan-gold)/0.4)",
                    background: "hsl(var(--ramadan-gold)/0.1)",
                    color: "hsl(var(--ramadan-gold))",
                  }}
                >
                  🌙 رمضان كريم
                </span>
              )
            )}
          </motion.div>
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`text-sm font-medium transition-colors hover:text-accent ${
                scrolled ? "text-muted-foreground" : "text-primary-foreground/80 hover:text-primary-foreground"
              }`}
            >
              {link.label}
            </motion.a>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden items-center gap-3 lg:flex"
        >
          <Link to="/auth">
            <Button
              variant="ghost"
              size="sm"
              className={scrolled ? "text-foreground" : "text-primary-foreground hover:bg-primary-foreground/10"}
            >
              تسجيل الدخول
            </Button>
          </Link>
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              {isRamadan ? (
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--ramadan-emerald)) 0%, hsl(160 70% 30%) 100%)",
                    boxShadow: "0 0 0 1px hsl(var(--ramadan-gold)/0.3), 0 4px 16px -4px hsl(var(--ramadan-emerald)/0.5)",
                  }}
                >
                  ابدأ مجاناً
                </button>
              ) : (
                <Button size="sm" className="gradient-accent text-accent-foreground shadow-accent-glow transition-shadow duration-300 hover:shadow-[0_6px_24px_-4px_hsl(172_66%_36%/0.5)]">
                  ابدأ مجاناً
                </Button>
              )}
            </motion.div>
          </Link>
        </motion.div>

        <button
          className={`lg:hidden ${scrolled ? "text-foreground" : "text-primary-foreground"}`}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border bg-background lg:hidden"
          >
            <div className="container mx-auto flex flex-col gap-4 px-4 py-6">
              {/* Ramadan badge في المحمول */}
              {isRamadan && (
                <div className="flex justify-center pb-2">
                  <RamadanBadge text="🌙 رمضان كريم — عروض حصرية" size="sm" />
                </div>
              )}
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-foreground py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link to="/auth" onClick={() => setMobileOpen(false)}>
                {isRamadan ? (
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--ramadan-emerald)) 0%, hsl(160 70% 30%) 100%)",
                      boxShadow: "0 0 0 1px hsl(var(--ramadan-gold)/0.25)",
                    }}
                  >
                    ابدأ مجاناً
                  </button>
                ) : (
                  <Button className="w-full gradient-accent text-accent-foreground">
                    ابدأ مجاناً
                  </Button>
                )}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
