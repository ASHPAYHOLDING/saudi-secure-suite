import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users, UserPlus, AlertTriangle, ArrowRight } from "lucide-react";
import SmartEmptyState from "@/components/ui/smart-empty-state";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS } from "@/lib/entitlement-types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import EmployeeDocumentCenter from "./EmployeeDocumentCenter";

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
  const { entitlementsMap } = useEntitlementsContext();
  const maxUsersEntry = entitlementsMap[FEATURE_KEYS.MAX_USERS];
  const employeeLimit = maxUsersEntry?.limit ?? null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
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

  const openDetail = (emp: any) => {
    setSelectedEmployee(emp);
    setDetailOpen(true);
  };

  const activeCount = employees.filter((e: any) => e.status === "active").length;
  const totalCount = employees.length;
  const isAtLimit = employeeLimit !== null && totalCount >= employeeLimit;
  const usagePercent = employeeLimit ? Math.min((totalCount / employeeLimit) * 100, 100) : 0;

  // If detail view is open, show the tabbed employee profile
  if (detailOpen && selectedEmployee) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        {/* Back + Employee Name */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="min-h-[48px] gap-1.5" onClick={() => { setDetailOpen(false); setSelectedEmployee(null); }}>
            <ArrowRight className="h-4 w-4 rtl-mirror" />
            <span>رجوع | Back</span>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{selectedEmployee.first_name} {selectedEmployee.last_name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{selectedEmployee.employee_number}</p>
          </div>
          <Badge variant={STATUS_MAP[selectedEmployee.status]?.variant ?? "outline"} className="ms-auto">
            {STATUS_MAP[selectedEmployee.status]?.labelAr ?? selectedEmployee.status}
          </Badge>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 rounded-lg p-1 flex-wrap">
            <TabsTrigger value="info" className="min-h-[40px] text-xs">البيانات الأساسية<span className="hidden sm:inline ms-1.5 text-muted-foreground/60">| Info</span></TabsTrigger>
            <TabsTrigger value="documents" className="min-h-[40px] text-xs">المستندات<span className="hidden sm:inline ms-1.5 text-muted-foreground/60">| Documents</span></TabsTrigger>
            <TabsTrigger value="leave" className="min-h-[40px] text-xs">الإجازات<span className="hidden sm:inline ms-1.5 text-muted-foreground/60">| Leave</span></TabsTrigger>
            <TabsTrigger value="history" className="min-h-[40px] text-xs">السجل الوظيفي<span className="hidden sm:inline ms-1.5 text-muted-foreground/60">| History</span></TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card className="border-border/50">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="الاسم الأول | First Name" value={selectedEmployee.first_name} />
                  <InfoField label="اسم العائلة | Last Name" value={selectedEmployee.last_name} />
                  <InfoField label="البريد الإلكتروني | Email" value={selectedEmployee.email ?? "—"} dir="ltr" />
                  <InfoField label="رقم الجوال | Phone" value={selectedEmployee.phone ?? "—"} dir="ltr" />
                  <InfoField label="القسم | Department" value={selectedEmployee.org_departments?.name ?? "—"} />
                  <InfoField label="تاريخ الانضمام | Join Date" value={selectedEmployee.hire_date ?? selectedEmployee.created_at?.split("T")[0] ?? "—"} />
                </div>
                <Button variant="outline" size="sm" className="min-h-[48px] gap-1.5" onClick={() => openEdit(selectedEmployee)}>
                  تعديل البيانات | Edit Info
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <EmployeeDocumentCenter
              employeeId={selectedEmployee.id}
              employeeName={`${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
            />
          </TabsContent>

          <TabsContent value="leave">
            <EmployeeLeaveTab employeeId={selectedEmployee.id} />
          </TabsContent>

          <TabsContent value="history">
            <Card className="border-border/50">
              <CardContent className="py-12 flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">السجل الوظيفي قيد التطوير</p>
                <p className="text-xs text-muted-foreground/60">Employment history coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

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
        <Button onClick={() => setDrawerOpen(true)} size="sm" className="gap-1.5 min-h-[48px]" disabled={isAtLimit}>
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
            <p className="text-2xl font-bold text-accent-foreground">{employees.filter((e: any) => e.status === "on_leave").length.toLocaleString("ar-SA")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Inactive / غير نشط</p>
            <p className="text-2xl font-bold text-muted-foreground">{employees.filter((e: any) => !["active", "on_leave"].includes(e.status)).length.toLocaleString("ar-SA")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Limit Banner */}
      {employeeLimit !== null && (
        <Card className={`border-border/50 ${isAtLimit ? 'border-destructive/50 bg-destructive/5' : ''}`}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2">
                {isAtLimit && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <p className="text-xs font-semibold text-foreground">عداد الموظفين | Employee Quota</p>
              </div>
              <p className="text-sm font-bold tabular-nums">{totalCount.toLocaleString("ar-SA")} / {employeeLimit.toLocaleString("ar-SA")}</p>
            </div>
            <Progress value={usagePercent} className="h-2" />
            {isAtLimit && <p className="text-xs text-destructive mt-2">تم الوصول للحد الأقصى من الموظفين. يرجى ترقية الباقة لإضافة المزيد.</p>}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم، الرقم الوظيفي، أو البريد... | Search" value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
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
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <SmartEmptyState
                      icon={Users}
                      title="لا يوجد موظفون بعد"
                      description="أضف بيانات موظفيك لإدارة الحضور والرواتب والعقود من مكان واحد"
                      tips={[
                        "أدخل الاسم والرقم الوظيفي والبريد الإلكتروني",
                        "حدّد القسم والحالة الوظيفية",
                        "أرفق العقود والمستندات لاحقاً من ملف الموظف",
                      ]}
                      actionLabel="إضافة أول موظف"
                      onAction={() => setDrawerOpen(true)}
                    />
                  </TableCell>
                </TableRow>
              ) : employees.map((emp: any) => (
                <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openDetail(emp)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{emp.employee_number}</TableCell>
                  <TableCell className="font-medium text-foreground">{emp.first_name} {emp.last_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm" dir="ltr">{emp.email || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.org_departments?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_MAP[emp.status]?.variant ?? "outline"}>{STATUS_MAP[emp.status]?.labelAr ?? emp.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
        <SheetContent side={document.documentElement.dir === "rtl" ? "right" : "left"} className="w-full sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</SheetTitle>
            <SheetDescription>{editId ? "Edit Employee Details" : "Add New Employee"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div>
              <Label className="text-xs font-semibold">الرقم الوظيفي <span className="text-destructive">*</span></Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Employee ID</p>
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
              <p className="text-[10px] text-muted-foreground mb-1.5">Email</p>
              <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="employee@company.com" />
            </div>
            <div>
              <Label className="text-xs font-semibold">رقم الجوال</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Phone Number</p>
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
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.first_name || !form.last_name || !form.employee_number} className="w-full mt-2 min-h-[48px]">
              {saveMutation.isPending ? "جاري الحفظ..." : editId ? "تحديث البيانات | Update" : "إضافة الموظف | Add Employee"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Helper Components ── */

function InfoField({ label, value, dir }: { label: string; value: string; dir?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground" dir={dir}>{value}</p>
    </div>
  );
}

function EmployeeLeaveTab({ employeeId }: { employeeId: string }) {
  const { tenantId } = useAuth();
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ["employee-leave", employeeId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_leave_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const statusVariant = (s: string) => {
    if (s === "approved") return "default";
    if (s === "rejected") return "destructive";
    return "secondary";
  };
  const statusLabel = (s: string) => {
    if (s === "approved") return "مقبول";
    if (s === "rejected") return "مرفوض";
    if (s === "pending") return "معلق";
    return s;
  };

  if (isLoading) return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (leaves.length === 0) return (
    <Card className="border-border/50">
      <CardContent className="py-12 flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">لا توجد إجازات مسجلة</p>
        <p className="text-xs text-muted-foreground/60">No leave records found</p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs">النوع | Type</TableHead>
              <TableHead className="text-xs">من | From</TableHead>
              <TableHead className="text-xs">إلى | To</TableHead>
              <TableHead className="text-xs">الحالة | Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaves.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">{l.leave_type ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.start_date}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.end_date}</TableCell>
                <TableCell><Badge variant={statusVariant(l.status)}>{statusLabel(l.status)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
