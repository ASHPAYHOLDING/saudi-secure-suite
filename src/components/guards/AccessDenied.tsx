import React from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowUpCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AccessDeniedReason =
  | "feature_not_in_plan"
  | "permission_denied"
  | "module_not_allowed"
  | "route_not_gated"
  | "loading";

type Props = {
  reason: AccessDeniedReason;
  featureLabel?: string;
};

export default function AccessDenied({ reason, featureLabel }: Props) {
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
    if (reason === "loading") return "جارٍ التحقق من الصلاحيات";
    return "ليس لديك صلاحية الوصول";
  };

  const getDescription = () => {
    if (isUpgrade)
      return `${featureLabel ? `ميزة "${featureLabel}" ` : ""}غير مفعّلة في خطتك الحالية. قم بالترقية للوصول إليها.`;
    if (isModuleBlock)
      return "هذه الميزة غير متاحة لنوع اشتراكك الحالي. تواصل مع الدعم لمزيد من المعلومات.";
    if (isFailClosed)
      return "هذه الصفحة غير متاحة حالياً أو لم يتم تعريف صلاحياتها بشكل صحيح. تم حظرها لحماية النظام.";
    if (reason === "loading")
      return "انتظر لحظات… نتحقق من الاشتراك والصلاحيات.";
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
          <Button onClick={() => navigate("/dashboard/subscription")} className="gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            ترقية الباقة
          </Button>
        )}

        {reason === "permission_denied" && (
          <Button variant="outline" onClick={() => navigate("/dashboard/settings")} className="gap-2">
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
}
