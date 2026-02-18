import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Feature key constants — single source of truth.
 * Maps to `plan_entitlements.feature_key` in the database.
 */
export const FEATURE_KEYS = {
  INVOICES_BASIC: "invoices_basic",
  CUSTOMERS: "customers",
  ZATCA_PHASE1: "zatca_phase1",
  LIMITED_REPORTS: "limited_reports",
  EXPENSES: "expenses",
  QUOTATIONS: "quotations",
  PAYMENT_REMINDERS: "payment_reminders",
  CONTRACTS: "contracts",
  ADVANCED_REPORTS: "advanced_reports",
  HR: "hr",
  ACCOUNTING_ADVANCED: "accounting_advanced",
  WALLET: "wallet",
  PAID_INTEGRATIONS: "paid_integrations",
  INVENTORY: "inventory",
  BRANCHES: "branches",
  SALES_ORDERS: "sales_orders",
  PURCHASE_ORDERS: "purchase_orders",
  DELIVERY_NOTES: "delivery_notes",
  JOURNAL_ENTRIES: "journal_entries",
  STAMP: "stamp",
  BRANDING: "branding",
  AUDIT_LOG: "audit_log",
  TEAM_MANAGEMENT: "team_management",
  ANALYTICS: "analytics",
  NUMAXIO_PAY: "numaxio_pay",
  MAX_USERS: "max_users",
  MAX_STORAGE_GB: "max_storage_gb",
  SLA_SUPPORT: "sla_support",
  DEDICATED_SUPPORT: "dedicated_support",
  API_ACCESS: "api_access",
  UNLIMITED_EVERYTHING: "unlimited_everything",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

interface EntitlementResult {
  allowed: boolean;
  reason: string;
  limit?: number | null;
  plan?: string;
}

interface EntitlementsState {
  entitlements: Record<string, EntitlementResult>;
  loading: boolean;
  isTrial: boolean;
  planSlug: string | null;
}

/**
 * Bulk-loads all entitlements for the current tenant from the backend.
 * Uses `check_entitlements_bulk` RPC — single source of truth.
 * 
 * Trial = ALL features enabled, no limits.
 */
export const useEntitlements = (featureKeys?: FeatureKey[]): EntitlementsState => {
  const { tenantId } = useAuth();
  const [state, setState] = useState<EntitlementsState>({
    entitlements: {},
    loading: true,
    isTrial: false,
    planSlug: null,
  });

  const keys = featureKeys ?? Object.values(FEATURE_KEYS);

  useEffect(() => {
    if (!tenantId) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const load = async () => {
      try {
        const { data, error } = await supabase.rpc("check_entitlements_bulk", {
          _tenant_id: tenantId,
          _feature_keys: keys,
        });

        if (error || !data) {
          console.error("Entitlements check failed:", error);
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const result = data as unknown as Record<string, EntitlementResult>;
        const firstKey = Object.keys(result)[0];
        const isTrial = firstKey ? result[firstKey]?.reason === "trial" : false;
        const planSlug = firstKey ? result[firstKey]?.plan ?? null : null;

        setState({
          entitlements: result,
          loading: false,
          isTrial,
          planSlug,
        });
      } catch (err) {
        console.error("Entitlements error:", err);
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    load();
  }, [tenantId]);

  return state;
};

/**
 * Check a single feature entitlement.
 * Uses the backend `check_entitlement` RPC.
 */
export const useFeatureGate = (
  featureKey: FeatureKey
): { allowed: boolean; loading: boolean; limit: number | null; reason: string } => {
  const { tenantId } = useAuth();
  const [state, setState] = useState({
    allowed: false,
    loading: true,
    limit: null as number | null,
    reason: "",
  });

  useEffect(() => {
    if (!tenantId) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    supabase
      .rpc("check_entitlement", { _tenant_id: tenantId, _feature_key: featureKey })
      .then(({ data, error }) => {
        if (error || !data) {
          setState({ allowed: false, loading: false, limit: null, reason: "error" });
          return;
        }
        const d = data as unknown as EntitlementResult;
        setState({
          allowed: d.allowed,
          loading: false,
          limit: d.limit ?? null,
          reason: d.reason,
        });
      });
  }, [tenantId, featureKey]);

  return state;
};
