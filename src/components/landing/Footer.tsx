import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, ArrowUp, Shield, ExternalLink, Bell, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import BrandLockup from "@/components/landing/BrandLockup";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    // Simulate subscription
    await new Promise((r) => setTimeout(r, 600));
    toast({ title: "تم الاشتراك بنجاح!", description: "ستصلك آخر التحديثات والأخبار على بريدك." });
    setEmail("");
    setSubmitting(false);
  };

  const productLinks = [
    { label: t("landing.modules.invoices"), href: "#features" },
    { label: t("landing.modules.expenses"), href: "#features" },
    { label: t("landing.modules.inventory"), href: "#features" },
    { label: t("landing.modules.orders"), href: "#features" },
    { label: t("landing.modules.reports"), href: "#features" },
    { label: t("landing.modules.ai"), href: "#features" },
  ];

  const complianceLinks = [
    { label: "ZATCA Phase 1", href: "#compliance" },
    { label: "ZATCA Phase 2", href: "#compliance" },
    { label: t("landing.compliance.vatTitle"), href: "#compliance" },
    { label: t("landing.modules.governance"), href: "#features" },
  ];

  const resourceLinks = [
    { label: t("landing.footer.helpCenter"), href: "#" },
    { label: t("landing.footer.faq"), href: "#" },
    { label: t("landing.footer.complianceData"), href: "#" },
  ];

  const companyLinks = [
    { label: t("landing.footer.privacy"), href: "/privacy", isRoute: true },
    { label: t("landing.footer.terms"), href: "/terms", isRoute: true },
  ];

  return (
    <footer id="contact" className="border-t border-sidebar-foreground/10" style={{ background: "hsl(220 30% 10%)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Column 1 – Brand & About (wider) */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="mb-5">
              <BrandLockup variant="light" />
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "hsl(210 20% 85%)" }}>
              {t("landing.footer.about")}
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm min-h-[44px]" style={{ color: "hsl(210 20% 85%)" }}>
                <MapPin size={14} className="text-accent shrink-0" />
                <span>المملكة العربية السعودية</span>
              </div>
              <a
                href="mailto:support@numaxio.com"
                className="flex items-center gap-3 text-sm hover:text-accent transition-colors min-h-[44px]"
                style={{ color: "hsl(210 20% 85%)" }}
              >
                <Mail size={14} className="text-accent shrink-0" />
                <span className="font-english" dir="ltr">support@numaxio.com</span>
              </a>
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-2">
              {["ZATCA", "SSL", "ISO 27001"].map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/8 px-3 py-1.5 text-[11px] font-semibold text-accent"
                >
                  <Shield size={10} />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Column 2 – Product */}
          <div>
            <h4 className="mb-5 text-sm font-bold" style={{ color: "hsl(210 20% 95%)" }}>
              {t("landing.footer.product")}
            </h4>
            <ul className="space-y-3">
              {productLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm hover:text-accent transition-colors"
                    style={{ color: "hsl(210 20% 80%)" }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 – Compliance */}
          <div>
            <h4 className="mb-5 text-sm font-bold" style={{ color: "hsl(210 20% 95%)" }}>
              {t("landing.footer.compliance")}
            </h4>
            <ul className="space-y-3">
              {complianceLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm hover:text-accent transition-colors"
                    style={{ color: "hsl(210 20% 80%)" }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Resources sub-section */}
            <h4 className="mt-8 mb-4 text-sm font-bold" style={{ color: "hsl(210 20% 95%)" }}>
              {t("landing.footer.resources")}
            </h4>
            <ul className="space-y-3">
              {resourceLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm hover:text-accent transition-colors"
                    style={{ color: "hsl(210 20% 80%)" }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/updates"
                  className="text-sm hover:text-accent transition-colors"
                  style={{ color: "hsl(210 20% 80%)" }}
                >
                  التحديثات
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 – Company + CTA */}
          <div>
            <h4 className="mb-5 text-sm font-bold" style={{ color: "hsl(210 20% 95%)" }}>
              {t("landing.footer.company")}
            </h4>
            <ul className="space-y-3 mb-8">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  {item.isRoute ? (
                    <Link
                      to={item.href}
                      className="text-sm hover:text-accent transition-colors"
                      style={{ color: "hsl(210 20% 80%)" }}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      className="text-sm hover:text-accent transition-colors"
                      style={{ color: "hsl(210 20% 80%)" }}
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="rounded-xl border border-accent/20 bg-accent/[0.06] p-4">
              <p className="text-xs font-semibold mb-1" style={{ color: "hsl(210 20% 90%)" }}>
                {t("landing.footer.startToday")}
              </p>
              <p className="text-[11px] mb-4" style={{ color: "hsl(210 20% 78%)" }}>
                {t("landing.footer.freeTrialNote")}
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 gradient-accent text-accent-foreground px-5 py-2.5 rounded-lg font-semibold text-sm shadow-accent-glow hover:opacity-90 transition-all min-h-[44px] w-full justify-center"
              >
                {t("landing.footer.startFree")}
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          {/* Column 5 – التحديثات */}
          <div>
            <h4 className="mb-5 text-sm font-bold flex items-center gap-2" style={{ color: "hsl(210 20% 95%)" }}>
              <Bell size={14} className="text-accent" />
              التحديثات
            </h4>
            <p className="text-[11px] leading-relaxed mb-4" style={{ color: "hsl(210 20% 78%)" }}>
              اشترك ليصلك كل جديد عن المنصة والتحديثات والمميزات الجديدة.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="بريدك الإلكتروني"
                required
                dir="ltr"
                className="w-full rounded-lg border border-accent/20 bg-accent/[0.04] px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors min-h-[44px]"
                style={{ color: "hsl(210 20% 90%)" }}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="w-full gradient-accent text-accent-foreground text-sm font-semibold shadow-accent-glow hover:opacity-90 transition-all min-h-[44px] gap-2"
              >
                {submitting ? "جارٍ الاشتراك..." : "اشترك الآن"}
                <Send size={14} />
              </Button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 md:flex-row" style={{ borderColor: "hsl(220 20% 20%)" }}>
          <p className="text-xs" style={{ color: "hsl(210 20% 72%)" }}>
            © {new Date().getFullYear()} {t("landing.footer.copyright")}
          </p>

          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="text-xs hover:text-accent transition-colors"
              style={{ color: "hsl(210 20% 78%)" }}
            >
              {t("landing.footer.privacy")}
            </Link>
            <Link
              to="/terms"
              className="text-xs hover:text-accent transition-colors"
              style={{ color: "hsl(210 20% 78%)" }}
            >
              {t("landing.footer.terms")}
            </Link>
            <button
              onClick={scrollToTop}
              className="flex h-10 w-10 items-center justify-center rounded-full border hover:text-accent hover:border-accent/30 transition-colors"
              style={{ borderColor: "hsl(220 20% 22%)", color: "hsl(210 20% 80%)" }}
              aria-label={t("landing.footer.backToTop")}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
