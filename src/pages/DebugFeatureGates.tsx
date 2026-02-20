import { FEATURE_KEYS, type FeatureKey } from "@/lib/entitlement-types";
import { ROUTE_FEATURE_MAP } from "@/lib/feature-route-map";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, Lock, ShieldAlert, RefreshCw, Route } from "lucide-react";
import { Link } from "react-router-dom";

// MUST stay in sync with FeatureGate.tsx FEATURE_RBAC_MAP
const FEATURE_RBAC_MAP: Partial<Record<string, string[]>> = {
  [FEATURE_KEYS.INVOICES_BASIC]: ["invoices.view", "invoices.create"],
  [FEATURE_KEYS.EXPENSES]: ["expenses.view", "expenses.create"],
  [FEATURE_KEYS.JOURNAL_ENTRIES]: ["finance.view_overview"],
  [FEATURE_KEYS.ACCOUNTING_ADVANCED]: ["finance.view_reports"],
  [FEATURE_KEYS.ADVANCED_REPORTS]: ["finance.view_reports"],
  [FEATURE_KEYS.CONTRACTS]: ["contracts.view", "contracts.create"],
  [FEATURE_KEYS.BRANCHES]: ["branches.view"],
  [FEATURE_KEYS.QUOTATIONS]: ["quotations.view", "quotations.create"],
  [FEATURE_KEYS.SALES_ORDERS]: ["sales_orders.view"],
  [FEATURE_KEYS.PURCHASE_ORDERS]: ["purchase_orders.view"],
  [FEATURE_KEYS.DELIVERY_NOTES]: ["purchase_orders.view"],
  [FEATURE_KEYS.INVENTORY]: ["inventory.view"],
  [FEATURE_KEYS.WALLET]: ["subscription.view"],
  [FEATURE_KEYS.AUDIT_LOG]: ["audit.view"],
  [FEATURE_KEYS.TEAM_MANAGEMENT]: ["team.view"],
  [FEATURE_KEYS.CUSTOMERS]: ["customers.view"],
  [FEATURE_KEYS.ANALYTICS]: ["finance.view_analytics"],
  [FEATURE_KEYS.BRANDING]: ["settings.branding"],
  [FEATURE_KEYS.STAMP]: ["settings.stamp"],
  [FEATURE_KEYS.PAID_INTEGRATIONS]: ["settings.integrations"],
  [FEATURE_KEYS.NUMAXIO_PAY]: ["subscription.manage"],
  [FEATURE_KEYS.PAYMENT_REMINDERS]: ["invoices.view"],
  [FEATURE_KEYS.ZATCA_PHASE1]: ["settings.compliance"],
};

// All routes from Dashboard.tsx that use withGate() or should be gated
const ALL_DASHBOARD_ROUTES: { segment: string; path: string; label: string }[] = [
  { segment: "billing", path: "/dashboard/billing", label: "Invoices / Billing" },
  { segment: "customers", path: "/dashboard/customers", label: "Customers" },
  { segment: "quotations", path: "/dashboard/quotations", label: "Quotations" },
  { segment: "sales-orders", path: "/dashboard/sales-orders", label: "Sales Orders" },
  { segment: "purchase-orders", path: "/dashboard/purchase-orders", label: "Purchase Orders" },
  { segment: "delivery-notes", path: "/dashboard/delivery-notes", label: "Delivery Notes" },
  { segment: "supplier-inbox", path: "/dashboard/supplier-inbox", label: "Supplier Inbox" },
  { segment: "expenses", path: "/dashboard/expenses", label: "Expenses" },
  { segment: "credit-notes", path: "/dashboard/credit-notes", label: "Credit Notes" },
  { segment: "inventory", path: "/dashboard/inventory", label: "Inventory" },
  { segment: "contracts", path: "/dashboard/contracts", label: "Contracts" },
  { segment: "journal-entries", path: "/dashboard/journal-entries", label: "Journal Entries" },
  { segment: "period-lock", path: "/dashboard/period-lock", label: "Period Lock" },
  { segment: "vat-return", path: "/dashboard/vat-return", label: "VAT Return" },
  { segment: "reports", path: "/dashboard/reports", label: "Reports" },
  { segment: "report-builder", path: "/dashboard/report-builder", label: "Custom Report Builder" },
  { segment: "analytics", path: "/dashboard/analytics", label: "Analytics" },
  { segment: "smart-query", path: "/dashboard/smart-query", label: "Smart Query (AI)" },
  { segment: "forecasting", path: "/dashboard/forecasting", label: "Forecasting" },
  { segment: "wallet", path: "/dashboard/wallet", label: "Wallet" },
  { segment: "numaxio-pay", path: "/dashboard/numaxio-pay", label: "Numaxio Pay" },
  { segment: "payment-reminders", path: "/dashboard/payment-reminders", label: "Payment Reminders" },
  { segment: "stamp", path: "/dashboard/stamp", label: "Stamp" },
  { segment: "branding", path: "/dashboard/branding", label: "Branding" },
  { segment: "compliance", path: "/dashboard/compliance", label: "Compliance (ZATCA)" },
  { segment: "branches", path: "/dashboard/branches", label: "Branches" },
  { segment: "team", path: "/dashboard/team", label: "Team Management" },
  { segment: "permissions", path: "/dashboard/permissions", label: "Permissions" },
  { segment: "audit", path: "/dashboard/audit", label: "Audit Log" },
  { segment: "paid-integrations", path: "/dashboard/paid-integrations", label: "Paid Integrations" },
  { segment: "budgets", path: "/dashboard/budgets", label: "Budgets (no gate)" },
  { segment: "integrations", path: "/dashboard/integrations", label: "Integrations (no gate)" },
  { segment: "company", path: "/dashboard/company", label: "Company Settings (no gate)" },
  { segment: "settings", path: "/dashboard/settings", label: "Settings (no gate)" },
  { segment: "finance", path: "/dashboard/finance", label: "Financial Overview (no gate)" },
  { segment: "chat", path: "/dashboard/chat", label: "Chat (no gate)" },
  { segment: "approvals", path: "/dashboard/approvals", label: "Approvals (no gate)" },
  { segment: "subscription", path: "/dashboard/subscription", label: "Subscription (no gate)" },
  { segment: "help", path: "/dashboard/help", label: "Help (no gate)" },
  { segment: "wallet", path: "/dashboard/wallet", label: "Wallet" },
  { segment: "api-keys", path: "/dashboard/api-keys", label: "API Keys (no gate)" },
  { segment: "data-quality", path: "/dashboard/data-quality", label: "Data Quality (no gate)" },
  { segment: "group", path: "/dashboard/group", label: "Group Dashboard (no gate)" },
  { segment: "affiliate", path: "/dashboard/affiliate", label: "Affiliate (no gate)" },
];

const DebugFeatureGates = () => {
  const { entitlementsMap, planSlug, planStatus, loading, invalidate } = useEntitlementsContext();
  const { canAny, can, loading: rbacLoading } = useGranularPermissions();
  const { userRole } = useAuth();

  const isOwner = userRole === "owner";

  const routeRows = ALL_DASHBOARD_ROUTES.map((route) => {
    const mapping = ROUTE_FEATURE_MAP[route.segment];
    const featureKey = mapping?.featureKey;
    const entEntry = featureKey ? entitlementsMap[featureKey] : null;
    const entAllowed = !featureKey || !!(entEntry?.allowed);
    const entReason = entEntry?.reason ?? (featureKey ? "not_found" : "no_gate");

    const rbacPerms = featureKey ? FEATURE_RBAC_MAP[featureKey] : null;
    const rbacAllowed = !rbacPerms || isOwner || canAny(...(rbacPerms as string[]));

    const overallAllowed = entAllowed && rbacAllowed;
    const blockedBy = !entAllowed ? "entitlement" : !rbacAllowed ? "rbac" : null;

    return { route, featureKey, mapping, entAllowed, entReason, rbacPerms, rbacAllowed, overallAllowed, blockedBy };
  });

  const blockedRoutes = routeRows.filter((r) => !r.overallAllowed);
  const unGatedRoutes = routeRows.filter((r) => !r.featureKey);
  const gatedRoutes = routeRows.filter((r) => r.featureKey);

  // Find FEATURE_KEYS that exist in code but have NO route mapping
  const mappedFeatureKeys = new Set(Object.values(ROUTE_FEATURE_MAP).map((m) => m.featureKey));
  const unmappedKeys = Object.values(FEATURE_KEYS).filter((k) => !mappedFeatureKeys.has(k as FeatureKey));

  return (
    <div dir="ltr" className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🗺️ Feature Gates Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All dashboard routes and their entitlement / RBAC gating status
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={invalidate} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Refetch
          </Button>
          <Link to="/debug/entitlements">
            <Button size="sm" variant="outline">→ Entitlements Debug</Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="font-bold">{planSlug || "—"}</p>
            <Badge variant={planStatus === "active" ? "default" : "destructive"} className="text-[10px] mt-1">
              {planStatus || "unknown"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Routes</p>
            <p className="font-bold text-2xl">{ALL_DASHBOARD_ROUTES.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Gated Routes</p>
            <p className="font-bold text-2xl text-primary">{gatedRoutes.length}</p>
          </CardContent>
        </Card>
      <Card className={blockedRoutes.length > 0 ? "border-destructive/40" : "border-green-500/40"}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Blocked (for you)</p>
            <p className={`font-bold text-2xl ${blockedRoutes.length > 0 ? "text-destructive" : "text-green-600"}`}>
              {blockedRoutes.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked routes alert */}
      {blockedRoutes.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle size={14} />
              {blockedRoutes.length} Blocked Route(s) for Current User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {blockedRoutes.map(({ route, featureKey, blockedBy, entReason, rbacPerms }) => (
                <div key={route.path} className="flex items-center gap-2 text-xs font-mono">
                  <XCircle size={12} className="text-destructive shrink-0" />
                  <span className="font-bold">{route.path}</span>
                  <Badge variant="destructive" className="text-[9px]">
                    {blockedBy === "entitlement" ? `entitlement:${entReason}` : `rbac:${rbacPerms?.join(",")}`}
                  </Badge>
                  {featureKey && <span className="text-muted-foreground">[{featureKey}]</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unmapped feature keys */}
      {unmappedKeys.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-warning-foreground flex items-center gap-2">
              <AlertTriangle size={14} />
              {unmappedKeys.length} FEATURE_KEY(s) with No Route Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {unmappedKeys.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px] font-mono">
                  {k}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These keys are defined in FEATURE_KEYS but not gating any route in ROUTE_FEATURE_MAP. They may be used inline in components or are capacity limits.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Full routes table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Route size={14} />
            All Dashboard Routes
            {(loading || rbacLoading) && <span className="text-[10px] text-muted-foreground animate-pulse">loading…</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 pe-3 font-medium">Route</th>
                  <th className="text-start py-2 pe-3 font-medium">Feature Key</th>
                  <th className="text-start py-2 pe-3 font-medium">Entitlement</th>
                  <th className="text-start py-2 pe-3 font-medium">RBAC Perms</th>
                  <th className="text-start py-2 pe-3 font-medium">RBAC</th>
                  <th className="text-start py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {routeRows.map(({ route, featureKey, entAllowed, entReason, rbacPerms, rbacAllowed, overallAllowed }) => (
                  <tr
                    key={route.path}
                    className={`border-b border-border/20 hover:bg-muted/20 ${
                      !overallAllowed ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="py-2 pe-3 font-mono">{route.path}</td>
                    <td className="py-2 pe-3">
                      {featureKey ? (
                        <span className="font-mono text-primary">{featureKey}</span>
                      ) : (
                        <span className="text-muted-foreground italic">no gate</span>
                      )}
                    </td>
                    <td className="py-2 pe-3">
                      {!featureKey ? (
                        <span className="text-muted-foreground">—</span>
                      ) : entAllowed ? (
                        <div className="flex items-center gap-1 text-primary">
                          <CheckCircle2 size={11} />
                          <span>{entReason}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive">
                          <XCircle size={11} />
                          <span>{entReason}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 pe-3 max-w-[180px]">
                      {rbacPerms ? (
                        <span className="font-mono text-[10px] text-muted-foreground break-all">
                          {rbacPerms.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pe-3">
                      {!rbacPerms ? (
                        <span className="text-muted-foreground">—</span>
                      ) : rbacAllowed ? (
                        <div className="flex items-center gap-1 text-primary">
                          <CheckCircle2 size={11} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-destructive">
                          <ShieldAlert size={11} />
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      {overallAllowed ? (
                        <Badge variant="secondary" className="text-[9px]">
                          ✓ allowed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px]">
                          ✗ blocked
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ungated routes summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Un-gated Routes (always accessible)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {unGatedRoutes.map(({ route }) => (
              <Badge key={route.path} variant="outline" className="text-[10px] font-mono">
                {route.path}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugFeatureGates;
