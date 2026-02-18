import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { useCountUp } from "@/hooks/useCountUp";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Calendar, TrendingUp, ArrowRight, ArrowLeft,
  BarChart3, Wallet, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface BudgetSummary {
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
  total_planned: number;
  total_actual: number;
}

const STATUS_CONFIG: Record<string, { ar: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { ar: "مسودة", en: "Draft", variant: "secondary" },
  active: { ar: "نشطة", en: "Active", variant: "default" },
  locked: { ar: "مقفلة", en: "Locked", variant: "outline" },
  archived: { ar: "مؤرشفة", en: "Archived", variant: "destructive" },
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function AnimatedCurrency({ value, currency, lang }: { value: number; currency: string; lang: string }) {
  const animated = useCountUp(value, 900);
  return (
    <span>
      {new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", {
        style: "currency", currency, minimumFractionDigits: 0,
      }).format(animated)}
    </span>
  );
}

const BudgetListPage = () => {
  const { currentLang, isRTL } = useLanguage();
  const { tenantId, user } = useAuth();
  const navigate = useNavigate();

  const [budgets, setBudgets] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBudget, setNewBudget] = useState({ name_ar: "", fiscal_year: new Date().getFullYear() });
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!tenantId) return;
    const fetch = async () => {
      // Fetch budgets with aggregated totals
      const { data: budgetsData } = await supabase
        .from("budgets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("fiscal_year", { ascending: false });

      if (!budgetsData || budgetsData.length === 0) {
        setBudgets([]);
        setLoading(false);
        return;
      }

      // Fetch all lines and actuals for totals
      const budgetIds = budgetsData.map(b => b.id);
      const [linesRes, actualsRes] = await Promise.all([
        supabase.from("budget_lines").select("budget_id, planned_amount, period_type, months").in("budget_id", budgetIds),
        supabase.from("budget_actuals_cache").select("budget_id, actual_amount").in("budget_id", budgetIds),
      ]);

      const lineTotals: Record<string, number> = {};
      const actualTotals: Record<string, number> = {};

      for (const line of (linesRes.data || [])) {
        const planned = line.period_type === "monthly" && line.months
          ? Object.values(line.months as Record<string, number>).reduce((s, v) => s + (Number(v) || 0), 0)
          : Number(line.planned_amount) || 0;
        lineTotals[line.budget_id] = (lineTotals[line.budget_id] || 0) + planned;
      }

      for (const actual of (actualsRes.data || [])) {
        actualTotals[actual.budget_id] = (actualTotals[actual.budget_id] || 0) + Number(actual.actual_amount);
      }

      const enriched: BudgetSummary[] = budgetsData.map(b => ({
        ...b,
        total_planned: lineTotals[b.id] || 0,
        total_actual: actualTotals[b.id] || 0,
      }));

      setBudgets(enriched);
      setLoading(false);
    };
    fetch();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId || !user) return;
    const { data, error } = await supabase.from("budgets").insert({
      tenant_id: tenantId,
      fiscal_year: newBudget.fiscal_year,
      name_ar: newBudget.name_ar || `ميزانية ${newBudget.fiscal_year}`,
      created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      toast.success(currentLang === "ar" ? "تم إنشاء الميزانية بنجاح" : "Budget created");
      navigate(`/dashboard/budgets/${data.id}`);
    }
  };

  const years = [...new Set(budgets.map(b => b.fiscal_year))].sort((a, b) => b - a);

  const filtered = budgets.filter(b => {
    if (filterYear !== "all" && b.fiscal_year !== parseInt(filterYear)) return false;
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    return true;
  });

  const NavArrow = isRTL ? ArrowLeft : ArrowRight;

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
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            {currentLang === "ar" ? "إدارة الميزانيات" : "Budget Management"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentLang === "ar" ? "تتبع ومراقبة الأداء المالي للمنشأة" : "Track and monitor organizational financial performance"}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {currentLang === "ar" ? "ميزانية جديدة" : "New Budget"}
            </Button>
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
              <Button onClick={handleCreate} className="w-full">{currentLang === "ar" ? "إنشاء" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap items-center gap-3"
      >
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[140px] h-9">
            <Calendar className="h-3.5 w-3.5 me-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{currentLang === "ar" ? "كل السنوات" : "All Years"}</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{currentLang === "ar" ? "كل الحالات" : "All Status"}</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{currentLang === "ar" ? v.ar : v.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ms-auto">
          {filtered.length} {currentLang === "ar" ? "ميزانية" : "budget(s)"}
        </span>
      </motion.div>

      {/* Budget Cards */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Target className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {currentLang === "ar" ? "لا توجد ميزانيات" : "No Budgets Yet"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
                {currentLang === "ar" ? "أنشئ ميزانيتك الأولى لبدء تتبع الأداء المالي" : "Create your first budget to start tracking performance"}
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 me-1" />{currentLang === "ar" ? "إنشاء ميزانية" : "Create Budget"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {filtered.map(budget => {
              const pct = budget.total_planned > 0 ? (budget.total_actual / budget.total_planned) * 100 : 0;
              const variance = budget.total_planned - budget.total_actual;
              const statusCfg = STATUS_CONFIG[budget.status] || STATUS_CONFIG.draft;

              return (
                <motion.div key={budget.id} variants={cardVariants} layout>
                  <Card
                    className="group cursor-pointer border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-300 overflow-hidden"
                    onClick={() => navigate(`/dashboard/budgets/${budget.id}`)}
                  >
                    {/* Top accent bar */}
                    <div className={`h-1 w-full ${
                      budget.status === "active" ? "bg-primary" :
                      budget.status === "archived" ? "bg-muted-foreground/30" :
                      budget.status === "locked" ? "bg-accent" : "bg-muted"
                    }`} />

                    <CardContent className="p-5 space-y-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate text-base">
                            {currentLang === "ar" ? budget.name_ar : (budget.name_en || budget.name_ar)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant={statusCfg.variant} className="text-[10px]">
                              {currentLang === "ar" ? statusCfg.ar : statusCfg.en}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {budget.fiscal_year}
                            </span>
                          </div>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <BarChart3 className="h-5 w-5 text-primary" />
                        </div>
                      </div>

                      {/* Financial summary */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">{currentLang === "ar" ? "المخطط" : "Planned"}</p>
                          <p className="text-sm font-semibold text-foreground">
                            <AnimatedCurrency value={budget.total_planned} currency={budget.currency} lang={currentLang} />
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">{currentLang === "ar" ? "الفعلي" : "Actual"}</p>
                          <p className="text-sm font-semibold text-foreground">
                            <AnimatedCurrency value={budget.total_actual} currency={budget.currency} lang={currentLang} />
                          </p>
                        </div>
                      </div>

                      {/* Progress + utilization */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{currentLang === "ar" ? "نسبة الاستهلاك" : "Utilization"}</span>
                          <span className={`font-semibold ${
                            pct > 100 ? "text-destructive" : pct > 80 ? "text-accent-foreground" : "text-primary"
                          }`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                          style={{ transformOrigin: isRTL ? "right" : "left" }}
                        >
                          <Progress value={Math.min(pct, 100)} className="h-2" />
                        </motion.div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="h-3 w-3" />
                          <span>{currentLang === "ar" ? "الانحراف" : "Var"}:</span>
                          <span className={`font-medium ${variance >= 0 ? "text-primary" : "text-destructive"}`}>
                            {new Intl.NumberFormat(currentLang === "ar" ? "ar-SA" : "en-SA", {
                              style: "currency", currency: budget.currency, minimumFractionDigits: 0, notation: "compact",
                            }).format(Math.abs(variance))}
                          </span>
                        </div>
                        <NavArrow className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

export default BudgetListPage;
