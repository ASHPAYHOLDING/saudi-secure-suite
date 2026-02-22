import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HrReportsPage() {
  const { tenantId } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["hr-reports-stats", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const [empByStatus, leaveByType, attThisMonth] = await Promise.all([
        supabase.from("hr_employees").select("status").eq("tenant_id", tenantId!),
        supabase.from("hr_leave_requests").select("status, days_count").eq("tenant_id", tenantId!),
        supabase.from("hr_attendance_logs").select("status").eq("tenant_id", tenantId!)
          .gte("log_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]),
      ]);

      const empCounts: Record<string, number> = {};
      (empByStatus.data ?? []).forEach((e: any) => { empCounts[e.status] = (empCounts[e.status] ?? 0) + 1; });

      const leaveCounts = { total: (leaveByType.data ?? []).length, approved: 0, pending: 0, totalDays: 0 };
      (leaveByType.data ?? []).forEach((l: any) => {
        if (l.status === "approved") { leaveCounts.approved++; leaveCounts.totalDays += Number(l.days_count); }
        if (l.status === "pending") leaveCounts.pending++;
      });

      const attCounts: Record<string, number> = {};
      (attThisMonth.data ?? []).forEach((a: any) => { attCounts[a.status] = (attCounts[a.status] ?? 0) + 1; });

      return { empCounts, leaveCounts, attCounts };
    },
  });

  const STATUS_AR: Record<string, string> = { active: "نشط", on_leave: "في إجازة", suspended: "موقوف", terminated: "منتهي", resigned: "مستقيل" };
  const ATT_AR: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", half_day: "نصف يوم" };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5" />تقارير الموارد البشرية</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />توزيع الموظفين</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats?.empCounts && Object.entries(stats.empCounts).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm"><span>{STATUS_AR[k] ?? k}</span><span className="font-bold">{v}</span></div>
            ))}
            {!stats?.empCounts && <p className="text-sm text-muted-foreground">لا توجد بيانات</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />ملخص الإجازات</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span>إجمالي الطلبات</span><span className="font-bold">{stats?.leaveCounts.total ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span>مقبولة</span><span className="font-bold text-primary">{stats?.leaveCounts.approved ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span>معلقة</span><span className="font-bold text-accent-foreground">{stats?.leaveCounts.pending ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span>إجمالي الأيام المستخدمة</span><span className="font-bold">{stats?.leaveCounts.totalDays ?? 0}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />حضور هذا الشهر</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats?.attCounts && Object.entries(stats.attCounts).map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm"><span>{ATT_AR[k] ?? k}</span><span className="font-bold">{v}</span></div>
            ))}
            {(!stats?.attCounts || Object.keys(stats.attCounts).length === 0) && <p className="text-sm text-muted-foreground">لا توجد بيانات</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
