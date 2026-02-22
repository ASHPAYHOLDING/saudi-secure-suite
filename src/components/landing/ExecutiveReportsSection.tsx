import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Clock, PieChart } from "lucide-react";
import { useTranslation } from "react-i18next";

const kpis = [
  { icon: DollarSign, label: "الإيرادات", value: "٢,٩٤٠,٠٠٠ ﷼", trend: "+١٤٪", up: true },
  { icon: TrendingDown, label: "المصروفات", value: "١,٨٢٠,٠٠٠ ﷼", trend: "+٣٪", up: false },
  { icon: TrendingUp, label: "صافي الربحية", value: "٣٨٪", trend: "+٥٪", up: true },
  { icon: Clock, label: "DSO", value: "٢٣ يوم", trend: "-٣ أيام", up: true },
  { icon: PieChart, label: "مراكز التكلفة", value: "١٢ مركز", trend: "نشط", up: true },
  { icon: BarChart3, label: "الميزانيات", value: "٣ ميزانيات", trend: "فعّالة", up: true },
];

const ExecutiveReportsSection = () => {
  const { t } = useTranslation();

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-5 py-2"
          >
            <BarChart3 size={14} className="text-accent" />
            <span className="text-sm font-semibold text-accent">{t("landing.reports.badge")}</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-3 font-bold text-foreground text-center"
            style={{ fontSize: "clamp(22px, 3vw, 36px)" }}
          >
            {t("landing.reports.title")} <span className="text-gradient">{t("landing.reports.titleHighlight")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto max-w-xl text-muted-foreground text-center"
            style={{ fontSize: "clamp(14px, 1.3vw, 18px)" }}
          >
            {t("landing.reports.subtitle")}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-2xl border border-border bg-card shadow-elevated p-5 md:p-8"
        >
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-accent/60" />
            </div>
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-3 py-0.5 rounded-full mx-auto font-english" dir="ltr">
              app.numaxio.com/reports
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {kpis.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon size={16} className="text-accent" />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground mb-1">{kpi.value}</p>
                <span className={`text-xs font-semibold ${kpi.up ? "text-accent" : "text-destructive"}`}>
                  {kpi.trend}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ExecutiveReportsSection;
