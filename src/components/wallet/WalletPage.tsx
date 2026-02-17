import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Wallet, Clock, CheckCircle2, XCircle, Plus, Loader2,
  Upload, Copy, Building2, AlertCircle, Search, Filter,
  CreditCard, Receipt, FileText, Zap, Eye,
  ArrowUpRight, ArrowDownRight, TrendingUp, Activity,
  Download, MoreHorizontal, CircleDollarSign,
} from "lucide-react";
import {
  WalletBalanceIcon, WalletTopupIcon, WalletActivityIcon,
  WalletShieldIcon, WalletFreezeIcon, MicroIcon,
} from "@/components/wallet/WalletIcons";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

// ── Animated Counter Hook ──
function useAnimatedNumber(target: number, duration = 200) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>();
  const startRef = useRef({ value: target, time: 0 });

  useEffect(() => {
    const start = display;
    const startTime = performance.now();
    startRef.current = { value: start, time: startTime };

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

// ── Section reveal animation ──
const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] as const } },
};

// ── Ripple Button Component ──
const RippleButton = ({ children, onClick, disabled, className = "", ...props }: React.ComponentProps<typeof Button>) => {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 500);
    onClick?.(e);
  };

  return (
    <Button onClick={handleClick} disabled={disabled} className={`relative overflow-hidden ${className}`} {...props}>
      {children}
      {ripples.map(r => (
        <span
          key={r.id}
          className="absolute rounded-full bg-primary-foreground/20 animate-[ripple_0.5s_ease-out]"
          style={{ left: r.x - 10, top: r.y - 10, width: 20, height: 20 }}
        />
      ))}
    </Button>
  );
};

// HoverIcon now delegates to MicroIcon system
const HoverIcon = ({ icon: Icon, className = "", size = 16 }: { icon: React.ElementType; className?: string; size?: number }) => (
  <MicroIcon icon={Icon as any} size={size} className={className} />
);

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

const STATUS_MAP: Record<string, { label: string; color: string; dotColor: string }> = {
  active: { label: "نشطة", color: "bg-success/10 text-success border-success/20", dotColor: "bg-success" },
  frozen: { label: "مجمّدة", color: "bg-destructive/10 text-destructive border-destructive/20", dotColor: "bg-destructive" },
  suspended: { label: "موقوفة", color: "bg-warning/10 text-warning border-warning/20", dotColor: "bg-warning" },
};

const TX_STATUS: Record<string, { label: string; color: string }> = {
  credit: { label: "إيداع", color: "text-success" },
  debit: { label: "خصم", color: "text-destructive" },
};

const REASON_LABELS: Record<string, string> = {
  subscription: "اشتراك",
  integration: "تكامل",
  refund: "استرداد",
  topup: "شحن رصيد",
  manual: "عملية يدوية",
  payout: "سحب",
};

const TOPUP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-warning/10 text-warning border-warning/20" },
  approved: { label: "تمت الموافقة", color: "bg-success/10 text-success border-success/20" },
  rejected: { label: "مرفوض", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const BANK_INFO = {
  iban: "SA5345000000262359391004",
  bankName: "Alawwal Bank",
  beneficiary: "شركة علي صالح الشهري القابضة",
};

const TOPUP_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

const WalletPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [prevBalance, setPrevBalance] = useState<number>(0);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Topup modal state
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "card">("bank_transfer");
  const [topupLoading, setTopupLoading] = useState(false);
  const [bankReference, setBankReference] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const finalAmount = topupAmount > 0 ? topupAmount : Number(customAmount) || 0;

  // Animated numbers
  const animatedBalance = useAnimatedNumber(wallet?.balance_available || 0);
  const animatedPending = useAnimatedNumber(wallet?.balance_pending || 0);

  // Balance change indicator
  const balanceChange = wallet ? wallet.balance_available - prevBalance : 0;

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data: w } = await supabase
      .from("tenant_wallets")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (w) {
      setPrevBalance(wallet?.balance_available || w.balance_available);
      setWallet(w);
      const [{ data: txs }, { data: reqs }] = await Promise.all([
        supabase.from("wallet_transactions").select("*").eq("wallet_id", w.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("wallet_topup_requests").select("*").eq("wallet_id", w.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setTransactions(txs || []);
      setTopupRequests((reqs as TopupRequest[]) || []);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("wallet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_wallets", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.new) {
          setPrevBalance(wallet?.balance_available || 0);
          setWallet(payload.new as WalletData);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions" }, (payload) => {
        if (payload.new) setTransactions((prev) => [payload.new as WalletTransaction, ...prev].slice(0, 50));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_topup_requests" }, (payload) => {
        if (payload.eventType === "INSERT" && payload.new) {
          setTopupRequests((prev) => [payload.new as TopupRequest, ...prev].slice(0, 20));
        } else if (payload.eventType === "UPDATE" && payload.new) {
          setTopupRequests((prev) => prev.map(r => r.id === (payload.new as TopupRequest).id ? payload.new as TopupRequest : r));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, wallet?.balance_available]);

  // Usage analytics
  const usageStats = useMemo(() => {
    const debits = transactions.filter(t => t.type === "debit");
    const byReason: Record<string, number> = {};
    debits.forEach(t => { byReason[t.reason] = (byReason[t.reason] || 0) + t.amount; });
    return {
      subscriptions: byReason["subscription"] || 0,
      integrations: byReason["integration"] || 0,
      totalOps: transactions.length,
    };
  }, [transactions]);

  const filteredTx = useMemo(() => {
    if (txFilter === "all") return transactions;
    return transactions.filter(t => t.type === txFilter);
  }, [transactions, txFilter]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  const handleTopup = async () => {
    if (finalAmount <= 0) { toast.error("يرجى إدخال مبلغ صالح"); return; }

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
        if (!res.ok || result.error) { toast.error(result.error || "فشل إنشاء رابط الدفع"); return; }
        if (result.paymentUrl) {
          toast.success("جاري التحويل لصفحة الدفع...");
          window.open(result.paymentUrl, "_blank");
          resetTopup();
        }
      } catch { toast.error("حدث خطأ — يرجى المحاولة مرة أخرى"); }
      finally { setTopupLoading(false); }
      return;
    }

    if (!receiptFile) { toast.error("يرجى رفع إيصال التحويل البنكي"); return; }

    setTopupLoading(true);
    try {
      setUploadingReceipt(true);
      const fileExt = receiptFile.name.split(".").pop();
      const filePath = `${tenantId}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from("wallet-receipts").upload(filePath, receiptFile);
      if (uploadErr) { toast.error("فشل رفع الإيصال"); return; }
      setUploadingReceipt(false);
      const { data: urlData } = supabase.storage.from("wallet-receipts").getPublicUrl(uploadData.path);

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
      if (!res.ok || result.error) { toast.error(result.error || "فشل إرسال الطلب"); return; }
      toast.success("تم إرسال طلب الشحن بنجاح", { description: "سيتم مراجعة الإيصال وإضافة الرصيد خلال 24 ساعة" });
      resetTopup();
      fetchData();
    } catch { toast.error("حدث خطأ — يرجى المحاولة مرة أخرى"); }
    finally { setTopupLoading(false); setUploadingReceipt(false); }
  };

  const resetTopup = () => {
    setShowTopup(false);
    setTopupAmount(0);
    setCustomAmount("");
    setBankReference("");
    setReceiptFile(null);
    setPaymentMethod("bank_transfer");
  };

  const exportCSV = () => {
    if (transactions.length === 0) { toast.info("لا توجد حركات للتصدير"); return; }
    const csv = ["النوع,المبلغ,السبب,التاريخ",
      ...transactions.map(t => `${t.type === "credit" ? "إيداع" : "خصم"},${t.amount},${REASON_LABELS[t.reason] || t.reason},${t.created_at}`)
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "wallet-statement.csv"; a.click();
    toast.success("تم تصدير كشف الحساب");
  };

  const formatAmount = (n: number) => n.toLocaleString("ar-SA");

  // Loading state
  if (loading) {
    return (
      <div dir="rtl" className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <Wallet className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">لا توجد محفظة</h2>
        <p className="text-sm text-muted-foreground">يرجى التواصل مع الدعم لتفعيل المحفظة.</p>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[wallet.status] || STATUS_MAP.active;
  const txFilterOptions = [
    { value: "all" as const, label: "الكل" },
    { value: "credit" as const, label: "إيداع" },
    { value: "debit" as const, label: "خصم" },
  ];

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6 relative">
      {/* Subtle brand-tinted background overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, hsl(172 66% 36% / 0.02) 0%, transparent 60%)" }} />

      <div className="relative space-y-6">
        {/* Header */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible"
          className="flex items-center justify-between flex-wrap gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">المحفظة</h1>
            <p className="text-sm text-muted-foreground mt-1">الرصيد وسجل الحركات المالية</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download size={16} />
              تصدير كشف
            </Button>
            <RippleButton onClick={() => setShowTopup(true)} className="gap-2">
              <WalletTopupIcon size={16} className="text-primary-foreground" />
              إضافة رصيد
            </RippleButton>
          </div>
        </motion.div>

        {/* A) Summary Row */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible"
          className="grid gap-4 grid-cols-1 sm:grid-cols-3"
          style={{ transitionDelay: "40ms" }}
        >
          {/* Balance Card */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">الرصيد المتاح</p>
              <WalletBalanceIcon size={18} className="text-muted-foreground/50 group-hover:text-accent transition-colors" />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums" dir="ltr">
              {formatAmount(animatedBalance)}
              <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>
            </p>
            {/* Change indicator */}
            <AnimatePresence>
              {balanceChange !== 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-1 mt-2 text-xs font-medium ${balanceChange > 0 ? "text-success" : "text-destructive"}`}
                >
                  {balanceChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  <span>{balanceChange > 0 ? "+" : ""}{formatAmount(balanceChange)} ر.س</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pending Balance */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">الرصيد المحجوز</p>
              <MicroIcon icon={Clock} size={18} className="text-muted-foreground/50 group-hover:text-accent transition-colors" rotateDir={-1} />
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums" dir="ltr">
              {formatAmount(animatedPending)}
              <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>
            </p>
          </div>

          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">حالة المحفظة</p>
              {wallet.status === "frozen" || wallet.status === "suspended" 
                ? <WalletFreezeIcon size={18} className="text-muted-foreground/50 group-hover:text-accent transition-colors" />
                : <WalletShieldIcon size={18} className="text-muted-foreground/50 group-hover:text-accent transition-colors" />
              }
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor} animate-pulse`} />
              <Badge variant="outline" className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* C) Usage Context */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible"
          className="grid gap-4 grid-cols-1 sm:grid-cols-3"
          style={{ transitionDelay: "80ms" }}
        >
          {[
            { label: "مستخدم للاشتراكات", value: usageStats.subscriptions, icon: Receipt },
            { label: "مستخدم للتكاملات", value: usageStats.integrations, icon: Zap },
            { label: "إجمالي العمليات", value: usageStats.totalOps, icon: TrendingUp, isCount: true },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group">
              <div className="flex items-center gap-2 mb-3">
                <HoverIcon icon={stat.icon} size={14} className="text-muted-foreground/60 group-hover:text-accent transition-colors" />
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums" dir="ltr">
                {stat.isCount ? stat.value : formatAmount(stat.value)}
                {!stat.isCount && <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Topup Requests */}
        {topupRequests.filter(r => r.status === "pending").length > 0 && (
          <motion.div variants={sectionVariants} initial="hidden" animate="visible"
            className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md space-y-3"
            style={{ transitionDelay: "120ms" }}
          >
            <h3 className="text-sm font-semibold text-foreground">طلبات شحن معلقة</h3>
            {topupRequests.filter(r => r.status === "pending").map(req => {
              const st = TOPUP_STATUS[req.status];
              return (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/10">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={st.color}>{st.label}</Badge>
                    <span className="font-bold text-foreground tabular-nums">{formatAmount(req.amount)} ر.س</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(req.created_at), "dd MMM yyyy", { locale: ar })}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* D) Transactions Table */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible"
          className="space-y-3"
          style={{ transitionDelay: "160ms" }}
        >
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <WalletActivityIcon size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">سجل الحركات المالية</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap ms-auto">
              <Filter size={14} className="text-muted-foreground ml-1" />
              {txFilterOptions.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTxFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
                    txFilter === f.value
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow duration-200 hover:shadow-md">
            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-border">
              {filteredTx.map((tx) => (
                <div key={tx.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium ${TX_STATUS[tx.type]?.color || "text-foreground"}`}>
                      {TX_STATUS[tx.type]?.label || tx.type}
                    </span>
                    <span className="font-bold tabular-nums text-foreground" dir="ltr">
                      {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount)} ر.س
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{REASON_LABELS[tx.reason] || tx.reason}</span>
                    <span>{format(new Date(tx.created_at), "dd MMM yyyy", { locale: ar })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">النوع</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">السبب</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">المصدر</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">التاريخ</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">المبلغ</th>
                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-border/50 last:border-0 hover:bg-secondary/20 transition-colors group"
                      onMouseEnter={() => setHoveredRow(tx.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                          tx.type === "credit"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}>
                          {tx.type === "credit" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {TX_STATUS[tx.type]?.label || tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{REASON_LABELS[tx.reason] || tx.reason}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{tx.source}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(tx.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-foreground" dir="ltr">
                        <span className={tx.type === "credit" ? "text-success" : "text-destructive"}>
                          {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount)}
                        </span>
                        <span className="text-[10px] text-muted-foreground"> ر.س</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`transition-opacity duration-150 ${hoveredRow === tx.id ? "opacity-100" : "opacity-0"}`}>
                          <button className="p-1 rounded hover:bg-secondary transition-colors">
                            <Eye size={14} className="text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTx.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        لا توجد حركات مالية
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Topup Modal ── */}
      <Dialog open={showTopup} onOpenChange={(o) => { if (!o) resetTopup(); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة رصيد</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMethod("bank_transfer")}
                  className={`p-3 rounded-lg border-2 transition-all duration-150 flex items-center gap-2 ${
                    paymentMethod === "bank_transfer"
                      ? "border-accent bg-accent/5 shadow-sm"
                      : "border-border bg-card hover:bg-secondary/30"
                  }`}>
                  <Building2 size={18} className={paymentMethod === "bank_transfer" ? "text-accent" : "text-muted-foreground"} />
                  <span className={`text-sm font-medium ${paymentMethod === "bank_transfer" ? "text-accent" : "text-muted-foreground"}`}>تحويل بنكي</span>
                </button>
                <button onClick={() => setPaymentMethod("card")}
                  className={`p-3 rounded-lg border-2 transition-all duration-150 flex items-center gap-2 ${
                    paymentMethod === "card"
                      ? "border-accent bg-accent/5 shadow-sm"
                      : "border-border bg-card hover:bg-secondary/30"
                  }`}>
                  <CreditCard size={18} className={paymentMethod === "card" ? "text-accent" : "text-muted-foreground"} />
                  <span className={`text-sm font-medium ${paymentMethod === "card" ? "text-accent" : "text-muted-foreground"}`}>بطاقة / Apple Pay</span>
                </button>
              </div>
            </div>

            {/* Amount Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">المبلغ</label>
              <div className="grid grid-cols-3 gap-2">
                {TOPUP_AMOUNTS.map((amt) => (
                  <button key={amt} onClick={() => { setTopupAmount(amt); setCustomAmount(""); }}
                    className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-150 border ${
                      topupAmount === amt
                        ? "border-accent bg-accent/10 text-accent shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary/30"
                    }`}>
                    {amt.toLocaleString("ar-SA")} ر.س
                  </button>
                ))}
              </div>
              <Input
                type="number" min="1" max="50000" placeholder="أو أدخل مبلغ مخصص"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(0); }}
                dir="ltr" className="text-center"
              />
            </div>

            {/* Bank Transfer Details */}
            {paymentMethod === "bank_transfer" && finalAmount > 0 && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground mb-2">معلومات الحساب البنكي</p>
                  {[
                    { label: "رقم الآيبان (IBAN)", value: BANK_INFO.iban },
                    { label: "اسم البنك", value: BANK_INFO.bankName },
                    { label: "اسم المستفيد", value: BANK_INFO.beneficiary },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded-md bg-card border border-border/50">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">{item.label}</span>
                        <span className="text-sm text-foreground">{item.value}</span>
                      </div>
                      <button onClick={() => copyToClipboard(item.value, item.label)} className="p-1.5 rounded hover:bg-secondary transition-colors">
                        <Copy size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <div className="p-2 rounded-md bg-accent/5 border border-accent/20 text-center">
                    <span className="text-[10px] text-muted-foreground block">المبلغ المطلوب تحويله</span>
                    <span className="text-lg font-bold text-accent">{finalAmount.toLocaleString("ar-SA")} ر.س</span>
                  </div>
                </div>
                <Input
                  placeholder="رقم مرجع التحويل (اختياري)"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  dir="ltr"
                />
                <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 ${
                  receiptFile ? "border-accent bg-accent/5" : "border-border hover:border-muted-foreground/30"
                }`}>
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) { toast.error("حجم الملف يجب أن لا يتجاوز 5 ميجابايت"); return; }
                        setReceiptFile(file);
                      }
                    }} />
                  {receiptFile ? (
                    <><CheckCircle2 size={24} className="text-accent" /><p className="text-sm font-medium text-accent">{receiptFile.name}</p></>
                  ) : (
                    <><Upload size={24} className="text-muted-foreground" /><p className="text-sm text-muted-foreground">رفع إيصال التحويل *</p></>
                  )}
                </label>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
                  <AlertCircle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning leading-relaxed">سيتم مراجعة الإيصال وتأكيد الرصيد خلال 24 ساعة عمل.</p>
                </div>
              </div>
            )}

            {paymentMethod === "card" && finalAmount > 0 && (
              <div className="rounded-lg border border-border bg-secondary/20 p-6 text-center space-y-2">
                <CreditCard size={32} className="text-muted-foreground mx-auto" />
                <p className="text-lg font-bold text-foreground">{finalAmount.toLocaleString("ar-SA")} ر.س</p>
                <p className="text-sm text-muted-foreground">سيتم تحويلك لصفحة الدفع الآمنة</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetTopup}>إلغاء</Button>
            <Button
              onClick={handleTopup}
              disabled={topupLoading || finalAmount <= 0 || (paymentMethod === "bank_transfer" && !receiptFile)}
            >
              {topupLoading ? (
                <><Loader2 size={16} className="animate-spin ml-1" />{uploadingReceipt ? "جاري رفع الإيصال..." : "جاري الإرسال..."}</>
              ) : (
                finalAmount > 0 ? `إرسال طلب — ${finalAmount.toLocaleString("ar-SA")} ر.س` : "اختر المبلغ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ripple keyframes */}
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(12); opacity: 0; }
        }
        @keyframes wallet-ripple {
          0% { transform: scale(1); opacity: 0.15; }
          100% { transform: scale(8); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default WalletPage;
