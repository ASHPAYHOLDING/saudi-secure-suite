import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Building2, FileCheck, ArrowLeft, ArrowRight,
  Loader2, CheckCircle2, Phone, Mail, CreditCard,
} from "lucide-react";

interface WizardProps {
  userId: string;
  tenantId: string;
  userEmail: string;
  userName: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface StepData {
  // Step 1
  fullName: string;
  phone: string;
  email: string;
  // Step 2
  bankName: string;
  bankIban: string;
  bankAccountName: string;
  // Step 3
  acceptedTerms: boolean;
  acceptedCommissionPolicy: boolean;
}

const STEPS = [
  { key: "account", label: "بيانات الحساب", icon: User },
  { key: "bank", label: "بيانات التحويل البنكي", icon: Building2 },
  { key: "terms", label: "الموافقة على الشروط", icon: FileCheck },
] as const;

const AffiliateOnboardingWizard = ({ userId, tenantId, userEmail, userName, onComplete, onCancel }: WizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<StepData>({
    fullName: userName,
    phone: "",
    email: userEmail,
    bankName: "",
    bankIban: "",
    bankAccountName: "",
    acceptedTerms: false,
    acceptedCommissionPolicy: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof StepData, string>>>({});

  const updateField = <K extends keyof StepData>(key: K, value: StepData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof StepData, string>> = {};

    if (step === 0) {
      if (!data.fullName.trim() || data.fullName.trim().length < 3) newErrors.fullName = "الاسم مطلوب (3 أحرف على الأقل)";
      if (data.fullName.trim().length > 100) newErrors.fullName = "الاسم طويل جداً";
      if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) newErrors.email = "البريد الإلكتروني غير صحيح";
      if (data.phone && !/^[+\d\s()-]{7,20}$/.test(data.phone.trim())) newErrors.phone = "رقم الهاتف غير صحيح";
    }

    if (step === 1) {
      if (!data.bankName.trim()) newErrors.bankName = "اسم البنك مطلوب";
      if (!data.bankIban.trim()) newErrors.bankIban = "رقم IBAN مطلوب";
      if (data.bankIban.trim().length > 0) {
        const cleanIban = data.bankIban.replace(/\s/g, "").toUpperCase();
        if (cleanIban.length < 15 || cleanIban.length > 34) newErrors.bankIban = "رقم IBAN غير صحيح";
      }
      if (!data.bankAccountName.trim()) newErrors.bankAccountName = "اسم صاحب الحساب مطلوب";
    }

    if (step === 2) {
      if (!data.acceptedTerms) newErrors.acceptedTerms = "يجب الموافقة على الشروط والأحكام";
      if (!data.acceptedCommissionPolicy) newErrors.acceptedCommissionPolicy = "يجب الموافقة على سياسة العمولات";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;
    setSubmitting(true);
    try {
      const code = `NMX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { error } = await supabase.from("affiliates").insert({
        user_id: userId,
        tenant_id: tenantId,
        email: data.email.trim(),
        full_name: data.fullName.trim(),
        phone: data.phone.trim() || null,
        code,
        status: "pending",
        commission_rate: 10,
        tier: "silver",
        bank_name: data.bankName.trim(),
        bank_iban: data.bankIban.replace(/\s/g, "").toUpperCase(),
        bank_account_name: data.bankAccountName.trim(),
      });
      if (error) throw error;
      toast.success("تم تقديم طلب الانضمام بنجاح! 🎉");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء التقديم");
    }
    setSubmitting(false);
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div dir="rtl" className="max-w-lg mx-auto">
      <Card className="border-border/50 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1.5 bg-muted/30 relative">
          <motion.div
            className="absolute inset-y-0 start-0 bg-gradient-to-l from-primary to-accent rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <CardContent className="p-6 sm:p-8">
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isDone
                        ? "hsl(var(--success) / 0.1)"
                        : isActive
                          ? "hsl(var(--primary) / 0.1)"
                          : "hsl(var(--muted) / 0.5)",
                    }}
                    transition={{ duration: 0.3 }}
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-2 relative"
                  >
                    {isDone ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                        <CheckCircle2 className="w-6 h-6 text-success" />
                      </motion.div>
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="stepRing"
                        className="absolute inset-0 rounded-full border-2 border-primary"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </motion.div>
                  <span className={`text-[11px] font-medium text-center ${isActive ? "text-primary" : isDone ? "text-success" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className="absolute" style={{ display: "none" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              {/* STEP 1: Account Info */}
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-foreground">بيانات الحساب</h3>
                    <p className="text-xs text-muted-foreground mt-1">أدخل معلوماتك الأساسية للبدء</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      الاسم الكامل <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={data.fullName}
                      onChange={e => updateField("fullName", e.target.value)}
                      placeholder="أحمد محمد العلي"
                      maxLength={100}
                      className={errors.fullName ? "border-destructive" : ""}
                    />
                    {errors.fullName && <p className="text-[11px] text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      البريد الإلكتروني <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={data.email}
                      onChange={e => updateField("email", e.target.value)}
                      placeholder="example@email.com"
                      type="email"
                      dir="ltr"
                      maxLength={255}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      رقم الهاتف <span className="text-muted-foreground text-[10px]">(اختياري)</span>
                    </label>
                    <Input
                      value={data.phone}
                      onChange={e => updateField("phone", e.target.value)}
                      placeholder="+966 5XX XXX XXXX"
                      dir="ltr"
                      maxLength={20}
                      className={errors.phone ? "border-destructive" : ""}
                    />
                    {errors.phone && <p className="text-[11px] text-destructive">{errors.phone}</p>}
                  </div>
                </div>
              )}

              {/* STEP 2: Bank Details */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-foreground">بيانات التحويل البنكي</h3>
                    <p className="text-xs text-muted-foreground mt-1">لاستلام أرباحك عبر التحويل البنكي</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      اسم البنك <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={data.bankName}
                      onChange={e => updateField("bankName", e.target.value)}
                      placeholder="البنك الأهلي السعودي"
                      maxLength={100}
                      className={errors.bankName ? "border-destructive" : ""}
                    />
                    {errors.bankName && <p className="text-[11px] text-destructive">{errors.bankName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                      رقم IBAN <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={data.bankIban}
                      onChange={e => updateField("bankIban", e.target.value)}
                      placeholder="SA0000000000000000000000"
                      dir="ltr"
                      maxLength={34}
                      className={`font-mono ${errors.bankIban ? "border-destructive" : ""}`}
                    />
                    {errors.bankIban && <p className="text-[11px] text-destructive">{errors.bankIban}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      اسم صاحب الحساب <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={data.bankAccountName}
                      onChange={e => updateField("bankAccountName", e.target.value)}
                      placeholder="كما هو مسجل في البنك"
                      maxLength={100}
                      className={errors.bankAccountName ? "border-destructive" : ""}
                    />
                    {errors.bankAccountName && <p className="text-[11px] text-destructive">{errors.bankAccountName}</p>}
                  </div>

                  {/* Bank card preview */}
                  {data.bankName && data.bankIban && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10"
                    >
                      <p className="text-[10px] text-muted-foreground mb-2">معاينة البطاقة البنكية</p>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{data.bankName}</p>
                        <p className="text-xs font-mono text-muted-foreground" dir="ltr">{data.bankIban.replace(/\s/g, "").toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{data.bankAccountName}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* STEP 3: Terms */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-foreground">الموافقة على الشروط</h3>
                    <p className="text-xs text-muted-foreground mt-1">يرجى قراءة الشروط والموافقة عليها</p>
                  </div>

                  {/* Terms Summary */}
                  <div className="rounded-xl bg-muted/20 border border-border/50 p-4 space-y-3 text-xs text-muted-foreground leading-relaxed max-h-48 overflow-y-auto">
                    <p className="font-semibold text-foreground text-sm">شروط برنامج الشركاء</p>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>تُحتسب العمولة فقط عند تأكيد الدفع وتفعيل الاشتراك</li>
                      <li>فترة تبريد 7 أيام قبل اعتماد أي عمولة</li>
                      <li>الحد الأدنى للسحب 500 ر.س</li>
                      <li>يحق للإدارة مراجعة أي عمولة مشبوهة</li>
                      <li>لا يجوز استخدام أساليب إعلانية مضللة</li>
                      <li>يتم ترقية المستوى تلقائياً حسب عدد الإحالات الناجحة</li>
                      <li>العمولات المستحقة تُصرف خلال 24-48 ساعة عمل</li>
                    </ul>
                    <p className="font-semibold text-foreground text-sm pt-2">سياسة العمولات</p>
                    <ul className="space-y-2 list-disc list-inside">
                      <li>برونزي: 10% عمولة (البداية)</li>
                      <li>فضي: 15% عمولة (بعد 5 إحالات ناجحة)</li>
                      <li>ذهبي: 20% عمولة (بعد 20 إحالة ناجحة)</li>
                      <li>بلاتيني: 25% عمولة (بعد 50 إحالة ناجحة)</li>
                    </ul>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={data.acceptedTerms}
                        onCheckedChange={(checked) => updateField("acceptedTerms", checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="terms" className="text-sm text-foreground cursor-pointer leading-relaxed">
                        أوافق على <span className="font-semibold text-primary">شروط وأحكام</span> برنامج الشركاء
                      </label>
                    </div>
                    {errors.acceptedTerms && <p className="text-[11px] text-destructive me-7">{errors.acceptedTerms}</p>}

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="commissionPolicy"
                        checked={data.acceptedCommissionPolicy}
                        onCheckedChange={(checked) => updateField("acceptedCommissionPolicy", checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="commissionPolicy" className="text-sm text-foreground cursor-pointer leading-relaxed">
                        أوافق على <span className="font-semibold text-primary">سياسة العمولات</span> ونظام المستويات
                      </label>
                    </div>
                    {errors.acceptedCommissionPolicy && <p className="text-[11px] text-destructive me-7">{errors.acceptedCommissionPolicy}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/30">
            <div>
              {currentStep === 0 ? (
                <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                  إلغاء
                </Button>
              ) : (
                <Button variant="outline" onClick={handleBack} className="gap-1.5">
                  <ArrowRight className="w-4 h-4" />
                  السابق
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {currentStep + 1} / {STEPS.length}
              </span>
              {currentStep < STEPS.length - 1 ? (
                <Button onClick={handleNext} className="gap-1.5">
                  التالي
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !data.acceptedTerms || !data.acceptedCommissionPolicy}
                  className="gap-1.5"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      تقديم الطلب
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateOnboardingWizard;
