import { useState, useEffect } from "react";
import { Info, Database, Clock, Calculator, ExternalLink, Loader2, Table2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";

interface ExplainKPIProps {
  /** The metric_key from analytics_definitions, e.g. "revenue", "net_profit" */
  metricKey: string;
  /** Human-readable period label shown in the explanation */
  periodLabel?: string;
  /** Extra drilldown routes */
  drilldownRoutes?: { label: string; path: string }[];
}

interface AnalyticsDef {
  metric_key: string;
  name_ar: string;
  name_en: string | null;
  category: string;
  formula_description: string | null;
  sql_source: string;
  depends_on_tables: string[];
  updated_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  invoices: "الفواتير",
  invoice_items: "بنود الفواتير",
  expenses: "المصروفات",
  expense_categories: "تصنيفات المصروفات",
  journal_entries: "القيود اليومية",
  journal_entry_lines: "سطور القيود",
  subscriptions: "الاشتراكات",
  subscription_plans: "خطط الاشتراك",
  wallet_transactions: "معاملات المحفظة",
  tenant_wallets: "محافظ المستأجرين",
  purchase_orders: "أوامر الشراء",
  customers: "العملاء",
  budgets: "الميزانيات",
  budget_lines: "بنود الميزانيات",
};

const CATEGORY_LABELS: Record<string, string> = {
  financial: "مالي",
  operational: "تشغيلي",
  tax: "ضريبي",
};

// Cache definitions to avoid re-fetching
let defsCache: AnalyticsDef[] | null = null;

const ExplainKPI = ({ metricKey, periodLabel, drilldownRoutes }: ExplainKPIProps) => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [def, setDef] = useState<AnalyticsDef | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (def?.metric_key === metricKey) return;

    const load = async () => {
      // Check cache first
      if (defsCache) {
        const found = defsCache.find((d) => d.metric_key === metricKey);
        if (found) { setDef(found); setNotFound(false); return; }
      }

      setLoading(true);
      const { data } = await supabase
        .from("analytics_definitions")
        .select("*")
        .eq("is_active", true);

      if (data) {
        defsCache = data as AnalyticsDef[];
        const found = data.find((d: any) => d.metric_key === metricKey);
        if (found) { setDef(found as AnalyticsDef); setNotFound(false); }
        else setNotFound(true);
      }
      setLoading(false);
    };
    load();
  }, [open, metricKey, def]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full opacity-40 hover:opacity-100 transition-opacity"
          title={isRTL ? "اشرح هذا الرقم" : "Explain this number"}
        >
          <Info className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        className="w-80 p-0"
        align="start"
        side="bottom"
      >
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : notFound ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            لم يتم العثور على تعريف لهذا المؤشر
          </div>
        ) : def ? (
          <div className="space-y-0">
            {/* Header */}
            <div className="p-3 bg-primary/5 border-b border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">{def.name_ar}</h4>
                <Badge variant="outline" className="text-[9px] h-4">
                  {CATEGORY_LABELS[def.category] || def.category}
                </Badge>
              </div>
              {def.name_en && (
                <p className="text-[10px] text-muted-foreground font-english mt-0.5">{def.name_en}</p>
              )}
            </div>

            {/* Formula */}
            {def.formula_description && (
              <div className="p-3 space-y-1 border-b border-border">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                  <Calculator className="h-3 w-3" />
                  {isRTL ? "المعادلة" : "Formula"}
                </div>
                <p className="text-xs text-foreground font-mono bg-muted/40 rounded px-2 py-1.5 leading-relaxed">
                  {def.formula_description}
                </p>
              </div>
            )}

            {/* Source tables */}
            <div className="p-3 space-y-1.5 border-b border-border">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                <Table2 className="h-3 w-3" />
                {isRTL ? "الجداول المصدر" : "Source Tables"}
              </div>
              <div className="flex flex-wrap gap-1">
                {def.depends_on_tables.map((table) => (
                  <Badge key={table} variant="secondary" className="text-[9px] gap-0.5 font-mono">
                    <Database className="h-2.5 w-2.5" />
                    {TABLE_LABELS[table] || table}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                المصدر: <span className="font-english font-mono">{def.sql_source}</span>
              </p>
            </div>

            {/* Period & Last update */}
            <div className="p-3 space-y-1.5 border-b border-border">
              {periodLabel && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground text-[10px]">{isRTL ? "الفترة:" : "Period:"}</span>
                  <span className="text-foreground text-[10px] font-medium">{periodLabel}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground text-[10px]">{isRTL ? "آخر تحديث للتعريف:" : "Last updated:"}</span>
                <span className="text-foreground text-[10px] font-english">
                  {new Date(def.updated_at).toLocaleDateString("ar-SA")}
                </span>
              </div>
            </div>

            {/* Drilldown links */}
            {drilldownRoutes && drilldownRoutes.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">
                  <ExternalLink className="h-3 w-3" />
                  {isRTL ? "التنقل التفصيلي" : "Drill Down"}
                </div>
                <div className="flex flex-wrap gap-1">
                  {drilldownRoutes.map((route) => (
                    <Button
                      key={route.path}
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 gap-1"
                      onClick={() => { setOpen(false); navigate(route.path); }}
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {route.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
};

export default ExplainKPI;
