import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Shield, Zap, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RamadanGlow, RamadanPattern, RamadanBadge } from "@/components/ramadan";
import { useTheme } from "@/theme/ThemeProvider";

const CTASection = () => {
  const { seasonalTheme } = useTheme();
  const isRamadan = seasonalTheme === "ramadan";

  return (
    <section className="py-24 md:py-32 bg-background" dir="rtl">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl gradient-hero overflow-hidden"
        >
          {/* Ramadan overlays داخل البطاقة */}
          <RamadanPattern opacity={0.05} />
          <RamadanGlow variant="hero" />

          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.15, 0.1] }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute top-0 right-1/4 w-96 h-96 rounded-full"
              style={{
                background: isRamadan
                  ? "radial-gradient(circle, hsl(var(--ramadan-gold) / 0.15) 0%, transparent 70%)"
                  : "radial-gradient(circle, hsl(172 66% 50% / 0.2) 0%, transparent 70%)"
              }}
            />
            <motion.div
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.1, 0.05] }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full"
              style={{
                background: isRamadan
                  ? "radial-gradient(circle, hsl(var(--ramadan-emerald) / 0.12) 0%, transparent 70%)"
                  : "radial-gradient(circle, hsl(220 60% 50% / 0.15) 0%, transparent 70%)"
              }}
            />
          </div>

          <div className="relative p-10 md:p-20 text-center">
            {/* Ramadan badge */}
            {isRamadan && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex justify-center mb-4"
              >
                <RamadanBadge text="عروض رمضان الحصرية 🌙" size="md" />
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className={`mb-6 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 ${
                isRamadan
                  ? "border-[hsl(var(--ramadan-gold)/0.3)] bg-[hsl(var(--ramadan-gold)/0.1)]"
                  : "border-accent/30 bg-accent/10"
              }`}
            >
              <Sparkles size={14} className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"} />
              <span className={`text-sm font-medium ${isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"}`}>
                {isRamadan ? "اشترك الآن واستفد من عروض رمضان" : "ابدأ اليوم — بدون بطاقة ائتمان"}
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6 leading-tight text-center"
            >
              جاهز لتحويل محاسبة منشأتك
              <br />
              <span className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-gradient"}>
                إلى تجربة رقمية متكاملة؟
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg text-primary-foreground/60 mb-8 max-w-2xl mx-auto text-center"
            >
              {isRamadan
                ? "انضم لأكثر من 1,200 منشأة سعودية — مع خصومات حصرية طوال شهر رمضان المبارك"
                : "انضم لأكثر من 1,200 منشأة سعودية تدير أعمالها عبر نيوماكسيو"}
            </motion.p>

            {/* Trust points */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-6 mb-10"
            >
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
            </motion.div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  {isRamadan ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl px-12 py-4 text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--ramadan-emerald)) 0%, hsl(160 75% 32%) 100%)",
                        boxShadow: "0 0 0 1px hsl(var(--ramadan-gold)/0.3), 0 8px 32px -4px hsl(var(--ramadan-emerald)/0.4)",
                      }}
                    >
                      ابدأ تجربتك المجانية الآن
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                  ) : (
                    <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-12 py-7 text-base font-bold">
                      ابدأ تجربتك المجانية الآن
                      <ArrowLeft className="mr-2 h-5 w-5" />
                    </Button>
                  )}
                </motion.div>
              </Link>
              <a href="#contact">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.15] px-8 py-7 text-base backdrop-blur-sm rounded-2xl">
                    تواصل مع فريق المبيعات
                  </Button>
                </motion.div>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
