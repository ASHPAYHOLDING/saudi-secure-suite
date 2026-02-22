import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, PalmtreeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { ar: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { ar: "قيد المراجعة", en: "Pending", variant: "secondary" },
  approved: { ar: "مقبول", en: "Approved", variant: "default" },
  rejected: { ar: "مرفوض", en: "Rejected", variant: "destructive" },
  cancelled: { ar: "ملغي", en: "Cancelled", variant: "outline" },
};

export default function HrLeavePage() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeNameEn, setTypeNameEn] = useState("");
  const [defaultDays, setDefaultDays] = useState("21");
  const [isPaid, setIsPaid] = useState(true);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ["hr-leave-types", tenantId], enabled: !!tenantId,
    queryFn: async () => { const { data } = await supabase.from("hr_leave_types").select("*").eq("tenant_id", tenantId!).order("name"); return data ?? []; },
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["hr-leave-requests", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("hr_leave_requests")
        .select("*, hr_employees(first_name, last_name), hr_leave_types(name)")
        .eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const addType = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hr_leave_types").insert({
        tenant_id: tenantId!, name: typeName, name_en: typeNameEn || null,
        default_days: Number(defaultDays), is_paid: isPaid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة نوع الإجازة بنجاح");
      qc.invalidateQueries({ queryKey: ["hr-leave-types"] });
      setTypeDialogOpen(false); setTypeName(""); setTypeNameEn(""); setDefaultDays("21");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendingCount = requests.filter((r: any) => r.status === "pending").length;
  const approvedCount = requests.filter((r: any) => r.status === "approved").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <Calendar className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">إدارة الإجازات</h1>
          <p className="text-xs text-muted-foreground">Leave Management</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Total Requests / إجمالي</p>
          <p className="text-2xl font-bold">{requests.length.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Pending / قيد المراجعة</p>
          <p className="text-2xl font-bold text-amber-500">{pendingCount.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Approved / مقبول</p>
          <p className="text-2xl font-bold text-primary">{approvedCount.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />طلبات الإجازة | Requests</TabsTrigger>
          <TabsTrigger value="types" className="gap-1.5"><PalmtreeIcon className="h-3.5 w-3.5" />أنواع الإجازات | Types</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card className="border-border/50 overflow-hidden"><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">الموظف<br /><span className="text-muted-foreground/60 font-normal">Employee</span></TableHead>
                  <TableHead className="text-xs font-semibold">النوع<br /><span className="text-muted-foreground/60 font-normal">Type</span></TableHead>
                  <TableHead className="text-xs font-semibold">من<br /><span className="text-muted-foreground/60 font-normal">From</span></TableHead>
                  <TableHead className="text-xs font-semibold">إلى<br /><span className="text-muted-foreground/60 font-normal">To</span></TableHead>
                  <TableHead className="text-xs font-semibold">الأيام<br /><span className="text-muted-foreground/60 font-normal">Days</span></TableHead>
                  <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">جاري تحميل الطلبات...</p>
                    </div>
                  </TableCell></TableRow>
                ) : requests.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted"><Calendar className="h-8 w-8 text-muted-foreground/50" /></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">لا توجد طلبات إجازة</p>
                        <p className="text-xs text-muted-foreground">No leave requests submitted yet</p>
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">ستظهر طلبات الإجازات هنا فور تقديمها من الموظفين</p>
                      </div>
                    </div>
                  </TableCell></TableRow>
                ) : requests.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium text-foreground">{r.hr_employees?.first_name} {r.hr_employees?.last_name}</TableCell>
                    <TableCell className="text-sm">{r.hr_leave_types?.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{r.start_date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{r.end_date}</TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(r.days_count)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[r.status]?.variant ?? "outline"}>
                        {STATUS_LABELS[r.status]?.ar ?? r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />إضافة نوع إجازة</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة نوع إجازة جديد</DialogTitle>
                  <DialogDescription>Add New Leave Type</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="text-xs font-semibold">اسم نوع الإجازة <span className="text-destructive">*</span></Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Leave Type Name (Arabic)</p>
                    <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="مثال: إجازة سنوية" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">الاسم بالإنجليزية</Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Leave Type Name (English) — اختياري</p>
                    <Input dir="ltr" value={typeNameEn} onChange={(e) => setTypeNameEn(e.target.value)} placeholder="e.g. Annual Leave" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">الرصيد الافتراضي (أيام)</Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Default Balance — عدد الأيام المستحقة سنوياً</p>
                    <Input type="number" value={defaultDays} onChange={(e) => setDefaultDays(e.target.value)} placeholder="21" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <Label className="text-xs font-semibold">إجازة مدفوعة</Label>
                      <p className="text-[10px] text-muted-foreground">Paid Leave — هل يُحتسب الراتب خلالها؟</p>
                    </div>
                    <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                  </div>
                  <Button onClick={() => addType.mutate()} disabled={!typeName || addType.isPending} className="w-full">
                    {addType.isPending ? "جاري الإضافة..." : "إضافة النوع | Add Type"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="border-border/50 overflow-hidden"><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">النوع<br /><span className="text-muted-foreground/60 font-normal">Type</span></TableHead>
                  <TableHead className="text-xs font-semibold">الرصيد<br /><span className="text-muted-foreground/60 font-normal">Days</span></TableHead>
                  <TableHead className="text-xs font-semibold">مدفوعة<br /><span className="text-muted-foreground/60 font-normal">Paid</span></TableHead>
                  <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveTypes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted"><PalmtreeIcon className="h-8 w-8 text-muted-foreground/50" /></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">لم يتم تعريف أنواع الإجازات بعد</p>
                        <p className="text-xs text-muted-foreground">No leave types defined yet</p>
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">عرّف أنواع الإجازات لتمكين الموظفين من تقديم طلباتهم</p>
                      </div>
                    </div>
                  </TableCell></TableRow>
                ) : leaveTypes.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                    <TableCell className="font-medium tabular-nums">{Number(t.default_days)}</TableCell>
                    <TableCell>
                      <Badge variant={t.is_paid ? "default" : "outline"}>
                        {t.is_paid ? "مدفوعة | Paid" : "غير مدفوعة | Unpaid"}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant={t.is_active ? "default" : "outline"}>{t.is_active ? "نشط | Active" : "معطل | Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
