import { motion } from "framer-motion";
import { FileText, Wallet, Package, BarChart3, Bot, Building2, ArrowLeft, Users, ShoppingCart, Calculator } from "lucide-react";
import { Link } from "react-router-dom";

const modules = [
  { icon: FileText, title: "الفواتير والضرائب", desc: "فاتورة خلال 10 ثوانٍ — ZATCA Phase 2 مع توقيع XML و QR Code وإقرار ضريبي تلقائي." },
  { icon: Users, title: "العملاء والموردين", desc: "إدارة شاملة لبيانات العملاء والموردين مع ربط تلقائي بالفواتير والمدفوعات." },
  { icon: Wallet, title: "المصروفات", desc: "تصنيف ذكي تلقائي مع كشف شذوذ فوري وربط بمراكز التكلفة." },
  { icon: Package, title: "المخزون", desc: "تحكم لحظي بالكميات والتكاليف مع تنبيهات إعادة الطلب الذكية." },
  { icon: ShoppingCart, title: "أوامر البيع والشراء", desc: "إدارة دورة المبيعات والمشتريات الكاملة مع ربط تلقائي بالمخزون والفواتير." },
  { icon: Calculator, title: "القيود اليومية", desc: "قيود محاسبية متوازنة مع حوكمة صارمة ومنع التعديل بعد الترحيل." },
  { icon: BarChart3, title: "التقارير التنفيذية", desc: "لوحات تنفيذية بمؤشرات أداء فورية — الميزانيات ومراكز التكلفة وتقارير جاهزة للتصدير." },
  { icon: Bot, title: "AI المحاسبي", desc: "اسأل ويجيب بالأرقام — تحليل ربحية، كشف شذوذ، اقتراحات مالية، وتنبيهات ضريبية." },
  { icon: Building2, title: "الحوكمة المؤسسية", desc: "قوالب أدوار جاهزة، موافقات متعددة، سجل تدقيق شامل، Multi-Entity، SSO، و API Keys." },
];

const ERPModulesSection = () => {
  return (
    <section id="features" className="py-20 md:py-24 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <Package size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">وحدات ERP</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            وحدات مترابطة تعمل <span className="text-gradient">كمنظومة واحدة</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            كل وحدة تغذّي الأخرى — من إصدار الفاتورة إلى التقرير التنفيذي
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-card transition-all duration-300 hover:shadow-elevated"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent mb-4">
                <m.icon size={22} />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
              <Link to="/auth" className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1 min-h-[44px]">
                استكشف
                <ArrowLeft size={14} className="rtl:rotate-180" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ERPModulesSection;
