import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Search,
  Download,
  Loader2,
  Shield,
  Database,
} from "lucide-react";
import { toast } from "sonner";

interface RlsRow {
  table_name: string;
  is_rls_enabled: boolean;
  has_policies: boolean;
  policy_count: number;
  has_always_true_write_policy: boolean;
  is_partition: boolean;
}

const RlsAuditTab = () => {
  const [rows, setRows] = useState<RlsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("audit_rls_status");
      if (rpcError) throw rpcError;
      setRows((data as RlsRow[]) ?? []);
    } catch (err: any) {
      setError(err.message);
      toast.error("RLS audit failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => r.table_name.toLowerCase().includes(q));
  }, [rows, query]);

  // Warnings
  const rlsDisabled = rows.filter((r) => !r.is_rls_enabled);
  const rlsNoPolicies = rows.filter((r) => r.is_rls_enabled && !r.has_policies);
  const truePolicies = rows.filter((r) => r.has_always_true_write_policy);

  const stats = {
    total: rows.length,
    secure: rows.filter((r) => r.is_rls_enabled && r.has_policies && !r.has_always_true_write_policy).length,
    rlsDisabled: rlsDisabled.length,
    noPolicies: rlsNoPolicies.length,
    truePolicies: truePolicies.length,
  };

  const handleExportCSV = () => {
    const headers = ["table_name", "is_rls_enabled", "policy_count", "has_always_true_write_policy", "is_partition"];
    const csvRows = [
      headers.join(","),
      ...filtered.map((r) =>
        [r.table_name, r.is_rls_enabled, r.policy_count, r.has_always_true_write_policy, r.is_partition].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rls-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-6 text-center">
          <ShieldAlert size={32} className="mx-auto mb-2 text-destructive" />
          <p className="text-sm text-destructive font-medium">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={fetchData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Security banner */}
      <Card className="border-yellow-500/40 bg-yellow-500/5">
        <CardContent className="p-3 flex items-center gap-2">
          <ShieldAlert size={16} className="text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-600 font-medium">
            Sensitive security audit — Platform Admin access only. Data shown is metadata only, no row content is exposed.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Tables", value: stats.total, icon: Database, color: "text-foreground" },
          { label: "Secure", value: stats.secure, icon: CheckCircle2, color: "text-green-500" },
          { label: "RLS Disabled", value: stats.rlsDisabled, icon: XCircle, color: "text-destructive" },
          { label: "No Policies", value: stats.noPolicies, icon: AlertTriangle, color: "text-yellow-500" },
          { label: "True Write", value: stats.truePolicies, icon: ShieldAlert, color: "text-orange-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon size={18} className={s.color} />
              <div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Warnings */}
      {rlsDisabled.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <XCircle size={16} /> ⛔ RLS Disabled ({rlsDisabled.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-destructive font-mono">
              {rlsDisabled.map((r) => r.table_name).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {rlsNoPolicies.length > 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
              <AlertTriangle size={16} /> RLS Enabled but No Policies ({rlsNoPolicies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-yellow-600 font-mono">
              {rlsNoPolicies.map((r) => r.table_name).join(", ")}
            </p>
          </CardContent>
        </Card>
      )}

      {truePolicies.length > 0 && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-500">
              <ShieldAlert size={16} /> Always-True Write Policies ({truePolicies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-orange-600 font-mono">
              {truePolicies.map((r) => r.table_name).join(", ")}
            </p>
            <p className="text-[10px] text-orange-500 mt-1">
              These tables have USING(true) or WITH CHECK(true) on INSERT/UPDATE/DELETE not scoped to service_role.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2">
          <Download size={14} /> Export CSV
        </Button>
        <Button size="sm" variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Filter by table name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 font-mono text-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-medium">Table</TableHead>
                <TableHead className="text-xs font-medium text-center">RLS</TableHead>
                <TableHead className="text-xs font-medium text-center">Policies</TableHead>
                <TableHead className="text-xs font-medium text-center">True Write</TableHead>
                <TableHead className="text-xs font-medium text-center">Partition</TableHead>
                <TableHead className="text-xs font-medium">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                let severity: "secure" | "warning" | "critical" = "secure";
                if (!row.is_rls_enabled) severity = "critical";
                else if (!row.has_policies || row.has_always_true_write_policy) severity = "warning";

                return (
                  <TableRow
                    key={row.table_name}
                    className={
                      severity === "critical"
                        ? "bg-destructive/5"
                        : severity === "warning"
                        ? "bg-yellow-500/5"
                        : ""
                    }
                  >
                    <TableCell className="font-mono text-xs text-primary whitespace-nowrap">
                      {row.table_name}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.is_rls_enabled ? (
                        <CheckCircle2 size={14} className="inline text-green-500" />
                      ) : (
                        <XCircle size={14} className="inline text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-mono text-xs ${row.policy_count === 0 ? "text-yellow-500" : "text-foreground"}`}>
                        {row.policy_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.has_always_true_write_policy ? (
                        <Badge variant="destructive" className="text-[9px]">YES</Badge>
                      ) : (
                        <span className="text-green-500 text-[10px]">✓</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.is_partition ? (
                        <Badge variant="outline" className="text-[9px]">Part</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {severity === "critical" ? (
                        <Badge variant="destructive" className="text-[9px] gap-1">
                          <XCircle size={10} /> CRITICAL
                        </Badge>
                      ) : severity === "warning" ? (
                        <Badge variant="outline" className="text-[9px] gap-1 text-yellow-500 border-yellow-500/30">
                          <AlertTriangle size={10} /> WARNING
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px] gap-1">
                          <Shield size={10} /> SECURE
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No tables match "{query}"
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RlsAuditTab;
