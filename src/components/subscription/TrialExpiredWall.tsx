import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscriptionInfo } from "@/hooks/useSubscriptionFeature";
import { motion } from "framer-motion";
import { ShieldAlert, Crown, Clock, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Full-page wall shown when trial expires AND no active subscription.
 * Wraps dashboard content — if trial expired, blocks everything except /subscription.
 */
const TrialExpiredWall = ({ children }: { children: React.ReactNode }) => {
  const { isTrialExpired, loading: trialLoading } = useTrialStatus();
  const { status: subStatus, loading: subLoading } = useSubscriptionInfo();
  const navigate = useNavigate();
  const location = useLocation();

  if (trialLoading || subLoading) return <>{children}</>;

  // Allow subscription page always
  if (location.pathname.includes("/subscription")) return <>{children}</>;

  // If not trial expired or has active/trial subscription, pass through
  if (!isTrialExpired) return <>{children}</>;
  if (subStatus === "active" || subStatus === "trial") return <>{children}</>;

  const features = [
    "إدارة الفواتير والمبيعات",
    "تتبع المصروفات والمشتريات",
    "تقارير مالية متقدمة",
    "إدارة العملاء والموردين",
    "دعم ZATCA والفاتورة الإلكترونية",
    "تطبيق الموبايل الكامل",
  ];

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full space-y-6"
      >
        {/* Icon */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning/10 mb-4">
            <Clock className="h-10 w-10 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">انتهت فترة التجربة المجانية</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            شكراً لتجربتك نيوماكسيو! اشترك الآن للاستمرار في الوصول لجميع بياناتك وميزاتك.
          </p>
        </div>

        {/* Features list */}
        <Card className="border-border/60">
          <CardContent className="py-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">ما ستحصل عليه:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pricing hint */}
        <div className="text-center bg-accent/5 rounded-xl p-4 border border-accent/20">
          <p className="text-xs text-muted-foreground">تبدأ من</p>
          <p className="text-3xl font-bold text-accent font-[IBM_Plex_Sans_Arabic]">149 <span className="text-base font-normal">ر.س/شهر</span></p>
          <p className="text-xs text-muted-foreground mt-1">بياناتك محفوظة بأمان — اشترك واستمر من حيث توقفت</p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/dashboard/subscription")}
            className="gap-2"
          >
            <Crown size={18} />
            اختر باقتك الآن
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/dashboard/subscription")}
            className="gap-2"
          >
            <Sparkles size={18} />
            مقارنة الباقات
          </Button>
        </div>

        {/* Data safety */}
        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          بياناتك محمية ولن يتم حذفها — يمكنك الاشتراك في أي وقت
        </p>
      </motion.div>
    </div>
  );
};

export default TrialExpiredWall;
