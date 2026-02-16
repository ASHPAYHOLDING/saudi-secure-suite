import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, Lock, User, ArrowLeft, Loader2, Building2, UserCircle, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TenantType } from "@/lib/tenant-modules";
const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [tenantType, setTenantType] = useState<TenantType>("company");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, tenant_type: tenantType },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "تم التسجيل بنجاح",
          description: "يرجى التحقق من بريدك الإلكتروني لتأكيد الحساب",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Back to home */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          العودة للرئيسية
        </button>

        <div className="rounded-2xl border border-border/20 bg-card p-8 shadow-elevated">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <ShieldCheck size={28} className="text-accent" />
            <span className="text-xl font-bold text-foreground">نظام إدارة المنشآت</span>
          </div>

          <h2 className="text-lg font-semibold text-center text-foreground mb-1">
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h2>
          <p className="text-sm text-center text-muted-foreground mb-6">
            {mode === "login"
              ? "أدخل بيانات حسابك للمتابعة"
              : "سجّل الآن واحصل على منشأة جاهزة تلقائياً"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-xs text-muted-foreground">
                    الاسم الكامل
                  </Label>
                  <div className="relative mt-1.5">
                    <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="أحمد محمد"
                      className="pr-10"
                      required
                    />
                  </div>
                </div>

                {/* Tenant Type Selector */}
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
              </div>
            )}

            <div>
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                البريد الإلكتروني
              </Label>
              <div className="relative mt-1.5">
                <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  dir="ltr"
                  className="pr-10 text-left font-english"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-xs text-muted-foreground">
                كلمة المرور
              </Label>
              <div className="relative mt-1.5">
                <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="pr-10 text-left font-english"
                  minLength={6}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "دخول" : "إنشاء حساب"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm text-accent hover:underline"
            >
              {mode === "login" ? "ليس لديك حساب؟ سجّل الآن" : "لديك حساب؟ سجّل الدخول"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
