/**
 * MFA Challenge Screen — shown during login when user has TOTP factor
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";

interface MfaChallengeProps {
  factorId: string;
  onSuccess: () => void;
  onBack: () => void;
}

const MfaChallenge = ({ factorId, onSuccess, onBack }: MfaChallengeProps) => {
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: otpCode,
      });
      if (verifyError) throw verifyError;
      onSuccess();
    } catch (err: any) {
      const msg = err.message?.includes("invalid") ? "الرمز غير صحيح" : err.message;
      toast.error(msg);
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm mx-auto border-0 shadow-none bg-transparent">
      <CardContent className="space-y-6 pt-2 px-0">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground">التحقق بخطوتين</h2>
          <p className="text-sm text-muted-foreground">
            أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة
          </p>
        </div>

        <div className="flex justify-center" dir="ltr">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="w-10 h-11 sm:w-11 sm:h-12 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={handleVerify}
          disabled={loading || otpCode.length !== 6}
          className="w-full min-h-[48px] text-base rounded-lg"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ArrowRight className="h-4 w-4 ml-2" />}
          تأكيد
        </Button>

        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        >
          العودة لتسجيل الدخول
        </button>
      </CardContent>
    </Card>
  );
};

export default MfaChallenge;
