import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function HrApprovalsPage({ embedded }: { embedded?: boolean } = {}) {
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
      toast.success(status === "approved" ? "تم اعتماد الطلب بنجاح | Request Approved" : "تم رفض الطلب | Request Rejected");
      qc.invalidateQueries({ queryKey: ["hr-pending-leave"] });
      qc.invalidateQueries({ queryKey: ["hr-leave-requests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className={embedded ? "space-y-6" : "p-4 sm:p-6 space-y-6"}>
      {/* Header */}
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">اعتماد الطلبات</h1>
            <p className="text-xs text-muted-foreground">Leave Approvals</p>
          </div>
        </div>
      )}

      {/* KPI */}
      <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Pending Requests / طلبات معلقة</p>
        <p className="text-2xl font-bold text-amber-500">{pending.length.toLocaleString("ar-SA")}</p>
      </CardContent></Card>

      {/* Content */}
      {!isLoading && pending.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="p-4 rounded-full bg-primary/5">
                <ShieldCheck className="h-10 w-10 text-primary/40" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">لا توجد طلبات تحتاج اعتماد</p>
                <p className="text-sm text-muted-foreground">No pending requests to review</p>
                <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto mt-3">
                  جميع طلبات الإجازات تم مراجعتها. ستظهر الطلبات الجديدة هنا تلقائياً.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">الموظف<br /><span className="text-muted-foreground/60 font-normal">Employee</span></TableHead>
                  <TableHead className="text-xs font-semibold">نوع الإجازة<br /><span className="text-muted-foreground/60 font-normal">Leave Type</span></TableHead>
                  <TableHead className="text-xs font-semibold">من<br /><span className="text-muted-foreground/60 font-normal">From</span></TableHead>
                  <TableHead className="text-xs font-semibold">إلى<br /><span className="text-muted-foreground/60 font-normal">To</span></TableHead>
                  <TableHead className="text-xs font-semibold">الأيام<br /><span className="text-muted-foreground/60 font-normal">Days</span></TableHead>
                  <TableHead className="text-xs font-semibold">السبب<br /><span className="text-muted-foreground/60 font-normal">Reason</span></TableHead>
                  <TableHead className="text-xs font-semibold">إجراء<br /><span className="text-muted-foreground/60 font-normal">Action</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">جاري تحميل الطلبات المعلقة...</p>
                    </div>
                  </TableCell></TableRow>
                ) : pending.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground text-sm">{r.hr_employees?.first_name} {r.hr_employees?.last_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{r.hr_employees?.employee_number}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.hr_leave_types?.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{r.start_date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{r.end_date}</TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(r.days_count)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{r.reason ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1 text-xs"
                          onClick={() => actionMut.mutate({ id: r.id, status: "approved" })}
                          disabled={actionMut.isPending}
                        >
                          <Check className="h-3 w-3" />اعتماد
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1 text-xs"
                          onClick={() => actionMut.mutate({ id: r.id, status: "rejected" })}
                          disabled={actionMut.isPending}
                        >
                          <X className="h-3 w-3" />رفض
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
