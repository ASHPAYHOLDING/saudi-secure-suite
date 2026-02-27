/**
 * MFA Settings Section — shows MFA status and allows enroll/unenroll
 * Used in the user settings/security page
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck, ShieldOff, Loader2, AlertTriangle,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MfaEnrollment from "./MfaEnrollment";

const MfaSettingsSection = () => {
  const [status, setStatus] = useState<"loading" | "enabled" | "disabled">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showUnenroll, setShowUnenroll] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  const checkMfaStatus = useCallback(async () => {
    setStatus("loading");
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) {
        setStatus("enabled");
        setFactorId(verified.id);
      } else {
        setStatus("disabled");
        setFactorId(null);
      }
    } catch {
      setStatus("disabled");
    }
  }, []);

  useEffect(() => { checkMfaStatus(); }, [checkMfaStatus]);

  const handleUnenroll = async () => {
    if (!factorId) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("تم إيقاف التحقق بخطوتين");
      setShowUnenroll(false);
      checkMfaStatus();
    } catch (err: any) {
      toast.error("فشل إيقاف MFA: " + err.message);
    } finally {
      setUnenrolling(false);
    }
  };

  if (showEnroll) {
    return (
      <MfaEnrollment
        onSuccess={() => { setShowEnroll(false); checkMfaStatus(); }}
        onCancel={() => setShowEnroll(false)}
      />
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            التحقق بخطوتين (MFA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">جارٍ التحميل...</span>
            </div>
          ) : status === "enabled" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">التحقق بخطوتين مفعّل</span>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-800/40 dark:text-green-200 dark:border-green-700">
                  مفعّل ✅
                </Badge>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowUnenroll(true)}>
                <ShieldOff className="h-4 w-4 ml-2" />
                إيقاف التحقق بخطوتين
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">التحقق بخطوتين غير مفعّل</span>
                </div>
                <Badge variant="secondary" className="text-yellow-700 dark:text-yellow-300">غير مفعّل ⚠️</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                فعّل التحقق بخطوتين لحماية حسابك من الوصول غير المصرّح به.
              </p>
              <Button onClick={() => setShowEnroll(true)}>
                <ShieldCheck className="h-4 w-4 ml-2" />
                تفعيل التحقق بخطوتين
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unenroll confirmation dialog */}
      <AlertDialog open={showUnenroll} onOpenChange={setShowUnenroll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إيقاف التحقق بخطوتين؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إزالة التحقق بخطوتين من حسابك. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnenroll} disabled={unenrolling} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {unenrolling ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShieldOff className="h-4 w-4 ml-2" />}
              إيقاف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MfaSettingsSection;
