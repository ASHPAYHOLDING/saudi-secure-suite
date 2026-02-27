/**
 * MFA Enforcement Guard
 * Blocks access to sensitive pages if:
 * - tenant has force_2fa enabled
 * - user role is owner/admin
 * - user does NOT have a verified TOTP factor
 */
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MfaEnforcementGuardProps {
  children: ReactNode;
}

const MfaEnforcementGuard = ({ children }: MfaEnforcementGuardProps) => {
  const { tenantId, userRole } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "allowed" | "blocked">("loading");

  useEffect(() => {
    const check = async () => {
      // Only enforce for owner/admin roles
      if (!tenantId || !userRole || !["owner", "admin"].includes(userRole)) {
        setState("allowed");
        return;
      }

      try {
        // Check tenant enforcement setting
        const { data: settings } = await (supabase
          .from("tenant_settings" as any)
          .select("security_settings")
          .eq("tenant_id", tenantId)
          .maybeSingle() as any);

        const force2fa = settings?.security_settings?.force_2fa === true;
        if (!force2fa) {
          setState("allowed");
          return;
        }

        // Check if user has verified TOTP factor
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const hasVerified = factors?.totp?.some((f) => f.status === "verified");

        setState(hasVerified ? "allowed" : "blocked");
      } catch {
        setState("allowed"); // fail-open on error to not block user
      }
    };
    check();
  }, [tenantId, userRole]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground">يجب تفعيل التحقق بخطوتين</h2>
            <p className="text-sm text-muted-foreground">
              سياسة المنشأة تتطلب تفعيل التحقق بخطوتين (MFA) للوصول إلى هذه الصفحة.
              يرجى تفعيل التحقق بخطوتين من إعدادات الحساب أولاً.
            </p>
            <Button onClick={() => navigate("/dashboard/settings/security")}>
              <ShieldAlert className="h-4 w-4 ml-2" />
              الذهاب لإعدادات الأمان
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default MfaEnforcementGuard;
