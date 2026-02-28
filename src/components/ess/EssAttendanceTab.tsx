import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock } from "lucide-react";

interface Props {
  records: any[];
  loading: boolean;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  present: { label: "حاضر", cls: "bg-success/10 text-success" },
  absent: { label: "غائب", cls: "bg-destructive/10 text-destructive" },
  late: { label: "متأخر", cls: "bg-warning/10 text-warning" },
  half_day: { label: "نصف يوم", cls: "bg-info/10 text-info" },
  holiday: { label: "إجازة رسمية", cls: "bg-muted text-muted-foreground" },
};

const formatTime = (ts: string | null) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
};

const EssAttendanceTab = ({ records, loading }: Props) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Clock size={18} className="text-primary" />
        سجل الحضور والانصراف
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
      ) : records.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">لا توجد سجلات حضور</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">الحضور</TableHead>
                <TableHead className="text-right">الانصراف</TableHead>
                <TableHead className="text-right">ساعات العمل</TableHead>
                <TableHead className="text-right">إضافي</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r: any) => {
                const st = STATUS_MAP[r.status] || { label: r.status || "—", cls: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground" dir="ltr">{r.log_date}</TableCell>
                    <TableCell className="text-sm" dir="ltr">{formatTime(r.check_in)}</TableCell>
                    <TableCell className="text-sm" dir="ltr">{formatTime(r.check_out)}</TableCell>
                    <TableCell className="text-sm">{r.worked_hours ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.overtime_hours ?? "—"}</TableCell>
                    <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

export default EssAttendanceTab;
