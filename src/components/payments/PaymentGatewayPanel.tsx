import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/invoice-utils";
import { useHasFeature } from "@/hooks/useSubscriptionFeature";
import {
  CreditCard, Copy, ExternalLink, Loader2, Wallet,
  CheckCircle2, AlertCircle, Shield, Lock, ArrowLeft, Sparkles
} from "lucide-react";

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

// Provider logos as SVG components
const TapLogo = () => (
  <svg viewBox="0 0 80 26" className="h-5 w-auto" fill="none">
    <rect width="80" height="26" rx="5" fill="#1A1A2E"/>
    <text x="8" y="18" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="13" fill="#00D4FF">tap</text>
    <text x="34" y="18" fontFamily="'Inter',sans-serif" fontWeight="300" fontSize="8" fill="#9CA3AF">payments</text>
  </svg>
);

const MoyasarLogo = () => (
  <svg viewBox="0 0 90 26" className="h-5 w-auto" fill="none">
    <rect width="90" height="26" rx="5" fill="#065F46"/>
    <circle cx="14" cy="13" r="7" fill="#10B981"/>
    <circle cx="14" cy="13" r="4" fill="#065F46"/>
    <circle cx="14" cy="13" r="2" fill="#10B981"/>
    <text x="25" y="18" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="10" fill="white">moyasar</text>
  </svg>
);

const HyperPayLogo = () => (
  <svg viewBox="0 0 96 26" className="h-5 w-auto" fill="none">
    <rect width="96" height="26" rx="5" fill="#1E1B4B"/>
    <polygon points="8,5 18,5 23,13 18,21 8,21 3,13" fill="#7C3AED"/>
    <text x="28" y="18" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="10" fill="white">HyperPay</text>
  </svg>
);

const StripeLogo = () => (
  <svg viewBox="0 0 70 26" className="h-5 w-auto" fill="none">
    <rect width="70" height="26" rx="5" fill="#635BFF"/>
    <text x="10" y="18" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="13" fill="white">stripe</text>
  </svg>
);

const GeidealLogo = () => (
  <svg viewBox="0 0 80 26" className="h-5 w-auto" fill="none">
    <rect width="80" height="26" rx="5" fill="#FF6B00"/>
    <text x="8" y="18" fontFamily="'Inter',sans-serif" fontWeight="700" fontSize="12" fill="white">Geidea</text>
    <circle cx="68" cy="8" r="4" fill="white" opacity="0.3"/>
    <circle cx="68" cy="8" r="2" fill="white"/>
  </svg>
);

const NumaxioLogo = () => (
  <div className="flex items-center gap-1.5">
    <div className="flex h-5 w-5 items-center justify-center rounded bg-accent">
      <Sparkles size={11} className="text-white" />
    </div>
    <span className="text-sm font-bold text-foreground">نيوماكسيو باي</span>
  </div>
);

const PROVIDER_LOGOS: Record<string, React.FC> = {
  tap: TapLogo,
  moyasar: MoyasarLogo,
  hyperpay: HyperPayLogo,
  stripe: StripeLogo,
  geidea: GeidealLogo,
};

const PROVIDER_META: Record<string, {
  methods: string;
  color: string;
  bgCard: string;
  borderCard: string;
}> = {
  stripe: {
    methods: "فيزا • ماستركارد • Apple Pay • Google Pay",
    color: "text-[#635BFF]",
    bgCard: "bg-[#635BFF]/5 hover:bg-[#635BFF]/10",
    borderCard: "border-[#635BFF]/20 hover:border-[#635BFF]/40",
  },
  geidea: {
    methods: "مدى • فيزا • ماستركارد • Apple Pay • STC Pay",
    color: "text-orange-500",
    bgCard: "bg-orange-500/5 hover:bg-orange-500/10",
    borderCard: "border-orange-500/20 hover:border-orange-500/40",
  },
  tap: {
    methods: "مدى • فيزا • ماستركارد • Apple Pay • KNET",
    color: "text-cyan-500",
    bgCard: "bg-cyan-500/5 hover:bg-cyan-500/10",
    borderCard: "border-cyan-500/20 hover:border-cyan-500/40",
  },
  moyasar: {
    methods: "مدى • فيزا • ماستركارد • Apple Pay • STC Pay",
    color: "text-emerald-500",
    bgCard: "bg-emerald-500/5 hover:bg-emerald-500/10",
    borderCard: "border-emerald-500/20 hover:border-emerald-500/40",
  },
  hyperpay: {
    methods: "مدى • فيزا • ماستركارد • SADAD",
    color: "text-violet-500",
    bgCard: "bg-violet-500/5 hover:bg-violet-500/10",
    borderCard: "border-violet-500/20 hover:border-violet-500/40",
  },
};

const PaymentGatewayPanel = ({
  open, onOpenChange, invoiceId, invoiceNumber,
  amount, currency, customerName, customerMobile, customerEmail,
}: PaymentGatewayPanelProps) => {
  const { user, tenantId } = useAuth();
  const { allowed: hasPayFeature } = useHasFeature("numaxio_pay");

  const [creating, setCreating] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>("");
  const [paidGateways, setPaidGateways] = useState<ActiveGateway[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(true);

  useEffect(() => {
    if (!tenantId || !open) return;
    const fetchGateways = async () => {
      setLoadingGateways(true);
      const { data } = await (supabase as any)
        .from("tenant_paid_integrations")
        .select("integration_id, status, paid_integrations!inner(key, name_ar, name_en, icon_name, integration_type)")
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      const gateways: ActiveGateway[] = [];
      (data || []).forEach((row: any) => {
        const pi = row.paid_integrations;
        if (pi && pi.integration_type === "payment_gateway") {
          gateways.push({
            integrationId: row.integration_id,
            key: pi.key?.replace("pay_", ""),
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

  const handleCreatePaylinkInvoice = async () => {
    if (!user || !tenantId) return;
    setCreating(true);
    setActiveSource("numaxio_pay");
    setActiveSourceLabel("نيوماكسيو باي");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("يرجى تسجيل الدخول أولاً"); setCreating(false); return; }

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
            amount, clientName: customerName || "عميل",
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
      if (!res.ok || data.error) { toast.error(data.error || "فشل إنشاء رابط الدفع"); setCreating(false); return; }
      setPaymentUrl(data.paymentUrl);
      toast.success("✅ تم إنشاء رابط الدفع بنجاح!");
    } catch (err: any) {
      toast.error("خطأ في الاتصال: " + (err.message || ""));
    }
    setCreating(false);
  };

  const handleCreateBYOSession = async (gateway: ActiveGateway) => {
    if (!user || !tenantId) return;
    setCreating(true);
    setActiveSource(gateway.key);
    setActiveSourceLabel(gateway.name_ar);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error("يرجى تسجيل الدخول أولاً"); setCreating(false); return; }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-create-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "origin": window.location.origin,
          },
          body: JSON.stringify({ provider: gateway.key, invoiceId }),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error || "فشل إنشاء جلسة الدفع");
        setCreating(false); return;
      }
      if (!data.paymentUrl) {
        toast.error("لم يتم الحصول على رابط الدفع من البوابة");
        setCreating(false); return;
      }

      setPaymentUrl(data.paymentUrl);
      if (["stripe", "geidea"].includes(gateway.key)) {
        window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
        toast.success(`✅ تم فتح صفحة الدفع عبر ${gateway.name_ar}`);
      } else {
        toast.success(`✅ تم إنشاء رابط الدفع عبر ${gateway.name_ar}`);
      }
    } catch (err: any) {
      toast.error("خطأ في الاتصال: " + (err.message || ""));
    }
    setCreating(false);
  };

  const copyLink = () => {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl);
      toast.success("تم نسخ الرابط");
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setPaymentUrl(null);
      setActiveSource(null);
      setActiveSourceLabel("");
    }
    onOpenChange(isOpen);
  };

  const hasAnyGateway = hasPayFeature || paidGateways.length > 0;
  const isCheckout = activeSource === "stripe" || activeSource === "geidea";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[hsl(220,30%,10%)] to-[hsl(172,50%,18%)] px-5 pt-5 pb-4">
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "linear-gradient(hsl(0,0%,100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,100%) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20">
                  <Wallet size={15} className="text-accent" />
                </div>
                تسديد الفاتورة
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-xs text-white/50">الفاتورة</p>
                <p className="text-sm font-mono text-white/80">{invoiceNumber}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-white/50">المبلغ المستحق</p>
                <p className="text-2xl font-bold text-white" dir="ltr">
                  {formatCurrency(amount)} <span className="text-base font-medium text-white/70">{currency}</span>
                </p>
              </div>
            </div>
            {/* Security badge */}
            <div className="mt-3 flex items-center gap-1.5">
              <Lock size={9} className="text-accent/70" />
              <span className="text-[10px] text-white/40">دفع آمن ومشفر • PCI-DSS</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {loadingGateways ? (
              <motion.div key="loading" className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </motion.div>
            ) : !hasAnyGateway ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8 space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <Wallet className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">لا توجد بوابات دفع مفعّلة</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  فعّل بوابة دفع من صفحة التكاملات أو قم بالترقية لاستخدام نيوماكسيو باي
                </p>
              </motion.div>
            ) : !paymentUrl ? (
              <motion.div key="gateways" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground mb-3">اختر طريقة الدفع</p>

                {/* Numaxio Pay */}
                {hasPayFeature && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={handleCreatePaylinkInvoice}
                    disabled={creating}
                    className="group flex items-center gap-3 w-full rounded-xl border border-accent/20 bg-accent/5 p-3.5 text-right hover:border-accent/50 hover:bg-accent/10 transition-all duration-200 disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 shrink-0">
                      <Sparkles size={18} className="text-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">نيوماكسيو باي</span>
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-accent/15 text-accent border-accent/20">مدمج</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">مدى • فيزا • ماستركارد • Apple Pay • STC Pay</p>
                    </div>
                    {creating && activeSource === "numaxio_pay"
                      ? <Loader2 size={15} className="animate-spin text-accent shrink-0" />
                      : <ArrowLeft size={15} className="text-muted-foreground group-hover:text-accent transition-colors shrink-0 rotate-180" />
                    }
                  </motion.button>
                )}

                {/* BYO Gateways */}
                {paidGateways.map((gw, i) => {
                  const meta = PROVIDER_META[gw.key];
                  const LogoComp = PROVIDER_LOGOS[gw.key];
                  return (
                    <motion.button
                      key={gw.key}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (i + 1) * 0.07 }}
                      onClick={() => handleCreateBYOSession(gw)}
                      disabled={creating}
                      className={`group flex items-center gap-3 w-full rounded-xl border p-3.5 text-right transition-all duration-200 disabled:opacity-50 ${meta?.bgCard || "bg-muted/30 hover:bg-muted/50"} ${meta?.borderCard || "border-border hover:border-border"}`}
                    >
                      <div className="shrink-0">
                        {LogoComp ? <LogoComp /> : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                            <CreditCard size={18} className="text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground">{gw.name_ar}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 size={8} /> نشط
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {meta?.methods || gw.name_en}
                        </p>
                      </div>
                      {creating && activeSource === gw.key
                        ? <Loader2 size={15} className="animate-spin text-muted-foreground shrink-0" />
                        : <ArrowLeft size={15} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 rotate-180" />
                      }
                    </motion.button>
                  );
                })}

                {/* Trust indicators */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Shield size={9} className="text-accent" /> مشفر بالكامل
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Lock size={9} className="text-accent" /> PCI-DSS
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CheckCircle2 size={9} className="text-emerald-500" /> مرخص ساما
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {/* Success state */}
                <div className="text-center py-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">جلسة الدفع جاهزة</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isCheckout
                      ? `انقر ادفع الآن للانتقال إلى صفحة ${activeSourceLabel} الآمنة`
                      : "انسخ الرابط وشاركه مع العميل لإتمام الدفع"
                    }
                  </p>
                </div>

                {/* Active gateway badge */}
                <div className="flex items-center justify-center gap-2">
                  <Badge className="text-xs gap-1.5 bg-muted text-foreground border border-border">
                    {(() => { const L = PROVIDER_LOGOS[activeSource || ""]; return L ? <L /> : null; })()}
                  </Badge>
                </div>

                {/* URL display */}
                {!isCheckout && (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <input
                      readOnly value={paymentUrl}
                      className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none"
                      dir="ltr"
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={copyLink}>
                      <Copy size={13} />
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2 h-10" onClick={copyLink}>
                    <Copy size={13} />نسخ الرابط
                  </Button>
                  <Button
                    className="flex-1 gap-2 h-10 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => window.open(paymentUrl!, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink size={13} />
                    {isCheckout ? "ادفع الآن" : "فتح الرابط"}
                  </Button>
                </div>

                {/* Webhook notice */}
                {isCheckout && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 flex gap-2">
                    <AlertCircle size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      بعد إتمام الدفع سيتم تحديث الفاتورة تلقائياً عبر Webhook آمن من {activeSourceLabel}.
                    </p>
                  </div>
                )}

                <Button
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => { setPaymentUrl(null); setActiveSource(null); setActiveSourceLabel(""); }}
                >
                  اختيار بوابة أخرى
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentGatewayPanel;
