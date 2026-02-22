/**
 * Feature key constants — single source of truth.
 * Maps to `plan_entitlements.feature_key` in the database.
 */
export const FEATURE_KEYS = {
  INVOICES_BASIC: "invoices_basic",
  CUSTOMERS: "customers",
  ZATCA_PHASE1: "zatca_phase1",
  ZATCA_PHASE2: "zatca_phase2",
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
  BUDGETS_BASIC: "budgets_basic",
  BUDGETS_ALERTS: "budgets_alerts",
  BUDGETS_ADVANCED: "budgets_advanced",
  ENTERPRISE_MODE: "enterprise_mode",
  // ─── New pricing keys ───
  AI_ACCOUNTING: "ai_accounting",
  APPROVALS_ENABLED: "approvals_enabled",
  CUSTOM_WORKFLOWS: "custom_workflows",
  INTERNAL_FINANCING: "internal_financing",
  VAT_AUTO_RETURN: "vat_auto_return",
  // ─── HR ───
  HR_CORE: "hr",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/** Plan slug type — matches database subscription_plans.slug */
export type PlanSlug = "starter" | "business" | "enterprise";

export interface EntitlementResult {
  allowed: boolean;
  reason: string;
  limit?: number | null;
  plan?: string;
}
