import { motion } from "framer-motion";
import { CreditCard, Wallet, ArrowLeftRight, CheckCircle2 } from "lucide-react";

const gateways = [
  { name: "مدى", nameEn: "Mada" },
  { name: "Visa", nameEn: "Visa" },
  { name: "Mastercard", nameEn: "Mastercard" },
  { name: "Apple Pay", nameEn: "Apple Pay" },
];

const features = [
  "استقبل المدفوعات مباشرة على فواتيرك",
  "إدارة عمولات الشركاء والوسطاء",
  "سحب المبالغ بشكل آمن ومباشر",
  "ربط تلقائي بسجل المدفوعات والفواتير",
];

const PaymentGatewaySection = () => {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <CreditCard size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">بوابة الدفع</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            استقبل المدفوعات <span className="text-gradient">بكل سهولة</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            دعم لأشهر بوابات الدفع في المملكة مع ربط تلقائي بالفواتير
          </motion.p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Payment logos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-4 mb-10"
          >
            {gateways.map((g, i) => (
              <motion.div
                key={g.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 shadow-card min-h-[56px]"
              >
                <Wallet size={20} className="text-accent" />
                <div>
                  <p className="text-sm font-bold text-foreground">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground font-english" dir="ltr">{g.nameEn}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Features list */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card max-w-2xl mx-auto"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((f) => (
                <div key={f} className="flex items-center gap-3 min-h-[44px]">
                  <CheckCircle2 size={16} className="text-accent shrink-0" />
                  <span className="text-sm text-foreground">{f}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PaymentGatewaySection;
