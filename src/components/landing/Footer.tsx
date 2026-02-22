import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, ArrowUp, Shield, ExternalLink } from "lucide-react";
import NumaxioLogo from "@/components/landing/NumaxioLogo";

const productLinks = [
  { label: "الفواتير والضرائب", href: "#features" },
  { label: "الذكاء المحاسبي", href: "#features" },
  { label: "الحوكمة المؤسسية", href: "#features" },
  { label: "التقارير التنفيذية", href: "#features" },
  { label: "المخزون", href: "#features" },
  { label: "المصروفات", href: "#features" },
];

const resourceLinks = [
  { label: "مركز المساعدة", href: "#" },
  { label: "الأسئلة الشائعة", href: "#" },
  { label: "سياسة الخصوصية", href: "/privacy" },
  { label: "الشروط والأحكام", href: "/terms" },
  { label: "الامتثال والبيانات", href: "#" },
];

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer id="contact" className="bg-sidebar-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-8">
        {/* Main 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Column 1 – About */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-5">
              <NumaxioLogo variant="light" size="md" />
            </div>
            <p className="text-sm leading-relaxed text-sidebar-foreground/80 mb-6">
              نظام ERP سعودي مؤسسي متكامل لإدارة المالية، الامتثال، والحوكمة.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-sidebar-foreground/70 min-h-[44px]">
                <MapPin size={14} className="text-accent shrink-0" />
                <span>المملكة العربية السعودية</span>
              </div>
              <a href="mailto:support@numaxio.com" className="flex items-center gap-3 text-sm text-sidebar-foreground/70 hover:text-accent transition-colors min-h-[44px]">
                <Mail size={14} className="text-accent shrink-0" />
                <span>support@numaxio.com</span>
              </a>
              <a href="tel:9200XXXX" className="flex items-center gap-3 text-sm text-sidebar-foreground/70 hover:text-accent transition-colors min-h-[44px]">
                <Phone size={14} className="text-accent shrink-0" />
                <span dir="ltr">9200XXXX</span>
              </a>
            </div>
          </div>

          {/* Column 2 – Product */}
          <div>
            <h4 className="mb-5 text-sm font-bold text-sidebar-foreground">المنتج</h4>
            <ul className="space-y-3">
              {productLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm text-sidebar-foreground/70 hover:text-accent transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 – Resources */}
          <div>
            <h4 className="mb-5 text-sm font-bold text-sidebar-foreground">الموارد</h4>
            <ul className="space-y-3">
              {resourceLinks.map((item) => (
                <li key={item.label}>
                  {item.href.startsWith("/") ? (
                    <Link to={item.href} className="text-sm text-sidebar-foreground/70 hover:text-accent transition-colors">
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className="text-sm text-sidebar-foreground/70 hover:text-accent transition-colors">
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 – CTA */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-sidebar-foreground">ابدأ إدارة مالية احترافية اليوم</h4>
            <p className="text-sm text-sidebar-foreground/70 mb-5 leading-relaxed">
              14 يوم تجربة مجانية — بدون بطاقة بنكية
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 gradient-accent text-accent-foreground px-6 py-3 rounded-xl font-semibold text-sm shadow-accent-glow hover:opacity-90 transition-all min-h-[48px]"
            >
              ابدأ الآن مجاناً
              <ExternalLink size={16} />
            </Link>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-2">
              {["ZATCA معتمد", "SSL مشفر", "ISO 27001"].map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-[11px] font-medium text-accent"
                >
                  <Shield size={10} />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Divider + Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-sidebar-foreground/10 pt-6 md:flex-row">
          <p className="text-xs text-sidebar-foreground/70">
            © {new Date().getFullYear()} نيوماكسيو. جميع الحقوق محفوظة. صنع بـ ❤️ في السعودية
          </p>

          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-xs text-sidebar-foreground/70 hover:text-accent transition-colors">سياسة الخصوصية</Link>
            <Link to="/terms" className="text-xs text-sidebar-foreground/70 hover:text-accent transition-colors">الشروط والأحكام</Link>
            <button
              onClick={scrollToTop}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-sidebar-foreground/15 text-sidebar-foreground/70 hover:text-accent hover:border-accent/30 transition-colors"
              aria-label="العودة للأعلى"
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
