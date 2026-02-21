import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Shield, Zap, CheckCircle2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const trustItems = [
  { icon: Shield, label: "ZATCA Phase 2 معتمد" },
  { icon: CheckCircle2, label: "VAT تلقائي" },
  { icon: Zap, label: "تشفير 256-bit" },
  { icon: BarChart3, label: "1,200+ منشأة سعودية" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen overflow-hidden gradient-hero" dir="rtl" style={{ overflowX: "clip" }}>
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 0h60v60H0z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.06, 0.1, 0.06] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[10%] right-[10%] w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(172 66% 50% / 0.15), transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.04, 0.08, 0.04] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(220 70% 60% / 0.1), transparent 70%)" }}
        />
      </div>

      <div className="container relative mx-auto flex min-h-screen items-center px-4 pt-24 pb-16 z-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center w-full">
          {/* Left: Content */}
          <div className="space-y-6 md:space-y-8 min-w-0">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-3 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                </span>
                <span className="text-xs font-semibold text-accent">
                  جاهز لمرحلة الفوترة الإلكترونية Phase 2
                </span>
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.2] text-primary-foreground"
            >
              ERP سعودي مؤسسي.
              <br />
              <span className="text-gradient">أسرع. أذكى.</span>
              <br />
              <span className="text-primary-foreground/90">
                متوافق بالكامل مع هيئة الزكاة.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-lg text-base sm:text-lg leading-relaxed text-primary-foreground/80"
            >
              فواتير في 10 ثوانٍ. امتثال ZATCA تلقائي. AI محاسبي يحلل أعمالك ويوصيك بخطوتك التالية.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Link to="/auth">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-7 text-base font-bold">
                    ابدأ مجاناً — 14 يوم
                    <ArrowLeft className="mr-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
              <a href="#demo">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" className="border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.15] px-8 py-7 text-base backdrop-blur-sm gap-2 rounded-2xl">
                    <Play size={16} className="fill-current" />
                    شاهد الديمو
                  </Button>
                </motion.div>
              </a>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-x-5 gap-y-3 pt-2"
            >
              {trustItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon size={14} className="text-accent/70" />
                  <span className="text-xs text-primary-foreground/60">{item.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm p-5 shadow-2xl">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-[10px] text-white/30 bg-white/5 px-3 py-0.5 rounded-full">
                    app.numaxio.com/dashboard
                  </span>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "الإيرادات الشهرية", value: "٢٤٥,٠٠٠ ﷼", trend: "+12%", color: "text-emerald-400" },
                  { label: "صافي الربح", value: "١٦٢,٦٠٠ ﷼", trend: "+8%", color: "text-blue-400" },
                  { label: "DSO", value: "٢٣ يوم", trend: "-3", color: "text-amber-400" },
                  { label: "درجة الامتثال", value: "٩٤٪", trend: "A+", color: "text-emerald-400" },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-3"
                  >
                    <p className="text-[10px] text-white/40 mb-1">{kpi.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-white/90">{kpi.value}</span>
                      <span className={`text-[10px] font-semibold ${kpi.color}`}>{kpi.trend}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ZATCA Status */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 mb-3"
              >
                <Shield size={14} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-300 font-medium">ZATCA Phase 2 — متوافق ✓</span>
                <span className="mr-auto text-[10px] text-emerald-400/60">آخر مزامنة: الآن</span>
              </motion.div>

              {/* AI Popup */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.3, type: "spring" }}
                className="rounded-xl bg-white/[0.08] border border-accent/20 p-3"
              >
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={12} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-[10px] text-accent font-semibold mb-0.5">توصية AI</p>
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      لاحظت ارتفاع DSO بمقدار 3 أيام. يُوصى بتفعيل التحصيل الذكي لـ 4 عملاء متأخرين.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
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
