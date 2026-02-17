import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, Lock, User, ArrowLeft, Loader2, Building2, UserCircle, Briefcase, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TenantType } from "@/lib/tenant-modules";

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantType, setTenantType] = useState<TenantType>("company");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const validateForm = (): boolean => {
    if (!email.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال البريد الإلكتروني", variant: "destructive" });
      return false;
    }
    if (mode === "forgot") return true;

    if (password.length < 6) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return false;
    }
    if (mode === "signup") {
      if (!fullName.trim()) {
        toast({ title: "خطأ", description: "يرجى إدخال الاسم الكامل", variant: "destructive" });
        return false;
      }
      if (password !== confirmPassword) {
        toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, tenant_type: tenantType },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSignupSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          }
          if (error.message.includes("Email not confirmed")) {
            throw new Error("يرجى تأكيد بريدك الإلكتروني أولاً");
          }
          throw error;
        }
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "signup" | "forgot") => {
    setMode(newMode);
    setResetSent(false);
    setSignupSuccess(false);
    setShowPassword(false);
    setShowConfirm(false);
    if (newMode !== "forgot") {
      setPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        {/* Back to home */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-white/70 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={16} />
          العودة للرئيسية
        </button>

        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <ShieldCheck size={28} className="text-accent" />
            <span className="text-xl font-bold text-foreground">نظام إدارة المنشآت</span>
          </div>

          <AnimatePresence mode="wait">
            {/* Signup Success */}
            {signupSuccess ? (
              <motion.div key="signup-success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">تم التسجيل بنجاح!</h2>
                <p className="text-sm text-muted-foreground mb-1">تم إرسال رمز التحقق إلى</p>
                <p className="text-sm font-semibold text-foreground mb-4 dir-ltr">{email}</p>
                <p className="text-xs text-muted-foreground mb-6">يرجى التحقق من بريدك الإلكتروني (والرسائل غير المرغوبة) ثم اضغط على رابط التأكيد</p>
                <Button onClick={() => switchMode("login")} variant="outline" className="w-full">
                  العودة لتسجيل الدخول
                </Button>
              </motion.div>

            /* Reset Sent */
            ) : resetSent ? (
              <motion.div key="reset-sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Mail size={32} className="text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">تم إرسال الرابط</h2>
                <p className="text-sm text-muted-foreground mb-1">تم إرسال رابط إعادة التعيين إلى</p>
                <p className="text-sm font-semibold text-foreground mb-4 dir-ltr">{email}</p>
                <p className="text-xs text-muted-foreground mb-6">يرجى التحقق من بريدك الإلكتروني واتبع التعليمات</p>
                <Button onClick={() => switchMode("login")} variant="outline" className="w-full">
                  العودة لتسجيل الدخول
                </Button>
              </motion.div>

            /* Forms */
            ) : (
              <motion.div key={mode} initial={{ opacity: 0, x: mode === "signup" ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-center text-foreground mb-1">
                  {mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب جديد" : "نسيت كلمة المرور"}
                </h2>
                <p className="text-sm text-center text-muted-foreground mb-6">
                  {mode === "login" ? "أدخل بيانات حسابك للمتابعة" : mode === "signup" ? "سجّل الآن واحصل على منشأة جاهزة تلقائياً" : "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name - signup only */}
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="fullName" className="text-xs text-muted-foreground">الاسم الكامل</Label>
                      <div className="relative mt-1.5">
                        <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أحمد محمد" className="pr-10" required />
                      </div>
                    </div>
                  )}

                  {/* Tenant Type - signup only */}
                  {mode === "signup" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">نوع الحساب</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                        {([
                          { value: "company" as TenantType, label: "شركة", icon: Building2, desc: "نظام متكامل" },
                          { value: "freelancer" as TenantType, label: "مستقل", icon: Briefcase, desc: "فواتير وعملاء" },
                          { value: "individual" as TenantType, label: "فرد", icon: UserCircle, desc: "فواتير فقط" },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTenantType(opt.value)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all text-center ${
                              tenantType === opt.value
                                ? "border-accent bg-accent/10 text-accent"
                                : "border-border bg-background text-muted-foreground hover:border-accent/40"
                            }`}
                          >
                            <opt.icon size={20} />
                            <span className="text-xs font-semibold">{opt.label}</span>
                            <span className="text-[10px] opacity-70">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
                    <div className="relative mt-1.5">
                      <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" dir="ltr" className="pr-10 text-left font-english" required />
                    </div>
                  </div>

                  {/* Password - login & signup */}
                  {mode !== "forgot" && (
                    <div>
                      <Label htmlFor="password" className="text-xs text-muted-foreground">كلمة المرور</Label>
                      <div className="relative mt-1.5">
                        <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          dir="ltr"
                          className="pr-10 pl-10 text-left font-english"
                          minLength={6}
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      {/* Password Strength - signup only */}
                      {mode === "signup" && password && (
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
                  )}

                  {/* Confirm Password - signup only */}
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">تأكيد كلمة المرور</Label>
                      <div className="relative mt-1.5">
                        <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          dir="ltr"
                          className="pr-10 pl-10 text-left font-english"
                          minLength={6}
                          required
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-[11px] text-destructive mt-1">كلمتا المرور غير متطابقتين</p>
                      )}
                    </div>
                  )}

                  {/* Forgot Password Link - login only */}
                  {mode === "login" && (
                    <div className="text-left">
                      <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-accent hover:underline">
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || (mode === "signup" && password !== confirmPassword && confirmPassword.length > 0)}
                    className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {mode === "login" ? "دخول" : mode === "signup" ? "إنشاء حساب" : "إرسال رابط التعيين"}
                  </Button>
                </form>

                {/* Mode Switcher */}
                <div className="mt-6 text-center space-y-2">
                  {mode === "login" && (
                    <button onClick={() => switchMode("signup")} className="text-sm text-accent hover:underline">
                      ليس لديك حساب؟ سجّل الآن
                    </button>
                  )}
                  {mode === "signup" && (
                    <button onClick={() => switchMode("login")} className="text-sm text-accent hover:underline">
                      لديك حساب؟ سجّل الدخول
                    </button>
                  )}
                  {mode === "forgot" && (
                    <button onClick={() => switchMode("login")} className="text-sm text-accent hover:underline">
                      العودة لتسجيل الدخول
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
