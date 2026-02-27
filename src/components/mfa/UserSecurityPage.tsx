/**
 * User Security Settings Page — /dashboard/settings/security
 * Contains MFA settings section
 */
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import MfaSettingsSection from "./MfaSettingsSection";

const UserSecurityPage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 max-w-2xl"
    >
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
