import { useState, useEffect, useCallback } from "react";
import {
  Mail, MessageCircle, Send, Loader2, CheckCircle2, XCircle,
  Clock, History, Edit3, Plus, ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

interface InvoiceDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    grand_total: number;
    due_date: string;
    currency?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
  };
}

interface DeliveryLog {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  sent_at: string;
  message_body: string | null;
}

const InvoiceDeliveryDialog = ({ open, onOpenChange, invoice }: InvoiceDeliveryDialogProps) => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();

  const [tab, setTab] = useState("email");
  const [sending, setSending] = useState(false);
  const [emailTo, setEmailTo] = useState(invoice.customer_email || "");
  const [emailSubject, setEmailSubject] = useState(`فاتورة ضريبية - ${invoice.invoice_number}`);
  const [emailBody, setEmailBody] = useState(
    `عزيزي العميل،\n\nمرفق فاتورة رقم ${invoice.invoice_number} بمبلغ ${invoice.grand_total} ر.س.\n\nتاريخ الاستحقاق: ${invoice.due_date}\n\nشكراً لتعاملكم معنا.`
  );
  const [waPhone, setWaPhone] = useState(invoice.customer_phone || "");
  const [waMessage, setWaMessage] = useState(
    `مرحباً،\n\nفاتورة رقم: ${invoice.invoice_number}\nالمبلغ: ${invoice.grand_total} ر.س\nتاريخ الاستحقاق: ${invoice.due_date}\n\nشكراً لتعاملكم معنا.`
  );
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Reset fields when invoice changes
  useEffect(() => {
    setEmailTo(invoice.customer_email || "");
    setEmailSubject(`فاتورة ضريبية - ${invoice.invoice_number}`);
    setEmailBody(
      `عزيزي العميل،\n\nمرفق فاتورة رقم ${invoice.invoice_number} بمبلغ ${invoice.grand_total} ر.س.\n\nتاريخ الاستحقاق: ${invoice.due_date}\n\nشكراً لتعاملكم معنا.`
    );
    setWaPhone(invoice.customer_phone || "");
    setWaMessage(
      `مرحباً،\n\nفاتورة رقم: ${invoice.invoice_number}\nالمبلغ: ${invoice.grand_total} ر.س\nتاريخ الاستحقاق: ${invoice.due_date}\n\nشكراً لتعاملكم معنا.`
    );
  }, [invoice]);

  const loadLogs = useCallback(async () => {
    if (!tenantId) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from("invoice_delivery_log")
      .select("id, channel, recipient, status, sent_at, message_body")
      .eq("invoice_id", invoice.id)
      .eq("tenant_id", tenantId)
      .order("sent_at", { ascending: false })
      .limit(20);
    setLogs((data as DeliveryLog[]) || []);
    setLogsLoading(false);
  }, [invoice.id, tenantId]);

  useEffect(() => {
    if (open) loadLogs();
  }, [open, loadLogs]);

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast.error(isRTL ? "الرجاء إدخال البريد الإلكتروني" : "Please enter email");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice", {
        body: {
          invoiceId: invoice.id,
          channel: "email",
          recipient: emailTo.trim(),
          subject: emailSubject,
          body: emailBody,
          tenantId,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(isRTL ? "تم إرسال الفاتورة بنجاح" : "Invoice sent successfully");
        loadLogs();
      } else {
        toast.error(isRTL ? "فشل إرسال الفاتورة" : "Failed to send invoice");
      }
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
    setSending(false);
  };

  const handleSendWhatsApp = async () => {
    if (!waPhone.trim()) {
      toast.error(isRTL ? "الرجاء إدخال رقم الهاتف" : "Please enter phone number");
      return;
    }
    // Clean phone number
    let phone = waPhone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (phone.startsWith("05")) phone = "966" + phone.substring(1);
    if (phone.startsWith("+")) phone = phone.substring(1);

    const encoded = encodeURIComponent(waMessage);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");

    // Log the WhatsApp send
    if (tenantId && user) {
      await supabase.from("invoice_delivery_log").insert({
        tenant_id: tenantId,
        invoice_id: invoice.id,
        channel: "whatsapp",
        recipient: waPhone,
        status: "sent",
        message_body: waMessage,
        sent_by: user.id,
      });
      loadLogs();
    }

    toast.success(isRTL ? "تم فتح واتساب" : "WhatsApp opened");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      sent: { variant: "default", icon: CheckCircle2 },
      delivered: { variant: "secondary", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: XCircle },
      opened: { variant: "outline", icon: Clock },
    };
    const s = map[status] || map.sent;
    const Icon = s.icon;
    return (
      <Badge variant={s.variant} className="gap-1 text-[10px]">
        <Icon className="h-3 w-3" />
        {status === "sent" ? (isRTL ? "مُرسل" : "Sent") :
         status === "delivered" ? (isRTL ? "تم التسليم" : "Delivered") :
         status === "failed" ? (isRTL ? "فشل" : "Failed") :
         status === "opened" ? (isRTL ? "تم الفتح" : "Opened") : status}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            {isRTL ? "إرسال الفاتورة" : "Send Invoice"} — {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1 gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {isRTL ? "بريد إلكتروني" : "Email"}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1 gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              {isRTL ? "واتساب" : "WhatsApp"}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-1.5">
              <History className="h-3.5 w-3.5" />
              {isRTL ? "السجل" : "History"}
            </TabsTrigger>
          </TabsList>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-3 mt-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "إلى" : "To"}</label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "الموضوع" : "Subject"}</label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "نص الرسالة" : "Message"}</label>
              <Textarea rows={5} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
            </div>
            <Button onClick={handleSendEmail} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {isRTL ? "إرسال بالبريد" : "Send Email"}
            </Button>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-3 mt-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "رقم الهاتف" : "Phone Number"}</label>
              <Input
                type="tel"
                placeholder="+966 5xxxxxxxx"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{isRTL ? "نص الرسالة" : "Message"}</label>
              <Textarea rows={5} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />
            </div>
            <Button onClick={handleSendWhatsApp} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
              <MessageCircle className="h-4 w-4" />
              {isRTL ? "إرسال عبر واتساب" : "Send via WhatsApp"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              {isRTL ? "سيتم فتح واتساب مع الرسالة المعبأة مسبقاً" : "WhatsApp will open with the pre-filled message"}
            </p>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-3">
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {isRTL ? "لم يتم إرسال هذه الفاتورة بعد" : "No deliveries yet"}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                    <div className="mt-0.5">
                      {log.channel === "email" ? (
                        <Mail className="h-4 w-4 text-primary" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium truncate">{log.recipient}</span>
                        {statusBadge(log.status)}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 font-english" dir="ltr">
                        {new Date(log.sent_at).toLocaleString("ar-SA")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDeliveryDialog;
