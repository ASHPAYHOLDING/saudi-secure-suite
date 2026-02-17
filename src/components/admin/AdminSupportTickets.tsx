import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Headphones, Search, Clock, CheckCircle2, AlertCircle, MessageCircle,
  Send, Loader2, ArrowRight, User, Eye, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const STATUSES: Record<string, { label: string; color: string }> = {
  open: { label: "مفتوحة", color: "bg-info/10 text-info border-info/20" },
  in_progress: { label: "قيد المعالجة", color: "bg-warning/10 text-warning border-warning/20" },
  waiting_customer: { label: "بانتظار العميل", color: "bg-accent/10 text-accent border-accent/20" },
  resolved: { label: "تم الحل", color: "bg-success/10 text-success border-success/20" },
  closed: { label: "مغلقة", color: "bg-muted text-muted-foreground border-muted" },
};

const CATEGORIES: Record<string, string> = {
  technical: "مشكلة تقنية",
  suggestion: "اقتراح",
  inquiry: "استفسار",
  payment_gateway: "بوابة الدفع",
  invoices: "الفواتير",
  subscriptions: "الاشتراكات",
  transfers: "التحويلات",
  account: "الحساب",
  other: "أخرى",
};

interface Ticket {
  id: string;
  ticket_number: string;
  tenant_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  content: string;
  sender_type: string;
  sender_name: string;
  is_internal_note: boolean;
  created_at: string;
}

const AdminSupportTickets = () => {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    fetchTickets();
    const channel = supabase
      .channel("admin-tickets-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchTickets())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_replies" }, (payload) => {
        if (selectedTicket && (payload.new as any).ticket_id === selectedTicket.id) {
          fetchReplies(selectedTicket.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("scope", "platform")
      .order("updated_at", { ascending: false });
    setTickets((data as any[]) || []);
    setLoading(false);
  };

  const fetchReplies = async (ticketId: string) => {
    const { data } = await supabase
      .from("ticket_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setReplies((data as any[]) || []);
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    await fetchReplies(ticket.id);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setSending(true);
    try {
      await supabase.from("ticket_replies").insert({
        ticket_id: selectedTicket.id,
        user_id: user!.id,
        sender_type: "admin",
        sender_name: profile?.full_name || "فريق الدعم",
        sender_email: profile?.email || "",
        content: replyText.trim(),
      });

      // Update status
      const updateData: any = {};
      if (newStatus !== selectedTicket.status) updateData.status = newStatus;
      else if (selectedTicket.status === "open") updateData.status = "in_progress";

      if (newStatus === "resolved") updateData.resolved_at = new Date().toISOString();
      if (newStatus === "closed") updateData.closed_at = new Date().toISOString();

      if (Object.keys(updateData).length > 0) {
        await supabase.from("support_tickets").update(updateData).eq("id", selectedTicket.id);
      }

      // Send email to customer
      try {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            ticketId: selectedTicket.id,
            ticketNumber: selectedTicket.ticket_number,
            subject: selectedTicket.subject,
            recipientEmail: selectedTicket.customer_email,
            recipientName: selectedTicket.customer_name,
            senderName: profile?.full_name || "فريق الدعم",
            content: replyText.trim(),
            type: "admin_reply",
            newStatus: newStatus !== selectedTicket.status ? newStatus : undefined,
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

  const updateStatus = async (ticketId: string, status: string) => {
    const updateData: any = { status };
    if (status === "resolved") updateData.resolved_at = new Date().toISOString();
    if (status === "closed") updateData.closed_at = new Date().toISOString();
    await supabase.from("support_tickets").update(updateData).eq("id", ticketId);
    fetchTickets();
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status });
      setNewStatus(status);
    }
    toast.success("تم تحديث الحالة");
  };

  const filtered = tickets.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (searchQuery && !t.subject.includes(searchQuery) && !t.ticket_number.includes(searchQuery) && !(t.customer_name || "").includes(searchQuery)) return false;
    return true;
  });

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    waiting_customer: tickets.filter(t => t.status === "waiting_customer").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Ticket detail
  if (selectedTicket) {
    const st = STATUSES[selectedTicket.status] || STATUSES.open;
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedTicket(null)}>
          <ArrowRight size={16} /> العودة
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">{selectedTicket.ticket_number}</Badge>
                  <Badge variant="outline" className={st.color}>{st.label}</Badge>
                  <Badge variant="outline" className="text-xs">{CATEGORIES[selectedTicket.category]}</Badge>
                  <Badge variant="outline" className={`text-xs ${selectedTicket.priority === "urgent" ? "text-destructive border-destructive" : selectedTicket.priority === "high" ? "text-destructive/80" : ""}`}>
                    {selectedTicket.priority === "urgent" ? "عاجل" : selectedTicket.priority === "high" ? "عالية" : selectedTicket.priority === "medium" ? "متوسطة" : "منخفضة"}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <User size={12} /> {selectedTicket.customer_name || "—"} • {selectedTicket.customer_email || "—"}
                </p>
              </div>
              <Select value={newStatus} onValueChange={(v) => { setNewStatus(v); updateStatus(selectedTicket.id, v); }}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Thread */}
        <div className="space-y-3">
          {replies.filter(r => !r.is_internal_note).map((reply) => (
            <motion.div key={reply.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`rounded-xl p-4 border ${
                reply.sender_type === "admin" ? "bg-accent/5 border-accent/20 ms-8" : "bg-card border-border me-8"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    reply.sender_type === "admin" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                  }`}>
                    {reply.sender_type === "admin" ? "د" : "ع"}
                  </div>
                  <span className="text-xs font-medium">{reply.sender_name || (reply.sender_type === "admin" ? "فريق الدعم" : "العميل")}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: ar })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Admin reply */}
        {selectedTicket.status !== "closed" && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder="اكتب ردك للعميل..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="تغيير الحالة" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Headphones className="w-5 h-5 text-accent" />
            تذاكر الدعم الفني
          </h2>
          <p className="text-sm text-muted-foreground mt-1">إدارة والرد على تذاكر الدعم من الشركات والمؤسسات</p>
        </div>
        <div className="flex gap-2">
          {Object.entries(statusCounts).map(([key, count]) => (
            <Button
              key={key}
              variant={filterStatus === key ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => setFilterStatus(key)}
            >
              {key === "all" ? "الكل" : (STATUSES[key]?.label || key)}
              <Badge variant="secondary" className="text-[10px] px-1.5">{count}</Badge>
            </Button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="ابحث برقم التذكرة، الموضوع، أو اسم العميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">لا توجد تذاكر</CardContent></Card>
        ) : (
          filtered.map((ticket, i) => {
            const st = STATUSES[ticket.status] || STATUSES.open;
            return (
              <motion.div key={ticket.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className="cursor-pointer hover:border-accent/30 hover:shadow-sm transition-all" onClick={() => openTicket(ticket)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      ticket.priority === "urgent" ? "bg-destructive/10" : "bg-accent/10"
                    }`}>
                      <Headphones className={`w-5 h-5 ${ticket.priority === "urgent" ? "text-destructive" : "text-accent"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CATEGORIES[ticket.category]}</Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ticket.customer_name || "—"} • {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    <Eye size={16} className="text-muted-foreground shrink-0" />
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

export default AdminSupportTickets;
