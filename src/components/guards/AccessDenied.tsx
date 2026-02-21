import { Shield, Lock, ArrowUpCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AccessDeniedProps {
  reason: "feature_not_in_plan" | "permission_denied" | "loading" | "module_not_allowed" | "route_not_gated";
  featureLabel?: string;
}

/**
 * Unified AccessDenied page.
 * - "feature_not_in_plan" → upgrade button
 * - "permission_denied"   → request permission button
 * - "module_not_allowed"  → tenant type doesn't support this module
 * - "route_not_gated"     → fail-closed for unknown routes in production
 */
const AccessDenied = ({ reason, featureLabel }: AccessDeniedProps) => {
  const navigate = useNavigate();

  const isUpgrade = reason === "feature_not_in_plan";
  const isModuleBlock = reason === "module_not_allowed";
  const isFailClosed = reason === "route_not_gated";

  const getIcon = () => {
    if (isUpgrade) return <Lock className="h-12 w-12 text-destructive" />;
    if (isFailClosed || isModuleBlock) return <Ban className="h-12 w-12 text-destructive" />;
    return <Shield className="h-12 w-12 text-destructive" />;
  };

  const getTitle = () => {
    if (isUpgrade) return "ميزة غير متاحة في باقتك الحالية";
    if (isModuleBlock) return "هذه الصفحة غير متاحة لنوع حسابك";
    if (isFailClosed) return "الصفحة غير متاحة";
    return "ليس لديك صلاحية الوصول";
  };

  const getDescription = () => {
    if (isUpgrade)
      return `${featureLabel ? `"${featureLabel}" ` : ""}غير مفعّلة في خطتك الحالية. قم بالترقية للوصول إلى هذه الميزة.`;
    if (isModuleBlock)
      return "هذه الميزة غير متاحة لنوع اشتراكك الحالي. تواصل مع الدعم لمزيد من المعلومات.";
    if (isFailClosed)
      return "هذه الصفحة غير متاحة حالياً أو لا تملك صلاحية الوصول إليها.";
    return "ليس لديك الصلاحيات المطلوبة للوصول إلى هذه الصفحة. تواصل مع مدير الحساب لطلب الصلاحية.";
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
      <div className="rounded-full bg-destructive/10 p-5">
        {getIcon()}
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold text-foreground">{getTitle()}</h1>
        <p className="text-muted-foreground text-base">{getDescription()}</p>
      </div>

      <div className="flex gap-3">
        {isUpgrade && (
          <Button
            onClick={() => navigate("/dashboard/subscription")}
            className="gap-2"
          >
            <ArrowUpCircle className="h-4 w-4" />
            ترقية الباقة
          </Button>
        )}
        {reason === "permission_denied" && (
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
