import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, User, Building2, Mail, Phone, MapPin, FileText,
  CreditCard, Tag, Plus, X, MessageSquare, PhoneCall, CalendarDays,
  CheckSquare, History, DollarSign, TrendingUp, Loader2, Send,
  Receipt, Clock, Star, Crown, AlertTriangle, Edit2, Trash2,
  BarChart3, CheckCircle2, Circle, Calendar, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers"> & { segment?: string; credit_limit?: number | null };

interface CustomerProfileProps { customerId: string; onBack: () => void; }

interface Activity {
  id: string; activity_type: string; title: string;
  description: string | null; created_by: string; created_at: string;
}

interface Task {
  id: string; title: string; description: string | null;
  due_date: string | null; is_completed: boolean;
  completed_at: string | null; created_by: string; created_at: string;
}

const ACTIVITY_TYPES = [
  { value: "note",    label: "ملاحظة",   icon: MessageSquare, color: "bg-secondary text-muted-foreground" },
  { value: "call",    label: "مكالمة",   icon: PhoneCall,     color: "bg-success/10 text-success" },
  { value: "email",   label: "بريد",     icon: Mail,          color: "bg-info/10 text-info" },
  { value: "meeting", label: "اجتماع",   icon: CalendarDays,  color: "bg-warning/10 text-warning" },
  { value: "task",    label: "مهمة",     icon: CheckSquare,   color: "bg-accent/10 text-accent" },
];

const SEGMENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  standard: { label: "عادي",   icon: User,   color: "bg-secondary text-muted-foreground" },
  premium:  { label: "مميز",   icon: Star,   color: "bg-warning/10 text-warning" },
  vip:      { label: "VIP",    icon: Crown,  color: "bg-accent/10 text-accent" },
  inactive: { label: "خامل",  icon: History, color: "bg-destructive/10 text-destructive" },
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: "مسودة",   cls: "bg-secondary text-muted-foreground" },
    sent:      { label: "مُرسلة",  cls: "bg-info/10 text-info" },
    issued:    { label: "صادرة",   cls: "bg-info/10 text-info" },
    paid:      { label: "مدفوعة",  cls: "bg-success/10 text-success" },
    overdue:   { label: "متأخرة",  cls: "bg-destructive/10 text-destructive" },
    cancelled: { label: "ملغاة",   cls: "bg-destructive/10 text-destructive" },
    approved:  { label: "معتمد",   cls: "bg-success/10 text-success" },
    rejected:  { label: "مرفوض",  cls: "bg-destructive/10 text-destructive" },
    converted: { label: "محوّل",   cls: "bg-accent/10 text-accent" },
  };
  const s = map[status] || { label: status, cls: "bg-secondary text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
};

const CustomerProfile = ({ customerId, onBack }: CustomerProfileProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newActivity, setNewActivity] = useState({ type: "note", title: "", description: "" });
  const [addingActivity, setAddingActivity] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "" });
  const [addingTask, setAddingTask] = useState(false);
  const [editingSegment, setEditingSegment] = useState(false);
  const [tempSegment, setTempSegment] = useState("standard");
  const [editingCreditLimit, setEditingCreditLimit] = useState(false);
  const [tempCreditLimit, setTempCreditLimit] = useState("");

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [custRes, invRes, quotRes, actRes, taskRes] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).single(),
      supabase.from("invoices").select("id,invoice_number,invoice_date,grand_total,status,amount_due").eq("customer_id", customerId).eq("tenant_id", tenantId).order("invoice_date", { ascending: false }),
      supabase.from("quotations").select("id,quotation_number,created_at,grand_total,status").eq("customer_id", customerId).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      (supabase as any).from("customer_activities").select("*").eq("customer_id", customerId).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("customer_tasks").select("*").eq("customer_id", customerId).eq("tenant_id", tenantId).order("is_completed", { ascending: true }).order("due_date", { ascending: true }),
    ]);
    if (custRes.data) {
      const c = custRes.data as Customer;
      setCustomer(c);
      setTags((c as any).tags || []);
      setTempSegment((c as any).segment || "standard");
      setTempCreditLimit((c as any).credit_limit ? String((c as any).credit_limit) : "");
    }
    setInvoices(invRes.data || []);
    setQuotations(quotRes.data || []);
    setActivities(actRes.data || []);
    setTasks(taskRes.data || []);
    setLoading(false);
  }, [customerId, tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalRevenue = invoices.reduce((s, i) => s + (i.status === "paid" ? Number(i.grand_total) : 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.amount_due || 0), 0);
  const avgInvoice = invoices.length ? invoices.reduce((s, i) => s + Number(i.grand_total), 0) / invoices.length : 0;
  const lastPurchase = invoices[0]?.invoice_date;
  const creditLimit = (customer as any)?.credit_limit;
  const creditUsedPct = creditLimit ? Math.min((totalOutstanding / creditLimit) * 100, 100) : 0;

  // At-risk check
  const isAtRisk = lastPurchase && (() => { const d = new Date(); d.setDate(d.getDate() - 90); return new Date(lastPurchase) < d; })();

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) return;
    const updated = [...tags, tag];
    await (supabase as any).from("customers").update({ tags: updated }).eq("id", customerId);
    setTags(updated); setNewTag("");
  };

  const handleRemoveTag = async (tag: string) => {
    const updated = tags.filter(t => t !== tag);
    await (supabase as any).from("customers").update({ tags: updated }).eq("id", customerId);
    setTags(updated);
  };

  const handleAddActivity = async () => {
    if (!newActivity.title.trim() || !tenantId || !user) return;
    setAddingActivity(true);
    await (supabase as any).from("customer_activities").insert({
      tenant_id: tenantId, customer_id: customerId,
      activity_type: newActivity.type, title: newActivity.title.trim(),
      description: newActivity.description.trim() || null, created_by: user.id,
    });
    setNewActivity({ type: "note", title: "", description: "" });
    setAddingActivity(false);
    toast({ title: "تمت إضافة النشاط" }); fetchAll();
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !tenantId || !user) return;
    setAddingTask(true);
    await (supabase as any).from("customer_tasks").insert({
      tenant_id: tenantId, customer_id: customerId,
      title: newTask.title.trim(), description: newTask.description.trim() || null,
      due_date: newTask.due_date || null, created_by: user.id,
    });
    setNewTask({ title: "", description: "", due_date: "" });
    setAddingTask(false);
    toast({ title: "تمت إضافة المهمة" }); fetchAll();
  };

  const toggleTask = async (task: Task) => {
    await (supabase as any).from("customer_tasks").update({
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? new Date().toISOString() : null,
    }).eq("id", task.id);
    fetchAll();
  };

  const deleteTask = async (id: string) => {
    await (supabase as any).from("customer_tasks").delete().eq("id", id);
    fetchAll();
  };

  const saveSegment = async () => {
    await (supabase as any).from("customers").update({ segment: tempSegment }).eq("id", customerId);
    setEditingSegment(false); fetchAll();
    toast({ title: "تم تحديث التصنيف" });
  };

  const saveCreditLimit = async () => {
    const val = tempCreditLimit ? Number(tempCreditLimit) : null;
    await (supabase as any).from("customers").update({ credit_limit: val }).eq("id", customerId);
    setEditingCreditLimit(false); fetchAll();
    toast({ title: "تم تحديث الحد الائتماني" });
  };

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);
  const overdueTasks = pendingTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  if (!customer) return <div className="p-6 text-center text-muted-foreground">العميل غير موجود</div>;

  const seg = SEGMENT_CONFIG[(customer as any).segment || "standard"] || SEGMENT_CONFIG.standard;
  const SegIcon = seg.icon;

  return (
    <div dir="rtl" className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowRight size={18} /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {customer.customer_type === "business" ? <Building2 size={22} /> : <User size={22} />}
              {customer.name}
            </h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${seg.color}`}>
              <SegIcon size={12} /> {seg.label}
            </span>
            {isAtRisk && (
              <span className="rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 bg-destructive/10 text-destructive">
                <AlertTriangle size={12} /> معرض للمغادرة
              </span>
            )}
            <Badge variant={customer.is_active ? "default" : "secondary"}>
              {customer.is_active ? "نشط" : "غير نشط"}
            </Badge>
          </div>
          {customer.name_en && <p className="text-sm text-muted-foreground">{customer.name_en}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => window.open(`/dashboard/invoices/new?customer=${customerId}`, "_self")}>
            <Receipt size={13} /> فاتورة جديدة
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => window.open(`/dashboard/quotations/new?customer=${customerId}`, "_self")}>
            <FileText size={13} /> عرض سعر
          </Button>
        </div>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10"><DollarSign size={18} className="text-success" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">إجمالي المدفوع</p>
              <p className="text-base font-bold text-foreground">{totalRevenue.toLocaleString()} ر.س</p>
            </div>
          </CardContent>
        </Card>
        <Card className={totalOutstanding > 0 && creditLimit && totalOutstanding > creditLimit ? "border-destructive/40" : ""}>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10"><TrendingUp size={18} className="text-destructive" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">مستحقات معلّقة</p>
              <p className="text-base font-bold text-foreground">{totalOutstanding.toLocaleString()} ر.س</p>
              {creditLimit && <p className="text-[10px] text-muted-foreground">من {creditLimit.toLocaleString()} ر.س</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10"><BarChart3 size={18} className="text-info" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">متوسط الفاتورة</p>
              <p className="text-base font-bold text-foreground">{Math.round(avgInvoice).toLocaleString()} ر.س</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10"><CreditCard size={18} className="text-accent" /></div>
            <div>
              <p className="text-[11px] text-muted-foreground">عدد الفواتير</p>
              <p className="text-base font-bold text-foreground">{invoices.length}</p>
              {lastPurchase && <p className="text-[10px] text-muted-foreground">آخر: {format(new Date(lastPurchase), "dd/MM/yyyy")}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Limit Progress */}
      {creditLimit && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-foreground">الحد الائتماني</p>
              <p className="text-xs text-muted-foreground">{totalOutstanding.toLocaleString()} / {creditLimit.toLocaleString()} ر.س</p>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${creditUsedPct >= 100 ? "bg-destructive" : creditUsedPct >= 80 ? "bg-warning" : "bg-success"}`}
                style={{ width: `${creditUsedPct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {creditUsedPct >= 100 ? "⚠️ تجاوز الحد الائتماني" : `${Math.round(creditUsedPct)}% مستخدم`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">بيانات الاتصال</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {customer.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail size={13} /><span>{customer.email}</span></div>}
              {customer.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone size={13} /><span dir="ltr">{customer.phone}</span></div>}
              {(customer.address_street || customer.address_city) && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin size={13} className="mt-0.5" />
                  <span>{[customer.address_street, customer.address_city, customer.address_zip].filter(Boolean).join("، ")}</span>
                </div>
              )}
              {customer.cr_number && <div className="flex items-center gap-2 text-muted-foreground"><FileText size={13} /><span>سجل: {customer.cr_number}</span></div>}
              {customer.vat_number && <div className="flex items-center gap-2 text-muted-foreground"><FileText size={13} /><span>ضريبي: {customer.vat_number}</span></div>}
              {customer.notes && <div className="pt-2 border-t border-border"><p className="text-xs text-muted-foreground mb-1">ملاحظات</p><p className="text-xs text-foreground">{customer.notes}</p></div>}
            </CardContent>
          </Card>

          {/* Segment */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1"><Crown size={13} /> التصنيف</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSegment(v => !v)}><Edit2 size={12} /></Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingSegment ? (
                <div className="space-y-2">
                  <select value={tempSegment} onChange={e => setTempSegment(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent">
                    {Object.entries(SEGMENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={saveSegment}>حفظ</Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setEditingSegment(false)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <span className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 w-fit ${seg.color}`}>
                  <SegIcon size={12} /> {seg.label}
                </span>
              )}
            </CardContent>
          </Card>

          {/* Credit Limit */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1"><DollarSign size={13} /> الحد الائتماني</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingCreditLimit(v => !v)}><Edit2 size={12} /></Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingCreditLimit ? (
                <div className="space-y-2">
                  <Input value={tempCreditLimit} onChange={e => setTempCreditLimit(e.target.value)} type="number" placeholder="50000" dir="ltr" className="h-9" />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={saveCreditLimit}>حفظ</Button>
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setEditingCreditLimit(false)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-semibold text-foreground">
                  {creditLimit ? `${creditLimit.toLocaleString()} ر.س` : <span className="text-muted-foreground text-xs">غير محدد</span>}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Tag size={13} /> الوسوم</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive"><X size={10} /></button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddTag()}
                    placeholder="وسم جديد..." className="h-6 w-24 text-[11px]" />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAddTag}><Plus size={12} /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="tasks" dir="rtl">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="tasks" className="text-xs relative">
                مهام المتابعة
                {overdueTasks.length > 0 && (
                  <span className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">{overdueTasks.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs">الفواتير ({invoices.length})</TabsTrigger>
              <TabsTrigger value="quotations" className="text-xs">عروض ({quotations.length})</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">سجل الأنشطة</TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-4 space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <Input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="عنوان المهمة..." className="h-9" />
                  <div className="flex gap-2">
                    <Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                      placeholder="تفاصيل (اختياري)" rows={1} className="flex-1 resize-none" />
                    <div className="flex flex-col gap-1">
                      <Input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                        className="h-9 text-xs w-36" />
                      <Button size="sm" onClick={handleAddTask} disabled={addingTask || !newTask.title.trim()} className="gap-1 h-9">
                        <Plus size={13} /> إضافة مهمة
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد مهام متابعة</div>
              ) : (
                <div className="space-y-2">
                  {/* Pending */}
                  {pendingTasks.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-2">قيد التنفيذ ({pendingTasks.length})</p>
                      {pendingTasks.map(task => {
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                        return (
                          <motion.div key={task.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className={`flex items-start gap-3 rounded-lg border p-3 mb-2 ${isOverdue ? "border-destructive/40 bg-destructive/3" : "border-border"}`}>
                            <button onClick={() => toggleTask(task)} className="mt-0.5 text-muted-foreground hover:text-success">
                              <Circle size={16} />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{task.title}</p>
                              {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                              {task.due_date && (
                                <p className={`text-[11px] flex items-center gap-1 mt-1 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                                  <Calendar size={10} />
                                  {isOverdue ? "متأخرة! " : ""}{format(new Date(task.due_date), "dd/MM/yyyy")}
                                </p>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
                              <Trash2 size={12} />
                            </Button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                  {/* Completed */}
                  {completedTasks.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-2">مكتملة ({completedTasks.length})</p>
                      {completedTasks.map(task => (
                        <motion.div key={task.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 mb-2 opacity-60">
                          <button onClick={() => toggleTask(task)} className="mt-0.5 text-success"><CheckCircle2 size={16} /></button>
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground line-through">{task.title}</p>
                            {task.completed_at && <p className="text-[11px] text-muted-foreground">اكتملت {formatDistanceToNow(new Date(task.completed_at), { locale: ar, addSuffix: true })}</p>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="mt-4">
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد فواتير لهذا العميل</div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <motion.div key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/20 transition-colors">
                      <div>
                        <p className="font-medium text-sm text-foreground">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(inv.invoice_date), "dd MMM yyyy", { locale: ar })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {inv.amount_due > 0 && (
                          <span className="text-xs text-destructive">متبقي: {Number(inv.amount_due).toLocaleString()}</span>
                        )}
                        <p className="font-semibold text-sm text-foreground">{Number(inv.grand_total).toLocaleString()} ر.س</p>
                        {statusBadge(inv.status)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Quotations Tab */}
            <TabsContent value="quotations" className="mt-4">
              {quotations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد عروض أسعار لهذا العميل</div>
              ) : (
                <div className="space-y-2">
                  {quotations.map(q => (
                    <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/20 transition-colors">
                      <div>
                        <p className="font-medium text-sm text-foreground">{q.quotation_number}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(q.created_at), "dd MMM yyyy", { locale: ar })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-sm text-foreground">{Number(q.grand_total).toLocaleString()} ر.س</p>
                        {statusBadge(q.status)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="mt-4 space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex gap-2">
                    <Select value={newActivity.type} onValueChange={v => setNewActivity(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={newActivity.title} onChange={e => setNewActivity(p => ({ ...p, title: e.target.value }))}
                      placeholder="عنوان النشاط..." className="flex-1" />
                  </div>
                  <Textarea value={newActivity.description} onChange={e => setNewActivity(p => ({ ...p, description: e.target.value }))}
                    placeholder="تفاصيل إضافية (اختياري)..." rows={2} />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddActivity} disabled={addingActivity || !newActivity.title.trim()} className="gap-1">
                      <Send size={13} /> إضافة
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد أنشطة مسجلة</div>
              ) : (
                <div className="relative border-r-2 border-border pr-6 space-y-4 mr-3">
                  {activities.map(act => {
                    const aType = ACTIVITY_TYPES.find(a => a.value === act.activity_type) || ACTIVITY_TYPES[0];
                    const Icon = aType.icon;
                    return (
                      <motion.div key={act.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative">
                        <div className={`absolute -right-[1.85rem] top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background ${aType.color}`}>
                          <Icon size={13} />
                        </div>
                        <div className="rounded-lg border border-border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm text-foreground">{act.title}</p>
                              {act.description && <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(act.created_at), { locale: ar, addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
