import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, Clock, CheckCircle2, XCircle,
  ArrowDownToLine, Receipt, ChevronLeft, DollarSign, Percent,
  Loader2, BanknoteIcon, CreditCard,
  Download, Send
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { usePaylinkData } from "@/hooks/usePaylinkData";
import { supabase } from "@/integrations/supabase/client";
import PayoutSettings from "@/components/paylink/PayoutSettings";
import KycVerificationForm from "@/components/paylink/KycVerificationForm";

const NumaxioPay = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const { transactions, stats, loading: dataLoading, refetch, feeConfig } = usePaylinkData(tenantId ?? undefined);

  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "payouts">("overview");

  // Check if paylink is enabled for this tenant
  const checkStatus = useCallback(async () => {
    if (!tenantId) return;
    setCheckingStatus(true);
    const { data } = await supabase
      .from("tenants")
      .select("paylink_enabled")
      .eq("id", tenantId)
      .single();
    setIsEnabled(data?.paylink_enabled ?? false);
    setCheckingStatus(false);
  }, [tenantId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

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

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const kpis = [
    { label: "إجمالي المبيعات", value: stats.totalSales, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
    { label: "المبالغ المعلّقة", value: stats.pendingAmount, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "إجمالي الرسوم", value: stats.totalFees, icon: Percent, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "صافي المبلغ", value: stats.netAmount, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className={embedded ? "bg-background" : "min-h-screen bg-background"} dir="rtl">
      {/* Header - only show when standalone */}
      {!embedded && (
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <Wallet className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">نيوماكسيو باي</h1>
                <p className="text-xs text-muted-foreground">
                  {isEnabled ? "لوحة تحكم المدفوعات" : "تفعيل بوابة الدفع"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1">
              رجوع
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </header>
      )}

      <main className={embedded ? "px-4 py-6" : "max-w-6xl mx-auto px-4 py-8"}>
        {/* === KYC VERIFICATION STATE === */}
        {!isEnabled && (
          <KycVerificationForm onActivated={() => { setIsEnabled(true); refetch(); }} />
        )}

        {/* === DASHBOARD STATE === */}
        {isEnabled && (
          <div className="space-y-6">
            {/* Admin-linked message */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-accent/5 border border-accent/20">
                <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">بوابة الدفع مفعّلة ومربوطة بإدارة النظام</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    كل المدفوعات الواردة تصل مباشرة إلى النظام ويتم خصم الرسوم تلقائياً. يمكنك سحب رصيدك في أي وقت.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
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

            {activeTab === "overview" && (
              <>
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

                {/* Balance + Withdraw */}
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
              </>
            )}
          </div>
        )}
      </main>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-accent" /> طلب سحب
            </DialogTitle>
            <DialogDescription>أدخل المبلغ المراد سحبه إلى حسابك البنكي</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-2xl font-bold text-accent font-[IBM_Plex_Sans_Arabic]">{formatCurrency(stats.availableBalance)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">مبلغ السحب (ر.س)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="text-lg font-semibold text-center"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>إلغاء</Button>
            <Button onClick={handleWithdraw} disabled={isWithdrawing} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              {isWithdrawing ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ السحب...</> : "تأكيد السحب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NumaxioPay;
