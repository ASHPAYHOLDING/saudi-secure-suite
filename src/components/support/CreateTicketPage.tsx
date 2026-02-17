import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Headphones, Send, ArrowRight, Loader2,
  AlertCircle, Lightbulb, MessageCircle, CreditCard,
  FileText, Tag, ArrowLeftRight, User, Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "technical", label: "مشكلة تقنية", icon: AlertCircle, desc: "أعطال أو أخطاء تقنية في النظام" },
  { value: "suggestion", label: "اقتراح", icon: Lightbulb, desc: "أفكار واقتراحات لتحسين النظام" },
  { value: "inquiry", label: "استفسار", icon: MessageCircle, desc: "أسئلة واستفسارات عامة" },
  { value: "payment_gateway", label: "بوابة الدفع", icon: CreditCard, desc: "مشاكل متعلقة ببوابة الدفع" },
  { value: "invoices", label: "الفواتير", icon: FileText, desc: "مشاكل في إنشاء أو إدارة الفواتير" },
  { value: "subscriptions", label: "الاشتراكات", icon: Tag, desc: "استفسارات حول الباقات والاشتراكات" },
  { value: "transfers", label: "التحويلات", icon: ArrowLeftRight, desc: "مشاكل في التحويلات المالية" },
  { value: "account", label: "الحساب", icon: User, desc: "إعدادات الحساب والملف الشخصي" },
  { value: "other", label: "أخرى", icon: Settings, desc: "مواضيع أخرى لا تندرج تحت التصنيفات" },
];

const PRIORITIES = [
  { value: "low", label: "منخفضة", color: "border-muted text-muted-foreground", bg: "bg-muted/30" },
  { value: "medium", label: "متوسطة", color: "border-warning/40 text-warning", bg: "bg-warning/5" },
  { value: "high", label: "عالية", color: "border-destructive/40 text-destructive", bg: "bg-destructive/5" },
  { value: "urgent", label: "عاجلة", color: "border-destructive text-destructive", bg: "bg-destructive/10" },
];

const CreateTicketPage = () => {
  const navigate = useNavigate();
  const { tenantId, user, profile } = useAuth();
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");

  const selectedCat = CATEGORIES.find(c => c.value === category);

  const createTicket = async () => {
    if (!subject.trim() || !description.trim() || !category) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    setCreating(true);
    try {
      const ticketNumber = `TK-${Date.now().toString(36).toUpperCase()}`;
      const { data: ticket, error } = await supabase.from("support_tickets").insert({
        ticket_number: ticketNumber,
        scope: "platform",
        tenant_id: tenantId!,
        created_by: user!.id,
        subject: subject.trim(),
        category,
        priority,
        customer_name: profile?.full_name || "",
        customer_email: profile?.email || "",
      }).select().single();

      if (error) throw error;

      await supabase.from("ticket_replies").insert({
        ticket_id: (ticket as any).id,
        user_id: user!.id,
        sender_type: "user",
        sender_name: profile?.full_name || "مستخدم",
        sender_email: profile?.email || "",
        content: description.trim(),
      });

      try {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            ticketId: (ticket as any).id,
            ticketNumber,
            subject: subject.trim(),
            category: CATEGORIES.find(c => c.value === category)?.label || category,
            priority: PRIORITIES.find(p => p.value === priority)?.label || priority,
            senderName: profile?.full_name || "",
            senderEmail: profile?.email || "",
            content: description.trim(),
            type: "new_ticket",
          },
        });
      } catch (e) { /* silent */ }

      toast.success(`تم إنشاء التذكرة ${ticketNumber} بنجاح`);
      navigate("/dashboard/support");
    } catch (err) {
      toast.error("حدث خطأ أثناء إنشاء التذكرة");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button variant="ghost" size="sm" className="gap-2 mb-4" onClick={() => navigate("/dashboard/support")}>
          <ArrowRight size={16} /> العودة للتذاكر
        </Button>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">تذكرة دعم جديدة</h1>
            <p className="text-sm text-muted-foreground">أخبرنا بمشكلتك أو اقتراحك وسنقوم بمساعدتك في أقرب وقت</p>
          </div>
        </div>
      </motion.div>

      {/* Category Selection */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">نوع المشكلة *</CardTitle>
            <CardDescription>اختر التصنيف الأنسب لتذكرتك</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-start transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5 shadow-sm"
                        : "border-border hover:border-accent/30 hover:bg-muted/30"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-accent" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? "text-accent" : "text-foreground"}`}>{cat.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate hidden sm:block">{cat.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subject & Priority */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">عنوان التذكرة *</Label>
              <Input
                placeholder="وصف مختصر وواضح للمشكلة أو الاقتراح"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">الأولوية</Label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      priority === p.value
                        ? `${p.color} ${p.bg} border-current`
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-1.5 block">تفاصيل المشكلة *</Label>
              <Textarea
                placeholder="اشرح مشكلتك أو اقتراحك بالتفصيل... كلما كانت التفاصيل أكثر، كان الرد أسرع وأدق"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                يمكنك تضمين خطوات إعادة إنتاج المشكلة، رسائل الخطأ، أو أي تفاصيل تساعدنا في فهم الموقف
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary & Submit */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCat && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <selectedCat.icon className="w-3 h-3" />
                    {selectedCat.label}
                  </Badge>
                )}
                {priority && (
                  <Badge variant="outline" className={`text-xs ${PRIORITIES.find(p => p.value === priority)?.color}`}>
                    {PRIORITIES.find(p => p.value === priority)?.label}
                  </Badge>
                )}
                {subject && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{subject}</span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => navigate("/dashboard/support")} className="flex-1 sm:flex-none">
                  إلغاء
                </Button>
                <Button
                  onClick={createTicket}
                  disabled={creating || !subject.trim() || !description.trim() || !category}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                  إرسال التذكرة
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CreateTicketPage;
