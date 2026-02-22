import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const SavingsCalculator = () => {
  const [invoices, setInvoices] = useState(200);
  const [users, setUsers] = useState(5);

  const savings = useMemo(() => {
    const manualCostPerInvoice = 12; // SAR
    const automatedCostPerInvoice = 2;
    const invoiceSavings = (manualCostPerInvoice - automatedCostPerInvoice) * invoices * 12;
    const timeSavingsPerUser = 8; // hours/month
    const hourlyRate = 75; // SAR
    const laborSavings = timeSavingsPerUser * hourlyRate * users * 12;
    return invoiceSavings + laborSavings;
  }, [invoices, users]);

  return (
    <section className="py-20 md:py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-10 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-bold text-foreground mb-3"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            كم توفّر سنوياً <span className="text-gradient">باستخدام Numaxio؟</span>
          </motion.h2>
          <p className="text-muted-foreground mx-auto max-w-lg" style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}>
            أدخل بيانات منشأتك واحصل على تقدير فوري للتوفير المتوقع
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto rounded-2xl border border-border bg-card p-6 md:p-8 shadow-card"
        >
          <div className="space-y-6">
            {/* Invoices slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">عدد الفواتير الشهرية</label>
                <span className="text-sm font-bold text-accent">{invoices}</span>
              </div>
              <input
                type="range"
                min={10}
                max={1000}
                step={10}
                value={invoices}
                onChange={(e) => setInvoices(Number(e.target.value))}
                className="w-full accent-[hsl(var(--accent))] h-2 rounded-full"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>10</span>
                <span>1,000</span>
              </div>
            </div>

            {/* Users slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">عدد المستخدمين</label>
                <span className="text-sm font-bold text-accent">{users}</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={users}
                onChange={(e) => setUsers(Number(e.target.value))}
                className="w-full accent-[hsl(var(--accent))] h-2 rounded-full"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>1</span>
                <span>50</span>
              </div>
            </div>

            {/* Result */}
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp size={18} className="text-accent" />
                <span className="text-sm font-medium text-foreground">التوفير السنوي المتوقع</span>
              </div>
              <motion.p
                key={savings}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold text-accent"
              >
                {savings.toLocaleString("ar-SA")} ﷼
              </motion.p>
              <p className="text-xs text-muted-foreground mt-1">تقدير مبني على متوسط تكلفة العمليات اليدوية</p>
            </div>

            <Link to="/auth" className="block">
              <Button size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow w-full min-h-[48px] text-base font-bold rounded-xl">
                ابدأ التوفير الآن
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SavingsCalculator;
