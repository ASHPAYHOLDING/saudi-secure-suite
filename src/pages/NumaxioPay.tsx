import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  CreditCard, Shield, CheckCircle2, ArrowRight, 
  Building2, KeyRound, Eye, EyeOff, Loader2, 
  Sparkles, ChevronLeft, CircleDot, BadgeCheck,
  AlertCircle, Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NumaxioPay = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [iban, setIban] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const handleVerify = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      toast.error("يرجى إدخال مفتاح API والمفتاح السري");
      return;
    }
    setIsVerifying(true);
    // Simulate verification
    await new Promise((r) => setTimeout(r, 2000));
    setIsVerifying(false);
    setIsVerified(true);
    setCurrentStep(3);
    toast.success("تم التحقق من صلاحية الحساب بنجاح ✓");
  };

  const handleLink = async () => {
    if (!merchantName.trim()) {
      toast.error("يرجى إدخال اسم التاجر");
      return;
    }
    setIsLinking(true);
    await new Promise((r) => setTimeout(r, 2000));
    setIsLinking(false);
    setIsLinked(true);
    setCurrentStep(4);
    toast.success("🎉 تم ربط بوابة الدفع Paylink بنجاح!");
  };

  const steps = [
    { number: 1, title: "إنشاء حساب Paylink", description: "سجّل في بوابة Paylink واحصل على بيانات API" },
    { number: 2, title: "إدخال بيانات الربط", description: "أدخل مفاتيح API والمفتاح السري" },
    { number: 3, title: "التحقق والتأكيد", description: "تحقق من صلاحية البيانات وأكمل الربط" },
    { number: 4, title: "جاهز للاستخدام", description: "ابدأ بتحصيل المدفوعات إلكترونياً" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Wallet className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">نيوماكسيو باي</h1>
              <p className="text-xs text-muted-foreground">ربط بوابة الدفع الإلكتروني</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            رجوع
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            بوابة دفع متكاملة مع Paylink
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
            حصّل مدفوعاتك بسهولة
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base">
            اربط حسابك في Paylink مع نيوماكسيو لتفعيل الدفع الإلكتروني عبر مدى، Apple Pay، وبطاقات الائتمان.
          </p>
        </motion.div>

        {/* Steps Progress */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
        >
          <Card className="border-border/60">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-0 justify-between">
                {steps.map((step, i) => (
                  <div key={step.number} className="flex items-center gap-3 md:flex-col md:text-center flex-1">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all duration-300
                      ${currentStep > step.number 
                        ? "bg-accent text-accent-foreground" 
                        : currentStep === step.number 
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20" 
                          : "bg-muted text-muted-foreground"}
                    `}>
                      {currentStep > step.number ? <CheckCircle2 className="w-5 h-5" /> : step.number}
                    </div>
                    <div className="md:mt-2">
                      <p className={`text-sm font-semibold ${currentStep >= step.number ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground hidden md:block">{step.description}</p>
                    </div>
                    {i < steps.length - 1 && (
                      <div className="hidden md:block w-full h-px bg-border mx-4" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <motion.div 
            className="lg:col-span-2 space-y-6"
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.2 }}
          >
            {/* Step 1: Instructions */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-base">الخطوة ١: إنشاء حساب Paylink</CardTitle>
                    <CardDescription>إذا لم يكن لديك حساب بعد</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <CircleDot className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <p>قم بزيارة موقع <a href="https://paylink.sa" target="_blank" rel="noopener noreferrer" className="text-accent font-medium underline underline-offset-2">paylink.sa</a> وأنشئ حساب تاجر جديد.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleDot className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <p>أكمل عملية التحقق من الهوية وربط الحساب البنكي.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleDot className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <p>من لوحة تحكم Paylink، انتقل إلى <strong>الإعدادات → API Keys</strong> للحصول على مفاتيح الربط.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleDot className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <p>انسخ <strong>App ID</strong> و <strong>Secret Key</strong> واستخدمهما في النموذج أدناه.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: API Credentials */}
            <Card className={`border-border/60 transition-all ${isLinked ? "opacity-60 pointer-events-none" : ""}`}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-warning" />
                  </div>
                  <div>
                    <CardTitle className="text-base">الخطوة ٢: بيانات الربط</CardTitle>
                    <CardDescription>أدخل مفاتيح API الخاصة بحسابك في Paylink</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="merchantName">اسم التاجر / المنشأة</Label>
                  <Input
                    id="merchantName"
                    placeholder="مثال: شركة التقنية المتقدمة"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    disabled={isLinked}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">مفتاح API (App ID)</Label>
                  <Input
                    id="apiKey"
                    placeholder="أدخل App ID من Paylink"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono dir-ltr text-left"
                    dir="ltr"
                    disabled={isVerified}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretKey">المفتاح السري (Secret Key)</Label>
                  <div className="relative">
                    <Input
                      id="secretKey"
                      type={showSecret ? "text" : "password"}
                      placeholder="أدخل Secret Key من Paylink"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      className="font-mono dir-ltr text-left pe-10"
                      dir="ltr"
                      disabled={isVerified}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">رقم الآيبان (اختياري)</Label>
                  <Input
                    id="iban"
                    placeholder="SA0000000000000000000000"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="font-mono dir-ltr text-left"
                    dir="ltr"
                    disabled={isLinked}
                  />
                  <p className="text-xs text-muted-foreground">رقم الحساب البنكي الدولي المرتبط بحساب Paylink</p>
                </div>

                <Separator />

                {/* Verify Button */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleVerify}
                    disabled={isVerifying || isVerified || !apiKey.trim() || !secretKey.trim()}
                    variant={isVerified ? "outline" : "default"}
                    className="gap-2 flex-1"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جارٍ التحقق...
                      </>
                    ) : isVerified ? (
                      <>
                        <BadgeCheck className="w-4 h-4 text-accent" />
                        تم التحقق بنجاح
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        تحقق من البيانات
                      </>
                    )}
                  </Button>

                  <AnimatePresence>
                    {isVerified && !isLinked && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1"
                      >
                        <Button
                          onClick={handleLink}
                          disabled={isLinking}
                          className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                          {isLinking ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              جارٍ الربط...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              تفعيل بوابة الدفع
                            </>
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>

            {/* Success State */}
            <AnimatePresence>
              {isLinked && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-accent/30 bg-accent/5">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-8 h-8 text-accent" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">تم الربط بنجاح! 🎉</h3>
                          <p className="text-muted-foreground mt-1">
                            بوابة الدفع Paylink مفعّلة الآن. يمكنك البدء بإرسال روابط الدفع لعملائك.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button onClick={() => navigate("/dashboard")} className="gap-2">
                            <ArrowRight className="w-4 h-4" />
                            الذهاب للوحة التحكم
                          </Button>
                          <Button variant="outline" onClick={() => {
                            setIsVerified(false);
                            setIsLinked(false);
                            setApiKey("");
                            setSecretKey("");
                            setMerchantName("");
                            setIban("");
                            setCurrentStep(1);
                          }}>
                            ربط حساب آخر
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Sidebar Info */}
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ delay: 0.3 }}
          >
            {/* Supported Methods */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-sm">طرق الدفع المدعومة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "مدى", icon: "💳" },
                  { name: "Apple Pay", icon: "🍎" },
                  { name: "بطاقات Visa / Mastercard", icon: "💳" },
                  { name: "STC Pay", icon: "📱" },
                ].map((method) => (
                  <div key={method.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-lg">{method.icon}</span>
                    <span className="text-sm font-medium">{method.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Security Info */}
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  الأمان والحماية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <p>تشفير البيانات بمعيار AES-256</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <p>متوافق مع PCI DSS</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <p>مرخص من البنك المركزي السعودي</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <p>لا يتم تخزين بيانات البطاقات</p>
                </div>
              </CardContent>
            </Card>

            {/* Note */}
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">ملاحظة مهمة</p>
                    <p className="text-muted-foreground mt-1">
                      تأكد من تفعيل حسابك في Paylink وإكمال التحقق من الهوية قبل الربط. 
                      الحسابات غير المفعّلة لن تتمكن من استقبال المدفوعات.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default NumaxioPay;
