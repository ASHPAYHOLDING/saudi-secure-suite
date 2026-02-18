import { useState, useEffect } from "react";
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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const passwordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = passwordStrength(password);
  const strengthLabel = ["", "ضعيفة", "متوسطة", "جيدة", "قوية"][strength] || "";
  const strengthColor = ["", "bg-destructive", "bg-warning", "bg-accent/70", "bg-accent"][strength] || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }

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

  if (!isRecovery) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated text-center max-w-md">
          <ShieldCheck size={48} className="text-accent mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">رابط غير صالح</h2>
          <p className="text-sm text-muted-foreground mb-4">يرجى طلب رابط إعادة تعيين كلمة المرور من صفحة تسجيل الدخول</p>
          <Button onClick={() => navigate("/auth")} className="bg-accent text-accent-foreground hover:bg-accent/90">
            العودة لتسجيل الدخول
          </Button>
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
