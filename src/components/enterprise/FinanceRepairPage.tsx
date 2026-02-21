import { useState, useCallback } from "react";
import {
  Wrench, Loader2, AlertTriangle, CheckCircle2, Clock,
  FileText, Shield, RefreshCw, BookOpen, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { format } from "date-fns";

interface IntegrityIssue {
  type: string;
  severity: string;
  entry_id: string;
  entry_number: string;
  entry_date?: string;
  total_debit?: number;
  total_credit?: number;
  diff?: number;
  line_id?: string;
  account_code?: string;
  account_name?: string;
  header_debit?: number;
  header_credit?: number;
  lines_debit?: number;
  lines_credit?: number;
  message_ar: string;
  message_en: string;
}

interface ScanResult {
  scanned_at: string;
  tenant_id: string;
  total_issues: number;
  issues: IntegrityIssue[];
}

const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const premiumFade = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const FinanceRepairPage = () => {
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const runScan = useCallback(async () => {
    if (!tenantId) return;
    setScanning(true);
    const { data, error } = await secureRpc<ScanResult>("scan_finance_integrity", {
      p_tenant_id: tenantId,
    });
    setScanning(false);

    if (error) { toast.error(error.message); return; }
    setResult(data);
    if (data && data.total_issues === 0) {
      toast.success(isRTL ? "لم يتم العثور على مشاكل ✓" : "No issues found ✓");
    } else if (data) {
      toast.warning(`${data.total_issues} ${isRTL ? "مشكلة تم اكتشافها" : "issues detected"}`);
    }
  }, [tenantId, isRTL]);

  const severityBadge = (severity: string) => {
    if (severity === "critical") {
      return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle size={10} />{isRTL ? "حرج" : "Critical"}</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1"><Clock size={10} />{isRTL ? "تحذير" : "Warning"}</Badge>;
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      unbalanced_draft: { ar: "قيد غير متوازن", en: "Unbalanced Draft" },
      empty_entry: { ar: "قيد بدون بنود", en: "Empty Entry" },
      invalid_account: { ar: "حساب غير صالح", en: "Invalid Account" },
      total_mismatch: { ar: "عدم تطابق الإجماليات", en: "Total Mismatch" },
    };
    return labels[type]?.[isRTL ? "ar" : "en"] || type;
  };

  const criticalCount = result?.issues.filter(i => i.severity === "critical").length || 0;
  const warningCount = result?.issues.filter(i => i.severity === "warning").length || 0;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <motion.div {...premiumFade} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
              <Wrench className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isRTL ? "إصلاح البيانات المالية" : "Finance Data Repair"}
                </h1>
                <Badge className="border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">Enterprise</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL
                  ? "فحص آخر 90 يوم من القيود واكتشاف المشاكل المحتملة"
                  : "Scan last 90 days of entries and detect potential issues"}
              </p>
            </div>
          </div>
          <Button onClick={runScan} disabled={scanning} className="gap-2">
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {isRTL ? "بدء الفحص" : "Run Scan"}
          </Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      {result && (
        <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي المشاكل" : "Total Issues"}</p>
                  <p className="text-3xl font-bold mt-1">{result.total_issues}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "حرجة" : "Critical"}</p>
                  <p className="text-3xl font-bold mt-1 text-destructive">{criticalCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isRTL ? "تحذيرات" : "Warnings"}</p>
                  <p className="text-3xl font-bold mt-1 text-amber-600">{warningCount}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-600/30" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Issues Table */}
      {result && (
        <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.2 }}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield size={16} />
                {isRTL ? "المشاكل المكتشفة" : "Detected Issues"}
                {result.scanned_at && (
                  <span className="text-xs font-normal text-muted-foreground ms-auto">
                    {isRTL ? "تم الفحص:" : "Scanned:"} {format(new Date(result.scanned_at), "yyyy-MM-dd HH:mm")}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            {result.total_issues === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto h-12 w-12 mb-3 text-emerald-500" />
                <p className="text-lg font-medium">{isRTL ? "لا توجد مشاكل!" : "No issues found!"}</p>
                <p className="text-sm">{isRTL ? "البيانات المالية سليمة" : "Financial data integrity is clean"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "الخطورة" : "Severity"}</TableHead>
                    <TableHead>{isRTL ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isRTL ? "رقم القيد" : "Entry #"}</TableHead>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isRTL ? "التفاصيل" : "Details"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.issues.map((issue, idx) => (
                    <TableRow key={`${issue.entry_id}-${issue.type}-${idx}`}>
                      <TableCell>{severityBadge(issue.severity)}</TableCell>
                      <TableCell className="text-sm font-medium">{typeLabel(issue.type)}</TableCell>
                      <TableCell className="font-mono text-sm">{issue.entry_number}</TableCell>
                      <TableCell className="text-sm">
                        {issue.entry_date ? format(new Date(issue.entry_date), "yyyy-MM-dd") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                        {isRTL ? issue.message_ar : issue.message_en}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </motion.div>
      )}

      {/* Initial state */}
      {!result && !scanning && (
        <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
          <Card>
            <div className="py-20 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">{isRTL ? "اضغط 'بدء الفحص' لبدء التحليل" : "Click 'Run Scan' to start analysis"}</p>
              <p className="text-sm mt-1">
                {isRTL ? "سيتم فحص القيود اليومية لآخر 90 يوماً" : "Will scan journal entries from the last 90 days"}
              </p>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default FinanceRepairPage;
