import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const ATT_STATUS: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", half_day: "نصف يوم" };

export default function HrAttendancePage() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["hr-attendance", tenantId, dateFilter], enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("hr_attendance_logs")
        .select("*, hr_employees(first_name, last_name, employee_number)")
        .eq("tenant_id", tenantId!).eq("log_date", dateFilter).order("check_in", { ascending: true });
      return data ?? [];
    },
  });

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !user) return;

    // Create import job
    const { data: job, error: jobErr } = await supabase.from("hr_import_jobs").insert({
      tenant_id: tenantId, import_type: "attendance", file_name: file.name, imported_by: user.id, status: "validating" as any,
    }).select().single();
    if (jobErr || !job) { toast.error("فشل إنشاء مهمة الاستيراد"); return; }

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      const validRows: any[] = [];
      const errors: any[] = [];

      // Get employee map
      const { data: emps } = await supabase.from("hr_employees").select("id, employee_number").eq("tenant_id", tenantId);
      const empMap = new Map((emps ?? []).map(e => [e.employee_number, e.id]));

      rows.forEach((row, i) => {
        const empId = empMap.get(String(row.employee_number ?? row.رقم_الموظف));
        if (!empId) { errors.push({ row: i + 2, error: "رقم موظف غير موجود" }); return; }
        validRows.push({
          tenant_id: tenantId, employee_id: empId, log_date: row.date ?? row.التاريخ,
          check_in: row.check_in ?? row.دخول ?? null, check_out: row.check_out ?? row.خروج ?? null,
          status: row.status ?? "present", source: "csv_import" as any, import_job_id: job.id,
        });
      });

      if (validRows.length > 0) {
        const { error } = await supabase.from("hr_attendance_logs").insert(validRows);
        if (error) throw error;
      }

      await supabase.from("hr_import_jobs").update({
        status: "completed" as any, total_rows: rows.length, valid_rows: validRows.length,
        error_rows: errors.length, errors_json: errors.length ? errors : null, completed_at: new Date().toISOString(),
      }).eq("id", job.id);

      toast.success(`تم استيراد ${validRows.length} سجل بنجاح${errors.length ? ` (${errors.length} أخطاء)` : ""}`);
      qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      setImportDialogOpen(false);
    } catch (err: any) {
      await supabase.from("hr_import_jobs").update({ status: "failed" as any, error_rows: 1, errors_json: [{ error: err.message }] }).eq("id", job.id);
      toast.error("فشل الاستيراد: " + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold flex items-center gap-2"><Clock className="h-5 w-5" />الحضور والانصراف</h1>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="h-4 w-4 me-1" />استيراد CSV</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>استيراد بيانات الحضور</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">ارفع ملف CSV/Excel يحتوي على: employee_number, date, check_in, check_out</p>
                <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleCsvImport} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2"><Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[180px]" /></div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الموظف</TableHead><TableHead>الرقم</TableHead><TableHead>الدخول</TableHead><TableHead>الخروج</TableHead><TableHead>الساعات</TableHead><TableHead>الحالة</TableHead><TableHead>المصدر</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد سجلات لهذا التاريخ</TableCell></TableRow>
            ) : logs.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.hr_employees?.first_name} {l.hr_employees?.last_name}</TableCell>
                <TableCell className="font-mono text-xs">{l.hr_employees?.employee_number}</TableCell>
                <TableCell className="text-sm">{l.check_in ? new Date(l.check_in).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                <TableCell className="text-sm">{l.check_out ? new Date(l.check_out).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                <TableCell>{l.worked_hours ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{ATT_STATUS[l.status] ?? l.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.source === "csv_import" ? "CSV" : l.source === "manual" ? "يدوي" : l.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
