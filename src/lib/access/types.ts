/**
 * Shared role types and presentation constants.
 * Moved from the deprecated roles.ts — no permission logic here.
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
