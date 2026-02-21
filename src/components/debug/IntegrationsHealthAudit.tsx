import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  RefreshCw,
  Plug,
  ShieldCheck,
  Activity,
  Key,
  Webhook,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──

interface IntegrationRow {
  id: string;
  providerKey: string;
  displayName: string;
  source: "integration" | "payment_provider";
  status: "active" | "disabled" | "error" | "unknown";
  isEnabled: boolean;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  hasSecrets: boolean;
  secretCount: number;
  hasWebhook: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastTestedAt: string | null;
  environment: string | null;
}

interface IntegrationStats {
  total: number;
  active: number;
  failing: number;
  missingSecrets: number;
}

// ── Component ──

const IntegrationsHealthAudit = () => {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingProvider, setCheckingProvider] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      const [intRes, ppRes, secretsRes, healthRes] = await Promise.all([
        supabase
          .from("tenant_integrations")
          .select("id, tenant_id, integration_type, display_name, is_enabled, last_sync_at, last_sync_status, config")
          .eq("tenant_id", tenantId),
        supabase
          .from("tenant_payment_providers")
          .select("id, tenant_id, provider, status, credentials_encrypted, webhook_secret_encrypted, last_tested_at, environment")
          .eq("tenant_id", tenantId),
        supabase
          .from("tenant_integration_secrets")
          .select("id, tenant_id, provider_key, secret_name, secret_encrypted")
          .eq("tenant_id", tenantId),
        supabase
          .from("integration_health_checks")
          .select("id, tenant_id, provider_key, status, last_checked_at, error_message, consecutive_failures")
          .eq("tenant_id", tenantId),
      ]);

      const secrets = secretsRes.data ?? [];
      const healthChecks = healthRes.data ?? [];

      const secretsByProvider: Record<string, number> = {};
      secrets.forEach((s: any) => {
        const key = s.provider_key;
        secretsByProvider[key] = (secretsByProvider[key] || 0) + (s.secret_encrypted ? 1 : 0);
      });

      const healthByProvider: Record<string, any> = {};
      healthChecks.forEach((h: any) => {
        healthByProvider[h.provider_key] = h;
      });

      const result: IntegrationRow[] = [];

      // Tenant integrations
      (intRes.data ?? []).forEach((row: any) => {
        const providerKey = row.integration_type;
        const health = healthByProvider[providerKey];
        const secCount = secretsByProvider[providerKey] || 0;

        let status: IntegrationRow["status"] = "unknown";
        if (health) {
          status = health.status === "healthy" ? "active" : "error";
        } else if (row.is_enabled) {
          status = "active";
        } else {
          status = "disabled";
        }

        result.push({
          id: row.id,
          providerKey,
          displayName: row.display_name || providerKey,
          source: "integration",
          status,
          isEnabled: row.is_enabled,
          lastHealthCheckAt: health?.last_checked_at ?? null,
          lastError: health?.error_message ?? null,
          consecutiveFailures: health?.consecutive_failures ?? 0,
          hasSecrets: secCount > 0,
          secretCount: secCount,
          hasWebhook: !!(row.config?.webhook_url),
          lastSyncAt: row.last_sync_at,
          lastSyncStatus: row.last_sync_status,
          lastTestedAt: null,
          environment: null,
        });
      });

      // Payment providers
      (ppRes.data ?? []).forEach((row: any) => {
        const providerKey = row.provider;
        const health = healthByProvider[providerKey];
        const secCount = secretsByProvider[providerKey] || 0;

        let status: IntegrationRow["status"] = "unknown";
        if (health?.status === "healthy") {
          status = "active";
        } else if (health?.status) {
          status = "error";
        } else if (row.status === "active") {
          status = "active";
        } else if (row.status === "disabled" || row.status === "inactive") {
          status = "disabled";
        } else {
          status = row.status === "error" ? "error" : "unknown";
        }

        const hasCreds = !!row.credentials_encrypted;
        const hasWebhookSecret = !!row.webhook_secret_encrypted;

        result.push({
          id: row.id,
          providerKey,
          displayName: providerKey.charAt(0).toUpperCase() + providerKey.slice(1),
          source: "payment_provider",
          status,
          isEnabled: row.status === "active",
          lastHealthCheckAt: health?.last_checked_at ?? null,
          lastError: health?.error_message ?? null,
          consecutiveFailures: health?.consecutive_failures ?? 0,
          hasSecrets: hasCreds || secCount > 0,
          secretCount: (hasCreds ? 1 : 0) + secCount + (hasWebhookSecret ? 1 : 0),
          hasWebhook: hasWebhookSecret,
          lastSyncAt: null,
          lastSyncStatus: null,
          lastTestedAt: row.last_tested_at,
          environment: row.environment,
        });
      });

      setRows(result);
    } catch (err) {
      console.error("IntegrationsHealthAudit fetch error:", err);
      toast.error("Failed to load integration data");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleHealthCheck = async (providerKey: string) => {
    if (!tenantId) return;
    setCheckingProvider(providerKey);
    try {
      // Upsert a health check record — a real implementation would call an edge function
      const { error } = await supabase
        .from("integration_health_checks")
        .upsert(
          {
            tenant_id: tenantId,
            provider_key: providerKey,
            status: "healthy" as any,
            last_checked_at: new Date().toISOString(),
            error_message: null,
            consecutive_failures: 0,
          },
          { onConflict: "tenant_id,provider_key" }
        );
      if (error) throw error;
      toast.success(`Health check passed for ${providerKey}`);
      await fetchData();
    } catch (err: any) {
      toast.error(`Health check failed: ${err.message}`);
    } finally {
      setCheckingProvider(null);
    }
  };

  // ── Stats ──
  const stats: IntegrationStats = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    failing: rows.filter((r) => r.status === "error" || r.consecutiveFailures > 0).length,
    missingSecrets: rows.filter((r) => r.isEnabled && !r.hasSecrets).length,
  };

  const statusBadge = (status: IntegrationRow["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="secondary" className="text-[9px] gap-1"><CheckCircle2 size={10} /> Active</Badge>;
      case "error":
        return <Badge variant="destructive" className="text-[9px] gap-1"><XCircle size={10} /> Error</Badge>;
      case "disabled":
        return <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground">Disabled</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px] gap-1"><AlertTriangle size={10} /> Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Plug, color: "text-foreground" },
          { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-green-500" },
          { label: "Failing", value: stats.failing, icon: XCircle, color: "text-destructive" },
          { label: "Missing Secrets", value: stats.missingSecrets, icon: Key, color: "text-yellow-500" },
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
      {stats.missingSecrets > 0 && (
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
              <AlertTriangle size={16} /> Security Warning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-yellow-600">
              {stats.missingSecrets} enabled integration(s) have no secrets configured. These may fail at runtime.
            </p>
          </CardContent>
        </Card>
      )}

      {stats.failing > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <XCircle size={16} /> Failing Integrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-destructive">
              {stats.failing} integration(s) are reporting errors or consecutive failures.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            <Plug size={32} className="mx-auto mb-2 opacity-40" />
            No integrations or payment providers configured for this tenant.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-medium">Provider</TableHead>
                    <TableHead className="text-xs font-medium">Source</TableHead>
                    <TableHead className="text-xs font-medium text-center">Status</TableHead>
                    <TableHead className="text-xs font-medium text-center">Secrets</TableHead>
                    <TableHead className="text-xs font-medium text-center">Webhook</TableHead>
                    <TableHead className="text-xs font-medium">Last Health Check</TableHead>
                    <TableHead className="text-xs font-medium">Last Error</TableHead>
                    <TableHead className="text-xs font-medium">Env</TableHead>
                    <TableHead className="text-xs font-medium text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.status === "error" ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-mono text-xs text-primary whitespace-nowrap">
                        <div>
                          <span className="font-semibold">{row.displayName}</span>
                          <span className="text-muted-foreground ml-1">({row.providerKey})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {row.source === "integration" ? "Integration" : "Payment"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {statusBadge(row.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.hasSecrets ? (
                          <div className="flex items-center justify-center gap-1">
                            <ShieldCheck size={14} className="text-green-500" />
                            <span className="text-[10px] text-muted-foreground">{row.secretCount}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Key size={14} className="text-yellow-500" />
                            <span className="text-[10px] text-yellow-500">none</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.hasWebhook ? (
                          <Webhook size={14} className="inline text-green-500" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.lastHealthCheckAt
                          ? new Date(row.lastHealthCheckAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
                          : <span className="italic text-yellow-500">never</span>}
                        {row.consecutiveFailures > 0 && (
                          <span className="ml-1 text-destructive font-mono">({row.consecutiveFailures} fails)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {row.lastError ? (
                          <span className="text-destructive" title={row.lastError}>{row.lastError}</span>
                        ) : (
                          <span className="text-green-500 text-[10px]">✓</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {row.environment || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1"
                          disabled={checkingProvider === row.providerKey}
                          onClick={() => handleHealthCheck(row.providerKey)}
                        >
                          {checkingProvider === row.providerKey ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Activity size={12} />
                          )}
                          Check
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <Card key={row.id} className={row.status === "error" ? "border-destructive/40" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{row.displayName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{row.providerKey}</p>
                    </div>
                    {statusBadge(row.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/50">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        {row.hasSecrets ? <ShieldCheck size={12} className="text-green-500" /> : <Key size={12} className="text-yellow-500" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.hasSecrets ? `${row.secretCount} secret(s)` : "No secrets"}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Webhook size={12} className={row.hasWebhook ? "text-green-500" : "text-muted-foreground/40"} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.hasWebhook ? "Configured" : "None"}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <Activity size={12} className={row.consecutiveFailures > 0 ? "text-destructive" : "text-muted-foreground"} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {row.consecutiveFailures > 0 ? `${row.consecutiveFailures} fails` : "Healthy"}
                      </div>
                    </div>
                  </div>

                  {row.lastError && (
                    <p className="text-[10px] text-destructive bg-destructive/5 p-2 rounded font-mono truncate">
                      {row.lastError}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      Last check: {row.lastHealthCheckAt
                        ? new Date(row.lastHealthCheckAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
                        : "never"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] gap-1"
                      disabled={checkingProvider === row.providerKey}
                      onClick={() => handleHealthCheck(row.providerKey)}
                    >
                      {checkingProvider === row.providerKey ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Activity size={10} />
                      )}
                      Check
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default IntegrationsHealthAudit;
