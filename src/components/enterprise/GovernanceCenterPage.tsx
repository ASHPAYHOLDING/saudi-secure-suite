/**
 * GovernanceCenter — /dashboard/governance-center
 * 
 * Enterprise-grade governance hub with 5 sections:
 * 1. Role Management
 * 2. Access Matrix
 * 3. Security Policies
 * 4. Audit & Logs
 * 5. Compliance Snapshot
 * 
 * Uses progressive disclosure — clean summary cards that expand on click.
 * Non-enterprise tenants see UpgradeWall.
 */
import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlements } from "@/hooks/useEntitlements";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Shield, Users, CheckCircle2, ChevronDown,
  Globe, Lock, Activity, Eye, Crown, Scale, Key,
  FileText, ShieldCheck, AlertTriangle, ExternalLink,
  Fingerprint, MonitorSmartphone, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const EnterpriseUpgradeWall = lazy(() => import("@/components/enterprise/EnterpriseUpgradeWall"));

/* ═══ Types ═══ */
interface KpiStat {
  labelAr: string;
  labelEn: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

/* ═══ Helpers ═══ */
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const STATUS_COLORS = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-destructive",
} as const;

const StatusDot = ({ status }: { status: keyof typeof STATUS_COLORS }) => (
  <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status]}`} />
);

/* ═══ SECTION: Role Management ═══ */
const RoleManagementSection = ({ tenantId, isRTL, navigate }: { tenantId: string; isRTL: boolean; navigate: (p: string) => void }) => {
  const { data: roles } = useQuery({
    queryKey: ["gov-roles", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_roles")
        .select("id, name, name_ar, is_system, description")
        .eq("tenant_id", tenantId)
        .order("is_system", { ascending: false });
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(roles ?? []).slice(0, 6).map((role) => (
          <div key={role.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              {role.is_system ? <Lock className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{isRTL ? role.name_ar : role.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {role.is_system ? (isRTL ? "نظامي" : "System") : (isRTL ? "مخصص" : "Custom")}
                {role.description?.includes("template") && (
                  <Badge variant="outline" className="text-[8px] ms-1 px-1 py-0">
                    <Crown className="h-2 w-2 me-0.5" />Template
                  </Badge>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
      {(roles?.length ?? 0) > 6 && (
        <p className="text-xs text-muted-foreground text-center">
          +{(roles?.length ?? 0) - 6} {isRTL ? "أدوار أخرى" : "more roles"}
        </p>
      )}
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate("/dashboard/permissions")}>
        <Key className="h-3.5 w-3.5" />
        {isRTL ? "إدارة الصلاحيات الكاملة" : "Full Permissions Manager"}
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
};

/* ═══ SECTION: Access Matrix ═══ */
const AccessMatrixSection = ({ tenantId, isRTL }: { tenantId: string; isRTL: boolean }) => {
  const CORE_MODULES = [
    { key: "invoices", ar: "الفواتير", en: "Invoices" },
    { key: "expenses", ar: "المصروفات", en: "Expenses" },
    { key: "customers", ar: "العملاء", en: "Customers" },
    { key: "inventory", ar: "المخزون", en: "Inventory" },
    { key: "finance", ar: "المالية", en: "Finance" },
    { key: "audit", ar: "التدقيق", en: "Audit" },
  ];

  const { data } = useQuery({
    queryKey: ["gov-matrix", tenantId],
    queryFn: async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("custom_roles").select("id, name, name_ar").eq("tenant_id", tenantId).limit(5),
        supabase.from("role_permissions").select("role_id, permission_key").eq("tenant_id", tenantId),
      ]);
      return {
        roles: rolesRes.data ?? [],
        perms: permsRes.data ?? [],
      };
    },
    enabled: !!tenantId,
  });

  const hasAccess = (roleId: string, moduleKey: string) => {
    return (data?.perms ?? []).some(
      (p) => p.role_id === roleId && p.permission_key.startsWith(moduleKey)
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-start p-2 font-semibold text-muted-foreground">
              {isRTL ? "الدور" : "Role"}
            </th>
            {CORE_MODULES.map((m) => (
              <th key={m.key} className="p-2 text-center font-semibold text-muted-foreground">
                {isRTL ? m.ar : m.en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data?.roles ?? []).map((role) => (
            <tr key={role.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-2 font-medium">{isRTL ? role.name_ar : role.name}</td>
              {CORE_MODULES.map((m) => (
                <td key={m.key} className="p-2 text-center">
                  {hasAccess(role.id, m.key) ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(data?.roles?.length ?? 0) === 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          {isRTL ? "لا توجد أدوار مخصصة بعد" : "No custom roles yet"}
        </p>
      )}
    </div>
  );
};

/* ═══ SECTION: Security Policies ═══ */
const SecurityPoliciesSection = ({ tenantId, isRTL, navigate }: { tenantId: string; isRTL: boolean; navigate: (p: string) => void }) => {
  const { data: secData } = useQuery({
    queryKey: ["gov-security", tenantId],
    queryFn: async () => {
      const [sessions, policies] = await Promise.all([
        supabase.from("active_sessions").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("revoked", false),
        supabase.from("governance_policies").select("policy_type, is_active").eq("tenant_id", tenantId),
      ]);
      const activePolicies = (policies.data ?? []) as Array<{ policy_type: string; is_active: boolean }>;
      return {
        sessionsCount: sessions.count ?? 0,
        passwordPolicy: activePolicies.some((p) => p.policy_type === "password_policy" && p.is_active),
        twoFactorEnforced: activePolicies.some((p) => p.policy_type === "force_2fa" && p.is_active),
        ipRestrictions: activePolicies.some((p) => p.policy_type === "ip_whitelist" && p.is_active),
        ssoEnabled: false,
      };
    },
    enabled: !!tenantId,
  });

  const policies = [
    {
      labelAr: "سياسة كلمة المرور", labelEn: "Password Policy",
      icon: Lock, status: secData?.passwordPolicy ? "green" as const : "yellow" as const,
      statusAr: secData?.passwordPolicy ? "مفعّلة" : "غير مفعّلة",
      statusEn: secData?.passwordPolicy ? "Active" : "Inactive",
    },
    {
      labelAr: "المصادقة الثنائية", labelEn: "2FA Enforcement",
      icon: Fingerprint, status: secData?.twoFactorEnforced ? "green" as const : "red" as const,
      statusAr: secData?.twoFactorEnforced ? "مفروضة" : "غير مفروضة",
      statusEn: secData?.twoFactorEnforced ? "Enforced" : "Not enforced",
    },
    {
      labelAr: "تسجيل دخول موحد (SSO)", labelEn: "SSO",
      icon: Globe, status: secData?.ssoEnabled ? "green" as const : "yellow" as const,
      statusAr: secData?.ssoEnabled ? "مفعّل" : "غير مفعّل",
      statusEn: secData?.ssoEnabled ? "Active" : "Inactive",
    },
    {
      labelAr: "تقييد عناوين IP", labelEn: "IP Restrictions",
      icon: Shield, status: secData?.ipRestrictions ? "green" as const : "yellow" as const,
      statusAr: secData?.ipRestrictions ? "مفعّل" : "غير مفعّل",
      statusEn: secData?.ipRestrictions ? "Active" : "Inactive",
    },
    {
      labelAr: "الجلسات النشطة", labelEn: "Active Sessions",
      icon: MonitorSmartphone, status: "green" as const,
      statusAr: `${secData?.sessionsCount ?? 0} جلسة`,
      statusEn: `${secData?.sessionsCount ?? 0} sessions`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {policies.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <p.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{isRTL ? p.labelAr : p.labelEn}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status={p.status} />
              <span className="text-xs text-muted-foreground">
                {isRTL ? p.statusAr : p.statusEn}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => navigate("/dashboard/enterprise/security-policies")}>
          {isRTL ? "إدارة السياسات" : "Manage Policies"}
          <ExternalLink className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => navigate("/dashboard/enterprise/sessions")}>
          {isRTL ? "مراقبة الجلسات" : "Monitor Sessions"}
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

/* ═══ SECTION: Audit & Logs ═══ */
const AuditLogsSection = ({ tenantId, isRTL, navigate }: { tenantId: string; isRTL: boolean; navigate: (p: string) => void }) => {
  const { data: recentLogs } = useQuery({
    queryKey: ["gov-audit", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_label, created_at, user_id")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
    create: { ar: "إنشاء", en: "Create" },
    update: { ar: "تعديل", en: "Update" },
    delete: { ar: "حذف", en: "Delete" },
    approve: { ar: "اعتماد", en: "Approve" },
    reject: { ar: "رفض", en: "Reject" },
  };

  return (
    <div className="space-y-3">
      <ScrollArea className="h-[280px]">
        <div className="space-y-1.5">
          {(recentLogs ?? []).map((log) => {
            const actionInfo = ACTION_LABELS[log.action] ?? { ar: log.action, en: log.action };
            const time = new Date(log.created_at);
            return (
              <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    <span className="text-primary">{isRTL ? actionInfo.ar : actionInfo.en}</span>
                    {" — "}
                    {log.entity_label || log.entity_type}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {time.toLocaleDateString(isRTL ? "ar-SA" : "en-US")} • {time.toLocaleTimeString(isRTL ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
          {(recentLogs?.length ?? 0) === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {isRTL ? "لا توجد سجلات حديثة" : "No recent logs"}
            </p>
          )}
        </div>
      </ScrollArea>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => navigate("/dashboard/audit")}>
        <Eye className="h-3.5 w-3.5" />
        {isRTL ? "عرض سجل التدقيق الكامل" : "View Full Audit Log"}
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
};

/* ═══ SECTION: Compliance Snapshot ═══ */
const ComplianceSnapshotSection = ({ isRTL }: { isRTL: boolean }) => {
  const items = [
    {
      labelAr: "الفوترة الإلكترونية (ZATCA المرحلة 2)",
      labelEn: "E-Invoicing (ZATCA Phase 2)",
      status: "green" as const,
      detailAr: "متوافق",
      detailEn: "Compliant",
    },
    {
      labelAr: "تقديم إقرار ضريبة القيمة المضافة",
      labelEn: "VAT Return Submission",
      status: "yellow" as const,
      detailAr: "يتطلب مراجعة",
      detailEn: "Review needed",
    },
    {
      labelAr: "جودة البيانات المالية",
      labelEn: "Financial Data Quality",
      status: "green" as const,
      detailAr: "جيدة",
      detailEn: "Good",
    },
    {
      labelAr: "سياسة الاحتفاظ بالسجلات",
      labelEn: "Record Retention Policy",
      status: "yellow" as const,
      detailAr: "قيد الإعداد",
      detailEn: "In progress",
    },
  ];

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <StatusDot status={item.status} />
          <div className="flex-1">
            <p className="text-sm font-medium">{isRTL ? item.labelAr : item.labelEn}</p>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              item.status === "green" ? "bg-emerald-500/10 text-emerald-600" :
              item.status === "yellow" ? "bg-amber-500/10 text-amber-600" :
              "bg-destructive/10 text-destructive"
            }`}
          >
            {isRTL ? item.detailAr : item.detailEn}
          </Badge>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-center">
        {isRTL ? "* المؤشرات الحالية تقريبية — سيتم ربطها ببيانات حية في المرحلة التالية" : "* Current indicators are approximate — live data integration coming in Phase 2"}
      </p>
    </div>
  );
};

/* ═══ MAIN COMPONENT ═══ */
const SECTIONS = [
  {
    id: "roles",
    titleAr: "إدارة الأدوار",
    titleEn: "Role Management",
    descAr: "الأدوار المخصصة والقوالب الجاهزة",
    descEn: "Custom roles and pre-built templates",
    icon: Users,
  },
  {
    id: "matrix",
    titleAr: "مصفوفة الوصول",
    titleEn: "Access Matrix",
    descAr: "ملخص بصري للأدوار × الوحدات",
    descEn: "Visual summary of roles × modules",
    icon: Scale,
  },
  {
    id: "security",
    titleAr: "السياسات الأمنية",
    titleEn: "Security Policies",
    descAr: "كلمات المرور والمصادقة والجلسات",
    descEn: "Passwords, 2FA, sessions, and IP",
    icon: Shield,
  },
  {
    id: "audit",
    titleAr: "التدقيق والسجلات",
    titleEn: "Audit & Logs",
    descAr: "آخر 10 عمليات وسجل التدقيق الكامل",
    descEn: "Last 10 operations and full audit trail",
    icon: Eye,
  },
  {
    id: "compliance",
    titleAr: "لقطة الامتثال",
    titleEn: "Compliance Snapshot",
    descAr: "ZATCA وضريبة القيمة المضافة وجودة البيانات",
    descEn: "ZATCA, VAT, and data quality",
    icon: ShieldCheck,
  },
];

const GovernanceCenterPage = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const { entitlements } = useEntitlements();
  const isEnterprise = entitlements?.enterprise_mode?.allowed === true;

  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // KPI stats
  const { data: kpi } = useQuery({
    queryKey: ["gov-center-kpi", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const [roles, sessions, lastAudit] = await Promise.all([
        supabase.from("custom_roles").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("active_sessions").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("revoked", false),
        supabase.from("audit_logs").select("created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).single(),
      ]);
      return {
        rolesCount: roles.count ?? 0,
        activeSessions: sessions.count ?? 0,
        lastAuditEvent: lastAudit.data?.created_at ?? null,
      };
    },
    enabled: !!tenantId,
  });

  // Show upgrade wall for non-enterprise
  if (!isEnterprise) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
        <EnterpriseUpgradeWall featureContext={isRTL ? "مركز الحوكمة" : "Governance Center"} />
      </Suspense>
    );
  }

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const lastAuditFormatted = kpi?.lastAuditEvent
    ? new Date(kpi.lastAuditEvent).toLocaleDateString(isRTL ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : (isRTL ? "لا يوجد" : "None");

  const kpiStats: KpiStat[] = [
    { labelAr: "الأدوار", labelEn: "Roles", value: kpi?.rolesCount ?? 0, icon: Users, color: "text-primary", bgColor: "bg-primary/10" },
    { labelAr: "جلسات نشطة", labelEn: "Active Sessions", value: kpi?.activeSessions ?? 0, icon: Activity, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { labelAr: "آخر حدث تدقيق", labelEn: "Last Audit", value: lastAuditFormatted, icon: FileText, color: "text-violet-500", bgColor: "bg-violet-500/10" },
    { labelAr: "نقاط الامتثال", labelEn: "Compliance", value: "85%", icon: ShieldCheck, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  ];

  const renderSectionContent = (sectionId: string) => {
    if (!tenantId) return null;
    switch (sectionId) {
      case "roles": return <RoleManagementSection tenantId={tenantId} isRTL={isRTL} navigate={navigate} />;
      case "matrix": return <AccessMatrixSection tenantId={tenantId} isRTL={isRTL} />;
      case "security": return <SecurityPoliciesSection tenantId={tenantId} isRTL={isRTL} navigate={navigate} />;
      case "audit": return <AuditLogsSection tenantId={tenantId} isRTL={isRTL} navigate={navigate} />;
      case "compliance": return <ComplianceSnapshotSection isRTL={isRTL} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ── */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 enterprise-shadow">
            <Building2 className="h-6 w-6 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {isRTL ? "مركز الحوكمة" : "Governance Center"}
              </h1>
              <Badge className="enterprise-indicator border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                Enterprise
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "نظرة شاملة على الأمان والصلاحيات والامتثال المؤسسي"
                : "Unified view of security, permissions, and corporate compliance"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiStats.map((stat, i) => (
          <motion.div key={stat.labelEn} {...fadeUp} transition={{ delay: 0.05 + i * 0.04 }}>
            <Card className="enterprise-card">
              <CardContent className="flex items-center gap-3 pt-4 pb-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums leading-tight">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{isRTL ? stat.labelAr : stat.labelEn}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Separator />

      {/* ── Sections with Progressive Disclosure ── */}
      <div className="space-y-3">
        {SECTIONS.map((section, i) => {
          const isExpanded = expandedSection === section.id;
          const Icon = section.icon;

          return (
            <motion.div
              key={section.id}
              {...fadeUp}
              transition={{ delay: 0.08 + i * 0.04 }}
            >
              <Card className={`transition-all duration-300 ${isExpanded ? "enterprise-card ring-1 ring-accent/20" : "hover:shadow-sm"}`}>
                {/* Collapsed header (always visible) */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-4 p-5 text-start"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 shrink-0">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{isRTL ? section.titleAr : section.titleEn}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? section.descAr : section.descEn}</p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {/* Expanded content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0">
                        <Separator className="mb-4" />
                        {renderSectionContent(section.id)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default GovernanceCenterPage;
