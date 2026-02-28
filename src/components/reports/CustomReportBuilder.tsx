import { useState, useEffect, useCallback, useRef } from "react";
import { fmtNumber } from "@/lib/formatters";
import {
  ArrowLeft, Plus, Trash2, Download, Save, Loader2, Play,
  Columns3, Filter, Group, Calendar, SortAsc, SortDesc,
  FileSpreadsheet, Printer, Bookmark, BookmarkCheck, Share2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { toast } from "sonner";
import { exportReportPDF, exportReportExcel } from "@/lib/report-export";

// View definitions with columns metadata
interface ViewDef {
  key: string;
  nameAr: string;
  nameEn: string;
  columns: { key: string; nameAr: string; nameEn: string; type: "text" | "number" | "date" | "uuid" }[];
}

const ANALYTICS_VIEWS: ViewDef[] = [
  {
    key: "profit_loss_view",
    nameAr: "الأرباح والخسائر",
    nameEn: "Profit & Loss",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "period", nameAr: "الفترة", nameEn: "Period", type: "date" },
      { key: "category", nameAr: "التصنيف", nameEn: "Category", type: "text" },
      { key: "revenue", nameAr: "الإيرادات", nameEn: "Revenue", type: "number" },
      { key: "expenses", nameAr: "المصروفات", nameEn: "Expenses", type: "number" },
      { key: "net_profit", nameAr: "صافي الربح", nameEn: "Net Profit", type: "number" },
    ],
  },
  {
    key: "balance_sheet_view",
    nameAr: "الميزانية العمومية",
    nameEn: "Balance Sheet",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "category", nameAr: "التصنيف", nameEn: "Category", type: "text" },
      { key: "account_name", nameAr: "اسم الحساب", nameEn: "Account", type: "text" },
      { key: "total_debit", nameAr: "مدين", nameEn: "Debit", type: "number" },
      { key: "total_credit", nameAr: "دائن", nameEn: "Credit", type: "number" },
      { key: "balance", nameAr: "الرصيد", nameEn: "Balance", type: "number" },
    ],
  },
  {
    key: "revenue_summary_view",
    nameAr: "ملخص الإيرادات",
    nameEn: "Revenue Summary",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "period", nameAr: "الفترة", nameEn: "Period", type: "date" },
      { key: "account_name", nameAr: "الحساب", nameEn: "Account", type: "text" },
      { key: "total_credit", nameAr: "دائن", nameEn: "Credit", type: "number" },
      { key: "total_debit", nameAr: "مدين", nameEn: "Debit", type: "number" },
      { key: "net_revenue", nameAr: "صافي الإيراد", nameEn: "Net Revenue", type: "number" },
    ],
  },
  {
    key: "expense_summary_view",
    nameAr: "ملخص المصروفات",
    nameEn: "Expense Summary",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "period", nameAr: "الفترة", nameEn: "Period", type: "date" },
      { key: "account_name", nameAr: "الحساب", nameEn: "Account", type: "text" },
      { key: "source_type", nameAr: "نوع المصدر", nameEn: "Source", type: "text" },
      { key: "total_debit", nameAr: "مدين", nameEn: "Debit", type: "number" },
      { key: "total_credit", nameAr: "دائن", nameEn: "Credit", type: "number" },
      { key: "net_expense", nameAr: "صافي المصروف", nameEn: "Net Expense", type: "number" },
    ],
  },
  {
    key: "cashflow_view",
    nameAr: "التدفقات النقدية",
    nameEn: "Cash Flow",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "period", nameAr: "الفترة", nameEn: "Period", type: "date" },
      { key: "source_type", nameAr: "نوع المصدر", nameEn: "Source", type: "text" },
      { key: "cash_in", nameAr: "تدفق داخل", nameEn: "Cash In", type: "number" },
      { key: "cash_out", nameAr: "تدفق خارج", nameEn: "Cash Out", type: "number" },
      { key: "net_cash", nameAr: "صافي النقد", nameEn: "Net Cash", type: "number" },
    ],
  },
  {
    key: "vat_summary_view",
    nameAr: "ملخص الضريبة",
    nameEn: "VAT Summary",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "period", nameAr: "الفترة", nameEn: "Period", type: "date" },
      { key: "account_name", nameAr: "الحساب", nameEn: "Account", type: "text" },
      { key: "source_type", nameAr: "نوع المصدر", nameEn: "Source", type: "text" },
      { key: "vat_input", nameAr: "ضريبة مدخلات", nameEn: "VAT Input", type: "number" },
      { key: "vat_output", nameAr: "ضريبة مخرجات", nameEn: "VAT Output", type: "number" },
      { key: "net_vat_payable", nameAr: "صافي الضريبة", nameEn: "Net VAT", type: "number" },
    ],
  },
  {
    key: "ar_aging_view",
    nameAr: "أعمار الذمم المدينة",
    nameEn: "AR Aging",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "invoice_number", nameAr: "رقم الفاتورة", nameEn: "Invoice #", type: "text" },
      { key: "customer_id", nameAr: "العميل", nameEn: "Customer", type: "uuid" },
      { key: "due_date", nameAr: "تاريخ الاستحقاق", nameEn: "Due Date", type: "date" },
      { key: "amount_due", nameAr: "المبلغ المستحق", nameEn: "Amount Due", type: "number" },
      { key: "ledger_balance", nameAr: "رصيد الأستاذ", nameEn: "Ledger Balance", type: "number" },
      { key: "aging_bucket", nameAr: "فئة العمر", nameEn: "Aging Bucket", type: "text" },
      { key: "days_overdue", nameAr: "أيام التأخير", nameEn: "Days Overdue", type: "number" },
    ],
  },
  {
    key: "ap_aging_view",
    nameAr: "أعمار الذمم الدائنة",
    nameEn: "AP Aging",
    columns: [
      { key: "branch_id", nameAr: "الفرع", nameEn: "Branch", type: "uuid" },
      { key: "order_number", nameAr: "رقم الأمر", nameEn: "Order #", type: "text" },
      { key: "supplier_id", nameAr: "المورد", nameEn: "Supplier", type: "uuid" },
      { key: "due_date", nameAr: "تاريخ الاستحقاق", nameEn: "Due Date", type: "date" },
      { key: "grand_total", nameAr: "الإجمالي", nameEn: "Total", type: "number" },
      { key: "ledger_balance", nameAr: "رصيد الأستاذ", nameEn: "Ledger Balance", type: "number" },
      { key: "aging_bucket", nameAr: "فئة العمر", nameEn: "Aging Bucket", type: "text" },
      { key: "days_overdue", nameAr: "أيام التأخير", nameEn: "Days Overdue", type: "number" },
    ],
  },
];

const CustomReportBuilder = () => {
  const { user, tenantId } = useAuth();
  const { isRTL, t } = useLanguage();

  // Builder state
  const [selectedView, setSelectedView] = useState<string>("");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [sortBy, setSortBy] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Data
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Presets
  const [presets, setPresets] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(true);

  const reportRef = useRef<HTMLDivElement>(null);

  const currentView = ANALYTICS_VIEWS.find(v => v.key === selectedView);
  const availableColumns = currentView?.columns.filter(c => c.type !== "uuid") || [];

  // Load presets
  useEffect(() => {
    if (!tenantId || !user) return;
    const load = async () => {
      const { data: configs } = await supabase
        .from("custom_report_configs")
        .select("*")
        .or(`user_id.eq.${user.id},and(is_shared.eq.true,tenant_id.eq.${tenantId})`)
        .order("created_at", { ascending: false });
      setPresets(configs || []);
      setLoadingPresets(false);
    };
    load();
  }, [tenantId, user]);

  // When view changes, reset columns
  useEffect(() => {
    if (currentView) {
      setSelectedColumns(availableColumns.map(c => c.key));
      setGroupBy([]);
      setSortBy("");
    }
  }, [selectedView]);

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleGroupBy = (key: string) => {
    setGroupBy(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Run query
  const runQuery = useCallback(async () => {
    if (!selectedView || !tenantId || selectedColumns.length === 0) {
      toast.error(isRTL ? "اختر مصدر البيانات والأعمدة أولاً" : "Select data source and columns first");
      return;
    }
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("query_analytics_view", {
        _tenant_id: tenantId,
        _view_name: selectedView,
        _columns: selectedColumns,
        _group_by: groupBy.length > 0 ? groupBy : null,
        _period_from: periodFrom || null,
        _period_to: periodTo || null,
        _branch_id: null,
        _sort_by: sortBy || null,
        _sort_direction: sortDirection,
        _limit: 1000,
      });
      if (error) throw error;
      const rows = Array.isArray(result) ? result : [];
      setData(rows);
      if (rows.length === 0) {
        toast.info(isRTL ? "لا توجد بيانات للفترة المحددة" : "No data for selected period");
      }
    } catch (err: any) {
      toast.error(err.message || "Error running query");
    }
    setLoading(false);
  }, [selectedView, tenantId, selectedColumns, groupBy, periodFrom, periodTo, sortBy, sortDirection, isRTL]);

  // Save preset
  const savePreset = async () => {
    if (!presetName || !selectedView || !user || !tenantId) return;
    const { error } = await supabase.from("custom_report_configs").insert({
      tenant_id: tenantId,
      user_id: user.id,
      name: presetName,
      description: presetDescription || null,
      view_name: selectedView,
      selected_columns: selectedColumns,
      group_by: groupBy,
      sort_by: sortBy || null,
      sort_direction: sortDirection,
      period_from: periodFrom || null,
      period_to: periodTo || null,
      is_shared: isShared,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم حفظ التقرير" : "Report saved");
    setShowSaveDialog(false);
    setPresetName("");
    setPresetDescription("");
    // Refresh
    const { data: configs } = await supabase
      .from("custom_report_configs")
      .select("*")
      .or(`user_id.eq.${user.id},and(is_shared.eq.true,tenant_id.eq.${tenantId})`)
      .order("created_at", { ascending: false });
    setPresets(configs || []);
  };

  // Load preset
  const loadPreset = (preset: any) => {
    setSelectedView(preset.view_name);
    setTimeout(() => {
      setSelectedColumns(preset.selected_columns || []);
      setGroupBy(preset.group_by || []);
      setSortBy(preset.sort_by || "");
      setSortDirection(preset.sort_direction || "asc");
      if (preset.period_from) setPeriodFrom(preset.period_from);
      if (preset.period_to) setPeriodTo(preset.period_to);
    }, 50);
    setData([]);
    toast.info(isRTL ? `تم تحميل: ${preset.name}` : `Loaded: ${preset.name}`);
  };

  // Delete preset
  const deletePreset = async (id: string) => {
    await supabase.from("custom_report_configs").delete().eq("id", id);
    setPresets(prev => prev.filter(p => p.id !== id));
    toast.success(isRTL ? "تم الحذف" : "Deleted");
  };

  // Export
  const handleExportExcel = () => {
    if (data.length === 0 || !currentView) return;
    const cols = selectedColumns.map(key => {
      const def = currentView.columns.find(c => c.key === key);
      return {
        key,
        label: def?.nameEn || key,
        labelAr: def?.nameAr || key,
        type: (def?.type === "number" ? "currency" : def?.type || "text") as any,
      };
    });
    const viewNameForExport = currentView.nameAr;
    exportReportExcel(data, cols, {
      key: currentView.key,
      name: currentView.nameEn,
      nameAr: viewNameForExport,
      category: "general",
      columns: cols,
      description: "",
      descriptionAr: "",
      icon: "FileText",
      source: currentView.key,
      supportsBranch: false,
      supportsCustomer: false,
    }, `${periodFrom} — ${periodTo}`);
  };

  const handleExportPDF = () => {
    if (!reportRef.current || !currentView) return;
    const cols = selectedColumns.map(key => {
      const def = currentView.columns.find(c => c.key === key);
      return {
        key,
        label: def?.nameEn || key,
        labelAr: def?.nameAr || key,
        type: (def?.type === "number" ? "currency" : def?.type || "text") as any,
      };
    });
    exportReportPDF(reportRef.current, {
      key: currentView.key,
      name: currentView.nameEn,
      nameAr: currentView.nameAr,
      category: "general",
      columns: cols,
      description: "",
      descriptionAr: "",
      icon: "FileText",
      source: currentView.key,
      supportsBranch: false,
      supportsCustomer: false,
    }, `${periodFrom} — ${periodTo}`);
  };

  // Format cell
  const formatCell = (value: any, type: string) => {
    if (value === null || value === undefined) return "—";
    if (type === "number") return fmtNumber(Number(value), 2);
    if (type === "date") return String(value);
    return String(value);
  };

  return (
    <div dir="rtl" className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? "منشئ التقارير المخصصة" : "Custom Report Builder"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isRTL ? "اختر مصدر البيانات، الأعمدة، التجميع، والفترة ثم نفّذ" : "Select data source, columns, grouping, and period"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ─── Builder Panel (Right) ─── */}
        <div className="lg:col-span-1 space-y-3">
          {/* Data Source */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Columns3 size={14} className="text-primary" />
                {isRTL ? "مصدر البيانات" : "Data Source"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <Select value={selectedView} onValueChange={setSelectedView}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder={isRTL ? "اختر عرض التحليلات" : "Select analytics view"} />
                </SelectTrigger>
                <SelectContent>
                  {ANALYTICS_VIEWS.map(v => (
                    <SelectItem key={v.key} value={v.key} className="text-xs">
                      {isRTL ? v.nameAr : v.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Columns */}
          {currentView && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Columns3 size={14} className="text-primary" />
                  {isRTL ? "الأعمدة" : "Columns"}
                  <Badge variant="secondary" className="text-[10px]">{selectedColumns.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1.5">
                {availableColumns.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer text-xs">
                    <Checkbox
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <span>{isRTL ? col.nameAr : col.nameEn}</span>
                    <Badge variant="outline" className="text-[9px] mr-auto">{col.type}</Badge>
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Group By */}
          {currentView && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Group size={14} className="text-primary" />
                  {isRTL ? "التجميع" : "Group By"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1.5">
                {availableColumns
                  .filter(c => c.type === "text" || c.type === "date")
                  .map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={groupBy.includes(col.key)}
                        onCheckedChange={() => toggleGroupBy(col.key)}
                      />
                      <span>{isRTL ? col.nameAr : col.nameEn}</span>
                    </label>
                  ))}
                {availableColumns.filter(c => c.type === "text" || c.type === "date").length === 0 && (
                  <p className="text-[10px] text-muted-foreground">{isRTL ? "لا توجد أعمدة نصية للتجميع" : "No text columns to group"}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Period */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                {isRTL ? "الفترة" : "Period"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px]">{isRTL ? "من" : "From"}</Label>
                <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="text-xs h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">{isRTL ? "إلى" : "To"}</Label>
                <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="text-xs h-8" />
              </div>
            </CardContent>
          </Card>

          {/* Sort */}
          {currentView && selectedColumns.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  {sortDirection === "asc" ? <SortAsc size={14} className="text-primary" /> : <SortDesc size={14} className="text-primary" />}
                  {isRTL ? "الترتيب" : "Sort"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder={isRTL ? "بدون ترتيب" : "No sort"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">{isRTL ? "بدون" : "None"}</SelectItem>
                    {selectedColumns.map(key => {
                      const def = currentView.columns.find(c => c.key === key);
                      return (
                        <SelectItem key={key} value={key} className="text-xs">
                          {isRTL ? def?.nameAr : def?.nameEn}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    size="sm" variant={sortDirection === "asc" ? "default" : "outline"}
                    onClick={() => setSortDirection("asc")} className="flex-1 text-[10px] h-7"
                  >
                    <SortAsc size={12} /> {isRTL ? "تصاعدي" : "Asc"}
                  </Button>
                  <Button
                    size="sm" variant={sortDirection === "desc" ? "default" : "outline"}
                    onClick={() => setSortDirection("desc")} className="flex-1 text-[10px] h-7"
                  >
                    <SortDesc size={12} /> {isRTL ? "تنازلي" : "Desc"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={runQuery} disabled={loading || !selectedView} className="w-full gap-1.5 text-xs">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {isRTL ? "تنفيذ التقرير" : "Run Report"}
            </Button>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} disabled={!selectedView} className="flex-1 gap-1 text-[10px]">
                <Save size={12} /> {isRTL ? "حفظ" : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={data.length === 0} className="flex-1 gap-1 text-[10px]">
                <Printer size={12} /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={data.length === 0} className="flex-1 gap-1 text-[10px]">
                <FileSpreadsheet size={12} /> Excel
              </Button>
            </div>
          </div>

          {/* Saved Presets */}
          {presets.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Bookmark size={14} className="text-primary" />
                  {isRTL ? "التقارير المحفوظة" : "Saved Reports"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1.5">
                    {presets.map(preset => (
                      <div key={preset.id} className="flex items-center gap-1.5 group">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => loadPreset(preset)}
                          className="flex-1 justify-start text-[11px] h-7 px-2"
                        >
                          {preset.is_shared && <Share2 size={10} className="text-primary shrink-0" />}
                          <BookmarkCheck size={10} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{preset.name}</span>
                        </Button>
                        {preset.user_id === user?.id && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => deletePreset(preset.id)}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={10} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Results Panel (Left) ─── */}
        <div className="lg:col-span-3">
          {data.length > 0 ? (
            <Card>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {isRTL ? currentView?.nameAr : currentView?.nameEn}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {data.length} {isRTL ? "سجل" : "rows"}
                    </Badge>
                    {groupBy.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {isRTL ? "مجمّع" : "Grouped"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0" ref={reportRef}>
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {selectedColumns.map(key => {
                          const def = currentView?.columns.find(c => c.key === key);
                          return (
                            <TableHead key={key} className="text-xs whitespace-nowrap">
                              {isRTL ? def?.nameAr : def?.nameEn}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          {selectedColumns.map(key => {
                            const def = currentView?.columns.find(c => c.key === key);
                            return (
                              <TableCell key={key} className="text-xs whitespace-nowrap">
                                {formatCell(row[key], def?.type || "text")}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        {selectedColumns.map(key => {
                          const def = currentView?.columns.find(c => c.key === key);
                          if (def?.type === "number") {
                            const total = data.reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0);
                            return (
                              <TableCell key={key} className="text-xs font-bold whitespace-nowrap">
                                {fmtNumber(total, 2)}
                              </TableCell>
                            );
                          }
                          return <TableCell key={key} className="text-xs">{key === selectedColumns[0] ? (isRTL ? "الإجمالي" : "Total") : ""}</TableCell>;
                        })}
                      </TableRow>
                    </TableFooter>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center py-20">
              <Columns3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {isRTL ? "اختر مصدر البيانات والأعمدة ثم اضغط \"تنفيذ التقرير\"" : "Select a data source, columns, then click \"Run Report\""}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{isRTL ? "حفظ تقرير مخصص" : "Save Custom Report"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "اسم التقرير" : "Report Name"}</Label>
              <Input value={presetName} onChange={e => setPresetName(e.target.value)} className="text-xs" placeholder={isRTL ? "مثال: تقرير الأرباح الشهري" : "e.g., Monthly P&L Report"} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "الوصف (اختياري)" : "Description (optional)"}</Label>
              <Input value={presetDescription} onChange={e => setPresetDescription(e.target.value)} className="text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isShared} onCheckedChange={setIsShared} />
              <Label className="text-xs">{isRTL ? "مشاركة مع الفريق" : "Share with team"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={savePreset} disabled={!presetName} className="gap-1.5 text-xs">
              <Save size={14} />
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomReportBuilder;
