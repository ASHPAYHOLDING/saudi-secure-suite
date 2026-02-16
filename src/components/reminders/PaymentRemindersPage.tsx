import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Plus, Clock, Mail, CheckCircle, XCircle, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";

interface ReminderSchedule {
  id: string;
  name: string;
  name_en: string | null;
  days_offset: number;
  channel: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

interface ReminderLog {
  id: string;
  invoice_id: string;
  customer_id: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  invoices: { invoice_number: string; grand_total: number; currency: string } | null;
  customers: { name: string } | null;
}

const PRESET_SCHEDULES = [
  { days_offset: -7, name: "قبل 7 أيام", name_en: "7 days before" },
  { days_offset: -3, name: "قبل 3 أيام", name_en: "3 days before" },
  { days_offset: -1, name: "قبل يوم واحد", name_en: "1 day before" },
  { days_offset: 0, name: "يوم الاستحقاق", name_en: "On due date" },
  { days_offset: 3, name: "بعد 3 أيام", name_en: "3 days after" },
  { days_offset: 7, name: "بعد 7 أيام", name_en: "7 days after" },
  { days_offset: 14, name: "بعد 14 يوم", name_en: "14 days after" },
  { days_offset: 30, name: "بعد 30 يوم", name_en: "30 days after" },
];

const PaymentRemindersPage = () => {
  const { t, isRTL, currentLang } = useLanguage();
  const { user, tenantId } = useAuth();

  const [schedules, setSchedules] = useState<ReminderSchedule[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReminderSchedule | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formDaysOffset, setFormDaysOffset] = useState("-3");
  const [formSubject, setFormSubject] = useState("تذكير بسداد الفاتورة {{invoice_number}}");
  const [formBody, setFormBody] = useState(
    "عزيزي {{customer_name}}، نود تذكيركم بالفاتورة رقم {{invoice_number}} بمبلغ {{amount_due}} {{currency}} والمستحقة بتاريخ {{due_date}}."
  );

  useEffect(() => {
    if (tenantId) {
      fetchSchedules();
      fetchLogs();
    }
  }, [tenantId]);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("payment_reminder_schedules")
      .select("*")
      .eq("tenant_id", tenantId!)
      .order("days_offset", { ascending: true });
    setSchedules((data as ReminderSchedule[]) || []);
    setLoading(false);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("payment_reminder_logs")
      .select("*, invoices(invoice_number, grand_total, currency), customers(name)")
      .eq("tenant_id", tenantId!)
      .order("sent_at", { ascending: false })
      .limit(50);
    setLogs((data as any[]) || []);
  };

  const handleSave = async () => {
    if (!tenantId || !user) return;
    const offset = parseInt(formDaysOffset);

    const payload = {
      tenant_id: tenantId,
      name: formName || PRESET_SCHEDULES.find((p) => p.days_offset === offset)?.name || "تذكير",
      name_en: formNameEn || PRESET_SCHEDULES.find((p) => p.days_offset === offset)?.name_en || "Reminder",
      days_offset: offset,
      channel: "email",
      subject_template: formSubject,
      body_template: formBody,
      created_by: user.id,
    };

    let error;
    if (editingSchedule) {
      ({ error } = await supabase
        .from("payment_reminder_schedules")
        .update(payload)
        .eq("id", editingSchedule.id));
    } else {
      ({ error } = await supabase.from("payment_reminder_schedules").insert(payload));
    }

    if (error) {
      toast.error(currentLang === "ar" ? "فشل الحفظ" : "Failed to save");
    } else {
      toast.success(currentLang === "ar" ? "تم الحفظ" : "Saved successfully");
      setDialogOpen(false);
      resetForm();
      fetchSchedules();
    }
  };

  const toggleSchedule = async (id: string, active: boolean) => {
    await supabase.from("payment_reminder_schedules").update({ is_active: active }).eq("id", id);
    fetchSchedules();
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("payment_reminder_schedules").delete().eq("id", id);
    fetchSchedules();
    toast.success(currentLang === "ar" ? "تم الحذف" : "Deleted");
  };

  const openEdit = (s: ReminderSchedule) => {
    setEditingSchedule(s);
    setFormName(s.name);
    setFormNameEn(s.name_en || "");
    setFormDaysOffset(String(s.days_offset));
    setFormSubject(s.subject_template);
    setFormBody(s.body_template);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setFormName("");
    setFormNameEn("");
    setFormDaysOffset("-3");
    setFormSubject("تذكير بسداد الفاتورة {{invoice_number}}");
    setFormBody("عزيزي {{customer_name}}، نود تذكيركم بالفاتورة رقم {{invoice_number}} بمبلغ {{amount_due}} {{currency}} والمستحقة بتاريخ {{due_date}}.");
  };

  const getDaysLabel = (offset: number) => {
    if (offset < 0) return currentLang === "ar" ? `قبل ${Math.abs(offset)} أيام` : `${Math.abs(offset)} days before`;
    if (offset === 0) return currentLang === "ar" ? "يوم الاستحقاق" : "On due date";
    return currentLang === "ar" ? `بعد ${offset} أيام` : `${offset} days after`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-accent" />
            {currentLang === "ar" ? "تذكيرات الدفع التلقائية" : "Automated Payment Reminders"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentLang === "ar"
              ? "جدولة إرسال تذكيرات تلقائية للعملاء قبل وبعد تاريخ استحقاق الفاتورة"
              : "Schedule automatic reminders to clients before and after invoice due dates"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {currentLang === "ar" ? "إضافة تذكير" : "Add Reminder"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule
                  ? (currentLang === "ar" ? "تعديل التذكير" : "Edit Reminder")
                  : (currentLang === "ar" ? "إنشاء تذكير جديد" : "Create New Reminder")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{currentLang === "ar" ? "الاسم بالعربي" : "Arabic Name"}</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="قبل 3 أيام" />
                </div>
                <div>
                  <Label>{currentLang === "ar" ? "الاسم بالإنجليزي" : "English Name"}</Label>
                  <Input value={formNameEn} onChange={(e) => setFormNameEn(e.target.value)} placeholder="3 days before" />
                </div>
              </div>

              <div>
                <Label>{currentLang === "ar" ? "توقيت الإرسال" : "Send Timing"}</Label>
                <Select value={formDaysOffset} onValueChange={setFormDaysOffset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRESET_SCHEDULES.map((p) => (
                      <SelectItem key={p.days_offset} value={String(p.days_offset)}>
                        {currentLang === "ar" ? p.name : p.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{currentLang === "ar" ? "عنوان الرسالة" : "Email Subject"}</Label>
                <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} dir="rtl" />
              </div>

              <div>
                <Label>{currentLang === "ar" ? "نص الرسالة" : "Message Body"}</Label>
                <Textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} rows={4} dir="rtl" />
                <p className="text-xs text-muted-foreground mt-1">
                  {currentLang === "ar"
                    ? "المتغيرات: {{customer_name}} {{invoice_number}} {{amount_due}} {{currency}} {{due_date}}"
                    : "Variables: {{customer_name}} {{invoice_number}} {{amount_due}} {{currency}} {{due_date}}"}
                </p>
              </div>

              <Button onClick={handleSave} className="w-full">
                {currentLang === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="schedules">
        <TabsList>
          <TabsTrigger value="schedules" className="gap-2">
            <Clock className="h-4 w-4" />
            {currentLang === "ar" ? "الجداول" : "Schedules"}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Mail className="h-4 w-4" />
            {currentLang === "ar" ? "سجل الإرسال" : "Send History"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="space-y-4">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mb-4 opacity-30" />
                <p>{currentLang === "ar" ? "لا توجد تذكيرات مجدولة بعد" : "No reminders scheduled yet"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {schedules.map((s) => (
                <Card key={s.id} className={s.is_active ? "" : "opacity-60"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {currentLang === "ar" ? s.name : (s.name_en || s.name)}
                      </CardTitle>
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(checked) => toggleSchedule(s.id, checked)}
                      />
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {getDaysLabel(s.days_offset)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Badge variant={s.days_offset <= 0 ? "default" : "destructive"} className="text-xs">
                        {s.days_offset <= 0
                          ? (currentLang === "ar" ? "تذكير مسبق" : "Pre-due")
                          : (currentLang === "ar" ? "تذكير متأخر" : "Overdue")}
                      </Badge>
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.subject_template}</p>
                      <div className="flex gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteSchedule(s.id)} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {logs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mb-4 opacity-30" />
                <p>{currentLang === "ar" ? "لم يتم إرسال تذكيرات بعد" : "No reminders sent yet"}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-start font-medium">{currentLang === "ar" ? "العميل" : "Customer"}</th>
                        <th className="p-3 text-start font-medium">{currentLang === "ar" ? "الفاتورة" : "Invoice"}</th>
                        <th className="p-3 text-start font-medium">{currentLang === "ar" ? "المستلم" : "Recipient"}</th>
                        <th className="p-3 text-start font-medium">{currentLang === "ar" ? "الحالة" : "Status"}</th>
                        <th className="p-3 text-start font-medium">{currentLang === "ar" ? "التاريخ" : "Date"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-3">{(log.customers as any)?.name || "-"}</td>
                          <td className="p-3 font-mono text-xs">{(log.invoices as any)?.invoice_number || "-"}</td>
                          <td className="p-3 text-xs">{log.recipient}</td>
                          <td className="p-3">
                            {log.status === "sent" ? (
                              <Badge variant="default" className="gap-1 text-xs">
                                <CheckCircle className="h-3 w-3" />
                                {currentLang === "ar" ? "تم الإرسال" : "Sent"}
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="h-3 w-3" />
                                {currentLang === "ar" ? "فشل" : "Failed"}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {format(new Date(log.sent_at), "yyyy-MM-dd HH:mm")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentRemindersPage;
