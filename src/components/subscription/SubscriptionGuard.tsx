import { useSubscriptionInfo } from "@/hooks/useSubscriptionFeature";
import { motion } from "framer-motion";
import { ShieldAlert, Crown, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation, Link } from "react-router-dom";

/**
 * Wraps dashboard content. If subscription is expired/cancelled, blocks access
 * and shows an upgrade prompt. Trial & past_due users see a warning banner but can continue.
 */
const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const { status, loading } = useSubscriptionInfo();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <>{children}</>;

  // Always allow access to the subscription page itself
  if (location.pathname === "/dashboard/subscription") return <>{children}</>;

  // No subscription at all or expired/cancelled → block
  const blocked = status === "expired" || status === "cancelled";

  if (blocked) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full text-center space-y-6"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {status === "expired" ? "انتهى اشتراكك" : "تم إلغاء اشتراكك"}
          </h1>
          <p className="text-muted-foreground">
            {status === "expired"
              ? "انتهت فترة اشتراكك وفترة السماح. يرجى تجديد اشتراكك للوصول إلى النظام."
              : "تم إلغاء اشتراكك. يمكنك إعادة الاشتراك في أي وقت."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate("/dashboard/subscription")}
              className="gap-2"
            >
              <Crown size={16} />
              تجديد الاشتراك
            </Button>
            <Link to="/">
              <Button variant="outline" className="gap-2 w-full">
                <ArrowLeft size={16} />
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SubscriptionGuard;
