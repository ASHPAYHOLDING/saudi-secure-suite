import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, CreditCard, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertTriangle, Clock, ExternalLink,
  BarChart3, Settings, Banknote
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WalletData {
  balance_available: number;
  balance_pending: number;
  currency: string;
  status: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  reason: string;
  source: string;
  created_at: string;
  balance_after: number;
}

interface GatewayInfo {
  name_ar: string;
  status: string;
  key: string;
}

const FinanceControlPanel = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [gateways, setGateways] = useState<GatewayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutPending, setPayoutPending] = useState(0);

  useEffect(() => {
    if (tenantId) fetchAll();
  }, [tenantId]);

  // Realtime wallet balance updates
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`wallet-settings-${tenantId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tenant_wallets",
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        if (payload.new) {
          setWallet(prev => prev ? { ...prev, ...payload.new } : null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchAll = async () => {
    setLoading(true);
    const [walletRes, txRes, gwRes, payoutRes] = await Promise.all([
      supabase
        .from("tenant_wallets")
        .select("balance_available, balance_pending, currency, status")
        .eq("tenant_id", tenantId!)
        .maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("id, type, amount, reason, source, created_at, balance_after")
        .eq("wallet_id", tenantId!) // wallet_id references tenant
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      (supabase as any)
        .from("tenant_paid_integrations")
        .select("status, paid_integrations!inner(key, name_ar, integration_type)")
        .eq("tenant_id", tenantId!),
      supabase
        .from("wallet_topup_requests" as any)
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("status", "pending"),
    ]);

    if (walletRes.data) setWallet(walletRes.data as WalletData);
    if (txRes.data) setTransactions(txRes.data as Transaction[]);

    // Extract payment gateways
    const gwList: GatewayInfo[] = [];
    (gwRes.data || []).forEach((row: any) => {
      const pi = row.paid_integrations;
      if (pi?.integration_type === "payment_gateway") {
        gwList.push({ name_ar: pi.name_ar, status: row.status, key: pi.key });
      }
    });
    setGateways(gwList);
    setPayoutPending((payoutRes as any)?.data?.length || 0);
    setLoading(false);
  };

  const formatAmount = (amount: number, currency = "SAR") => {
    return new Intl.NumberFormat("ar-SA", { style: "currency", currency }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getTypeIcon = (type: string) => {
    return type === "credit"
      ? <ArrowDownRight className="h-3.5 w-3.5 text-accent" />
      : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />;
  };

  const gatewayStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20 gap-1"><CheckCircle2 size={10} />مفعّل</Badge>;
    if (status === "pending") return <Badge className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200 gap-1"><Clock size={10} />معلّق</Badge>;
    return <Badge className="text-[10px] bg-muted text-muted-foreground border-border gap-1"><AlertTriangle size={10} />غير مفعّل</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          مركز التحكم المالي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Wallet Balance + Payout Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-4 bg-muted/30">
            <p className="text-[10px] text-muted-foreground mb-1">الرصيد المتاح</p>
            <p className="text-xl font-bold text-foreground font-mono" dir="ltr">
              {wallet ? formatAmount(wallet.balance_available, wallet.currency) : "—"}
            </p>
            {wallet && wallet.status !== "active" && (
              <Badge variant="destructive" className="text-[10px] mt-1">{wallet.status}</Badge>
            )}
          </div>
          <div className="rounded-xl border border-border p-4 bg-muted/30">
            <p className="text-[10px] text-muted-foreground mb-1">رصيد معلّق</p>
            <p className="text-lg font-semibold text-muted-foreground font-mono" dir="ltr">
              {wallet ? formatAmount(wallet.balance_pending, wallet.currency) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border p-4 bg-muted/30">
            <p className="text-[10px] text-muted-foreground mb-1">طلبات السحب</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-foreground">{payoutPending}</p>
              {payoutPending > 0 && (
                <Badge className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200">قيد المعالجة</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Gateway Status */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            بوابات الدفع
          </p>
          {gateways.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {gateways.map((gw) => (
                <div key={gw.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-muted/20">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{gw.name_ar}</span>
                  {gatewayStatusBadge(gw.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">لا توجد بوابات دفع مفعّلة</p>
            </div>
          )}
        </div>

        {/* Last 5 Transactions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            آخر المعاملات
          </p>
          {transactions.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              {transactions.map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between px-3 py-2.5 ${i < transactions.length - 1 ? "border-b border-border" : ""} bg-background hover:bg-muted/30 transition-colors`}
                >
                  <div className="flex items-center gap-2.5">
                    {getTypeIcon(tx.type)}
                    <div>
                      <p className="text-xs font-medium text-foreground">{tx.reason || tx.source || "معاملة"}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${tx.type === "credit" ? "text-accent" : "text-destructive"}`} dir="ltr">
                    {tx.type === "credit" ? "+" : "−"}{formatAmount(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">لا توجد معاملات بعد</p>
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/wallet")}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            سحب / إيداع
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/reports")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            التقارير المالية
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/dashboard/integrations")}
          >
            <Settings className="h-3.5 w-3.5" />
            إعدادات البوابات
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinanceControlPanel;
