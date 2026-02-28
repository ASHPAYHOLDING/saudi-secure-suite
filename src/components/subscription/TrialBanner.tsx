import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscriptionInfo } from "@/hooks/useSubscriptionFeature";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, Crown, Sparkles, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

/**
 * Trial-aware banner with progressive urgency.
 * - Day 14-8: Calm informational (accent)
 * - Day 7-3: Warning (amber)
 * - Day 2-0: Urgent (red)
 */
const TrialBanner = () => {
  const { isTrialActive, isTrialExpired, daysRemaining, trialStatus, loading: trialLoading } = useTrialStatus();
  const { status: subStatus, loading: subLoading } = useSubscriptionInfo();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (trialLoading || subLoading || dismissed) return null;
  if (location.pathname === "/dashboard/subscription") return null;

  // If they already have an active paid subscription, don't show trial banner
  if (subStatus === "active") return null;
  // If trial is not active and not expired, don't show
  if (!isTrialActive && !isTrialExpired) return null;

  // Trial expired — full block handled by TrialExpiredWall, but show urgent banner if somehow visible
  if (isTrialExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-6 mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between gap-4"
        dir="rtl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-destructive">انتهت فترة التجربة المجانية</p>
            <p className="text-xs text-destructive/70">اشترك الآن للاستمرار في استخدام جميع المميزات</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => navigate("/dashboard/subscription")}
          className="gap-1 shrink-0"
        >
          <Crown size={14} /> اشترك الآن
        </Button>
      </motion.div>
    );
  }

  // Active trial — progressive urgency
  const progress = ((14 - daysRemaining) / 14) * 100;
  const isUrgent = daysRemaining <= 2;
  const isWarning = daysRemaining <= 7;

  const borderColor = isUrgent ? "border-destructive/30" : isWarning ? "border-warning/30" : "border-accent/20";
  const bgColor = isUrgent ? "bg-destructive/5" : isWarning ? "bg-warning/5" : "bg-accent/5";
  const iconBg = isUrgent ? "bg-destructive/10" : isWarning ? "bg-warning/10" : "bg-accent/10";
  const iconColor = isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-accent";
  const textColor = isUrgent ? "text-destructive" : isWarning ? "text-warning-foreground" : "text-foreground";
  const subTextColor = isUrgent ? "text-destructive/70" : isWarning ? "text-warning/80" : "text-muted-foreground";
  const progressColor = isUrgent ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-warning" : "[&>div]:bg-accent";

  const message = isUrgent
    ? `⚠️ آخر ${daysRemaining} يوم في التجربة المجانية!`
    : isWarning
    ? `متبقي ${daysRemaining} أيام في فترة التجربة`
    : `فترة تجريبية مجانية — متبقي ${daysRemaining} يوم`;

  const subMessage = isUrgent
    ? "اشترك الآن قبل فقدان الوصول لبياناتك"
    : isWarning
    ? "اشترك للاستمرار بدون انقطاع"
    : "استمتع بكل المميزات مجاناً خلال فترة التجربة";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-6 mt-4 rounded-xl border ${borderColor} ${bgColor} p-4 space-y-3`}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
            {isUrgent ? <Zap className={`h-5 w-5 ${iconColor}`} /> : <Clock className={`h-5 w-5 ${iconColor}`} />}
          </div>
          <div>
            <p className={`text-sm font-semibold ${textColor}`}>{message}</p>
            <p className={`text-xs ${subTextColor}`}>{subMessage}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => navigate("/dashboard/subscription")}
            className={`gap-1 ${isUrgent ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : isWarning ? "bg-warning hover:bg-warning/90 text-warning-foreground" : ""}`}
          >
            <Sparkles size={14} />
            {isUrgent ? "اشترك فوراً" : "اشترك الآن"}
          </Button>
          {!isUrgent && (
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <Progress value={progress} className={`h-1.5 ${progressColor}`} />
    </motion.div>
  );
};

export default TrialBanner;
