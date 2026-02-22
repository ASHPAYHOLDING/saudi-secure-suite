import { motion } from "framer-motion";
import { FileText, Wallet, Package, BarChart3, Bot, Building2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const modules = [
  { icon: FileText, title: "الفواتير والضرائب", desc: "فاتورة خلال 10 ثوانٍ — جاهزة لهيئة الزكاة تلقائياً مع توقيع XML و QR Code.", color: "bg-accent/10 text-accent" },
  { icon: Wallet, title: "المصروفات", desc: "تصنيف ذكي تلقائي مع كشف شذوذ فوري ومطابقة بنكية بدون تدخل يدوي.", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { icon: Package, title: "المخزون", desc: "تحكم لحظي بالكميات والتكاليف والربحية مع تنبيهات إعادة الطلب الذكية.", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { icon: BarChart3, title: "التقارير التنفيذية", desc: "لوحات تنفيذية يفهمها المدير قبل المحاسب — مؤشرات أداء فورية وتقارير جاهزة للتصدير.", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { icon: Bot, title: "AI المحاسبي", desc: "اسأل… ويجيب بالأرقام. محاسب ذكي يحلل بياناتك ويقدم توصيات فورية قابلة للتنفيذ.", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  { icon: Building2, title: "الحوكمة المؤسسية", desc: "قوالب أدوار جاهزة + سلاسل موافقات + سجل تدقيق شامل — جاهز للتدقيق من اليوم الأول.", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
];

const ERPModulesSection = () => {
  return (
    <section id="features" className="py-20 md:py-28 bg-secondary/30">
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
            كل وحدة تغذّي الأخرى — من إصدار الفاتورة إلى التقرير التنفيذي، بدون إدخال يدوي مكرر
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.color} mb-4`}>
                <m.icon size={22} />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.desc}</p>
              <Link to="/auth" className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1">
                استكشف
                <ArrowLeft size={14} className="rtl-mirror" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ERPModulesSection;
