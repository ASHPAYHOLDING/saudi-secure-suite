import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroDashboard from "@/assets/hero-dashboard.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen overflow-hidden gradient-hero" dir="rtl">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="container relative mx-auto flex min-h-screen flex-col items-center justify-center px-4 pt-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2"
        >
          <Zap size={14} className="text-accent" />
          <span className="text-xs font-medium text-accent">
            نيوماكسيو — منصة سحابية سعودية
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 text-center text-4xl font-bold leading-tight text-primary-foreground md:text-6xl lg:text-7xl"
        >
          أدِر أعمالك بالكامل
          <br />
          <span className="text-gradient">من منصة واحدة</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10 max-w-2xl text-center text-lg leading-relaxed text-primary-foreground/70"
        >
          نظام سحابي مصمم للسوق السعودي. كل شركة بيئة مستقلة 100%.
          بيانات معزولة. أمان مطلق. جاهز للتوسع.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-16 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link to="/dashboard">
            <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-8 text-base hover:opacity-90">
              ابدأ تجربتك المجانية
              <ArrowLeft className="mr-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 px-8 text-base">
              تعرّف على المميزات
            </Button>
          </a>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mb-12 flex flex-wrap items-center justify-center gap-8"
        >
          {[
            { icon: Shield, label: "عزل بيانات كامل" },
            { icon: Globe, label: "سحابي 100%" },
            { icon: Zap, label: "سرعة فائقة" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-primary-foreground/50">
              <item.icon size={16} />
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full max-w-5xl overflow-hidden rounded-t-2xl border border-primary-foreground/10 shadow-elevated"
        >
          <img
            src={heroDashboard}
            alt="لوحة التحكم"
            className="w-full object-cover"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
