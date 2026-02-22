import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function HrApprovalsPage() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["hr-pending-leave", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("hr_leave_requests")
        .select("*, hr_employees(first_name, last_name, employee_number), hr_leave_types(name)")
        .eq("tenant_id", tenantId!).eq("status", "pending").order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const actionMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("hr_leave_requests").update({
        status: status as any, reviewed_at: new Date().toISOString(),
      }).eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "تم قبول الطلب" : "تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["hr-pending-leave"] });
      qc.invalidateQueries({ queryKey: ["hr-leave-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><UserCheck className="h-5 w-5" />موافقات الإجازات</h1>
      {pending.length === 0 && !isLoading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد طلبات معلقة 🎉</CardContent></Card>
      )}
      {pending.length > 0 && (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>الموظف</TableHead><TableHead>نوع الإجازة</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>الأيام</TableHead><TableHead>السبب</TableHead><TableHead>إجراء</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pending.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.hr_employees?.first_name} {r.hr_employees?.last_name}</TableCell>
                  <TableCell>{r.hr_leave_types?.name}</TableCell>
                  <TableCell className="text-sm">{r.start_date}</TableCell>
                  <TableCell className="text-sm">{r.end_date}</TableCell>
                  <TableCell>{Number(r.days_count)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{r.reason ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => actionMut.mutate({ id: r.id, status: "approved" })} disabled={actionMut.isPending}>
                        <Check className="h-3 w-3 me-1" />قبول
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => actionMut.mutate({ id: r.id, status: "rejected" })} disabled={actionMut.isPending}>
                        <X className="h-3 w-3 me-1" />رفض
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
