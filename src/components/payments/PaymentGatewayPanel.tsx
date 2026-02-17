import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Smartphone, Apple, Link2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/invoice-utils";

interface PaymentGatewayPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
}

const GATEWAYS = [
  { id: "stc_pay", name: "STC Pay", icon: Smartphone, color: "bg-purple-100 text-purple-700", desc: "إرسال رابط دفع عبر STC Pay" },
  { id: "apple_pay", name: "Apple Pay", icon: Apple, color: "bg-gray-100 text-gray-800", desc: "الدفع عبر Apple Pay" },
  { id: "credit_card", name: "بطاقة ائتمان", icon: CreditCard, color: "bg-blue-100 text-blue-700", desc: "Visa / Mastercard / مدى" },
  { id: "payment_link", name: "رابط دفع مباشر", icon: Link2, color: "bg-green-100 text-green-700", desc: "إنشاء رابط دفع يمكن مشاركته" },
];

const PaymentGatewayPanel = ({ open, onOpenChange, invoiceId, invoiceNumber, amount, currency }: PaymentGatewayPanelProps) => {
  const { user, tenantId } = useAuth();
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const handleCreateLink = async (gateway: string) => {
    if (!user || !tenantId) return;
    setSelectedGateway(gateway);
    setCreating(true);

    // Create payment link record
    const { data, error } = await supabase.from("payment_links").insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      amount,
      currency,
      gateway,
      status: "pending",
      payment_url: `https://pay.numaxio.com/${invoiceId}?gateway=${gateway}`,
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).select("id, payment_url").single();

    if (error) {
      toast.error("فشل إنشاء رابط الدفع");
    } else if (data) {
      setPaymentLink(data.payment_url);
      toast.success("تم إنشاء رابط الدفع");
    }
    setCreating(false);
  };

  const copyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      toast.success("تم نسخ الرابط");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>بوابات الدفع — {invoiceNumber}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center mb-4">
          <p className="text-xs text-muted-foreground">المبلغ المستحق</p>
          <p className="text-xl font-bold font-english text-foreground" dir="ltr">{formatCurrency(amount)} {currency}</p>
        </div>

        {!paymentLink ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {GATEWAYS.map((gw, i) => {
              const Icon = gw.icon;
              return (
                <motion.button
                  key={gw.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => handleCreateLink(gw.id)}
                  disabled={creating}
                  className="flex items-start gap-3 rounded-xl border border-border p-4 text-right hover:border-accent hover:bg-accent/5 transition-all disabled:opacity-50"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${gw.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{gw.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{gw.desc}</p>
                  </div>
                  {creating && selectedGateway === gw.id && <Loader2 size={16} className="animate-spin text-accent mt-1" />}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{GATEWAYS.find(g => g.id === selectedGateway)?.name}</Badge>
              <Badge className="bg-green-100 text-green-700 text-xs">جاهز</Badge>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <input readOnly value={paymentLink} className="flex-1 bg-transparent text-xs font-english text-foreground outline-none" dir="ltr" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={copyLink}><Copy size={14} /></Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={copyLink}><Copy size={14} />نسخ الرابط</Button>
              <Button className="flex-1 gap-2 bg-accent text-accent-foreground" onClick={() => window.open(paymentLink!, "_blank")}>
                <ExternalLink size={14} />فتح الرابط
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-xs" onClick={() => { setPaymentLink(null); setSelectedGateway(null); }}>
              إنشاء رابط آخر
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentGatewayPanel;
