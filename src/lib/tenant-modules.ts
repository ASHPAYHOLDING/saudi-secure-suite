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
  | "inventory"
  | "reports"
  | "analytics"
  | "team"
  | "company"
  | "branding"
  | "compliance"
  | "stamp"
  | "audit"
  | "subscription"
  | "settings"
  | "help";

const MODULE_ACCESS: Record<TenantType, Module[]> = {
  individual: ["dashboard", "billing", "subscription", "settings", "help"],
  freelancer: ["dashboard", "customers", "billing", "subscription", "settings", "help"],
  company: [
    "dashboard",
    "customers",
    "billing",
    "contracts",
    "inventory",
    "reports",
    "analytics",
    "team",
    "company",
    "branding",
    "compliance",
    "stamp",
    "audit",
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
