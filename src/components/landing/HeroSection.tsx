import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Zap, Globe, FileText, Calculator, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const counterTargets = [
  { label: "فاتورة تمت معالجتها", value: 50000, suffix: "+" },
  { label: "شركة تثق بنا", value: 1200, suffix: "+" },
  { label: "ريال سعودي تمت إدارته", value: 85, suffix: "M ﷼" },
];

const HeroSection = () => {
  const [counts, setCounts] = useState(counterTargets.map(() => 0));

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounts(counterTargets.map((t) => Math.floor(t.value * eased)));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden gradient-hero" dir="rtl">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(172 66% 36% / 0.08) 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/3 -left-1/4 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(220 60% 50% / 0.06) 0%, transparent 70%)" }}
        />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h1v40H0V0zm39 0h1v40h-1V0zM0 0h40v1H0V0zm0 39h40v1H0v-1z'/%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-4 pt-24 pb-12">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2.5 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          <span className="text-sm font-medium text-accent">
            المنصة المحاسبية الأولى في السعودية
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-6 text-center text-4xl font-bold leading-[1.2] text-primary-foreground md:text-6xl lg:text-7xl"
        >
          حلول محاسبية ذكية
          <br />
          <span className="text-gradient">لنمو أعمالك</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10 max-w-2xl text-center text-lg leading-relaxed text-primary-foreground/70 md:text-xl"
        >
          فواتير إلكترونية متوافقة مع هيئة الزكاة والدخل، إدارة عقود، تقارير مالية متقدمة، 
          وختم إلكتروني — كل ما تحتاجه منشأتك في منصة واحدة.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link to="/auth">
            <motion.div whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-6 text-base transition-shadow duration-300 hover:shadow-[0_8px_30px_-4px_hsl(172_66%_36%/0.5)]">
                ابدأ تجربتك المجانية — 14 يوم
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </motion.div>
          </Link>
          <a href="#features">
            <motion.div whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <Button size="lg" className="border border-white/20 bg-white/10 text-white hover:bg-white/20 px-8 py-6 text-base backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_4px_20px_-4px_rgba(255,255,255,0.15)]">
                اكتشف المميزات
              </Button>
            </motion.div>
          </a>
        </motion.div>

        {/* Floating feature cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-16 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl"
        >
          {[
            { icon: FileText, label: "فواتير ZATCA" },
            { icon: Calculator, label: "حسابات تلقائية" },
            { icon: BarChart3, label: "تقارير فورية" },
            { icon: Shield, label: "أمان مؤسسي" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="flex items-center gap-3 rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur-sm px-4 py-3 cursor-default"
            >
              <item.icon size={18} className="text-accent shrink-0" />
              <span className="text-sm text-primary-foreground/80">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Animated counters */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="w-full max-w-4xl rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 backdrop-blur-md p-8"
        >
          <div className="grid grid-cols-3 divide-x divide-primary-foreground/10" style={{ direction: "ltr" }}>
            {counterTargets.map((target, i) => (
              <div key={target.label} className="text-center px-4" dir="rtl">
                <p className="text-3xl md:text-4xl font-bold text-accent font-english mb-1">
                  {target.suffix.includes("M") 
                    ? `${counts[i]}${target.suffix}`
                    : `${counts[i].toLocaleString("ar-SA")}${target.suffix}`
                  }
                </p>
                <p className="text-sm text-primary-foreground/60">{target.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-auto" preserveAspectRatio="none">
          <path
            fill="hsl(210 20% 98%)"
            d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
          />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;
