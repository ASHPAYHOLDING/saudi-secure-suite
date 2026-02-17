import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, Clock, CheckCircle2,
  XCircle, ArrowUpRight, ArrowDownRight, Receipt, Snowflake,
  Plus, CreditCard, Landmark, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ── Animated Counter Hook ── */
function useAnimatedCounter(target: number, duration = 1.2) {
  const [display, setDisplay] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const from = prevTarget.current;
    prevTarget.current = target;
    const startTime = performance.now();
    const diff = target - from;

    if (diff === 0) return;

    const step = (now: number) => {
      const elapsed = Math.min((now - startTime) / (duration * 1000), 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(from + diff * eased));
      if (elapsed < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return display;
}

interface WalletData {
  id: string;
  balance_available: number;
  balance_pending: number;
  currency: string;
  status: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  reason: string;
  reference_type: string;
  reference_id: string;
  source: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "نشطة", color: "text-emerald-400", icon: CheckCircle2 },
  frozen: { label: "مجمّدة", color: "text-red-400", icon: Snowflake },
  suspended: { label: "موقوفة", color: "text-amber-400", icon: XCircle },
};

const REASON_LABELS: Record<string, string> = {
  integration: "شراء تكامل",
  refund: "استرداد",
  topup: "شحن رصيد",
  manual: "عملية يدوية",
  payout: "سحب",
};

/* ── Animated Grid Background ── */
const AnimatedGrid = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid pattern */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wallet-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wallet-grid)" />
      </svg>
      {/* Slow animated glow orbs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsla(172,66%,44%,0.08) 0%, transparent 70%)",
          top: "-10%",
          right: "-5%",
        }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsla(220,60%,50%,0.06) 0%, transparent 70%)",
          bottom: "5%",
          left: "10%",
        }}
        animate={{ x: [0, -20, 0], y: [0, -15, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
};

/* ── Glass Card Component ── */
const GlassCard = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className={`
      relative rounded-2xl p-6 overflow-hidden
      bg-white/[0.06] backdrop-blur-xl
      border border-white/[0.08]
      transition-all duration-500 ease-out
      hover:border-white/[0.18] hover:bg-white/[0.09]
      hover:shadow-[0_8px_40px_-12px_rgba(0,200,180,0.15)]
      group
      ${className}
    `}
  >
    {/* Animated border glow on hover */}
    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
      style={{
        background: "linear-gradient(135deg, hsla(172,66%,44%,0.1) 0%, transparent 50%, hsla(220,60%,50%,0.05) 100%)",
      }}
    />
    <div className="relative z-10">{children}</div>
  </motion.div>
);

const TOPUP_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const WalletPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "gateway">("card");
  const [topupLoading, setTopupLoading] = useState(false);
  const animatedBalance = useAnimatedCounter(wallet?.balance_available ?? 0);
  const animatedPending = useAnimatedCounter(wallet?.balance_pending ?? 0);

  useEffect(() => {
    if (!tenantId) return;

    const fetchWallet = async () => {
      setLoading(true);
      const { data: w } = await supabase
        .from("tenant_wallets")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (w) {
        setWallet(w);
        const { data: txs } = await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("wallet_id", w.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setTransactions(txs || []);
      }
      setLoading(false);
    };

    fetchWallet();

    const channel = supabase
      .channel("wallet-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tenant_wallets",
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        if (payload.new) setWallet(payload.new as WalletData);
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "wallet_transactions",
      }, (payload) => {
        if (payload.new) {
          setTransactions((prev) => [payload.new as WalletTransaction, ...prev].slice(0, 50));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const finalAmount = topupAmount > 0 ? topupAmount : Number(customAmount) || 0;

  const handleTopup = async () => {
    if (finalAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صالح");
      return;
    }
    setTopupLoading(true);
    try {
      // Call edge function with action=topup
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=topup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ amount: finalAmount, paymentMethod }),
        }
      );
      const result = await res.json();

      if (!res.ok || result.error) {
        toast.error(result.error || "فشل شحن الرصيد");
        return;
      }

      toast.success(result.message || "تم شحن الرصيد بنجاح", {
        description: `رقم الإيصال: ${result.receipt_number}`,
        duration: 5000,
      });
      setShowTopup(false);
      setTopupAmount(0);
      setCustomAmount("");
    } catch (err: any) {
      toast.error("حدث خطأ — يرجى المحاولة مرة أخرى");
    } finally {
      setTopupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 space-y-6" style={{ background: "linear-gradient(160deg, hsl(220,30%,10%) 0%, hsl(220,35%,16%) 40%, hsl(195,40%,18%) 70%, hsl(172,40%,14%) 100%)" }}>
        <Skeleton className="h-8 w-48 bg-white/10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Skeleton className="h-36 rounded-2xl bg-white/5" />
          <Skeleton className="h-36 rounded-2xl bg-white/5" />
          <Skeleton className="h-36 rounded-2xl bg-white/5" />
        </div>
        <Skeleton className="h-64 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center"
        style={{ background: "linear-gradient(160deg, hsl(220,30%,10%) 0%, hsl(220,35%,16%) 40%, hsl(172,40%,14%) 100%)" }}
      >
        <Wallet className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-lg font-semibold text-white/80 mb-2">لا توجد محفظة</h2>
        <p className="text-sm text-white/40">يرجى التواصل مع الدعم لتفعيل المحفظة.</p>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[wallet.status] || STATUS_MAP.active;
  const StatusIcon = statusInfo.icon;

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: "linear-gradient(160deg, hsl(220,30%,10%) 0%, hsl(220,35%,16%) 35%, hsl(210,40%,18%) 55%, hsl(195,40%,16%) 75%, hsl(172,40%,14%) 100%)",
      }}
    >
      <AnimatedGrid />

      {/* Topup Modal */}
      <Dialog open={showTopup} onOpenChange={setShowTopup}>
        <DialogContent className="bg-[hsl(220,30%,12%)] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              إضافة رصيد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Payment Method */}
            <div className="space-y-3">
              <label className="text-sm text-white/60">طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`p-4 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    paymentMethod === "card"
                      ? "border-emerald-400/50 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <CreditCard className={`w-6 h-6 ${paymentMethod === "card" ? "text-emerald-400" : "text-white/40"}`} />
                  <span className={`text-sm ${paymentMethod === "card" ? "text-emerald-400" : "text-white/60"}`}>
                    بطاقة / Apple Pay
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod("gateway")}
                  className={`p-4 rounded-xl border transition-all duration-300 flex flex-col items-center gap-2 ${
                    paymentMethod === "gateway"
                      ? "border-emerald-400/50 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <Landmark className={`w-6 h-6 ${paymentMethod === "gateway" ? "text-emerald-400" : "text-white/40"}`} />
                  <span className={`text-sm ${paymentMethod === "gateway" ? "text-emerald-400" : "text-white/60"}`}>
                    بوابة الدفع المفعّلة
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Amounts */}
            <div className="space-y-3">
              <label className="text-sm text-white/60">اختر المبلغ</label>
              <div className="grid grid-cols-3 gap-2">
                {TOPUP_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setTopupAmount(amt); setCustomAmount(""); }}
                    className={`py-3 rounded-xl text-sm font-bold transition-all duration-300 border ${
                      topupAmount === amt
                        ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                    }`}
                  >
                    {amt.toLocaleString("ar-SA")} ر.س
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-2">
              <label className="text-sm text-white/60">أو أدخل مبلغ مخصص</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="50000"
                  placeholder="0"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(0); }}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20
                    focus:outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20 transition-all
                    text-lg font-bold text-center"
                  dir="ltr"
                />
                <span className="absolute top-1/2 -translate-y-1/2 start-4 text-sm text-white/30">ر.س</span>
              </div>
            </div>

            {/* Confirm */}
            <button
              onClick={handleTopup}
              disabled={topupLoading || finalAmount <= 0}
              className="w-full py-4 rounded-xl font-bold text-white text-base transition-all duration-300
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
              style={{
                background: finalAmount > 0
                  ? "linear-gradient(135deg, hsl(152,60%,42%) 0%, hsl(172,60%,40%) 100%)"
                  : "rgba(255,255,255,0.06)",
              }}
            >
              {topupLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  {finalAmount > 0
                    ? `تأكيد الشحن — ${finalAmount.toLocaleString("ar-SA")} ر.س`
                    : "اختر المبلغ"}
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
        {/* ── Hero Section ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard delay={0} className="!p-8 md:!p-10 relative overflow-hidden">
            {/* Shimmer overlay on balance */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 55%, transparent 60%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
                transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
              />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              {/* Left: Title + Balance */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400/20 to-cyan-500/10 border border-white/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl font-bold text-white">محفظتك الرقمية</h1>
                      <p className="text-sm text-white/40 mt-0.5">تحكّم كامل في أرصدة شركتك ومعاملاتها المالية بشكل لحظي وآمن.</p>
                    </div>
                  </div>
                </div>

                {/* Big Balance */}
                <div className="space-y-1">
                  <span className="text-xs text-white/40 uppercase tracking-wider">الرصيد المتاح</span>
                  <div className="flex items-baseline gap-3">
                    <motion.span
                      key={animatedBalance}
                      className="text-5xl md:text-6xl font-black text-white tabular-nums tracking-tighter"
                      style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {animatedBalance.toLocaleString("ar-SA")}
                    </motion.span>
                    <span className="text-lg font-medium text-white/30">{wallet.currency}</span>
                  </div>
                </div>

                {/* Pending + Status row */}
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400/70" />
                    <span className="text-sm text-white/40">معلّق:</span>
                    <span className="text-sm font-bold text-white/80 tabular-nums">
                      {animatedPending.toLocaleString("ar-SA")} {wallet.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                    <Badge className={`${statusInfo.color} bg-white/[0.06] border border-white/10 text-xs px-3 py-1`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Right: CTA Button */}
              <div className="flex-shrink-0">
                <motion.button
                  onClick={() => setShowTopup(true)}
                  className="relative flex items-center gap-2 px-7 py-4 rounded-xl font-bold text-white text-sm
                    shadow-[0_4px_20px_-4px_hsla(152,60%,42%,0.4)]
                    hover:shadow-[0_6px_28px_-4px_hsla(152,60%,42%,0.55)]
                    transition-shadow duration-300"
                  style={{
                    background: "linear-gradient(135deg, hsl(152,60%,42%) 0%, hsl(172,60%,40%) 100%)",
                  }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <motion.span
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, hsl(152,60%,42%) 0%, hsl(172,60%,40%) 100%)",
                    }}
                    animate={{ opacity: [0, 0.4, 0], scale: [1, 1.15, 1.2] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4.5, ease: "easeOut" }}
                  />
                  <Plus className="w-5 h-5 relative z-10" />
                  <span className="relative z-10">إضافة رصيد</span>
                </motion.button>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Transactions */}
        <GlassCard delay={0.4} className="!p-0">
          <div className="p-6 pb-4 border-b border-white/[0.06]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-teal-400" />
              سجل المعاملات
            </h3>
          </div>
          <div className="p-4">
            {transactions.length === 0 ? (
              <div className="text-center py-16">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-white/10" />
                <p className="text-sm text-white/30">لا توجد معاملات بعد</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx, i) => {
                  const isCredit = tx.type === "credit";
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: isRTL ? -10 : 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * Math.min(i, 10), duration: 0.3 }}
                      className="flex items-center justify-between p-3.5 rounded-xl
                        hover:bg-white/[0.04] transition-colors duration-300 group/tx"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-300 ${
                          isCredit
                            ? "bg-emerald-400/10 group-hover/tx:bg-emerald-400/20"
                            : "bg-red-400/10 group-hover/tx:bg-red-400/20"
                        }`}>
                          {isCredit ? (
                            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/90">
                            {REASON_LABELS[tx.reason] || tx.reason}
                          </p>
                          <p className="text-xs text-white/30">
                            {format(new Date(tx.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                          </p>
                        </div>
                      </div>
                      <div className={`text-sm font-bold tabular-nums ${
                        isCredit ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {isCredit ? "+" : "-"}{tx.amount.toLocaleString("ar-SA")} {wallet.currency}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default WalletPage;
