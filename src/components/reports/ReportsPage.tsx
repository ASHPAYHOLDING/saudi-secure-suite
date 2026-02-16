import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, Filter, Loader2, TrendingUp, TrendingDown, CreditCard,
  FileSignature, Search, ArrowLeft, Bookmark, BookmarkCheck, Trash2, Save,
  Building2, Users, Package, Wallet, Receipt, BarChart3, Shield, ChevronDown,
  Calendar, FileSpreadsheet,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { toast } from "sonner";

import {
  REPORT_DEFINITIONS,
  REPORT_CATEGORIES,
  getReportsByCategory,
  getReportByKey,
  type ReportCategory,
  type ReportDefinition,
  type ReportColumn,
} from "@/lib/report-definitions";
import { fetchReportData, clearReportCache, type ReportFilters } from "@/lib/report-data-fetcher";
import { exportReportPDF, exportReportExcel } from "@/lib/report-export";

// Icon map for dynamic rendering
const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, TrendingDown, CreditCard, FileSignature, Building2, Users,
  Package, Wallet, Receipt, BarChart3, Shield, FileText, Calendar,
};

const ReportsPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();

  // ─── State ───
  const [activeCategory, setActiveCategory] = useState<ReportCategory | "all">("all");
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");

  // Branches + customers for filter dropdowns
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

  // Presets
  const [presets, setPresets] = useState<any[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const reportRef = useRef<HTMLDivElement>(null);

  // ─── Load branches, customers, presets ───
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const [branchRes, custRes, presetRes] = await Promise.all([
        supabase.from("branches").select("id, name").eq("tenant_id", tenantId).eq("is_active", true),
        supabase.from("customers").select("id, name").eq("tenant_id", tenantId).eq("is_active", true).order("name").limit(500),
        supabase.from("report_presets").select("*").eq("tenant_id", tenantId).eq("user_id", user!.id).order("created_at", { ascending: false }),
      ]);
      setBranches(branchRes.data || []);
      setCustomers(custRes.data || []);
      setPresets(presetRes.data || []);
    };
    load();
  }, [tenantId, user]);

  // ─── Filtered report list ───
  const filteredReports = useMemo(() => {
    let reports = activeCategory === "all" ? REPORT_DEFINITIONS : getReportsByCategory(activeCategory);
    if (search) {
      const q = search.toLowerCase();
      reports = reports.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.nameAr.includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.descriptionAr.includes(q)
      );
    }
    return reports;
  }, [activeCategory, search]);

  // ─── Run Report ───
  const runReport = useCallback(async (report?: ReportDefinition) => {
    const rpt = report || selectedReport;
    if (!rpt || !tenantId) return;
    setLoading(true);
    try {
      const filters: ReportFilters = {
        dateFrom,
        dateTo,
        branchId: branchId || undefined,
        customerId: customerId || undefined,
      };
      const result = await fetchReportData(rpt.key, tenantId, filters);
      setData(result);
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
    setLoading(false);
  }, [selectedReport, tenantId, dateFrom, dateTo, branchId, customerId]);

  // ─── Select Report ───
  const handleSelectReport = (report: ReportDefinition) => {
    setSelectedReport(report);
    setData([]);
  };

  // ─── Export ───
  const handleExportPDF = () => {
    if (!reportRef.current || !selectedReport) return;
    exportReportPDF(reportRef.current, selectedReport, `${dateFrom} — ${dateTo}`);
  };

  const handleExportExcel = () => {
    if (!selectedReport || data.length === 0) return;
    exportReportExcel(data, selectedReport.columns, selectedReport, `${dateFrom} — ${dateTo}`);
  };

  // ─── Presets ───
  const savePreset = async () => {
    if (!presetName || !selectedReport || !user || !tenantId) return;
    const { error } = await supabase.from("report_presets").insert({
      tenant_id: tenantId,
      user_id: user.id,
      name: presetName,
      report_key: selectedReport.key,
      filters: { dateFrom, dateTo, branchId, customerId },
    });
    if (error) { toast.error(error.message); return; }
    toast.success(isRTL ? "تم حفظ الإعداد المسبق" : "Preset saved");
    setShowSavePreset(false);
    setPresetName("");
    // Refresh presets
    const { data: fresh } = await supabase.from("report_presets").select("*").eq("tenant_id", tenantId).eq("user_id", user.id);
    setPresets(fresh || []);
  };

  const loadPreset = (preset: any) => {
    const rpt = getReportByKey(preset.report_key);
    if (!rpt) return;
    setSelectedReport(rpt);
    const f = preset.filters as any;
    if (f.dateFrom) setDateFrom(f.dateFrom);
    if (f.dateTo) setDateTo(f.dateTo);
    if (f.branchId) setBranchId(f.branchId);
    if (f.customerId) setCustomerId(f.customerId);
    setData([]);
    toast.info(isRTL ? `تم تحميل: ${preset.name}` : `Loaded: ${preset.name}`);
  };

  const deletePreset = async (id: string) => {
    await supabase.from("report_presets").delete().eq("id", id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
    toast.success(isRTL ? "تم الحذف" : "Deleted");
  };

  // ─── Format cell value ───
  const formatCell = (value: any, type: ReportColumn["type"]) => {
    if (value === null || value === undefined || value === "") return "—";
    switch (type) {
      case "currency":
        return `${Number(value).toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ر.س`;
      case "number":
        return Number(value).toLocaleString("ar-SA");
      case "percent":
        return `${Number(value).toFixed(1)}%`;
      case "date":
        return value;
      default:
        return String(value);
    }
  };

  // ─── Column totals ───
  const getColumnTotal = (col: ReportColumn) => {
    if (col.type !== "currency" && col.type !== "number") return null;
    return data.reduce((s, row) => s + (Number(row[col.key]) || 0), 0);
  };

  // ─── Render ───
  if (selectedReport) {
    return (
      <div dir="rtl" className="space-y-4 p-6">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSelectedReport(null); setData([]); }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{selectedReport.nameAr}</h1>
            <p className="text-xs text-muted-foreground">{selectedReport.descriptionAr}</p>
          </div>
          <Badge variant="outline">{REPORT_CATEGORIES.find((c) => c.key === selectedReport.category)?.nameAr}</Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{isRTL ? "من تاريخ" : "From"}</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{isRTL ? "إلى تاريخ" : "To"}</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" />
              </div>
              {selectedReport.supportsBranch && branches.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "الفرع" : "Branch"}</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder={isRTL ? "الكل" : "All"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>
                      {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {selectedReport.supportsCustomer && (
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "العميل" : "Customer"}</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder={isRTL ? "الكل" : "All"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? "جميع العملاء" : "All Customers"}</SelectItem>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => runReport()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                {isRTL ? "عرض التقرير" : "Run Report"}
              </Button>
              {data.length > 0 && (
                <>
                  <Button variant="outline" onClick={handleExportPDF}>
                    <Download className="h-4 w-4 me-1" />PDF
                  </Button>
                  <Button variant="outline" onClick={handleExportExcel}>
                    <FileSpreadsheet className="h-4 w-4 me-1" />Excel
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowSavePreset(true)} title={isRTL ? "حفظ إعداد مسبق" : "Save Preset"}>
                <Bookmark className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Table */}
        {data.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div ref={reportRef}>
              {/* Print header (hidden on screen) */}
              <div className="report-print-header hidden print:block text-center border-b-2 border-foreground pb-3 mb-4">
                <h1 className="text-xl font-bold">{selectedReport.nameAr}</h1>
                <p className="sub text-sm text-muted-foreground">{dateFrom} — {dateTo}</p>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-primary/5">
                          <TableHead className="text-right text-xs font-semibold w-10">#</TableHead>
                          {selectedReport.columns.map((col) => (
                            <TableHead key={col.key} className="text-right text-xs font-semibold">{col.labelAr}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                            {selectedReport.columns.map((col) => (
                              <TableCell key={col.key} className={`text-sm ${col.type === "currency" || col.type === "number" ? "font-english" : ""}`}>
                                {formatCell(row[col.key], col.type)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="bg-muted/80 font-bold">
                          <TableCell>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                          {selectedReport.columns.map((col) => {
                            const total = getColumnTotal(col);
                            return (
                              <TableCell key={col.key} className="font-english font-bold">
                                {total !== null ? formatCell(total, col.type) : ""}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Print footer */}
              <div className="footer hidden print:block text-center text-xs text-muted-foreground mt-4 pt-3 border-t">
                {isRTL ? `تم إنشاء التقرير بتاريخ ${new Date().toLocaleDateString("ar-SA")}` : `Report generated on ${new Date().toLocaleDateString()}`}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2 text-center">
              {isRTL ? `${data.length} سجل` : `${data.length} records`}
            </p>
          </motion.div>
        )}

        {data.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{isRTL ? "اضغط 'عرض التقرير' لتحميل البيانات" : "Click 'Run Report' to load data"}</p>
          </div>
        )}

        {/* Save Preset Dialog */}
        <Dialog open={showSavePreset} onOpenChange={setShowSavePreset}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "حفظ إعداد مسبق" : "Save Preset"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{isRTL ? "اسم الإعداد" : "Preset Name"}</Label>
                <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={isRTL ? "مثال: تقرير الربع الأول" : "e.g. Q1 Report"} />
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL ? `التقرير: ${selectedReport.nameAr} | الفترة: ${dateFrom} — ${dateTo}` : `Report: ${selectedReport.name} | Range: ${dateFrom} — ${dateTo}`}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSavePreset(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button onClick={savePreset} disabled={!presetName}><Save className="h-4 w-4 me-1" />{isRTL ? "حفظ" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Report Catalog ───
  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isRTL ? "التقارير المتقدمة" : "Advanced Reports"}</h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? `${REPORT_DEFINITIONS.length}+ تقرير مالي وتشغيلي` : `${REPORT_DEFINITIONS.length}+ financial & operational reports`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? "بحث في التقارير..." : "Search reports..."}
              className="ps-9 w-[220px]"
            />
          </div>
        </div>
      </div>

      {/* Saved Presets */}
      {presets.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-primary" />
            {isRTL ? "الإعدادات المحفوظة" : "Saved Presets"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div key={preset.id} className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => loadPreset(preset)}
                >
                  <Bookmark className="h-3 w-3 me-1" />
                  {preset.name}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deletePreset(preset.id)}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory("all")}
          className="text-xs"
        >
          {isRTL ? "الكل" : "All"} ({REPORT_DEFINITIONS.length})
        </Button>
        {REPORT_CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat.icon] || FileText;
          const count = getReportsByCategory(cat.key).length;
          return (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat.key)}
              className="text-xs"
            >
              <Icon className="h-3.5 w-3.5 me-1" />
              {cat.nameAr} ({count})
            </Button>
          );
        })}
      </div>

      {/* Report Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filteredReports.map((report, i) => {
            const Icon = ICON_MAP[report.icon] || FileText;
            return (
              <motion.div
                key={report.key}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card
                  className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
                  onClick={() => handleSelectReport(report)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {report.nameAr}
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {report.descriptionAr}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Badge variant="secondary" className="text-[9px] px-1.5">
                            {REPORT_CATEGORIES.find((c) => c.key === report.category)?.nameAr}
                          </Badge>
                          {report.supportsBranch && (
                            <Badge variant="outline" className="text-[9px] px-1.5">
                              <Building2 className="h-2.5 w-2.5 me-0.5" />فرع
                            </Badge>
                          )}
                          {report.supportsCustomer && (
                            <Badge variant="outline" className="text-[9px] px-1.5">
                              <Users className="h-2.5 w-2.5 me-0.5" />عميل
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{isRTL ? "لا توجد تقارير مطابقة" : "No matching reports"}</p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
