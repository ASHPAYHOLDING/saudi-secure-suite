import { useSubscriptionInfo } from "@/hooks/useSubscriptionFeature";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, AlertTriangle, Crown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

/**
 * Contextual upgrade banner shown in the dashboard for trial/past_due users.
 */
const UpgradeBanner = () => {
  const { status, loading, currentPeriodEnd, graceEndsAt } = useSubscriptionInfo();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;

  const daysLeft = currentPeriodEnd
    ? Math.max(0, Math.ceil((new Date(currentPeriodEnd).getTime() - Date.now()) / 86400000))
    : 0;

  const graceDaysLeft = graceEndsAt
    ? Math.max(0, Math.ceil((new Date(graceEndsAt).getTime() - Date.now()) / 86400000))
    : 0;

  if (status === "trial") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4"
          dir="rtl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                فترة تجريبية — متبقي {daysLeft} يوم
              </p>
              <p className="text-xs text-amber-600">
                اشترك الآن للاستمرار بدون انقطاع واستمتع بكل المميزات
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => navigate("/dashboard/subscription")}
              className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Sparkles size={14} />
              اشترك الآن
            </Button>
            <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (status === "past_due") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">
              فترة السماح — متبقي {graceDaysLeft} يوم
            </p>
            <p className="text-xs text-red-600">
              سيتم إيقاف حسابك بعد انتهاء فترة السماح. جدّد الآن لتفادي الإيقاف.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => navigate("/dashboard/subscription")}
          className="gap-1 shrink-0"
        >
          <Crown size={14} />
          جدّد الآن
        </Button>
      </motion.div>
    );
  }

  // Active with < 7 days remaining
  if (status === "active" && daysLeft <= 7 && daysLeft > 0) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mx-6 mt-4 rounded-xl border border-accent/20 bg-accent/5 p-4 flex items-center justify-between gap-4"
          dir="rtl"
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-accent shrink-0" />
            <p className="text-sm text-foreground">
              اشتراكك ينتهي خلال <strong>{daysLeft} يوم</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/dashboard/subscription")}
              className="gap-1"
            >
              إدارة الاشتراك
            </Button>
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
};

export default UpgradeBanner;
