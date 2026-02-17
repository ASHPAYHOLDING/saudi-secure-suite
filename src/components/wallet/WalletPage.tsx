import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Wallet, Clock, CheckCircle2, Plus, Loader2,
  Upload, Copy, Building2, AlertCircle, Filter,
  CreditCard, Receipt, FileText, Zap,
  ArrowUpRight, ArrowDownRight, TrendingUp, Activity,
  FileSpreadsheet, ArrowDown, ShieldCheck, Info, BarChart3,
  Banknote, RefreshCw,
} from "lucide-react";
import {
  WalletBalanceIcon, WalletTopupIcon, WalletActivityIcon,
  WalletShieldIcon, WalletFreezeIcon, MicroIcon,
} from "@/components/wallet/WalletIcons";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
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

interface WalletData { id: string; balance_available: number; balance_pending: number; currency: string; status: string; }
interface WalletTransaction { id: string; type: string; amount: number; reason: string; reference_type: string; reference_id: string; source: string; created_at: string; balance_before: number | null; balance_after: number | null; }
interface TopupRequest { id: string; amount: number; status: string; payment_method: string; bank_reference: string | null; receipt_filename: string | null; rejection_reason: string | null; reviewed_at: string | null; created_at: string; }

const STATUS_MAP: Record<string, { label: string; color: string; dotColor: string; icon: typeof ShieldCheck }> = {
  active: { label: "نشطة", color: "bg-success/10 text-success border-success/20", dotColor: "bg-success", icon: ShieldCheck },
  frozen: { label: "مجمّدة", color: "bg-destructive/10 text-destructive border-destructive/20", dotColor: "bg-destructive", icon: Clock },
  suspended: { label: "موقوفة", color: "bg-warning/10 text-warning border-warning/20", dotColor: "bg-warning", icon: AlertCircle },
};

const REASON_LABELS: Record<string, string> = { subscription: "اشتراك", integration: "تكامل", refund: "استرداد", topup: "شحن رصيد", manual: "عملية يدوية", payout: "سحب" };
const REASON_ICONS: Record<string, typeof Receipt> = { subscription: Receipt, integration: Zap, refund: RefreshCw, topup: Banknote, manual: Activity, payout: ArrowDown };

const TOPUP_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-warning/10 text-warning border-warning/20" },
  approved: { label: "تمت الموافقة", color: "bg-success/10 text-success border-success/20" },
  rejected: { label: "مرفوض", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const BANK_INFO = { iban: "SA5345000000262359391004", bankName: "Alawwal Bank", beneficiary: "شركة علي صالح الشهري القابضة" };
const TOPUP_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];
const formatAmount = (n: number) => n.toLocaleString("ar-SA");

const WalletPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL, t } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [prevBalance, setPrevBalance] = useState<number>(0);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [newTxIds, setNewTxIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState<"all" | "credit" | "debit">("all");
  const [dateRange, setDateRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
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
    const { data: w } = await supabase.from("tenant_wallets").select("*").eq("tenant_id", tenantId).maybeSingle();
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
        if (payload.eventType === "INSERT" && payload.new) setTopupRequests((prev) => [payload.new as TopupRequest, ...prev].slice(0, 20));
        else if (payload.eventType === "UPDATE" && payload.new) setTopupRequests((prev) => prev.map(r => r.id === (payload.new as TopupRequest).id ? payload.new as TopupRequest : r));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, wallet?.balance_available]);

  const filteredTx = useMemo(() => {
    let result = transactions;
    if (txFilter !== "all") result = result.filter(t => t.type === txFilter);
    if (reasonFilter !== "all") result = result.filter(t => t.reason === reasonFilter);
    if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(t => new Date(t.created_at) >= cutoff);
    }
    return result;
  }, [transactions, txFilter, dateRange, reasonFilter]);

  const ledgerTotals = useMemo(() => {
    const totalCredit = filteredTx.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalDebit = filteredTx.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    return { totalCredit, totalDebit, count: filteredTx.length };
  }, [filteredTx]);

  // Usage analytics
  const usageStats = useMemo(() => {
    const debits = transactions.filter(t => t.type === "debit");
    const credits = transactions.filter(t => t.type === "credit");
    const byReason: Record<string, number> = {};
    debits.forEach(t => { byReason[t.reason] = (byReason[t.reason] || 0) + t.amount; });
    const totalSpent = debits.reduce((s, t) => s + t.amount, 0);
    const totalDeposited = credits.reduce((s, t) => s + t.amount, 0);
    return {
      subscriptions: byReason["subscription"] || 0,
      integrations: byReason["integration"] || 0,
      totalSpent,
      totalDeposited,
      totalOps: transactions.length,
      byReason,
    };
  }, [transactions]);

  const copyToClipboard = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`تم نسخ ${label}`); };

  const exportCSV = () => {
    if (filteredTx.length === 0) { toast.info("لا توجد حركات للتصدير"); return; }
    const header = "التاريخ,الوصف,المرجع,مدين,دائن,الرصيد بعد العملية";
    const rows = filteredTx.map(t => {
      const date = format(new Date(t.created_at), "yyyy-MM-dd HH:mm");
      return `${date},${REASON_LABELS[t.reason] || t.reason},${t.reference_type || "-"},${t.type === "debit" ? t.amount : ""},${t.type === "credit" ? t.amount : ""},${t.balance_after ?? "-"}`;
    });
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `wallet-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    toast.success("تم تصدير كشف الحساب");
  };

  const handleTopup = async () => {
    if (finalAmount <= 0) { toast.error("يرجى إدخال مبلغ صالح"); return; }
    if (paymentMethod === "card") {
      setTopupLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=topup`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ amount: finalAmount }) });
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
      const filePath = `${tenantId}/${Date.now()}.${receiptFile.name.split(".").pop()}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from("wallet-receipts").upload(filePath, receiptFile);
      if (uploadErr) { toast.error("فشل رفع الإيصال"); return; }
      setUploadingReceipt(false);
      const { data: urlData } = supabase.storage.from("wallet-receipts").getPublicUrl(uploadData.path);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-purchase?action=bank-transfer-topup`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: JSON.stringify({ amount: finalAmount, bankReference, receiptUrl: urlData.publicUrl || uploadData.path, receiptFilename: receiptFile.name }) });
      const result = await res.json();
      if (!res.ok || result.error) { toast.error(result.error || "فشل إرسال الطلب"); return; }
      toast.success("تم إرسال طلب الشحن بنجاح", { description: "سيتم مراجعة الإيصال وإضافة الرصيد خلال 24 ساعة" });
      resetTopup(); fetchData();
    } catch { toast.error("حدث خطأ — يرجى المحاولة مرة أخرى"); }
    finally { setTopupLoading(false); setUploadingReceipt(false); }
  };

  const resetTopup = () => { setShowTopup(false); setTopupAmount(0); setCustomAmount(""); setBankReference(""); setReceiptFile(null); setPaymentMethod("bank_transfer"); };

  if (loading) {
    return (
      <div dir="rtl" className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Wallet className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">لا توجد محفظة مفعّلة</h2>
        <p className="text-sm text-muted-foreground max-w-sm">يرجى التواصل مع الدعم الفني لتفعيل المحفظة الرقمية والبدء بإدارة أرصدتك.</p>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[wallet.status] || STATUS_MAP.active;

  // Spending breakdown for visual bars
  const spendingCategories = Object.entries(usageStats.byReason)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  const maxSpend = spendingCategories.length > 0 ? spendingCategories[0][1] : 1;

  return (
    <div dir="rtl" className="space-y-6 p-4 sm:p-6">

      {/* ═══ HEADER ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
            المحفظة الرقمية
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            كشف الحساب وإدارة الأرصدة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">تصدير كشف</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowTopup(true)}>
            <Plus className="w-4 h-4" />
            إضافة رصيد
          </Button>
        </div>
      </motion.div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "الرصيد المتاح",
            value: animatedBalance,
            isCurrency: true,
            icon: Wallet,
            bg: "bg-accent/10",
            iconColor: "text-accent",
            change: balanceChange,
            shake: shaking,
            flash: flashRed,
          },
          {
            label: "الرصيد المعلّق",
            value: animatedPending,
            isCurrency: true,
            icon: Clock,
            bg: "bg-warning/10",
            iconColor: "text-warning",
          },
          {
            label: "إجمالي الإيداعات",
            value: usageStats.totalDeposited,
            isCurrency: true,
            icon: ArrowUpRight,
            bg: "bg-success/10",
            iconColor: "text-success",
            sub: `${transactions.filter(t => t.type === "credit").length} عملية`,
          },
          {
            label: "إجمالي المصروفات",
            value: usageStats.totalSpent,
            isCurrency: true,
            icon: ArrowDownRight,
            bg: "bg-destructive/10",
            iconColor: "text-destructive",
            sub: `${transactions.filter(t => t.type === "debit").length} عملية`,
          },
        ].map((kpi, i) => (
          <motion.div key={kpi.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
          >
            <Card className={`border border-border/60 hover:shadow-md transition-all duration-200 ${kpi.shake ? "animate-[debit-shake_40ms_ease-in-out]" : ""}`}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                  <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.iconColor}`} />
                  </div>
                </div>
                <p className={`text-xl sm:text-2xl font-bold tabular-nums transition-colors duration-300 ${kpi.flash ? "text-destructive" : "text-foreground"}`} dir="ltr">
                  {formatAmount(kpi.value)}
                  {kpi.isCurrency && <span className="text-xs font-normal text-muted-foreground mr-1"> ر.س</span>}
                </p>
                {kpi.change != null && kpi.change !== 0 && (
                  <AnimatePresence>
                    <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className={`text-xs font-medium mt-1.5 flex items-center gap-0.5 ${kpi.change > 0 ? "text-success" : "text-destructive"}`}>
                      {kpi.change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {kpi.change > 0 ? "+" : ""}{formatAmount(kpi.change)} ر.س
                    </motion.p>
                  </AnimatePresence>
                )}
                {kpi.sub && <p className="text-[11px] text-muted-foreground mt-1.5">{kpi.sub}</p>}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ INLINE TOPUP SECTION ═══ */}
      <AnimatePresence>
        {showTopup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Card className="border-border/60 border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <WalletTopupIcon size={18} className="text-primary" />
                    إضافة رصيد
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={resetTopup}>
                    <span className="text-lg leading-none">✕</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Payment Method Tabs */}
                <div className="flex gap-2">
                  <Button
                    variant={paymentMethod === "bank_transfer" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 flex-1"
                    onClick={() => setPaymentMethod("bank_transfer")}
                  >
                    <Building2 className="w-4 h-4" />
                    تحويل بنكي
                  </Button>
                  <Button
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 flex-1"
                    onClick={() => setPaymentMethod("card")}
                  >
                    <CreditCard className="w-4 h-4" />
                    بطاقة دفع
                  </Button>
                </div>

                {/* Amount Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-foreground">اختر المبلغ</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {TOPUP_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => { setTopupAmount(amt); setCustomAmount(""); }}
                        className={`py-2.5 px-2 rounded-xl text-sm font-bold border transition-all ${
                          topupAmount === amt
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card border-border/60 text-foreground hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        {formatAmount(amt)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="مبلغ مخصص..."
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setTopupAmount(0); }}
                      className="h-9 text-sm"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">ر.س</span>
                  </div>
                </div>

                {/* Bank Transfer Details */}
                {paymentMethod === "bank_transfer" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="border-border/40">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 size={13} className="text-muted-foreground" />
                          بيانات الحساب البنكي
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">IBAN</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-foreground text-[11px]">{BANK_INFO.iban}</span>
                              <button onClick={() => copyToClipboard(BANK_INFO.iban, "IBAN")} className="text-primary hover:text-primary/80">
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">البنك</span>
                            <span className="font-medium text-foreground">{BANK_INFO.bankName}</span>
                          </div>
                          <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30">
                            <span className="text-muted-foreground">المستفيد</span>
                            <span className="font-medium text-foreground text-[11px]">{BANK_INFO.beneficiary}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/40">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Upload size={13} className="text-muted-foreground" />
                          رفع إيصال التحويل
                        </p>
                        <Input
                          placeholder="رقم مرجع التحويل"
                          value={bankReference}
                          onChange={(e) => setBankReference(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <label className="flex flex-col items-center justify-center py-4 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                          {receiptFile ? (
                            <div className="text-center">
                              <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1" />
                              <span className="text-xs font-medium text-foreground">{receiptFile.name}</span>
                            </div>
                          ) : (
                            <div className="text-center">
                              <Upload className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                              <span className="text-xs text-muted-foreground">اختر ملف الإيصال</span>
                            </div>
                          )}
                          <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && setReceiptFile(e.target.files[0])} />
                        </label>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Submit */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="text-sm">
                    المبلغ: <span className="font-bold text-foreground">{formatAmount(finalAmount)} ر.س</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetTopup}>إلغاء</Button>
                    <Button size="sm" onClick={handleTopup} disabled={topupLoading || finalAmount <= 0} className="gap-1.5">
                      {topupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {uploadingReceipt ? "جاري الرفع..." : paymentMethod === "card" ? "الدفع الآن" : "إرسال الطلب"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ INSIGHTS ROW ═══ */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Wallet Status Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="h-full border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                حالة المحفظة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${statusInfo.color} flex items-center justify-center`}>
                  {wallet.status === "active" ? <WalletShieldIcon size={20} /> : <WalletFreezeIcon size={20} />}
                </div>
                <div>
                  <Badge variant="outline" className={`${statusInfo.color} text-sm`}>{statusInfo.label}</Badge>
                  <p className="text-[11px] text-muted-foreground mt-1">آخر نشاط: {transactions[0] ? format(new Date(transactions[0].created_at), "dd MMM yyyy", { locale: ar }) : "—"}</p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">إجمالي العمليات</span>
                  <span className="font-bold text-foreground tabular-nums">{usageStats.totalOps}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">العملة</span>
                  <span className="font-medium text-foreground">ريال سعودي (SAR)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Spending Breakdown */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="h-full border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                توزيع المصروفات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {spendingCategories.length === 0 ? (
                <div className="text-center py-6">
                  <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">لا توجد مصروفات بعد</p>
                </div>
              ) : (
                spendingCategories.map(([reason, amount]) => {
                  const Icon = REASON_ICONS[reason] || Activity;
                  const pct = Math.round((amount / maxSpend) * 100);
                  return (
                    <div key={reason} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-foreground font-medium">
                          <Icon size={12} className="text-muted-foreground" />
                          {REASON_LABELS[reason] || reason}
                        </span>
                        <span className="text-muted-foreground tabular-nums" dir="ltr">{formatAmount(amount)} ر.س</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions + Pending Requests */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                إجراءات سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" onClick={() => setShowTopup(true)}>
                <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center"><Plus size={12} className="text-accent" /></div>
                إضافة رصيد
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" disabled>
                <div className="w-6 h-6 rounded-lg bg-info/10 flex items-center justify-center"><ArrowDown size={12} className="text-info" /></div>
                طلب سحب
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" onClick={exportCSV}>
                <div className="w-6 h-6 rounded-lg bg-success/10 flex items-center justify-center"><FileText size={12} className="text-success" /></div>
                تصدير كشف حساب
              </Button>

              {/* Inline pending requests */}
              {topupRequests.filter(r => r.status === "pending").length > 0 && (
                <div className="pt-2 mt-2 border-t border-border/50 space-y-1.5">
                  <p className="text-[11px] font-semibold text-warning flex items-center gap-1"><Clock size={11} /> طلبات معلقة</p>
                  {topupRequests.filter(r => r.status === "pending").slice(0, 3).map(req => (
                    <div key={req.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-warning/5 border border-warning/10 text-xs">
                      <span className="font-bold tabular-nums">{formatAmount(req.amount)} ر.س</span>
                      <span className="text-muted-foreground">{format(new Date(req.created_at), "dd/MM", { locale: ar })}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ LEDGER TABLE ═══ */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <WalletActivityIcon size={18} className="text-muted-foreground" />
                سجل الحركات المالية
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={txFilter} onValueChange={(v) => setTxFilter(v as any)}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العمليات</SelectItem>
                    <SelectItem value="credit">دائن</SelectItem>
                    <SelectItem value="debit">مدين</SelectItem>
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
                    <SelectItem value="7d">7 أيام</SelectItem>
                    <SelectItem value="30d">30 يوم</SelectItem>
                    <SelectItem value="90d">90 يوم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          {/* Ledger Summary */}
          <div className="mx-4 sm:mx-6 mb-4 flex flex-wrap items-center gap-4 sm:gap-6 px-4 py-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">الدائن:</span>
              <span className="font-bold text-success tabular-nums" dir="ltr">+{formatAmount(ledgerTotals.totalCredit)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">المدين:</span>
              <span className="font-bold text-destructive tabular-nums" dir="ltr">-{formatAmount(ledgerTotals.totalDebit)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">الصافي:</span>
              <span className={`font-bold tabular-nums ${ledgerTotals.totalCredit - ledgerTotals.totalDebit >= 0 ? "text-success" : "text-destructive"}`} dir="ltr">
                {formatAmount(ledgerTotals.totalCredit - ledgerTotals.totalDebit)}
              </span>
            </div>
            <div className="flex-1" />
            <span className="text-muted-foreground tabular-nums">{ledgerTotals.count} عملية</span>
          </div>

          <CardContent className="p-0">
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-border/40">
              {filteredTx.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">لا توجد حركات مالية</div>
              )}
              {filteredTx.map((tx) => {
                const Icon = REASON_ICONS[tx.reason] || Activity;
                return (
                  <div key={tx.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-success/10" : "bg-destructive/10"}`}>
                        <Icon size={14} className={tx.type === "credit" ? "text-success" : "text-destructive"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{REASON_LABELS[tx.reason] || tx.reason}</span>
                          <span className={`font-bold tabular-nums text-sm ${tx.type === "credit" ? "text-success" : "text-destructive"}`} dir="ltr">
                            {tx.type === "credit" ? "+" : "-"}{formatAmount(tx.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{format(new Date(tx.created_at), "dd MMM yyyy", { locale: ar })}</span>
                          {tx.balance_after != null && <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">الرصيد: {formatAmount(tx.balance_after)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-y border-border/40 bg-muted/20">
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground tracking-wide">التاريخ</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground tracking-wide">الوصف</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground tracking-wide">المرجع</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground tracking-wide">مدين</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground tracking-wide">دائن</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground tracking-wide">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx) => {
                    const isNew = newTxIds.has(tx.id);
                    const Icon = REASON_ICONS[tx.reason] || Activity;
                    return (
                      <tr key={tx.id} className={`border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors ${isNew && !reducedMotion ? "animate-[tx-slide-in_160ms_ease-out]" : ""}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {format(new Date(tx.created_at), "dd/MM/yyyy", { locale: ar })}
                          <span className="block text-[10px] text-muted-foreground/50">{format(new Date(tx.created_at), "HH:mm")}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tx.type === "credit" ? "bg-success/10" : "bg-destructive/10"}`}>
                              <Icon size={12} className={tx.type === "credit" ? "text-success" : "text-destructive"} />
                            </div>
                            <div>
                              <span className="text-sm text-foreground">{REASON_LABELS[tx.reason] || tx.reason}</span>
                              <span className="block text-[10px] text-muted-foreground">{tx.source}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {tx.reference_id ? (
                            <button className="text-xs text-primary hover:underline underline-offset-2 font-mono">{tx.reference_type}#{tx.reference_id.slice(0, 8)}</button>
                          ) : <span className="text-xs text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-left" dir="ltr">
                          {tx.type === "debit" ? <span className="text-destructive font-medium">{formatAmount(tx.amount)}</span> : <span className="text-muted-foreground/20">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-left" dir="ltr">
                          {tx.type === "credit" ? <span className="text-success font-medium">{formatAmount(tx.amount)}</span> : <span className="text-muted-foreground/20">—</span>}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-left font-medium text-foreground" dir="ltr">
                          {tx.balance_after != null ? <>{formatAmount(tx.balance_after)} <span className="text-[10px] text-muted-foreground">ر.س</span></> : <span className="text-muted-foreground/20">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTx.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center text-muted-foreground text-sm">لا توجد حركات مالية مطابقة</td></tr>
                  )}
                </tbody>
                {filteredTx.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-muted-foreground">الإجمالي</td>
                      <td className="px-4 py-3 tabular-nums text-left font-bold text-destructive" dir="ltr">{formatAmount(ledgerTotals.totalDebit)}</td>
                      <td className="px-4 py-3 tabular-nums text-left font-bold text-success" dir="ltr">{formatAmount(ledgerTotals.totalCredit)}</td>
                      <td className="px-4 py-3 tabular-nums text-left font-bold text-foreground" dir="ltr">{formatAmount(wallet.balance_available)} <span className="text-[10px] text-muted-foreground font-normal">ر.س</span></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>



      <style>{`
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(12); opacity: 0; } }
        @keyframes debit-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes tx-slide-in { 0% { opacity: 0; transform: translateX(-12px); } 100% { opacity: 1; transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>
    </div>
  );
};

export default WalletPage;
