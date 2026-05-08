import { useState, useEffect } from "react";
import { isPasswordLeaked } from "@/lib/check-leaked-password";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    // Listen for the PASSWORD_RECOVERY event fired by Supabase after token exchange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setChecking(false);
      }
    });

    const init = async () => {
      try {
        const hash = window.location.hash || "";
        const search = window.location.search || "";
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const queryParams = new URLSearchParams(search);

        // Case 1: legacy implicit flow — tokens in URL hash
        if (hashParams.get("type") === "recovery" || hashParams.get("access_token")) {
          if (!cancelled) {
            setIsRecovery(true);
            setChecking(false);
          }
          return;
        }

        // Case 2: PKCE flow — ?code=... in query string (modern Supabase verify redirect)
        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled) {
            if (!error) {
              setIsRecovery(true);
            }
            setChecking(false);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        // Case 3: query has type=recovery (some configs)
        if (queryParams.get("type") === "recovery") {
          if (!cancelled) {
            setIsRecovery(true);
            setChecking(false);
          }
          return;
        }

        // Case 4: user already has a recovery session from /verify redirect.
        // Wait briefly for PASSWORD_RECOVERY event before declaring invalid.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Give Supabase a moment to dispatch PASSWORD_RECOVERY
          setTimeout(() => {
            if (!cancelled) {
              setIsRecovery(true);
              setChecking(false);
            }
          }, 800);
          return;
        }

        if (!cancelled) setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const passwordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = passwordStrength(password);
  const strengthLabel = ["", "ضعيفة", "متوسطة", "جيدة", "قوية"][strength] || "";
  const strengthColor = ["", "bg-destructive", "bg-warning", "bg-accent/70", "bg-accent"][strength] || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 12) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 12 حرفاً على الأقل", variant: "destructive" });
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      toast({ title: "خطأ", description: "يجب أن تحتوي كلمة المرور على حرف كبير وصغير ورقم ورمز خاص", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check for leaked password
      const leaked = await isPasswordLeaked(password);
      if (leaked) {
        toast({
          title: "كلمة مرور غير آمنة",
          description: "هذه الكلمة ظهرت ضمن تسريبات معروفة. اختر كلمة جديدة قوية وفريدة.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.message?.toLowerCase().includes("aal2")) {
          await checkMfaRequirement();
          throw new Error("يلزم التحقق بخطوتين قبل تحديث كلمة المرور.");
        }
        if (error.message?.toLowerCase().includes("password") && (error.message?.toLowerCase().includes("leaked") || error.message?.toLowerCase().includes("pwned") || error.message?.toLowerCase().includes("breach"))) {
          throw new Error("هذه الكلمة ظهرت ضمن تسريبات معروفة. اختر كلمة جديدة قوية وفريدة.");
        }
        throw error;
      }
      setSuccess(true);
      toast({ title: "تم التحديث", description: "تم تغيير كلمة المرور بنجاح" });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSuccess = async () => {
    setNeedsMfa(false);
    setMfaFactorId(null);
    // Retry password update now that session is AAL2
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast({ title: "تم التحديث", description: "تم تغيير كلمة المرور بنجاح" });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated text-center max-w-md">
          <Loader2 size={32} className="text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من رابط إعادة التعيين...</p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated text-center max-w-md">
          <ShieldCheck size={48} className="text-accent mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">رابط غير صالح أو منتهي الصلاحية</h2>
          <p className="text-sm text-muted-foreground mb-4">قد يكون الرابط قد استُخدم مسبقاً أو انتهت صلاحيته. يرجى طلب رابط جديد من صفحة تسجيل الدخول.</p>
          <Button onClick={() => navigate("/auth")} className="bg-accent text-accent-foreground hover:bg-accent/90">
            العودة لتسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  if (needsMfa && mfaFactorId) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated w-full max-w-md">
          <MfaChallenge
            factorId={mfaFactorId}
            onSuccess={handleMfaSuccess}
            onBack={() => { setNeedsMfa(false); setMfaFactorId(null); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated">
          <div className="flex items-center justify-center gap-2 mb-6">
            <ShieldCheck size={28} className="text-accent" />
            <span className="text-xl font-bold text-foreground">نظام إدارة المنشآت</span>
          </div>

          {success ? (
            <div className="text-center py-8">
              <CheckCircle2 size={56} className="text-accent mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">تم تغيير كلمة المرور</h2>
              <p className="text-sm text-muted-foreground">جارٍ تحويلك للوحة التحكم...</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-center text-foreground mb-1">إعادة تعيين كلمة المرور</h2>
              <p className="text-sm text-center text-muted-foreground mb-6">أدخل كلمة المرور الجديدة</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password" className="text-xs text-muted-foreground">كلمة المرور الجديدة</Label>
                  <div className="relative mt-1.5">
                    <Lock size={16} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="pe-10 ps-10 text-start"
                      minLength={6}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : "bg-muted"}`} />
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">قوة كلمة المرور: {strengthLabel}</p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">تأكيد كلمة المرور</Label>
                  <div className="relative mt-1.5">
                    <Lock size={16} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="pe-10 ps-10 text-start"
                      minLength={6}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[11px] text-destructive mt-1">كلمتا المرور غير متطابقتين</p>
                  )}
                </div>

                <Button type="submit" disabled={loading || password !== confirmPassword} className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  تحديث كلمة المرور
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
