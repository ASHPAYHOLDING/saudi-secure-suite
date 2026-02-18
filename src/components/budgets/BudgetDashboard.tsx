import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadialBarChart, RadialBar,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target,
  DollarSign, ArrowUpRight, ArrowDownRight, Plus, Calendar, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Budget {
  id: string;
  tenant_id: string;
  fiscal_year: number;
  name_ar: string;
  name_en: string | null;
  currency: string;
  status: string;
  version: number;
  created_by: string;
  created_at: string;
}

interface BudgetLine {
  id: string;
  budget_id: string;
  line_type: string;
  description_ar: string | null;
  description_en: string | null;
  period_type: string;
  months: Record<string, number> | null;
  planned_amount: number;
  department_id: string | null;
  cost_center_id: string | null;
}

interface BudgetActual {
  line_id: string;
  period: string;
  actual_amount: number;
}

interface AlertEvent {
  id: string;
  budget_id: string;
  line_id: string | null;
  period: string | null;
  percent_used: number;
  status: string;
  message_ar: string | null;
  created_at: string;
}

const MONTH_LABELS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTH_LABELS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const COLORS = {
  revenue: "hsl(var(--chart-1))",
  expense: "hsl(var(--chart-2))",
  capex: "hsl(var(--chart-3))",
  planned: "hsl(var(--chart-4))",
  actual: "hsl(var(--chart-5))",
};

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const STATUS_MAP: Record<string, { label_ar: string; label_en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label_ar: "مسودة", label_en: "Draft", variant: "secondary" },
  active: { label_ar: "نشطة", label_en: "Active", variant: "default" },
  locked: { label_ar: "مقفلة", label_en: "Locked", variant: "outline" },
  archived: { label_ar: "مؤرشفة", label_en: "Archived", variant: "destructive" },
};

const BudgetDashboard = () => {
  const { t, isRTL, currentLang } = useLanguage();
  const { tenantId, user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [actuals, setActuals] = useState<BudgetActual[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({ name_ar: "", fiscal_year: new Date().getFullYear() });

  const monthLabels = currentLang === "ar" ? MONTH_LABELS_AR : MONTH_LABELS_EN;

  // Fetch budgets
  useEffect(() => {
    if (!tenantId) return;
    const fetchBudgets = async () => {
      const { data } = await supabase
        .from("budgets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("fiscal_year", { ascending: false });
      if (data && data.length > 0) {
        setBudgets(data as Budget[]);
        setSelectedBudgetId(data[0].id);
      }
      setLoading(false);
    };
    fetchBudgets();
  }, [tenantId]);

  // Fetch lines + actuals + alerts when budget changes
  useEffect(() => {
    if (!selectedBudgetId || !tenantId) return;
    const fetchData = async () => {
      const [linesRes, actualsRes, alertsRes] = await Promise.all([
        supabase.from("budget_lines").select("*").eq("budget_id", selectedBudgetId),
        supabase.from("budget_actuals_cache").select("*").eq("budget_id", selectedBudgetId),
        supabase.from("budget_alert_events").select("*").eq("budget_id", selectedBudgetId).order("created_at", { ascending: false }).limit(20),
      ]);
      setLines((linesRes.data || []) as BudgetLine[]);
      setActuals((actualsRes.data || []) as BudgetActual[]);
      setAlerts((alertsRes.data || []) as AlertEvent[]);
    };
    fetchData();
  }, [selectedBudgetId, tenantId]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedBudgetId) return;
    const channel = supabase
      .channel(`budget-${selectedBudgetId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_actuals_cache", filter: `budget_id=eq.${selectedBudgetId}` }, () => {
        supabase.from("budget_actuals_cache").select("*").eq("budget_id", selectedBudgetId).then(({ data }) => setActuals((data || []) as BudgetActual[]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_alert_events", filter: `budget_id=eq.${selectedBudgetId}` }, () => {
        supabase.from("budget_alert_events").select("*").eq("budget_id", selectedBudgetId).order("created_at", { ascending: false }).limit(20).then(({ data }) => setAlerts((data || []) as AlertEvent[]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedBudgetId]);

  const selectedBudget = budgets.find(b => b.id === selectedBudgetId);

  // Compute totals
  const totals = useMemo(() => {
    let totalPlanned = 0;
    let totalActual = 0;
    let revenuesPlanned = 0, expensesPlanned = 0, capexPlanned = 0;
    let revenuesActual = 0, expensesActual = 0, capexActual = 0;

    for (const line of lines) {
      const linePlanned = line.period_type === "monthly" && line.months
        ? Object.values(line.months).reduce((s, v) => s + (Number(v) || 0), 0)
        : Number(line.planned_amount) || 0;

      const lineActual = actuals
        .filter(a => a.line_id === line.id)
        .reduce((s, a) => s + Number(a.actual_amount), 0);

      totalPlanned += linePlanned;
      totalActual += lineActual;

      if (line.line_type === "revenue") { revenuesPlanned += linePlanned; revenuesActual += lineActual; }
      else if (line.line_type === "expense") { expensesPlanned += linePlanned; expensesActual += lineActual; }
      else { capexPlanned += linePlanned; capexActual += lineActual; }
    }

    const variance = totalPlanned - totalActual;
    const variancePercent = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100) : 0;

    return { totalPlanned, totalActual, variance, variancePercent, revenuesPlanned, expensesPlanned, capexPlanned, revenuesActual, expensesActual, capexActual };
  }, [lines, actuals]);

  // Monthly comparison data
  const monthlyData = useMemo(() => {
    return MONTH_KEYS.map((key, idx) => {
      let planned = 0;
      let actual = 0;
      for (const line of lines) {
        if (line.period_type === "monthly" && line.months) {
          planned += Number(line.months[key]) || 0;
        }
        const lineActuals = actuals.filter(a => a.line_id === line.id && a.period?.endsWith(`-${key}`));
        actual += lineActuals.reduce((s, a) => s + Number(a.actual_amount), 0);
      }
      return { month: monthLabels[idx], planned, actual, variance: planned - actual };
    });
  }, [lines, actuals, monthLabels]);

  // Pie data by type
  const pieData = useMemo(() => [
    { name: currentLang === "ar" ? "إيرادات" : "Revenue", value: totals.revenuesPlanned, color: PIE_COLORS[0] },
    { name: currentLang === "ar" ? "مصروفات" : "Expenses", value: totals.expensesPlanned, color: PIE_COLORS[1] },
    { name: currentLang === "ar" ? "رأسمالية" : "CapEx", value: totals.capexPlanned, color: PIE_COLORS[2] },
  ].filter(d => d.value > 0), [totals, currentLang]);

  // Variance by line for analysis
  const lineVarianceData = useMemo(() => {
    return lines.map(line => {
      const linePlanned = line.period_type === "monthly" && line.months
        ? Object.values(line.months).reduce((s, v) => s + (Number(v) || 0), 0)
        : Number(line.planned_amount) || 0;
      const lineActual = actuals.filter(a => a.line_id === line.id).reduce((s, a) => s + Number(a.actual_amount), 0);
      const variance = linePlanned - lineActual;
      const pct = linePlanned > 0 ? (lineActual / linePlanned) * 100 : 0;
      return {
        name: (currentLang === "ar" ? line.description_ar : line.description_en) || line.line_type,
        planned: linePlanned,
        actual: lineActual,
        variance,
        pct: Math.round(pct),
      };
    }).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [lines, actuals, currentLang]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(currentLang === "ar" ? "ar-SA" : "en-SA", { style: "currency", currency: selectedBudget?.currency || "SAR", minimumFractionDigits: 0 }).format(val);
  };

  const handleCreateBudget = async () => {
    if (!tenantId || !user) return;
    const { data, error } = await supabase.from("budgets").insert({
      tenant_id: tenantId,
      fiscal_year: newBudget.fiscal_year,
      name_ar: newBudget.name_ar || `ميزانية ${newBudget.fiscal_year}`,
      created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      setBudgets(prev => [data as Budget, ...prev]);
      setSelectedBudgetId(data.id);
      setCreateOpen(false);
      setNewBudget({ name_ar: "", fiscal_year: new Date().getFullYear() });
      toast.success(currentLang === "ar" ? "تم إنشاء الميزانية بنجاح" : "Budget created successfully");
    }
  };

  const handleActivate = async () => {
    if (!selectedBudgetId) return;
    const { data, error } = await supabase.rpc("activate_budget", { p_budget_id: selectedBudgetId });
    if (error) { toast.error(error.message); return; }
    const result = data as { success: boolean; message?: string; error?: string };
    if (result?.success) {
      toast.success(result.message || "Done");
      // Refresh budgets
      const { data: refreshed } = await supabase.from("budgets").select("*").eq("tenant_id", tenantId!).order("fiscal_year", { ascending: false });
      if (refreshed) setBudgets(refreshed as Budget[]);
    } else {
      toast.error(result?.error || "Error");
    }
  };

  const handleSyncActuals = async () => {
    if (!tenantId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc("sync_budget_actuals_for_tenant", { p_tenant_id: tenantId });
      if (error) { toast.error(error.message); return; }
      const result = data as { success: boolean; records_updated?: number };
      if (result?.success) {
        toast.success(currentLang === "ar" ? `تم مزامنة ${result.records_updated} سجل` : `Synced ${result.records_updated} records`);
        // Refresh actuals
        if (selectedBudgetId) {
          const { data: refreshedActuals } = await supabase.from("budget_actuals_cache").select("*").eq("budget_id", selectedBudgetId);
          setActuals((refreshedActuals || []) as BudgetActual[]);
          const { data: refreshedAlerts } = await supabase.from("budget_alert_events").select("*").eq("budget_id", selectedBudgetId).order("created_at", { ascending: false }).limit(20);
          setAlerts((refreshedAlerts || []) as AlertEvent[]);
        }
      }
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{currentLang === "ar" ? "لوحة الميزانية" : "Budget Dashboard"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentLang === "ar" ? "مراقبة الأداء المالي ومقارنة المخطط بالفعلي" : "Monitor financial performance and planned vs actual comparison"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {budgets.length > 0 && (
            <Select value={selectedBudgetId} onValueChange={setSelectedBudgetId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {budgets.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {currentLang === "ar" ? b.name_ar : (b.name_en || b.name_ar)} ({b.fiscal_year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {selectedBudget && selectedBudget.status === "draft" && (
            <Button variant="outline" onClick={handleActivate} size="sm">
              <CheckCircle className="h-4 w-4 me-1" />
              {currentLang === "ar" ? "تفعيل" : "Activate"}
            </Button>
          )}
          {selectedBudget && (
            <Button variant="outline" onClick={handleSyncActuals} size="sm" disabled={syncing}>
              <RefreshCw className={`h-4 w-4 me-1 ${syncing ? "animate-spin" : ""}`} />
              {currentLang === "ar" ? "مزامنة الفعلي" : "Sync Actuals"}
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 me-1" />{currentLang === "ar" ? "ميزانية جديدة" : "New Budget"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{currentLang === "ar" ? "إنشاء ميزانية جديدة" : "Create New Budget"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>{currentLang === "ar" ? "اسم الميزانية" : "Budget Name"}</Label>
                  <Input value={newBudget.name_ar} onChange={e => setNewBudget(p => ({ ...p, name_ar: e.target.value }))} placeholder={`ميزانية ${newBudget.fiscal_year}`} />
                </div>
                <div>
                  <Label>{currentLang === "ar" ? "السنة المالية" : "Fiscal Year"}</Label>
                  <Input type="number" value={newBudget.fiscal_year} onChange={e => setNewBudget(p => ({ ...p, fiscal_year: parseInt(e.target.value) }))} />
                </div>
                <Button onClick={handleCreateBudget} className="w-full">{currentLang === "ar" ? "إنشاء" : "Create"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Status Badge */}
      {selectedBudget && (
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_MAP[selectedBudget.status]?.variant || "secondary"}>
            {currentLang === "ar" ? STATUS_MAP[selectedBudget.status]?.label_ar : STATUS_MAP[selectedBudget.status]?.label_en}
          </Badge>
          <span className="text-sm text-muted-foreground">
            <Calendar className="inline h-3.5 w-3.5 me-1" />
            {selectedBudget.fiscal_year} • v{selectedBudget.version}
          </span>
        </div>
      )}

      {budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {currentLang === "ar" ? "لا توجد ميزانيات" : "No Budgets Yet"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {currentLang === "ar" ? "أنشئ ميزانيتك الأولى لبدء تتبع الأداء المالي" : "Create your first budget to start tracking financial performance"}
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 me-1" />{currentLang === "ar" ? "إنشاء ميزانية" : "Create Budget"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{currentLang === "ar" ? "المخطط الكلي" : "Total Planned"}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.totalPlanned)}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{currentLang === "ar" ? "الفعلي" : "Total Actual"}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totals.totalActual)}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{currentLang === "ar" ? "الانحراف" : "Variance"}</p>
                    <p className={`text-2xl font-bold mt-1 ${totals.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(Math.abs(totals.variance))}
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${totals.variance >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                    {totals.variance >= 0 ? <TrendingDown className="h-6 w-6 text-green-600" /> : <TrendingUp className="h-6 w-6 text-red-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{currentLang === "ar" ? "نسبة الاستهلاك" : "Utilization %"}</p>
                    <p className={`text-2xl font-bold mt-1 ${totals.variancePercent > 100 ? "text-red-600" : totals.variancePercent > 80 ? "text-amber-600" : "text-foreground"}`}>
                      {totals.variancePercent.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${totals.variancePercent > 100 ? "bg-red-100" : totals.variancePercent > 80 ? "bg-amber-100" : "bg-primary/10"}`}>
                    {totals.variancePercent > 100 ? <AlertTriangle className="h-6 w-6 text-red-600" /> : <CheckCircle className="h-6 w-6 text-primary" />}
                  </div>
                </div>
                <Progress value={Math.min(totals.variancePercent, 100)} className="mt-3 h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Charts Tabs */}
          <Tabs defaultValue="comparison" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 max-w-lg">
              <TabsTrigger value="comparison">{currentLang === "ar" ? "مقارنة شهرية" : "Monthly"}</TabsTrigger>
              <TabsTrigger value="breakdown">{currentLang === "ar" ? "التوزيع" : "Breakdown"}</TabsTrigger>
              <TabsTrigger value="variance">{currentLang === "ar" ? "الانحرافات" : "Variance"}</TabsTrigger>
              <TabsTrigger value="alerts">{currentLang === "ar" ? "التنبيهات" : "Alerts"}</TabsTrigger>
            </TabsList>

            {/* Monthly Comparison */}
            <TabsContent value="comparison">
              <Card>
                <CardHeader>
                  <CardTitle>{currentLang === "ar" ? "المخطط مقابل الفعلي — شهري" : "Planned vs Actual — Monthly"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar dataKey="planned" name={currentLang === "ar" ? "المخطط" : "Planned"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name={currentLang === "ar" ? "الفعلي" : "Actual"} fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Monthly Detail Table */}
                  <div className="border rounded-lg overflow-hidden mt-6">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الشهر" : "Month"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "المخطط" : "Planned"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الفعلي" : "Actual"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الانحراف" : "Variance"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "النسبة" : "Var %"}</th>
                          <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الحالة" : "Status"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.map((row, idx) => {
                          const pct = row.planned > 0 ? (row.actual / row.planned) * 100 : 0;
                          const varianceAmt = row.actual - row.planned;
                          return (
                            <tr key={idx} className="border-t">
                              <td className="p-3 font-medium">{row.month}</td>
                              <td className="p-3">{formatCurrency(row.planned)}</td>
                              <td className="p-3">{formatCurrency(row.actual)}</td>
                              <td className={`p-3 font-medium ${varianceAmt > 0 ? "text-destructive" : varianceAmt < 0 ? "text-primary" : ""}`}>
                                {varianceAmt > 0 && <ArrowUpRight className="inline h-3.5 w-3.5 me-1" />}
                                {varianceAmt < 0 && <ArrowDownRight className="inline h-3.5 w-3.5 me-1" />}
                                {formatCurrency(Math.abs(varianceAmt))}
                              </td>
                              <td className="p-3">{pct.toFixed(1)}%</td>
                              <td className="p-3">
                                <Badge variant={pct > 100 ? "destructive" : pct > 80 ? "secondary" : "default"} className="text-[10px]">
                                  {pct > 100 ? (currentLang === "ar" ? "تجاوز" : "Over") :
                                   pct > 80 ? (currentLang === "ar" ? "تحذير" : "Warning") :
                                   pct > 0 ? (currentLang === "ar" ? "طبيعي" : "Normal") :
                                   (currentLang === "ar" ? "لا يوجد" : "None")}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Breakdown Pie */}
            <TabsContent value="breakdown">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{currentLang === "ar" ? "توزيع الميزانية حسب النوع" : "Budget Distribution by Type"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {pieData.map((entry, idx) => (<Cell key={idx} fill={entry.color} />))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                        {currentLang === "ar" ? "لا توجد بنود بعد" : "No budget lines yet"}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{currentLang === "ar" ? "مقارنة بالنوع" : "Comparison by Type"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    {[
                      { label: currentLang === "ar" ? "إيرادات" : "Revenue", planned: totals.revenuesPlanned, actual: totals.revenuesActual },
                      { label: currentLang === "ar" ? "مصروفات" : "Expenses", planned: totals.expensesPlanned, actual: totals.expensesActual },
                      { label: currentLang === "ar" ? "رأسمالية" : "CapEx", planned: totals.capexPlanned, actual: totals.capexActual },
                    ].map((item, idx) => {
                      const pct = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-foreground">{item.label}</span>
                            <span className="text-muted-foreground">{formatCurrency(item.actual)} / {formatCurrency(item.planned)}</span>
                          </div>
                          <Progress value={Math.min(pct, 100)} className="h-3" />
                          <p className={`text-xs ${pct > 100 ? "text-red-500" : pct > 80 ? "text-amber-500" : "text-muted-foreground"}`}>
                            {pct.toFixed(1)}% {currentLang === "ar" ? "مستهلك" : "utilized"}
                          </p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Variance Analysis */}
            <TabsContent value="variance">
              <Card>
                <CardHeader>
                  <CardTitle>{currentLang === "ar" ? "تحليل الانحرافات حسب البند" : "Variance Analysis by Line"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {lineVarianceData.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={lineVarianceData.slice(0, 10)} layout="vertical" barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Legend />
                          <Bar dataKey="planned" name={currentLang === "ar" ? "المخطط" : "Planned"} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="actual" name={currentLang === "ar" ? "الفعلي" : "Actual"} fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-start p-3 font-medium">{currentLang === "ar" ? "البند" : "Line"}</th>
                              <th className="text-start p-3 font-medium">{currentLang === "ar" ? "المخطط" : "Planned"}</th>
                              <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الفعلي" : "Actual"}</th>
                              <th className="text-start p-3 font-medium">{currentLang === "ar" ? "الانحراف" : "Variance"}</th>
                              <th className="text-start p-3 font-medium">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineVarianceData.map((row, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-3">{row.name}</td>
                                <td className="p-3">{formatCurrency(row.planned)}</td>
                                <td className="p-3">{formatCurrency(row.actual)}</td>
                                <td className={`p-3 font-medium ${row.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {row.variance >= 0 ? <ArrowDownRight className="inline h-3.5 w-3.5 me-1" /> : <ArrowUpRight className="inline h-3.5 w-3.5 me-1" />}
                                  {formatCurrency(Math.abs(row.variance))}
                                </td>
                                <td className={`p-3 ${row.pct > 100 ? "text-red-600 font-bold" : row.pct > 80 ? "text-amber-600" : ""}`}>{row.pct}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                      {currentLang === "ar" ? "لا توجد بنود لتحليل الانحرافات" : "No lines for variance analysis"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Alerts */}
            <TabsContent value="alerts">
              <Card>
                <CardHeader>
                  <CardTitle>{currentLang === "ar" ? "تنبيهات الميزانية" : "Budget Alerts"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {alerts.length > 0 ? (
                    <div className="space-y-3">
                      {alerts.map(alert => (
                        <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-lg border ${alert.percent_used > 100 ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" : alert.percent_used > 80 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-muted/30 border-border"}`}>
                          {alert.percent_used > 100 ? (
                            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{alert.message_ar || `${currentLang === "ar" ? "تجاوز الحد" : "Threshold exceeded"}: ${alert.percent_used}%`}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {alert.period && `${currentLang === "ar" ? "الفترة" : "Period"}: ${alert.period}`}
                              {" • "}
                              <Badge variant={alert.status === "triggered" ? "destructive" : alert.status === "acknowledged" ? "secondary" : "default"} className="text-[10px]">
                                {alert.status === "triggered" ? (currentLang === "ar" ? "مُطلق" : "Triggered") :
                                 alert.status === "acknowledged" ? (currentLang === "ar" ? "تم الاطلاع" : "Acknowledged") :
                                 (currentLang === "ar" ? "محلول" : "Resolved")}
                              </Badge>
                            </p>
                          </div>
                          <span className={`text-lg font-bold ${alert.percent_used > 100 ? "text-red-600" : "text-amber-600"}`}>
                            {Number(alert.percent_used).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <CheckCircle className="h-10 w-10 mb-3 text-green-500/50" />
                      <p>{currentLang === "ar" ? "لا توجد تنبيهات حالياً" : "No alerts currently"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default BudgetDashboard;
