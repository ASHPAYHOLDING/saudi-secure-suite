import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Clock,
  AlertTriangle, Shield, FileText, Download, RefreshCw,
  Wallet, BarChart3, PieChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

/* ─── Score Circle ─── */
function HealthScoreCircle({ score, loading }: { score: number; loading: boolean }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 85 ? "text-emerald-500" : score >= 65 ? "text-amber-500" : "text-destructive";
  const strokeColor = score >= 85 ? "stroke-emerald-500" : score >= 65 ? "stroke-amber-500" : "stroke-destructive";
  const label = score >= 85 ? "ممتاز" : score >= 65 ? "مستقر" : "تحتاج مراجعة";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle cx="90" cy="90" r={radius} strokeWidth="10" fill="none" className="stroke-muted/30" />
        <motion.circle
          cx="90" cy="90" r={radius} strokeWidth="10" fill="none"
          className={strokeColor} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: loading ? circumference : offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {loading ? (
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
        ) : (
          <>
            <span className={`text-4xl font-bold ${color}`}>{score}</span>
            <span className="text-xs text-muted-foreground mt-1">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Metric labels ─── */
const METRIC_META: Record<string, { label: string; icon: React.ElementType }> = {
  cash_runway: { label: "احتياطي السيولة", icon: Wallet },
  gross_margin: { label: "هامش الربح الإجمالي", icon: TrendingUp },
  revenue_growth: { label: "نمو الإيرادات", icon: BarChart3 },
  expense_control: { label: "التحكم بالمصروفات", icon: TrendingDown },
  overdue_ratio: { label: "نسبة الفواتير المتأخرة", icon: Clock },
  customer_concentration: { label: "تركّز العملاء", icon: Users },
  liquidity: { label: "نسبة السيولة", icon: DollarSign },
};

/* ─── Page ─── */
export default function FinancialHealthPage() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { t } = useLanguage();
  const [isRecalculating, setIsRecalculating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["financial-health", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      // Try cached first
      const { data: cached } = await (supabase
        .from("tenant_financial_health" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle() as any);

      if (cached?.score != null) {
        return {
          score: cached.score as number,
          breakdown: cached.breakdown_json as Record<string, any>,
          executive_summary: cached.executive_summary as string,
          last_calculated_at: cached.last_calculated_at as string,
        };
      }
      // Calculate fresh
      return await calculateFresh();
    },
  });

  const calculateFresh = async () => {
    const { data: result, error } = await supabase.functions.invoke("financial-health", {
      body: { tenant_id: tenantId },
    });
    if (error) throw error;
    return result;
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await calculateFresh();
      await refetch();
      toast.success("تم إعادة حساب الصحة المالية");
    } catch {
      toast.error("فشل في إعادة الحساب");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDownloadPDF = () => {
    toast.info("جارٍ تحضير التقرير...");
    // Print-based PDF
    window.print();
  };

  const score = data?.score ?? 0;
  const breakdown = data?.breakdown ?? {};
  const summary = data?.executive_summary ?? "";
  const loading = isLoading || isRecalculating;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 print:max-w-none print:px-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <HealthScoreCircle score={score} loading={loading} />
        <div className="text-center sm:text-start space-y-2 flex-1">
          <h1 className="text-2xl font-bold text-foreground">الصحة المالية</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            تقييم شامل للوضع المالي بناءً على 7 مؤشرات أداء رئيسية.
          </p>
          {data?.last_calculated_at && (
            <p className="text-xs text-muted-foreground">
              آخر تحديث: {new Date(data.last_calculated_at).toLocaleDateString("ar-SA")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3 print:hidden">
            <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              إعادة الحساب
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="gap-1.5">
              <Download className="h-4 w-4" />
              تحميل PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Breakdown Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(breakdown).map(([key, metric]: [string, any]) => {
          const meta = METRIC_META[key];
          if (!meta) return null;
          const Icon = meta.icon;
          const metricScore = metric.score ?? 0;
          const scoreColor = metricScore >= 85 ? "text-emerald-600" : metricScore >= 65 ? "text-amber-600" : "text-destructive";

          return (
            <Card key={key} className="relative overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{meta.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {metric.weight}%
                  </Badge>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-xs text-muted-foreground">{metric.value}</span>
                  <span className={`text-lg font-bold ${scoreColor}`}>{metricScore}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      metricScore >= 85 ? "bg-emerald-500" : metricScore >= 65 ? "bg-amber-500" : "bg-destructive"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${metricScore}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Executive Summary ── */}
      {summary && (
        <Card className="print:border-2 print:border-foreground/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              الملخص التنفيذي — المدير المالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
