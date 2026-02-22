import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { FileText, FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  full_time: { ar: "دوام كامل", en: "Full-time" },
  part_time: { ar: "دوام جزئي", en: "Part-time" },
  contract: { ar: "عقد مؤقت", en: "Contract" },
  internship: { ar: "تدريب", en: "Internship" },
  probation: { ar: "فترة تجربة", en: "Probation" },
};

export default function HrContractsPage() {
  const { tenantId } = useAuth();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["hr-contracts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("hr_contracts")
        .select("*, hr_employees(first_name, last_name, employee_number)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const activeCount = contracts.filter((c: any) => c.is_current).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <FileText className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">عقود العمل</h1>
          <p className="text-xs text-muted-foreground">Employment Contracts</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Total / الإجمالي</p>
          <p className="text-2xl font-bold">{contracts.length.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Active / ساري</p>
          <p className="text-2xl font-bold text-primary">{activeCount.toLocaleString("ar-SA")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-3 sm:p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Expired / منتهي</p>
          <p className="text-2xl font-bold text-muted-foreground">{(contracts.length - activeCount).toLocaleString("ar-SA")}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs font-semibold">رقم العقد<br /><span className="text-muted-foreground/60 font-normal">Contract No.</span></TableHead>
                <TableHead className="text-xs font-semibold">الموظف<br /><span className="text-muted-foreground/60 font-normal">Employee</span></TableHead>
                <TableHead className="text-xs font-semibold">النوع<br /><span className="text-muted-foreground/60 font-normal">Type</span></TableHead>
                <TableHead className="text-xs font-semibold">تاريخ البدء<br /><span className="text-muted-foreground/60 font-normal">Start Date</span></TableHead>
                <TableHead className="text-xs font-semibold">تاريخ الانتهاء<br /><span className="text-muted-foreground/60 font-normal">End Date</span></TableHead>
                <TableHead className="text-xs font-semibold">الراتب الإجمالي<br /><span className="text-muted-foreground/60 font-normal">Total Salary</span></TableHead>
                <TableHead className="text-xs font-semibold">الحالة<br /><span className="text-muted-foreground/60 font-normal">Status</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">جاري تحميل العقود...</p>
                      <p className="text-xs text-muted-foreground/60">Loading contracts...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <FileCheck className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">لا توجد عقود مسجلة</p>
                        <p className="text-xs text-muted-foreground">No contracts recorded yet</p>
                        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto mt-2">سيتم عرض عقود العمل هنا بمجرد إضافتها للموظفين</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : contracts.map((c: any) => (
                <TableRow key={c.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.contract_number}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.hr_employees?.first_name} {c.hr_employees?.last_name}</TableCell>
                  <TableCell className="text-sm">{TYPE_LABELS[c.contract_type]?.ar ?? c.contract_type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{c.start_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground" dir="ltr">{c.end_date ?? <span className="text-muted-foreground/50">غير محدد</span>}</TableCell>
                  <TableCell className="font-medium tabular-nums" dir="ltr">{Number(c.total_salary).toLocaleString()} {c.currency}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_current ? "default" : "outline"}>
                      {c.is_current ? "ساري | Active" : "منتهي | Expired"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
