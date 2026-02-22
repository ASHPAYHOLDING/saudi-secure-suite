import { motion } from "framer-motion";
import { useState } from "react";
import {
  FileText, BarChart3, Wallet, Users, Package, Shield,
  CheckCircle2, ArrowLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ShowcaseItem {
  id: string;
  icon: any;
  title: string;
  subtitle: string;
  highlights: string[];
  gradient: string;
  mockContent: React.ReactNode;
}

const DashboardMock = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: "الإيرادات", value: "٢٤٥,٠٠٠ ﷼", color: "bg-emerald-500/20 text-emerald-600" },
        { label: "المصروفات", value: "٨٢,٤٠٠ ﷼", color: "bg-red-500/20 text-red-600" },
        { label: "صافي الربح", value: "١٦٢,٦٠٠ ﷼", color: "bg-blue-500/20 text-blue-600" },
        { label: "الضريبة المستحقة", value: "٣٦,٧٥٠ ﷼", color: "bg-amber-500/20 text-amber-600" },
      ].map((stat) => (
        <div key={stat.label} className="rounded-xl bg-white/60 dark:bg-white/5 p-3 border border-border/50">
          <p className="text-[10px] text-muted-foreground mb-1">{stat.label}</p>
          <p className={`text-sm font-bold ${stat.color.split(" ")[1]}`}>{stat.value}</p>
        </div>
      ))}
    </div>
    <div className="rounded-xl bg-white/60 dark:bg-white/5 p-4 border border-border/50 h-32 flex items-end gap-1.5">
      {[40, 65, 50, 80, 60, 90, 75, 85, 70, 95, 82, 88].map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${h}%` }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05, duration: 0.5 }}
          className="flex-1 rounded-t-md bg-accent/70"
        />
      ))}
    </div>
    <div className="space-y-2">
      {["فاتورة #1024 — شركة الفلاح للتجارة", "فاتورة #1023 — مؤسسة الريادة", "فاتورة #1022 — شركة تقنية المستقبل"].map((item, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 border border-border/50 text-xs">
          <span className="text-foreground/70">{item}</span>
          <span className="text-accent font-bold">مدفوعة ✓</span>
        </div>
      ))}
    </div>
  </div>
);

const InvoiceMock = () => (
  <div className="space-y-3">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs text-muted-foreground">فاتورة ضريبية</p>
        <p className="text-lg font-bold text-foreground">#INV-2026-1024</p>
      </div>
      <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">ZATCA ✓</div>
    </div>
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div className="grid grid-cols-4 bg-muted/50 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
        <span>الوصف</span><span>الكمية</span><span>السعر</span><span>المجموع</span>
      </div>
      {[
        { desc: "استشارات مالية", qty: 10, price: 500, total: 5000 },
        { desc: "تدقيق حسابات", qty: 1, price: 3000, total: 3000 },
        { desc: "إعداد إقرار ضريبي", qty: 2, price: 1500, total: 3000 },
      ].map((row, i) => (
        <div key={i} className="grid grid-cols-4 px-3 py-2 text-xs text-foreground/80 border-t border-border/30">
          <span>{row.desc}</span><span>{row.qty}</span><span>{row.price.toLocaleString("ar-SA")}</span><span>{row.total.toLocaleString("ar-SA")}</span>
        </div>
      ))}
    </div>
    <div className="flex justify-between pt-2 border-t border-border/50 text-sm">
      <span className="text-muted-foreground">المجموع + ضريبة 15%</span>
      <span className="font-bold text-foreground">١٢,٦٥٠ ﷼</span>
    </div>
    <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-accent/5 border border-accent/10">
      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
        <span className="text-[8px] font-bold text-accent">QR</span>
      </div>
      <p className="text-[10px] text-muted-foreground">QR Code متوافق مع هيئة الزكاة والضريبة — TLV مشفر</p>
    </div>
  </div>
);

const WalletMock = () => (
  <div className="space-y-4">
    <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, hsl(220,60%,25%), hsl(260,50%,30%))" }}>
      <p className="text-xs text-white/50 mb-1">الرصيد المتاح</p>
      <p className="text-3xl font-black">٢٥,٤٠٠ <span className="text-sm font-normal text-white/40">﷼</span></p>
      <div className="flex items-center gap-2 mt-3">
        <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px]">نشطة</span>
        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-[10px]">محمية 🔒</span>
      </div>
    </div>
    <div className="space-y-2">
      {[
        { label: "شحن رصيد", amount: "+٥,٠٠٠ ﷼", type: "credit" },
        { label: "شراء تكامل نوماكسيو باي", amount: "-٢٩٩ ﷼", type: "debit" },
        { label: "شحن رصيد", amount: "+١٠,٠٠٠ ﷼", type: "credit" },
      ].map((tx, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2.5 border border-border/50 text-xs">
          <span className="text-foreground/70">{tx.label}</span>
          <span className={tx.type === "credit" ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>{tx.amount}</span>
        </div>
      ))}
    </div>
  </div>
);

const showcaseItems: ShowcaseItem[] = [
  {
    id: "dashboard",
    icon: BarChart3,
    title: "لوحة تحكم ذكية",
    subtitle: "تحليلات مالية فورية مع رسوم بيانية تفاعلية",
    gradient: "from-emerald-500/20 to-teal-500/20",
    highlights: ["KPIs مالية في الوقت الفعلي", "رسوم بيانية تفاعلية Recharts", "حكمة يومية محاسبية", "تحديث فوري Realtime"],
    mockContent: <DashboardMock />,
  },
  {
    id: "invoicing",
    icon: FileText,
    title: "فواتير ZATCA احترافية",
    subtitle: "متوافقة مع المرحلة الثانية للفوترة الإلكترونية",
    gradient: "from-blue-500/20 to-indigo-500/20",
    highlights: ["QR Code بتشفير TLV", "ختم إلكتروني تلقائي", "إرسال عبر البريد/WhatsApp", "قوالب متعددة قابلة للتخصيص"],
    mockContent: <InvoiceMock />,
  },
  {
    id: "wallet",
    icon: Wallet,
    title: "محفظة رقمية Numaxio Pay",
    subtitle: "نظام مالي متكامل مع تشفير 256-bit",
    gradient: "from-violet-500/20 to-purple-500/20",
    highlights: ["شحن رصيد بنكي/بطاقة", "تحليلات مالية لحظية", "تصدير كشوف CSV", "أمان بنكي متقدم"],
    mockContent: <WalletMock />,
  },
];

const PlatformShowcase = () => {
  const [activeItem, setActiveItem] = useState("dashboard");
  const active = showcaseItems.find((s) => s.id === activeItem) || showcaseItems[0];

  return (
    <section className="py-24 md:py-32 bg-secondary/30" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Shield size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">نظرة داخل المنصة</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-5 text-3xl font-bold text-foreground md:text-5xl text-center"
          >
            شاهد المنصة <span className="text-gradient">أثناء العمل</span>
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start max-w-6xl mx-auto">
          {/* Left: tabs + info */}
          <div className="space-y-6">
            {showcaseItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
              className={`w-full text-start flex gap-4 p-5 rounded-2xl border transition-all duration-300 ${
                  activeItem === item.id
                    ? "border-accent/30 bg-accent/5 shadow-lg"
                    : "border-border bg-card hover:border-accent/20"
                }`}
              >
                <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  activeItem === item.id
                    ? "gradient-accent text-accent-foreground shadow-accent-glow"
                    : "bg-muted text-muted-foreground"
                }`}>
                  <item.icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{item.subtitle}</p>
                  {activeItem === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-1.5"
                    >
                      {item.highlights.map((h) => (
                        <div key={h} className="flex items-center gap-2 text-xs text-foreground/70">
                          <CheckCircle2 size={12} className="text-accent shrink-0" />
                          {h}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.button>
            ))}

            <Link to="/auth" className="block">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" className="w-full gradient-accent text-accent-foreground shadow-accent-glow py-6">
                  جرّب المنصة مجاناً
                  <ArrowLeft className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
                </Button>
              </motion.div>
            </Link>
          </div>

          {/* Right: mock preview */}
          <motion.div
            key={activeItem}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-3xl border border-border bg-card p-6 shadow-elevated overflow-hidden"
          >
            {/* Window chrome */}
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-muted-foreground bg-muted/50 px-4 py-1 rounded-full">
                  app.numaxio.com/{active.id}
                </span>
              </div>
            </div>

            {active.mockContent}

            {/* Decorative gradient */}
            <div className={`absolute -bottom-20 -end-20 w-60 h-60 rounded-full bg-gradient-to-br ${active.gradient} blur-3xl opacity-30`} />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PlatformShowcase;
