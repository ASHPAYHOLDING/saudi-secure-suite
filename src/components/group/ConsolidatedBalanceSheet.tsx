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
import { DollarSign, Filter } from "lucide-react";

interface Props {
  parentTenantId: string;
}

interface BSRow {
  category: string;
  account_name: string;
  tenant_id: string;
  tenant_name: string;
  total_debit: number;
  total_credit: number;
  balance: number;
  is_intercompany: boolean;
}

const categoryLabels: Record<string, { ar: string; en: string }> = {
  assets: { ar: "الأصول", en: "Assets" },
  liabilities: { ar: "الالتزامات", en: "Liabilities" },
  equity: { ar: "حقوق الملكية", en: "Equity" },
  other: { ar: "أخرى", en: "Other" },
};

const ConsolidatedBalanceSheet = ({ parentTenantId }: Props) => {
  const { isRTL } = useLanguage();
  const [data, setData] = useState<BSRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eliminateIC, setEliminateIC] = useState(true);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    setLoading(true);
    const { data: rows } = await supabase.rpc("get_consolidated_balance_sheet", {
      _parent_tenant_id: parentTenantId,
      _as_of_date: asOfDate,
    });
    if (rows) setData(rows as BSRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [parentTenantId, asOfDate]);

  const filteredData = eliminateIC ? data.filter((r) => !r.is_intercompany) : data;

  const grouped = filteredData.reduce<Record<string, BSRow[]>>((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});

  const totalAssets = (grouped.assets || []).reduce((s, r) => s + Number(r.balance), 0);
  const totalLiabilities = (grouped.liabilities || []).reduce((s, r) => s + Number(r.balance), 0);
  const totalEquity = (grouped.equity || []).reduce((s, r) => s + Number(r.balance), 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat(isRTL ? "ar-SA" : "en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign size={20} />
          {isRTL ? "الميزانية العمومية الموحدة" : "Consolidated Balance Sheet"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg">
          <div>
            <Label className="text-xs">{isRTL ? "كما في تاريخ" : "As of Date"}</Label>
            <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="w-44" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={eliminateIC} onCheckedChange={setEliminateIC} />
            <Label className="text-sm">{isRTL ? "إزالة البينية" : "Eliminate IC"}</Label>
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
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? "إجمالي الأصول" : "Total Assets"}</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{fmt(totalAssets)}</div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? "إجمالي الالتزامات" : "Total Liabilities"}</div>
                <div className="text-lg font-bold text-red-700 dark:text-red-400">{fmt(Math.abs(totalLiabilities))}</div>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <div className="text-xs text-muted-foreground">{isRTL ? "حقوق الملكية" : "Equity"}</div>
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{fmt(Math.abs(totalEquity))}</div>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "التصنيف" : "Category"}</TableHead>
                    <TableHead>{isRTL ? "الحساب" : "Account"}</TableHead>
                    <TableHead>{isRTL ? "الشركة" : "Company"}</TableHead>
                    <TableHead className="text-end">{isRTL ? "الرصيد" : "Balance"}</TableHead>
                    <TableHead>{isRTL ? "بينية" : "IC"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {["assets", "liabilities", "equity", "other"].map((cat) => {
                    const rows = grouped[cat];
                    if (!rows || rows.length === 0) return null;
                    return (
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
                            <TableCell className="text-end font-mono text-sm font-medium">{fmt(Number(row.balance))}</TableCell>
                            <TableCell>
                              {row.is_intercompany && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">IC</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell colSpan={3} className="text-end">
                            {isRTL ? "إجمالي" : "Total"} {categoryLabels[cat]?.[isRTL ? "ar" : "en"] || cat}
                          </TableCell>
                          <TableCell className="text-end font-mono">
                            {fmt(rows.reduce((s, r) => s + Number(r.balance), 0))}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ConsolidatedBalanceSheet;
