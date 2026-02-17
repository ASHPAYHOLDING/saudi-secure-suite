import { usePaidIntegration } from "@/hooks/usePaidIntegration";
import { Loader2, Lock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps advanced accounting pages.
 * If `accounting_advanced` integration is not active, shows upgrade prompt.
 * Data is never deleted — only hidden.
 */
const AdvancedAccountingGate = ({ children }: Props) => {
  const { active, loading } = usePaidIntegration("accounting_advanced");
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4 text-center" dir="rtl">
        <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-accent" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-foreground">المحاسبة المتقدمة</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            هذه الميزة تتطلب تفعيل إضافة <strong>المحاسبة المتقدمة</strong> من التكاملات المدفوعة.
            تشمل: القيود اليومية، التقارير المالية المتقدمة، التحليلات، وإقرار ضريبة القيمة المضافة.
          </p>
          <p className="text-xs text-muted-foreground">
            بياناتك محفوظة ولن تُحذف عند إلغاء التفعيل.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/dashboard/paid-integrations")} className="gap-2">
            <Lock size={14} />
            تفعيل الإضافة
          </Button>
          <Button variant="outline" onClick={() => navigate("/dashboard/finance")}>
            العودة للملخص المالي
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdvancedAccountingGate;
