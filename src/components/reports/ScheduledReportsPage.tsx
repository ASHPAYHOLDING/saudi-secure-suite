import { useState, useEffect, useCallback } from "react";
import {
  CalendarClock, Plus, Trash2, Loader2, Play, Pause, Mail, FileText, Clock,
  Pencil, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface ScheduledReport {
  id: string;
  report_type: string;
  report_name: string;
  frequency: string;
  recipients: string[];
  format: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

const REPORT_TYPES = [
  { value: "profit_loss", label: "تقرير الأرباح والخسائر" },
  { value: "sales_summary", label: "ملخص المبيعات" },
  { value: "expense_summary", label: "ملخص المصروفات" },
  { value: "vat_report", label: "تقرير ضريبة القيمة المضافة" },
  { value: "customer_balance", label: "أرصدة العملاء" },
  { value: "aging_report", label: "تقرير أعمار الديون" },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
};

const calculateNextRun = (frequency: string): string => {
  const now = new Date();
  switch (frequency) {
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case "monthly":
    default: {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
  }
};

const ScheduledReportsPage = () => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("تقرير مجدول");
  const [formType, setFormType] = useState("profit_loss");
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formRecipients, setFormRecipients] = useState("");
  const [formFormat, setFormFormat] = useState("pdf");

  const fetchReports = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("scheduled_reports")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const resetForm = () => {
    setFormName("تقرير مجدول");
    setFormType("profit_loss");
    setFormFrequency("monthly");
    setFormRecipients("");
    setFormFormat("pdf");
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (report: ScheduledReport) => {
    setFormName(report.report_name);
    setFormType(report.report_type);
    setFormFrequency(report.frequency);
    setFormRecipients(report.recipients.join(", "));
    setFormFormat(report.format);
    setEditingId(report.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!tenantId || !user) return;
    const recipients = formRecipients.split(",").map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      toast({ title: "أدخل بريد مستلم واحد على الأقل", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await (supabase as any)
          .from("scheduled_reports")
          .update({
            report_name: formName,
            report_type: formType,
            frequency: formFrequency,
            recipients,
            format: formFormat,
            next_run_at: calculateNextRun(formFrequency),
          })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "تم تحديث التقرير المجدول" });
      } else {
        const { error } = await (supabase as any)
          .from("scheduled_reports")
          .insert({
            tenant_id: tenantId,
            created_by: user.id,
            report_name: formName,
            report_type: formType,
            frequency: formFrequency,
            recipients,
            format: formFormat,
            next_run_at: calculateNextRun(formFrequency),
          });
        if (error) throw error;
        toast({ title: "تم إنشاء التقرير المجدول بنجاح" });
      }
      setShowForm(false);
      resetForm();
      fetchReports();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await (supabase as any)
      .from("scheduled_reports")
      .update({ is_active: !isActive })
      .eq("id", id);
    toast({ title: isActive ? "تم إيقاف التقرير" : "تم تفعيل التقرير" });
    fetchReports();
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("scheduled_reports").delete().eq("id", id);
    toast({ title: "تم حذف التقرير المجدول" });
    fetchReports();
  };

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-3">
            <CalendarClock className="h-6 w-6 text-primary" />
            التقارير المجدولة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إنشاء تقارير تُرسل تلقائياً عبر البريد الإلكتروني
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          تقرير جديد
        </Button>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            التقارير ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد تقارير مجدولة — أنشئ تقريرك الأول</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">التكرار</TableHead>
                  <TableHead className="text-right">المستلمون</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التشغيل التالي</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{r.report_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {REPORT_TYPES.find(t => t.value === r.report_type)?.label || r.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        <Clock className="h-3 w-3 me-1" />
                        {FREQUENCY_LABELS[r.frequency] || r.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{r.recipients.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
                          <Play className="h-3 w-3 me-1" />نشط
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          <Pause className="h-3 w-3 me-1" />متوقف
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {r.next_run_at
                        ? new Date(r.next_run_at).toLocaleDateString("ar-SA")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleToggle(r.id, r.is_active)}
                        >
                          {r.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) resetForm(); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              {editingId ? "تعديل التقرير المجدول" : "إنشاء تقرير مجدول"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم التقرير</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="مثال: تقرير الأرباح الشهري" />
            </div>

            <div className="space-y-1.5">
              <Label>نوع التقرير</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>التكرار</Label>
              <Select value={formFrequency} onValueChange={setFormFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الصيغة</Label>
              <Select value={formFormat} onValueChange={setFormFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>المستلمون (فاصلة بين البريد)</Label>
              <Input
                value={formRecipients}
                onChange={(e) => setFormRecipients(e.target.value)}
                placeholder="cfo@company.com, manager@company.com"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">يمكنك إضافة أكثر من بريد مفصولة بفاصلة</p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={saving || !formName.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {editingId ? "حفظ التعديلات" : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduledReportsPage;
