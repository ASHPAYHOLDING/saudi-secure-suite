import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Copy, ExternalLink, Loader2, Wallet, Power, CheckCircle2, Monitor } from "lucide-react";
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

interface ActiveGateway {
  integrationId: string;
  key: string;
  name_ar: string;
  name_en: string;
  icon: string;
}

const PaymentGatewayPanel = ({ open, onOpenChange, invoiceId, invoiceNumber, amount, currency, customerName, customerMobile, customerEmail }: PaymentGatewayPanelProps) => {
  const { user, tenantId } = useAuth();
  const { allowed: hasPayFeature } = useHasFeature("numaxio_pay");
  const [creating, setCreating] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [paidGateways, setPaidGateways] = useState<ActiveGateway[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(true);

  // Fetch activated paid payment gateways for this tenant
  useEffect(() => {
    if (!tenantId || !open) return;
    const fetchGateways = async () => {
      setLoadingGateways(true);
      const { data } = await supabase
        .from("tenant_paid_integrations")
        .select("integration_id, status, paid_integrations!inner(key, name_ar, name_en, icon_name, integration_type)")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      const gateways: ActiveGateway[] = [];
      (data || []).forEach((row: any) => {
        const pi = row.paid_integrations;
        if (pi && pi.category === "payment_gateway") {
          gateways.push({
            integrationId: row.integration_id,
            key: pi.key,
            name_ar: pi.name_ar,
            name_en: pi.name_en,
            icon: pi.icon_name,
          });
        }
      });
      setPaidGateways(gateways);
      setLoadingGateways(false);
    };
    fetchGateways();
  }, [tenantId, open]);

  // ---- Numaxio Pay (existing) ----
  const handleCreatePaylinkInvoice = async () => {
    if (!user || !tenantId) return;
    setCreating(true);
    setActiveSource("numaxio_pay");

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

  // ---- Paid Gateway (Tap, HyperPay, Moyasar) ----
  const handleCreatePaidGatewaySession = async (gateway: ActiveGateway) => {
    if (!user || !tenantId) return;
    setCreating(true);
    setActiveSource(gateway.key);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("يرجى تسجيل الدخول أولاً");
        setCreating(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paid-gateway?action=create-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            invoiceId,
            gatewayKey: gateway.key,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "فشل إنشاء جلسة الدفع");
        setCreating(false);
        return;
      }

      setPaymentLink(data.paymentUrl);
      toast.success(`✅ تم إنشاء رابط الدفع عبر ${gateway.name_ar}`);
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
      setActiveSource(null);
    }
    onOpenChange(open);
  };

  const hasAnyGateway = hasPayFeature || paidGateways.length > 0;

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

        {loadingGateways ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAnyGateway ? (
          <div className="text-center py-8 space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-warning" />
            </div>
            <p className="text-sm font-semibold text-foreground">لا توجد بوابات دفع مفعّلة</p>
            <p className="text-xs text-muted-foreground">
              فعّل بوابة دفع من صفحة التكاملات المدفوعة أو قم بالترقية لتفعيل نيوماكسيو باي
            </p>
          </div>
        ) : !paymentLink ? (
          <div className="space-y-3">
            {/* Numaxio Pay (built-in, if available) */}
            {hasPayFeature && (
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">نيوماكسيو باي</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5">مدمج</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">مدى، Visa، Mastercard، Apple Pay، STC Pay</p>
                </div>
                {creating && activeSource === "numaxio_pay" && <Loader2 size={16} className="animate-spin text-accent" />}
              </motion.button>
            )}

            {/* Paid Payment Gateways */}
            {paidGateways.map((gw, i) => (
              <motion.button
                key={gw.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (i + 1) * 0.05 }}
                onClick={() => handleCreatePaidGatewaySession(gw)}
                disabled={creating}
                className="flex items-center gap-3 w-full rounded-xl border border-border p-4 text-right hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg shrink-0 bg-primary/10 text-primary">
                  <CreditCard size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{gw.name_ar}</p>
                    <Badge className="text-[10px] px-1.5 bg-success/10 text-success border-success/20">
                      <CheckCircle2 size={10} className="mr-0.5" /> مفعّل
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{gw.name_en}</p>
                </div>
                {creating && activeSource === gw.key && <Loader2 size={16} className="animate-spin text-primary" />}
              </motion.button>
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent/10 text-accent text-xs">
                {activeSource === "numaxio_pay" ? "نيوماكسيو باي" : paidGateways.find(g => g.key === activeSource)?.name_ar || "بوابة دفع"}
              </Badge>
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
            <Button variant="ghost" className="w-full text-xs" onClick={() => { setPaymentLink(null); setActiveSource(null); }}>
              إنشاء رابط آخر
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentGatewayPanel;
