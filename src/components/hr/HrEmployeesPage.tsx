import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { labelAr: string; labelEn: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { labelAr: "نشط", labelEn: "Active", variant: "default" },
  on_leave: { labelAr: "في إجازة", labelEn: "On Leave", variant: "secondary" },
  suspended: { labelAr: "موقوف", labelEn: "Suspended", variant: "destructive" },
  terminated: { labelAr: "منتهي", labelEn: "Terminated", variant: "destructive" },
  resigned: { labelAr: "مستقيل", labelEn: "Resigned", variant: "outline" },
};

export default function HrEmployeesPage() {
  const { tenantId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", employee_number: "", status: "active" as "active" | "on_leave" | "suspended" | "terminated" | "resigned" });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-employees", tenantId, search, statusFilter],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase.from("hr_employees").select("*, org_departments(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%,email.ilike.%${search}%`);
      const { data } = await q.limit(100);
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { first_name: form.first_name, last_name: form.last_name, email: form.email || null, phone: form.phone || null, employee_number: form.employee_number, status: form.status };
      if (editId) {
        const { error } = await supabase.from("hr_employees").update(payload).eq("id", editId).eq("tenant_id", tenantId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_employees").insert({ ...payload, tenant_id: tenantId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "تم تحديث بيانات الموظف بنجاح" : "تمت إضافة الموظف بنجاح");
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
      closeDrawer();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditId(null);
    setForm({ first_name: "", last_name: "", email: "", phone: "", employee_number: "", status: "active" as const });
  };

  const openEdit = (emp: any) => {
    setEditId(emp.id);
    setForm({ first_name: emp.first_name, last_name: emp.last_name, email: emp.email ?? "", phone: emp.phone ?? "", employee_number: emp.employee_number, status: emp.status });
    setDrawerOpen(true);
  };

  const activeCount = employees.filter((e: any) => e.status === "active").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">إدارة الموظفين</h1>
            <p className="text-xs text-muted-foreground">Employee Management</p>
          </div>
        </div>
        <Button onClick={() => setDrawerOpen(true)} size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          <span>إضافة موظف</span>
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Total / الإجمالي</p>
            <p className="text-2xl font-bold text-foreground">{employees.length.toLocaleString("ar-SA")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Active / نشط</p>
            <p className="text-2xl font-bold text-primary">{activeCount.toLocaleString("ar-SA")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">On Leave / في إجازة</p>
            <p className="text-2xl font-bold text-amber-500">{employees.filter((e: any) => e.status === "on_leave").length.toLocaleString("ar-SA")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Inactive / غير نشط</p>
            <p className="text-2xl font-bold text-muted-foreground">{employees.filter((e: any) => !["active", "on_leave"].includes(e.status)).length.toLocaleString("ar-SA")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، الرقم الوظيفي، أو البريد... | Search by name, ID, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="جميع الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات | All</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.labelAr} | {v.labelEn}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold">الرقم الوظيفي<br /><span className="text-muted-foreground/60 font-normal">Employee ID</span></TableHead>
                <TableHead className="text-xs font-semibold">الاسم الكامل<br /><span className="text-muted-foreground/60 font-normal">Full Name</span></TableHead>
                <TableHead className="text-xs font-semibold">البريد الإلكتروني<br /><span className="text-muted-foreground/60 font-normal">Email</span></TableHead>
                <TableHead className="text-xs font-semibold">القسم<br /><span className="text-muted-foreground/60 font-normal">Department</span></TableHead>
                <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">جاري تحميل بيانات الموظفين...</p>
                      <p className="text-xs text-muted-foreground/60">Loading employee data...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <Users className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">لا يوجد موظفون حالياً</p>
                        <p className="text-xs text-muted-foreground">No employees found</p>
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">
                          ابدأ بإضافة أول موظف لبناء قاعدة بيانات فريق العمل
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => setDrawerOpen(true)}>
                        <UserPlus className="h-3.5 w-3.5" />
                        إضافة أول موظف
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.map((emp: any) => (
                <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openEdit(emp)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{emp.employee_number}</TableCell>
                  <TableCell className="font-medium text-foreground">{emp.first_name} {emp.last_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm" dir="ltr">{emp.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.org_departments?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_MAP[emp.status]?.variant ?? "outline"}>
                      {STATUS_MAP[emp.status]?.labelAr ?? emp.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
        <SheetContent side="left" className="w-full sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</SheetTitle>
            <SheetDescription>{editId ? "Edit Employee Details" : "Add New Employee"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div>
              <Label className="text-xs font-semibold">الرقم الوظيفي <span className="text-destructive">*</span></Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Employee ID — رقم فريد يُعرّف الموظف في النظام</p>
              <Input value={form.employee_number} onChange={(e) => setForm(f => ({ ...f, employee_number: e.target.value }))} disabled={!!editId} placeholder="مثال: EMP-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">الاسم الأول <span className="text-destructive">*</span></Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">First Name</p>
                <Input value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="الاسم الأول" />
              </div>
              <div>
                <Label className="text-xs font-semibold">اسم العائلة <span className="text-destructive">*</span></Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">Last Name</p>
                <Input value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="اسم العائلة" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">البريد الإلكتروني</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Email — اختياري، يُستخدم للتواصل والإشعارات</p>
              <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="employee@company.com" />
            </div>
            <div>
              <Label className="text-xs font-semibold">رقم الجوال</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Phone Number — اختياري</p>
              <Input dir="ltr" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+966 5XX XXX XXXX" />
            </div>
            <div>
              <Label className="text-xs font-semibold">الحالة الوظيفية</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Employment Status</p>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as typeof f.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.labelAr} — {v.labelEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.first_name || !form.last_name || !form.employee_number}
              className="w-full mt-2"
            >
              {saveMutation.isPending ? "جاري الحفظ... | Saving..." : editId ? "تحديث البيانات | Update" : "إضافة الموظف | Add Employee"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
