/**
 * MFA TOTP Enrollment Flow
 * - Calls supabase.auth.mfa.enroll()
 * - Displays QR + secret
 * - Verifies with 6-digit OTP
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Copy, Loader2, CheckCircle2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface MfaEnrollmentProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const MfaEnrollment = ({ onSuccess, onCancel }: MfaEnrollmentProps) => {
  const [step, setStep] = useState<"start" | "qr" | "verify" | "done">("start");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "تطبيق المصادقة",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrUri(data.totp.uri);
      setSecret(data.totp.secret);
      setStep("qr");
    } catch (err: any) {
      toast.error("فشل بدء التسجيل: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      toast.error("أدخل الرمز المكوّن من 6 أرقام");
      return;
    }
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: otpCode,
      });
      if (verifyError) throw verifyError;

      setStep("done");
      toast.success("تم تفعيل التحقق بخطوتين بنجاح ✅");
      setTimeout(onSuccess, 1500);
    } catch (err: any) {
      toast.error(err.message?.includes("invalid") ? "الرمز غير صحيح، حاول مرة أخرى" : err.message);
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast.success("تم نسخ المفتاح السري");
  };

  if (step === "start") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            تفعيل التحقق بخطوتين (TOTP)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            التحقق بخطوتين يضيف طبقة أمان إضافية لحسابك. ستحتاج تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleEnroll} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <QrCode className="h-4 w-4 ml-2" />}
              بدء التفعيل
            </Button>
            <Button variant="outline" onClick={onCancel}>إلغاء</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "qr") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            امسح رمز QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            امسح رمز QR عبر تطبيق Google Authenticator أو Microsoft Authenticator
          </p>

          {/* QR Code */}
          <div className="flex justify-center py-3">
            <div className="rounded-xl border-2 border-border p-4 bg-white">
              <QRCodeSVG value={qrUri} size={180} />
            </div>
          </div>

          {/* Manual secret */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">أو أدخل المفتاح يدوياً:</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <code className="text-xs font-mono flex-1 break-all select-all" dir="ltr">{secret}</code>
              <Button variant="ghost" size="sm" onClick={copySecret} className="shrink-0 h-7 w-7 p-0">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Button onClick={() => setStep("verify")} className="w-full">
            التالي — إدخال رمز التحقق
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "verify") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            أدخل رمز التحقق
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة
          </p>

          <div className="flex justify-center" dir="ltr">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="w-10 h-11 sm:w-11 sm:h-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleVerify} disabled={verifying || otpCode.length !== 6} className="flex-1">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShieldCheck className="h-4 w-4 ml-2" />}
              تأكيد التفعيل
            </Button>
            <Button variant="outline" onClick={() => setStep("qr")}>رجوع</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // step === "done"
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <h3 className="text-lg font-semibold text-foreground">تم التفعيل بنجاح!</h3>
        <p className="text-sm text-muted-foreground">
          التحقق بخطوتين مفعّل الآن على حسابك
        </p>
        <Badge className="bg-green-100 text-green-800 border-green-200">مفعّل ✅</Badge>
      </CardContent>
    </Card>
  );
};

export default MfaEnrollment;
