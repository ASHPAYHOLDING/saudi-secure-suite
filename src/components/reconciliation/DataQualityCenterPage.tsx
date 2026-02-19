import { useState, useCallback } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, Info, Play, Loader2,
  CheckCircle2, XCircle, Clock, FileText, Wallet, Receipt, CreditCard,
  RefreshCw, ChevronDown, ChevronUp, ExternalLink, BookOpen, Scale,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

type ReconciliationRun = {
  id: string;
  tenant_id: string;
  run_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_checked: number;
  total_matched: number;
  total_issues: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  summary: any;
  created_at: string;
};

type ReconciliationIssue = {
  id: string;
  run_id: string;
  tenant_id: string;
  severity: string;
  issue_type: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  expected_value: number | null;
  actual_value: number | null;
  difference: number | null;
  description: string;
  description_en: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

const RUN_TYPE_CONFIG: Record<string, { icon: any; labelAr: string; labelEn: string; color: string }> = {
  invoice_payments: { icon: FileText, labelAr: "الفواتير والمدفوعات", labelEn: "Invoices vs Payments", color: "text-blue-500" },
  invoices_without_journals: { icon: BookOpen, labelAr: "فواتير بدون قيود", labelEn: "Invoices Without Journals", color: "text-rose-500" },
  unbalanced_journals: { icon: Scale, labelAr: "قيود غير متوازنة", labelEn: "Unbalanced Journals", color: "text-orange-500" },
  wallet_journal: { icon: Wallet, labelAr: "المحفظة والقيود", labelEn: "Wallet vs Journal", color: "text-emerald-500" },
  vat_totals: { icon: Receipt, labelAr: "ضريبة القيمة المضافة", labelEn: "VAT Totals", color: "text-amber-500" },
  subscription_revenue: { icon: CreditCard, labelAr: "إيرادات الاشتراكات", labelEn: "Subscription Revenue", color: "text-purple-500" },
};

const DataQualityCenterPage = () => {
  const { t, isRTL, currentLang } = useLanguage();
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const dateFnsLocale = currentLang === "ar" ? ar : enUS;

  // Fetch latest runs
  const { data: runs = [], isLoading: loadingRuns } = useQuery({
    queryKey: ["reconciliation-runs", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("reconciliation_runs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ReconciliationRun[];
    },
    enabled: !!tenantId,
  });

  // Fetch unresolved issues
  const { data: issues = [], isLoading: loadingIssues } = useQuery({
    queryKey: ["reconciliation-issues", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("reconciliation_issues")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ReconciliationIssue[];
    },
    enabled: !!tenantId,
  });

  // Run reconciliation
  const runReconciliation = useMutation({
    mutationFn: async (runType: string) => {
      if (!tenantId) throw new Error("No tenant");
      let fn: string;
      const params: any = { p_tenant_id: tenantId };
      switch (runType) {
        case "invoice_payments":
          fn = "reconcile_invoices_vs_payments";
          break;
        case "invoices_without_journals":
          fn = "reconcile_invoices_without_journals";
          break;
        case "unbalanced_journals":
          fn = "reconcile_unbalanced_journals";
          break;
        case "wallet_journal":
          fn = "reconcile_wallet_vs_journal";
          break;
        case "vat_totals":
          fn = "reconcile_vat_totals";
          break;
        case "subscription_revenue":
          fn = "reconcile_subscription_revenue";
          break;
        default:
          throw new Error("Unknown run type");
      }
      const { data, error } = await supabase.rpc(fn as any, params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-runs"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-issues"] });
      toast.success(isRTL ? "تمت المطابقة بنجاح" : "Reconciliation completed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Reconciliation failed");
    },
  });

  const runAll = useCallback(async () => {
    for (const type of ["invoice_payments", "invoices_without_journals", "unbalanced_journals", "wallet_journal", "vat_totals", "subscription_revenue"]) {
      await runReconciliation.mutateAsync(type);
    }
  }, [runReconciliation]);

  // Resolve issue
  const resolveIssue = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase
        .from("reconciliation_issues")
        .update({ is_resolved: true, resolved_at: new Date().toISOString() } as any)
        .eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-issues"] });
      toast.success(isRTL ? "تم حل المشكلة" : "Issue resolved");
    },
  });

  // Issues by run for expanded view
  const { data: expandedIssues = [] } = useQuery({
    queryKey: ["reconciliation-issues-run", expandedRun],
    queryFn: async () => {
      if (!expandedRun) return [];
      const { data, error } = await supabase
        .from("reconciliation_issues")
        .select("*")
        .eq("run_id", expandedRun)
        .order("severity", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as ReconciliationIssue[];
    },
    enabled: !!expandedRun,
  });

  // Counts
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  // Latest run per type
  const latestByType = Object.keys(RUN_TYPE_CONFIG).map((type) => {
    const latest = runs.find((r) => r.run_type === type);
    return { type, run: latest };
  });

  const hasCriticalIssues = criticalCount > 0;

  const SeverityBadge = ({ severity }: { severity: string }) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive" className="gap-1"><XCircle size={12} />{isRTL ? "حرج" : "Critical"}</Badge>;
      case "warning":
        return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><AlertTriangle size={12} />{isRTL ? "تحذير" : "Warning"}</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Info size={12} />{isRTL ? "معلومة" : "Info"}</Badge>;
    }
  };

  const getEntityLink = (entityType: string | null) => {
    switch (entityType) {
      case "invoice": return "/dashboard/billing";
      case "expense": return "/dashboard/expenses";
      case "wallet": return "/dashboard/wallet";
      case "subscription": return "/dashboard/subscription";
      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="text-primary" size={28} />
            {isRTL ? "مركز جودة البيانات" : "Data Quality Center"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL
              ? "مطابقة محاسبية آلية لضمان دقة وسلامة البيانات المالية"
              : "Automated reconciliation to ensure financial data integrity"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runAll()}
            disabled={runReconciliation.isPending}
            className="gap-2"
          >
            {runReconciliation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isRTL ? "تشغيل المطابقة الكاملة" : "Run Full Reconciliation"}
          </Button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {hasCriticalIssues && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-start gap-3">
          <XCircle className="text-destructive mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-semibold text-destructive">
              {isRTL
                ? `يوجد ${criticalCount} مشكلة حرجة تمنع إصدار التقارير المالية`
                : `${criticalCount} critical issue(s) blocking financial report generation`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isRTL
                ? "يجب حل جميع المشاكل الحرجة قبل إمكانية تصدير التقارير"
                : "All critical issues must be resolved before reports can be exported"}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={criticalCount > 0 ? "border-destructive/50" : ""}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="text-destructive" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "مشاكل حرجة" : "Critical Issues"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="text-amber-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{warningCount}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "تحذيرات" : "Warnings"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Info className="text-blue-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{infoCount}</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "ملاحظات" : "Info"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={!hasCriticalIssues ? "border-emerald-500/50" : ""}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${hasCriticalIssues ? "bg-destructive/10" : "bg-emerald-500/10"}`}>
              {hasCriticalIssues ? <ShieldAlert className="text-destructive" size={24} /> : <ShieldCheck className="text-emerald-500" size={24} />}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {hasCriticalIssues
                  ? (isRTL ? "ممنوع إصدار التقارير" : "Reports Blocked")
                  : (isRTL ? "جاهز للتقارير" : "Reports Ready")}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasCriticalIssues
                  ? (isRTL ? "حل المشاكل الحرجة أولاً" : "Resolve critical issues first")
                  : (isRTL ? "لا توجد مشاكل حرجة" : "No critical issues")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Engines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isRTL ? "محركات المطابقة" : "Reconciliation Engines"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {latestByType.map(({ type, run }) => {
              const config = RUN_TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <div key={type} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{isRTL ? config.labelAr : config.labelEn}</p>
                      {run ? (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p>{isRTL ? "آخر تشغيل:" : "Last run:"} {formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: dateFnsLocale })}</p>
                          <p>
                            {isRTL ? "فُحص:" : "Checked:"} {run.total_checked} |{" "}
                            <span className="text-emerald-600">{isRTL ? "متطابق:" : "Matched:"} {run.total_matched}</span> |{" "}
                            {run.critical_count > 0 && <span className="text-destructive">{isRTL ? "حرج:" : "Critical:"} {run.critical_count} </span>}
                            {run.warning_count > 0 && <span className="text-amber-600">{isRTL ? "تحذير:" : "Warning:"} {run.warning_count}</span>}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">{isRTL ? "لم يتم التشغيل بعد" : "Not yet run"}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runReconciliation.mutate(type)}
                    disabled={runReconciliation.isPending}
                    className="shrink-0"
                  >
                    {runReconciliation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Issues / History */}
      <Tabs defaultValue="issues">
        <TabsList>
          <TabsTrigger value="issues" className="gap-1.5">
            <AlertTriangle size={14} />
            {isRTL ? `المشاكل المفتوحة (${issues.length})` : `Open Issues (${issues.length})`}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Clock size={14} />
            {isRTL ? "سجل التشغيل" : "Run History"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="mt-4">
          {issues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck size={48} className="mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">{isRTL ? "لا توجد مشاكل مفتوحة" : "No open issues"}</p>
              <p className="text-sm mt-1">{isRTL ? "جميع البيانات متطابقة" : "All data is reconciled"}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "الخطورة" : "Severity"}</TableHead>
                    <TableHead>{isRTL ? "الوصف" : "Description"}</TableHead>
                    <TableHead>{isRTL ? "الكيان" : "Entity"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "الفرق" : "Difference"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "إجراء" : "Action"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => {
                    const link = getEntityLink(issue.entity_type);
                    return (
                      <TableRow key={issue.id} className={issue.severity === "critical" ? "bg-destructive/5" : ""}>
                        <TableCell><SeverityBadge severity={issue.severity} /></TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm">{isRTL ? issue.description : (issue.description_en || issue.description)}</p>
                        </TableCell>
                        <TableCell>
                          {issue.entity_label && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-mono">{issue.entity_label}</span>
                              {link && (
                                <a href={link} className="text-primary hover:underline">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-end font-mono text-sm">
                          {issue.difference != null ? (
                            <span className={issue.difference > 0 ? "text-destructive" : "text-amber-600"}>
                              {issue.difference > 0 ? "+" : ""}{issue.difference.toFixed(2)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resolveIssue.mutate(issue.id)}
                            disabled={resolveIssue.isPending}
                          >
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock size={48} className="mx-auto mb-3" />
              <p>{isRTL ? "لا توجد عمليات مطابقة سابقة" : "No reconciliation runs yet"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const config = RUN_TYPE_CONFIG[run.run_type] || RUN_TYPE_CONFIG.invoice_payments;
                const Icon = config.icon;
                const isExpanded = expandedRun === run.id;
                return (
                  <div key={run.id} className="border rounded-lg">
                    <button
                      onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={config.color} />
                        <div className="text-start">
                          <p className="text-sm font-medium">{isRTL ? config.labelAr : config.labelEn}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(run.created_at), "yyyy-MM-dd HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {run.critical_count > 0 && <Badge variant="destructive" className="text-xs">{run.critical_count}</Badge>}
                        {run.warning_count > 0 && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">{run.warning_count}</Badge>}
                        {run.total_issues === 0 && <Badge variant="secondary" className="text-xs text-emerald-600">✓</Badge>}
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t px-4 py-3 space-y-2 bg-muted/30">
                        <div className="flex gap-6 text-xs text-muted-foreground">
                          <span>{isRTL ? "فُحص:" : "Checked:"} <strong>{run.total_checked}</strong></span>
                          <span className="text-emerald-600">{isRTL ? "متطابق:" : "Matched:"} <strong>{run.total_matched}</strong></span>
                          <span>{isRTL ? "مشاكل:" : "Issues:"} <strong>{run.total_issues}</strong></span>
                        </div>
                        {expandedIssues.length > 0 && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">{isRTL ? "الخطورة" : "Severity"}</TableHead>
                                <TableHead className="text-xs">{isRTL ? "الوصف" : "Description"}</TableHead>
                                <TableHead className="text-xs">{isRTL ? "الكيان" : "Entity"}</TableHead>
                                <TableHead className="text-xs text-end">{isRTL ? "الفرق" : "Diff"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {expandedIssues.map((issue) => (
                                <TableRow key={issue.id}>
                                  <TableCell><SeverityBadge severity={issue.severity} /></TableCell>
                                  <TableCell className="text-xs max-w-xs">{isRTL ? issue.description : (issue.description_en || issue.description)}</TableCell>
                                  <TableCell className="text-xs font-mono">{issue.entity_label || "—"}</TableCell>
                                  <TableCell className="text-xs text-end font-mono">{issue.difference?.toFixed(2) || "—"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataQualityCenterPage;
