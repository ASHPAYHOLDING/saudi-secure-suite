import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TablePolicyInfo {
  tablename: string;
  rls_enabled: boolean;
  policy_count: number;
  has_select: boolean;
  has_insert: boolean;
  has_update: boolean;
  has_delete: boolean;
  has_auth_gate: boolean;
  warnings: string[];
}

const DebugRlsCheck = () => {
  const [tables, setTables] = useState<TablePolicyInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all public tables with RLS status
      const { data: rlsData } = await supabase.rpc("get_rls_audit" as any);
      if (rlsData) {
        setTables(rlsData as unknown as TablePolicyInfo[]);
      }
    } catch {
      // Fallback: just show empty
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const totalTables = tables.length;
  const withWarnings = tables.filter(t => t.warnings.length > 0).length;
  const noPolicy = tables.filter(t => t.rls_enabled && t.policy_count === 0).length;
  const allGood = tables.filter(t => t.warnings.length === 0 && t.rls_enabled && t.policy_count > 0).length;

  return (
    <div dir="ltr" className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={20} /> RLS Policy Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Status of Row Level Security policies across all public tables
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Tables</p>
            <p className="font-bold text-xl">{totalTables}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/40">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">✅ Secured</p>
            <p className="font-bold text-xl text-green-600">{allGood}</p>
          </CardContent>
        </Card>
        <Card className={withWarnings > 0 ? "border-amber-400/40" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">⚠️ Warnings</p>
            <p className={`font-bold text-xl ${withWarnings > 0 ? "text-amber-600" : ""}`}>{withWarnings}</p>
          </CardContent>
        </Card>
        <Card className={noPolicy > 0 ? "border-destructive/40" : ""}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">❌ No Policies</p>
            <p className={`font-bold text-xl ${noPolicy > 0 ? "text-destructive" : ""}`}>{noPolicy}</p>
          </CardContent>
        </Card>
      </div>

      {loading && <p className="text-sm text-muted-foreground animate-pulse">Loading RLS audit data...</p>}

      {/* Warnings first */}
      {tables.filter(t => t.warnings.length > 0).length > 0 && (
        <Card className="border-amber-400/30 bg-amber-50/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <AlertTriangle size={14} /> Tables with Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tables.filter(t => t.warnings.length > 0).map(t => (
                <div key={t.tablename} className="flex items-start gap-2 text-xs">
                  <XCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono font-bold">{t.tablename}</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {t.warnings.map((w, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] text-amber-600 border-amber-300">{w}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 pe-3 font-medium">Table</th>
                  <th className="text-start py-2 pe-3 font-medium">RLS</th>
                  <th className="text-start py-2 pe-3 font-medium">Policies</th>
                  <th className="text-center py-2 pe-2 font-medium">SEL</th>
                  <th className="text-center py-2 pe-2 font-medium">INS</th>
                  <th className="text-center py-2 pe-2 font-medium">UPD</th>
                  <th className="text-center py-2 pe-2 font-medium">DEL</th>
                  <th className="text-center py-2 pe-2 font-medium">Auth Gate</th>
                  <th className="text-start py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tables.map(t => (
                  <tr key={t.tablename} className={`border-b border-border/20 hover:bg-muted/20 ${t.warnings.length > 0 ? "bg-amber-50/5" : ""}`}>
                    <td className="py-1.5 pe-3 font-mono text-[11px]">{t.tablename}</td>
                    <td className="py-1.5 pe-3">
                      {t.rls_enabled ? <CheckCircle2 size={11} className="text-green-600" /> : <XCircle size={11} className="text-destructive" />}
                    </td>
                    <td className="py-1.5 pe-3 font-mono">{t.policy_count}</td>
                    <td className="py-1.5 pe-2 text-center">{t.has_select ? "✓" : "—"}</td>
                    <td className="py-1.5 pe-2 text-center">{t.has_insert ? "✓" : "—"}</td>
                    <td className="py-1.5 pe-2 text-center">{t.has_update ? "✓" : "—"}</td>
                    <td className="py-1.5 pe-2 text-center">{t.has_delete ? "✓" : "—"}</td>
                    <td className="py-1.5 pe-2 text-center">{t.has_auth_gate ? "🔒" : "—"}</td>
                    <td className="py-1.5">
                      {t.warnings.length === 0 ? (
                        <Badge variant="secondary" className="text-[9px]">✓ OK</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px]">{t.warnings.length} warn</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugRlsCheck;
