import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { useCountUp } from "@/hooks/useCountUp";
import { useEntitlements, FEATURE_KEYS } from "@/hooks/useEntitlements";
import FeatureGate from "@/components/subscription/FeatureGate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  DollarSign, ArrowUpRight, ArrowDownRight, ArrowLeft, ArrowRight,
  RefreshCw, Bell, Filter, Check, Eye, Calendar, Download,
  FileText, LayoutDashboard, List, BarChart3, Printer,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──
interface Budget {
  id: string; tenant_id: string; fiscal_year: number; name_ar: string;
  name_en: string | null; currency: string; status: string; version: number;
  created_by: string; created_at: string;
}
interface BudgetLine {
  id: string; budget_id: string; line_type: string; description_ar: string | null;
  description_en: string | null; period_type: string; months: Record<string, number> | null;
  planned_amount: number; department_id: string | null; cost_center_id: string | null;
  account_id: string | null; project_id: string | null;
}
interface BudgetActual { line_id: string; period: string; actual_amount: number; }
interface AlertEvent {
  id: string; budget_id: string; line_id: string | null; period: string | null;
  percent_used: number; status: string; message_ar: string | null; created_at: string;
}

const MONTH_LABELS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTH_LABELS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_KEYS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

const STATUS_MAP: Record<string, { ar: string; en: string; variant: "default"|"secondary"|"destructive"|"outline" }> = {
  draft: { ar: "مسودة", en: "Draft", variant: "secondary" },
  active: { ar: "نشطة", en: "Active", variant: "default" },
  locked: { ar: "مقفلة", en: "Locked", variant: "outline" },
  archived: { ar: "مؤرشفة", en: "Archived", variant: "destructive" },
};

// ── Animated KPI ──
function KPICard({ label, value, icon: Icon, color, currency, lang, delay = 0 }: {
  label: string; value: number; icon: any; color: string; currency: string; lang: string; delay?: number;
}) {
  const animated = useCountUp(value, 1000);
  const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", {
    style: "currency", currency, minimumFractionDigits: 0,
  }).format(animated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      <Card className="border-border/50 hover:shadow-md transition-shadow">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl font-bold text-foreground">{formatted}</p>
            </div>
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PercentBadge({ pct, lang }: { pct: number; lang: string }) {
  const variant = pct > 100 ? "destructive" : pct > 80 ? "secondary" : "default";
  const label = pct > 100
    ? (lang === "ar" ? "تجاوز" : "Over")
    : pct > 80 ? (lang === "ar" ? "تحذير" : "Warning")
    : (lang === "ar" ? "طبيعي" : "Normal");
  return <Badge variant={variant} className="text-[10px]">{label} {pct.toFixed(0)}%</Badge>;
}

const BudgetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentLang, isRTL } = useLanguage();
  const { tenantId } = useAuth();
  const { entitlements } = useEntitlements([FEATURE_KEYS.BUDGETS_ALERTS, FEATURE_KEYS.BUDGETS_ADVANCED]);
  const hasAlerts = entitlements[FEATURE_KEYS.BUDGETS_ALERTS]?.allowed ?? false;
  const hasAdvanced = entitlements[FEATURE_KEYS.BUDGETS_ADVANCED]?.allowed ?? false;

  const [budget, setBudget] = useState<Budget | null>(null);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [actuals, setActuals] = useState<BudgetActual[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [alertFilter, setAlertFilter] = useState({ status: "all", month: "all" });

  const monthLabels = currentLang === "ar" ? MONTH_LABELS_AR : MONTH_LABELS_EN;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // ── Fetch ──
  useEffect(() => {
    if (!id || !tenantId) return;
    const fetchAll = async () => {
      const [budgetRes, linesRes, actualsRes, alertsRes] = await Promise.all([
        supabase.from("budgets").select("*").eq("id", id).single(),
        supabase.from("budget_lines").select("*").eq("budget_id", id),
        supabase.from("budget_actuals_cache").select("*").eq("budget_id", id),
        supabase.from("budget_alert_events").select("*").eq("budget_id", id).order("created_at", { ascending: false }).limit(100),
      ]);
      setBudget(budgetRes.data as Budget | null);
      setLines((linesRes.data || []) as BudgetLine[]);
      setActuals((actualsRes.data || []) as BudgetActual[]);
      setAlerts((alertsRes.data || []) as AlertEvent[]);
      setLoading(false);
    };
    fetchAll();
  }, [id, tenantId]);

  // ── Realtime ──
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`budget-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_actuals_cache", filter: `budget_id=eq.${id}` }, () => {
        supabase.from("budget_actuals_cache").select("*").eq("budget_id", id).then(({ data }) => setActuals((data || []) as BudgetActual[]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_alert_events", filter: `budget_id=eq.${id}` }, () => {
        supabase.from("budget_alert_events").select("*").eq("budget_id", id).order("created_at", { ascending: false }).limit(100).then(({ data }) => setAlerts((data || []) as AlertEvent[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Computed ──
  const totals = useMemo(() => {
    let totalPlanned = 0, totalActual = 0;
    for (const line of lines) {
      const lp = line.period_type === "monthly" && line.months
        ? Object.values(line.months).reduce((s, v) => s + (Number(v) || 0), 0)
        : Number(line.planned_amount) || 0;
      const la = actuals.filter(a => a.line_id === line.id).reduce((s, a) => s + Number(a.actual_amount), 0);
      totalPlanned += lp;
      totalActual += la;
    }
    const variance = totalPlanned - totalActual;
    const pct = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;
    return { totalPlanned, totalActual, variance, pct };
  }, [lines, actuals]);

  const monthlyData = useMemo(() => {
    return MONTH_KEYS.map((key, idx) => {
      let planned = 0, actual = 0;
      for (const line of lines) {
        if (line.period_type === "monthly" && line.months) planned += Number(line.months[key]) || 0;
        actual += actuals.filter(a => a.line_id === line.id && a.period?.endsWith(`-${key}`)).reduce((s, a) => s + Number(a.actual_amount), 0);
      }
      return { month: monthLabels[idx], planned, actual };
    });
  }, [lines, actuals, monthLabels]);

  const lineDetails = useMemo(() => {
    return lines.map(line => {
      const planned = line.period_type === "monthly" && line.months
        ? Object.values(line.months).reduce((s, v) => s + (Number(v) || 0), 0)
        : Number(line.planned_amount) || 0;
      const actual = actuals.filter(a => a.line_id === line.id).reduce((s, a) => s + Number(a.actual_amount), 0);
      const pct = planned > 0 ? (actual / planned) * 100 : 0;
      const monthlyBreakdown = MONTH_KEYS.map((k, i) => {
        const mp = line.period_type === "monthly" && line.months ? Number(line.months[k]) || 0 : 0;
        const ma = actuals.filter(a => a.line_id === line.id && a.period?.endsWith(`-${k}`)).reduce((s, a) => s + Number(a.actual_amount), 0);
        return { month: monthLabels[i], planned: mp, actual: ma };
      });
      return { ...line, totalPlanned: planned, totalActual: actual, pct, monthlyBreakdown };
    }).sort((a, b) => Math.abs(b.totalPlanned) - Math.abs(a.totalPlanned));
  }, [lines, actuals, monthLabels]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (alertFilter.status !== "all" && a.status !== alertFilter.status) return false;
      if (alertFilter.month !== "all" && a.period) {
        if (a.period.split("-").pop() !== alertFilter.month) return false;
      }
      return true;
    });
  }, [alerts, alertFilter]);

  // ── Handlers ──
  const handleSync = async () => {
    if (!tenantId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc("sync_budget_actuals_for_tenant", { p_tenant_id: tenantId });
      if (error) { toast.error(error.message); return; }
      const result = data as { success: boolean; records_updated?: number };
      if (result?.success) toast.success(currentLang === "ar" ? `تم مزامنة ${result.records_updated} سجل` : `Synced ${result.records_updated} records`);
    } finally { setSyncing(false); }
  };

  const handleActivate = async () => {
    if (!id) return;
    const { data, error } = await supabase.rpc("activate_budget", { p_budget_id: id });
    if (error) { toast.error(error.message); return; }
    const result = data as { success: boolean; message?: string };
    if (result?.success) {
      toast.success(result.message || "Done");
      const { data: refreshed } = await supabase.from("budgets").select("*").eq("id", id).single();
      if (refreshed) setBudget(refreshed as Budget);
    }
  };

  const handleAcknowledge = useCallback(async (alertId: string) => {
    const { error } = await supabase.from("budget_alert_events").update({ status: "acknowledged" as any }).eq("id", alertId);
    if (error) { toast.error(error.message); return; }
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "acknowledged" } : a));
    toast.success(currentLang === "ar" ? "تم تأكيد المراجعة" : "Acknowledged");
  }, [currentLang]);

  const handleResolve = useCallback(async (alertId: string) => {
    const { error } = await supabase.from("budget_alert_events").update({ status: "resolved" as any }).eq("id", alertId);
    if (error) { toast.error(error.message); return; }
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "resolved" } : a));
    toast.success(currentLang === "ar" ? "تم حل التنبيه" : "Resolved");
  }, [currentLang]);

  const handleExportCSV = useCallback(() => {
    if (!budget) return;
    const headers = ["Line", "Type", "Planned", "Actual", "Variance", "Variance %"];
    const rows = lineDetails.map(l => [
      (currentLang === "ar" ? l.description_ar : l.description_en) || l.line_type,
      l.line_type,
      l.totalPlanned.toFixed(2),
      l.totalActual.toFixed(2),
      (l.totalPlanned - l.totalActual).toFixed(2),
      l.pct.toFixed(1) + "%",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-${budget.fiscal_year}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(currentLang === "ar" ? "تم تصدير التقرير" : "Report exported");
  }, [budget, lineDetails, currentLang]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const fmt = (val: number) => new Intl.NumberFormat(currentLang === "ar" ? "ar-SA" : "en-SA", {
    style: "currency", currency: budget?.currency || "SAR", minimumFractionDigits: 0,
  }).format(val);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{currentLang === "ar" ? "الميزانية غير موجودة" : "Budget not found"}</p>
        <Button variant="link" onClick={() => navigate("/dashboard/budgets")}>
          {currentLang === "ar" ? "العودة للقائمة" : "Back to list"}
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_MAP[budget.status] || STATUS_MAP.draft;
  const triggeredCount = alerts.filter(a => a.status === "triggered").length;

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/budgets")}>
              <BackArrow className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {currentLang === "ar" ? budget.name_ar : (budget.name_en || budget.name_ar)}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusCfg.variant} className="text-[10px]">
                  {currentLang === "ar" ? statusCfg.ar : statusCfg.en}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  <Calendar className="inline h-3 w-3 me-1" />
                  {budget.fiscal_year} • v{budget.version}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {budget.status === "draft" && (
              <Button variant="outline" size="sm" onClick={handleActivate}>
                <CheckCircle className="h-4 w-4 me-1" />
                {currentLang === "ar" ? "تفعيل" : "Activate"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 me-1 ${syncing ? "animate-spin" : ""}`} />
              {currentLang === "ar" ? "مزامنة" : "Sync"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
            <LayoutDashboard className="h-3.5 w-3.5 hidden sm:inline" />
            {currentLang === "ar" ? "نظرة عامة" : "Overview"}
          </TabsTrigger>
          <TabsTrigger value="lines" className="gap-1.5 text-xs sm:text-sm">
            <List className="h-3.5 w-3.5 hidden sm:inline" />
            {currentLang === "ar" ? "البنود" : "Lines"}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs sm:text-sm relative">
            <Bell className="h-3.5 w-3.5 hidden sm:inline" />
            {currentLang === "ar" ? "التنبيهات" : "Alerts"}
            {triggeredCount > 0 && (
              <span className="absolute -top-1 -end-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold">
                {triggeredCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 hidden sm:inline" />
            {currentLang === "ar" ? "التقارير" : "Reports"}
          </TabsTrigger>
        </TabsList>

        {/* ═══ Overview ═══ */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard label={currentLang === "ar" ? "المخطط الكلي" : "Total Planned"} value={totals.totalPlanned} icon={Target} color="bg-primary/10 text-primary" currency={budget.currency} lang={currentLang} delay={0} />
            <KPICard label={currentLang === "ar" ? "الفعلي" : "Total Actual"} value={totals.totalActual} icon={DollarSign} color="bg-accent/10 text-accent-foreground" currency={budget.currency} lang={currentLang} delay={0.1} />
            <KPICard label={currentLang === "ar" ? "الانحراف" : "Variance"} value={Math.abs(totals.variance)} icon={totals.variance >= 0 ? TrendingDown : TrendingUp} color={totals.variance >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"} currency={budget.currency} lang={currentLang} delay={0.2} />
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
              <Card className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">{currentLang === "ar" ? "نسبة الاستهلاك" : "Utilization"}</p>
                      <p className={`text-xl font-bold ${totals.pct > 100 ? "text-destructive" : totals.pct > 80 ? "text-accent-foreground" : "text-foreground"}`}>
                        {totals.pct.toFixed(1)}%
                      </p>
                    </div>
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${totals.pct > 100 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {totals.pct > 100 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                    </div>
                  </div>
                  <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.8 }} style={{ transformOrigin: isRTL ? "right" : "left" }}>
                    <Progress value={Math.min(totals.pct, 100)} className="mt-3 h-2" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Area Chart */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{currentLang === "ar" ? "المخطط مقابل الفعلي — شهري" : "Planned vs Actual — Monthly"}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gradPlanned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="planned" name={currentLang === "ar" ? "المخطط" : "Planned"} stroke="hsl(var(--primary))" fill="url(#gradPlanned)" strokeWidth={2} />
                    <Area type="monotone" dataKey="actual" name={currentLang === "ar" ? "الفعلي" : "Actual"} stroke="hsl(var(--accent))" fill="url(#gradActual)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Progress bars by line type */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{currentLang === "ar" ? "استهلاك البنود" : "Line Utilization"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lineDetails.slice(0, 8).map((line, idx) => (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx, duration: 0.4 }}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground truncate max-w-[60%]">
                        {(currentLang === "ar" ? line.description_ar : line.description_en) || line.line_type}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {fmt(line.totalActual)} / {fmt(line.totalPlanned)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.2 + 0.1 * idx, duration: 0.6 }}
                          style={{ transformOrigin: isRTL ? "right" : "left" }}
                        >
                          <Progress value={Math.min(line.pct, 100)} className="h-2.5" />
                        </motion.div>
                      </div>
                      <PercentBadge pct={line.pct} lang={currentLang} />
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ Lines ═══ */}
        <TabsContent value="lines">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {currentLang === "ar" ? "بنود الميزانية" : "Budget Lines"}
                <Badge variant="secondary" className="text-[10px] ms-2">{lines.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lineDetails.length > 0 ? (
                <Accordion type="multiple" className="space-y-2">
                  {lineDetails.map((line, idx) => (
                    <motion.div
                      key={line.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx }}
                    >
                      <AccordionItem value={line.id} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center justify-between w-full me-3">
                            <div className="flex items-center gap-3">
                              <div className={`h-2 w-2 rounded-full ${
                                line.line_type === "expense" ? "bg-destructive" :
                                line.line_type === "revenue" ? "bg-primary" : "bg-accent"
                              }`} />
                              <span className="font-medium text-sm text-start">
                                {(currentLang === "ar" ? line.description_ar : line.description_en) || line.line_type}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {line.line_type === "expense" ? (currentLang === "ar" ? "مصروف" : "Expense") :
                                 line.line_type === "revenue" ? (currentLang === "ar" ? "إيراد" : "Revenue") :
                                 (currentLang === "ar" ? "رأسمالي" : "CapEx")}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{fmt(line.totalActual)}</span>
                                <span>/</span>
                                <span>{fmt(line.totalPlanned)}</span>
                              </div>
                              <PercentBadge pct={line.pct} lang={currentLang} />
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pt-2 pb-3 space-y-3">
                            <div className="flex items-center gap-3">
                              <Progress value={Math.min(line.pct, 100)} className="h-2 flex-1" />
                              <span className={`text-sm font-semibold ${line.pct > 100 ? "text-destructive" : "text-foreground"}`}>
                                {line.pct.toFixed(1)}%
                              </span>
                            </div>
                            {/* Monthly breakdown table */}
                            <div className="border rounded-lg overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-start p-2 font-medium">{currentLang === "ar" ? "الشهر" : "Month"}</th>
                                    <th className="text-start p-2 font-medium">{currentLang === "ar" ? "المخطط" : "Planned"}</th>
                                    <th className="text-start p-2 font-medium">{currentLang === "ar" ? "الفعلي" : "Actual"}</th>
                                    <th className="text-start p-2 font-medium">{currentLang === "ar" ? "الانحراف" : "Var"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {line.monthlyBreakdown.filter(m => m.planned > 0 || m.actual > 0).map((m, mi) => {
                                    const v = m.actual - m.planned;
                                    return (
                                      <tr key={mi} className="border-t">
                                        <td className="p-2 font-medium">{m.month}</td>
                                        <td className="p-2">{fmt(m.planned)}</td>
                                        <td className="p-2">{fmt(m.actual)}</td>
                                        <td className={`p-2 font-medium ${v > 0 ? "text-destructive" : v < 0 ? "text-primary" : ""}`}>
                                          {v > 0 && <ArrowUpRight className="inline h-3 w-3 me-0.5" />}
                                          {v < 0 && <ArrowDownRight className="inline h-3 w-3 me-0.5" />}
                                          {fmt(Math.abs(v))}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </motion.div>
                  ))}
                </Accordion>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Target className="h-12 w-12 mb-3 opacity-30" />
                  <p>{currentLang === "ar" ? "لا توجد بنود بعد" : "No budget lines yet"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Alerts ═══ */}
        <TabsContent value="alerts">
          {hasAlerts ? (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  {currentLang === "ar" ? "تنبيهات الميزانية" : "Budget Alerts"}
                  {triggeredCount > 0 && <Badge variant="destructive" className="text-[10px]">{triggeredCount}</Badge>}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={alertFilter.status} onValueChange={v => setAlertFilter(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <Filter className="h-3 w-3 me-1" /><SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{currentLang === "ar" ? "كل الحالات" : "All"}</SelectItem>
                      <SelectItem value="triggered">{currentLang === "ar" ? "مُطلق" : "Triggered"}</SelectItem>
                      <SelectItem value="acknowledged">{currentLang === "ar" ? "تم الاطلاع" : "Acknowledged"}</SelectItem>
                      <SelectItem value="resolved">{currentLang === "ar" ? "محلول" : "Resolved"}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={alertFilter.month} onValueChange={v => setAlertFilter(p => ({ ...p, month: v }))}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <Calendar className="h-3 w-3 me-1" /><SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{currentLang === "ar" ? "كل الأشهر" : "All"}</SelectItem>
                      {MONTH_KEYS.map((k, i) => <SelectItem key={k} value={k}>{monthLabels[i]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <AnimatePresence>
                  {filteredAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {filteredAlerts.map((alert, idx) => {
                        const line = lines.find(l => l.id === alert.line_id);
                        return (
                          <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ delay: 0.03 * idx }}
                            className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                              alert.status === "resolved" ? "bg-muted/20 border-border opacity-60" :
                              alert.percent_used > 100 ? "bg-destructive/5 border-destructive/30" :
                              "bg-accent/5 border-accent/30"
                            }`}
                          >
                            <motion.div
                              animate={alert.status === "triggered" ? { scale: [1, 1.15, 1] } : {}}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                                alert.percent_used > 100 ? "bg-destructive/10" : "bg-accent/10"
                              }`}
                            >
                              <AlertTriangle className={`h-5 w-5 ${alert.percent_used > 100 ? "text-destructive" : "text-accent-foreground"}`} />
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{alert.message_ar || `Threshold: ${alert.percent_used}%`}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {alert.period && <span className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3 me-1" />{alert.period}</span>}
                                {line && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {line.line_type === "expense" ? (currentLang === "ar" ? "مصروف" : "Expense") :
                                     line.line_type === "revenue" ? (currentLang === "ar" ? "إيراد" : "Revenue") : "CapEx"}
                                  </Badge>
                                )}
                                <Badge variant={alert.status === "triggered" ? "destructive" : alert.status === "acknowledged" ? "secondary" : "default"} className="text-[10px]">
                                  {alert.status === "triggered" ? (currentLang === "ar" ? "مُطلق" : "Triggered") :
                                   alert.status === "acknowledged" ? (currentLang === "ar" ? "تم الاطلاع" : "Ack") :
                                   (currentLang === "ar" ? "محلول" : "Resolved")}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{new Date(alert.created_at).toLocaleDateString(currentLang === "ar" ? "ar-SA" : "en-US")}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={`text-lg font-bold ${alert.percent_used > 100 ? "text-destructive" : "text-accent-foreground"}`}>
                                {Number(alert.percent_used).toFixed(0)}%
                              </span>
                              {alert.status === "triggered" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAcknowledge(alert.id)}>
                                  <Eye className="h-3 w-3 me-1" />{currentLang === "ar" ? "مراجعة" : "Ack"}
                                </Button>
                              )}
                              {alert.status === "acknowledged" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleResolve(alert.id)}>
                                  <Check className="h-3 w-3 me-1" />{currentLang === "ar" ? "حل" : "Resolve"}
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <CheckCircle className="h-10 w-10 mb-3 opacity-30" />
                      <p>{currentLang === "ar" ? "لا توجد تنبيهات" : "No alerts"}</p>
                      {(alertFilter.status !== "all" || alertFilter.month !== "all") && (
                        <Button variant="link" size="sm" className="mt-2" onClick={() => setAlertFilter({ status: "all", month: "all" })}>
                          {currentLang === "ar" ? "إزالة الفلاتر" : "Clear Filters"}
                        </Button>
                      )}
                    </div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          ) : (
            <FeatureGate featureKey={FEATURE_KEYS.BUDGETS_ALERTS} featureLabel="تنبيهات الميزانية" featureDescription="قم بالترقية إلى الباقة الاحترافية لتفعيل التنبيهات الذكية عند تجاوز حدود الميزانية.">
              <div />
            </FeatureGate>
          )}
        </TabsContent>

        {/* ═══ Reports ═══ */}
        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hasAdvanced ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleExportCSV}>
                  <CardContent className="flex items-center gap-4 py-8">
                    <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Download className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{currentLang === "ar" ? "تصدير CSV / Excel" : "Export CSV / Excel"}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentLang === "ar" ? "تصدير جميع بنود الميزانية مع المخطط والفعلي والانحرافات" : "Export all budget lines with planned, actual, and variance data"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-dashed opacity-60">
                  <CardContent className="flex items-center gap-4 py-8">
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
                      <Download className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {currentLang === "ar" ? "تصدير CSV / Excel" : "Export CSV / Excel"}
                        <Badge variant="secondary" className="text-[10px]">{currentLang === "ar" ? "مؤسسي" : "Enterprise"}</Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentLang === "ar" ? "قم بالترقية لباقة المؤسسات لتصدير البيانات" : "Upgrade to Enterprise to export data"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handlePrint}>
                <CardContent className="flex items-center gap-4 py-8">
                  <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Printer className="h-7 w-7 text-accent-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{currentLang === "ar" ? "طباعة ملخص PDF" : "Print PDF Summary"}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentLang === "ar" ? "طباعة ملخص شامل للميزانية مع الرسوم البيانية" : "Print a comprehensive budget summary with charts"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Summary table for reports */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{currentLang === "ar" ? "ملخص الأداء" : "Performance Summary"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "البند" : "Line"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "النوع" : "Type"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "المخطط" : "Planned"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الفعلي" : "Actual"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الانحراف" : "Variance"}</th>
                          <th className="text-start p-3 font-medium">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineDetails.map((line, idx) => {
                          const v = line.totalPlanned - line.totalActual;
                          return (
                            <tr key={idx} className="border-t">
                              <td className="p-3 font-medium">{(currentLang === "ar" ? line.description_ar : line.description_en) || line.line_type}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-[10px]">
                                  {line.line_type === "expense" ? (currentLang === "ar" ? "مصروف" : "Expense") :
                                   line.line_type === "revenue" ? (currentLang === "ar" ? "إيراد" : "Revenue") : "CapEx"}
                                </Badge>
                              </td>
                              <td className="p-3">{fmt(line.totalPlanned)}</td>
                              <td className="p-3">{fmt(line.totalActual)}</td>
                              <td className={`p-3 font-medium ${v >= 0 ? "text-primary" : "text-destructive"}`}>
                                {v >= 0 ? <ArrowDownRight className="inline h-3 w-3 me-0.5" /> : <ArrowUpRight className="inline h-3 w-3 me-0.5" />}
                                {fmt(Math.abs(v))}
                              </td>
                              <td className="p-3"><PercentBadge pct={line.pct} lang={currentLang} /></td>
                            </tr>
                          );
                        })}
                        {/* Total row */}
                        <tr className="border-t-2 border-primary/20 bg-muted/30 font-semibold">
                          <td className="p-3" colSpan={2}>{currentLang === "ar" ? "الإجمالي" : "Total"}</td>
                          <td className="p-3">{fmt(totals.totalPlanned)}</td>
                          <td className="p-3">{fmt(totals.totalActual)}</td>
                          <td className={`p-3 ${totals.variance >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(Math.abs(totals.variance))}</td>
                          <td className="p-3"><PercentBadge pct={totals.pct} lang={currentLang} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetDetailPage;
