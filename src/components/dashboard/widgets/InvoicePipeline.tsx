import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Send, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/formatters";

interface PipelineStage {
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface InvoicePipelineProps {
  draft: number;
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
  total: number;
}

const InvoicePipeline = ({ draft, pending, paid, overdue, cancelled, total }: InvoicePipelineProps) => {
  const stages: PipelineStage[] = [
    { label: "مسودة", count: draft, icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted/60" },
    { label: "معلّقة", count: pending, icon: Send, color: "text-warning", bgColor: "bg-warning/10" },
    { label: "مدفوعة", count: paid, icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10" },
    { label: "متأخرة", count: overdue, icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" },
    { label: "ملغاة", count: cancelled, icon: XCircle, color: "text-muted-foreground/50", bgColor: "bg-muted/30" },
  ];

  return (
    <Card className="border-border/40 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-5 pt-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-accent" />
          </div>
          مسار الفواتير
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {/* Pipeline visualization */}
        <div className="flex items-center gap-1 mb-4 h-3 rounded-full overflow-hidden bg-muted/30">
          {stages.map((stage, i) => {
            const width = total > 0 ? (stage.count / total) * 100 : 0;
            if (width === 0) return null;
            return (
              <motion.div
                key={stage.label}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "h-full rounded-full",
                  i === 0 && "bg-muted-foreground/30",
                  i === 1 && "bg-warning",
                  i === 2 && "bg-success",
                  i === 3 && "bg-destructive",
                  i === 4 && "bg-muted-foreground/20",
                )}
              />
            );
          })}
        </div>

        {/* Stage cards */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all",
                "hover:bg-muted/40 cursor-default",
                stage.count > 0 ? "opacity-100" : "opacity-40"
              )}
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", stage.bgColor)}>
                <stage.icon className={cn("w-4 h-4", stage.color)} />
              </div>
              <span className="text-lg font-bold tabular-nums text-foreground">{fmtNumber(stage.count)}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{stage.label}</span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoicePipeline;
