import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin } from "lucide-react";
import numaxioLogo from "@/assets/numaxio-logo.png";

const Footer = () => {
  return (
    <footer id="contact" className="border-t border-border bg-primary py-20" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <img src={numaxioLogo} alt="نيوماكسيو" className="h-9 mb-5 brightness-200" />
              <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/60 mb-6">
                نيوماكسيو — المنصة المحاسبية السحابية الأولى المصممة للمنشآت السعودية. 
                فواتير إلكترونية، عقود، تقارير مالية، وامتثال كامل مع ZATCA.
              </p>
              <div className="space-y-3">
                <a href="mailto:info@numaxio.com" className="flex items-center gap-3 text-sm text-primary-foreground/50 hover:text-accent transition-colors">
                  <Mail size={16} />
                  info@numaxio.com
                </a>
                <a href="tel:+966500000000" className="flex items-center gap-3 text-sm text-primary-foreground/50 hover:text-accent transition-colors">
                  <Phone size={16} />
                  <span dir="ltr">+966 50 000 0000</span>
                </a>
                <div className="flex items-center gap-3 text-sm text-primary-foreground/50">
                  <MapPin size={16} />
                  الرياض، المملكة العربية السعودية
                </div>
              </div>
            </motion.div>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-5 text-sm font-semibold text-primary-foreground">المنتج</h4>
            <ul className="space-y-3">
              {["الفواتير الإلكترونية", "إدارة العقود", "إدارة العملاء", "التقارير المالية", "الختم الإلكتروني", "سجل المراجعة"].map((item) => (
                <li key={item}>
                  <a href="#features" className="text-sm text-primary-foreground/50 transition-colors hover:text-accent">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-5 text-sm font-semibold text-primary-foreground">الشركة</h4>
            <ul className="space-y-3">
              {["عن نيوماكسيو", "الأسعار", "المدونة", "الدعم الفني", "سياسة الخصوصية", "الشروط والأحكام"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-primary-foreground/50 transition-colors hover:text-accent">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 md:flex-row">
          <p className="text-xs text-primary-foreground/40">
            © 2026 نيوماكسيو. جميع الحقوق محفوظة. صنع بـ ❤️ في السعودية
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-primary-foreground/40 hover:text-accent transition-colors">سياسة الخصوصية</a>
            <a href="#" className="text-xs text-primary-foreground/40 hover:text-accent transition-colors">الشروط والأحكام</a>
            <a href="#" className="text-xs text-primary-foreground/40 hover:text-accent transition-colors">اتفاقية مستوى الخدمة</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
