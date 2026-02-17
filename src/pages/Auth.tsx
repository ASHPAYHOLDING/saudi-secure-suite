import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Mail, Lock, User, ArrowLeft, Loader2, Building2, UserCircle, Briefcase, 
  Eye, EyeOff, KeyRound, BarChart3, Receipt, Calculator, PieChart, 
  TrendingUp, FileText, Wallet, CreditCard
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TenantType } from "@/lib/tenant-modules";
import numaxioLogo from "@/assets/numaxio-logo-new.png";

const floatingIcons = [
  { Icon: BarChart3, x: "10%", y: "15%", delay: 0, size: 28 },
  { Icon: Receipt, x: "80%", y: "20%", delay: 0.5, size: 24 },
  { Icon: Calculator, x: "15%", y: "75%", delay: 1, size: 26 },
  { Icon: PieChart, x: "85%", y: "70%", delay: 1.5, size: 30 },
  { Icon: TrendingUp, x: "50%", y: "10%", delay: 2, size: 22 },
  { Icon: FileText, x: "25%", y: "45%", delay: 0.8, size: 20 },
  { Icon: Wallet, x: "75%", y: "50%", delay: 1.2, size: 24 },
  { Icon: CreditCard, x: "60%", y: "85%", delay: 1.8, size: 22 },
];

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
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
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
  const strengthColor = ["", "bg-destructive", "bg-yellow-500", "bg-accent/70", "bg-accent"][strength] || "";

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

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

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
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, tenant_type: tenantType }, emailRedirectTo: window.location.origin } });
        if (error) throw error;
        try { await supabase.functions.invoke("send-auth-email", { body: { email, type: "signup", redirectTo: window.location.origin } }); } catch (emailErr) { console.error("Failed to send OTP email:", emailErr); }
        setOtpDigits(["", "", "", "", "", ""]);
        setMode("otp");
        startResendTimer();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
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
    if (newMode !== "forgot") { setPassword(""); setConfirmPassword(""); }
  };

  return (
    <div dir="rtl" className="min-h-screen flex overflow-hidden">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(210,60%,15%)] to-[hsl(210,70%,10%)] flex-col items-center justify-center p-12 overflow-hidden">
        {/* Floating accounting icons */}
        {floatingIcons.map(({ Icon, x, y, delay, size }, i) => (
          <motion.div
            key={i}
            className="absolute text-white/[0.07]"
            style={{ left: x, top: y }}
            animate={{ y: [0, -15, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, delay, ease: "easeInOut" }}
          >
            <Icon size={size} />
          </motion.div>
        ))}

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent/5 rounded-full blur-[80px]" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-md"
        >
          <motion.img 
            src={numaxioLogo} 
            alt="Numaxio" 
            className="h-14 mx-auto mb-8 brightness-0 invert"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          />
          <h2 className="text-3xl font-bold text-white mb-4 leading-relaxed">
            نظام محاسبي سحابي متكامل
          </h2>
          <p className="text-white/50 text-base leading-relaxed mb-10">
            إدارة الفواتير، المصروفات، التقارير المالية، وضريبة القيمة المضافة في منصة واحدة آمنة ومتوافقة مع هيئة الزكاة والدخل
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {["فوترة إلكترونية", "تقارير مالية", "ضريبة القيمة المضافة", "متوافق مع زاتكا"].map((f, i) => (
              <motion.span
                key={f}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.15 }}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/[0.08] text-white/70 border border-white/[0.06] backdrop-blur-sm"
              >
                {f}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between p-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            <span>العودة للرئيسية</span>
          </button>
          <img src={numaxioLogo} alt="Numaxio" className="h-8 lg:hidden" />
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[420px]"
          >
            <AnimatePresence mode="wait">
              {/* OTP Verification */}
              {mode === "otp" ? (
                <motion.div key="otp" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6"
                  >
                    <KeyRound size={36} className="text-accent" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">أدخل رمز التحقق</h2>
                  <p className="text-sm text-muted-foreground mb-1">تم إرسال رمز مكون من 6 أرقام إلى</p>
                  <p className="text-sm font-semibold text-foreground mb-8" dir="ltr">{email}</p>

                  <div className="flex justify-center gap-3 mb-8" dir="ltr" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <motion.input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-13 h-14 text-center text-2xl font-bold rounded-xl border-2 border-border bg-background text-foreground focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                      />
                    ))}
                  </div>

                  <Button onClick={verifyOtp} disabled={loading || otpDigits.join("").length !== 6} className="w-full h-12 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl text-base font-semibold mb-4">
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    تأكيد الرمز
                  </Button>

                  <div className="space-y-3 mt-4">
                    <button onClick={resendOtp} disabled={resendTimer > 0 || loading} className={`text-sm ${resendTimer > 0 ? "text-muted-foreground" : "text-accent hover:underline"}`}>
                      {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer} ثانية` : "إعادة إرسال الرمز"}
                    </button>
                    <br />
                    <button onClick={() => switchMode("login")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      العودة لتسجيل الدخول
                    </button>
                  </div>
                </motion.div>

              ) : resetSent ? (
                <motion.div key="reset-sent" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6"
                  >
                    <Mail size={36} className="text-accent" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">تم إرسال الرابط</h2>
                  <p className="text-sm text-muted-foreground mb-1">تم إرسال رابط إعادة التعيين إلى</p>
                  <p className="text-sm font-semibold text-foreground mb-4" dir="ltr">{email}</p>
                  <p className="text-xs text-muted-foreground mb-8">يرجى التحقق من بريدك الإلكتروني واتبع التعليمات</p>
                  <Button onClick={() => switchMode("login")} variant="outline" className="w-full h-12 rounded-xl text-base">
                    العودة لتسجيل الدخول
                  </Button>
                </motion.div>

              ) : (
                <motion.div key={mode} initial={{ opacity: 0, x: mode === "signup" ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  {/* Header */}
                  <div className="mb-8">
                    <motion.h1
                      key={`title-${mode}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl md:text-3xl font-bold text-foreground mb-2"
                    >
                      {mode === "login" ? "مرحباً بعودتك" : mode === "signup" ? "إنشاء حساب جديد" : "استعادة كلمة المرور"}
                    </motion.h1>
                    <p className="text-muted-foreground text-sm">
                      {mode === "login" ? "سجّل الدخول للوصول إلى نظامك المحاسبي" : mode === "signup" ? "سجّل الآن واحصل على منشأة جاهزة تلقائياً" : "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Full Name */}
                    {mode === "signup" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Label htmlFor="fullName" className="text-sm font-medium text-foreground mb-2 block">الاسم الكامل</Label>
                        <div className="relative">
                          <User size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أحمد محمد" className="h-12 pr-11 rounded-xl border-border/60 bg-muted/30 focus:bg-background transition-colors" required />
                        </div>
                      </motion.div>
                    )}

                    {/* Tenant Type */}
                    {mode === "signup" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <Label className="text-sm font-medium text-foreground mb-2 block">نوع الحساب</Label>
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
                              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all text-center ${
                                tenantType === opt.value
                                  ? "border-accent bg-accent/10 text-accent shadow-sm"
                                  : "border-border/40 bg-muted/20 text-muted-foreground hover:border-accent/40 hover:bg-muted/40"
                              }`}
                            >
                              <opt.icon size={20} />
                              <span className="text-xs font-semibold">{opt.label}</span>
                              <span className="text-[10px] opacity-60">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Email */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mode === "signup" ? 0.2 : 0.05 }}>
                      <Label htmlFor="email" className="text-sm font-medium text-foreground mb-2 block">البريد الإلكتروني</Label>
                      <div className="relative">
                        <Mail size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" dir="ltr" className="h-12 pr-11 rounded-xl border-border/60 bg-muted/30 focus:bg-background text-left font-english transition-colors" required />
                      </div>
                    </motion.div>

                    {/* Password */}
                    {mode !== "forgot" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mode === "signup" ? 0.25 : 0.1 }}>
                        <Label htmlFor="password" className="text-sm font-medium text-foreground mb-2 block">كلمة المرور</Label>
                        <div className="relative">
                          <Lock size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            dir="ltr"
                            className="h-12 pr-11 pl-11 rounded-xl border-border/60 bg-muted/30 focus:bg-background text-left font-english transition-colors"
                            minLength={6}
                            required
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>

                        {mode === "signup" && password && (
                          <div className="mt-2.5 space-y-1.5">
                            <div className="flex gap-1.5">
                              {[1, 2, 3, 4].map((i) => (
                                <motion.div
                                  key={i}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  className={`h-1.5 flex-1 rounded-full transition-colors origin-right ${i <= strength ? strengthColor : "bg-muted"}`}
                                />
                              ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">قوة كلمة المرور: <span className="font-medium">{strengthLabel}</span></p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Confirm Password */}
                    {mode === "signup" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground mb-2 block">تأكيد كلمة المرور</Label>
                        <div className="relative">
                          <Lock size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                          <Input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            dir="ltr"
                            className="h-12 pr-11 pl-11 rounded-xl border-border/60 bg-muted/30 focus:bg-background text-left font-english transition-colors"
                            minLength={6}
                            required
                          />
                          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <p className="text-[11px] text-destructive mt-1.5">كلمتا المرور غير متطابقتين</p>
                        )}
                      </motion.div>
                    )}

                    {/* Forgot link */}
                    {mode === "login" && (
                      <div className="flex justify-start">
                        <button type="button" onClick={() => switchMode("forgot")} className="text-sm text-accent hover:text-accent/80 transition-colors">
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                    )}

                    {/* Submit */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                      <Button
                        type="submit"
                        disabled={loading || (mode === "signup" && password !== confirmPassword && confirmPassword.length > 0)}
                        className="w-full h-12 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl text-base font-semibold shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30"
                      >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        {mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب" : "إرسال رابط التعيين"}
                      </Button>
                    </motion.div>
                  </form>

                  {/* Divider & Mode Switch */}
                  <div className="mt-8 relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/40" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-4 text-xs text-muted-foreground">
                        {mode === "login" ? "ليس لديك حساب؟" : mode === "signup" ? "لديك حساب بالفعل؟" : "تذكرت كلمة المرور؟"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    {mode === "login" && (
                      <button onClick={() => switchMode("signup")} className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors">
                        إنشاء حساب جديد
                      </button>
                    )}
                    {mode === "signup" && (
                      <button onClick={() => switchMode("login")} className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors">
                        تسجيل الدخول
                      </button>
                    )}
                    {mode === "forgot" && (
                      <button onClick={() => switchMode("login")} className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors">
                        العودة لتسجيل الدخول
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground/60">© 2025 Numaxio. جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
