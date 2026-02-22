import { useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Focus first link on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => firstLinkRef.current?.focus());
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  return (
    <div className={cn("lg:hidden", !open && "pointer-events-none")}>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-250",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — always slides from right */}
      <div
        ref={drawerRef}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الرئيسية"
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 flex flex-col",
          "w-[min(360px,90vw)] bg-background border-s border-border shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{ left: "auto" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
          {/* Brand — right side (RTL start) */}
          <span
            className="text-xl font-semibold tracking-[0.05em] leading-none select-none shrink-0 text-foreground"
            aria-label="Numaxio"
          >
            NUMA<span className="text-[#2EC4B6]">XIO</span>
          </span>

          {/* Close — left side (RTL end) */}
          <button
            onClick={onClose}
            className="w-11 h-11 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Nav links ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-4">
          {links.map((link, i) => {
            const isActive = activeSection === link.href.replace("#", "");
            return (
              <a
                key={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                onClick={(e) => onNavClick(e, link.href)}
                className={cn(
                  "flex items-center text-sm font-medium min-h-[48px] px-4 rounded-lg transition-colors text-right",
                  isActive
                    ? "text-primary bg-primary/10 font-semibold"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="p-5 border-t border-border space-y-3 shrink-0">
          {/* Language toggle */}
          <button
            onClick={() => {
              onToggleLanguage();
              onClose();
            }}
            className="flex items-center gap-3 w-full min-h-[48px] px-4 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <Globe size={16} />
            {currentLang === "ar" ? "English" : "العربية"}
          </button>

          {/* Login */}
          <Link to="/auth" onClick={onClose} className="block">
            <Button variant="outline" className="w-full h-12 rounded-lg text-sm font-medium">
              {loginLabel}
            </Button>
          </Link>

          {/* CTA */}
          <Link to="/auth" onClick={onClose} className="block">
            <Button className="w-full h-12 rounded-lg bg-accent text-accent-foreground font-bold text-sm">
              {ctaLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MobileDrawer;
