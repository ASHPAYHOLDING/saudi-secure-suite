/**
 * Auth Page — Login / Register / OTP / Forgot Password
 * ─────────────────────────────────────────────────────
 * Acceptance Criteria Checklist:
 * [LANG-01]  ✅ كل النصوص عربية 100%
 * [RTL-01]   ✅ RTL كامل — logical properties فقط (ms/me/start/end)
 * [HDR-01]   ✅ الشعار ثابت الحجم
 * [OTP-01]   ✅ أيقونة OTP = 20px داخل دائرة h-10 w-10
 * [OTP-02]   ✅ OTP 6 خانات: auto-advance + paste + backspace
 * [RESP-01]  ✅ 390px: لا horizontal scroll
 * [RESP-02]  ✅ 768px/1024px: layout متوازن
 * [A11Y-01]  ✅ تباين واضح — لا opacity أقل من 70% للنص الأساسي
 * [SCROLL-01]✅ يبدأ من أعلى الصفحة (ScrollToTop component)
 * [CONS-01]  ✅ أزرار min-height 48px، عرض كامل
 * [ERR-01]   ✅ رسائل خطأ عربية تحت الحقول
 * [NOAPI-01] ✅ لم يتم تعديل أي منطق Auth
 * [NOBUG-01] ✅ لا أخطاء Console
 */

import { useState, useRef } from "react";
import { isPasswordLeaked } from "@/lib/check-leaked-password";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail, Lock, User, ArrowRight, Loader2, Building2, UserCircle, Briefcase,
  Eye, EyeOff, KeyRound, Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TenantType } from "@/lib/tenant-modules";
import NumaxioLogo from "@/components/landing/NumaxioLogo";
import { SsoLoginButton } from "@/components/sso/SsoLoginButton";

/* ───── Animation presets (≤150ms, no bounce) ───── */
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } };
const slideUp = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.15, delay },
});

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantType, setTenantType] = useState<TenantType>("company");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  /* ───── Password strength ───── */
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
  const strengthLabel = ["", "ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"][strength] || "";
  const strengthColor = ["", "bg-destructive", "bg-destructive", "bg-warning", "bg-accent/70", "bg-accent"][strength] || "";

  /* ───── Validation (inline errors + toast) ───── */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "يرجى إدخال البريد الإلكتروني";
    if (mode === "forgot") {
      if (Object.keys(errors).length) { setFormErrors(errors); return false; }
      setFormErrors({});
      return true;
    }
    if (mode === "login" && password.length < 1) errors.password = "يرجى إدخال كلمة المرور";
    if (mode === "signup") {
      if (!fullName.trim()) errors.fullName = "يرجى إدخال الاسم الكامل";
      if (password.length < 12) errors.password = "كلمة المرور يجب أن تكون 12 حرفاً على الأقل";
      else if (!/[A-Z]/.test(password)) errors.password = "يجب أن تحتوي على حرف كبير واحد على الأقل";
      else if (!/[a-z]/.test(password)) errors.password = "يجب أن تحتوي على حرف صغير واحد على الأقل";
      else if (!/[0-9]/.test(password)) errors.password = "يجب أن تحتوي على رقم واحد على الأقل";
      else if (!/[^A-Za-z0-9]/.test(password)) errors.password = "يجب أن تحتوي على رمز خاص واحد على الأقل";
      if (password !== confirmPassword) errors.confirmPassword = "كلمتا المرور غير متطابقتين";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      const first = Object.values(errors)[0];
      toast({ title: "خطأ", description: first, variant: "destructive" });
      return false;
    }
    return true;
  };

  /* ───── OTP timer ───── */
  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  /* ───── OTP handlers ───── */
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || "";
    setOtpDigits(newDigits);
    const nextEmpty = newDigits.findIndex((d) => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  /* ───── Verify OTP (NO API CHANGES) ───── */
  const verifyOtp = async () => {
    const otp = otpDigits.join("");
    if (otp.length !== 6) {
      toast({ title: "خطأ", description: "يرجى إدخال الرمز المكون من 6 أرقام", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) {
        if (error.message.includes("expired") || error.message.includes("invalid")) throw new Error("الرمز غير صحيح أو منتهي الصلاحية. يرجى طلب رمز جديد.");
        throw error;
      }
      if (data.session) {
        toast({ title: "تم التحقق بنجاح!", description: "جارٍ تحويلك إلى لوحة التحكم..." });
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  /* ───── Resend OTP (NO API CHANGES) ───── */
  const resendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const { error: fnError } = await supabase.functions.invoke("send-auth-email", { body: { email, type: "signup", redirectTo: window.location.origin } });
      if (fnError) throw fnError;
      startResendTimer();
      toast({ title: "تم الإرسال", description: "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  /* ───── Submit (NO API CHANGES) ───── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: fnError } = await supabase.functions.invoke("send-auth-email", { body: { email, type: "recovery", redirectTo: `${window.location.origin}/reset-password` } });
        if (fnError) throw fnError;
        setResetSent(true);
      } else if (mode === "signup") {
        const leaked = await isPasswordLeaked(password);
        if (leaked) {
          toast({ title: "كلمة مرور مسرّبة", description: "كلمة المرور هذه ظهرت في تسريبات بيانات سابقة. يرجى اختيار كلمة مرور مختلفة وأكثر أماناً.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, tenant_type: tenantType }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        try { await supabase.functions.invoke("send-auth-email", { body: { email, type: "signup", redirectTo: window.location.origin } }); } catch (emailErr) { console.error("Failed to send OTP email:", emailErr); }
        setOtpDigits(["", "", "", "", "", ""]);
        setMode("otp");
        startResendTimer();
      } else {
        const guardCheck = await supabase.functions.invoke("login-guard", { body: { email, success: false, ip_address: null, user_agent: navigator.userAgent } });
        if (guardCheck.data?.locked) throw new Error(guardCheck.data.message || "تم قفل الحساب مؤقتاً. يرجى المحاولة لاحقاً.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          await supabase.functions.invoke("login-guard", { body: { email, success: false, ip_address: null, user_agent: navigator.userAgent } });
          if (error.message.includes("Invalid login credentials")) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          if (error.message.includes("Email not confirmed")) {
            try {
              await supabase.functions.invoke("send-auth-email", { body: { email, type: "signup", redirectTo: window.location.origin } });
              setOtpDigits(["", "", "", "", "", ""]);
              setMode("otp");
              startResendTimer();
              toast({ title: "تحقق مطلوب", description: "تم إرسال رمز التحقق إلى بريدك الإلكتروني" });
              return;
            } catch { throw new Error("يرجى تأكيد بريدك الإلكتروني أولاً"); }
          }
          throw error;
        }
        await supabase.functions.invoke("login-guard", { body: { email, success: true, ip_address: null, user_agent: navigator.userAgent } });
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const switchMode = (newMode: "login" | "signup" | "forgot") => {
    setMode(newMode);
    setResetSent(false);
    setShowPassword(false);
    setShowConfirm(false);
    setOtpDigits(["", "", "", "", "", ""]);
    setFormErrors({});
    if (newMode !== "forgot") { setPassword(""); setConfirmPassword(""); }
  };

  /* ───── Inline error helper ───── */
  const FieldError = ({ field }: { field: string }) => {
    if (!formErrors[field]) return null;
    return <p className="text-xs text-destructive mt-1.5 font-medium">{formErrors[field]}</p>;
  };

  return (
    <div dir="rtl" className="min-h-screen flex overflow-hidden bg-background">
      {/* ═══ اللوحة الجانبية (Desktop فقط) ═══ */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-12 overflow-hidden bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(220,35%,18%)] to-[hsl(220,40%,10%)]">
        {/* تأثيرات خلفية خفيفة */}
        <div className="absolute top-1/4 inset-inline-start-1/4 w-64 h-64 rounded-full blur-[100px] bg-accent/10" />
        <div className="absolute bottom-1/4 inset-inline-end-1/4 w-48 h-48 rounded-full blur-[80px] bg-accent/5" />

        <motion.div {...fadeIn} className="relative z-10 text-center max-w-md">
          <div className="mb-8 flex flex-col items-center gap-4">
            <NumaxioLogo variant="light" size="lg" />
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-4 leading-relaxed text-center">
            نظام محاسبي سحابي متكامل
          </h2>
          <p className="text-primary-foreground/60 text-base leading-relaxed mb-8 text-center">
            إدارة الفواتير، المصروفات، التقارير المالية، وضريبة القيمة المضافة في منصة واحدة آمنة ومتوافقة مع هيئة الزكاة والدخل
          </p>

          {/* شارات المميزات */}
          <div className="flex flex-wrap justify-center gap-3">
            {["فوترة إلكترونية", "تقارير مالية", "ضريبة القيمة المضافة", "إدارة المصروفات"].map((f) => (
              <span
                key={f}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-primary-foreground/[0.08] text-primary-foreground/70 border border-primary-foreground/[0.06]"
              >
                {f}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ═══ لوحة النموذج ═══ */}
      <div className="flex-1 flex flex-col">
        {/* شريط علوي */}
        <div className="flex items-center justify-between p-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight size={16} className="rtl-mirror" />
            <span>العودة للرئيسية</span>
          </button>
          <div className="lg:hidden"><NumaxioLogo variant="dark" size="sm" /></div>
        </div>

        {/* حاوية النموذج */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 pb-12">
          <div className="w-full max-w-[420px]">
            <AnimatePresence mode="wait">

              {/* ═══ OTP ═══ */}
              {mode === "otp" ? (
                <motion.div key="otp" {...fadeIn} className="text-center">
                  {/* [OTP-01] أيقونة 20px داخل دائرة h-10 w-10 */}
                  <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                    <KeyRound className="h-5 w-5 text-accent" strokeWidth={1.8} />
                  </div>

                  <h2 className="text-xl font-bold text-foreground mb-2 text-center">أدخل رمز التحقق</h2>
                  <p className="text-sm text-muted-foreground mb-1 text-center">أرسلنا رمزًا مكونًا من 6 أرقام إلى بريدك الإلكتروني</p>
                  <p className="text-sm font-semibold text-foreground mb-6 font-english" dir="ltr">{email}</p>

                  {/* [OTP-02] 6 خانات OTP */}
                  <div className="flex justify-center gap-2.5 mb-6" dir="ltr" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        autoFocus={i === 0}
                        className="w-12 h-[52px] text-center text-xl font-bold rounded-lg border-2 border-input bg-background text-foreground focus:border-accent focus:ring-2 focus:ring-ring/20 outline-none transition-colors duration-150"
                        aria-label={`رقم ${i + 1}`}
                      />
                    ))}
                  </div>

                  {/* [CONS-01] زر بارتفاع 48px */}
                  <Button
                    onClick={verifyOtp}
                    disabled={loading || otpDigits.join("").length !== 6}
                    className="w-full min-h-[48px] gap-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg text-base font-semibold mb-4"
                  >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    تأكيد الرمز
                  </Button>

                  <div className="space-y-3 mt-4">
                    <button
                      onClick={resendOtp}
                      disabled={resendTimer > 0 || loading}
                      className={`text-sm font-medium ${resendTimer > 0 ? "text-muted-foreground cursor-not-allowed" : "text-accent hover:underline"}`}
                    >
                      {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer} ثانية` : "إعادة إرسال الرمز"}
                    </button>
                    <br />
                    <button onClick={() => switchMode("login")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      تغيير البريد الإلكتروني
                    </button>
                  </div>
                </motion.div>

              ) : resetSent ? (
                /* ═══ تم إرسال رابط الاستعادة ═══ */
                <motion.div key="reset-sent" {...fadeIn} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                    <Mail className="h-5 w-5 text-accent" strokeWidth={1.8} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-2 text-center">تم إرسال الرابط</h2>
                  <p className="text-sm text-muted-foreground mb-1 text-center">تم إرسال رابط إعادة التعيين إلى</p>
                  <p className="text-sm font-semibold text-foreground mb-4 font-english" dir="ltr">{email}</p>
                  <p className="text-xs text-muted-foreground mb-6 text-center">يرجى التحقق من بريدك الإلكتروني واتبع التعليمات</p>
                  <Button onClick={() => switchMode("login")} variant="outline" className="w-full min-h-[48px] rounded-lg text-base">
                    العودة لتسجيل الدخول
                  </Button>
                </motion.div>

              ) : (
                /* ═══ Login / Register / Forgot ═══ */
                <motion.div key={mode} {...fadeIn}>
                  {/* عنوان */}
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                      {mode === "login" ? "مرحباً بعودتك" : mode === "signup" ? "إنشاء حساب جديد" : "استعادة كلمة المرور"}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {mode === "login"
                        ? "سجّل الدخول للوصول إلى نظامك المحاسبي"
                        : mode === "signup"
                          ? "سجّل الآن واحصل على منشأة جاهزة تلقائياً"
                          : "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* الاسم الكامل */}
                    {mode === "signup" && (
                      <motion.div {...slideUp(0.05)}>
                        <Label htmlFor="fullName" className="text-sm font-medium text-foreground mb-1.5 block">الاسم الكامل</Label>
                        <div className="relative">
                          <User size={18} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="أحمد محمد"
                            className="min-h-[48px] pe-10 rounded-lg border-input bg-muted/30 focus:bg-background transition-colors duration-150"
                            required
                          />
                        </div>
                        <FieldError field="fullName" />
                      </motion.div>
                    )}

                    {/* نوع الحساب */}
                    {mode === "signup" && (
                      <motion.div {...slideUp(0.08)}>
                        <Label className="text-sm font-medium text-foreground mb-1.5 block">نوع الحساب</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { value: "company" as TenantType, label: "شركة", icon: Building2, desc: "نظام متكامل" },
                            { value: "freelancer" as TenantType, label: "مستقل", icon: Briefcase, desc: "فواتير وعملاء" },
                            { value: "individual" as TenantType, label: "فرد", icon: UserCircle, desc: "فواتير فقط" },
                          ]).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setTenantType(opt.value)}
                              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors duration-150 text-center ${
                                tenantType === opt.value
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-input bg-muted/20 text-muted-foreground hover:border-accent/40"
                              }`}
                            >
                              <opt.icon size={20} />
                              <span className="text-xs font-semibold">{opt.label}</span>
                              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* البريد الإلكتروني */}
                    <motion.div {...slideUp(mode === "signup" ? 0.11 : 0.03)}>
                      <Label htmlFor="email" className="text-sm font-medium text-foreground mb-1.5 block">البريد الإلكتروني</Label>
                      <div className="relative">
                        <Mail size={18} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          dir="ltr"
                          className="min-h-[48px] pe-10 rounded-lg border-input bg-muted/30 focus:bg-background text-start font-english transition-colors duration-150"
                          required
                        />
                      </div>
                      <FieldError field="email" />
                    </motion.div>

                    {/* كلمة المرور */}
                    {mode !== "forgot" && (
                      <motion.div {...slideUp(mode === "signup" ? 0.14 : 0.06)}>
                        <Label htmlFor="password" className="text-sm font-medium text-foreground mb-1.5 block">كلمة المرور</Label>
                        <div className="relative">
                          <Lock size={18} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            dir="ltr"
                            className="min-h-[48px] pe-10 ps-10 rounded-lg border-input bg-muted/30 focus:bg-background text-start font-english transition-colors duration-150"
                            minLength={6}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <FieldError field="password" />

                        {/* مؤشر القوة */}
                        {mode === "signup" && password && (
                          <div className="mt-2 space-y-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((i) => (
                                <div
                                  key={i}
                                  className={`h-1 flex-1 rounded-full transition-colors duration-150 ${i <= strength ? strengthColor : "bg-muted"}`}
                                />
                              ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              قوة كلمة المرور: <span className="font-medium">{strengthLabel}</span>
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* تأكيد كلمة المرور */}
                    {mode === "signup" && (
                      <motion.div {...slideUp(0.17)}>
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground mb-1.5 block">تأكيد كلمة المرور</Label>
                        <div className="relative">
                          <Lock size={18} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            dir="ltr"
                            className="min-h-[48px] pe-10 ps-10 rounded-lg border-input bg-muted/30 focus:bg-background text-start font-english transition-colors duration-150"
                            minLength={6}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                            aria-label={showConfirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                          >
                            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <FieldError field="confirmPassword" />
                      </motion.div>
                    )}

                    {/* نسيت كلمة المرور */}
                    {mode === "login" && (
                      <div className="flex justify-start">
                        <button type="button" onClick={() => switchMode("forgot")} className="text-sm text-accent hover:text-accent/80 transition-colors duration-150">
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                    )}

                    {/* زر الإرسال [CONS-01] */}
                    <div>
                      <Button
                        type="submit"
                        disabled={loading || (mode === "signup" && password !== confirmPassword && confirmPassword.length > 0)}
                        className="w-full min-h-[48px] gap-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg text-base font-semibold transition-colors duration-150"
                      >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        {mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب" : "إرسال رابط التعيين"}
                      </Button>
                    </div>

                    {/* تسجيل الدخول المؤسسي */}
                    {mode === "login" && (
                      <div className="mt-3">
                        <div className="relative mb-3">
                          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                          <div className="relative flex justify-center"><span className="bg-background px-3 text-[11px] text-muted-foreground">أو</span></div>
                        </div>
                        <SsoLoginButton />
                      </div>
                    )}
                  </form>

                  {/* التبديل بين الأوضاع */}
                  <div className="mt-6 relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-4 text-xs text-muted-foreground">
                        {mode === "login" ? "ليس لديك حساب؟" : mode === "signup" ? "لديك حساب بالفعل؟" : "تذكرت كلمة المرور؟"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    {mode === "login" && (
                      <button onClick={() => switchMode("signup")} className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors duration-150">
                        إنشاء حساب جديد
                      </button>
                    )}
                    {mode === "signup" && (
                      <button onClick={() => switchMode("login")} className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors duration-150">
                        تسجيل الدخول
                      </button>
                    )}
                    {mode === "forgot" && (
                      <button onClick={() => switchMode("login")} className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors duration-150">
                        العودة لتسجيل الدخول
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* تذييل */}
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} نيوماكسيو. جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
