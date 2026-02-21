import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, ArrowUp, Shield, FileText, Scale, ExternalLink } from "lucide-react";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { useState } from "react";

const footerLinks = {
  product: [
    { label: "الفواتير الإلكترونية", href: "#features" },
    { label: "إدارة العقود", href: "#features" },
    { label: "إدارة العملاء", href: "#features" },
    { label: "التقارير المالية", href: "#features" },
    { label: "الختم الإلكتروني", href: "#features" },
    { label: "سجل المراجعة", href: "#features" },
  ],
  company: [
    { label: "لماذا نيوماكسيو", href: "#why" },
    { label: "الأسعار", href: "#pricing" },
    { label: "آراء العملاء", href: "#testimonials" },
    { label: "تواصل معنا", href: "#contact" },
  ],
  legal: [
    { label: "سياسة الخصوصية", href: "/privacy", icon: Shield },
    { label: "الشروط والأحكام", href: "/terms", icon: FileText },
    { label: "اتفاقية مستوى الخدمة", href: "/sla", icon: Scale },
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Footer = () => {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer id="contact" className="relative overflow-hidden bg-sidebar-background" dir="rtl">
      {/* Decorative top wave */}
      <div className="absolute top-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" className="w-full h-auto" preserveAspectRatio="none">
          <path
            fill="hsl(var(--background))"
            d="M0,0 L1440,0 L1440,30 C1200,60 960,10 720,40 C480,70 240,20 0,50 Z"
          />
        </svg>
      </div>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-1/4 w-[300px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(172 66% 36% / 0.06) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 left-1/3 w-[250px] h-[250px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(205 80% 50% / 0.05) 0%, transparent 70%)" }}
        />
      </div>

      <div className="container relative mx-auto px-4 pt-24 pb-8">
        {/* Newsletter / CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 rounded-2xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 backdrop-blur-sm p-8 md:p-12"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl md:text-2xl font-bold text-sidebar-foreground mb-2">
                ابدأ رحلتك مع نيوماكسيو اليوم
              </h3>
              <p className="text-sidebar-foreground/60 text-sm">
                انضم لأكثر من 1,200 شركة سعودية تثق بنا في إدارة أعمالها المحاسبية
              </p>
            </div>
            <Link
              to="/auth"
              className="shrink-0 inline-flex items-center gap-2 gradient-accent text-accent-foreground px-8 py-3.5 rounded-xl font-semibold text-sm shadow-accent-glow hover:opacity-90 transition-all duration-300 hover:scale-105"
            >
              ابدأ مجاناً — 14 يوم
              <ExternalLink size={16} />
            </Link>
          </div>
        </motion.div>

        {/* Main footer grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-12 md:grid-cols-12"
        >
          {/* Brand column */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <div className="mb-5">
              <NumaxioLogo variant="light" size="md" />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-sidebar-foreground/50 mb-8">
              المنصة المحاسبية السحابية الأولى المصممة للمنشآت السعودية.
              فواتير إلكترونية، عقود، تقارير مالية، وامتثال كامل مع هيئة الزكاة والدخل.
            </p>

            <div className="space-y-4">
              {[
                { icon: Mail, text: "info@numaxio.com", href: "mailto:info@numaxio.com" },
                { icon: Phone, text: "+966 50 000 0000", href: "tel:+966500000000", dir: "ltr" as const },
                { icon: MapPin, text: "الرياض، المملكة العربية السعودية", href: undefined },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: -4 }}
                  className="group"
                >
                  {item.href ? (
                    <a
                      href={item.href}
                      className="flex items-center gap-3 text-sm text-sidebar-foreground/40 hover:text-accent transition-colors duration-300"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-foreground/5 group-hover:bg-accent/10 transition-colors duration-300">
                        <item.icon size={14} className="group-hover:text-accent transition-colors" />
                      </span>
                      <span dir={item.dir}>{item.text}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-sidebar-foreground/40">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-foreground/5">
                        <item.icon size={14} />
                      </span>
                      {item.text}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Product links */}
          <motion.div variants={itemVariants} className="md:col-span-2">
            <h4 className="mb-6 text-sm font-bold text-sidebar-foreground tracking-wide">المنتج</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onMouseEnter={() => setHoveredLink(item.label)}
                    onMouseLeave={() => setHoveredLink(null)}
                    className="relative text-sm text-sidebar-foreground/40 transition-colors duration-300 hover:text-accent inline-block"
                  >
                    <span className="relative">
                      {item.label}
                      <motion.span
                        className="absolute -bottom-0.5 right-0 h-px bg-accent"
                        initial={{ width: "0%" }}
                        animate={{ width: hoveredLink === item.label ? "100%" : "0%" }}
                        transition={{ duration: 0.3 }}
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Company links */}
          <motion.div variants={itemVariants} className="md:col-span-2">
            <h4 className="mb-6 text-sm font-bold text-sidebar-foreground tracking-wide">الشركة</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onMouseEnter={() => setHoveredLink(item.label)}
                    onMouseLeave={() => setHoveredLink(null)}
                    className="relative text-sm text-sidebar-foreground/40 transition-colors duration-300 hover:text-accent inline-block"
                  >
                    <span className="relative">
                      {item.label}
                      <motion.span
                        className="absolute -bottom-0.5 right-0 h-px bg-accent"
                        initial={{ width: "0%" }}
                        animate={{ width: hoveredLink === item.label ? "100%" : "0%" }}
                        transition={{ duration: 0.3 }}
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal links */}
          <motion.div variants={itemVariants} className="md:col-span-4">
            <h4 className="mb-6 text-sm font-bold text-sidebar-foreground tracking-wide">القانونية والامتثال</h4>
            <div className="grid grid-cols-1 gap-3">
              {footerLinks.legal.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-sidebar-foreground/5 bg-sidebar-foreground/[0.02] p-3 transition-all duration-300 hover:border-accent/20 hover:bg-accent/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-foreground/5 group-hover:bg-accent/10 transition-colors duration-300">
                    <item.icon size={16} className="text-sidebar-foreground/40 group-hover:text-accent transition-colors" />
                  </span>
                  <span className="text-sm text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80 transition-colors">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap gap-3">
              {["ZATCA معتمد", "SSL مشفر", "ISO 27001"].map((badge) => (
                <motion.span
                  key={badge}
                  whileHover={{ scale: 1.05 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-[11px] font-medium text-accent"
                >
                  <Shield size={10} />
                  {badge}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-sidebar-foreground/5 pt-8 md:flex-row"
        >
          <p className="text-xs text-sidebar-foreground/30">
            © {new Date().getFullYear()} نيوماكسيو. جميع الحقوق محفوظة. صنع بـ ❤️ في السعودية
          </p>

          <div className="flex items-center gap-6">
            <div className="flex gap-6">
              {footerLinks.legal.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="text-xs text-sidebar-foreground/30 hover:text-accent transition-colors duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Scroll to top */}
            <motion.button
              whileHover={{ y: -3, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToTop}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-sidebar-foreground/10 bg-sidebar-foreground/5 text-sidebar-foreground/40 hover:text-accent hover:border-accent/30 transition-all duration-300"
              aria-label="العودة للأعلى"
            >
              <ArrowUp size={16} />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;