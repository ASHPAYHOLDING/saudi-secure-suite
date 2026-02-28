/**
 * useEmployeeSelfService — Hook for ESS portal data.
 * Fetches the logged-in user's employee record, leave requests,
 * attendance, and payslips using their hr_employees.user_id linkage.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useEmployeeSelfService() {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  // 1. Get employee record for current user
  const employeeQuery = useQuery({
    queryKey: ["ess-employee", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_employees")
        .select("*, org_departments:department_id(name), org_positions:position_id(title)")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const employeeId = employeeQuery.data?.id;

  // 2. Leave requests
  const leavesQuery = useQuery({
    queryKey: ["ess-leaves", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_leave_requests")
        .select("*, hr_leave_types(name)")
        .eq("employee_id", employeeId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Attendance
  const attendanceQuery = useQuery({
    queryKey: ["ess-attendance", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_attendance_logs")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("log_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 4. Payslips
  const payslipsQuery = useQuery({
    queryKey: ["ess-payslips", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payslips")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // 5. Leave types for form
  const leaveTypesQuery = useQuery({
    queryKey: ["ess-leave-types", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_leave_types")
        .select("id, name, default_days, is_paid")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  // 6. Submit leave request
  const submitLeave = useMutation({
    mutationFn: async (params: {
      leave_type_id: string;
      start_date: string;
      end_date: string;
      days_count: number;
      reason?: string;
    }) => {
      if (!employeeId || !tenantId) throw new Error("بيانات غير مكتملة");
      const { error } = await supabase.from("hr_leave_requests").insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        leave_type_id: params.leave_type_id,
        start_date: params.start_date,
        end_date: params.end_date,
        days_count: params.days_count,
        reason: params.reason || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تقديم طلب الإجازة بنجاح");
      qc.invalidateQueries({ queryKey: ["ess-leaves"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "فشل تقديم الطلب");
    },
  });

  return {
    employee: employeeQuery.data,
    employeeLoading: employeeQuery.isLoading,
    leaves: leavesQuery.data ?? [],
    leavesLoading: leavesQuery.isLoading,
    attendance: attendanceQuery.data ?? [],
    attendanceLoading: attendanceQuery.isLoading,
    payslips: payslipsQuery.data ?? [],
    payslipsLoading: payslipsQuery.isLoading,
    leaveTypes: leaveTypesQuery.data ?? [],
    submitLeave,
  };
}
