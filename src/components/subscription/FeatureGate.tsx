import { useFeatureGate, type FeatureKey } from "@/hooks/useEntitlements";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURE_RBAC_MAP } from "@/lib/feature-route-map";
import { Lock, Crown, Bug, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";

// Simple string similarity (Dice coefficient)
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bi = a.substring(i, i + 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }
  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bi = b.substring(i, i + 2);
    const count = bigrams.get(bi) || 0;
    if (count > 0) {
      bigrams.set(bi, count - 1);
      intersect++;
    }
  }
  return (2 * intersect) / (a.length + b.length - 2);
}

interface FeatureGateProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
  featureLabel?: string;
  featureDescription?: string;
  inline?: boolean;
}

/**
 * Universal feature gate component.
 * Reads from EntitlementsContext ONLY — zero RPC calls.
 * While loading: renders children with skeleton overlay (non-blocking).
 */
const FeatureGate = ({
  featureKey,
  children,
  featureLabel,
  featureDescription,
  inline = false,
}: FeatureGateProps) => {
  const { allowed: entAllowed, loading: entLoading, reason: entReason } = useFeatureGate(featureKey);
  const { entitlementsMap, planSlug, planStatus } = useEntitlementsContext();
  const { can: canRbac, canAny: canAnyRbac, loading: rbacLoading } = useGranularPermissions();
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isDev = import.meta.env.DEV;
  const debugParam = searchParams.get("debugEnt") === "1";
  const showDebug = isDev || debugParam;

  const keyExists = featureKey in entitlementsMap;

  // RBAC check: if this feature has mapped RBAC permissions, check them first
  const rbacPerms = FEATURE_RBAC_MAP[featureKey];
  const rbacAllowed = useMemo(() => {
    if (!rbacPerms || rbacPerms.length === 0) return true; // no RBAC gate
    if (userRole === "owner") return true; // owner bypasses RBAC
    return canAnyRbac(...rbacPerms);
  }, [rbacPerms, userRole, canAnyRbac]);

  const rbacReason = !rbacAllowed ? "no_permission" : "ok";

  // Combined: RBAC blocks first, then entitlements
  const loading = entLoading || rbacLoading;
  const allowed = rbacAllowed && entAllowed;
  const reason = !rbacAllowed ? "rbac_denied" : entReason;
  const isRbacDenial = !rbacAllowed;

  const closestKeys = useMemo(() => {
    if (keyExists) return [];
    const allKeys = Object.keys(entitlementsMap);
    return allKeys
      .map((k) => ({ key: k, score: stringSimilarity(featureKey, k) }))
      .filter((x) => x.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [featureKey, keyExists, entitlementsMap]);

  // Console warning for locked features
  useEffect(() => {
    if (!loading && !allowed) {
      console.warn(
        `[FeatureGate] locked | key=${featureKey} | reason=${reason} | plan=${planSlug} | found=${keyExists} | rbacAllowed=${rbacAllowed} | rbacReason=${rbacReason}`
      );
    }
  }, [loading, allowed, featureKey, reason, planSlug, keyExists, rbacAllowed, rbacReason]);

  const debugBlock = showDebug && !loading && !allowed && (
    <div className="mt-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-[10px] font-mono text-destructive/80 space-y-0.5 max-w-sm" dir="ltr">
      <div className="flex items-center gap-1 font-bold text-[11px] mb-1">
        <Bug size={12} /> FeatureGate Debug
      </div>
      <div>featureKey: <span className="text-foreground">{featureKey}</span></div>
      <div>allowed: <span className="text-foreground">{String(allowed)}</span></div>
      <div>reason: <span className="text-foreground">{reason || "—"}</span></div>
      <div>planSlug: <span className="text-foreground">{planSlug || "—"}</span></div>
      <div>planStatus: <span className="text-foreground">{planStatus || "—"}</span></div>
      <div>keyInMap: <span className={keyExists ? "text-foreground" : "text-destructive font-bold"}>{String(keyExists)}</span></div>
      <div className="border-t border-destructive/20 pt-1 mt-1">
        <div>rbacAllowed: <span className={rbacAllowed ? "text-foreground" : "text-destructive font-bold"}>{String(rbacAllowed)}</span></div>
        <div>rbacReason: <span className="text-foreground">{rbacReason}</span></div>
        <div>rbacPerms: <span className="text-foreground">{rbacPerms?.join(", ") || "none"}</span></div>
        <div>userRole: <span className="text-foreground">{userRole || "—"}</span></div>
      </div>
      {!keyExists && closestKeys.length > 0 && (
        <div>
          closest: {closestKeys.map((c) => `${c.key}(${(c.score * 100).toFixed(0)}%)`).join(", ")}
        </div>
      )}
    </div>
  );

  // Non-blocking: while loading, show children with a subtle loading indicator
  if (loading) {
    return (
      <div className="relative">
        <div className="opacity-60 pointer-events-none">{children}</div>
        <div className="absolute top-2 start-2 z-10">
          <div className="flex items-center gap-1.5 rounded-md bg-muted/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
            <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            جارٍ التحقق...
          </div>
        </div>
      </div>
    );
  }

  if (!allowed) {
    // RBAC denial: "No permission" UI
    if (isRbacDenial) {
      if (inline) {
        return (
          <div dir="rtl">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <ShieldAlert size={14} />
              <span>
                ليس لديك صلاحية للوصول إلى {featureLabel || "هذه الميزة"}.
                تواصل مع مدير النظام لتعديل صلاحياتك.
              </span>
            </div>
            {debugBlock}
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center" dir="rtl">
          <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl font-bold text-foreground">
              لا توجد صلاحية
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ليس لديك الصلاحيات اللازمة للوصول إلى {featureLabel || "هذه الميزة"}.
              تواصل مع مالك الحساب أو المدير لتعديل صلاحياتك.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            العودة للرئيسية
          </Button>
          {debugBlock}
        </div>
      );
    }

    // Entitlement denial: "Upgrade plan" UI
    if (inline) {
      return (
        <div dir="rtl">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <Lock size={14} />
            <span>
              {featureLabel || "هذه الميزة"} تتطلب ترقية الباقة.{" "}
              <button
                onClick={() => navigate("/dashboard/subscription")}
                className="font-medium text-primary hover:underline"
              >
                ترقية الآن
              </button>
            </span>
          </div>
          {debugBlock}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center" dir="rtl">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Crown className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-foreground">
            {featureLabel || "ميزة متقدمة"}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {featureDescription ||
              "هذه الميزة غير متاحة في باقتك الحالية. قم بالترقية للوصول إلى جميع الميزات المتقدمة."}
          </p>
          <p className="text-xs text-muted-foreground">
            بياناتك محفوظة ولن تُحذف. يمكنك الترقية في أي وقت.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/dashboard/subscription")} className="gap-2">
            <Lock size={14} />
            ترقية الباقة
          </Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            العودة للرئيسية
          </Button>
        </div>
        {debugBlock}
      </div>
    );
  }

  return <>{children}</>;
};

export default FeatureGate;
