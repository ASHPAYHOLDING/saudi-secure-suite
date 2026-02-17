import { useState, useCallback, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Wallet, TrendingUp, Clock, CheckCircle2, XCircle,
  ArrowDownToLine, Receipt, ChevronLeft, DollarSign, Percent,
  Loader2, BanknoteIcon, Sparkles, Shield, CreditCard,
  Download, Send
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { usePaylinkData } from "@/hooks/usePaylinkData";
import { supabase } from "@/integrations/supabase/client";
import PayoutSettings from "@/components/paylink/PayoutSettings";

const NumaxioPay = () => {
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const { transactions, stats, loading: dataLoading, refetch, feeConfig } = usePaylinkData(tenantId ?? undefined);

  const [isActivating, setIsActivating] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "payouts">("overview");

  // Check if paylink is enabled for this tenant
  const checkStatus = useCallback(async () => {
    if (!tenantId) return;
    setCheckingStatus(true);
    const { data } = await supabase
      .from("tenants")
      .select("paylink_enabled")
      .eq("id", tenantId)
      .single();
    setIsEnabled(data?.paylink_enabled ?? false);
    setCheckingStatus(false);
  }, [tenantId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleActivate = async () => {
    if (!tenantId) return;
    setIsActivating(true);
    const { error } = await supabase
      .from("tenants")
      .update({ paylink_enabled: true, paylink_enabled_at: new Date().toISOString() })
      .eq("id", tenantId);
    setIsActivating(false);
    if (error) {
      toast.error("حدث خطأ أثناء التفعيل، حاول مرة أخرى");
    } else {
      setIsEnabled(true);
      toast.success("🎉 تم تفعيل بوابة الدفع بنجاح!");
      refetch();
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح");
      return;
    }
    if (amount > stats.availableBalance) {
      toast.error("المبلغ المطلوب يتجاوز الرصيد المتاح");
      return;
    }
    if (!tenantId) return;

    setIsWithdrawing(true);
    const txNum = `TXN-W${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from("paylink_transactions").insert({
      tenant_id: tenantId,
      transaction_number: txNum,
      transaction_type: "withdrawal",
      description: "سحب إلى الحساب البنكي",
      gross_amount: amount,
      fee_amount: 0,
      net_amount: amount,
      status: "completed",
      payment_method: "تحويل بنكي",
      created_by: user?.id,
    });
    setIsWithdrawing(false);
    if (error) {
      toast.error("حدث خطأ أثناء السحب");
    } else {
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      toast.success(`✅ تم طلب سحب ${amount.toLocaleString("ar-SA")} ر.س بنجاح.`);
      refetch();
    }
  };

  const filteredTransactions = transactions.filter(
    (t) => filterType === "all" || t.transaction_type === filterType
  );

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";

  if (checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const kpis = [
    { label: "إجمالي المبيعات", value: stats.totalSales, icon: TrendingUp, color: "text-accent", bg: "bg-accent/10" },
    { label: "المبالغ المعلّقة", value: stats.pendingAmount, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "إجمالي الرسوم", value: stats.totalFees, icon: Percent, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "صافي المبلغ", value: stats.netAmount, icon: DollarSign, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
              <Wallet className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">نيوماكسيو باي</h1>
              <p className="text-xs text-muted-foreground">
                {isEnabled ? "لوحة تحكم المدفوعات" : "تفعيل بوابة الدفع"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1">
            رجوع
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* === ACTIVATION STATE === */}
        {!isEnabled && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-8">
            {/* Hero */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                بوابة دفع متكاملة
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">
                استقبل مدفوعاتك بسهولة
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-base">
                فعّل بوابة الدفع لاستقبال المدفوعات إلكترونياً عبر مدى، Apple Pay، وبطاقات الائتمان. البوابة مربوطة مباشرة بإدارة النظام.
              </p>
            </div>

            {/* Info Card */}
            <Card className="border-border/60">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-info/5 border border-info/20">
                  <Shield className="w-5 h-5 text-info mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">بوابة مُدارة بالكامل</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      عند التفعيل، يتم ربط حسابك تلقائياً ببوابة الدفع المركزية. جميع المدفوعات تصل مباشرة إلى النظام ويتم تسويتها تلقائياً حسب الجدول المحدد.
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: CreditCard, title: "مدى & Apple Pay", desc: "استقبل المدفوعات بجميع الطرق" },
                    { icon: Shield, title: "آمن ومشفّر", desc: "حماية كاملة للبيانات المالية" },
                    { icon: Receipt, title: "تقارير فورية", desc: "تتبع كل عملية لحظة بلحظة" },
                    { icon: BanknoteIcon, title: "سحب سهل", desc: "اسحب أرباحك في أي وقت" },
                  ].map((f) => (
                    <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <f.icon className="w-4 h-4 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Legal Agreement Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-destructive" />
                    <h3 className="text-sm font-bold text-foreground">إقرار وموافقة قانونية</h3>
                  </div>

                  <div className="bg-muted/60 border border-border rounded-lg p-4 max-h-72 overflow-y-auto text-sm text-muted-foreground leading-relaxed space-y-3">
                    <p className="font-bold text-foreground text-center text-base mb-2">إقرار وتعهد بالموافقة على شروط وأحكام خدمة "نيوماكسيو باي"</p>
                    <p className="text-foreground text-xs text-center mb-3">(صادر وفقاً لأحكام نظام التجارة الإلكترونية ونظام المدفوعات بالمملكة العربية السعودية)</p>

                    <p className="font-semibold text-foreground">أنا الموقّع أدناه (المُشار إليه بـ "المشترك")، بصفتي الممثل القانوني المفوّض للمنشأة، أقرّ وأوافق صراحةً وبشكل نهائي وغير قابل للرجوع على جميع البنود والشروط التالية:</p>

                    <Separator className="my-2" />

                    <p><strong className="text-foreground">المادة الأولى — طبيعة الخدمة ومقدّمها:</strong> إن خدمة "نيوماكسيو باي" هي خدمة وساطة دفع إلكترونية تُتيحها منصة نيوماكسيو لمشتركيها. تتم معالجة عمليات الدفع الإلكتروني من خلال <strong className="text-foreground">مزوّد خدمة دفع طرف ثالث مرخّص</strong> تم التعاقد معه من قبل إدارة نيوماكسيو وفقاً للأنظمة المعمول بها. لا تقوم منصة نيوماكسيو بمعالجة المدفوعات بشكل مباشر، وإنما تعمل كوسيط تقني بين المشترك ومزوّد خدمة الدفع المعتمد.</p>

                    <p><strong className="text-foreground">المادة الثانية — مزوّد خدمة الدفع (الطرف الثالث):</strong> يُقرّ المشترك بعلمه أن عمليات الدفع والتحصيل تتم عبر مزوّد خدمة دفع مرخّص من البنك المركزي السعودي (ساما)، وأن إدارة نيوماكسيو هي الطرف المتعاقد مع مزوّد الخدمة نيابةً عن المشتركين. يخضع مزوّد الخدمة لرقابة الجهات التنظيمية المختصة في المملكة العربية السعودية، ويلتزم بمعايير أمان بيانات صناعة بطاقات الدفع (PCI DSS).</p>

                    <p><strong className="text-foreground">المادة الثالثة — الرسوم والعمولات:</strong> يوافق المشترك على أن إدارة نيوماكسيو تحتفظ بالحق الكامل في تحديد وتعديل هيكل الرسوم المطبّقة (سواءً نسبة مئوية أو مبلغ ثابت أو مزيج منهما) على كل عملية دفع واردة. تشمل الرسوم: (أ) رسوم معالجة الدفع لمزوّد الخدمة، و(ب) رسوم الخدمة الإدارية لمنصة نيوماكسيو. يتم خصم هذه الرسوم تلقائياً من كل عملية قبل تسوية المبالغ الصافية إلى حساب المشترك.</p>

                    <p><strong className="text-foreground">المادة الرابعة — تسوية المبالغ والتحويلات:</strong> تتم تسوية المبالغ الصافية (بعد خصم جميع الرسوم) وفقاً لجدول التحويل المحدد من المشترك (يومي، أسبوعي، أو شهري)، مع مراعاة الحد الأدنى للسحب المعتمد. يُقرّ المشترك بأن: (أ) مواعيد التسوية استرشادية وقد تتأثر بالإجراءات البنكية، و(ب) لا تتحمل إدارة نيوماكسيو المسؤولية عن أي تأخير ناتج عن مزوّد الخدمة أو البنوك أو الجهات التنظيمية.</p>

                    <p><strong className="text-foreground">المادة الخامسة — صحة البيانات والمسؤولية:</strong> يتعهد المشترك بأن جميع البيانات المقدّمة (بما في ذلك: الاسم التجاري، السجل التجاري، الرقم الضريبي، بيانات الحساب البنكي ورقم الآيبان IBAN) صحيحة ودقيقة ومحدّثة. يتحمل المشترك كامل المسؤولية القانونية والمالية عن أي أخطاء أو بيانات مغلوطة، بما في ذلك أي خسائر مالية أو تبعات نظامية تنشأ عن ذلك.</p>

                    <p><strong className="text-foreground">المادة السادسة — الامتثال التنظيمي والقانوني:</strong> يتعهد المشترك بالتزامه الكامل بجميع الأنظمة واللوائح المعمول بها في المملكة العربية السعودية، بما في ذلك على سبيل المثال لا الحصر: (أ) لوائح البنك المركزي السعودي (ساما) المتعلقة بخدمات الدفع، (ب) نظام مكافحة غسل الأموال وتمويل الإرهاب، (ج) نظام حماية البيانات الشخصية (PDPL)، (د) نظام التجارة الإلكترونية، (هـ) نظام مكافحة الاحتيال المالي وخيانة الأمانة. كما يتعهد بعدم استخدام بوابة الدفع في أي نشاط مخالف للشريعة الإسلامية أو الأنظمة السعودية.</p>

                    <p><strong className="text-foreground">المادة السابعة — حق التعليق والإنهاء:</strong> يحق لإدارة نيوماكسيو — بشكل منفرد ودون الحاجة لإبداء الأسباب — تعليق أو تقييد أو إنهاء خدمة بوابة الدفع للمشترك فوراً في أي من الحالات التالية: (أ) الاشتباه في نشاط احتيالي أو غسل أموال، (ب) مخالفة أي من شروط الاستخدام، (ج) طلب من جهة تنظيمية أو قضائية مختصة، (د) تعليق أو إنهاء العلاقة مع مزوّد خدمة الدفع. وللإدارة الحق في تجميد المبالغ المعلّقة لحين استكمال التحقيقات اللازمة.</p>

                    <p><strong className="text-foreground">المادة الثامنة — المسؤولية القانونية والنزاعات:</strong> يتحمل المشترك كامل المسؤولية القانونية والمالية عن: (أ) جميع العمليات المالية التي تتم عبر بوابة الدفع المرتبطة بحسابه، (ب) عمليات الاسترداد (Chargeback) والنزاعات مع العملاء، (ج) أي مطالبات قانونية ناشئة عن استخدام الخدمة. كما يُعفي المشترك إدارة نيوماكسيو من أي مسؤولية تجاه أخطاء أو أعطال مزوّد خدمة الدفع الطرف الثالث، ما لم يثبت تقصير متعمد من إدارة نيوماكسيو.</p>

                    <p><strong className="text-foreground">المادة التاسعة — حماية البيانات والخصوصية:</strong> يُقرّ المشترك بعلمه أن بياناته المالية والشخصية قد تتم مشاركتها مع مزوّد خدمة الدفع الطرف الثالث بالقدر اللازم لمعالجة عمليات الدفع، وذلك وفقاً لنظام حماية البيانات الشخصية (PDPL). تلتزم إدارة نيوماكسيو بحماية هذه البيانات وفقاً لسياسة الخصوصية المعتمدة.</p>

                    <p><strong className="text-foreground">المادة العاشرة — تعديل الشروط والأحكام:</strong> يحق لإدارة نيوماكسيو تعديل هذه الشروط والأحكام أو هيكل الرسوم في أي وقت. سيتم إخطار المشترك بأي تعديلات جوهرية عبر المنصة أو البريد الإلكتروني قبل (15) يوم عمل من تاريخ السريان. استمرار المشترك في استخدام الخدمة بعد انقضاء مهلة الإخطار يُعتبر قبولاً ضمنياً وملزماً بالتعديلات.</p>

                    <Separator className="my-2" />

                    <p className="font-bold text-foreground text-center">الإقرار النهائي</p>
                    <p className="font-semibold text-foreground">يُقرّ المشترك بأنه قد قرأ جميع البنود والشروط الواردة أعلاه وفهمها فهماً كاملاً، وأنه يوافق عليها طوعاً واختياراً دون أي إكراه. يُعتبر هذا الإقرار بمثابة عقد إلكتروني ملزم وفقاً لنظام التعاملات الإلكترونية الصادر بالمرسوم الملكي رقم (م/18) بتاريخ 8/3/1428هـ، ويخضع لأنظمة وقوانين المملكة العربية السعودية. أي نزاع ينشأ عن هذا الإقرار أو يتعلق به يختص بالفصل فيه القضاء السعودي المختص في مدينة الرياض.</p>
                  </div>

                  {/* Agreement Checkbox */}
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-accent/30 bg-accent/5">
                    <Checkbox
                      id="agree-terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="agree-terms" className="text-sm text-foreground cursor-pointer leading-relaxed">
                      أقرّ بأنني قرأت وفهمت جميع الشروط والأحكام المذكورة أعلاه، وأوافق عليها بالكامل بصفتي الممثل القانوني المخوّل للمنشأة.
                    </label>
                  </div>
                </div>

                {/* Activate Button */}
                <div className="text-center">
                  <Button
                    onClick={handleActivate}
                    disabled={isActivating || !agreedToTerms}
                    size="lg"
                    className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-8 text-base disabled:opacity-50"
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جارٍ التفعيل...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        أوافق وأفعّل بوابة الدفع
                      </>
                    )}
                  </Button>
                  {!agreedToTerms && (
                    <p className="text-xs text-destructive mt-2">
                      يجب الموافقة على الإقرار القانوني أعلاه للمتابعة
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* === DASHBOARD STATE === */}
        {isEnabled && (
          <div className="space-y-6">
            {/* Admin-linked message */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-accent/5 border border-accent/20">
                <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">بوابة الدفع مفعّلة ومربوطة بإدارة النظام</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    كل المدفوعات الواردة تصل مباشرة إلى النظام ويتم خصم الرسوم تلقائياً. يمكنك سحب رصيدك في أي وقت.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5 w-fit">
              {([
                { key: "overview" as const, label: "نظرة عامة", icon: Receipt },
                { key: "payouts" as const, label: "التحويلات والإعدادات", icon: Send },
              ]).map((t) => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                    activeTab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <t.icon className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </div>

            {activeTab === "payouts" && <PayoutSettings />}

            {activeTab === "overview" && (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kpis.map((kpi, i) => (
                    <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                      <Card className="border-border/60 hover:shadow-md transition-shadow">
                        <CardContent className="pt-5 pb-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                            <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                            </div>
                          </div>
                          <p className="text-xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">{formatCurrency(kpi.value)}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Balance + Withdraw */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <Card className="border-accent/20 bg-gradient-to-l from-accent/5 to-transparent">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                            <BanknoteIcon className="w-7 h-7 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">الرصيد المتاح للسحب</p>
                            <p className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">{formatCurrency(stats.availableBalance)}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <Badge variant="outline" className="text-xs">
                                نوع الرسوم: {feeConfig?.fee_type === "fixed" ? "مبلغ ثابت" : feeConfig?.fee_type === "combined" ? "مشترك" : "نسبة مئوية"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {feeConfig?.fee_type === "fixed"
                                  ? `${feeConfig.fee_fixed_amount} ر.س لكل عملية`
                                  : `${stats.feeRate}% لكل عملية`}
                                {feeConfig?.fee_type === "combined" && ` + ${feeConfig.fee_fixed_amount} ر.س`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button onClick={() => setShowWithdrawDialog(true)} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-6" size="lg">
                          <ArrowDownToLine className="w-5 h-5" /> سحب مبلغ
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Transactions Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                  <Card className="border-border/60">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-accent" /> سجل المعاملات
                          </CardTitle>
                          <CardDescription>جميع عمليات الإيداع والسحب مع تفاصيل الرسوم</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex bg-muted rounded-lg p-0.5">
                            {([
                              { key: "all" as const, label: "الكل" },
                              { key: "deposit" as const, label: "إيداع" },
                              { key: "withdrawal" as const, label: "سحب" },
                            ]).map((f) => (
                              <button key={f.key} onClick={() => setFilterType(f.key)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                  filterType === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                }`}>{f.label}</button>
                            ))}
                          </div>
                          <Button variant="outline" size="sm" className="gap-1"><Download className="w-3.5 h-3.5" /> تصدير</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-right font-semibold">رقم العملية</TableHead>
                              <TableHead className="text-right font-semibold">التاريخ</TableHead>
                              <TableHead className="text-right font-semibold">النوع</TableHead>
                              <TableHead className="text-right font-semibold">الوصف</TableHead>
                              <TableHead className="text-right font-semibold">المبلغ</TableHead>
                              <TableHead className="text-right font-semibold">الرسوم</TableHead>
                              <TableHead className="text-right font-semibold">الصافي</TableHead>
                              <TableHead className="text-right font-semibold">الحالة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTransactions.map((tx) => (
                              <TableRow key={tx.id} className="hover:bg-muted/30">
                                <TableCell className="font-mono text-xs text-muted-foreground">{tx.transaction_number}</TableCell>
                                <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={`text-xs ${
                                    tx.transaction_type === "deposit" ? "bg-success/10 text-success border-success/20" : "bg-info/10 text-info border-info/20"
                                  }`}>{tx.transaction_type === "deposit" ? "إيداع" : "سحب"}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">{tx.description}</TableCell>
                                <TableCell className="text-sm font-semibold">{formatCurrency(tx.gross_amount)}</TableCell>
                                <TableCell className="text-sm text-destructive">{tx.fee_amount > 0 ? `-${formatCurrency(tx.fee_amount)}` : "—"}</TableCell>
                                <TableCell className="text-sm font-semibold text-accent">{formatCurrency(tx.net_amount)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${
                                    tx.status === "completed" ? "text-success border-success/30" :
                                    tx.status === "pending" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"
                                  }`}>
                                    {tx.status === "completed" ? <><CheckCircle2 className="w-3 h-3 ml-1" /> مكتمل</> :
                                     tx.status === "pending" ? <><Clock className="w-3 h-3 ml-1" /> معلّق</> :
                                     <><XCircle className="w-3 h-3 ml-1" /> فشل</>}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {filteredTransactions.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p>لا توجد معاملات{filterType !== "all" ? " بهذا الفلتر" : " بعد"}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Withdraw Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-accent" /> طلب سحب
            </DialogTitle>
            <DialogDescription>أدخل المبلغ المراد سحبه إلى حسابك البنكي</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-2xl font-bold text-accent font-[IBM_Plex_Sans_Arabic]">{formatCurrency(stats.availableBalance)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">مبلغ السحب (ر.س)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="text-lg font-semibold text-center"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowWithdrawDialog(false)}>إلغاء</Button>
            <Button onClick={handleWithdraw} disabled={isWithdrawing} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              {isWithdrawing ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ السحب...</> : "تأكيد السحب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NumaxioPay;
