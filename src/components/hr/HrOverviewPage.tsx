import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Calendar, Clock, Building2, UserCheck, BarChart3, ArrowUpRight, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function HrOverviewPage() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["hr-overview", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [empRes, leaveRes, attRes, contractRes, deptRes] = await Promise.all([
        supabase.from("hr_employees").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "active"),
        supabase.from("hr_leave_requests").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending"),
        supabase.from("hr_attendance_logs").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("log_date", new Date().toISOString().split("T")[0]),
        supabase.from("hr_contracts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_current", true),
        supabase.from("org_departments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_active", true),
      ]);
      return {
        employees: empRes.count ?? 0,
        pendingLeave: leaveRes.count ?? 0,
        todayAttendance: attRes.count ?? 0,
        activeContracts: contractRes.count ?? 0,
        departments: deptRes.count ?? 0,
      };
    },
  });

  const kpis = [
    {
      titleAr: "الموظفون النشطون",
      titleEn: "Active Employees",
      value: stats?.employees ?? 0,
      icon: Users,
      path: "/dashboard/hr/employees",
      accent: "bg-primary/10 text-primary",
    },
    {
      titleAr: "العقود السارية",
      titleEn: "Active Contracts",
      value: stats?.activeContracts ?? 0,
      icon: FileText,
      path: "/dashboard/hr/contracts",
      accent: "bg-emerald-500/10 text-emerald-500",
    },
    {
      titleAr: "طلبات إجازة معلقة",
      titleEn: "Pending Leave Requests",
      value: stats?.pendingLeave ?? 0,
      icon: Calendar,
      path: "/dashboard/hr/approvals",
      accent: "bg-amber-500/10 text-amber-500",
    },
    {
      titleAr: "حضور اليوم",
      titleEn: "Today's Attendance",
      value: stats?.todayAttendance ?? 0,
      icon: Clock,
      path: "/dashboard/hr/attendance",
      accent: "bg-sky-500/10 text-sky-500",
    },
  ];

  const quickLinks = [
    { titleAr: "إدارة الموظفين", titleEn: "Employee Management", descAr: "عرض وإضافة وتعديل بيانات الموظفين", icon: Users, path: "/dashboard/hr/employees" },
    { titleAr: "العقود", titleEn: "Contracts", descAr: "عقود العمل والاتفاقيات", icon: FileText, path: "/dashboard/hr/contracts" },
    { titleAr: "الهيكل التنظيمي", titleEn: "Org Structure", descAr: "الأقسام والمسميات الوظيفية", icon: Building2, path: "/dashboard/hr/org" },
    { titleAr: "الإجازات", titleEn: "Leave Management", descAr: "أنواع الإجازات وطلبات الموظفين", icon: Calendar, path: "/dashboard/hr/leave" },
    { titleAr: "الحضور والانصراف", titleEn: "Attendance", descAr: "سجلات الدوام اليومي واستيراد البيانات", icon: Clock, path: "/dashboard/hr/attendance" },
    { titleAr: "الموافقات", titleEn: "Approvals", descAr: "اعتماد ومراجعة طلبات الإجازات", icon: UserCheck, path: "/dashboard/hr/approvals" },
    { titleAr: "التقارير", titleEn: "Reports", descAr: "تقارير وإحصائيات الموارد البشرية", icon: BarChart3, path: "/dashboard/hr/reports" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">الموارد البشرية</h1>
            <p className="text-xs text-muted-foreground">Human Resources Overview</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">لوحة متابعة شاملة لإدارة شؤون الموظفين والعمليات التشغيلية</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.titleEn}
            className="cursor-pointer hover:shadow-md transition-all duration-200 group border-border/50"
            onClick={() => navigate(kpi.path)}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground leading-tight">{kpi.titleAr}</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">
                    {isLoading ? "—" : kpi.value.toLocaleString("ar-SA")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">{kpi.titleEn}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.accent} shrink-0`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <span>عرض التفاصيل</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Access */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">وصول سريع</h2>
            <p className="text-xs text-muted-foreground">Quick Access</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Card
              key={link.titleEn}
              className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 group border-border/50"
              onClick={() => navigate(link.path)}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted shrink-0 group-hover:bg-primary/10 transition-colors">
                  <link.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{link.titleAr}</p>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">{link.titleEn}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{link.descAr}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
