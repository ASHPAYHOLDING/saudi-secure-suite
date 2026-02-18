import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Search, Filter, FileText, FileSignature, Stamp, Clock, User,
  ChevronDown, ChevronUp, Loader2, Calendar, ArrowLeft, ArrowRight,
  Wallet, Receipt, CreditCard, BarChart3, BookOpen, AlertTriangle,
  Eye, Download, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  soft_delete: "حذف ناعم",
  sign: "توقيع",
  cancel: "إلغاء",
  mark_paid: "تأكيد الدفع",
  approve: "اعتماد",
  void: "إبطال",
};

const ENTITY_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  invoices: { label: "فاتورة", icon: Receipt },
  expenses: { label: "مصروف", icon: CreditCard },
  journal_entries: { label: "قيد يومية", icon: BookOpen },
  subscriptions: { label: "اشتراك", icon: BarChart3 },
  wallet_transactions: { label: "محفظة", icon: Wallet },
  budgets: { label: "ميزانية", icon: BarChart3 },
  credit_notes: { label: "إشعار دائن", icon: FileText },
  report_versions: { label: "تقرير", icon: FileText },
  invoice: { label: "فاتورة", icon: Receipt },
  contract: { label: "عقد", icon: FileSignature },
  stamp: { label: "ختم", icon: Stamp },
  contracts: { label: "عقد", icon: FileSignature },
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-600",
  update: "bg-blue-500/10 text-blue-600",
  delete: "bg-destructive/10 text-destructive",
  soft_delete: "bg-orange-500/10 text-orange-600",
  sign: "bg-violet-500/10 text-violet-600",
  cancel: "bg-amber-500/10 text-amber-600",
  mark_paid: "bg-emerald-500/10 text-emerald-600",
  approve: "bg-emerald-500/10 text-emerald-600",
};

const FIELD_LABELS: Record<string, string> = {
  status: "الحالة",
  grand_total: "الإجمالي",
  subtotal: "المجموع الفرعي",
  vat_total: "ضريبة القيمة المضافة",
  notes: "ملاحظات",
  invoice_number: "رقم الفاتورة",
  expense_number: "رقم المصروف",
  amount: "المبلغ",
  plan_name_ar: "الباطة",
  name_ar: "الاسم",
  deleted_at: "تاريخ الحذف",
  deleted_by: "حُذف بواسطة",
  balance_before: "الرصيد قبل",
  balance_after: "الرصيد بعد",
  transaction_type: "نوع المعاملة",
};

const PAGE_SIZE = 30;

const AuditLogViewer = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Detail view
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Profiles cache
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const fetchLogs = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);
    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (searchTerm) query = query.or(`entity_label.ilike.%${searchTerm}%,action.ilike.%${searchTerm}%`);

    const { data, count, error } = await query;
    if (!error) {
      setLogs(data || []);
      setTotalCount(count || 0);

      // Fetch user names
      const userIds = [...new Set((data || []).map((l: any) => l.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p.full_name || "—"; });
        setProfiles((prev) => ({ ...prev, ...map }));
      }
    }
    setLoading(false);
  }, [tenantId, dateFrom, dateTo, entityFilter, actionFilter, searchTerm, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const entityFilters = [
    { value: "all", label: "الكل" },
    { value: "invoices", label: "فواتير" },
    { value: "expenses", label: "مصروفات" },
    { value: "journal_entries", label: "قيود" },
    { value: "subscriptions", label: "اشتراكات" },
    { value: "wallet_transactions", label: "محفظة" },
    { value: "budgets", label: "ميزانيات" },
    { value: "credit_notes", label: "إشعارات دائنة" },
    { value: "report_versions", label: "تقارير" },
    { value: "contracts", label: "عقود" },
  ];

  const actionFilters = [
    { value: "all", label: "كل الإجراءات" },
    { value: "create", label: "إنشاء" },
    { value: "update", label: "تعديل" },
    { value: "soft_delete", label: "حذف ناعم" },
    { value: "sign", label: "توقيع" },
    { value: "cancel", label: "إلغاء" },
    { value: "mark_paid", label: "تأكيد دفع" },
  ];

  // Diff viewer for before/after
  const renderDiff = (before: any, after: any) => {
    if (!before && !after) return null;
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);
    const changedKeys = [...allKeys].filter((k) => {
      if (["created_at", "updated_at", "id", "tenant_id"].includes(k)) return false;
      return JSON.stringify((before || {})[k]) !== JSON.stringify((after || {})[k]);
    });

    if (changedKeys.length === 0) return <p className="text-xs text-muted-foreground">لا توجد تغييرات محددة</p>;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right text-xs w-[30%]">الحقل</TableHead>
            <TableHead className="text-right text-xs w-[35%]">القيمة السابقة</TableHead>
            <TableHead className="text-right text-xs w-[35%]">القيمة الجديدة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changedKeys.map((key) => (
            <TableRow key={key}>
              <TableCell className="text-xs font-medium">{FIELD_LABELS[key] || key}</TableCell>
              <TableCell className="text-xs text-destructive/80 font-mono">
                {before ? formatValue(before[key]) : "—"}
              </TableCell>
              <TableCell className="text-xs text-emerald-600 font-mono">
                {after ? formatValue(after[key]) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "نعم" : "لا";
    if (typeof val === "object") return JSON.stringify(val).slice(0, 80);
    return String(val).slice(0, 80);
  };

  return (
    <div dir="rtl" className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            سجل التدقيق الداخلي
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            تتبع كامل لجميع العمليات المالية والإدارية — Audit-ready
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <FileText className="h-3 w-3" />
            {totalCount.toLocaleString("ar-SA")} سجل
          </Badge>
          <Button variant="ghost" size="icon" onClick={() => { setPage(0); fetchLogs(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                placeholder="بحث بالمرجع..."
                className="ps-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[140px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">نوع الكيان</Label>
              <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {entityFilters.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الإجراء</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {actionFilters.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">لا توجد سجلات مطابقة</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {logs.map((log, i) => {
                const entityInfo = ENTITY_LABELS[log.entity_type] || { label: log.entity_type, icon: FileText };
                const EntityIcon = entityInfo.icon;
                const userName = profiles[log.user_id] || "نظام";
                const hasDetails = log.before_value || log.after_value || (log.changes && Object.keys(log.changes).length > 0);

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.02 * Math.min(i, 10) }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => hasDetails && setSelectedLog(log)}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <EntityIcon className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[log.action] || "bg-muted text-muted-foreground"}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        <span className="text-xs text-muted-foreground">{entityInfo.label}</span>
                        <span className="text-sm font-semibold text-foreground font-english truncate max-w-[200px]">
                          {log.entity_label || "—"}
                        </span>
                        {log.action === "soft_delete" && (
                          <Badge variant="destructive" className="text-[9px] h-4 gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" /> حذف ناعم
                          </Badge>
                        )}
                      </div>

                      {/* Quick changes preview */}
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="mt-1 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-0.5 inline-block max-w-full truncate">
                          {Object.entries(log.changes).slice(0, 3).map(([key, val]: [string, any]) => {
                            if (typeof val === "object" && val !== null && "old" in val && "new" in val) {
                              return <span key={key} className="me-3">{FIELD_LABELS[key] || key}: {formatValue(val.old)} → {formatValue(val.new)}</span>;
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>

                    <div className="text-left shrink-0 space-y-0.5">
                      <div className="flex items-center gap-1 text-xs text-foreground">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[120px]">{userName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        <span className="font-english">
                          {new Date(log.created_at).toLocaleDateString("ar-SA")}
                          {" "}
                          {new Date(log.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {log.ip_address && (
                        <div className="text-[9px] text-muted-foreground font-english">{log.ip_address}</div>
                      )}
                      {hasDetails && (
                        <Badge variant="outline" className="text-[9px] h-4 gap-0.5 mt-0.5">
                          <Eye className="h-2.5 w-2.5" /> تفاصيل
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {(page + 1).toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]" dir="rtl">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  تفاصيل سجل التدقيق
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[65vh]">
                <div className="space-y-4">
                  {/* Meta info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">الإجراء</span>
                      <p className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-0.5 ${ACTION_COLORS[selectedLog.action] || "bg-muted"}`}>
                        {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">نوع الكيان</span>
                      <p className="font-medium">{(ENTITY_LABELS[selectedLog.entity_type] || {}).label || selectedLog.entity_type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">المرجع</span>
                      <p className="font-english font-semibold">{selectedLog.entity_label || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">المستخدم</span>
                      <p>{profiles[selectedLog.user_id] || "نظام"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">التاريخ والوقت</span>
                      <p className="font-english text-xs">
                        {new Date(selectedLog.created_at).toLocaleString("ar-SA")}
                      </p>
                    </div>
                    {selectedLog.ip_address && (
                      <div>
                        <span className="text-muted-foreground text-xs">عنوان IP</span>
                        <p className="font-english text-xs">{selectedLog.ip_address}</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Before / After Diff */}
                  {(selectedLog.before_value || selectedLog.after_value) ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        مقارنة القيم (قبل / بعد)
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        {renderDiff(selectedLog.before_value, selectedLog.after_value)}
                      </div>
                    </div>
                  ) : selectedLog.changes && Object.keys(selectedLog.changes).length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">التغييرات</h4>
                      <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1">
                        {Object.entries(selectedLog.changes).map(([key, val]: [string, any]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="font-medium">{FIELD_LABELS[key] || key}:</span>
                            {typeof val === "object" && val !== null && "old" in val && "new" in val ? (
                              <>
                                <span className="text-destructive/80 line-through">{formatValue(val.old)}</span>
                                <span>→</span>
                                <span className="text-emerald-600">{formatValue(val.new)}</span>
                              </>
                            ) : (
                              <span>{formatValue(val)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogViewer;
