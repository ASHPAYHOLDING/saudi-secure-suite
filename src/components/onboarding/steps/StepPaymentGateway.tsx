import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const GATEWAYS = [
  { name: "Tap", logo: "🟢", desc: "بوابة الدفع الأكثر انتشاراً في السعودية" },
  { name: "Moyasar", logo: "🔵", desc: "دعم مدى وApple Pay" },
  { name: "HyperPay", logo: "🟣", desc: "بوابة متعددة العملات" },
  { name: "Stripe", logo: "🟡", desc: "البوابة العالمية الأشهر" },
];

const BENEFITS = [
  "تحصيل الفواتير إلكترونياً",
  "روابط دفع مباشرة للعملاء",
  "تسوية تلقائية مع حسابك البنكي",
  "تقارير تحصيل فورية",
];

interface Props {
  onValidChange: (valid: boolean) => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
}

export default function StepPaymentGateway({ onValidChange, onSubmit }: Props) {
  // Always valid (skippable step)
  useEffect(() => {
    onValidChange(true);
  }, [onValidChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ skipped: false });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-3">
          <CreditCard className="w-7 h-7 text-success" />
        </div>
        <CardTitle className="text-xl">تفعيل بوابة الدفع</CardTitle>
        <CardDescription>فعّل بوابة دفع لتحصيل المدفوعات إلكترونياً — أو تخطَ هذه الخطوة</CardDescription>
      </CardHeader>
      <CardContent>
        <form data-onboarding-form onSubmit={handleSubmit} className="space-y-6">
          {/* Benefits */}
          <div className="rounded-xl bg-success/5 border border-success/20 p-4 space-y-2">
            <p className="text-sm font-semibold text-success">مزايا تفعيل الدفع الإلكتروني:</p>
            <ul className="space-y-1.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Gateway cards */}
          <div className="grid grid-cols-2 gap-3">
            {GATEWAYS.map((gw) => (
              <button
                type="button"
                key={gw.name}
                className="p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-colors text-start"
                onClick={() => {
                  // Navigate to integration setup after wizard
                  onSubmit({ gateway: gw.name.toLowerCase() });
                }}
              >
                <span className="text-2xl">{gw.logo}</span>
                <p className="font-semibold text-sm mt-2">{gw.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{gw.desc}</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            يمكنك تفعيل أو تغيير البوابة لاحقاً من صفحة التكاملات
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
