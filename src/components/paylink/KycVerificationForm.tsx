import { useState, useEffect, useCallback } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Shield, Upload, FileText, CheckCircle2, Clock, XCircle,
  Loader2, CreditCard, Sparkles, BanknoteIcon, Building2,
  User, Download, AlertTriangle, FileDown
} from "lucide-react";
import { downloadKycContractPdf } from "@/lib/kyc-contract-pdf";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "./SignaturePad";

interface KycVerificationFormProps {
  onActivated: () => void;
}

const AGREEMENT_HTML = `
<h2 style="text-align:center;font-weight:bold;">إقرار وتعهد بالموافقة على شروط وأحكام خدمة "نيوماكسيو باي"</h2>
<p style="text-align:center;font-size:12px;">(صادر وفقاً لأحكام نظام التجارة الإلكترونية ونظام المدفوعات بالمملكة العربية السعودية)</p>
<hr/>
<p><strong>المادة الأولى — طبيعة الخدمة والوساطة التقنية:</strong> إن خدمة "نيوماكسيو باي" هي خدمة وساطة تقنية للدفع الإلكتروني تُتيحها منصة نيوماكسيو لمشتركيها وفقاً لنموذج التجميع (Payment Aggregation). يُقرّ المشترك بعلمه وفهمه التام بأن منصة نيوماكسيو ليست بنكاً ولا مؤسسة مالية مرخّصة ولا تقوم بمعالجة المدفوعات بشكل مباشر، وإنما تعمل حصراً بصفتها وسيط تقني يربط المشترك بمزوّد خدمة دفع طرف ثالث مرخّص ومعتمد.</p>
<p><strong>المادة الثانية — مزوّد خدمة الدفع:</strong> جميع عمليات الدفع والتحصيل والمعالجة المالية تتم حصرياً عبر مزوّد خدمة دفع طرف ثالث مرخّص من البنك المركزي السعودي (ساما) ومتوافق مع معايير PCI DSS. إدارة نيوماكسيو هي الطرف المتعاقد مباشرةً مع مزوّد الخدمة.</p>
<p><strong>المادة الثالثة — الرسوم والعمولات:</strong> يوافق المشترك على أن إدارة نيوماكسيو تحتفظ بالحق في تحديد وتعديل هيكل الرسوم المطبّقة على كل عملية دفع واردة.</p>
<p><strong>المادة الرابعة — تسوية المبالغ:</strong> تتم تسوية المبالغ الصافية وفقاً لجدول التحويل المحدد.</p>
<p><strong>المادة الخامسة — صحة البيانات:</strong> يتعهد المشترك بأن جميع البيانات المقدّمة صحيحة ودقيقة ومحدّثة ويتحمل كامل المسؤولية عن أي أخطاء.</p>
<p><strong>المادة السادسة — الامتثال التنظيمي:</strong> يتعهد المشترك بالتزامه بجميع الأنظمة واللوائح المعمول بها في المملكة العربية السعودية.</p>
<p><strong>المادة السابعة — حق التعليق والإنهاء:</strong> يحق لإدارة نيوماكسيو تعليق أو إنهاء الخدمة في حالات الاشتباه بالاحتيال أو المخالفات.</p>
<p><strong>المادة الثامنة — المسؤولية القانونية:</strong> يتحمل المشترك كامل المسؤولية عن العمليات المالية وعمليات الاسترداد.</p>
<p><strong>المادة التاسعة — حماية البيانات:</strong> يُقرّ المشترك بعلمه بمشاركة بياناته مع مزوّد الخدمة وفقاً لنظام PDPL.</p>
<p><strong>المادة العاشرة — تعديل الشروط:</strong> يحق لإدارة نيوماكسيو تعديل الشروط مع إخطار مسبق بـ 15 يوم عمل.</p>
<hr/>
<p style="text-align:center;font-weight:bold;">هذا الإقرار عقد إلكتروني ملزم وفقاً لنظام التعاملات الإلكترونية (م/18) ويخضع للقضاء السعودي في الرياض.</p>
`;

const PENDING_MESSAGES = [
  "يتم مراجعة طلبك حالياً من قبل فريق الامتثال المالي ⏳",
  "جاري التدقيق والتحقق من صحة المستندات المقدّمة 🔍",
  "فريق المراجعة المالية يعمل على تدقيق طلبك 📋",
  "سيتم إشعارك فوراً عند اعتماد الطلب من الإدارة ✅",
];

const PendingAnimatedText = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % PENDING_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-6 mt-1.5 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-muted-foreground absolute"
        >
          {PENDING_MESSAGES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

const KycVerificationForm = ({ onActivated }: KycVerificationFormProps) => {
  const { tenantId, user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);

  // Form fields
  const [applicantType, setApplicantType] = useState<string>("company");
  const [businessName, setBusinessName] = useState("");
  const [businessNameEn, setBusinessNameEn] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [fullName, setFullName] = useState("");

  // Documents
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [documents, setDocuments] = useState<Array<{ type: string; name: string; url: string; size: number }>>([]);

  // Agreement
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Load existing KYC request
  const loadExisting = useCallback(async () => {
    if (!tenantId) return;
    setLoadingRequest(true);
    const { data } = await supabase
      .from("paylink_kyc_requests")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setExistingRequest(data[0]);
      if (data[0].status === "approved") {
        onActivated();
      }
    }
    setLoadingRequest(false);
  }, [tenantId, onActivated]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
    }
  }, [profile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الملف يجب ألا يتجاوز 5 ميغابايت");
      return;
    }

    setUploadingDoc(true);
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${tenantId}/${Date.now()}-${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error(`فشل رفع الملف: ${uploadError.message}`);
        setUploadingDoc(false);
        return;
      }

      // Use signed URL since bucket is private
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

      const fileUrl = signedUrlError ? path : signedUrlData.signedUrl;
      setDocuments(prev => [...prev, { type: docType, name: file.name, url: fileUrl, size: file.size }]);
      setUploadingDoc(false);
      toast.success("تم رفع الملف بنجاح");
    } catch (err: any) {
      console.error("Upload exception:", err);
      toast.error("فشل رفع الملف: خطأ غير متوقع");
      setUploadingDoc(false);
    }
  };

  const removeDoc = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep1 = () => {
    if (!businessName.trim()) { toast.error("يرجى إدخال الاسم التجاري"); return false; }
    if (applicantType !== "individual" && !crNumber.trim()) { toast.error("يرجى إدخال رقم السجل التجاري"); return false; }
    if (applicantType === "individual" && !nationalId.trim()) { toast.error("يرجى إدخال رقم الهوية"); return false; }
    if (!phone.trim()) { toast.error("يرجى إدخال رقم الجوال"); return false; }
    if (!email.trim()) { toast.error("يرجى إدخال البريد الإلكتروني"); return false; }
    if (!iban.trim()) { toast.error("يرجى إدخال رقم الآيبان"); return false; }
    if (!fullName.trim()) { toast.error("يرجى إدخال اسم المفوّض"); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (applicantType === "company" && !documents.some(d => d.type === "cr_certificate")) {
      toast.error("يرجى رفع صورة السجل التجاري");
      return false;
    }
    if (applicantType === "individual" && !documents.some(d => d.type === "national_id")) {
      toast.error("يرجى رفع صورة الهوية الوطنية");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!agreedToTerms) { toast.error("يجب الموافقة على الإقرار القانوني"); return; }
    if (!signatureData) { toast.error("يرجى التوقيع إلكترونياً"); return; }
    if (!tenantId || !user) return;

    setIsSubmitting(true);
    const contractNum = `KYC-${Date.now().toString().slice(-8)}`;

    const { data: kycData, error: kycError } = await supabase
      .from("paylink_kyc_requests")
      .insert({
        tenant_id: tenantId,
        applicant_type: applicantType,
        business_name: businessName,
        business_name_en: businessNameEn || null,
        cr_number: crNumber || null,
        vat_number: vatNumber || null,
        national_id: nationalId || null,
        phone,
        email,
        iban,
        bank_name: bankName || null,
        agreement_html: AGREEMENT_HTML,
        agreement_version: "1.0",
        subscriber_signature_data: signatureData,
        subscriber_signed_at: new Date().toISOString(),
        subscriber_user_id: user.id,
        subscriber_full_name: fullName,
        contract_number: contractNum,
        status: "pending",
      } as any)
      .select()
      .single();

    if (kycError) {
      toast.error("حدث خطأ أثناء إرسال الطلب");
      setIsSubmitting(false);
      return;
    }

    // Upload document records
    if (documents.length > 0 && kycData) {
      const docInserts = documents.map(d => ({
        kyc_request_id: (kycData as any).id,
        tenant_id: tenantId,
        document_type: d.type,
        document_name: d.name,
        file_url: d.url,
        file_size: d.size,
        uploaded_by: user.id,
      }));
      await supabase.from("paylink_kyc_documents").insert(docInserts as any);
    }

    setIsSubmitting(false);
    toast.success("🎉 تم إرسال طلب التحقق بنجاح! سيتم مراجعته من قبل الإدارة.");
    loadExisting();
  };

  if (loadingRequest) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Show existing request status
  if (existingRequest && existingRequest.status !== "requires_update") {
    const statusConfig = {
      pending: {
        icon: Clock,
        color: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/30",
        title: "في انتظار المراجعة",
        desc: null, // animated text below
      },
      under_review: {
        icon: Shield,
        color: "text-info",
        bg: "bg-info/10",
        border: "border-info/30",
        title: "جاري التحقق من المستندات",
        desc: "يتم التحقق من المستندات والمعلومات المقدّمة من قبل فريق الامتثال.",
      },
      rejected: {
        icon: XCircle,
        color: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/30",
        title: "تم رفض الطلب",
        desc: existingRequest.rejection_reason || "يرجى التواصل مع الإدارة لمعرفة السبب.",
      },
    };

    const currentStatus = statusConfig[existingRequest.status as keyof typeof statusConfig] || statusConfig.pending;
    const StatusIcon = currentStatus.icon;

    const timelineSteps = [
      { label: "تقديم الطلب", icon: FileText, done: true, date: existingRequest.created_at },
      { label: "مراجعة المستندات", icon: Shield, done: existingRequest.status === "under_review" || existingRequest.status === "approved", active: existingRequest.status === "pending" },
      { label: "التحقق من الهوية", icon: User, done: existingRequest.status === "approved", active: existingRequest.status === "under_review" },
      { label: "تفعيل البوابة", icon: CheckCircle2, done: existingRequest.status === "approved" },
    ];

    const infoCards = [
      { icon: Building2, label: "الاسم التجاري", value: existingRequest.business_name },
      { icon: User, label: "النوع", value: existingRequest.applicant_type === "company" ? "شركة / مؤسسة" : existingRequest.applicant_type === "freelancer" ? "عمل حر" : "فرد" },
      { icon: CreditCard, label: "رقم العقد", value: existingRequest.contract_number },
      { icon: Clock, label: "تاريخ التقديم", value: new Date(existingRequest.created_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) },
      { icon: BanknoteIcon, label: "الآيبان", value: existingRequest.iban ? `****${existingRequest.iban.slice(-4)}` : "—" },
      { icon: Shield, label: "الموقّع", value: existingRequest.subscriber_full_name },
    ];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="text-center space-y-2">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }}>
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-3">
              <Sparkles className="w-4 h-4" /> حالة طلب التحقق
            </div>
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">نيوماكسيو باي — التحقق من الهوية</h2>
          <p className="text-muted-foreground text-sm">رقم العقد: <span className="font-mono text-foreground">{existingRequest.contract_number}</span></p>
        </div>

        {/* Status Banner */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <Card className={`border-2 ${currentStatus.border} overflow-hidden`}>
            <CardContent className="p-0">
              <div className={`${currentStatus.bg} p-6`}>
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={existingRequest.status === "pending" ? { rotate: [0, 15, -15, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className={`w-16 h-16 rounded-2xl ${currentStatus.bg} border ${currentStatus.border} flex items-center justify-center`}
                  >
                    <StatusIcon className={`w-8 h-8 ${currentStatus.color}`} />
                  </motion.div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${currentStatus.color} font-[IBM_Plex_Sans_Arabic]`}>{currentStatus.title}</h3>
                    {existingRequest.status === "pending" ? (
                      <PendingAnimatedText />
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">{currentStatus.desc}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`${currentStatus.color} ${currentStatus.border} text-xs px-3 py-1`}>
                    {existingRequest.status === "pending" ? "قيد الانتظار" : existingRequest.status === "under_review" ? "تحت المراجعة" : "مرفوض"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Timeline */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" /> مراحل التحقق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between relative">
                {/* Progress line */}
                <div className="absolute top-5 right-10 left-10 h-0.5 bg-border" />
                <div
                  className="absolute top-5 right-10 h-0.5 bg-accent transition-all duration-700"
                  style={{
                    width: `${(timelineSteps.filter(s => s.done).length / timelineSteps.length) * 100}%`,
                    maxWidth: "calc(100% - 80px)"
                  }}
                />
                {timelineSteps.map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex flex-col items-center gap-2 relative z-10"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      step.done ? "bg-accent border-accent text-accent-foreground" :
                      step.active ? "bg-warning/10 border-warning text-warning animate-pulse" :
                      "bg-muted border-border text-muted-foreground"
                    )}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      "text-xs font-medium text-center max-w-[80px]",
                      step.done ? "text-accent" : step.active ? "text-warning" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                    {step.done && step.date && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(step.date).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Cards Grid */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" /> بيانات الطلب
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {infoCards.map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45 + i * 0.05 }}
                    className="p-3 rounded-xl bg-muted/40 border border-border/50 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <card.icon className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs text-muted-foreground">{card.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{card.value}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tips & Download */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tips */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" /> ملاحظات مهمة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "مدة المراجعة من ١ إلى ٣ أيام عمل",
                "سيتم إخطارك عبر البريد الإلكتروني عند التحديث",
                "تأكد من صحة بيانات الآيبان لتجنب تأخير التحويلات",
                "يمكنك تحميل نسخة من العقد الرسمي في أي وقت",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-accent" /> إجراءات متاحة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full gap-2 h-12" onClick={() => {
                downloadKycContractPdf({
                  contractNumber: existingRequest.contract_number,
                  businessName: existingRequest.business_name,
                  businessNameEn: existingRequest.business_name_en,
                  applicantType: existingRequest.applicant_type,
                  crNumber: existingRequest.cr_number,
                  vatNumber: existingRequest.vat_number,
                  nationalId: existingRequest.national_id,
                  phone: existingRequest.phone,
                  email: existingRequest.email,
                  iban: existingRequest.iban,
                  bankName: existingRequest.bank_name,
                  subscriberFullName: existingRequest.subscriber_full_name,
                  subscriberSignedAt: existingRequest.subscriber_signed_at,
                  subscriberSignatureData: existingRequest.subscriber_signature_data,
                  agreementHtml: existingRequest.agreement_html,
                  createdAt: existingRequest.created_at,
                  status: existingRequest.status,
                });
              }}>
                <FileDown className="w-5 h-5 text-accent" />
                <span>تحميل العقد الرسمي (PDF)</span>
              </Button>
              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-center">
                <p className="text-xs text-muted-foreground">هل تحتاج مساعدة؟</p>
                <p className="text-sm font-medium text-accent mt-1">support@numaxio.com</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  const docTypes = applicantType === "individual"
    ? [{ key: "national_id", label: "صورة الهوية الوطنية", required: true }, { key: "bank_letter", label: "خطاب بنكي", required: false }]
    : applicantType === "freelancer"
    ? [{ key: "freelancer_certificate", label: "وثيقة العمل الحر", required: true }, { key: "national_id", label: "صورة الهوية", required: true }, { key: "bank_letter", label: "خطاب بنكي", required: false }]
    : [{ key: "cr_certificate", label: "صورة السجل التجاري", required: true }, { key: "vat_certificate", label: "شهادة ضريبة القيمة المضافة", required: false }, { key: "authorization_letter", label: "خطاب تفويض", required: false }, { key: "bank_letter", label: "خطاب بنكي", required: false }];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
          <Sparkles className="w-4 h-4" /> بوابة دفع متكاملة
        </div>
        <h2 className="text-3xl font-bold text-foreground font-[IBM_Plex_Sans_Arabic]">تفعيل نيوماكسيو باي</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">أكمل التحقق من الهوية لتفعيل بوابة الدفع. يتطلب اعتماد الإدارة قبل التفعيل.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-0">
        {[
          { num: 1, label: "البيانات الأساسية" },
          { num: 2, label: "المستندات" },
          { num: 3, label: "الاتفاقية والتوقيع" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= s.num ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}>{s.num}</div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s.label}</span>
            </div>
            {i < 2 && <div className={`w-16 h-0.5 mx-2 mb-4 ${step > s.num ? "bg-accent" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" /> البيانات الأساسية
            </CardTitle>
            <CardDescription>أدخل معلومات المنشأة أو الفرد المراد تفعيل البوابة باسمه</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>نوع المشترك *</Label>
              <Select value={applicantType} onValueChange={setApplicantType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">شركة / مؤسسة</SelectItem>
                  <SelectItem value="freelancer">مستقل (وثيقة عمل حر)</SelectItem>
                  <SelectItem value="individual">فرد</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{applicantType === "individual" ? "الاسم الكامل *" : "الاسم التجاري *"}</Label>
                <Input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder={applicantType === "individual" ? "الاسم الرباعي" : "اسم المنشأة كما في السجل"} />
              </div>
              <div className="space-y-2">
                <Label>{applicantType === "individual" ? "الاسم بالإنجليزية" : "الاسم التجاري (إنجليزي)"}</Label>
                <Input value={businessNameEn} onChange={e => setBusinessNameEn(e.target.value)} dir="ltr" />
              </div>
            </div>

            {applicantType !== "individual" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>رقم السجل التجاري *</Label>
                  <Input value={crNumber} onChange={e => setCrNumber(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الرقم الضريبي</Label>
                  <Input value={vatNumber} onChange={e => setVatNumber(e.target.value)} dir="ltr" />
                </div>
              </div>
            )}

            {applicantType === "individual" && (
              <div className="space-y-2">
                <Label>رقم الهوية الوطنية *</Label>
                <Input value={nationalId} onChange={e => setNationalId(e.target.value)} dir="ltr" />
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الجوال *</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" placeholder="+966" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني *</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" dir="ltr" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الآيبان (IBAN) *</Label>
                <Input value={iban} onChange={e => setIban(e.target.value)} dir="ltr" placeholder="SA..." />
              </div>
              <div className="space-y-2">
                <Label>اسم البنك</Label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>اسم الشخص المفوّض / الموقّع *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => { if (validateStep1()) setStep(2); }} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-8">
                التالي <span className="rotate-180">←</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Documents */}
      {step === 2 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" /> المستندات المطلوبة
            </CardTitle>
            <CardDescription>ارفع المستندات اللازمة للتحقق من الهوية (الحد الأقصى 5 ميغابايت لكل ملف)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {docTypes.map(dt => {
              const uploaded = documents.find(d => d.type === dt.key);
              return (
                <div key={dt.key} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{dt.label} {dt.required && <span className="text-destructive">*</span>}</p>
                    {uploaded ? (
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs text-success">{uploaded.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive h-6 px-2" onClick={() => removeDoc(documents.indexOf(uploaded))}>
                          حذف
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG, PNG</p>
                    )}
                  </div>
                  {!uploaded && (
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => handleFileUpload(e, dt.key)} disabled={uploadingDoc} />
                      <Button type="button" variant="outline" size="sm" className="gap-1 text-xs pointer-events-none">
                        {uploadingDoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} رفع
                      </Button>
                    </label>
                  )}
                </div>
              );
            })}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>السابق</Button>
              <Button onClick={() => { if (validateStep2()) setStep(3); }} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-8">
                التالي <span className="rotate-180">←</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Agreement & Signature */}
      {step === 3 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-destructive" /> الاتفاقية والتوقيع الإلكتروني
            </CardTitle>
            <CardDescription>اقرأ الاتفاقية بعناية ثم وقّع إلكترونياً للمتابعة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agreement text */}
            <div className="bg-muted/60 border border-border rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(AGREEMENT_HTML) }} />

            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">بتوقيعك أدناه، فإنك تُقرّ بأنك الممثل القانوني المفوّض وأن هذا التوقيع ملزم قانوناً وفقاً لنظام التعاملات الإلكترونية السعودي.</p>
            </div>

            {/* Signatory info */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-muted-foreground">الموقّع:</span> <span className="font-semibold text-foreground">{fullName}</span></p>
              <p><span className="text-muted-foreground">المنشأة:</span> <span className="font-semibold text-foreground">{businessName}</span></p>
              <p><span className="text-muted-foreground">التاريخ:</span> <span className="font-semibold text-foreground">{new Date().toLocaleDateString("ar-SA")}</span></p>
            </div>

            {/* Signature Pad */}
            <SignaturePad onSignatureChange={setSignatureData} label="توقيع المشترك الإلكتروني" />

            {/* Checkbox */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-accent/30 bg-accent/5">
              <Checkbox id="agree-kyc" checked={agreedToTerms} onCheckedChange={c => setAgreedToTerms(c === true)} className="mt-0.5" />
              <label htmlFor="agree-kyc" className="text-sm text-foreground cursor-pointer leading-relaxed">
                أقرّ بأنني قرأت جميع الشروط والأحكام وأوافق عليها بالكامل، وأن التوقيع أعلاه يمثّل توقيعي الإلكتروني المعتمد والملزم قانوناً.
              </label>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>السابق</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !agreedToTerms || !signatureData}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-8"
              >
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإرسال...</> : <><CreditCard className="w-4 h-4" /> إرسال طلب التفعيل</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default KycVerificationForm;
