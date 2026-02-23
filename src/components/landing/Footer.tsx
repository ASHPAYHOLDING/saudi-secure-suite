import { useState, memo } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, ArrowUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import BrandLockup from "@/components/landing/BrandLockup";
import { useTranslation } from "react-i18next";
import ComplianceTrustSection from "@/components/landing/ComplianceTrustSection";

/* ── Reusable column component ── */
const FooterColumn = ({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; isRoute?: boolean }[];
}) => (
  <div>
    <h4 className="text-sm font-bold mb-4" style={{ color: "hsl(0 0% 96%)" }}>
      {title}
    </h4>
    <ul className="space-y-2.5">
      {links.map((item) => (
        <li key={item.label}>
          {item.isRoute ? (
            <Link
              to={item.href}
              className="text-sm transition-colors"
              style={{ color: "hsl(210 15% 72%)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(168 76% 52%)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(210 15% 72%)")}
            >
              {item.label}
            </Link>
          ) : (
            <a
              href={item.href}
              className="text-sm transition-colors"
              style={{ color: "hsl(210 15% 72%)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(168 76% 52%)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(210 15% 72%)")}
            >
              {item.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  </div>
);

const Footer = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRTL = i18n.language?.startsWith("ar");

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    toast({
      title: isRTL ? "تم الاشتراك بنجاح!" : "Subscribed!",
      description: isRTL ? "ستصلك آخر التحديثات على بريدك." : "You'll receive the latest updates.",
    });
    setEmail("");
    setSubmitting(false);
  };

  /* ── Column data ── */
  const productLinks = [
    { label: t("landing.modules.invoices"), href: "#features" },
    { label: t("landing.modules.expenses"), href: "#features" },
    { label: t("landing.modules.inventory"), href: "#features" },
    { label: t("landing.modules.reports"), href: "#features" },
    { label: t("landing.modules.ai"), href: "#features" },
  ];

  const solutionLinks = [
    { label: t("landing.footer.solutionInvoicing"), href: "#features" },
    { label: t("landing.footer.solutionAccounting"), href: "#features" },
    { label: t("landing.footer.solutionPayroll"), href: "#features" },
    { label: t("landing.footer.solutionInventory"), href: "#features" },
  ];

  const companyLinks = [
    { label: t("landing.footer.privacy"), href: "/privacy", isRoute: true },
    { label: t("landing.footer.terms"), href: "/terms", isRoute: true },
    { label: t("landing.footer.complianceData"), href: "#compliance" },
  ];

  const supportLinks = [
    { label: t("landing.footer.helpCenter"), href: "#" },
    { label: t("landing.footer.faq"), href: "#" },
    { label: t("landing.footer.contactUs"), href: "#contact" },
    { label: t("landing.footer.docs"), href: "#" },
  ];

  return (
    <footer
      id="contact"
      className="border-t"
      style={{ background: "hsl(220 30% 8%)", borderColor: "hsl(220 20% 15%)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        {/* ── Top: Brand + 4 Columns ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-6">
          {/* Brand column — spans 2 on lg */}
          <div className="col-span-2">
            <div className="mb-4">
              <BrandLockup variant="light" />
            </div>
            <p className="text-sm leading-relaxed mb-5 max-w-xs" style={{ color: "hsl(210 15% 75%)" }}>
              {t("landing.footer.about")}
            </p>

            {/* Contact info */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2.5 text-sm" style={{ color: "hsl(210 15% 75%)" }}>
                <MapPin size={14} className="text-accent shrink-0" />
                <span>{isRTL ? "المملكة العربية السعودية" : "Saudi Arabia"}</span>
              </div>
              <a
                href="mailto:support@numaxio.com"
                className="flex items-center gap-2.5 text-sm transition-colors"
                style={{ color: "hsl(210 15% 75%)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(168 76% 52%)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(210 15% 75%)")}
              >
                <Mail size={14} className="text-accent shrink-0" />
                <span className="font-english" dir="ltr">support@numaxio.com</span>
              </a>
            </div>

            {/* Newsletter */}
            <form onSubmit={handleSubscribe} className="flex gap-2 max-w-xs">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRTL ? "بريدك الإلكتروني" : "Your email"}
                required
                dir="ltr"
                className="flex-1 min-w-0 rounded-lg border bg-white/[0.04] px-3 py-2.5 text-sm placeholder:text-white/30 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors min-h-[44px]"
                style={{ color: "hsl(0 0% 92%)", borderColor: "hsl(220 20% 20%)" }}
              />
              <Button
                type="submit"
                disabled={submitting}
                size="sm"
                className="shrink-0 h-[44px] px-3 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
              >
                <Send size={14} />
              </Button>
            </form>
          </div>

          {/* 4 link columns */}
          <FooterColumn title={t("landing.footer.product")} links={productLinks} />
          <FooterColumn title={t("landing.footer.solutions")} links={solutionLinks} />
          <FooterColumn title={t("landing.footer.company")} links={companyLinks} />
          <FooterColumn title={t("landing.footer.support")} links={supportLinks} />
        </div>

        {/* ── Integrations strip ── */}
        <ComplianceTrustSection />

        {/* ── Bottom bar ── */}
        <div
          className="mt-8 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row"
          style={{ borderColor: "hsl(220 20% 16%)" }}
        >
          <p className="text-xs" style={{ color: "hsl(210 15% 60%)" }}>
            © {new Date().getFullYear()} {t("landing.footer.copyright")}
          </p>

          <div className="flex items-center gap-3">
            <Link
              to="/privacy"
              className="text-xs transition-colors"
              style={{ color: "hsl(210 15% 60%)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(168 76% 52%)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(210 15% 60%)")}
            >
              {t("landing.footer.privacy")}
            </Link>
            <span style={{ color: "hsl(220 20% 25%)" }}>·</span>
            <Link
              to="/terms"
              className="text-xs transition-colors"
              style={{ color: "hsl(210 15% 60%)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(168 76% 52%)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(210 15% 60%)")}
            >
              {t("landing.footer.terms")}
            </Link>
            <button
              onClick={scrollToTop}
              className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:text-accent hover:border-accent/30"
              style={{ borderColor: "hsl(220 20% 22%)", color: "hsl(210 15% 60%)" }}
              aria-label={t("landing.footer.backToTop")}
            >
              <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default memo(Footer);
