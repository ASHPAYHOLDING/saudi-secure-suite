import { ArrowLeft, Sparkles, Shield, Zap, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RamadanGlow, RamadanPattern, RamadanBadge } from "@/components/ramadan";
import { useTheme } from "@/theme/ThemeProvider";

const CTASection = () => {
  const { seasonalTheme } = useTheme();
  const isRamadan = seasonalTheme === "ramadan";

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative rounded-3xl gradient-hero overflow-hidden">
          <RamadanPattern opacity={0.05} />
          <RamadanGlow variant="hero" />

          <div className="relative p-8 md:p-16 lg:p-20 text-center">
            {isRamadan && (
              <div className="flex justify-center mb-4">
                <RamadanBadge text="عروض رمضان الحصرية 🌙" size="md" />
              </div>
            )}

            <div className={`mb-6 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 ${
              isRamadan
                ? "border-[hsl(var(--ramadan-gold)/0.3)] bg-[hsl(var(--ramadan-gold)/0.1)]"
                : "border-accent/30 bg-accent/10"
            }`}>
              <Sparkles size={14} className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"} />
              <span className={`text-sm font-medium ${isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"}`}>
                {isRamadan ? "اشترك الآن واستفد من عروض رمضان" : "ابدأ اليوم — بدون بطاقة ائتمان"}
              </span>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6 leading-tight text-center">
              جاهز لتحويل محاسبة منشأتك
              <br />
              <span className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-gradient"}>
                إلى تجربة رقمية متكاملة؟
              </span>
            </h2>

            <p className="text-lg text-primary-foreground/60 mb-8 max-w-2xl mx-auto text-center">
              {isRamadan
                ? "انضم لأكثر من 1,200 منشأة سعودية — مع خصومات حصرية طوال شهر رمضان المبارك"
                : "انضم لأكثر من 1,200 منشأة سعودية تدير أعمالها عبر نيوماكسيو"}
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-10">
              {(isRamadan ? [
                { icon: CheckCircle2, text: "خصم 30% طوال رمضان" },
                { icon: Shield, text: "بياناتك مشفرة ومحمية" },
                { icon: Zap, text: "إعداد في 5 دقائق" },
              ] : [
                { icon: CheckCircle2, text: "14 يوم تجربة مجانية" },
                { icon: Shield, text: "بياناتك مشفرة ومحمية" },
                { icon: Zap, text: "إعداد في 5 دقائق" },
              ]).map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-sm text-primary-foreground/50">
                  <item.icon size={16} className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"} />
                  {item.text}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                {isRamadan ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-2xl px-12 py-4 text-base font-bold text-white transition-colors duration-200"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--ramadan-emerald)) 0%, hsl(160 75% 32%) 100%)",
                      boxShadow: "0 0 0 1px hsl(var(--ramadan-gold)/0.3), 0 8px 32px -4px hsl(var(--ramadan-emerald)/0.4)",
                    }}
                  >
                    ابدأ تجربتك المجانية الآن
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                ) : (
                  <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-12 py-7 text-base font-bold min-h-[48px]">
                    ابدأ تجربتك المجانية الآن
                    <ArrowLeft className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
                  </Button>
                )}
              </Link>
              <a href="#contact">
                <Button size="lg" className="border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.15] px-8 py-7 text-base backdrop-blur-sm rounded-2xl min-h-[48px]">
                  تواصل مع فريق المبيعات
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
