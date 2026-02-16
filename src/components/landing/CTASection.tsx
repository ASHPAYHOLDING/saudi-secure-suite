import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="py-28 bg-background" dir="rtl">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl gradient-hero overflow-hidden p-12 md:p-20 text-center"
        >
          {/* Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle, hsl(172 66% 36% / 0.15) 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, hsl(220 60% 50% / 0.1) 0%, transparent 70%)" }} />

          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2"
            >
              <Sparkles size={14} className="text-accent" />
              <span className="text-sm font-medium text-accent">ابدأ اليوم مجاناً</span>
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6 leading-tight">
              جاهز لتحويل محاسبة منشأتك
              <br />
              <span className="text-gradient">إلى تجربة رقمية متكاملة؟</span>
            </h2>

            <p className="text-lg text-primary-foreground/70 mb-10 max-w-2xl mx-auto">
              انضم لأكثر من 1,200 منشأة سعودية تدير أعمالها المحاسبية عبر نيوماكسيو. 
              تجربة مجانية 14 يوم بدون بطاقة ائتمان.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <motion.div whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-6 text-base transition-shadow duration-300 hover:shadow-[0_8px_30px_-4px_hsl(172_66%_36%/0.5)]">
                    ابدأ تجربتك المجانية الآن
                    <ArrowLeft className="mr-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
              <a href="#contact">
                <motion.div whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Button size="lg" className="border border-white/20 bg-white/10 text-white hover:bg-white/20 px-8 py-6 text-base backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_4px_20px_-4px_rgba(255,255,255,0.15)]">
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
