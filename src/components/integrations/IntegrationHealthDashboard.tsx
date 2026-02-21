/**
 * IntegrationHealthDashboard — /dashboard/integrations/health
 * Enterprise health monitoring for all connected integrations.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BrandLogo } from "@/components/payments/BrandLogo";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Activity, AlertTriangle, CheckCircle2, XCircle,
  Clock, Wifi, WifiOff, RefreshCw, Bell, BellOff,
  Shield, Gauge, Filter, ChevronDown,
  ArrowUpCircle, ArrowDownCircle, MinusCircle,
  Zap, Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────── */
type HealthStatus = "healthy" | "degraded" | "down";
type AlertSeverity = "info" | "warn" | "critical";

interface HealthCheck {
  id: string;
  tenant_id: string;
  provider_key: string;
  status: HealthStatus;
  last_checked_at: string;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  consecutive_failures: number;
}

interface HealthAlert {
  id: string;
  tenant_id: string;
  provider_key: string;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  created_at: string;
  resolved_at: string | null;
}

/* ─── Status Config ─────────────────────────────── */
const STATUS_CONFIG: Record<HealthStatus, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  healthy: {
    label: "سليم",
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
    dotColor: "bg-success",
  },
  degraded: {
    label: "بطيء",
    icon: MinusCircle,
    color: "text-warning",
    bgColor: "bg-warning/10",
    dotColor: "bg-warning",
  },
  down: {
    label: "متوقف",
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    dotColor: "bg-destructive",
  },
};

const SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof AlertTriangle;
}> = {
  info: { label: "معلومة", color: "text-info", bgColor: "bg-info/10", icon: Bell },
  warn: { label: "تحذير", color: "text-warning", bgColor: "bg-warning/10", icon: AlertTriangle },
  critical: { label: "حرج", color: "text-destructive", bgColor: "bg-destructive/10", icon: XCircle },
};

const PROVIDER_NAMES: Record<string, string> = {
  tap: "Tap", stripe: "Stripe", moyasar: "Moyasar", geidea: "Geidea",
  hyperpay: "HyperPay", paytabs: "PayTabs", myfatoorah: "MyFatoorah",
  telr: "Telr", paypal: "PayPal", tabby: "Tabby", tamara: "Tamara",
  madfu: "Madfu", emkan: "Emkan", mispay: "MISPAY",
  shopify: "Shopify", woocommerce: "WooCommerce", foodics: "Foodics",
};

/* ─── Component ──────────────────────────────────── */
const IntegrationHealthDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | HealthStatus>("all");
  const [activeTab, setActiveTab] = useState("overview");

  // Get tenant ID
  const { data: tenantId } = useQuery({
    queryKey: ["my-tenant-id", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      return data?.tenant_id ?? null;
    },
    enabled: !!user,
  });

  // Fetch health checks
  const { data: healthChecks, isLoading: loadingHealth } = useQuery({
    queryKey: ["integration-health-checks", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_health_checks")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("provider_key");
      if (error) throw error;
      return (data ?? []) as unknown as HealthCheck[];
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Fetch alerts
  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ["integration-alerts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_alerts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as HealthAlert[];
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Resolve alert mutation
  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("integration_alerts")
        .update({ resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إغلاق التنبيه");
      queryClient.invalidateQueries({ queryKey: ["integration-alerts"] });
    },
  });

  // Stats
  const stats = useMemo(() => {
    if (!healthChecks) return { healthy: 0, degraded: 0, down: 0, total: 0 };
    return {
      healthy: healthChecks.filter(h => h.status === "healthy").length,
      degraded: healthChecks.filter(h => h.status === "degraded").length,
      down: healthChecks.filter(h => h.status === "down").length,
      total: healthChecks.length,
    };
  }, [healthChecks]);

  const unresolvedAlerts = useMemo(
    () => (alerts ?? []).filter(a => !a.resolved_at),
    [alerts]
  );

  const filteredChecks = useMemo(() => {
    if (!healthChecks) return [];
    if (statusFilter === "all") return healthChecks;
    return healthChecks.filter(h => h.status === statusFilter);
  }, [healthChecks, statusFilter]);

  const avgLatency = useMemo(() => {
    if (!healthChecks?.length) return 0;
    const withLatency = healthChecks.filter(h => h.latency_ms != null);
    if (!withLatency.length) return 0;
    return Math.round(withLatency.reduce((sum, h) => sum + (h.latency_ms ?? 0), 0) / withLatency.length);
  }, [healthChecks]);

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity size={22} className="text-primary" />
            مراقبة صحة التكاملات
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            حالة الاتصال في الوقت الفعلي لجميع بوابات الدفع المتصلة
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["integration-health-checks"] });
            queryClient.invalidateQueries({ queryKey: ["integration-alerts"] });
            toast.success("جارٍ تحديث البيانات...");
          }}
        >
          <RefreshCw size={13} /> تحديث
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "سليم", value: stats.healthy, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
          { label: "بطيء", value: stats.degraded, icon: MinusCircle, color: "text-warning", bg: "bg-warning/10" },
          { label: "متوقف", value: stats.down, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "متوسط الاستجابة", value: `${avgLatency}ms`, icon: Gauge, color: "text-primary", bg: "bg-primary/10" },
        ].map((card, i) => (
          <Card key={i} className="border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", card.bg)}>
                <card.icon size={18} className={card.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{loadingHealth ? "..." : card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Unresolved Alert Banner ── */}
      {unresolvedAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
        >
          <AlertTriangle size={18} className="text-destructive shrink-0" />
          <p className="text-sm font-medium text-destructive flex-1">
            {unresolvedAlerts.length} تنبيه نشط يحتاج مراجعة
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-destructive hover:text-destructive"
            onClick={() => setActiveTab("alerts")}
          >
            عرض التنبيهات
          </Button>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto p-1 bg-muted/40 rounded-xl w-full justify-start gap-0.5">
          <TabsTrigger value="overview" className="gap-1.5 text-xs px-4 py-2 rounded-lg">
            <Server size={13} /> نظرة عامة
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{stats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs px-4 py-2 rounded-lg">
            <Bell size={13} /> التنبيهات
            {unresolvedAlerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{unresolvedAlerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-muted-foreground" />
            <div className="flex gap-1.5">
              {(["all", "healthy", "degraded", "down"] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? "default" : "ghost"}
                  className="text-xs h-7 px-3"
                  onClick={() => setStatusFilter(f)}
                >
                  {f === "all" ? "الكل" : STATUS_CONFIG[f].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Health Table */}
          {loadingHealth ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Wifi size={40} className="text-muted-foreground/30" />
              <p className="text-muted-foreground">
                {stats.total === 0 ? "لا توجد تكاملات متصلة بعد" : "لا توجد نتائج مطابقة"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredChecks.map((check, i) => {
                  const cfg = STATUS_CONFIG[check.status];
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={check.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className="border-border/30 hover:border-border/50 transition-colors">
                        <CardContent className="p-4 flex items-center gap-4">
                          {/* Provider logo */}
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background p-1.5 shrink-0">
                            <BrandLogo provider={check.provider_key as any} className="h-7 w-auto max-w-[32px] object-contain" />
                          </div>

                          {/* Provider info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">
                                {PROVIDER_NAMES[check.provider_key] || check.provider_key}
                              </h3>
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                cfg.bgColor, cfg.color
                              )}>
                                <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotColor, check.status === "healthy" && "animate-pulse")} />
                                {cfg.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatDistanceToNow(new Date(check.last_checked_at), { addSuffix: true, locale: ar })}
                              </span>
                              {check.latency_ms != null && (
                                <span className="flex items-center gap-1">
                                  <Zap size={10} />
                                  {check.latency_ms}ms
                                </span>
                              )}
                              {check.consecutive_failures > 0 && (
                                <span className="flex items-center gap-1 text-destructive">
                                  <ArrowDownCircle size={10} />
                                  {check.consecutive_failures} فشل متتالي
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Error info */}
                          {check.error_message && (
                            <div className="hidden sm:block max-w-[200px]">
                              <p className="text-[11px] text-destructive/80 line-clamp-1" title={check.error_message}>
                                {check.error_message}
                              </p>
                              {check.error_code && (
                                <Badge variant="outline" className="text-[9px] mt-0.5 font-mono">
                                  {check.error_code}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Status icon */}
                          <Icon size={20} className={cn(cfg.color, "shrink-0")} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ── Alerts Tab ── */}
        <TabsContent value="alerts" className="mt-4 space-y-3">
          {loadingAlerts ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (alerts ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <BellOff size={40} className="text-muted-foreground/30" />
              <p className="text-muted-foreground">لا توجد تنبيهات</p>
            </div>
          ) : (
            <AnimatePresence>
              {(alerts ?? []).map((alert, i) => {
                const sevCfg = SEVERITY_CONFIG[alert.severity];
                const SevIcon = sevCfg.icon;
                const isResolved = !!alert.resolved_at;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card className={cn(
                      "border-border/30",
                      isResolved && "opacity-60"
                    )}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                          sevCfg.bgColor
                        )}>
                          <SevIcon size={16} className={sevCfg.color} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
                            <Badge variant="outline" className={cn("text-[10px]", sevCfg.color)}>
                              {sevCfg.label}
                            </Badge>
                            {isResolved && (
                              <Badge variant="secondary" className="text-[10px] text-success">
                                <CheckCircle2 size={9} className="me-0.5" /> تم الحل
                              </Badge>
                            )}
                          </div>
                          {alert.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.body}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ar })}
                            </span>
                            <span className="font-mono">{PROVIDER_NAMES[alert.provider_key] || alert.provider_key}</span>
                          </div>
                        </div>

                        {!isResolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs gap-1 h-7 shrink-0"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle2 size={12} /> إغلاق
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationHealthDashboard;
