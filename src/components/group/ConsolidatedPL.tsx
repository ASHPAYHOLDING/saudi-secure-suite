import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BarChart3, Download, Filter } from "lucide-react";

interface ConsolidatedPLProps {
  parentTenantId: string;
}

interface PLRow {
  category: string;
  account_name: string;
  tenant_id: string;
  tenant_name: string;
  total_debit: number;
  total_credit: number;
  net_amount: number;
  is_intercompany: boolean;
}

const categoryLabels: Record<string, { ar: string; en: string }> = {
  revenue: { ar: "الإيرادات", en: "Revenue" },
  cogs: { ar: "تكلفة البضاعة المباعة", en: "Cost of Goods Sold" },
  expense: { ar: "المصروفات", en: "Expenses" },
  other: { ar: "أخرى", en: "Other" },
};

const ConsolidatedPL = ({ parentTenantId }: ConsolidatedPLProps) => {
  const { isRTL } = useLanguage();
  const [data, setData] = useState<PLRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eliminateIC, setEliminateIC] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows, error } = await supabase.rpc("get_consolidated_pl", {
      _parent_tenant_id: parentTenantId,
      _date_from: dateFrom,
      _date_to: dateTo,
    });
    if (rows) setData(rows as PLRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [parentTenantId, dateFrom, dateTo]);

  const filteredData = eliminateIC ? data.filter((r) => !r.is_intercompany) : data;

  // Group by category
  const grouped = filteredData.reduce<Record<string, PLRow[]>>((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});

  // Totals per category
  const categoryTotals = Object.entries(grouped).map(([cat, rows]) => ({
    category: cat,
    total: rows.reduce((sum, r) => sum + Number(r.net_amount), 0),
  }));

  const totalRevenue = categoryTotals.find((c) => c.category === "revenue")?.total || 0;
  const totalCOGS = categoryTotals.find((c) => c.category === "cogs")?.total || 0;
  const totalExpenses = categoryTotals.find((c) => c.category === "expense")?.total || 0;
  const grossProfit = totalRevenue - Math.abs(totalCOGS);
  const netProfit = grossProfit - Math.abs(totalExpenses);

  const fmt = (n: number) =>
    new Intl.NumberFormat(isRTL ? "ar-SA" : "en-SA", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 size={20} />
          {isRTL ? "قائمة الأرباح والخسائر الموحدة" : "Consolidated Profit & Loss"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-xs">{isRTL ? "من تاريخ" : "From"}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">{isRTL ? "إلى تاريخ" : "To"}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={eliminateIC} onCheckedChange={setEliminateIC} />
            <Label className="text-sm">
              {isRTL ? "إزالة العمليات البينية" : "Eliminate Intercompany"}
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <Filter size={14} className="me-1" />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? "الإيرادات" : "Revenue"}</div>
                <div className="text-lg font-bold text-green-700 dark:text-green-400">{fmt(totalRevenue)}</div>
              </div>
              <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? "تكلفة البضاعة" : "COGS"}</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-400">{fmt(Math.abs(totalCOGS))}</div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? "مجمل الربح" : "Gross Profit"}</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(grossProfit)}</div>
              </div>
              <div className={`p-4 rounded-lg ${netProfit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                <div className="text-xs text-muted-foreground">{isRTL ? "صافي الربح" : "Net Profit"}</div>
                <div className={`text-lg font-bold ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {fmt(netProfit)}
                </div>
              </div>
            </div>

            {/* Detail Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "التصنيف" : "Category"}</TableHead>
                    <TableHead>{isRTL ? "الحساب" : "Account"}</TableHead>
                    <TableHead>{isRTL ? "الشركة" : "Company"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "مدين" : "Debit"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "دائن" : "Credit"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "الصافي" : "Net"}</TableHead>
                    <TableHead>{isRTL ? "بينية" : "IC"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(grouped).map(([cat, rows]) => (
                    <>
                      {rows.map((row, idx) => (
                        <TableRow key={`${cat}-${idx}`} className={row.is_intercompany ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                          {idx === 0 && (
                            <TableCell rowSpan={rows.length} className="font-semibold align-top border-e">
                              {categoryLabels[cat]?.[isRTL ? "ar" : "en"] || cat}
                            </TableCell>
                          )}
                          <TableCell className="text-sm">{row.account_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.tenant_name}</TableCell>
                          <TableCell className="text-end font-mono text-sm">{fmt(Number(row.total_debit))}</TableCell>
                          <TableCell className="text-end font-mono text-sm">{fmt(Number(row.total_credit))}</TableCell>
                          <TableCell className="text-end font-mono text-sm font-medium">{fmt(Number(row.net_amount))}</TableCell>
                          <TableCell>
                            {row.is_intercompany && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">IC</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30 font-semibold">
                        <TableCell colSpan={5} className="text-end">
                          {isRTL ? "إجمالي" : "Total"} {categoryLabels[cat]?.[isRTL ? "ar" : "en"] || cat}
                        </TableCell>
                        <TableCell className="text-end font-mono">
                          {fmt(rows.reduce((s, r) => s + Number(r.net_amount), 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ConsolidatedPL;
