/**
 * GovernanceHub — /dashboard/enterprise
 * 
 * Unified governance center with progressive disclosure.
 * Shows all governance tools organized by category.
 * Non-enterprise users see the upgrade wall.
 */
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2, Shield, Users, CheckCircle2, Clock,
  Globe, FileText, Lock, AlertTriangle, ChevronLeft,
  Workflow, ShieldCheck, Activity, Eye, Crown, Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const EnterpriseUpgradeWall = lazy(() => import("@/components/enterprise/EnterpriseUpgradeWall"));

interface GovernanceSection {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  route: string;
  tier: "starter" | "business" | "enterprise";
  items: { ar: string; en: string }[];
}

const GOVERNANCE_SECTIONS: GovernanceSection[] = [
  {
    id: "roles",
    titleAr: "الأدوار والصلاحيات",
    titleEn: "Roles & Permissions",
    descAr: "تحكم دقيق في من يرى ماذا ومن يعدّل ماذا",
    descEn: "Fine-grained control over who sees and edits what",
    icon: Users,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    route: "/dashboard/permissions",
    tier: "starter",
    items: [
      { ar: "إدارة أدوار الفريق", en: "Team role management" },
      { ar: "صلاحيات على مستوى الحقل", en: "Field-level permissions" },
      { ar: "قوالب أدوار جاهزة", en: "Pre-built role templates" },
    ],
  },
  {
    id: "approvals",
    titleAr: "سلاسل الموافقات",
    titleEn: "Approval Chains",
    descAr: "سير عمل اعتماد مرن للفواتير والمصروفات والعقود",
    descEn: "Flexible approval workflows for invoices, expenses, and contracts",
    icon: Workflow,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    route: "/dashboard/approvals",
    tier: "business",
    items: [
      { ar: "موافقات متعددة المستويات", en: "Multi-level approvals" },
      { ar: "شروط ديناميكية (مبلغ، قسم)", en: "Dynamic conditions (amount, dept)" },
      { ar: "منع الموافقة الذاتية", en: "Self-approval prevention" },
    ],
  },
  {
    id: "audit",
    titleAr: "سجل التدقيق",
    titleEn: "Audit Trail",
    descAr: "تتبع كل عملية مع لقطات قبل/بعد",
    descEn: "Track every operation with before/after snapshots",
    icon: Eye,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    route: "/dashboard/audit-log",
    tier: "business",
    items: [
      { ar: "سجل تدقيق غير قابل للحذف", en: "Immutable audit log" },
      { ar: "مقارنة تفاصيل التغييرات", en: "Diff comparison" },
      { ar: "تصدير للمراجعين الخارجيين", en: "Export for external auditors" },
    ],
  },
  {
    id: "periods",
    titleAr: "قفل الفترات المحاسبية",
    titleEn: "Period Locking",
    descAr: "إغلاق الفترات لمنع التعديل بعد الإقفال",
    descEn: "Lock periods to prevent post-close modifications",
    icon: Lock,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    route: "/dashboard/period-lock",
    tier: "business",
    items: [
      { ar: "إغلاق شهري/ربعي/سنوي", en: "Monthly/quarterly/yearly close" },
      { ar: "منع الترحيل في فترات مغلقة", en: "Block posting to closed periods" },
      { ar: "سجل إغلاق مع المسؤول والتاريخ", en: "Close log with user & timestamp" },
    ],
  },
  {
    id: "governance",
    titleAr: "سياسات الحوكمة",
    titleEn: "Governance Policies",
    descAr: "فصل المهام وحدود الاعتماد وقيود المعاملات",
    descEn: "Segregation of duties, approval limits, transaction caps",
    icon: Scale,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    route: "/dashboard/governance",
    tier: "enterprise",
    items: [
      { ar: "فصل المهام (Segregation of Duties)", en: "Segregation of Duties" },
      { ar: "حدود اعتماد مالي لكل دور", en: "Approval limits per role" },
      { ar: "رصد الانتهاكات تلقائياً", en: "Automatic violation detection" },
    ],
  },
  {
    id: "ip",
    titleAr: "تقييد عناوين IP",
    titleEn: "IP Restrictions",
    descAr: "السماح بالوصول فقط من شبكات محددة",
    descEn: "Allow access only from specified networks",
    icon: Globe,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    route: "/dashboard/enterprise/ip-restrictions",
    tier: "enterprise",
    items: [
      { ar: "قائمة IP بيضاء", en: "IP Whitelist" },
      { ar: "حظر تلقائي للوصول غير المصرح", en: "Auto-block unauthorized access" },
    ],
  },
  {
    id: "sessions",
    titleAr: "مراقبة الجلسات",
    titleEn: "Session Monitoring",
    descAr: "تتبع الجلسات النشطة وإنهاؤها عن بُعد",
    descEn: "Track active sessions and revoke remotely",
    icon: Activity,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    route: "/dashboard/enterprise/sessions",
    tier: "enterprise",
    items: [
      { ar: "عرض جميع الجلسات النشطة", en: "View all active sessions" },
      { ar: "إنهاء جلسة عن بُعد", en: "Remote session termination" },
      { ar: "تحديد عدد الجلسات المتزامنة", en: "Concurrent session limits" },
    ],
  },
  {
    id: "role-templates",
    titleAr: "قوالب الأدوار المؤسسية",
    titleEn: "Corporate Role Templates",
    descAr: "أدوار جاهزة بصلاحيات محددة مسبقاً بنقرة واحدة",
    descEn: "Pre-built roles with one-click setup",
    icon: Crown,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    route: "/dashboard/enterprise/role-templates",
    tier: "enterprise",
    items: [
      { ar: "المدير المالي (CFO)", en: "CFO" },
      { ar: "المراقب المالي", en: "Finance Controller" },
      { ar: "المدقق الداخلي", en: "Internal Auditor" },
      { ar: "مسؤول الامتثال", en: "Compliance Officer" },
    ],
  },
];

const TIER_ORDER: Record<string, number> = { starter: 0, business: 1, enterprise: 2 };
const TIER_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  starter: { ar: "أساسي", en: "Starter", color: "bg-muted text-muted-foreground" },
  business: { ar: "أعمال", en: "Business", color: "bg-blue-500/10 text-blue-600" },
  enterprise: { ar: "مؤسسات", en: "Enterprise", color: "bg-accent/10 text-accent" },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const GovernanceHub = () => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { tenantId } = useAuth();
  const { entitlements, planSlug } = useEntitlements();
  const isEnterprise = entitlements?.enterprise_mode?.allowed === true;
  const currentTier = planSlug || "starter";
  const currentTierOrder = TIER_ORDER[currentTier] ?? 0;

  // Quick stats
  const { data: stats } = useQuery({
    queryKey: ["governance-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const [policies, violations, sessions] = await Promise.all([
        supabase.from("governance_policies").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
        supabase.from("policy_violations").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("resolved", false),
        supabase.from("active_sessions").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("revoked", false),
      ]);
      return {
        activePolicies: policies.count ?? 0,
        unresolvedViolations: violations.count ?? 0,
        activeSessions: sessions.count ?? 0,
      };
    },
    enabled: !!tenantId,
  });

  // Compliance score calculation
  const complianceChecks = [
    { check: "rls_enabled", met: true },
    { check: "audit_enabled", met: currentTierOrder >= 1 },
    { check: "approval_chains", met: currentTierOrder >= 1 },
    { check: "period_locking", met: currentTierOrder >= 1 },
    { check: "governance_policies", met: isEnterprise },
    { check: "ip_restrictions", met: isEnterprise },
    { check: "session_monitoring", met: isEnterprise },
    { check: "segregation_of_duties", met: isEnterprise },
    { check: "role_templates", met: isEnterprise },
    { check: "2fa_enforced", met: isEnterprise },
  ];
  const complianceScore = Math.round((complianceChecks.filter(c => c.met).length / complianceChecks.length) * 100);

  const isFeatureAvailable = (tier: string) => {
    return TIER_ORDER[tier] <= currentTierOrder;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isEnterprise ? 'bg-accent/10 enterprise-shadow' : 'bg-primary/10'}`}>
            <Building2 className={`h-6 w-6 ${isEnterprise ? 'text-accent' : 'text-primary'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {isRTL ? "مركز الحوكمة" : "Governance Center"}
              </h1>
              {isEnterprise && (
                <Badge className="enterprise-indicator border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">
                  Enterprise
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "إدارة مركزية للصلاحيات والأمان والامتثال"
                : "Centralized management for permissions, security, and compliance"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Compliance Score + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Compliance Score */}
        <motion.div {...fadeUp} transition={{ delay: 0.05 }}>
          <Card className={isEnterprise ? "enterprise-card" : ""}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {isRTL ? "نقاط الامتثال" : "Compliance Score"}
                </span>
                <ShieldCheck className={`h-5 w-5 ${complianceScore >= 80 ? 'text-emerald-500' : complianceScore >= 50 ? 'text-amber-500' : 'text-red-500'}`} />
              </div>
              <div className="text-3xl font-bold tabular-nums">{complianceScore}%</div>
              <Progress value={complianceScore} className="h-2" />
              {complianceScore < 80 && (
                <p className="text-[10px] text-muted-foreground">
                  {isRTL
                    ? "ارفع نقاطك بترقية باقتك وتفعيل ميزات الحوكمة"
                    : "Improve by upgrading and enabling governance features"}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        {[
          {
            label: isRTL ? "سياسات نشطة" : "Active Policies",
            value: stats?.activePolicies ?? 0,
            icon: Shield,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
          },
          {
            label: isRTL ? "انتهاكات مفتوحة" : "Open Violations",
            value: stats?.unresolvedViolations ?? 0,
            icon: AlertTriangle,
            color: (stats?.unresolvedViolations ?? 0) > 0 ? "text-red-500" : "text-emerald-500",
            bgColor: (stats?.unresolvedViolations ?? 0) > 0 ? "bg-red-500/10" : "bg-emerald-500/10",
          },
          {
            label: isRTL ? "جلسات نشطة" : "Active Sessions",
            value: stats?.activeSessions ?? 0,
            icon: Activity,
            color: "text-violet-500",
            bgColor: "bg-violet-500/10",
          },
        ].map((stat, i) => (
          <motion.div key={stat.label} {...fadeUp} transition={{ delay: 0.1 + i * 0.05 }}>
            <Card className={isEnterprise ? "enterprise-card" : ""}>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Separator />

      {/* Governance Sections - Progressive Disclosure */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {isRTL ? "أدوات الحوكمة" : "Governance Tools"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {GOVERNANCE_SECTIONS.map((section, i) => {
            const available = isFeatureAvailable(section.tier);
            const Icon = section.icon;
            const tierInfo = TIER_LABELS[section.tier];

            return (
              <motion.div
                key={section.id}
                {...fadeUp}
                transition={{ delay: 0.05 * i }}
              >
                <Card
                  className={`h-full transition-all duration-300 cursor-pointer group ${
                    available
                      ? isEnterprise ? "enterprise-card" : "hover:shadow-md hover:-translate-y-0.5"
                      : "opacity-75 hover:opacity-90"
                  }`}
                  onClick={() => {
                    if (available) {
                      navigate(section.route);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${section.bgColor}`}>
                          <Icon className={`h-5 w-5 ${section.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">
                            {isRTL ? section.titleAr : section.titleEn}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {isRTL ? section.descAr : section.descEn}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${tierInfo.color}`}>
                        {isRTL ? tierInfo.ar : tierInfo.en}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <ul className="space-y-1">
                      {section.items.map((item, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className={`h-3 w-3 shrink-0 ${available ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                          <span>{isRTL ? item.ar : item.en}</span>
                        </li>
                      ))}
                    </ul>

                    {!available && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/dashboard/subscription");
                          }}
                        >
                          <Lock className="h-3 w-3" />
                          {isRTL ? "ترقية لفتح الميزة" : "Upgrade to unlock"}
                        </Button>
                      </div>
                    )}

                    {available && (
                      <div className="pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs gap-1.5 group-hover:bg-muted"
                        >
                          {isRTL ? "فتح" : "Open"}
                          <ChevronLeft className={`h-3 w-3 ${isRTL ? '' : 'rotate-180'}`} />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Enterprise Upgrade CTA for non-enterprise users */}
      {!isEnterprise && (
        <Suspense fallback={null}>
          <EnterpriseUpgradeWall compact />
        </Suspense>
      )}
    </div>
  );
};

export default GovernanceHub;
