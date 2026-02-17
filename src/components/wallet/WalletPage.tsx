import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingUp, Clock, CheckCircle2,
  XCircle, ArrowUpRight, ArrowDownRight, Receipt, Snowflake,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion } from "framer-motion";

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

const WalletPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

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

      <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-cyan-500/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">المحفظة</h1>
            <p className="text-sm text-white/40">إدارة الرصيد والمعاملات المالية</p>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <GlassCard delay={0.1}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/50">الرصيد المتاح</span>
              <div className="w-10 h-10 rounded-xl bg-teal-400/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {wallet.balance_available.toLocaleString("ar-SA")}
              <span className="text-base font-normal text-white/30 ms-2">{wallet.currency}</span>
            </p>
          </GlassCard>

          <GlassCard delay={0.2}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/50">الرصيد المعلّق</span>
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {wallet.balance_pending.toLocaleString("ar-SA")}
              <span className="text-base font-normal text-white/30 ms-2">{wallet.currency}</span>
            </p>
          </GlassCard>

          <GlassCard delay={0.3}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/50">حالة المحفظة</span>
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
              </div>
            </div>
            <Badge
              className={`${statusInfo.color} bg-white/[0.06] border border-white/10 text-sm px-4 py-1.5`}
            >
              {statusInfo.label}
            </Badge>
          </GlassCard>
        </div>

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
