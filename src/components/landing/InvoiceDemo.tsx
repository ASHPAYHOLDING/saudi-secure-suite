import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FileText, User, Package, CheckCircle2, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const InvoiceDemo = () => {
  const [step, setStep] = useState(0); // 0=idle, 1=customer, 2=item, 3=issuing, 4=done

  const reset = () => setStep(0);

  const startDemo = () => {
    setStep(1);
    setTimeout(() => setStep(2), 1200);
    setTimeout(() => setStep(3), 2400);
    setTimeout(() => setStep(4), 5500);
  };

  return (
    <section id="demo" className="py-24 md:py-32 bg-secondary/30" dir="rtl">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-4 text-3xl font-bold text-foreground md:text-5xl"
          >
            من الصفر إلى فاتورة متوافقة <span className="text-gradient">خلال 10 ثوانٍ</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            جرّب بنفسك — شاهد سرعة إصدار الفواتير
          </motion.p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-elevated">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
              </div>
              <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-0.5 rounded-full mx-auto">
                عرض توضيحي تفاعلي
              </span>
            </div>

            <div className="space-y-4 min-h-[280px]">
              {/* Step 1: Customer */}
              <div className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-300 ${
                step >= 1 ? "border-accent/30 bg-accent/5" : "border-border"
              }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
                  step >= 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <User size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">اختيار العميل</p>
                  <AnimatePresence>
                    {step >= 1 && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-xs text-accent mt-0.5"
                      >
                        ✓ شركة الفلاح للتجارة — CR: 1010123456
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                {step >= 1 && <CheckCircle2 size={18} className="text-accent" />}
              </div>

              {/* Step 2: Item */}
              <div className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-300 ${
                step >= 2 ? "border-accent/30 bg-accent/5" : "border-border"
              }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
                  step >= 2 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  <Package size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">إضافة البنود</p>
                  <AnimatePresence>
                    {step >= 2 && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-xs text-accent mt-0.5"
                      >
                        ✓ استشارات مالية × 10 ساعات = ٥,٠٠٠ ﷼ + ضريبة ٧٥٠ ﷼
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                {step >= 2 && <CheckCircle2 size={18} className="text-accent" />}
              </div>

              {/* Step 3: Issuing */}
              <div className={`flex items-center gap-3 rounded-xl border p-4 transition-all duration-300 ${
                step >= 3 ? (step >= 4 ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5") : "border-border"
              }`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
                  step >= 4 ? "bg-emerald-500 text-white" : step >= 3 ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {step === 3 ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {step >= 4 ? "تم الإصدار!" : step === 3 ? "جارِ الإصدار..." : "إصدار الفاتورة"}
                  </p>
                  <AnimatePresence>
                    {step === 3 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-2"
                      >
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 3, ease: "easeInOut" }}
                            className="h-full rounded-full bg-accent"
                          />
                        </div>
                        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                          <span>توقيع XML...</span>
                          <span>QR Code...</span>
                          <span>ZATCA ✓</span>
                        </div>
                      </motion.div>
                    )}
                    {step >= 4 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 mt-1"
                      >
                        <Shield size={12} className="text-emerald-500" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          فاتورة #INV-2026-1024 — ZATCA متوافقة — QR مرفق
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {step >= 4 && <CheckCircle2 size={18} className="text-emerald-500" />}
              </div>
            </div>

            {/* Action */}
            <div className="mt-6 text-center">
              {step === 0 ? (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={startDemo} size="lg" className="gradient-accent text-accent-foreground shadow-accent-glow px-10 py-6">
                    إصدار فاتورة تجريبية
                  </Button>
                </motion.div>
              ) : step >= 4 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button onClick={reset} variant="outline" size="lg">
                    إعادة العرض
                  </Button>
                </motion.div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InvoiceDemo;
