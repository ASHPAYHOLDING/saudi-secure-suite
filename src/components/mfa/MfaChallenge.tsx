/**
 * MFA Challenge Screen — Numaxio polished design
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, Loader2, ArrowLeft, KeyRound, Smartphone, Info } from "lucide-react";

interface MfaChallengeProps {
  factorId: string;
  onSuccess: () => void;
  onBack: () => void;
}

const MfaChallenge = ({ factorId, onSuccess, onBack }: MfaChallengeProps) => {
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleVerify = async (code: string) => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
      toast.success("تم التحقق بنجاح");
      onSuccess();
    } catch (err: any) {
      const msg = err.message?.toLowerCase().includes("invalid")
        ? "الرمز غير صحيح. حاول مرة أخرى."
        : err.message || "تعذّر التحقق";
      toast.error(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otpCode.length === 6) handleVerify(otpCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode]);

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Brand badge */}
      <div className="flex flex-col items-center gap-5 mb-7">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" strokeWidth={2.2} />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            رمز تطبيق المصادقة
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed px-2">
            افتح تطبيق <span className="font-semibold text-foreground">Google Authenticator</span> أو <span className="font-semibold text-foreground">Authy</span> على جوالك،
            وأدخل الرمز المكوّن من <span className="font-semibold text-foreground">6 أرقام</span> الظاهر بجانب حساب Numaxio.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
            <Smartphone className="h-3 w-3" />
            رمز فوري — يُولَّد محلياً كل 30 ثانية
          </div>
        </div>
      </div>

      {/* Clarification: not an email code */}
      <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">هذا الرمز لا يُرسل عبر البريد الإلكتروني.</span>{" "}
          إذا لم يكن لديك تطبيق مصادقة، اضغط «العودة لتسجيل الدخول» وأعد إعداد التحقق بخطوتين من إعدادات الأمان.
        </p>
      </div>

      {/* OTP Input */}
      <div
        className={`flex justify-center mb-6 transition-transform ${
          shake ? "animate-[shake_0.4s_ease-in-out]" : ""
        }`}
        dir="ltr"
      >
        <InputOTP
          maxLength={6}
          value={otpCode}
          onChange={setOtpCode}
          autoFocus
          disabled={loading}
          inputMode="numeric"
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="w-11 h-13 sm:w-12 sm:h-14 text-xl font-bold rounded-xl border-2 border-border bg-background shadow-sm data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20 transition-all tabular-nums"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {/* Submit button */}
      <Button
        onClick={() => handleVerify(otpCode)}
        disabled={loading || otpCode.length !== 6}
        className="w-full h-12 text-base font-semibold rounded-xl shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 disabled:shadow-none"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin ms-2" />
            جارِ التحقق...
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4 ms-2" />
            تأكيد الرمز
          </>
        )}
      </Button>

      {/* Back link */}
      <button
        onClick={onBack}
        disabled={loading}
        className="mt-5 flex items-center justify-center gap-1.5 w-full text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        العودة لتسجيل الدخول
      </button>

      {/* Help hint */}
      <div className="mt-6 p-3 rounded-lg bg-muted/40 border border-border/50">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          🔒 لا تشارك هذا الرمز مع أي شخص. فريق Numaxio لن يطلبه منك أبداً.
        </p>
      </div>
    </div>
  );
};

export default MfaChallenge;
