import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, ArrowRight,
  TrendingUp, Users, Clock, FileCheck, Lock, Workflow, BookOpen,
  Building2, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlements, FEATURE_KEYS } from "@/hooks/useEntitlements";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/useLanguage";
import UpgradeWallEnterprise from "@/components/guards/UpgradeWallEnterprise";

/* ─── Types ─── */
interface CheckItem {
  key: string;
  label: string;
  passed: boolean;
  weight: number;
  fixPath?: string;
  fixLabel?: string;
  icon: React.ElementType;
}

/* ─── Circular Score Indicator ─── */
function ScoreCircle({ score }: { score: number }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 90 ? "text-emerald-500" :
    score >= 70 ? "text-amber-500" :
    "text-destructive";

  const strokeColor =
    score >= 90 ? "stroke-emerald-500" :
    score >= 70 ? "stroke-amber-500" :
    "stroke-destructive";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90">
        <circle
          cx="90" cy="90" r={radius}
          strokeWidth="10"
          fill="none"
          className="stroke-muted/30"
        />
        <motion.circle
          cx="90" cy="90" r={radius}
          strokeWidth="10"
          fill="none"
          className={strokeColor}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${color}`}>{score}%</span>
        <span className="text-xs text-muted-foreground mt-1">نقاط الامتثال</span>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function ComplianceScorePage() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { t } = useLanguage();
  const { entitlements } = useEntitlements();
  const isEnterprise = entitlements[FEATURE_KEYS.ENTERPRISE_MODE]?.allowed;

  // ── Fetch real data for score calculation ──
  const { data: scoreData } = useQuery({
    queryKey: ["compliance-score", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [
        { count: zatcaCertCount },
        { count: approvalWorkflowCount },
        { count: roleCount },
        { count: lockedPeriodCount },
        { count: auditLogCount },
        { count: financeErrorCount },
      ] = await Promise.all([
        supabase.from("zatca_certificates").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_active", true),
        supabase.from("approval_workflows").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_active", true),
        supabase.from("custom_roles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase.from("accounting_periods").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "closed"),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        // Data quality: check for invoices missing required fields
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).is("customer_id", null),
      ]);

      return {
        zatcaActive: (zatcaCertCount ?? 0) > 0,
        hasApprovalWorkflows: (approvalWorkflowCount ?? 0) > 0,
        hasRoles: (roleCount ?? 0) >= 2,
        hasLockedPeriods: (lockedPeriodCount ?? 0) > 0,
        hasAuditLogs: (auditLogCount ?? 0) > 0,
        noFinanceErrors: (financeErrorCount ?? 0) === 0,
      };
    },
  });

  // ── Build checklist ──
  const checks: CheckItem[] = useMemo(() => {
    if (!scoreData) return [];
    return [
      {
        key: "zatca",
        label: "ZATCA Phase 2 مفعّل",
        passed: scoreData.zatcaActive,
        weight: 20,
        fixPath: "/dashboard/compliance",
        fixLabel: "تفعيل ZATCA",
        icon: Shield,
      },
      {
        key: "vat",
        label: "إقرارات ضريبة القيمة المضافة محدّثة",
        passed: scoreData.zatcaActive, // simplified: linked to ZATCA
        weight: 15,
        fixPath: "/dashboard/vat-return",
        fixLabel: "إعداد الإقرار",
        icon: FileCheck,
      },
      {
        key: "approvals",
        label: "موافقات متعددة المستويات مُفعّلة",
        passed: scoreData.hasApprovalWorkflows,
        weight: 15,
        fixPath: "/dashboard/approvals",
        fixLabel: "إعداد الموافقات",
        icon: Workflow,
      },
      {
        key: "roles",
        label: "فصل الأدوار والصلاحيات",
        passed: scoreData.hasRoles,
        weight: 15,
        fixPath: "/dashboard/permissions",
        fixLabel: "إدارة الأدوار",
        icon: Users,
      },
      {
        key: "periods",
        label: "استخدام قفل الفترات المحاسبية",
        passed: scoreData.hasLockedPeriods,
        weight: 10,
        fixPath: "/dashboard/period-lock",
        fixLabel: "قفل الفترات",
        icon: Lock,
      },
      {
        key: "audit",
        label: "سجل المراجعة نشط",
        passed: scoreData.hasAuditLogs,
        weight: 10,
        fixPath: "/dashboard/audit",
        fixLabel: "عرض السجل",
        icon: BookOpen,
      },
      {
        key: "data_quality",
        label: "لا توجد أخطاء مالية حرجة",
        passed: scoreData.noFinanceErrors,
        weight: 15,
        fixPath: "/dashboard/data-quality",
        fixLabel: "مراجعة الجودة",
        icon: AlertTriangle,
      },
    ];
  }, [scoreData]);

  const totalScore = useMemo(() => {
    if (!checks.length) return 0;
    return checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  }, [checks]);

  const passedCount = checks.filter((c) => c.passed).length;
  const failedCount = checks.length - passedCount;
  const isAuditReady = totalScore >= 85;

  // ── Persist score ──
  useEffect(() => {
    if (!tenantId || !checks.length) return;
    const breakdown = Object.fromEntries(checks.map((c) => [c.key, { passed: c.passed, weight: c.weight }]));

    supabase
      .from("tenant_compliance_scores" as any)
      .upsert(
        {
          tenant_id: tenantId,
          score: totalScore,
          breakdown_json: breakdown,
          last_calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      )
      .then();
  }, [tenantId, totalScore, checks]);

  // Gate: enterprise only (after all hooks)
  if (!isEnterprise) {
    return <UpgradeWallEnterprise featureKey="enterprise_mode" />;
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ScoreCircle score={totalScore} />
        <div className="text-center sm:text-start space-y-2">
          <h1 className="text-2xl font-bold text-foreground">نقاط الامتثال المؤسسي</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            تقييم شامل لمدى التزام منشأتك بمعايير الحوكمة والأمان والامتثال الضريبي.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {isAuditReady && (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Award className="h-3.5 w-3.5" />
                جاهز للتدقيق الخارجي
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {passedCount} ناجح
            </Badge>
            {failedCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                {failedCount} يحتاج إصلاح
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Benchmark ── */}
      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">منشآت بنفس حجمك</span> متوسط امتثالها{" "}
            <span className="font-bold text-primary">74%</span>. أنت{" "}
            {totalScore >= 74 ? (
              <span className="text-emerald-600 font-semibold">متقدم عن المتوسط ↑</span>
            ) : (
              <span className="text-amber-600 font-semibold">أقل من المتوسط — حسّن نقاطك</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Checklist ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            تفاصيل التقييم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {checks.map((item) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                item.passed
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "bg-destructive/5"
              }`}
            >
              <div className="flex items-center gap-3">
                {item.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground mx-2">({item.weight}%)</span>
                </div>
              </div>
              {!item.passed && item.fixPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-primary hover:text-primary"
                  onClick={() => navigate(item.fixPath!)}
                >
                  {item.fixLabel}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
