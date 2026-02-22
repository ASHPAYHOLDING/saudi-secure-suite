import { motion } from "framer-motion";
import { Shield, Lock, Server, CheckCircle2 } from "lucide-react";

const items = [
  { icon: Server, text: "استضافة داخل المملكة العربية السعودية" },
  { icon: Lock, text: "تشفير AES-256 لجميع البيانات" },
  { icon: Shield, text: "معتمد ZATCA Phase 2" },
  { icon: CheckCircle2, text: "نسخ احتياطي يومي مشفّر" },
];

const SecurityStrip = () => {
  return (
    <section className="py-10 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-10"
        >
          {items.map((item) => (
            <div key={item.text} className="flex items-center gap-2.5 min-h-[44px]">
              <item.icon size={16} className="text-accent shrink-0" />
              <span className="text-xs sm:text-sm text-foreground/80 font-medium">{item.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default SecurityStrip;
