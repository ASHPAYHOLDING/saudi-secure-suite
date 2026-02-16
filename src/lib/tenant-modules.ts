/**
 * Module access control based on tenant_type.
 *
 * - individual: invoices only
 * - freelancer: invoices + customers
 * - company: full system
 *
 * Each module key maps to a dashboard path segment.
 */

export type TenantType = "company" | "individual" | "freelancer";

export type Module =
  | "dashboard"
  | "customers"
  | "billing"
  | "contracts"
  | "quotations"
  | "sales-orders"
  | "purchase-orders"
  | "delivery-notes"
  | "expenses"
  | "inventory"
  | "finance"
  | "journal-entries"
  | "reports"
  | "analytics"
  | "team"
  | "company"
  | "branding"
  | "compliance"
  | "stamp"
  | "audit"
  | "integrations"
  | "subscription"
  | "sheet-view"
  | "branches"
  | "chat"
  | "settings"
  | "help";

const MODULE_ACCESS: Record<TenantType, Module[]> = {
  individual: ["dashboard", "billing", "quotations", "expenses", "finance", "sheet-view", "chat", "subscription", "settings", "help"],
  freelancer: ["dashboard", "customers", "billing", "quotations", "expenses", "finance", "sheet-view", "chat", "subscription", "settings", "help"],
  company: [
    "dashboard",
    "customers",
    "billing",
    "contracts",
    "quotations",
    "sales-orders",
    "purchase-orders",
    "delivery-notes",
    "expenses",
    "inventory",
    "finance",
    "journal-entries",
    "reports",
    "analytics",
    "sheet-view",
    "chat",
    "team",
    "company",
    "branches",
    "branding",
    "compliance",
    "stamp",
    "audit",
    "integrations",
    "subscription",
    "settings",
    "help",
  ],
};

/**
 * Check if a specific module is accessible for a given tenant type.
 */
export const isModuleAllowed = (
  tenantType: TenantType | null | undefined,
  module: Module
): boolean => {
  const type = tenantType ?? "company";
  return MODULE_ACCESS[type]?.includes(module) ?? false;
};

/**
 * Get all allowed modules for a given tenant type.
 */
export const getAllowedModules = (
  tenantType: TenantType | null | undefined
): Module[] => {
  return MODULE_ACCESS[tenantType ?? "company"] ?? MODULE_ACCESS.company;
};
