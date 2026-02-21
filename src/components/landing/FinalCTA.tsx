import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FinalCTA = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(220 30% 8%) 0%, hsl(220 35% 16%) 50%, hsl(172 40% 18%) 100%)" }}
        >
          <div className="relative p-8 md:p-16 lg:p-20 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-bold text-white mb-5 leading-tight"
              style={{ fontSize: "clamp(22px, 3vw, 42px)" }}
            >
              جاهز للانتقال إلى ERP سعودي حقيقي؟
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-white/80 mb-8 max-w-2xl mx-auto"
              style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
            >
              انضم لأكثر من 1,200 منشأة سعودية تدير أعمالها بذكاء عبر نيوماكسيو
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap justify-center gap-6 mb-10"
            >
              {[
                { icon: CheckCircle2, text: "14 يوم تجربة مجانية" },
                { icon: Shield, text: "بياناتك مشفرة ومحمية" },
                { icon: Zap, text: "إعداد في 5 دقائق" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-sm text-white/80">
                  <item.icon size={16} className="text-accent" />
                  {item.text}
                </div>
              ))}
            </motion.div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-12 min-h-[48px] text-base font-bold rounded-xl">
                  ابدأ الآن
                  <ArrowLeft className="ms-2 h-5 w-5 rtl-mirror" />
                </Button>
              </Link>
              <a href="#contact">
                <Button size="lg" className="border border-white/20 bg-white/[0.08] text-white hover:bg-white/[0.15] px-8 min-h-[48px] text-base backdrop-blur-sm rounded-xl">
                  تحدث مع المبيعات
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
