import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ShieldCheck, FileCheck, CheckCircle2,
  XCircle, Clock, RefreshCw, FileText,
  Award, TrendingUp, Shield
} from "lucide-react";
import ZatcaCertificateManagement from "./ZatcaCertificateManagement";
import ZatcaOnboardingWizard from "./ZatcaOnboardingWizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/useLanguage";
import PageHeader from "@/components/dashboard/PageHeader";

interface ComplianceData {
  zatcaPhase1: boolean;
  zatcaPhase2Ready: boolean;
  vatRegistered: boolean;
  vatNumber: string | null;
  crNumber: string | null;
  activeCertificates: number;
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  pendingSubmissions: number;
  recentSubmissions: any[];
  invoicesSinceLastMonth: number;
  invoicesWithZatca: number;
}

/** Respect prefers-reduced-motion */
const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35, ease: "easeOut" },
});

const ComplianceHubDashboard = () => {
  const { tenantId } = useAuth();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const reduced = useReducedMotion();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);

    const [tenantRes, certsRes, subsRes, invoicesRes] = await Promise.all([
      supabase.from("tenants").select("zatca_phase1_enabled, zatca_phase2_ready, vat_registered, vat_number, cr_number").eq("id", tenantId).single(),
      (supabase as any).from("zatca_certificates").select("id, is_active, certificate_type").eq("tenant_id", tenantId),
      (supabase as any).from("zatca_submission_log").select("id, status, created_at, invoice_id").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
      supabase.from("invoices").select("id, zatca_status, created_at").eq("tenant_id", tenantId).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);

    const tenant = tenantRes.data as any;
    const certs = certsRes.data || [];
    const subs = subsRes.data || [];
    const invoices = invoicesRes.data || [];

    const activeCerts = certs.filter((c: any) => c.is_active).length;
    const successful = subs.filter((s: any) => s.status === "success" || s.status === "reported" || s.status === "cleared").length;
    const failed = subs.filter((s: any) => s.status === "error" || s.status === "rejected").length;
    const pending = subs.filter((s: any) => s.status === "pending").length;
    const withZatca = invoices.filter((i: any) => i.zatca_status && i.zatca_status !== "pending" && i.zatca_status !== "not_submitted").length;

    setData({
      zatcaPhase1: tenant?.zatca_phase1_enabled || false,
      zatcaPhase2Ready: tenant?.zatca_phase2_ready || false,
      vatRegistered: tenant?.vat_registered || false,
      vatNumber: tenant?.vat_number,
      crNumber: tenant?.cr_number,
      activeCertificates: activeCerts,
      totalSubmissions: subs.length,
      successfulSubmissions: successful,
      failedSubmissions: failed,
      pendingSubmissions: pending,
      recentSubmissions: subs.slice(0, 10),
      invoicesSinceLastMonth: invoices.length,
      invoicesWithZatca: withZatca,
    });
    setLoading(false);
  };

  const getComplianceScore = () => {
    if (!data) return 0;
    let score = 0;
    if (data.vatRegistered) score += 20;
    if (data.vatNumber) score += 10;
    if (data.crNumber) score += 10;
    if (data.zatcaPhase1) score += 20;
    if (data.zatcaPhase2Ready) score += 20;
    if (data.activeCertificates > 0) score += 10;
    if (data.totalSubmissions > 0 && data.failedSubmissions === 0) score += 10;
    return Math.min(score, 100);
  };

  const score = getComplianceScore();
  const scoreColor = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  const scoreBg = score >= 80 ? "bg-success/10" : score >= 50 ? "bg-warning/10" : "bg-destructive/10";

  const statusBadge = (status: string) => {
    const configs: Record<string, { cls: string; label: string }> = {
      success: { cls: "bg-success/10 text-success border-success/30", label: isAr ? "ناجح" : "Success" },
      reported: { cls: "bg-success/10 text-success border-success/30", label: isAr ? "مبلّغ" : "Reported" },
      cleared: { cls: "bg-success/10 text-success border-success/30", label: isAr ? "مقبول" : "Cleared" },
      error: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: isAr ? "مرفوض" : "Rejected" },
      rejected: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: isAr ? "مرفوض" : "Rejected" },
    };
    const config = configs[status] || { cls: "bg-warning/10 text-warning border-warning/30", label: isAr ? "معلق" : "Pending" };
    return <Badge className={`${config.cls} text-[10px]`}>{config.label}</Badge>;
  };

  const Wrapper = reduced ? "div" as any : motion.div;
  const motionProps = (delay = 0) => reduced ? {} : fadeUp(delay);

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const checklistItems = [
    { label: isAr ? "التسجيل في ضريبة القيمة المضافة" : "VAT Registration", done: data?.vatRegistered },
    { label: isAr ? "إدخال الرقم الضريبي" : "Tax Number Entered", done: !!data?.vatNumber },
    { label: isAr ? "إدخال السجل التجاري" : "CR Number Entered", done: !!data?.crNumber },
    { label: isAr ? "تفعيل ZATCA المرحلة الأولى (QR)" : "ZATCA Phase 1 (QR) Active", done: data?.zatcaPhase1 },
    { label: isAr ? "تفعيل ZATCA المرحلة الثانية (XML + توقيع)" : "ZATCA Phase 2 (XML + Signing)", done: data?.zatcaPhase2Ready },
    { label: isAr ? "شهادة ZATCA فعّالة" : "Active ZATCA Certificate", done: (data?.activeCertificates || 0) > 0 },
    { label: isAr ? "إرسال فاتورة ناجحة واحدة على الأقل" : "At Least 1 Successful Submission", done: (data?.successfulSubmissions || 0) > 0 },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <PageHeader
        title={isAr ? "مركز الامتثال" : "Compliance Hub"}
        description={isAr ? "حالة امتثال ZATCA والضريبة والتنظيمات السعودية" : "ZATCA, VAT, and Saudi regulatory compliance status"}
        actions={[{
          label: isAr ? "تحديث" : "Refresh",
          icon: <RefreshCw className="w-4 h-4" />,
          onClick: loadData,
          variant: "outline",
        }]}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          {score >= 80 && (
            <Badge className="bg-success/10 text-success border-success/30 text-xs">
              {isAr ? "جاهز للتدقيق" : "Audit Ready"}
            </Badge>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Score */}
        <Wrapper {...motionProps(0)}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl ${scoreBg} flex items-center justify-center`}>
                  <Award className={`w-6 h-6 ${scoreColor}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold font-english ${scoreColor}`}>{score}%</p>
                  <p className="text-[10px] text-muted-foreground">{isAr ? "نقاط الامتثال" : "Compliance Score"}</p>
                </div>
              </div>
              <Progress value={score} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-2">
                {score >= 80
                  ? (isAr ? "ممتاز — مؤهل للفوترة الإلكترونية" : "Excellent — E-invoicing ready")
                  : score >= 50
                    ? (isAr ? "جيد — يحتاج تحسينات" : "Good — Needs improvements")
                    : (isAr ? "ضعيف — إجراءات مطلوبة" : "Low — Action required")}
              </p>
            </CardContent>
          </Card>
        </Wrapper>

        {/* ZATCA Phase */}
        <Wrapper {...motionProps(0.05)}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <FileCheck className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-[10px]">ZATCA</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isAr ? "المرحلة الأولى" : "Phase 1"}</span>
                  {data?.zatcaPhase1 ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isAr ? "المرحلة الثانية" : "Phase 2"}</span>
                  {data?.zatcaPhase2Ready ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4 text-warning" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isAr ? "الشهادات الفعالة" : "Active Certs"}</span>
                  <span className="text-xs font-english font-semibold text-foreground">{data?.activeCertificates || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Wrapper>

        {/* Submissions */}
        <Wrapper {...motionProps(0.1)}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-[10px]">{isAr ? "آخر 30 يوم" : "Last 30 days"}</Badge>
              </div>
              <p className="text-2xl font-bold font-english text-foreground">{data?.invoicesSinceLastMonth || 0}</p>
              <p className="text-[10px] text-muted-foreground">{isAr ? "فواتير صادرة" : "Invoices issued"}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{isAr ? "مقدمة لـ ZATCA" : "Submitted to ZATCA"}</span>
                    <span className="font-english text-success">{data?.invoicesWithZatca || 0}</span>
                  </div>
                  <Progress value={data && data.invoicesSinceLastMonth > 0 ? (data.invoicesWithZatca / data.invoicesSinceLastMonth) * 100 : 0} className="h-1.5 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Wrapper>

        {/* VAT Registration */}
        <Wrapper {...motionProps(0.15)}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Shield className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-[10px]">{isAr ? "السجلات" : "Records"}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isAr ? "مسجل بالضريبة" : "VAT Registered"}</span>
                  {data?.vatRegistered ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isAr ? "الرقم الضريبي" : "VAT Number"}</span>
                  <span className="text-[10px] font-english text-foreground">{data?.vatNumber || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{isAr ? "السجل التجاري" : "CR Number"}</span>
                  <span className="text-[10px] font-english text-foreground">{data?.crNumber || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Wrapper>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overview">{isAr ? "سجل الإرسال" : "Submissions"}</TabsTrigger>
          <TabsTrigger value="certificates">{isAr ? "الشهادات" : "Certificates"}</TabsTrigger>
          <TabsTrigger value="onboarding">{isAr ? "إعداد ZATCA" : "ZATCA Setup"}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                {isAr ? "آخر عمليات الإرسال لـ ZATCA" : "Recent ZATCA Submissions"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentSubmissions.length === 0 ? (
                <div className="text-center py-8">
                  <FileCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">{isAr ? "لم تتم أي عمليات إرسال بعد" : "No submissions yet"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? "ستظهر هنا سجلات الفواتير المقدمة لهيئة الزكاة" : "ZATCA submission records will appear here"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.recentSubmissions.map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground font-english">{sub.invoice_id?.slice(0, 8)}...</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(sub.created_at).toLocaleDateString(isAr ? "ar-SA" : "en-SA")}
                          </p>
                        </div>
                      </div>
                      {statusBadge(sub.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates" className="mt-4">
          <ZatcaCertificateManagement />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <ZatcaOnboardingWizard />
        </TabsContent>
      </Tabs>

      {/* Compliance Checklist */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            {isAr ? "قائمة فحص الامتثال" : "Compliance Checklist"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklistItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/30 transition-colors">
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className={`text-xs ${item.done ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceHubDashboard;
