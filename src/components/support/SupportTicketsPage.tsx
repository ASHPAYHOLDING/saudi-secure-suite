import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Headphones, Plus, Search, Clock, CheckCircle2,
  AlertCircle, MessageCircle, ChevronLeft, Send,
  LifeBuoy, Lightbulb, CreditCard, FileText, Settings,
  ArrowLeftRight, User, Tag, Loader2, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const CATEGORIES = [
  { value: "technical", label: "مشكلة تقنية", icon: AlertCircle },
  { value: "suggestion", label: "اقتراح", icon: Lightbulb },
  { value: "inquiry", label: "استفسار", icon: MessageCircle },
  { value: "payment_gateway", label: "بوابة الدفع", icon: CreditCard },
  { value: "invoices", label: "الفواتير", icon: FileText },
  { value: "subscriptions", label: "الاشتراكات", icon: Tag },
  { value: "transfers", label: "التحويلات", icon: ArrowLeftRight },
  { value: "account", label: "الحساب", icon: User },
  { value: "other", label: "أخرى", icon: Settings },
];

const STATUSES: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "مفتوحة", color: "bg-info/10 text-info border-info/20", icon: AlertCircle },
  in_progress: { label: "قيد المعالجة", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  waiting_customer: { label: "بانتظار ردك", color: "bg-accent/10 text-accent border-accent/20", icon: MessageCircle },
  resolved: { label: "تم الحل", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  closed: { label: "مغلقة", color: "bg-muted text-muted-foreground border-muted", icon: CheckCircle2 },
};

interface Ticket {
  id: string;
  ticket_number: string;
  scope: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  content: string;
  sender_type: string;
  sender_name: string;
  created_at: string;
  is_internal_note: boolean;
}

const SupportTicketsPage = () => {
  const { tenantId, user, profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetchTickets();

    const channel = supabase
      .channel("support-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchTickets())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_replies" }, (payload) => {
        if (selectedTicket && (payload.new as any).ticket_id === selectedTicket.id) {
          fetchReplies(selectedTicket.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("tenant_id", tenantId!)
      .eq("scope", "platform")
      .order("created_at", { ascending: false });
    setTickets((data as any[]) || []);
    setLoading(false);
  };

  const fetchReplies = async (ticketId: string) => {
    const { data } = await supabase
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: true });
    setReplies((data as any[]) || []);
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await fetchReplies(ticket.id);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await supabase.from("ticket_replies").insert({
        ticket_id: selectedTicket.id,
        user_id: user!.id,
        sender_type: "user",
        sender_name: profile?.full_name || "مستخدم",
        sender_email: profile?.email || "",
        content: replyText.trim(),
      });

      if (selectedTicket.status === "waiting_customer") {
        await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selectedTicket.id);
      }

      try {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            ticketId: selectedTicket.id,
            ticketNumber: selectedTicket.ticket_number,
            subject: selectedTicket.subject,
            senderName: profile?.full_name || "",
            senderEmail: profile?.email || "",
            content: replyText.trim(),
            type: "reply",
          },
        });
      } catch (e) { /* silent */ }

      setReplyText("");
      fetchReplies(selectedTicket.id);
      fetchTickets();
      toast.success("تم إرسال الرد بنجاح");
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setSending(false);
    }
  };

  const filtered = tickets.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (searchQuery && !t.subject.includes(searchQuery) && !t.ticket_number.includes(searchQuery)) return false;
    return true;
  });

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    waiting_customer: tickets.filter(t => t.status === "waiting_customer").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ticket detail view
  if (selectedTicket) {
    const st = STATUSES[selectedTicket.status] || STATUSES.open;
    const cat = CATEGORIES.find(c => c.value === selectedTicket.category);
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedTicket(null)}>
          <ArrowRight size={16} /> العودة للتذاكر
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">{selectedTicket.ticket_number}</Badge>
                  <Badge variant="outline" className={st.color}>{st.label}</Badge>
                  {cat && <Badge variant="outline" className="text-xs">{cat.label}</Badge>}
                </div>
                <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-3">
          {replies.map((reply) => (
            <motion.div key={reply.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`rounded-xl p-4 border ${
                reply.sender_type === "admin"
                  ? "bg-accent/5 border-accent/20 ms-8"
                  : "bg-card border-border me-8"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    reply.sender_type === "admin" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                  }`}>
                    {reply.sender_type === "admin" ? "د" : "أ"}
                  </div>
                  <span className="text-xs font-medium text-foreground">{reply.sender_name || (reply.sender_type === "admin" ? "فريق الدعم" : "أنت")}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: ar })}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{reply.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {selectedTicket.status !== "closed" && (
          <Card>
            <CardContent className="p-4">
              <Textarea
                placeholder="اكتب ردك هنا..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                className="mb-3"
              />
              <div className="flex items-center justify-end">
                <Button onClick={sendReply} disabled={!replyText.trim() || sending} className="gap-2">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
                  إرسال الرد
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Headphones className="w-6 h-6 text-accent" />
            الدعم الفني
          </h1>
          <p className="text-sm text-muted-foreground mt-1">تواصل مع فريق الدعم لحل مشاكلك واقتراحاتك</p>
        </div>
        <Button onClick={() => navigate("/dashboard/support/new")} className="gap-2">
          <Plus size={16} />
          تذكرة جديدة
        </Button>
      </motion.div>

      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: "all", label: "الكل" },
          { key: "open", label: "مفتوحة" },
          { key: "in_progress", label: "قيد المعالجة" },
          { key: "waiting_customer", label: "بانتظار ردك" },
          { key: "resolved", label: "تم الحل" },
        ].map(tab => (
          <Button
            key={tab.key}
            variant={filterStatus === tab.key ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setFilterStatus(tab.key)}
          >
            {tab.label}
            <Badge variant="secondary" className="text-[10px] px-1.5">{statusCounts[tab.key as keyof typeof statusCounts] || 0}</Badge>
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ابحث برقم التذكرة أو الموضوع..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-9"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <LifeBuoy className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد تذاكر {filterStatus !== "all" ? "بهذه الحالة" : "بعد"}</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => navigate("/dashboard/support/new")}>
                <Plus size={14} /> إنشاء أول تذكرة
              </Button>
            </CardContent>
          </Card>
        ) : (
          filtered.map((ticket, i) => {
            const st = STATUSES[ticket.status] || STATUSES.open;
            const cat = CATEGORIES.find(c => c.value === ticket.category);
            const CatIcon = cat?.icon || Settings;
            return (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className="cursor-pointer hover:border-accent/30 hover:shadow-sm transition-all"
                  onClick={() => openTicket(ticket)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <CatIcon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    <ChevronLeft size={16} className="text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SupportTicketsPage;
