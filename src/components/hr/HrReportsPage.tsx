import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Calendar, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HrReportsPage() {
  const { tenantId } = useAuth();

  const { data: stats, isLoading } = useQuery({
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

      const leaveCounts = { total: (leaveByType.data ?? []).length, approved: 0, pending: 0, rejected: 0, totalDays: 0 };
      (leaveByType.data ?? []).forEach((l: any) => {
        if (l.status === "approved") { leaveCounts.approved++; leaveCounts.totalDays += Number(l.days_count); }
        if (l.status === "pending") leaveCounts.pending++;
        if (l.status === "rejected") leaveCounts.rejected++;
      });

      const attCounts: Record<string, number> = {};
      (attThisMonth.data ?? []).forEach((a: any) => { attCounts[a.status] = (attCounts[a.status] ?? 0) + 1; });

      return { empCounts, leaveCounts, attCounts };
    },
  });

  const STATUS_AR: Record<string, string> = { active: "نشط", on_leave: "في إجازة", suspended: "موقوف", terminated: "منتهي", resigned: "مستقيل" };
  const STATUS_EN: Record<string, string> = { active: "Active", on_leave: "On Leave", suspended: "Suspended", terminated: "Terminated", resigned: "Resigned" };
  const ATT_AR: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", half_day: "نصف يوم" };
  const ATT_EN: Record<string, string> = { present: "Present", absent: "Absent", late: "Late", half_day: "Half Day" };

  const StatRow = ({ labelAr, labelEn, value, color }: { labelAr: string; labelEn: string; value: number; color?: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <div>
        <p className="text-sm text-foreground">{labelAr}</p>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{labelEn}</p>
      </div>
      <span className={`text-lg font-bold tabular-nums ${color ?? "text-foreground"}`}>{value.toLocaleString("ar-SA")}</span>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">تقارير الموارد البشرية</h1>
          <p className="text-xs text-muted-foreground">HR Reports & Analytics</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">جاري تحميل التقارير...</p>
          <p className="text-xs text-muted-foreground/60">Loading reports...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Employee Distribution */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10"><Users className="h-3.5 w-3.5 text-primary" /></div>
                <div>
                  <span className="block">توزيع الموظفين</span>
                  <span className="text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider">Employee Distribution</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {stats?.empCounts && Object.keys(stats.empCounts).length > 0 ? (
                Object.entries(stats.empCounts).map(([k, v]) => (
                  <StatRow key={k} labelAr={STATUS_AR[k] ?? k} labelEn={STATUS_EN[k] ?? k} value={v} color={k === "active" ? "text-primary" : undefined} />
                ))
              ) : (
                <div className="py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد بيانات موظفين</p>
                  <p className="text-xs text-muted-foreground/60">No employee data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Summary */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10"><Calendar className="h-3.5 w-3.5 text-amber-500" /></div>
                <div>
                  <span className="block">ملخص الإجازات</span>
                  <span className="text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider">Leave Summary</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <StatRow labelAr="إجمالي الطلبات" labelEn="Total Requests" value={stats?.leaveCounts.total ?? 0} />
              <StatRow labelAr="مقبولة" labelEn="Approved" value={stats?.leaveCounts.approved ?? 0} color="text-primary" />
              <StatRow labelAr="قيد المراجعة" labelEn="Pending" value={stats?.leaveCounts.pending ?? 0} color="text-amber-500" />
              <StatRow labelAr="مرفوضة" labelEn="Rejected" value={stats?.leaveCounts.rejected ?? 0} color="text-destructive" />
              <StatRow labelAr="إجمالي الأيام المستخدمة" labelEn="Total Days Used" value={stats?.leaveCounts.totalDays ?? 0} />
            </CardContent>
          </Card>

          {/* Attendance This Month */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-sky-500/10"><Clock className="h-3.5 w-3.5 text-sky-500" /></div>
                <div>
                  <span className="block">حضور هذا الشهر</span>
                  <span className="text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wider">This Month's Attendance</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {stats?.attCounts && Object.keys(stats.attCounts).length > 0 ? (
                Object.entries(stats.attCounts).map(([k, v]) => (
                  <StatRow
                    key={k}
                    labelAr={ATT_AR[k] ?? k}
                    labelEn={ATT_EN[k] ?? k}
                    value={v}
                    color={k === "present" ? "text-primary" : k === "absent" ? "text-destructive" : k === "late" ? "text-amber-500" : undefined}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد بيانات حضور</p>
                  <p className="text-xs text-muted-foreground/60">No attendance data this month</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
