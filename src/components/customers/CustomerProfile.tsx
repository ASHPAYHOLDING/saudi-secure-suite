import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, User, Building2, Mail, Phone, MapPin, FileText,
  CreditCard, Tag, Plus, X, MessageSquare, PhoneCall, CalendarDays,
  CheckSquare, History, DollarSign, TrendingUp, Loader2, Send,
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
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerProfileProps {
  customerId: string;
  onBack: () => void;
}

interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

const ACTIVITY_TYPES = [
  { value: "note", label: "ملاحظة", icon: MessageSquare },
  { value: "call", label: "مكالمة", icon: PhoneCall },
  { value: "email", label: "بريد", icon: Mail },
  { value: "meeting", label: "اجتماع", icon: CalendarDays },
  { value: "task", label: "مهمة", icon: CheckSquare },
];

const activityIcon = (type: string) => {
  const found = ACTIVITY_TYPES.find((a) => a.value === type);
  return found ? found.icon : History;
};

const activityLabel = (type: string) => {
  const found = ACTIVITY_TYPES.find((a) => a.value === type);
  return found ? found.label : type;
};

const CustomerProfile = ({ customerId, onBack }: CustomerProfileProps) => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [newActivity, setNewActivity] = useState({ type: "note", title: "", description: "" });
  const [addingActivity, setAddingActivity] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [custRes, invRes, quotRes, actRes] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).single(),
      supabase.from("invoices").select("id, invoice_number, invoice_date, grand_total, status, amount_due").eq("customer_id", customerId).eq("tenant_id", tenantId).order("invoice_date", { ascending: false }),
      supabase.from("quotations").select("id, quotation_number, created_at, grand_total, status").eq("customer_id", customerId).eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      (supabase as any).from("customer_activities").select("*").eq("customer_id", customerId).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
    ]);

    if (custRes.data) {
      setCustomer(custRes.data);
      setTags((custRes.data as any).tags || []);
    }
    setInvoices(invRes.data || []);
    setQuotations(quotRes.data || []);
    setActivities(actRes.data || []);
    setLoading(false);
  }, [customerId, tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.status === "paid" ? Number(inv.grand_total) : 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0);
  const totalQuoted = quotations.reduce((sum, q) => sum + Number(q.grand_total), 0);

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) return;
    const updated = [...tags, tag];
    await (supabase as any).from("customers").update({ tags: updated }).eq("id", customerId);
    setTags(updated);
    setNewTag("");
  };

  const handleRemoveTag = async (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    await (supabase as any).from("customers").update({ tags: updated }).eq("id", customerId);
    setTags(updated);
  };

  const handleAddActivity = async () => {
    if (!newActivity.title.trim() || !tenantId || !user) return;
    setAddingActivity(true);
    await (supabase as any).from("customer_activities").insert({
      tenant_id: tenantId,
      customer_id: customerId,
      activity_type: newActivity.type,
      title: newActivity.title.trim(),
      description: newActivity.description.trim() || null,
      created_by: user.id,
    });
    setNewActivity({ type: "note", title: "", description: "" });
    setAddingActivity(false);
    toast({ title: "تمت إضافة النشاط" });
    fetchAll();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      draft: { label: "مسودة", variant: "secondary" },
      sent: { label: "مُرسلة", variant: "outline" },
      issued: { label: "صادرة", variant: "outline" },
      paid: { label: "مدفوعة", variant: "default" },
      overdue: { label: "متأخرة", variant: "destructive" },
      cancelled: { label: "ملغاة", variant: "destructive" },
      approved: { label: "معتمد", variant: "default" },
      rejected: { label: "مرفوض", variant: "destructive" },
      converted: { label: "محوّل", variant: "default" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!customer) {
    return <div className="p-6 text-center text-muted-foreground">العميل غير موجود</div>;
  }

  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowRight size={18} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {customer.customer_type === "business" ? <Building2 size={22} /> : <User size={22} />}
            {customer.name}
          </h1>
          {customer.name_en && <p className="text-sm text-muted-foreground font-english">{customer.name_en}</p>}
        </div>
        <Badge variant={customer.is_active ? "default" : "secondary"}>
          {customer.is_active ? "نشط" : "غير نشط"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الإيرادات</p>
              <p className="text-lg font-bold text-foreground">{totalRevenue.toLocaleString()} ر.س</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingUp size={20} className="text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مستحقات معلّقة</p>
              <p className="text-lg font-bold text-foreground">{totalOutstanding.toLocaleString()} ر.س</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <CreditCard size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">عدد الفواتير</p>
              <p className="text-lg font-bold text-foreground">{invoices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <FileText size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">عروض أسعار</p>
              <p className="text-lg font-bold text-foreground">{quotations.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Tag size={14} /> الوسوم</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive"><X size={12} /></button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                placeholder="وسم جديد..."
                className="h-7 w-28 text-xs"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddTag}><Plus size={14} /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info + Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">بيانات الاتصال</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {customer.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={14} />
                <span className="font-english">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={14} />
                <span className="font-english" dir="ltr">{customer.phone}</span>
              </div>
            )}
            {(customer.address_street || customer.address_city) && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin size={14} className="mt-0.5" />
                <span>{[customer.address_street, customer.address_city, customer.address_zip].filter(Boolean).join("، ")}</span>
              </div>
            )}
            {customer.cr_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText size={14} />
                <span>سجل تجاري: <span className="font-english">{customer.cr_number}</span></span>
              </div>
            )}
            {customer.vat_number && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText size={14} />
                <span>رقم ضريبي: <span className="font-english">{customer.vat_number}</span></span>
              </div>
            )}
            {customer.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-foreground text-xs">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="invoices" dir="rtl">
            <TabsList className="w-full">
              <TabsTrigger value="invoices">الفواتير ({invoices.length})</TabsTrigger>
              <TabsTrigger value="quotations">عروض الأسعار ({quotations.length})</TabsTrigger>
              <TabsTrigger value="timeline">سجل الأنشطة</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="mt-4">
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد فواتير لهذا العميل</div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <motion.div key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/20 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm text-foreground font-english">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(inv.invoice_date), "dd MMM yyyy", { locale: ar })}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-sm text-foreground">{Number(inv.grand_total).toLocaleString()} ر.س</p>
                        {statusBadge(inv.status)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="quotations" className="mt-4">
              {quotations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد عروض أسعار لهذا العميل</div>
              ) : (
                <div className="space-y-2">
                  {quotations.map((q) => (
                    <motion.div key={q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/20 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-sm text-foreground font-english">{q.quotation_number}</p>
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

            <TabsContent value="timeline" className="mt-4 space-y-4">
              {/* Add activity form */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex gap-2">
                    <Select value={newActivity.type} onValueChange={(v) => setNewActivity((p) => ({ ...p, type: v }))}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={newActivity.title}
                      onChange={(e) => setNewActivity((p) => ({ ...p, title: e.target.value }))}
                      placeholder="عنوان النشاط..."
                      className="flex-1"
                    />
                  </div>
                  <Textarea
                    value={newActivity.description}
                    onChange={(e) => setNewActivity((p) => ({ ...p, description: e.target.value }))}
                    placeholder="تفاصيل إضافية (اختياري)..."
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleAddActivity} disabled={addingActivity || !newActivity.title.trim()} className="gap-1">
                      <Send size={14} />
                      إضافة
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              {activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد أنشطة مسجلة</div>
              ) : (
                <div className="relative border-r-2 border-border pr-6 space-y-4">
                  {activities.map((act) => {
                    const Icon = activityIcon(act.activity_type);
                    return (
                      <motion.div key={act.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                        className="relative"
                      >
                        <div className="absolute -right-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-card border-2 border-border">
                          <Icon size={12} className="text-muted-foreground" />
                        </div>
                        <div className="rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">{activityLabel(act.activity_type)}</Badge>
                              <span className="font-medium text-sm text-foreground">{act.title}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(act.created_at), "dd/MM/yyyy HH:mm", { locale: ar })}
                            </span>
                          </div>
                          {act.description && <p className="text-xs text-muted-foreground mt-1">{act.description}</p>}
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
