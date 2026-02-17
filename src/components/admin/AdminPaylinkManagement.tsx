import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Building2, Wallet, TrendingUp, Percent, DollarSign,
  ArrowDownToLine, Receipt, Search, Loader2, CheckCircle2,
  XCircle, Clock, Send, Eye, BanknoteIcon, Bell
} from "lucide-react";
import { motion } from "framer-motion";

interface TenantPaylink {
  id: string;
  name: string;
  paylink_enabled: boolean;
  paylink_enabled_at: string | null;
  totalSales: number;
  totalFees: number;
  netAmount: number;
  availableBalance: number;
  pendingAmount: number;
  transactionCount: number;
}

interface TransactionLog {
  id: string;
  tenant_id: string;
  tenant_name: string;
  transaction_number: string;
  transaction_type: string;
  description: string | null;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

const AdminPaylinkManagement = () => {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantPaylink[]>([]);
  const [allTransactions, setAllTransactions] = useState<TransactionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"tenants" | "transactions">("tenants");
  const [filterEnabled, setFilterEnabled] = useState<"all" | "enabled" | "disabled">("all");

  // Payout dialog
  const [payoutTenant, setPayoutTenant] = useState<TenantPaylink | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // Detail dialog
  const [detailTenant, setDetailTenant] = useState<TenantPaylink | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<TransactionLog[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch all tenants with paylink columns
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("id, name, paylink_enabled, paylink_enabled_at")
      .order("name");

    // Fetch all paylink transactions
    const { data: txData } = await supabase
      .from("paylink_transactions")
      .select("*, tenants(name)")
      .order("created_at", { ascending: false })
      .limit(500);

    const txs: TransactionLog[] = (txData || []).map((t: any) => ({
      ...t,
      tenant_name: t.tenants?.name || "غير معروف",
    }));
    setAllTransactions(txs);

    // Calculate stats per tenant
    const tenantStats: TenantPaylink[] = (tenantsData || []).map((t: any) => {
      const tenantTxs = txs.filter((tx) => tx.tenant_id === t.id);
      const deposits = tenantTxs.filter((tx) => tx.transaction_type === "deposit" && tx.status === "completed");
      const withdrawals = tenantTxs.filter((tx) => tx.transaction_type === "withdrawal" && tx.status === "completed");
      const pending = tenantTxs.filter((tx) => tx.transaction_type === "deposit" && tx.status === "pending");

      const totalSales = deposits.reduce((s, tx) => s + tx.gross_amount, 0);
      const totalFees = deposits.reduce((s, tx) => s + tx.fee_amount, 0);
      const netAmount = deposits.reduce((s, tx) => s + tx.net_amount, 0);
      const totalWithdrawn = withdrawals.reduce((s, tx) => s + tx.gross_amount, 0);
      const pendingAmount = pending.reduce((s, tx) => s + tx.gross_amount, 0);

      return {
        id: t.id,
        name: t.name,
        paylink_enabled: t.paylink_enabled ?? false,
        paylink_enabled_at: t.paylink_enabled_at,
        totalSales,
        totalFees,
        netAmount,
        availableBalance: netAmount - totalWithdrawn,
        pendingAmount,
        transactionCount: tenantTxs.length,
      };
    });

    setTenants(tenantStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePayout = async () => {
    if (!payoutTenant || !user) return;
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (amount > payoutTenant.availableBalance) {
      toast.error("المبلغ يتجاوز الرصيد المتاح للمشترك");
      return;
    }

    setIsPaying(true);
    const txNum = `TXN-ADM-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from("paylink_transactions").insert({
      tenant_id: payoutTenant.id,
      transaction_number: txNum,
      transaction_type: "withdrawal",
      description: `تحويل من الإدارة إلى الحساب البنكي`,
      gross_amount: amount,
      fee_amount: 0,
      net_amount: amount,
      status: "completed",
      payment_method: "تحويل بنكي - إدارة",
      created_by: user.id,
    });
    setIsPaying(false);

    if (error) {
      toast.error("حدث خطأ أثناء التحويل");
    } else {
      toast.success(`✅ تم تحويل ${formatCurrency(amount)} إلى "${payoutTenant.name}" بنجاح`);
      setPayoutTenant(null);
      setPayoutAmount("");
      fetchData();
    }
  };

  const openDetail = (tenant: TenantPaylink) => {
    setDetailTenant(tenant);
    setDetailTransactions(allTransactions.filter((tx) => tx.tenant_id === tenant.id));
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";

  const enabledTenants = tenants.filter((t) => t.paylink_enabled);
  const totalPlatformSales = enabledTenants.reduce((s, t) => s + t.totalSales, 0);
  const totalPlatformFees = enabledTenants.reduce((s, t) => s + t.totalFees, 0);
  const totalPlatformNet = enabledTenants.reduce((s, t) => s + t.netAmount, 0);
  const totalPlatformBalance = enabledTenants.reduce((s, t) => s + t.availableBalance, 0);

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = !search || t.name.includes(search) || t.id.includes(search);
    const matchesFilter =
      filterEnabled === "all" ||
      (filterEnabled === "enabled" && t.paylink_enabled) ||
      (filterEnabled === "disabled" && !t.paylink_enabled);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "المشتركون المفعّلون", value: enabledTenants.length.toString(), icon: Building2, color: "text-info", bg: "bg-info/10", isCurrency: false },
          { label: "إجمالي المبيعات", value: totalPlatformSales, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10", isCurrency: true },
          { label: "إجمالي الرسوم", value: totalPlatformFees, icon: Percent, color: "text-destructive", bg: "bg-destructive/10", isCurrency: true },
          { label: "صافي المبالغ", value: totalPlatformNet, icon: DollarSign, color: "text-success", bg: "bg-success/10", isCurrency: true },
          { label: "الأرصدة المتاحة", value: totalPlatformBalance, icon: BanknoteIcon, color: "text-warning", bg: "bg-warning/10", isCurrency: true },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="border-border/60">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                  {kpi.isCurrency ? formatCurrency(kpi.value as number) : kpi.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5 w-fit">
        {([
          { key: "tenants" as const, label: "المشتركون", icon: Building2 },
          { key: "transactions" as const, label: "سجل العمليات", icon: Receipt },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tenants Tab */}
      {tab === "tenants" && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-accent" /> إدارة مشتركي نيوماكسيو باي
                </CardTitle>
                <CardDescription>عرض حالة البوابة والمبالغ لكل مشترك</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-muted rounded-lg p-0.5">
                  {([
                    { key: "all" as const, label: "الكل" },
                    { key: "enabled" as const, label: "مفعّل" },
                    { key: "disabled" as const, label: "غير مفعّل" },
                  ]).map((f) => (
                    <button key={f.key} onClick={() => setFilterEnabled(f.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        filterEnabled === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}>{f.label}</button>
                  ))}
                </div>
                <div className="relative w-56">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-semibold">المشترك</TableHead>
                    <TableHead className="text-right font-semibold">حالة البوابة</TableHead>
                    <TableHead className="text-right font-semibold">إجمالي المبيعات</TableHead>
                    <TableHead className="text-right font-semibold">الرسوم</TableHead>
                    <TableHead className="text-right font-semibold">الصافي</TableHead>
                    <TableHead className="text-right font-semibold">الرصيد المتاح</TableHead>
                    <TableHead className="text-right font-semibold">العمليات</TableHead>
                    <TableHead className="text-right font-semibold">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="font-semibold text-sm">{t.name}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${t.paylink_enabled ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                          {t.paylink_enabled ? (
                            <><CheckCircle2 className="w-3 h-3 ml-1" /> مفعّل</>
                          ) : "غير مفعّل"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold">{formatCurrency(t.totalSales)}</TableCell>
                      <TableCell className="text-sm text-destructive">{t.totalFees > 0 ? `-${formatCurrency(t.totalFees)}` : "—"}</TableCell>
                      <TableCell className="text-sm text-accent font-semibold">{formatCurrency(t.netAmount)}</TableCell>
                      <TableCell className="text-sm font-bold">{formatCurrency(t.availableBalance)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.transactionCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(t)} className="gap-1 text-xs">
                            <Eye className="w-3.5 h-3.5" /> تفاصيل
                          </Button>
                          {t.paylink_enabled && t.availableBalance > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => { setPayoutTenant(t); setPayoutAmount(""); }}
                              className="gap-1 text-xs text-accent">
                              <Send className="w-3.5 h-3.5" /> تحويل
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredTenants.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد نتائج</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transactions Tab */}
      {tab === "transactions" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-accent" /> سجل جميع العمليات
            </CardTitle>
            <CardDescription>كل عمليات الإيداع والسحب لجميع المشتركين</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-semibold">التاريخ</TableHead>
                    <TableHead className="text-right font-semibold">المشترك</TableHead>
                    <TableHead className="text-right font-semibold">رقم العملية</TableHead>
                    <TableHead className="text-right font-semibold">النوع</TableHead>
                    <TableHead className="text-right font-semibold">الوصف</TableHead>
                    <TableHead className="text-right font-semibold">المبلغ</TableHead>
                    <TableHead className="text-right font-semibold">الرسوم</TableHead>
                    <TableHead className="text-right font-semibold">الصافي</TableHead>
                    <TableHead className="text-right font-semibold">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTransactions.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</TableCell>
                      <TableCell className="text-sm font-semibold">{tx.tenant_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tx.transaction_number}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs ${
                          tx.transaction_type === "deposit" ? "bg-success/10 text-success border-success/20" : "bg-info/10 text-info border-info/20"
                        }`}>{tx.transaction_type === "deposit" ? "إيداع" : "سحب"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{tx.description || "—"}</TableCell>
                      <TableCell className="text-sm font-semibold">{formatCurrency(tx.gross_amount)}</TableCell>
                      <TableCell className="text-sm text-destructive">{tx.fee_amount > 0 ? `-${formatCurrency(tx.fee_amount)}` : "—"}</TableCell>
                      <TableCell className="text-sm text-accent font-semibold">{formatCurrency(tx.net_amount)}</TableCell>
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
            {allTransactions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد عمليات بعد</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payout Dialog */}
      <Dialog open={!!payoutTenant} onOpenChange={(open) => !open && setPayoutTenant(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-accent" /> تحويل مبلغ
            </DialogTitle>
            <DialogDescription>تحويل مبلغ إلى الحساب البنكي لـ "{payoutTenant?.name}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">الرصيد المتاح للمشترك</p>
              <p className="text-2xl font-bold text-accent font-[IBM_Plex_Sans_Arabic]">
                {formatCurrency(payoutTenant?.availableBalance ?? 0)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-amount">مبلغ التحويل (ر.س)</Label>
              <Input
                id="payout-amount"
                type="number"
                placeholder="0.00"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="text-lg font-semibold text-center"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPayoutTenant(null)}>إلغاء</Button>
            <Button onClick={handlePayout} disabled={isPaying} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              {isPaying ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحويل...</> : "تأكيد التحويل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailTenant} onOpenChange={(open) => !open && setDetailTenant(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" /> {detailTenant?.name}
            </DialogTitle>
            <DialogDescription>
              تفاصيل بوابة الدفع والمعاملات
              {detailTenant?.paylink_enabled_at && (
                <span className="mr-2">• مفعّل منذ {new Date(detailTenant.paylink_enabled_at).toLocaleDateString("ar-SA")}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailTenant && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "المبيعات", value: detailTenant.totalSales, color: "text-accent" },
                  { label: "الرسوم", value: detailTenant.totalFees, color: "text-destructive" },
                  { label: "الصافي", value: detailTenant.netAmount, color: "text-success" },
                  { label: "المتاح", value: detailTenant.availableBalance, color: "text-warning" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-lg font-bold ${s.color} font-[IBM_Plex_Sans_Arabic]`}>{formatCurrency(s.value)}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Transactions */}
              <div>
                <h4 className="text-sm font-semibold mb-3">سجل المعاملات ({detailTransactions.length})</h4>
                {detailTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">لا توجد معاملات</p>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-right text-xs">التاريخ</TableHead>
                          <TableHead className="text-right text-xs">النوع</TableHead>
                          <TableHead className="text-right text-xs">المبلغ</TableHead>
                          <TableHead className="text-right text-xs">الرسوم</TableHead>
                          <TableHead className="text-right text-xs">الصافي</TableHead>
                          <TableHead className="text-right text-xs">الحالة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[10px] ${
                                tx.transaction_type === "deposit" ? "bg-success/10 text-success" : "bg-info/10 text-info"
                              }`}>{tx.transaction_type === "deposit" ? "إيداع" : "سحب"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{formatCurrency(tx.gross_amount)}</TableCell>
                            <TableCell className="text-xs text-destructive">{tx.fee_amount > 0 ? `-${formatCurrency(tx.fee_amount)}` : "—"}</TableCell>
                            <TableCell className="text-xs text-accent font-semibold">{formatCurrency(tx.net_amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${
                                tx.status === "completed" ? "text-success" : tx.status === "pending" ? "text-warning" : "text-destructive"
                              }`}>
                                {tx.status === "completed" ? "مكتمل" : tx.status === "pending" ? "معلّق" : "فشل"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaylinkManagement;
