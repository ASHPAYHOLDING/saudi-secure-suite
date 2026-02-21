import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useCountUp } from "@/hooks/useCountUp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Shield, Activity, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Zap, FileText, Mail, Radar,
  DollarSign, Percent, Clock, BarChart3, CheckCircle,
} from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar as RechartsRadar, Tooltip,
} from "recharts";

interface ExecutiveData {
  summary: {
    revenue: { current: number; change: number };
    netProfit: { current: number; change: number };
    cashflowStability: number;
    complianceScore: number;
    overallRisk: string;
  };
  kpis: {
    grossMargin: number;
    operatingMargin: number;
    burnRate: number;
    dso: number;
    expenseGrowth: number;
  };
  riskRadar: {
    liquidity: number;
    tax: number;
    collection: number;
    expenseAnomaly: number;
  };
  aiBrief: string;
}

const ExecutiveIntelligencePage = () => {
  const { t, isRTL } = useLanguage();

  const { data, isLoading } = useQuery<ExecutiveData>({
    queryKey: ["executive-intelligence"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/executive-intelligence`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const revenue = useCountUp(data?.summary.revenue.current || 0, 1000, !isLoading);
  const profit = useCountUp(data?.summary.netProfit.current || 0, 1000, !isLoading);
  const stability = useCountUp(data?.summary.cashflowStability || 0, 800, !isLoading);
  const compliance = useCountUp(data?.summary.complianceScore || 0, 800, !isLoading);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat(isRTL ? "ar-SA" : "en-SA", { maximumFractionDigits: 0 }).format(v);

  const TrendBadge = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
    const isPositive = value >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
        {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(value).toFixed(1)}{suffix}
      </span>
    );
  };

  const RiskBadge = ({ level }: { level: string }) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      low: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", label: isRTL ? "منخفض" : "Low" },
      medium: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", label: isRTL ? "متوسط" : "Medium" },
      high: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", label: isRTL ? "مرتفع" : "High" },
    };
    const c = config[level] || config.low;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${c.bg} ${c.text}`}>
        <AlertTriangle size={12} />
        {c.label}
      </span>
    );
  };

  const radarData = data ? [
    { subject: isRTL ? "السيولة" : "Liquidity", value: data.riskRadar.liquidity },
    { subject: isRTL ? "الضرائب" : "Tax", value: data.riskRadar.tax },
    { subject: isRTL ? "التحصيل" : "Collection", value: data.riskRadar.collection },
    { subject: isRTL ? "المصروفات" : "Expenses", value: data.riskRadar.expenseAnomaly },
  ] : [];

  const kpiCards = data ? [
    { label: isRTL ? "هامش الربح الإجمالي" : "Gross Margin", value: `${data.kpis.grossMargin.toFixed(1)}%`, icon: Percent, trend: data.kpis.grossMargin },
    { label: isRTL ? "هامش التشغيل" : "Operating Margin", value: `${data.kpis.operatingMargin.toFixed(1)}%`, icon: BarChart3, trend: data.kpis.operatingMargin },
    { label: isRTL ? "معدل الحرق" : "Burn Rate", value: data.kpis.burnRate > 0 ? `${formatCurrency(data.kpis.burnRate)} ${isRTL ? "ر.س" : "SAR"}` : "—", icon: Zap, trend: data.kpis.burnRate > 0 ? -1 : 1 },
    { label: isRTL ? "أيام التحصيل" : "DSO", value: `${data.kpis.dso} ${isRTL ? "يوم" : "days"}`, icon: Clock, trend: data.kpis.dso < 30 ? 1 : -1 },
    { label: isRTL ? "نمو المصروفات" : "Expense Growth", value: `${data.kpis.expenseGrowth.toFixed(1)}%`, icon: TrendingUp, trend: data.kpis.expenseGrowth > 10 ? -1 : 1 },
  ] : [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {isRTL ? "لوحة الذكاء التنفيذي" : "Executive Intelligence Board"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "نظرة شاملة على الأداء المالي والمخاطر" : "Comprehensive financial performance & risk overview"}
          </p>
        </div>
      </div>

      {/* ── 1. Executive Summary Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: isRTL ? "الإيرادات" : "Revenue",
            value: `${formatCurrency(revenue)} ${isRTL ? "ر.س" : "SAR"}`,
            change: data?.summary.revenue.change || 0,
            icon: DollarSign,
            color: "from-emerald-500/10 to-emerald-500/5",
          },
          {
            label: isRTL ? "صافي الربح" : "Net Profit",
            value: `${formatCurrency(profit)} ${isRTL ? "ر.س" : "SAR"}`,
            change: data?.summary.netProfit.change || 0,
            icon: TrendingUp,
            color: "from-blue-500/10 to-blue-500/5",
          },
          {
            label: isRTL ? "استقرار التدفق" : "Cashflow Stability",
            value: `${stability}%`,
            icon: Activity,
            color: "from-teal-500/10 to-teal-500/5",
            stability: true,
          },
          {
            label: isRTL ? "الامتثال" : "Compliance",
            value: `${compliance}%`,
            icon: Shield,
            color: "from-purple-500/10 to-purple-500/5",
            complianceVal: true,
          },
          {
            label: isRTL ? "مستوى المخاطر" : "Risk Level",
            icon: AlertTriangle,
            color: "from-orange-500/10 to-orange-500/5",
            riskLevel: data?.summary.overallRisk || "low",
          },
        ].map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <Card className={`border-0 bg-gradient-to-br ${card.color} backdrop-blur-sm`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <card.icon size={18} className="text-muted-foreground" />
                  {card.change !== undefined && !card.riskLevel && !card.stability && !card.complianceVal && (
                    <TrendBadge value={card.change} />
                  )}
                </div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  {card.label}
                </p>
                {card.riskLevel ? (
                  <RiskBadge level={card.riskLevel} />
                ) : (
                  <p className="text-xl font-bold text-foreground tracking-tight">{card.value}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── 2. Strategic KPIs ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {isRTL ? "المؤشرات الاستراتيجية" : "Strategic KPIs"}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {kpiCards.map((kpi, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.06, duration: 0.35 }}
            >
              <Card className="border border-border/50 hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <kpi.icon size={14} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                  <div className="mt-1">
                    {kpi.trend >= 0 ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle size={10} /> {isRTL ? "ضمن النطاق" : "On track"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <AlertTriangle size={10} /> {isRTL ? "يحتاج مراجعة" : "Needs attention"}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── 3. Risk Radar + 4. AI Brief — side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Radar */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
          <Card className="border border-border/50 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Radar size={16} className="text-accent" />
                {isRTL ? "رادار المخاطر" : "Risk Radar"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <RechartsRadar
                      name="Risk"
                      dataKey="value"
                      stroke="hsl(var(--accent))"
                      fill="hsl(var(--accent))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Executive Brief */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }}>
          <Card className="border border-border/50 h-full bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap size={16} className="text-accent" />
                {isRTL ? "الملخص التنفيذي الأسبوعي" : "Executive Weekly Summary"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.aiBrief ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                    {data.aiBrief}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {isRTL ? "جاري إعداد الملخص التنفيذي..." : "Preparing executive summary..."}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── 5. Quick Actions ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <Card className="border border-border/50">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {isRTL ? "إجراءات سريعة" : "Quick Actions"}
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to="/dashboard/finance/cashflow-radar">
                  <Activity size={14} />
                  {isRTL ? "رادار التدفق النقدي" : "Cashflow Radar"}
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to="/dashboard/finance/collections-intelligence">
                  <Shield size={14} />
                  {isRTL ? "ذكاء التحصيل" : "Smart Collections"}
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText size={14} />
                {isRTL ? "تقرير مجلس الإدارة" : "Board Report (PDF)"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Mail size={14} />
                {isRTL ? "جدولة الملخص التنفيذي" : "Schedule Executive Summary"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ExecutiveIntelligencePage;
