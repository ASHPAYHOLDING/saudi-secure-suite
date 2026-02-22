import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد مؤقت", internship: "تدريب", probation: "فترة تجربة",
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5" />عقود العمل</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العقد</TableHead>
                <TableHead>الموظف</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>تاريخ البدء</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead>الراتب الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : contracts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد عقود</TableCell></TableRow>
              ) : contracts.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.contract_number}</TableCell>
                  <TableCell>{c.hr_employees?.first_name} {c.hr_employees?.last_name}</TableCell>
                  <TableCell>{TYPE_LABELS[c.contract_type] ?? c.contract_type}</TableCell>
                  <TableCell className="text-sm">{c.start_date}</TableCell>
                  <TableCell className="text-sm">{c.end_date ?? "غير محدد"}</TableCell>
                  <TableCell className="font-medium">{Number(c.total_salary).toLocaleString()} {c.currency}</TableCell>
                  <TableCell><Badge variant={c.is_current ? "default" : "outline"}>{c.is_current ? "ساري" : "منتهي"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
