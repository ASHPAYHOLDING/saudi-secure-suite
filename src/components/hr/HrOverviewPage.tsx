import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Calendar, Clock, TrendingUp, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function HrOverviewPage() {
  const { tenantId } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ["hr-overview", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [empRes, leaveRes, attRes, contractRes] = await Promise.all([
        supabase.from("hr_employees").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "active"),
        supabase.from("hr_leave_requests").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("status", "pending"),
        supabase.from("hr_attendance_logs").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("log_date", new Date().toISOString().split("T")[0]),
        supabase.from("hr_contracts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId!).eq("is_current", true),
      ]);
      return {
        employees: empRes.count ?? 0,
        pendingLeave: leaveRes.count ?? 0,
        todayAttendance: attRes.count ?? 0,
        activeContracts: contractRes.count ?? 0,
      };
    },
  });

  const cards = [
    { title: "الموظفون النشطون", value: stats?.employees ?? 0, icon: Users, path: "/dashboard/hr/employees", color: "text-primary" },
    { title: "العقود السارية", value: stats?.activeContracts ?? 0, icon: FileText, path: "/dashboard/hr/contracts", color: "text-primary" },
    { title: "طلبات إجازة معلقة", value: stats?.pendingLeave ?? 0, icon: Calendar, path: "/dashboard/hr/approvals", color: "text-accent-foreground" },
    { title: "حضور اليوم", value: stats?.todayAttendance ?? 0, icon: Clock, path: "/dashboard/hr/attendance", color: "text-muted-foreground" },
  ];

  const quickLinks = [
    { title: "الموظفون", desc: "إضافة وإدارة بيانات الموظفين", icon: Users, path: "/dashboard/hr/employees" },
    { title: "الهيكل التنظيمي", desc: "الأقسام والمسميات الوظيفية", icon: TrendingUp, path: "/dashboard/hr/org" },
    { title: "الإجازات", desc: "أنواع الإجازات والطلبات", icon: Calendar, path: "/dashboard/hr/leave" },
    { title: "الحضور", desc: "سجل الحضور والانصراف", icon: Clock, path: "/dashboard/hr/attendance" },
    { title: "الموافقات", desc: "اعتماد طلبات الإجازات", icon: UserCheck, path: "/dashboard/hr/approvals" },
    { title: "التقارير", desc: "تقارير الموارد البشرية", icon: FileText, path: "/dashboard/hr/reports" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الموارد البشرية</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على إدارة شؤون الموظفين</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(c.path)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.title}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
                <c.icon className={`h-8 w-8 ${c.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">وصول سريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map((l) => (
            <Card key={l.title} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(l.path)}>
              <CardContent className="p-4 flex items-start gap-3">
                <l.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{l.title}</p>
                  <p className="text-xs text-muted-foreground">{l.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
