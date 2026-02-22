import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Shield, Bot, Building2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";

const trustBadges = [
  { icon: Shield, label: "ZATCA Phase 2" },
  { icon: Bot, label: "AI محاسبي" },
  { icon: Building2, label: "حوكمة مؤسسية" },
  { icon: Server, label: "استضافة داخل المملكة" },
];

const kpis = [
  { label: "الإيرادات الشهرية", value: "٢٤٥,٠٠٠ ﷼", trend: "+12%" },
  { label: "صافي الربح", value: "١٦٢,٦٠٠ ﷼", trend: "+8%" },
  { label: "DSO", value: "٢٣ يوم", trend: "-3" },
  { label: "درجة الامتثال", value: "٩٤٪", trend: "A+" },
];

const DashboardMock = () => (
  <div className="relative rounded-2xl border border-primary-foreground/10 bg-primary-foreground/[0.05] backdrop-blur-sm shadow-2xl p-4 lg:p-5">
    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-primary-foreground/10">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
        <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
        <div className="w-2.5 h-2.5 rounded-full bg-accent/60" />
      </div>
      <div className="flex-1 text-center">
        <span className="text-[10px] text-primary-foreground/30 bg-primary-foreground/5 px-3 py-0.5 rounded-full">
          app.numaxio.com/dashboard
        </span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 lg:gap-3 mb-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + i * 0.1 }}
          className="rounded-xl bg-primary-foreground/[0.06] border border-primary-foreground/[0.08] p-2.5 lg:p-3"
        >
          <p className="text-[10px] text-primary-foreground/40 mb-1">{kpi.label}</p>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-primary-foreground/90 text-xs lg:text-sm">{kpi.value}</span>
            <span className="text-[10px] font-semibold text-accent">{kpi.trend}</span>
          </div>
        </motion.div>
      ))}
    </div>

    <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2 mb-3">
      <Shield size={14} className="text-accent" />
      <span className="text-[11px] text-accent font-medium">ZATCA Phase 2 — متوافق ✓</span>
      <span className="ms-auto text-[10px] text-accent/60">آخر مزامنة: الآن</span>
    </div>

    <div className="rounded-xl bg-primary-foreground/[0.08] border border-accent/20 p-3">
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={12} className="text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-accent font-semibold mb-0.5">توصية AI</p>
          <p className="text-[11px] text-primary-foreground/70 leading-relaxed">
            لاحظت ارتفاع DSO بمقدار 3 أيام. يُوصى بتفعيل التحصيل الذكي لـ 4 عملاء متأخرين.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const HeroSection = () => {
  return (
    <section className="relative gradient-hero overflow-hidden min-h-[70vh] lg:min-h-screen">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 0h60v60H0z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[10%] end-[10%] w-[400px] h-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(172 66% 50% / 0.12), transparent 70%)" }}
        />
      </div>

      <div className="max-w-6xl relative mx-auto flex items-center px-4 sm:px-6 pt-24 pb-16 z-20 min-h-[inherit]">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
          <div className="space-y-6 md:space-y-8 min-w-0">
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
                  متوافق مع الفوترة الإلكترونية — المرحلة الثانية
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="font-bold text-primary-foreground"
              style={{ fontSize: "clamp(26px, 4vw, 52px)", lineHeight: 1.3, overflowWrap: "anywhere" }}
            >
              نظام ERP سعودي مؤسسي
              <br />
              <span className="text-gradient">لإدارة مالية متكاملة</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="max-w-lg text-primary-foreground/90"
              style={{ fontSize: "clamp(14px, 1.5vw, 18px)", lineHeight: 1.8 }}
            >
              من الفاتورة الإلكترونية إلى التحليل التنفيذي والحوكمة المؤسسية — نظام متكامل متوافق مع ZATCA ومدعوم بذكاء محاسبي.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-8 sm:px-10 min-h-[48px] text-base font-bold rounded-xl w-full sm:w-auto">
                  ابدأ 14 يوم مجاناً
                  <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" className="border border-primary-foreground/20 bg-primary-foreground/[0.08] text-primary-foreground hover:bg-primary-foreground/[0.15] px-8 min-h-[48px] text-base backdrop-blur-sm gap-2 rounded-xl w-full sm:w-auto">
                  <Play size={16} className="fill-current" />
                  شاهد عرض مباشر
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-3 sm:gap-4 pt-2"
            >
              {trustBadges.map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-full border border-primary-foreground/10 bg-primary-foreground/[0.06] px-3 py-2 min-h-[44px]">
                  <item.icon size={14} className="text-accent shrink-0" />
                  <span className="text-xs text-primary-foreground/80 font-medium whitespace-nowrap">{item.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Dashboard Preview — tablet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="hidden md:block lg:hidden"
          >
            <DashboardMock />
          </motion.div>

          {/* Dashboard Preview — desktop */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <DashboardMock />
          </motion.div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-inline-0">
        <svg viewBox="0 0 1440 80" className="w-full h-auto block" preserveAspectRatio="none">
          <path fill="hsl(var(--background))" d="M0,50 C360,80 720,30 1080,50 C1260,65 1380,40 1440,50 L1440,80 L0,80 Z" />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
