/**
 * User Security Settings Page — /dashboard/settings/security
 * Contains MFA settings section + enforcement banner
 */
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useLocation } from "react-router-dom";
import MfaSettingsSection from "./MfaSettingsSection";

const UserSecurityPage = () => {
  const location = useLocation();
  const mfaRequired = (location.state as any)?.mfaRequired === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 max-w-2xl"
    >
      {/* MFA enforcement banner */}
      {mfaRequired && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-sm font-medium text-destructive">
            لإكمال الدخول، فعّل المصادقة الثنائية (MFA). هذا مطلوب لدورك كمالك أو مدير.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">أمان الحساب</h1>
          <p className="text-sm text-muted-foreground">إدارة إعدادات الأمان والتحقق بخطوتين</p>
        </div>
      </div>

      <MfaSettingsSection />
    </motion.div>
  );
};

export default UserSecurityPage;
