import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, TrendingDown, ArrowDownToLine,
  Receipt, ChevronLeft, DollarSign, Percent, Clock,
  CheckCircle2, XCircle, Bell, Download, Loader2,
  BanknoteIcon, Send, Settings2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { usePaylinkData } from "@/hooks/usePaylinkData";
import { supabase } from "@/integrations/supabase/client";
import PayoutSettings from "@/components/paylink/PayoutSettings";

const NumaxioPayDashboard = () => {
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const { transactions, stats, loading, refetch, calculateFee, feeConfig } = usePaylinkData(tenantId ?? undefined);

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "payouts">("overview");

  // Fee preview for withdrawal
  const withdrawPreview = useMemo(() => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return null;
    return { amount, fee: 0, net: amount }; // Withdrawals have no fee
  }, [withdrawAmount]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (amount > stats.availableBalance) {
      toast.error("المبلغ المطلوب يتجاوز الرصيد المتاح");
      return;
    }
    if (!tenantId) return;

    setIsWithdrawing(true);
    const txNum = `TXN-W${Date.now().toString().slice(-6)}`;

    const { error } = await supabase.from("paylink_transactions").insert({
      tenant_id: tenantId,
      transaction_number: txNum,
      transaction_type: "withdrawal",
      description: "سحب إلى الحساب البنكي",
      gross_amount: amount,
      fee_amount: 0,
      net_amount: amount,
      status: "completed",
      payment_method: "تحويل بنكي",
      created_by: user?.id,
    });

    setIsWithdrawing(false);
    if (error) {
      toast.error("حدث خطأ أثناء السحب");
    } else {
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      toast.success(`✅ تم طلب سحب ${amount.toLocaleString("ar-SA")} ر.س بنجاح.`);
      refetch();
    }
  };

  const filteredTransactions = transactions.filter(
    (t) => filterType === "all" || t.transaction_type === filterType
  );

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";

  const kpis = [
    { label: "إجمالي المبيعات", value: stats.totalSales, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
    { label: "المبالغ المعلّقة", value: stats.pendingAmount, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "إجمالي الرسوم", value: stats.totalFees, icon: Percent, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "صافي المبلغ", value: stats.netAmount, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
  ];

  // Recent notifications from transactions
  const recentNotifications = transactions.slice(0, 4).map((tx) => ({
    id: tx.id,
    message: tx.transaction_type === "deposit"
      ? `تم إيداع ${formatCurrency(tx.gross_amount)} - ${tx.description || ""}`
      : tx.transaction_type === "withdrawal"
        ? `تم سحب ${formatCurrency(tx.gross_amount)} إلى حسابك البنكي`
        : tx.description || "",
    time: new Date(tx.created_at).toLocaleDateString("ar-SA"),
    type: tx.status === "failed" ? "failed" : tx.transaction_type,
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Wallet className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">نيوماكسيو باي</h1>
              <p className="text-xs text-muted-foreground">لوحة تحكم المدفوعات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowNotifications(!showNotifications)} className="relative">
                <Bell className="w-5 h-5" />
                {recentNotifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                    {recentNotifications.length}
                  </span>
                )}
              </Button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 top-12 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <h4 className="text-sm font-bold text-foreground">الإشعارات</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {recentNotifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
                      ) : recentNotifications.map((n) => (
                        <div key={n.id} className="p-3 border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              n.type === "deposit" ? "bg-success/10" : n.type === "withdrawal" ? "bg-info/10" : "bg-destructive/10"
                            }`}>
                              {n.type === "deposit" ? <TrendingUp className="w-3 h-3 text-success" /> :
                               n.type === "withdrawal" ? <TrendingDown className="w-3 h-3 text-info" /> :
                               <XCircle className="w-3 h-3 text-destructive" />}
                            </div>
                            <div>
                              <p className="text-sm text-foreground">{n.message}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/numaxio-pay")}>إعدادات الربط</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1">
              رجوع <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Main Tabs */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5 w-fit">
          {([
            { key: "overview" as const, label: "نظرة عامة", icon: Receipt },
            { key: "payouts" as const, label: "التحويلات والإعدادات", icon: Send },
          ]).map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                activeTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {activeTab === "payouts" && <PayoutSettings />}

        {activeTab === "overview" && (<>
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                    <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">{formatCurrency(kpi.value)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Balance + Withdraw + Fee Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-accent/20 bg-gradient-to-l from-accent/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <BanknoteIcon className="w-7 h-7 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الرصيد المتاح للسحب</p>
                    <p className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">{formatCurrency(stats.availableBalance)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="text-xs">
                        نوع الرسوم: {feeConfig?.fee_type === "fixed" ? "مبلغ ثابت" : feeConfig?.fee_type === "combined" ? "مشترك" : "نسبة مئوية"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {feeConfig?.fee_type === "fixed"
                          ? `${feeConfig.fee_fixed_amount} ر.س لكل عملية`
                          : `${stats.feeRate}% لكل عملية`}
                        {feeConfig?.fee_type === "combined" && ` + ${feeConfig.fee_fixed_amount} ر.س`}
                      </span>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setShowWithdrawDialog(true)} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-6" size="lg">
                  <ArrowDownToLine className="w-5 h-5" /> سحب مبلغ
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transactions Table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-accent" /> سجل المعاملات
                  </CardTitle>
                  <CardDescription>جميع عمليات الإيداع والسحب مع تفاصيل الرسوم</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-muted rounded-lg p-0.5">
                    {([
                      { key: "all" as const, label: "الكل" },
                      { key: "deposit" as const, label: "إيداع" },
                      { key: "withdrawal" as const, label: "سحب" },
                    ]).map((f) => (
                      <button key={f.key} onClick={() => setFilterType(f.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          filterType === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}>{f.label}</button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1"><Download className="w-3.5 h-3.5" /> تصدير</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-semibold">رقم العملية</TableHead>
                      <TableHead className="text-right font-semibold">التاريخ</TableHead>
                      <TableHead className="text-right font-semibold">النوع</TableHead>
                      <TableHead className="text-right font-semibold">الوصف</TableHead>
                      <TableHead className="text-right font-semibold">طريقة الدفع</TableHead>
                      <TableHead className="text-right font-semibold">المبلغ</TableHead>
                      <TableHead className="text-right font-semibold">الرسوم</TableHead>
                      <TableHead className="text-right font-semibold">الصافي</TableHead>
                      <TableHead className="text-right font-semibold">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{tx.transaction_number}</TableCell>
                        <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${
                            tx.transaction_type === "deposit" ? "bg-success/10 text-success border-success/20" : "bg-info/10 text-info border-info/20"
                          }`}>{tx.transaction_type === "deposit" ? "إيداع" : "سحب"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tx.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.payment_method || "—"}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(tx.gross_amount)}</TableCell>
                        <TableCell className="text-sm text-destructive">{tx.fee_amount > 0 ? `-${formatCurrency(tx.fee_amount)}` : "—"}</TableCell>
                        <TableCell className="text-sm font-semibold text-accent">{formatCurrency(tx.net_amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${
                            tx.status === "completed" ? "text-success border-success/30" :
                            tx.status === "pending" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"
                          }`}>
                            {tx.status === "completed" ? <><CheckCircle2 className="w-3 h-3 ml-1" /> مكتمل</> :
                             tx.status === "pending" ? <><Clock className="w-3 h-3 ml-1" /> معلّق</> :
                             <><XCircle className="w-3 h-3 ml-1" /> فشل</>}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>لا توجد معاملات{filterType !== "all" ? " بهذا الفلتر" : " بعد"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        </>)}
      </main>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-accent" /> سحب مبلغ
            </DialogTitle>
            <DialogDescription>سيتم تحويل المبلغ إلى حسابك البنكي المرتبط خلال 1-3 أيام عمل.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-2xl font-bold text-accent font-[IBM_Plex_Sans_Arabic]">{formatCurrency(stats.availableBalance)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawAmount">المبلغ المراد سحبه (ر.س)</Label>
              <Input id="withdrawAmount" type="number" placeholder="أدخل المبلغ" value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)} className="text-lg font-semibold text-center" dir="ltr"
                min={1} max={stats.availableBalance} />
            </div>
            {withdrawPreview && withdrawPreview.amount > 0 && (
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">المبلغ المطلوب</span><span className="font-semibold">{formatCurrency(withdrawPreview.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">رسوم السحب</span><span className="text-success font-semibold">مجاني</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between"><span className="font-semibold">المبلغ المحوّل</span><span className="font-bold text-accent">{formatCurrency(withdrawPreview.net)}</span></div>
              </div>
            )}
            <Button variant="link" size="sm" className="text-accent p-0 h-auto"
              onClick={() => setWithdrawAmount(stats.availableBalance.toString())}>سحب الرصيد بالكامل</Button>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>إلغاء</Button>
            <Button onClick={handleWithdraw} disabled={isWithdrawing || !withdrawAmount}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              {isWithdrawing ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التنفيذ...</> :
                <><ArrowDownToLine className="w-4 h-4" /> تأكيد السحب</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NumaxioPayDashboard;
