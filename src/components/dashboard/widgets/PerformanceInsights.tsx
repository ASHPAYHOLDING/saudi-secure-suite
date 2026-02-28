import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb, ArrowUpRight, ArrowDownRight, Minus,
  CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "@/lib/formatters";

interface Insight {
  id: string;
  type: "success" | "warning" | "info";
  title: string;
  description: string;
  metric?: string;
}

interface PerformanceInsightsProps {
  revenue: number;
  expenses: number;
  paidInvoices: number;
  totalInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
  activeContracts: number;
}

const PerformanceInsights = ({
  revenue,
  expenses,
  paidInvoices,
  totalInvoices,
  overdueInvoices,
  totalCustomers,
  activeContracts,
}: PerformanceInsightsProps) => {
  const insights: Insight[] = [];

  // Generate smart insights based on data
  const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const collectionRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;
  const overdueRate = totalInvoices > 0 ? (overdueInvoices / totalInvoices) * 100 : 0;

  if (profitMargin >= 30) {
    insights.push({
      id: "high-profit",
      type: "success",
      title: "هامش ربح مرتفع",
      description: `هامش الربح ${profitMargin.toFixed(0)}% — أداء مالي ممتاز`,
      metric: `${profitMargin.toFixed(0)}%`,
    });
  } else if (profitMargin < 10 && revenue > 0) {
    insights.push({
      id: "low-profit",
      type: "warning",
      title: "هامش ربح منخفض",
      description: "ينصح بمراجعة المصروفات لتحسين الأرباح",
      metric: `${profitMargin.toFixed(0)}%`,
    });
  }

  if (collectionRate >= 80) {
    insights.push({
      id: "good-collection",
      type: "success",
      title: "تحصيل ممتاز",
      description: `تم تحصيل ${collectionRate.toFixed(0)}% من الفواتير`,
      metric: `${collectionRate.toFixed(0)}%`,
    });
  }

  if (overdueRate > 20) {
    insights.push({
      id: "high-overdue",
      type: "warning",
      title: "فواتير متأخرة كثيرة",
      description: `${overdueInvoices} فاتورة متأخرة — تحتاج متابعة`,
      metric: `${overdueRate.toFixed(0)}%`,
    });
  }

  if (totalCustomers > 0 && activeContracts > 0) {
    const contractRate = (activeContracts / totalCustomers) * 100;
    insights.push({
      id: "contract-rate",
      type: contractRate >= 50 ? "success" : "info",
      title: "معدل التعاقد",
      description: `${contractRate.toFixed(0)}% من العملاء لديهم عقود نشطة`,
      metric: `${contractRate.toFixed(0)}%`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "no-data",
      type: "info",
      title: "ابدأ بإضافة البيانات",
      description: "أضف فواتير ومصروفات لعرض التحليلات الذكية",
    });
  }

  const iconMap = {
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
  };

  const colorMap = {
    success: { icon: "text-success", bg: "bg-success/10", badge: "border-success/30 text-success bg-success/5" },
    warning: { icon: "text-warning", bg: "bg-warning/10", badge: "border-warning/30 text-warning bg-warning/5" },
    info: { icon: "text-info", bg: "bg-info/10", badge: "border-info/30 text-info bg-info/5" },
  };

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
            <Lightbulb className="w-3.5 h-3.5 text-accent" />
          </div>
          رؤى وتوصيات
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {insights.slice(0, 4).map((insight, i) => {
              const Icon = iconMap[insight.type];
              const colors = colorMap[insight.type];
              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colors.bg)}>
                    <Icon className={cn("w-4 h-4", colors.icon)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                      {insight.metric && (
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", colors.badge)}>
                          {insight.metric}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{insight.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceInsights;
