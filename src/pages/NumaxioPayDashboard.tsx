import { useState } from "react";
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
  CheckCircle2, XCircle, AlertCircle, Bell, Filter,
  Download, Calendar, CreditCard, ArrowUpDown, Loader2,
  BanknoteIcon, Eye, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Mock data
const mockStats = {
  totalSales: 187450.00,
  pendingAmount: 23890.50,
  totalFees: 5623.50,
  netAmount: 157936.00,
  availableBalance: 42350.75,
  feeRate: 2.9,
};

const mockTransactions = [
  { id: "TXN-001284", date: "2026-02-17", type: "deposit", description: "دفع فاتورة #INV-0089", amount: 4500.00, fee: 130.50, net: 4369.50, status: "completed", method: "مدى" },
  { id: "TXN-001283", date: "2026-02-16", type: "deposit", description: "دفع فاتورة #INV-0088", amount: 12000.00, fee: 348.00, net: 11652.00, status: "completed", method: "Visa" },
  { id: "TXN-001282", date: "2026-02-16", type: "withdrawal", description: "سحب إلى الحساب البنكي", amount: 25000.00, fee: 0, net: 25000.00, status: "completed", method: "تحويل بنكي" },
  { id: "TXN-001281", date: "2026-02-15", type: "deposit", description: "دفع فاتورة #INV-0087", amount: 8750.00, fee: 253.75, net: 8496.25, status: "completed", method: "Apple Pay" },
  { id: "TXN-001280", date: "2026-02-15", type: "deposit", description: "دفع فاتورة #INV-0086", amount: 3200.00, fee: 92.80, net: 3107.20, status: "pending", method: "STC Pay" },
  { id: "TXN-001279", date: "2026-02-14", type: "withdrawal", description: "سحب إلى الحساب البنكي", amount: 15000.00, fee: 0, net: 15000.00, status: "completed", method: "تحويل بنكي" },
  { id: "TXN-001278", date: "2026-02-14", type: "deposit", description: "دفع فاتورة #INV-0085", amount: 6300.00, fee: 182.70, net: 6117.30, status: "completed", method: "Mastercard" },
  { id: "TXN-001277", date: "2026-02-13", type: "deposit", description: "دفع فاتورة #INV-0084", amount: 1890.00, fee: 54.81, net: 1835.19, status: "failed", method: "مدى" },
];

const mockNotifications = [
  { id: 1, message: "تم إيداع 4,500.00 ر.س من فاتورة #INV-0089", time: "منذ ساعة", type: "deposit" },
  { id: 2, message: "تم سحب 25,000.00 ر.س إلى حسابك البنكي", time: "منذ يوم", type: "withdrawal" },
  { id: 3, message: "تم إيداع 12,000.00 ر.س من فاتورة #INV-0088", time: "منذ يوم", type: "deposit" },
  { id: 4, message: "فشل عملية دفع بمبلغ 1,890.00 ر.س", time: "منذ 4 أيام", type: "failed" },
];

const NumaxioPayDashboard = () => {
  const navigate = useNavigate();
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all");

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (amount > mockStats.availableBalance) {
      toast.error("المبلغ المطلوب يتجاوز الرصيد المتاح");
      return;
    }
    setIsWithdrawing(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsWithdrawing(false);
    setShowWithdrawDialog(false);
    setWithdrawAmount("");
    toast.success(`✅ تم طلب سحب ${amount.toLocaleString("ar-SA")} ر.س بنجاح. سيتم التحويل خلال 1-3 أيام عمل.`);
  };

  const filteredTransactions = mockTransactions.filter(
    (t) => filterType === "all" || t.type === filterType
  );

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";

  const kpis = [
    { label: "إجمالي المبيعات", value: mockStats.totalSales, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
    { label: "المبالغ المستحقة", value: mockStats.pendingAmount, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "إجمالي الرسوم", value: mockStats.totalFees, icon: Percent, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "صافي المبلغ", value: mockStats.netAmount, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
  ];

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
            {/* Notification Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                  {mockNotifications.length}
                </span>
              </Button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 top-12 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-border">
                      <h4 className="text-sm font-bold text-foreground">الإشعارات</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {mockNotifications.map((n) => (
                        <div key={n.id} className="p-3 border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              n.type === "deposit" ? "bg-success/10" :
                              n.type === "withdrawal" ? "bg-info/10" : "bg-destructive/10"
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

            <Button variant="ghost" size="sm" onClick={() => navigate("/numaxio-pay")} className="gap-1">
              إعدادات الربط
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
              رجوع
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                    <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                    {formatCurrency(kpi.value)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Balance + Withdraw */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="border-accent/20 bg-gradient-to-l from-accent/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <BanknoteIcon className="w-7 h-7 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الرصيد المتاح للسحب</p>
                    <p className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                      {formatCurrency(mockStats.availableBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      نسبة الرسوم: <span className="font-semibold text-foreground">{mockStats.feeRate}%</span> لكل عملية
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowWithdrawDialog(true)}
                  className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-6"
                  size="lg"
                >
                  <ArrowDownToLine className="w-5 h-5" />
                  سحب مبلغ
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transactions Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-accent" />
                    سجل المعاملات
                  </CardTitle>
                  <CardDescription>جميع عمليات الإيداع والسحب</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-muted rounded-lg p-0.5">
                    {[
                      { key: "all" as const, label: "الكل" },
                      { key: "deposit" as const, label: "إيداع" },
                      { key: "withdrawal" as const, label: "سحب" },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilterType(f.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          filterType === f.key
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download className="w-3.5 h-3.5" />
                    تصدير
                  </Button>
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
                        <TableCell className="font-mono text-xs text-muted-foreground">{tx.id}</TableCell>
                        <TableCell className="text-sm">{tx.date}</TableCell>
                        <TableCell>
                          <Badge variant={tx.type === "deposit" ? "default" : "secondary"} className={`text-xs ${
                            tx.type === "deposit" ? "bg-success/10 text-success border-success/20" : "bg-info/10 text-info border-info/20"
                          }`}>
                            {tx.type === "deposit" ? "إيداع" : "سحب"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{tx.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.method}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(tx.amount)}</TableCell>
                        <TableCell className="text-sm text-destructive">
                          {tx.fee > 0 ? `-${formatCurrency(tx.fee)}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-accent">{formatCurrency(tx.net)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${
                            tx.status === "completed" ? "text-success border-success/30" :
                            tx.status === "pending" ? "text-warning border-warning/30" :
                            "text-destructive border-destructive/30"
                          }`}>
                            {tx.status === "completed" ? (
                              <><CheckCircle2 className="w-3 h-3 ml-1" /> مكتمل</>
                            ) : tx.status === "pending" ? (
                              <><Clock className="w-3 h-3 ml-1" /> معلّق</>
                            ) : (
                              <><XCircle className="w-3 h-3 ml-1" /> فشل</>
                            )}
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
                  <p>لا توجد معاملات بهذا الفلتر</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-accent" />
              سحب مبلغ
            </DialogTitle>
            <DialogDescription>
              سيتم تحويل المبلغ إلى حسابك البنكي المرتبط خلال 1-3 أيام عمل.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-2xl font-bold text-accent font-[IBM_Plex_Sans_Arabic]">
                {formatCurrency(mockStats.availableBalance)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawAmount">المبلغ المراد سحبه (ر.س)</Label>
              <Input
                id="withdrawAmount"
                type="number"
                placeholder="أدخل المبلغ"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="text-lg font-semibold text-center"
                dir="ltr"
                min={1}
                max={mockStats.availableBalance}
              />
            </div>
            <Button
              variant="link"
              size="sm"
              className="text-accent p-0 h-auto"
              onClick={() => setWithdrawAmount(mockStats.availableBalance.toString())}
            >
              سحب الرصيد بالكامل
            </Button>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={isWithdrawing || !withdrawAmount}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جارٍ التنفيذ...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-4 h-4" />
                  تأكيد السحب
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NumaxioPayDashboard;
