import { useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, BarChart3, Loader2, Download, Building2,
  GitBranch, ChevronDown, ChevronUp, FileText, DollarSign, Scale,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { secureRpc } from "@/lib/secure-rpc";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useEffect } from "react";

// ── Types ──
interface StatementLine {
  account_id: string;
  code: string;
  name: string;
  name_en: string | null;
  account_type?: string;
  amount: number;
}

interface DrilldownLine {
  line_id: string;
  description: string | null;
  debit: number;
  credit: number;
  entry_id: string;
  reference: string;
  entry_date: string;
  memo: string | null;
}

interface LegalEntity { id: string; name: string; name_en: string | null; }
interface Branch { id: string; name: string; name_en: string | null; }
interface CostCenter { id: string; name: string; name_en: string | null; code: string | null; }

const premiumFade = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

const fmtNum = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const FinancialStatementsPage = () => {
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isRTL = currentLang === "ar";

  const now = new Date();
  const [tab, setTab] = useState<"pl" | "bs" | "cf">("pl");
  const [dateFrom, setDateFrom] = useState(format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(now, "yyyy-MM-dd"));
  const [entityId, setEntityId] = useState("__none__");
  const [branchId, setBranchId] = useState("__none__");
  const [costCenterId, setCostCenterId] = useState("__none__");

  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const [loading, setLoading] = useState(false);
  const [plData, setPlData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [cfData, setCfData] = useState<any>(null);

  // Drilldown
  const [drilldown, setDrilldown] = useState<{ account: StatementLine; lines: DrilldownLine[] } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  // Load filter options
  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase.from("legal_entities").select("id, name, name_en").eq("tenant_id", tenantId),
      supabase.from("branches").select("id, name, name_en").eq("tenant_id", tenantId).eq("is_active", true),
      supabase.from("cost_centers").select("id, name, name_en, code").eq("tenant_id", tenantId).eq("is_active", true),
    ]).then(([e, b, c]) => {
      setEntities((e.data as LegalEntity[]) || []);
      setBranches((b.data as Branch[]) || []);
      setCostCenters((c.data as CostCenter[]) || []);
    });
  }, [tenantId]);

  const getFilterParams = () => ({
    p_tenant_id: tenantId!,
    p_legal_entity_id: entityId === "__none__" ? null : entityId,
    p_branch_id: branchId === "__none__" ? null : branchId,
    p_cost_center_id: costCenterId === "__none__" ? null : costCenterId,
  });

  const fetchStatement = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const params = getFilterParams();

    if (tab === "pl") {
      const { data, error } = await secureRpc("get_profit_loss", { ...params, p_from: dateFrom, p_to: dateTo });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setPlData(data);
    } else if (tab === "bs") {
      const { data, error } = await secureRpc("get_balance_sheet", { ...params, p_as_of: dateTo });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setBsData(data);
    } else {
      const { data, error } = await secureRpc("get_cash_flow", { ...params, p_from: dateFrom, p_to: dateTo });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setCfData(data);
    }
    setLoading(false);
  }, [tenantId, tab, dateFrom, dateTo, entityId, branchId, costCenterId]);

  const handleDrilldown = async (account: StatementLine) => {
    if (!tenantId) return;
    setDrillLoading(true);
    const params = getFilterParams();
    const { data, error } = await secureRpc("get_account_drilldown", {
      ...params,
      p_account_id: account.account_id,
      p_from: dateFrom,
      p_to: dateTo,
    });
    setDrillLoading(false);
    if (error) { toast.error(error.message); return; }
    setDrilldown({ account, lines: (data as DrilldownLine[]) || [] });
  };

  const exportCSV = (title: string, rows: StatementLine[]) => {
    const header = "Code,Account,Amount\n";
    const body = rows.map(r => `${r.code},"${r.name}",${r.amount}`).join("\n");
    const blob = new Blob(["\uFEFF" + header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}_${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render Helpers ──
  const AccountRow = ({ line, onClick }: { line: StatementLine; onClick: () => void }) => (
    <TableRow className="group cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell className="font-mono text-xs text-muted-foreground w-20">{line.code}</TableCell>
      <TableCell className="text-sm">{isRTL ? line.name : line.name_en || line.name}</TableCell>
      <TableCell className={`text-sm font-semibold text-end tabular-nums ${line.amount < 0 ? "text-destructive" : ""}`}>
        {fmtNum(line.amount)}
      </TableCell>
    </TableRow>
  );

  const TotalRow = ({ label, amount, variant = "default" }: { label: string; amount: number; variant?: string }) => (
    <TableRow className="border-t-2 border-foreground/20">
      <TableCell></TableCell>
      <TableCell className="text-sm font-bold">{label}</TableCell>
      <TableCell className={`text-sm font-bold text-end tabular-nums ${variant === "positive" ? "text-emerald-600" : variant === "negative" ? "text-destructive" : ""}`}>
        {fmtNum(amount)}
      </TableCell>
    </TableRow>
  );

  const SectionHeader = ({ title, icon: Icon }: { title: string; icon: any }) => (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={3} className="py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Icon size={14} /> {title}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <motion.div {...premiumFade} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isRTL ? "القوائم المالية" : "Financial Statements"}
                </h1>
                <Badge className="border-accent/25 text-accent text-[10px] px-1.5 py-0 font-bold">Enterprise</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL ? "قائمة الدخل • الميزانية العمومية • التدفقات النقدية" : "P&L • Balance Sheet • Cash Flow"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="pl" className="gap-1.5 text-xs">
            <TrendingUp size={14} /> {isRTL ? "قائمة الدخل" : "Profit & Loss"}
          </TabsTrigger>
          <TabsTrigger value="bs" className="gap-1.5 text-xs">
            <Scale size={14} /> {isRTL ? "الميزانية العمومية" : "Balance Sheet"}
          </TabsTrigger>
          <TabsTrigger value="cf" className="gap-1.5 text-xs">
            <ArrowUpDown size={14} /> {isRTL ? "التدفقات النقدية" : "Cash Flow"}
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <motion.div variants={premiumFade} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">{isRTL ? "من" : "From"}</Label>
                  <Input type="date" className="h-9 w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tab === "bs" ? (isRTL ? "حتى تاريخ" : "As of") : (isRTL ? "إلى" : "To")}</Label>
                  <Input type="date" className="h-9 w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                {entities.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "الكيان" : "Entity"}</Label>
                    <Select value={entityId} onValueChange={setEntityId}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{isRTL ? "الكل" : "All"}</SelectItem>
                        {entities.map(e => <SelectItem key={e.id} value={e.id}>{isRTL ? e.name : e.name_en || e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {branches.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "الفرع" : "Branch"}</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{isRTL ? "الكل" : "All"}</SelectItem>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{isRTL ? b.name : b.name_en || b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {costCenters.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "مركز التكلفة" : "Cost Center"}</Label>
                    <Select value={costCenterId} onValueChange={setCostCenterId}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{isRTL ? "الكل" : "All"}</SelectItem>
                        {costCenters.map(c => <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} – ` : ""}{isRTL ? c.name : c.name_en || c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={fetchStatement} disabled={loading} className="gap-1.5 h-9">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                  {isRTL ? "عرض" : "Generate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* P&L Tab */}
        <TabsContent value="pl">
          {plData ? (
            <motion.div variants={premiumFade} initial="initial" animate="animate">
              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{isRTL ? "قائمة الدخل" : "Income Statement"}</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCSV("PL", [...(plData.revenue || []), ...(plData.expenses || [])])}>
                    <Download size={12} /> CSV
                  </Button>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">{isRTL ? "رمز" : "Code"}</TableHead>
                      <TableHead>{isRTL ? "الحساب" : "Account"}</TableHead>
                      <TableHead className="text-end">{isRTL ? "المبلغ" : "Amount"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SectionHeader title={isRTL ? "الإيرادات" : "Revenue"} icon={TrendingUp} />
                    {(plData.revenue || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    <TotalRow label={isRTL ? "إجمالي الإيرادات" : "Total Revenue"} amount={plData.total_revenue} variant="positive" />
                    <SectionHeader title={isRTL ? "المصروفات" : "Expenses"} icon={TrendingDown} />
                    {(plData.expenses || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    <TotalRow label={isRTL ? "إجمالي المصروفات" : "Total Expenses"} amount={plData.total_expenses} variant="negative" />
                    <TableRow className="border-t-4 border-foreground/30 bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell className="text-base font-black">{isRTL ? "صافي الدخل" : "Net Income"}</TableCell>
                      <TableCell className={`text-base font-black text-end tabular-nums ${plData.net_income >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {fmtNum(plData.net_income)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </motion.div>
          ) : !loading && (
            <EmptyState isRTL={isRTL} />
          )}
        </TabsContent>

        {/* Balance Sheet Tab */}
        <TabsContent value="bs">
          {bsData ? (
            <motion.div variants={premiumFade} initial="initial" animate="animate">
              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{isRTL ? "الميزانية العمومية" : "Balance Sheet"}</CardTitle>
                    {bsData.is_balanced ? (
                      <Badge className="mt-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                        {isRTL ? "متوازنة ✓" : "Balanced ✓"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="mt-1 text-[10px]">
                        {isRTL ? "غير متوازنة ✗" : "Unbalanced ✗"}
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCSV("BS", [...(bsData.assets || []), ...(bsData.liabilities || []), ...(bsData.equity || [])])}>
                    <Download size={12} /> CSV
                  </Button>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">{isRTL ? "رمز" : "Code"}</TableHead>
                      <TableHead>{isRTL ? "الحساب" : "Account"}</TableHead>
                      <TableHead className="text-end">{isRTL ? "المبلغ" : "Amount"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SectionHeader title={isRTL ? "الأصول" : "Assets"} icon={DollarSign} />
                    {(bsData.assets || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    <TotalRow label={isRTL ? "إجمالي الأصول" : "Total Assets"} amount={bsData.total_assets} />

                    <SectionHeader title={isRTL ? "الالتزامات" : "Liabilities"} icon={FileText} />
                    {(bsData.liabilities || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    <TotalRow label={isRTL ? "إجمالي الالتزامات" : "Total Liabilities"} amount={bsData.total_liabilities} />

                    <SectionHeader title={isRTL ? "حقوق الملكية" : "Equity"} icon={Scale} />
                    {(bsData.equity || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    {bsData.retained_earnings !== 0 && (
                      <TableRow>
                        <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-sm italic text-muted-foreground">{isRTL ? "أرباح مبقاة" : "Retained Earnings"}</TableCell>
                        <TableCell className="text-sm font-semibold text-end tabular-nums">{fmtNum(bsData.retained_earnings)}</TableCell>
                      </TableRow>
                    )}
                    <TotalRow label={isRTL ? "إجمالي حقوق الملكية" : "Total Equity"} amount={bsData.total_equity} />

                    <TableRow className="border-t-4 border-foreground/30 bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell className="text-base font-black">{isRTL ? "الالتزامات + حقوق الملكية" : "Liabilities + Equity"}</TableCell>
                      <TableCell className="text-base font-black text-end tabular-nums">
                        {fmtNum(bsData.total_liabilities + bsData.total_equity)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </motion.div>
          ) : !loading && (
            <EmptyState isRTL={isRTL} />
          )}
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cf">
          {cfData ? (
            <motion.div variants={premiumFade} initial="initial" animate="animate">
              <Card className="overflow-hidden">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{isRTL ? "قائمة التدفقات النقدية" : "Cash Flow Statement"}</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => exportCSV("CF", [...(cfData.operating_adjustments || []), ...(cfData.financing_activities || [])])}>
                    <Download size={12} /> CSV
                  </Button>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">{isRTL ? "رمز" : "Code"}</TableHead>
                      <TableHead>{isRTL ? "البند" : "Item"}</TableHead>
                      <TableHead className="text-end">{isRTL ? "المبلغ" : "Amount"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="text-xs font-bold uppercase text-muted-foreground">{isRTL ? "صافي الدخل" : "Net Income"}</TableCell>
                      <TableCell className="text-sm font-bold text-end tabular-nums">{fmtNum(cfData.net_income)}</TableCell>
                    </TableRow>
                    <SectionHeader title={isRTL ? "الأنشطة التشغيلية" : "Operating Activities"} icon={TrendingUp} />
                    {(cfData.operating_adjustments || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    <TotalRow label={isRTL ? "صافي النقد من التشغيل" : "Net Cash from Operations"} amount={cfData.total_operating} />
                    <SectionHeader title={isRTL ? "الأنشطة التمويلية" : "Financing Activities"} icon={Building2} />
                    {(cfData.financing_activities || []).map((l: StatementLine) => (
                      <AccountRow key={l.account_id} line={l} onClick={() => handleDrilldown(l)} />
                    ))}
                    <TotalRow label={isRTL ? "صافي النقد من التمويل" : "Net Cash from Financing"} amount={cfData.total_financing} />
                    <TableRow className="border-t-4 border-foreground/30 bg-muted/20">
                      <TableCell></TableCell>
                      <TableCell className="text-base font-black">{isRTL ? "صافي التغير في النقد" : "Net Change in Cash"}</TableCell>
                      <TableCell className={`text-base font-black text-end tabular-nums ${cfData.net_change_in_cash >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {fmtNum(cfData.net_change_in_cash)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </motion.div>
          ) : !loading && (
            <EmptyState isRTL={isRTL} />
          )}
        </TabsContent>
      </Tabs>

      {/* Drilldown Dialog */}
      <Dialog open={!!drilldown} onOpenChange={o => { if (!o) setDrilldown(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={16} />
              {drilldown?.account.code} — {isRTL ? drilldown?.account.name : drilldown?.account.name_en || drilldown?.account.name}
            </DialogTitle>
          </DialogHeader>
          {drillLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "المرجع" : "Reference"}</TableHead>
                  <TableHead>{isRTL ? "الوصف" : "Description"}</TableHead>
                  <TableHead className="text-end">{isRTL ? "مدين" : "Debit"}</TableHead>
                  <TableHead className="text-end">{isRTL ? "دائن" : "Credit"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drilldown?.lines || []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{isRTL ? "لا توجد حركات" : "No entries"}</TableCell></TableRow>
                ) : (
                  drilldown?.lines.map(l => (
                    <TableRow key={l.line_id}>
                      <TableCell className="text-xs">{l.entry_date}</TableCell>
                      <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{l.description || l.memo || "—"}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{l.debit > 0 ? fmtNum(l.debit) : "—"}</TableCell>
                      <TableCell className="text-xs text-end tabular-nums">{l.credit > 0 ? fmtNum(l.credit) : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function EmptyState({ isRTL }: { isRTL: boolean }) {
  return (
    <Card className="py-16">
      <div className="text-center text-muted-foreground">
        <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">{isRTL ? "اختر الفترة واضغط \"عرض\" لتوليد القائمة المالية" : "Select a period and click \"Generate\" to view the statement"}</p>
      </div>
    </Card>
  );
}

export default FinancialStatementsPage;
