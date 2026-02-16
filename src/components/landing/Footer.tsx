import { Link } from "react-router-dom";
import numaxioLogo from "@/assets/numaxio-logo.png";

const Footer = () => {
  return (
    <footer id="contact" className="border-t border-border bg-primary py-16" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <img src={numaxioLogo} alt="نيوماكسيو" className="h-8" />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/60">
              نيوماكسيو — منصة سحابية سعودية متعددة المستأجرين. مصممة لإدارة أعمالك بأمان وكفاءة عالية.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-primary-foreground">المنتج</h4>
            <ul className="space-y-3">
              {["المميزات", "الأسعار", "التوثيق", "الأمان"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-primary-foreground/50 transition-colors hover:text-accent">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold text-primary-foreground">الشركة</h4>
            <ul className="space-y-3">
              {["عن المنصة", "المدونة", "وظائف", "تواصل معنا"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-primary-foreground/50 transition-colors hover:text-accent">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-8 md:flex-row">
          <p className="text-xs text-primary-foreground/40">
            © 2026 نيوماكسيو. جميع الحقوق محفوظة.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-primary-foreground/40 hover:text-accent">سياسة الخصوصية</a>
            <a href="#" className="text-xs text-primary-foreground/40 hover:text-accent">الشروط والأحكام</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
