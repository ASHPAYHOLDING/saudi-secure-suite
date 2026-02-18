import { useFeatureGate, type FeatureKey } from "@/hooks/useEntitlements";
import { Loader2, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface FeatureGateProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
  /** Feature display name in Arabic */
  featureLabel?: string;
  /** Feature description in Arabic */
  featureDescription?: string;
  /** Render as inline badge instead of full-page block */
  inline?: boolean;
}

/**
 * Universal feature gate component.
 * If the feature is disabled for the current plan:
 *   - Full-page mode: shows upgrade CTA (default)
 *   - Inline mode: shows a compact badge
 * 
 * No partial access — feature is either fully available or fully blocked.
 */
const FeatureGate = ({
  featureKey,
  children,
  featureLabel,
  featureDescription,
  inline = false,
}: FeatureGateProps) => {
  const { allowed, loading } = useFeatureGate(featureKey);
  const navigate = useNavigate();

  if (loading) {
    if (inline) return null;
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
