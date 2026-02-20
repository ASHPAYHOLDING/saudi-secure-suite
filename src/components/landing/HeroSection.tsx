import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Calculator, Wallet, Stamp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RamadanGlow, RamadanPattern, RamadanBadge, RamadanDivider } from "@/components/ramadan";
import { useTheme } from "@/theme/ThemeProvider";

const floatingFeatures = [
  { icon: FileText, label: "فواتير ZATCA", x: "8%", y: "20%", delay: 0.8 },
  { icon: Calculator, label: "حسابات تلقائية", x: "85%", y: "25%", delay: 1.0 },
  { icon: Wallet, label: "محفظة رقمية", x: "5%", y: "72%", delay: 1.2 },
  { icon: Stamp, label: "ختم إلكتروني", x: "88%", y: "68%", delay: 1.4 },
];

const trustedLogos = ["stc", "أرامكو", "الراجحي", "البنك الأهلي", "NEOM"];

const HeroSection = () => {
  const { seasonalTheme } = useTheme();
  const isRamadan = seasonalTheme === "ramadan";

  return (
    <section className="relative min-h-screen overflow-hidden gradient-hero" dir="rtl">
      {/* Ramadan overlays */}
      <RamadanPattern />
      <RamadanGlow variant="hero" />

      {/* Animated grid background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 0h60v60H0z'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.1, 0.06] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full blur-3xl"
          style={{
            background: isRamadan
              ? "radial-gradient(circle, hsl(var(--ramadan-gold) / 0.12) 0%, transparent 70%)"
              : "radial-gradient(circle, hsl(172 66% 50% / 0.15), transparent 70%)"
          }}
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full blur-3xl"
          style={{
            background: isRamadan
              ? "radial-gradient(circle, hsl(var(--ramadan-emerald) / 0.1) 0%, transparent 70%)"
              : "radial-gradient(circle, hsl(220 70% 60% / 0.1), transparent 70%)"
          }}
        />
        <motion.div
          animate={{ y: [0, -30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(260 50% 50% / 0.06), transparent 70%)" }}
        />
      </div>

      {/* Floating feature pills */}
      {floatingFeatures.map((f, i) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: f.delay, duration: 0.6, type: "spring" }}
          className="absolute hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.07] backdrop-blur-md border border-white/[0.1] shadow-lg z-10"
          style={{ left: f.x, top: f.y }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-2"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isRamadan ? "bg-[hsl(var(--ramadan-gold)/0.2)]" : "bg-accent/20"}`}>
              <f.icon size={14} className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"} />
            </div>
            <span className="text-xs font-medium text-white/80">{f.label}</span>
          </motion.div>
        </motion.div>
      ))}

      <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-4 pt-28 pb-16 z-20">
        {/* Badge area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex flex-col items-center gap-3"
        >
          {/* Ramadan badge — يظهر تلقائياً عند تفعيل الثيم */}
          <RamadanBadge size="md" />

          <div className={`inline-flex items-center gap-3 rounded-full border px-5 py-2.5 backdrop-blur-sm ${
            isRamadan
              ? "border-[hsl(var(--ramadan-gold)/0.3)] bg-[hsl(var(--ramadan-gold)/0.1)]"
              : "border-accent/30 bg-accent/10"
          }`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRamadan ? "bg-[hsl(var(--ramadan-gold))]" : "bg-accent"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRamadan ? "bg-[hsl(var(--ramadan-gold))]" : "bg-accent"}`} />
            </span>
            <span className={`text-sm font-semibold ${isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-accent"}`}>
              🇸🇦 المنصة المحاسبية #1 في المملكة العربية السعودية
            </span>
          </div>
        </motion.div>

        {/* Ramadan greeting line */}
        {isRamadan && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4 text-center text-base text-white/60 font-arabic"
          >
            🌙 رمضان كريم — عروض حصرية طوال الشهر الكريم
          </motion.p>
        )}

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mb-6 text-center text-4xl font-bold leading-[1.15] text-primary-foreground md:text-6xl lg:text-7xl max-w-5xl"
        >
          أدِر أعمالك المحاسبية
          <br />
          <span className="relative inline-block">
            <span className={isRamadan ? "text-[hsl(var(--ramadan-gold))]" : "text-gradient"}>
              بذكاء وأمان مطلق
            </span>
            <motion.span
              className={`absolute -bottom-2 left-0 right-0 h-0.5 rounded-full ${isRamadan ? "bg-[hsl(var(--ramadan-gold)/0.4)]" : "bg-accent/40"}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
            />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mb-10 max-w-3xl text-center text-lg leading-relaxed text-primary-foreground/65 md:text-xl"
        >
          فواتير إلكترونية ZATCA · عقود · عروض أسعار · أوامر شراء · محفظة رقمية ·{" "}
          تقارير مالية · ختم إلكتروني · إدارة مخزون — كل شيء في منصة واحدة.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mb-12 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              {isRamadan ? (
                /* CTA رمضاني: Emerald مع حافة ذهبية خفيفة */
                <button className="inline-flex items-center gap-2 rounded-2xl px-10 py-4 text-base font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--ramadan-emerald)) 0%, hsl(160 75% 32%) 100%)",
                    boxShadow: "0 0 0 1px hsl(var(--ramadan-gold)/0.3), 0 8px 32px -4px hsl(var(--ramadan-emerald)/0.4)",
                  }}
                >
                  ابدأ مجاناً — 14 يوم
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-7 text-base font-bold transition-shadow duration-300 hover:shadow-[0_8px_40px_-4px_hsl(172_66%_36%/0.5)]">
                  ابدأ مجاناً — 14 يوم
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              )}
            </motion.div>
          </Link>
          <a href="#features">
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <Button size="lg" className="border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.15] px-8 py-7 text-base backdrop-blur-sm gap-2 rounded-2xl">
                <Play size={16} className="fill-current" />
                شاهد العرض التوضيحي
              </Button>
            </motion.div>
          </a>
        </motion.div>

        {/* Feature highlights row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          {[
            "✅ متوافق مع ZATCA المرحلة الثانية",
            "🔒 تشفير 256-bit",
            "☁️ سحابي بالكامل",
            "🇸🇦 دعم عربي كامل",
          ].map((item, i) => (
            <motion.span
              key={item}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="text-sm text-primary-foreground/50"
            >
              {item}
            </motion.span>
          ))}
        </motion.div>

        {/* Ramadan divider — يظهر فقط في ثيم رمضان */}
        <RamadanDivider className="w-full max-w-sm" />

        {/* Trusted by logos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-8 text-center"
        >
          <p className="text-xs text-primary-foreground/25 mb-4 uppercase tracking-widest text-center">موثوق من أكثر من منشأة سعودية</p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {trustedLogos.map((logo, i) => (
              <motion.span
                key={logo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 + i * 0.1 }}
                className="text-sm font-medium text-primary-foreground/20"
              >
                {logo}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-auto" preserveAspectRatio="none">
          <path
            fill="hsl(var(--background))"
            d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
