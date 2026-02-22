import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Upload, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const ATT_STATUS: Record<string, { ar: string; en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  present: { ar: "حاضر", en: "Present", variant: "default" },
  absent: { ar: "غائب", en: "Absent", variant: "destructive" },
  late: { ar: "متأخر", en: "Late", variant: "secondary" },
  half_day: { ar: "نصف يوم", en: "Half Day", variant: "outline" },
};

const SOURCE_LABELS: Record<string, string> = {
  csv_import: "استيراد CSV",
  manual: "إدخال يدوي",
  biometric: "بصمة",
  system: "النظام",
};

export default function HrAttendancePage() {
  const { tenantId, user } = useAuth();
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
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

  const presentCount = logs.filter((l: any) => l.status === "present").length;
  const lateCount = logs.filter((l: any) => l.status === "late").length;
  const absentCount = logs.filter((l: any) => l.status === "absent").length;

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !user) return;

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

      const { data: emps } = await supabase.from("hr_employees").select("id, employee_number").eq("tenant_id", tenantId);
      const empMap = new Map((emps ?? []).map(e => [e.employee_number, e.id]));

      rows.forEach((row, i) => {
        const empId = empMap.get(String(row.employee_number ?? row.رقم_الموظف));
        if (!empId) { errors.push({ row: i + 2, error: "رقم موظف غير موجود | Employee ID not found" }); return; }
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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10">
            <Clock className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">الحضور والانصراف</h1>
            <p className="text-xs text-muted-foreground">Attendance & Time Tracking</p>
          </div>
        </div>
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-4 w-4" />استيراد ملف | Import</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>استيراد بيانات الحضور</DialogTitle>
              <DialogDescription>Import Attendance Data</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <p className="text-xs font-semibold mb-1">الأعمدة المطلوبة | Required Columns:</p>
                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">employee_number, date, check_in, check_out</p>
                <p className="text-[10px] text-muted-foreground mt-1">أو بالعربية: رقم_الموظف، التاريخ، دخول، خروج</p>
              </div>
              <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleCsvImport} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Total / الإجمالي</p>
          <p className="text-2xl font-bold">{logs.length.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Present / حاضر</p>
          <p className="text-2xl font-bold text-primary">{presentCount.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Late / متأخر</p>
          <p className="text-2xl font-bold text-amber-500">{lateCount.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Absent / غائب</p>
          <p className="text-2xl font-bold text-destructive">{absentCount.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
      </div>

      {/* Date Filter */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[180px]" dir="ltr" />
        <span className="text-xs text-muted-foreground">تاريخ العرض | Display Date</span>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden"><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold">الموظف<br /><span className="text-muted-foreground/60 font-normal">Employee</span></TableHead>
              <TableHead className="text-xs font-semibold">الرقم<br /><span className="text-muted-foreground/60 font-normal">ID</span></TableHead>
              <TableHead className="text-xs font-semibold">الدخول<br /><span className="text-muted-foreground/60 font-normal">Check-in</span></TableHead>
              <TableHead className="text-xs font-semibold">الخروج<br /><span className="text-muted-foreground/60 font-normal">Check-out</span></TableHead>
              <TableHead className="text-xs font-semibold">الساعات<br /><span className="text-muted-foreground/60 font-normal">Hours</span></TableHead>
              <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
              <TableHead className="text-xs font-semibold">المصدر<br /><span className="text-muted-foreground/60 font-normal">Source</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">جاري تحميل السجلات...</p>
                </div>
              </TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full bg-muted"><Clock className="h-8 w-8 text-muted-foreground/50" /></div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">لا توجد سجلات حضور لهذا التاريخ</p>
                    <p className="text-xs text-muted-foreground">No attendance records for this date</p>
                    <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">جرّب اختيار تاريخ آخر أو استيراد البيانات من ملف</p>
                  </div>
                </div>
              </TableCell></TableRow>
            ) : logs.map((l: any) => (
              <TableRow key={l.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium text-foreground">{l.hr_employees?.first_name} {l.hr_employees?.last_name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{l.hr_employees?.employee_number}</TableCell>
                <TableCell className="text-sm tabular-nums" dir="ltr">{l.check_in ? new Date(l.check_in).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                <TableCell className="text-sm tabular-nums" dir="ltr">{l.check_out ? new Date(l.check_out).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                <TableCell className="tabular-nums">{l.worked_hours ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={ATT_STATUS[l.status]?.variant ?? "outline"}>
                    {ATT_STATUS[l.status]?.ar ?? l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{SOURCE_LABELS[l.source] ?? l.source}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
