import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CalendarDays, Loader2 } from "lucide-react";

interface Props {
  leaves: any[];
  loading: boolean;
  leaveTypes: any[];
  onSubmit: (params: any) => Promise<void>;
  submitting: boolean;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-warning/10 text-warning" },
  approved: { label: "مقبول", cls: "bg-success/10 text-success" },
  rejected: { label: "مرفوض", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "ملغي", cls: "bg-muted text-muted-foreground" },
};

const EssLeaveTab = ({ leaves, loading, leaveTypes, onSubmit, submitting }: Props) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });

  const daysCount = form.start_date && form.end_date
    ? Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1)
    : 0;

  const handleSubmit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) return;
    await onSubmit({
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: daysCount,
      reason: form.reason,
    });
    setForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          طلبات الإجازة
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus size={14} />
              طلب إجازة جديد
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>طلب إجازة جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>نوع الإجازة</Label>
                <Select value={form.leave_type_id} onValueChange={(v) => setForm((p) => ({ ...p, leave_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر نوع الإجازة" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((lt: any) => (
                      <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>من تاريخ</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              {daysCount > 0 && (
                <p className="text-sm text-muted-foreground">عدد الأيام: <strong className="text-foreground">{daysCount}</strong></p>
              )}
              <div>
                <Label>السبب (اختياري)</Label>
                <Textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} rows={2} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting || !form.leave_type_id || !form.start_date || !form.end_date} className="w-full">
                {submitting ? <Loader2 size={16} className="animate-spin ml-2" /> : null}
                تقديم الطلب
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
        ) : leaves.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">لا توجد طلبات إجازة</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">من</TableHead>
                  <TableHead className="text-right">إلى</TableHead>
                  <TableHead className="text-right">الأيام</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((l: any) => {
                  const st = STATUS_BADGE[l.status] || { label: l.status, cls: "bg-muted text-muted-foreground" };
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{l.hr_leave_types?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground" dir="ltr">{l.start_date}</TableCell>
                      <TableCell className="text-sm text-muted-foreground" dir="ltr">{l.end_date}</TableCell>
                      <TableCell className="text-sm">{l.days_count}</TableCell>
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
};

export default EssLeaveTab;
