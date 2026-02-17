import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Smartphone, Apple, Link2, Copy, ExternalLink, Loader2, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/invoice-utils";
import { useHasFeature } from "@/hooks/useSubscriptionFeature";

interface PaymentGatewayPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
}

const PaymentGatewayPanel = ({ open, onOpenChange, invoiceId, invoiceNumber, amount, currency, customerName, customerMobile, customerEmail }: PaymentGatewayPanelProps) => {
  const { user, tenantId } = useAuth();
  const { allowed: hasPayFeature } = useHasFeature("numaxio_pay");
  const [creating, setCreating] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  const handleCreatePaylinkInvoice = async () => {
    if (!user || !tenantId) return;
    setCreating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("يرجى تسجيل الدخول أولاً");
        setCreating(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paylink-gateway?action=create-invoice`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            amount,
            clientName: customerName || "عميل",
            clientMobile: customerMobile || "0500000000",
            clientEmail: customerEmail || undefined,
            orderNumber: invoiceNumber,
            note: `دفع فاتورة ${invoiceNumber}`,
            callBackUrl: window.location.origin + "/dashboard/billing",
            products: [{ title: `فاتورة ${invoiceNumber}`, price: amount, qty: 1 }],
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "فشل إنشاء رابط الدفع");
        setCreating(false);
        return;
      }

      setPaymentLink(data.paymentUrl);
      toast.success("✅ تم إنشاء رابط الدفع بنجاح!");
    } catch (err: any) {
      toast.error("خطأ في الاتصال: " + (err.message || ""));
    }
    setCreating(false);
  };

  const copyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      toast.success("تم نسخ الرابط");
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setPaymentLink(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-accent" />
            بوابة الدفع — {invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center mb-4">
          <p className="text-xs text-muted-foreground">المبلغ المستحق</p>
          <p className="text-xl font-bold font-english text-foreground" dir="ltr">{formatCurrency(amount)} {currency}</p>
        </div>

        {!hasPayFeature ? (
          <div className="text-center py-8 space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-warning" />
            </div>
            <p className="text-sm font-semibold text-foreground">بوابة الدفع غير متاحة في باقتك الحالية</p>
            <p className="text-xs text-muted-foreground">قم بالترقية للباقة الاحترافية أو المؤسسية لتفعيل نيوماكسيو باي</p>
          </div>
        ) : !paymentLink ? (
          <div className="space-y-4">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleCreatePaylinkInvoice}
              disabled={creating}
              className="flex items-center gap-3 w-full rounded-xl border border-border p-4 text-right hover:border-accent hover:bg-accent/5 transition-all disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg shrink-0 bg-accent/10 text-accent">
                <CreditCard size={24} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">إنشاء رابط دفع عبر نيوماكسيو باي</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">يدعم مدى، Visa، Mastercard، Apple Pay، STC Pay</p>
              </div>
              {creating && <Loader2 size={16} className="animate-spin text-accent" />}
            </motion.button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent/10 text-accent text-xs">نيوماكسيو باي</Badge>
              <Badge className="bg-success/10 text-success text-xs">جاهز</Badge>
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
            <Button variant="ghost" className="w-full text-xs" onClick={() => setPaymentLink(null)}>
              إنشاء رابط آخر
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentGatewayPanel;
