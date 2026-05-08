/**
 * User Security Settings Page — /dashboard/settings/security
 * Contains MFA settings section + enforcement banner
 * Styled consistently with SettingsPage
 */
import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, Fingerprint } from "lucide-react";
import MfaSettingsSection from "./MfaSettingsSection";

const UserSecurityPage = () => {
  return (
    <div dir="rtl" className="space-y-6 p-6">
      {/* Page Header — matches SettingsPage style */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">أمان الحساب</h1>
        <p className="text-sm text-muted-foreground">إدارة إعدادات الأمان والتحقق بخطوتين</p>
      </div>

      {/* MFA Section — wrapped in consistent card style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-foreground">التحقق بخطوتين (MFA)</h3>
        </div>
        <MfaSettingsSection embedded />
      </motion.div>

      {/* Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-2 mb-5">
          <KeyRound size={18} className="text-accent" />
          <h3 className="text-sm font-semibold text-foreground">كلمة المرور</h3>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            يمكنك تغيير كلمة المرور عبر إعادة تعيينها من صفحة تسجيل الدخول.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fingerprint size={14} />
            <span>نظام الحماية من كلمات المرور المسرّبة (HIBP) مفعّل</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default UserSecurityPage;
