import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, Clock, CheckCircle2,
  XCircle, ArrowUpRight, ArrowDownRight, Receipt, Snowflake,
  Plus, CreditCard, Landmark, Loader2, Upload, Copy, Building2, AlertCircle,
  Shield, Eye, EyeOff, RefreshCw, Download, Filter,
  TrendingDown, PieChart, Lock, Zap, ArrowRight, Sparkles,
  ChevronDown, ChevronUp, BadgeCheck, Banknote, BarChart3,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
// Topup is now inline, no Dialog needed

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

interface TopupRequest {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  bank_reference: string | null;
  receipt_filename: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  active: { label: "نشطة", color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-400/10" },
  frozen: { label: "مجمّدة", color: "text-red-400", icon: Snowflake, bg: "bg-red-400/10" },
  suspended: { label: "موقوفة", color: "text-amber-400", icon: XCircle, bg: "bg-amber-400/10" },
};

const TOPUP_STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "قيد المراجعة", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: Clock },
  approved: { label: "تمت الموافقة", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20", icon: XCircle },
};

const REASON_LABELS: Record<string, { label: string; icon: any }> = {
  integration: { label: "شراء تكامل", icon: Zap },
  refund: { label: "استرداد", icon: RefreshCw },
  topup: { label: "شحن رصيد", icon: ArrowDownRight },
  manual: { label: "عملية يدوية", icon: Landmark },
  payout: { label: "سحب", icon: ArrowUpRight },
};

const BANK_INFO = {
  iban: "SA5345000000262359391004",
  bankName: "Alawwal Bank",
  beneficiary: "شركة علي صالح الشهري القابضة",
};

/* ── Banking Background ── */
const BankingBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    {/* Base gradient - deep navy banking feel */}
    <div className="absolute inset-0" style={{
      background: "linear-gradient(160deg, hsl(220,35%,8%) 0%, hsl(225,30%,12%) 35%, hsl(230,28%,15%) 60%, hsl(225,32%,11%) 100%)"
    }} />
    
    {/* Subtle mesh pattern */}
    <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="bank-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="0.5" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bank-grid)" />
    </svg>

    {/* Ambient glows */}
    <div className="absolute w-[600px] h-[600px] rounded-full top-[-20%] right-[-10%]"
      style={{ background: "radial-gradient(circle, hsla(220,60%,50%,0.06) 0%, transparent 60%)" }} />
    <div className="absolute w-[500px] h-[500px] rounded-full bottom-[-10%] left-[-5%]"
      style={{ background: "radial-gradient(circle, hsla(250,50%,45%,0.04) 0%, transparent 60%)" }} />
  </div>
);

/* ── Stat Card ── */
const StatCard = ({ icon: Icon, label, value, suffix, color, delay = 0 }: {
  icon: any; label: string; value: string | number; suffix?: string; color: string; delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="relative rounded-2xl p-5 overflow-hidden bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.12] transition-all duration-500 group"
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <p className="text-2xl font-black text-white tabular-nums">{value} <span className="text-xs font-normal text-white/30">{suffix}</span></p>
    <p className="text-xs text-white/40 mt-1">{label}</p>
  </motion.div>
);

/* ── Quick Action Button ── */
const QuickAction = ({ icon: Icon, label, onClick, color, delay = 0 }: {
  icon: any; label: string; onClick: () => void; color: string; delay?: number;
}) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.4 }}
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/[0.12] transition-all duration-300 group`}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.97 }}
  >
    <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <span className="text-xs font-medium text-white/60 group-hover:text-white/80 transition-colors">{label}</span>
  </motion.button>
);

const TOPUP_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const WalletPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "card">("bank_transfer");
  const [topupLoading, setTopupLoading] = useState(false);
  const [bankReference, setBankReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [showAllTx, setShowAllTx] = useState(false);

  const animatedBalance = useAnimatedCounter(wallet?.balance_available ?? 0);
  const animatedPending = useAnimatedCounter(wallet?.balance_pending ?? 0);

  /* ── Spending Analytics ── */
  const analytics = useMemo(() => {
    if (transactions.length === 0) return null;
    const now = new Date();
    const thisMonth = transactions.filter(t => {
      const d = new Date(t.created_at);
      return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
    });
    const last30 = transactions.filter(t => new Date(t.created_at) >= subDays(now, 30));
    
    const totalIn = last30.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalOut = last30.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const txCount = thisMonth.length;
    
    // Category breakdown
    const categories: Record<string, number> = {};
    last30.filter(t => t.type === "debit").forEach(t => {
      const key = t.reason || "other";
      categories[key] = (categories[key] || 0) + t.amount;
    });

    return { totalIn, totalOut, txCount, categories };
  }, [transactions]);

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

        const { data: reqs } = await supabase
          .from("wallet_topup_requests")
          .select("*")
          .eq("wallet_id", w.id)
          .order("created_at", { ascending: false })
          .limit(20);
        setTopupRequests((reqs as TopupRequest[]) || []);
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
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "wallet_topup_requests",
      }, (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          setTopupRequests((prev) => [payload.new as TopupRequest, ...prev].slice(0, 20));
        } else if (payload.eventType === "UPDATE" && payload.new) {
          setTopupRequests((prev) => prev.map(r => r.id === (payload.new as TopupRequest).id ? payload.new as TopupRequest : r));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const finalAmount = topupAmount > 0 ? topupAmount : Number(customAmount) || 0;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  const handleTopup = async () => {
    if (finalAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صالح");
      return;
    }

    if (paymentMethod === "card") {
      setTopupLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=topup`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ amount: finalAmount }),
          }
        );
        const result = await res.json();

        if (!res.ok || result.error) {
          toast.error(result.error || "فشل إنشاء رابط الدفع");
          return;
        }

        if (result.paymentUrl) {
          toast.success("جاري التحويل لصفحة الدفع...", { duration: 3000 });
          window.open(result.paymentUrl, "_blank");
          setShowTopup(false);
          setTopupAmount(0);
          setCustomAmount("");
        }
      } catch (err: any) {
        toast.error("حدث خطأ — يرجى المحاولة مرة أخرى");
      } finally {
        setTopupLoading(false);
      }
      return;
    }

    if (!receiptFile) {
      toast.error("يرجى رفع إيصال التحويل البنكي");
      return;
    }

    setTopupLoading(true);
    try {
      setUploadingReceipt(true);
      const fileExt = receiptFile.name.split(".").pop();
      const filePath = `${tenantId}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("wallet-receipts")
        .upload(filePath, receiptFile);

      if (uploadErr) {
        toast.error("فشل رفع الإيصال — يرجى المحاولة مرة أخرى");
        console.error("Upload error:", uploadErr);
        return;
      }
      setUploadingReceipt(false);

      const { data: urlData } = supabase.storage
        .from("wallet-receipts")
        .getPublicUrl(uploadData.path);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=bank-transfer-topup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            amount: finalAmount,
            bankReference,
            receiptUrl: urlData.publicUrl || uploadData.path,
            receiptFilename: receiptFile.name,
          }),
        }
      );
      const result = await res.json();

      if (!res.ok || result.error) {
        toast.error(result.error || "فشل إرسال الطلب");
        return;
      }

      toast.success(result.message || "تم إرسال طلب الشحن بنجاح", {
        description: "سيتم مراجعة الإيصال وإضافة الرصيد خلال 24 ساعة",
        duration: 6000,
      });
      // Refetch topup requests to show the new one immediately
      if (wallet) {
        const { data: reqs } = await supabase
          .from("wallet_topup_requests")
          .select("*")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false })
          .limit(20);
        setTopupRequests((reqs as TopupRequest[]) || []);
      }
      setShowTopup(false);
      setTopupAmount(0);
      setCustomAmount("");
      setBankReference("");
      setReceiptFile(null);
    } catch (err: any) {
      toast.error("حدث خطأ — يرجى المحاولة مرة أخرى");
    } finally {
      setTopupLoading(false);
      setUploadingReceipt(false);
    }
  };

  const filteredTx = useMemo(() => {
    if (txFilter === "all") return transactions;
    return transactions.filter(t => t.type === txFilter);
  }, [transactions, txFilter]);

  const displayedTx = showAllTx ? filteredTx : filteredTx.slice(0, 8);

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <BankingBackground />
        <div className="relative z-10 p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
          <Skeleton className="h-10 w-56 bg-white/10 rounded-xl" />
          <Skeleton className="h-56 rounded-3xl bg-white/5" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)}
          </div>
          <Skeleton className="h-64 rounded-3xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-screen relative">
        <BankingBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-6">
            <Wallet className="w-10 h-10 text-white/20" />
          </div>
          <h2 className="text-lg font-semibold text-white/80 mb-2">لا توجد محفظة</h2>
          <p className="text-sm text-white/40">يرجى التواصل مع الدعم لتفعيل المحفظة.</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[wallet.status] || STATUS_MAP.active;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen relative">
      <BankingBackground />

      {/* Topup section is now inline below the hero card */}

      <div className="relative z-10 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">

        {/* ── Hero Balance Card ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(220,60%,18%) 0%, hsl(240,50%,22%) 50%, hsl(260,45%,20%) 100%)",
          }}
        >
          {/* Card inner glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full"
              style={{ background: "radial-gradient(circle, hsla(220,80%,60%,0.12) 0%, transparent 60%)" }} />
            <div className="absolute bottom-0 left-0 w-[250px] h-[250px] rounded-full"
              style={{ background: "radial-gradient(circle, hsla(260,70%,50%,0.08) 0%, transparent 60%)" }} />
          </div>

          {/* Shimmer */}
          <motion.div className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)",
              backgroundSize: "200% 100%",
            }}
            animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
            transition={{ duration: 5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
          />

          <div className="relative z-10 p-6 md:p-10">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
              {/* Balance Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center backdrop-blur-sm">
                    <Wallet className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">المحفظة الرقمية</h1>
                    <p className="text-xs text-white/30 mt-0.5">إدارة مالية ذكية وآمنة</p>
                  </div>
                  <button onClick={() => setBalanceHidden(!balanceHidden)}
                    className="ms-auto md:ms-4 p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all">
                    {balanceHidden ? <EyeOff className="w-4 h-4 text-white/40" /> : <Eye className="w-4 h-4 text-white/40" />}
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-white/30 uppercase tracking-widest font-medium">الرصيد المتاح</span>
                  <div className="flex items-baseline gap-3">
                    <motion.span
                      key={animatedBalance}
                      className="text-5xl md:text-7xl font-black text-white tabular-nums tracking-tighter"
                      style={{
                        background: balanceHidden ? "none" : "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.65) 100%)",
                        WebkitBackgroundClip: balanceHidden ? "unset" : "text",
                        WebkitTextFillColor: balanceHidden ? "transparent" : "transparent",
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {balanceHidden ? "••••••" : animatedBalance.toLocaleString("ar-SA")}
                    </motion.span>
                    <span className="text-lg font-medium text-white/25">{wallet.currency}</span>
                  </div>
                </div>

                {/* Status Row */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <Clock className="w-3.5 h-3.5 text-amber-400/70" />
                    <span className="text-xs text-white/35">معلّق:</span>
                    <span className="text-xs font-bold text-white/70 tabular-nums">
                      {balanceHidden ? "••••" : `${animatedPending.toLocaleString("ar-SA")} ${wallet.currency}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                    <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                    <span className={`text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/5 border border-emerald-400/10">
                    <Shield className="w-3.5 h-3.5 text-emerald-400/60" />
                    <span className="text-xs text-emerald-400/60 font-medium">محمية</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-3 flex-shrink-0">
                <motion.button
                  onClick={() => setShowTopup(true)}
                  className="relative flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-white text-sm
                    shadow-[0_4px_25px_-4px_hsla(220,80%,55%,0.5)]
                    hover:shadow-[0_8px_35px_-4px_hsla(220,80%,55%,0.6)]
                    transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg, hsl(220,80%,55%) 0%, hsl(250,70%,55%) 100%)",
                  }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Plus className="w-5 h-5" />
                  إضافة رصيد
                </motion.button>

                {/* Security badge */}
                <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <Lock className="w-3 h-3 text-white/20" />
                  <span className="text-[10px] text-white/20">تشفير 256-bit</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Inline Topup Section ── */}
        <AnimatePresence>
          {showTopup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="rounded-3xl bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] p-6 md:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">إضافة رصيد</h2>
                  </div>
                  <button onClick={() => setShowTopup(false)}
                    className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all">
                    <XCircle className="w-5 h-5 text-white/40" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <label className="text-sm text-white/50 font-medium">طريقة الدفع</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPaymentMethod("bank_transfer")}
                          className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${paymentMethod === "bank_transfer" ? "border-blue-500/50 bg-blue-500/10" : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                          <Building2 className={`w-6 h-6 ${paymentMethod === "bank_transfer" ? "text-blue-400" : "text-white/40"}`} />
                          <span className={`text-sm font-medium ${paymentMethod === "bank_transfer" ? "text-blue-400" : "text-white/50"}`}>تحويل بنكي</span>
                        </button>
                        <button onClick={() => setPaymentMethod("card")}
                          className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${paymentMethod === "card" ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                          <CreditCard className={`w-6 h-6 ${paymentMethod === "card" ? "text-indigo-400" : "text-white/40"}`} />
                          <span className={`text-sm font-medium ${paymentMethod === "card" ? "text-indigo-400" : "text-white/50"}`}>بطاقة / Apple Pay</span>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm text-white/50 font-medium">اختر المبلغ</label>
                      <div className="grid grid-cols-3 gap-2">
                        {TOPUP_AMOUNTS.map((amt) => (
                          <button key={amt} onClick={() => { setTopupAmount(amt); setCustomAmount(""); }}
                            className={`py-3.5 rounded-xl text-sm font-bold transition-all duration-300 border-2 ${topupAmount === amt ? "border-blue-500/50 bg-blue-500/10 text-blue-400" : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"}`}>
                            {amt.toLocaleString("ar-SA")} ر.س
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50 font-medium">أو أدخل مبلغ مخصص</label>
                      <div className="relative">
                        <input type="number" min="1" max="50000" placeholder="0" value={customAmount}
                          onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(0); }}
                          className="w-full bg-white/[0.04] border-2 border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-white/15 focus:outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 transition-all text-lg font-bold text-center" dir="ltr" />
                        <span className="absolute top-1/2 -translate-y-1/2 start-4 text-sm text-white/20">ر.س</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {paymentMethod === "bank_transfer" && finalAmount > 0 ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                          <div className="flex items-center gap-2 mb-3">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-semibold text-white/70">معلومات الحساب البنكي</span>
                          </div>
                          {[
                            { label: "رقم الآيبان (IBAN)", value: BANK_INFO.iban, dir: "ltr" as const, mono: true },
                            { label: "اسم البنك", value: BANK_INFO.bankName },
                            { label: "اسم المستفيد", value: BANK_INFO.beneficiary },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="min-w-0">
                                <span className="text-[10px] text-white/25 uppercase tracking-wider block">{item.label}</span>
                                <span className={`text-sm text-white/80 ${item.mono ? "font-mono break-all" : ""}`} dir={item.dir}>{item.value}</span>
                              </div>
                              <button onClick={() => copyToClipboard(item.value, item.label)} className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors">
                                <Copy className="w-4 h-4 text-white/30" />
                              </button>
                            </div>
                          ))}
                          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                            <span className="text-[10px] text-blue-400/60 uppercase tracking-wider block">المبلغ المطلوب تحويله</span>
                            <span className="text-xl font-black text-blue-400">{finalAmount.toLocaleString("ar-SA")} ر.س</span>
                          </div>
                        </div>
                        <input type="text" placeholder="رقم مرجع التحويل (اختياري)" value={bankReference}
                          onChange={(e) => setBankReference(e.target.value)}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/15 focus:outline-none focus:border-blue-500/40 transition-all text-sm" dir="ltr" />
                        <label className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${receiptFile ? "border-blue-500/40 bg-blue-500/5" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]"}`}>
                          <input type="file" accept="image/*,.pdf" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 5 * 1024 * 1024) { toast.error("حجم الملف يجب أن لا يتجاوز 5 ميجابايت"); return; } setReceiptFile(file); } }} />
                          {receiptFile ? (<><CheckCircle2 className="w-8 h-8 text-blue-400" /><p className="text-sm font-semibold text-blue-400">{receiptFile.name}</p></>) : (<><Upload className="w-8 h-8 text-white/15" /><p className="text-sm text-white/40">رفع إيصال التحويل *</p></>)}
                        </label>
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-400/5 border border-amber-400/10">
                          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-400/70 leading-relaxed">سيتم مراجعة الإيصال وتأكيد الرصيد خلال 24 ساعة عمل.</p>
                        </div>
                      </div>
                    ) : paymentMethod === "card" && finalAmount > 0 ? (
                      <div className="flex flex-col items-center justify-center h-full rounded-2xl bg-white/[0.03] border border-white/[0.06] p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center"><CreditCard className="w-8 h-8 text-indigo-400" /></div>
                        <p className="text-lg font-bold text-white">{finalAmount.toLocaleString("ar-SA")} ر.س</p>
                        <p className="text-sm text-white/40">سيتم تحويلك لصفحة الدفع الآمنة</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.06] p-8 text-center">
                        <Banknote className="w-12 h-12 text-white/10 mb-3" />
                        <p className="text-sm text-white/25">اختر المبلغ وطريقة الدفع</p>
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={handleTopup}
                  disabled={topupLoading || finalAmount <= 0 || (paymentMethod === "bank_transfer" && !receiptFile)}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: finalAmount > 0 && (paymentMethod !== "bank_transfer" || receiptFile) ? "linear-gradient(135deg, hsl(220,80%,55%) 0%, hsl(250,70%,55%) 100%)" : "rgba(255,255,255,0.04)" }}>
                  {topupLoading ? (<span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{uploadingReceipt ? "جاري رفع الإيصال..." : "جاري الإرسال..."}</span>)
                    : (<><CheckCircle2 className="w-5 h-5" />{finalAmount > 0 ? `إرسال طلب الشحن — ${finalAmount.toLocaleString("ar-SA")} ر.س` : "اختر المبلغ"}</>)}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={Plus} label="شحن رصيد" onClick={() => setShowTopup(true)} color="bg-blue-500/20" delay={0.1} />
          <QuickAction icon={BarChart3} label="التحليلات" onClick={() => {}} color="bg-indigo-500/20" delay={0.15} />
          <QuickAction icon={Download} label="تصدير كشف" onClick={() => {
            if (transactions.length === 0) { toast.info("لا توجد معاملات للتصدير"); return; }
            const csv = ["النوع,المبلغ,السبب,التاريخ",
              ...transactions.map(t => `${t.type},${t.amount},${t.reason},${t.created_at}`)
            ].join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "wallet-statement.csv"; a.click();
            toast.success("تم تصدير كشف الحساب بنجاح");
          }} color="bg-purple-500/20" delay={0.2} />
          <QuickAction icon={Shield} label="الأمان" onClick={() => toast.info("محفظتك محمية بأعلى معايير الأمان")} color="bg-emerald-500/20" delay={0.25} />
        </div>

        {/* ── Analytics Cards ── */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ArrowDownRight} label="الوارد (30 يوم)" value={balanceHidden ? "••••" : analytics.totalIn.toLocaleString("ar-SA")} suffix={wallet.currency} color="bg-blue-500/20" delay={0.2} />
            <StatCard icon={ArrowUpRight} label="المنصرف (30 يوم)" value={balanceHidden ? "••••" : analytics.totalOut.toLocaleString("ar-SA")} suffix={wallet.currency} color="bg-indigo-500/20" delay={0.25} />
            <StatCard icon={BarChart3} label="عمليات الشهر" value={analytics.txCount} color="bg-purple-500/20" delay={0.3} />
            <StatCard icon={TrendingUp} label="صافي التدفق" value={balanceHidden ? "••••" : (analytics.totalIn - analytics.totalOut).toLocaleString("ar-SA")} suffix={wallet.currency} color="bg-emerald-500/20" delay={0.35} />
          </div>
        )}

        {/* ── Spending Breakdown ── */}
        {analytics && Object.keys(analytics.categories).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-3xl bg-white/[0.03] border border-white/[0.06] p-6"
          >
            <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-400" />
              توزيع المصروفات (آخر 30 يوم)
            </h3>
            <div className="space-y-3">
              {Object.entries(analytics.categories)
                .sort(([, a], [, b]) => b - a)
                .map(([key, amount]) => {
                  const total = analytics.totalOut || 1;
                  const pct = Math.round((amount / total) * 100);
                  const info = REASON_LABELS[key] || { label: key, icon: Receipt };
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50 flex items-center gap-1.5">
                          <info.icon className="w-3 h-3" />
                          {info.label}
                        </span>
                        <span className="text-white/70 font-bold tabular-nums">
                          {balanceHidden ? "••••" : amount.toLocaleString("ar-SA")} {wallet.currency} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg, hsl(220,80%,55%), hsl(250,70%,55%))" }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ── Topup Requests (Bank Transfer) ── */}
        {topupRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="rounded-3xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
          >
            <div className="p-6 pb-4 border-b border-white/[0.05]">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                طلبات شحن التحويل البنكي
                <span className="text-xs text-white/30 font-normal">({topupRequests.length})</span>
              </h3>
            </div>
            <div className="p-6 space-y-2">
              {topupRequests.map((req, i) => {
                const statusInfo = TOPUP_STATUS_MAP[req.status] || TOPUP_STATUS_MAP.pending;
                const StatusIcon = statusInfo.icon;
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * i, duration: 0.4 }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-300"
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-500/10 border border-blue-500/20">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/85">طلب شحن — تحويل بنكي</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-white/25 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(req.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                        </span>
                        {req.receipt_filename && (
                          <span className="text-xs text-white/20 flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {req.receipt_filename}
                          </span>
                        )}
                        {req.bank_reference && (
                          <span className="text-xs text-white/20 font-mono" dir="ltr">Ref: {req.bank_reference}</span>
                        )}
                      </div>
                      {req.rejection_reason && (
                        <p className="text-xs text-red-400/70 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {req.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-base font-bold text-blue-400 tabular-nums whitespace-nowrap">
                        +{req.amount.toLocaleString("ar-SA")}
                        <span className="text-xs font-normal opacity-50 ms-1">{wallet.currency}</span>
                      </span>
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Transaction History ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="rounded-3xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        >
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.05]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              سجل المعاملات
              {transactions.length > 0 && (
                <span className="text-xs text-white/30 font-normal">({filteredTx.length})</span>
              )}
            </h3>
            
            {/* Filter Pills */}
            {transactions.length > 0 && (
              <div className="flex items-center gap-2">
                {[
                  { key: "all" as const, label: "الكل" },
                  { key: "credit" as const, label: "وارد" },
                  { key: "debit" as const, label: "صادر" },
                ].map(f => (
                  <button key={f.key} onClick={() => setTxFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                      txFilter === f.key
                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        : "bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]"
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6">
            {filteredTx.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                  <Receipt className="w-9 h-9 text-white/10" />
                </div>
                <h4 className="text-base font-semibold text-white/60 mb-2">لا توجد معاملات بعد</h4>
                <p className="text-sm text-white/25 max-w-xs">
                  ستظهر هنا جميع حركاتك المالية بمجرد إجراء أول عملية.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {displayedTx.map((tx, i) => {
                    const isCredit = tx.type === "credit";
                    const reasonInfo = REASON_LABELS[tx.reason] || { label: tx.reason, icon: Receipt };
                    const TxIcon = reasonInfo.icon;

                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.03 * Math.min(i, 10), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]
                          hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-300 group/tx"
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isCredit ? "bg-blue-500/10 border border-blue-500/20" : "bg-red-400/10 border border-red-400/20"
                        }`}>
                          <TxIcon className={`w-5 h-5 ${isCredit ? "text-blue-400" : "text-red-400"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white/85">{reasonInfo.label}</p>
                          <span className="text-xs text-white/25 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(tx.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                          </span>
                        </div>

                        <div className={`text-base font-bold tabular-nums whitespace-nowrap ${
                          isCredit ? "text-blue-400" : "text-red-400"
                        }`}>
                          {isCredit ? "+" : "-"}{tx.amount.toLocaleString("ar-SA")}
                          <span className="text-xs font-normal opacity-50 ms-1">{wallet.currency}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Show more / less */}
                {filteredTx.length > 8 && (
                  <button onClick={() => setShowAllTx(!showAllTx)}
                    className="w-full py-3 rounded-2xl text-xs font-medium text-white/30 hover:text-white/50
                      bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-all duration-300
                      flex items-center justify-center gap-1.5">
                    {showAllTx ? (
                      <><ChevronUp className="w-3.5 h-3.5" /> عرض أقل</>
                    ) : (
                      <><ChevronDown className="w-3.5 h-3.5" /> عرض الكل ({filteredTx.length})</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Security Footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-6 py-4 text-white/15"
        >
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[10px]">تشفير AES-256</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span className="text-[10px]">معتمد من SAMA</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-[10px]">حماية متقدمة</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default WalletPage;
