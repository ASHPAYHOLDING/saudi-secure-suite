import { useFeatureGate, type FeatureKey } from "@/hooks/useEntitlements";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

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
  const { allowed, loading, reason } = useFeatureGate(featureKey);
  const navigate = useNavigate();

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
    if (inline) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground" dir="rtl">
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
          {reason === "not_found" && (
            <p className="text-[10px] text-destructive/60 font-mono mt-1">
              debug: key="{featureKey}" not found in entitlements response
            </p>
          )}
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
      </div>
    );
  }

  return <>{children}</>;
};

export default FeatureGate;
