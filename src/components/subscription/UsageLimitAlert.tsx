import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Rocket, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UsageItem {
  key: string;
  label: string;
  current: number;
  limit: number | null;
  unlimited: boolean;
}

/**
 * Smart upsell component that shows contextual alerts when user approaches resource limits.
 * Placed inside dashboard pages to drive upgrades.
 */
const UsageLimitAlert = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [alerts, setAlerts] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const load = async () => {
      try {
        const { data } = await supabase.rpc("get_tenant_usage_summary", { _tenant_id: tenantId });
        if (!data) return;

        const usage = data as any;
        if (usage.is_trial) return;

        const items: UsageItem[] = [];

        const checkUsage = (key: string, label: string, usageData: any) => {
          if (!usageData || usageData.unlimited || !usageData.limit) return;
          const pct = Math.round((usageData.current / usageData.limit) * 100);
          if (pct >= 75) {
            items.push({ key, label, current: usageData.current, limit: usageData.limit, unlimited: false });
          }
        };

        checkUsage("users", "المستخدمون", usage.users);
        checkUsage("invoices", "الفواتير الشهرية", usage.invoices_monthly);
        checkUsage("storage", "التخزين", usage.storage_gb);

        setAlerts(items);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tenantId]);

  if (loading || alerts.length === 0) return null;

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.key));
  if (visibleAlerts.length === 0) return null;

  return (
    <AnimatePresence>
      {visibleAlerts.map((alert) => {
        const pct = Math.round((alert.current / (alert.limit || 1)) * 100);
        const isCritical = pct >= 100;
        const isWarning = pct >= 75 && pct < 100;

        return (
          <motion.div
            key={alert.key}
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
              isCritical
                ? "border-destructive/20 bg-destructive/5"
                : "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/30"
            }`}
            dir="rtl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isCritical ? "bg-destructive/10" : "bg-amber-100 dark:bg-amber-900/30"
              }`}>
                {isCritical ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isCritical ? "text-destructive" : "text-amber-800 dark:text-amber-300"}`}>
                  {isCritical
                    ? `${alert.label}: وصلت للحد الأقصى!`
                    : `${alert.label}: ${pct}% من الحد المسموح`}
                </p>
                <p className={`text-xs ${isCritical ? "text-destructive/70" : "text-amber-600 dark:text-amber-400"}`}>
                  {alert.current} من {alert.limit} — {isCritical ? "قم بالترقية الآن للاستمرار" : "قم بالترقية قبل الوصول للحد"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => navigate("/dashboard/subscription")}
                className={`gap-1.5 rounded-lg h-9 px-4 ${
                  isCritical ? "bg-destructive hover:bg-destructive/90" : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
              >
                <Rocket size={14} />
                ترقية سريعة
              </Button>
              {isWarning && (
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, alert.key]))}
                  className="text-amber-400 hover:text-amber-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};

export default UsageLimitAlert;
