import { useMemo } from "react";

/**
 * Role definitions and permission checks.
 * Maps to the app_role enum: owner | admin | manager | hr | accountant | member
 */

export type AppRole = "owner" | "admin" | "manager" | "hr" | "accountant" | "member";

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "مالك",
  admin: "مدير",
  manager: "مدير قسم",
  hr: "موارد بشرية",
  accountant: "محاسب",
  member: "موظف",
};

export const ROLE_COLORS: Record<AppRole, string> = {
  owner: "bg-accent/10 text-accent",
  admin: "bg-info/10 text-info",
  manager: "bg-warning/10 text-warning",
  hr: "bg-success/10 text-success",
  accountant: "bg-primary/10 text-primary-foreground",
  member: "bg-muted text-muted-foreground",
};

type Permission =
  | "invoices.create"
  | "invoices.edit"
  | "invoices.delete"
  | "contracts.create"
  | "contracts.edit"
  | "contracts.delete"
  | "contracts.sign"
  | "stamp.edit"
  | "templates.edit"
  | "audit.view"
  | "users.manage"
  | "settings.edit";

const PERMISSION_MAP: Record<Permission, AppRole[]> = {
  "invoices.create": ["owner", "admin", "accountant"],
  "invoices.edit": ["owner", "admin", "accountant"],
  "invoices.delete": ["owner", "admin"],
  "contracts.create": ["owner", "admin", "manager", "accountant"],
  "contracts.edit": ["owner", "admin", "manager", "accountant"],
  "contracts.delete": ["owner", "admin"],
  "contracts.sign": ["owner", "admin"],
  "stamp.edit": ["owner", "admin"],
  "templates.edit": ["owner", "admin"],
  "audit.view": ["owner", "admin"],
  "users.manage": ["owner", "admin"],
  "settings.edit": ["owner", "admin"],
};

export const hasPermission = (role: AppRole, permission: Permission): boolean => {
  return PERMISSION_MAP[permission]?.includes(role) ?? false;
};

/**
 * Hook that returns permission checkers for a given role.
 * In demo mode (no auth), defaults to "owner" for full access.
 */
export const usePermissions = (role: AppRole = "owner") => {
  return useMemo(() => ({
    role,
    roleLabel: ROLE_LABELS[role],
    can: (permission: Permission) => hasPermission(role, permission),
    isFinance: ["owner", "admin", "accountant"].includes(role),
    isHR: ["owner", "admin", "hr", "manager"].includes(role),
    isAdmin: ["owner", "admin"].includes(role),
  }), [role]);
};
