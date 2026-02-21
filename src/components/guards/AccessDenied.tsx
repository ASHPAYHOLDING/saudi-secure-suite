import { Shield, Lock, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AccessDeniedProps {
  reason: "feature_not_in_plan" | "permission_denied" | "loading";
  featureLabel?: string;
}

/**
 * Unified AccessDenied page.
 * - "feature_not_in_plan" → upgrade button
 * - "permission_denied"   → request permission button
 */
const AccessDenied = ({ reason, featureLabel }: AccessDeniedProps) => {
  const navigate = useNavigate();

  const isUpgrade = reason === "feature_not_in_plan";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
      <div className="rounded-full bg-destructive/10 p-5">
        {isUpgrade ? (
          <Lock className="h-12 w-12 text-destructive" />
        ) : (
          <Shield className="h-12 w-12 text-destructive" />
        )}
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold text-foreground">
          {isUpgrade ? "ميزة غير متاحة في باقتك الحالية" : "ليس لديك صلاحية الوصول"}
        </h1>
        <p className="text-muted-foreground text-base">
          {isUpgrade
            ? `${featureLabel ? `"${featureLabel}" ` : ""}غير مفعّلة في خطتك الحالية. قم بالترقية للوصول إلى هذه الميزة.`
            : "ليس لديك الصلاحيات المطلوبة للوصول إلى هذه الصفحة. تواصل مع مدير الحساب لطلب الصلاحية."}
        </p>
      </div>

      <div className="flex gap-3">
        {isUpgrade ? (
          <Button
            onClick={() => navigate("/dashboard/subscription")}
            className="gap-2"
          >
            <ArrowUpCircle className="h-4 w-4" />
            ترقية الباقة
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/settings")}
            className="gap-2"
          >
            <Shield className="h-4 w-4" />
            طلب صلاحية من المدير
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          العودة للرئيسية
        </Button>
      </div>
    </div>
  );
};

export default AccessDenied;
