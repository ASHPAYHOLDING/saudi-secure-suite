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
  Download, MoreHorizontal, CircleDollarSign, Calendar,
  FileSpreadsheet, ArrowDown,
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Reduced motion detection ──
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// ── Animated Counter Hook ──
function useAnimatedNumber(target: number, duration = 300, reducedMotion = false) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (reducedMotion) { setDisplay(target); return; }
    const start = isFirstRun.current ? 0 : display;
    isFirstRun.current = false;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, reducedMotion]);

  return display;
}

// ── Debit shake hook ──
function useDebitShake(balance: number, reducedMotion: boolean) {
  const [shaking, setShaking] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const prevRef = useRef(balance);
  useEffect(() => {
    if (reducedMotion) { prevRef.current = balance; return; }
    if (prevRef.current > balance && prevRef.current !== 0) {
      setShaking(true); setFlashRed(true);
      setTimeout(() => setShaking(false), 40);
      setTimeout(() => setFlashRed(false), 300);
    }
    prevRef.current = balance;
  }, [balance, reducedMotion]);
  return { shaking, flashRed };
}

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] as const } },
};

// ── Ripple Button ──
const RippleButton = ({ children, onClick, disabled, className = "", ...props }: React.ComponentProps<typeof Button>) => {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 500);
    onClick?.(e);
  };
  return (
    <Button onClick={handleClick} disabled={disabled} className={`relative overflow-hidden ${className}`} {...props}>
      {children}
      {ripples.map(r => (
        <span key={r.id} className="absolute rounded-full bg-primary-foreground/20 animate-[ripple_0.5s_ease-out]"
          style={{ left: r.x - 10, top: r.y - 10, width: 20, height: 20 }} />
      ))}
    </Button>
  );
};

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
  balance_before: number | null;
  balance_after: number | null;
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

const formatAmount = (n: number) => n.toLocaleString("ar-SA");

const WalletPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [prevBalance, setPrevBalance] = useState<number>(0);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Ledger filters
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [dateRange, setDateRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

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

  const animatedBalance = useAnimatedNumber(wallet?.balance_available || 0, 300, reducedMotion);
  const animatedPending = useAnimatedNumber(wallet?.balance_pending || 0, 300, reducedMotion);
  const balanceChange = wallet ? wallet.balance_available - prevBalance : 0;
  const { shaking, flashRed } = useDebitShake(wallet?.balance_available || 0, reducedMotion);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data: w } = await supabase
      .from("tenant_wallets").select("*").eq("tenant_id", tenantId).maybeSingle();

    if (w) {
      setPrevBalance(wallet?.balance_available || w.balance_available);
      setWallet(w);
      const [{ data: txs }, { data: reqs }] = await Promise.all([
        supabase.from("wallet_transactions").select("*").eq("wallet_id", w.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("wallet_topup_requests").select("*").eq("wallet_id", w.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setTransactions(txs || []);
      setTopupRequests((reqs as TopupRequest[]) || []);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("wallet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_wallets", filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        if (payload.new) { setPrevBalance(wallet?.balance_available || 0); setWallet(payload.new as WalletData); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wallet_transactions" }, (payload) => {
        if (payload.new) {
          const newTx = payload.new as WalletTransaction;
          setTransactions((prev) => [newTx, ...prev].slice(0, 100));
          setNewTxIds(prev => new Set(prev).add(newTx.id));
          setTimeout(() => setNewTxIds(prev => { const s = new Set(prev); s.delete(newTx.id); return s; }), 600);
        }
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

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let result = transactions;
    if (txFilter !== "all") result = result.filter(t => t.type === txFilter);
    if (reasonFilter !== "all") result = result.filter(t => t.reason === reasonFilter);
    if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(t => new Date(t.created_at) >= cutoff);
    }
    return result;
  }, [transactions, txFilter, dateRange, reasonFilter]);

  // Ledger totals
  const ledgerTotals = useMemo(() => {
    const totalCredit = filteredTx.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalDebit = filteredTx.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    return { totalCredit, totalDebit, count: filteredTx.length };
  }, [filteredTx]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  // ── Export CSV ──
  const exportCSV = () => {
    if (filteredTx.length === 0) { toast.info("لا توجد حركات للتصدير"); return; }
    const header = "التاريخ,الوصف,المرجع,مدين,دائن,الرصيد بعد العملية";
    const rows = filteredTx.map(t => {
      const date = format(new Date(t.created_at), "yyyy-MM-dd HH:mm");
      const desc = REASON_LABELS[t.reason] || t.reason;
      const ref = t.reference_type || "-";
      const debit = t.type === "debit" ? t.amount : "";
      const credit = t.type === "credit" ? t.amount : "";
      const bal = t.balance_after ?? "-";
      return `${date},${desc},${ref},${debit},${credit},${bal}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `wallet-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    toast.success("تم تصدير كشف الحساب");
  };

  // ── Topup ──
  const handleTopup = async () => {
    if (finalAmount <= 0) { toast.error("يرجى إدخال مبلغ صالح"); return; }
    if (paymentMethod === "card") {
      setTopupLoading(true);
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=topup`,
          { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ amount: finalAmount }) }
        );
        const result = await res.json();
        if (!res.ok || result.error) { toast.error(result.error || "فشل إنشاء رابط الدفع"); return; }
        if (result.paymentUrl) { toast.success("جاري التحويل لصفحة الدفع..."); window.open(result.paymentUrl, "_blank"); resetTopup(); }
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
        { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ amount: finalAmount, bankReference, receiptUrl: urlData.publicUrl || uploadData.path, receiptFilename: receiptFile.name }) }
      );
      const result = await res.json();
      if (!res.ok || result.error) { toast.error(result.error || "فشل إرسال الطلب"); return; }
      toast.success("تم إرسال طلب الشحن بنجاح", { description: "سيتم مراجعة الإيصال وإضافة الرصيد خلال 24 ساعة" });
      resetTopup(); fetchData();
    } catch { toast.error("حدث خطأ — يرجى المحاولة مرة أخرى"); }
    finally { setTopupLoading(false); setUploadingReceipt(false); }
  };

  const resetTopup = () => {
    setShowTopup(false); setTopupAmount(0); setCustomAmount("");
    setBankReference(""); setReceiptFile(null); setPaymentMethod("bank_transfer");
  };

  // ── Loading ──
  if (loading) {
    return (
      <div dir="rtl" className="space-y-5 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
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

  return (
    <div dir="rtl" className="space-y-5 p-4 sm:p-6 relative">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.02) 0%, transparent 60%)" }} />

      <div className="relative space-y-5">

        {/* ═══ HEADER: Stats Row ═══ */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">كشف حساب المحفظة</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Banking Ledger</p>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            {/* Available Balance */}
            <div className={`rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group ${shaking ? "animate-[debit-shake_40ms_ease-in-out]" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">الرصيد المتاح</p>
                <WalletBalanceIcon size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
              <p className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${flashRed ? "text-destructive" : "text-foreground"}`} dir="ltr">
                {formatAmount(animatedBalance)}
                <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>
              </p>
              <AnimatePresence>
                {balanceChange !== 0 && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-1 mt-2 text-xs font-medium ${balanceChange > 0 ? "text-success" : "text-destructive"}`}>
                    {balanceChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    <span>{balanceChange > 0 ? "+" : ""}{formatAmount(balanceChange)} ر.س</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Pending Balance */}
            <div className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">الرصيد المعلّق</p>
                <MicroIcon icon={Clock} size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" rotateDir={-1} />
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums" dir="ltr">
                {formatAmount(animatedPending)}
                <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>
              </p>
            </div>

            {/* Status */}
            <div className="rounded-xl border border-border bg-card p-5 transition-shadow duration-200 hover:shadow-md group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">حالة المحفظة</p>
                {wallet.status === "frozen" || wallet.status === "suspended"
                  ? <WalletFreezeIcon size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  : <WalletShieldIcon size={18} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                }
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ ACTION BAR ═══ */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible"
          className="flex flex-wrap items-center gap-2 py-3 px-4 rounded-xl border border-border bg-card"
        >
          <RippleButton onClick={() => setShowTopup(true)} className="gap-2" size="sm">
            <Plus size={14} />
            إضافة رصيد
          </RippleButton>
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <ArrowDown size={14} />
            سحب
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="gap-2" onClick={exportCSV}>
            <FileSpreadsheet size={14} />
            تصدير Excel
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={exportCSV}>
            <FileText size={14} />
            تصدير PDF
          </Button>
        </motion.div>

        {/* Pending Topup Requests */}
        {topupRequests.filter(r => r.status === "pending").length > 0 && (
          <motion.div variants={sectionVariants} initial="hidden" animate="visible"
            className="rounded-xl border border-warning/20 bg-warning/5 p-4 space-y-2"
          >
            <h3 className="text-xs font-semibold text-warning flex items-center gap-1.5">
              <Clock size={13} /> طلبات شحن معلقة
            </h3>
            {topupRequests.filter(r => r.status === "pending").map(req => (
              <div key={req.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={TOPUP_STATUS[req.status].color}>{TOPUP_STATUS[req.status].label}</Badge>
                  <span className="font-bold text-foreground tabular-nums text-sm">{formatAmount(req.amount)} ر.س</span>
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(req.created_at), "dd MMM yyyy", { locale: ar })}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ═══ LEDGER TABLE ═══ */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible" className="space-y-3">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">فلترة:</span>
            </div>
            <Select value={txFilter} onValueChange={(v) => setTxFilter(v as any)}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العمليات</SelectItem>
                <SelectItem value="credit">إيداع (دائن)</SelectItem>
                <SelectItem value="debit">خصم (مدين)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="subscription">اشتراك</SelectItem>
                <SelectItem value="integration">تكامل</SelectItem>
                <SelectItem value="topup">شحن</SelectItem>
                <SelectItem value="refund">استرداد</SelectItem>
                <SelectItem value="payout">سحب</SelectItem>
                <SelectItem value="manual">يدوي</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفترات</SelectItem>
                <SelectItem value="7d">آخر 7 أيام</SelectItem>
                <SelectItem value="30d">آخر 30 يوم</SelectItem>
                <SelectItem value="90d">آخر 90 يوم</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">{ledgerTotals.count} عملية</span>
          </div>

          {/* Ledger Summary Bar */}
          <div className="flex items-center gap-6 px-4 py-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">إجمالي الدائن:</span>
              <span className="font-bold text-success tabular-nums" dir="ltr">+{formatAmount(ledgerTotals.totalCredit)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">إجمالي المدين:</span>
              <span className="font-bold text-destructive tabular-nums" dir="ltr">-{formatAmount(ledgerTotals.totalDebit)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">الصافي:</span>
              <span className={`font-bold tabular-nums ${ledgerTotals.totalCredit - ledgerTotals.totalDebit >= 0 ? "text-success" : "text-destructive"}`} dir="ltr">
                {formatAmount(ledgerTotals.totalCredit - ledgerTotals.totalDebit)}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-border/50">
              {filteredTx.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">لا توجد حركات مالية</div>
              )}
              {filteredTx.map((tx) => (
                <div key={tx.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "dd/MM/yyyy HH:mm", { locale: ar })}</span>
                    <span className={`font-bold tabular-nums text-sm ${tx.type === "credit" ? "text-success" : "text-destructive"}`} dir="ltr">
                      {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{REASON_LABELS[tx.reason] || tx.reason}</span>
                    {tx.balance_after != null && (
                      <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">الرصيد: {formatAmount(tx.balance_after)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Ledger */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">التاريخ</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">الوصف</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">المرجع</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">مدين</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">دائن</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => {
                    const isNew = newTxIds.has(tx.id);
                    return (
                      <tr key={tx.id}
                        className={`border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors ${
                          isNew && !reducedMotion ? "animate-[tx-slide-in_160ms_ease-out]" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ar })}
                          <span className="block text-[10px] text-muted-foreground/60">{format(new Date(tx.created_at), "HH:mm")}</span>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          <span className="text-sm">{REASON_LABELS[tx.reason] || tx.reason}</span>
                          <span className="block text-[10px] text-muted-foreground">{tx.source}</span>
                        </td>
                        <td className="px-4 py-3">
                          {tx.reference_id ? (
                            <button className="text-xs text-primary hover:underline underline-offset-2 transition-colors font-mono">
                              {tx.reference_type}#{tx.reference_id.slice(0, 8)}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-left" dir="ltr">
                          {tx.type === "debit" ? (
                            <span className="text-destructive font-medium">{formatAmount(tx.amount)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-left" dir="ltr">
                          {tx.type === "credit" ? (
                            <span className="text-success font-medium">{formatAmount(tx.amount)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-left font-medium text-foreground" dir="ltr">
                          {tx.balance_after != null ? (
                            <>{formatAmount(tx.balance_after)} <span className="text-[10px] text-muted-foreground">ر.س</span></>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTx.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-muted-foreground text-sm">
                        لا توجد حركات مالية مطابقة للفلتر
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Ledger Footer Totals */}
                {filteredTx.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground">الإجمالي</td>
                      <td className="px-4 py-3 tabular-nums text-left font-bold text-destructive" dir="ltr">
                        {formatAmount(ledgerTotals.totalDebit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-left font-bold text-success" dir="ltr">
                        {formatAmount(ledgerTotals.totalCredit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-left font-bold text-foreground" dir="ltr">
                        {wallet ? formatAmount(wallet.balance_available) : "—"} <span className="text-[10px] text-muted-foreground font-normal">ر.س</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">طريقة الدفع</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPaymentMethod("bank_transfer")}
                  className={`p-3 rounded-lg border-2 transition-all duration-150 flex items-center gap-2 ${
                    paymentMethod === "bank_transfer" ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-secondary/30"
                  }`}>
                  <Building2 size={18} className={paymentMethod === "bank_transfer" ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-sm font-medium ${paymentMethod === "bank_transfer" ? "text-primary" : "text-muted-foreground"}`}>تحويل بنكي</span>
                </button>
                <button onClick={() => setPaymentMethod("card")}
                  className={`p-3 rounded-lg border-2 transition-all duration-150 flex items-center gap-2 ${
                    paymentMethod === "card" ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:bg-secondary/30"
                  }`}>
                  <CreditCard size={18} className={paymentMethod === "card" ? "text-primary" : "text-muted-foreground"} />
                  <span className={`text-sm font-medium ${paymentMethod === "card" ? "text-primary" : "text-muted-foreground"}`}>بطاقة / Apple Pay</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">المبلغ</label>
              <div className="grid grid-cols-3 gap-2">
                {TOPUP_AMOUNTS.map((amt) => (
                  <button key={amt} onClick={() => { setTopupAmount(amt); setCustomAmount(""); }}
                    className={`py-2.5 rounded-lg text-sm font-bold transition-all duration-150 border ${
                      topupAmount === amt ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:bg-secondary/30"
                    }`}>
                    {amt.toLocaleString("ar-SA")} ر.س
                  </button>
                ))}
              </div>
              <Input type="number" min="1" max="50000" placeholder="أو أدخل مبلغ مخصص" value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(0); }} dir="ltr" className="text-center" />
            </div>
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
                  <div className="p-2 rounded-md bg-primary/5 border border-primary/20 text-center">
                    <span className="text-[10px] text-muted-foreground block">المبلغ المطلوب تحويله</span>
                    <span className="text-lg font-bold text-primary">{finalAmount.toLocaleString("ar-SA")} ر.س</span>
                  </div>
                </div>
                <Input placeholder="رقم مرجع التحويل (اختياري)" value={bankReference} onChange={(e) => setBankReference(e.target.value)} dir="ltr" />
                <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 ${
                  receiptFile ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}>
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 5 * 1024 * 1024) { toast.error("حجم الملف يجب أن لا يتجاوز 5 ميجابايت"); return; } setReceiptFile(file); } }} />
                  {receiptFile ? (
                    <><CheckCircle2 size={24} className="text-primary" /><p className="text-sm font-medium text-primary">{receiptFile.name}</p></>
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
            <Button onClick={handleTopup} disabled={topupLoading || finalAmount <= 0 || (paymentMethod === "bank_transfer" && !receiptFile)}>
              {topupLoading ? (
                <><Loader2 size={16} className="animate-spin ml-1" />{uploadingReceipt ? "جاري رفع الإيصال..." : "جاري الإرسال..."}</>
              ) : (
                finalAmount > 0 ? `إرسال طلب — ${finalAmount.toLocaleString("ar-SA")} ر.س` : "اختر المبلغ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Keyframes */}
      <style>{`
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(12); opacity: 0; } }
        @keyframes debit-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes tx-slide-in { 0% { opacity: 0; transform: translateX(-12px); } 100% { opacity: 1; transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
};

export default WalletPage;
