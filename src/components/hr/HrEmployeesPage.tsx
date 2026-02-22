import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "نشط", variant: "default" },
  on_leave: { label: "في إجازة", variant: "secondary" },
  suspended: { label: "موقوف", variant: "destructive" },
  terminated: { label: "منتهي", variant: "destructive" },
  resigned: { label: "مستقيل", variant: "outline" },
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
      toast.success(editId ? "تم تحديث الموظف" : "تمت إضافة الموظف");
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">الموظفون</h1>
        <Button onClick={() => setDrawerOpen(true)} size="sm"><Plus className="h-4 w-4 me-1" />إضافة موظف</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الرقم..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="on_leave">في إجازة</SelectItem>
            <SelectItem value="suspended">موقوف</SelectItem>
            <SelectItem value="terminated">منتهي</SelectItem>
            <SelectItem value="resigned">مستقيل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الموظف</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : employees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا يوجد موظفون</TableCell></TableRow>
              ) : employees.map((emp: any) => (
                <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(emp)}>
                  <TableCell className="font-mono text-xs">{emp.employee_number}</TableCell>
                  <TableCell className="font-medium">{emp.first_name} {emp.last_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{emp.email}</TableCell>
                  <TableCell className="text-sm">{emp.org_departments?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_MAP[emp.status]?.variant ?? "outline"}>{STATUS_MAP[emp.status]?.label ?? emp.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={(o) => { if (!o) closeDrawer(); }}>
        <SheetContent side="left" className="w-full sm:w-[400px] overflow-y-auto">
          <SheetHeader><SheetTitle>{editId ? "تعديل موظف" : "إضافة موظف"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label>رقم الموظف *</Label><Input value={form.employee_number} onChange={(e) => setForm(f => ({ ...f, employee_number: e.target.value }))} disabled={!!editId} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>الاسم الأول *</Label><Input value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>اسم العائلة *</Label><Input value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>الجوال</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div>
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as typeof f.status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.first_name || !form.last_name || !form.employee_number} className="w-full">
              {saveMutation.isPending ? "جاري الحفظ..." : editId ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
