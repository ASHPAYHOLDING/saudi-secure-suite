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
  ShieldCheck, FileCheck, AlertTriangle, CheckCircle2,
  XCircle, Clock, ArrowUpRight, RefreshCw, Settings, Eye, FileText,
  Award, TrendingUp, Shield
} from "lucide-react";
import ZatcaCertificateManagement from "./ZatcaCertificateManagement";
import ZatcaOnboardingWizard from "./ZatcaOnboardingWizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const ComplianceHubDashboard = () => {
  const { tenantId } = useAuth();
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

  // Compliance score
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
    switch (status) {
      case "success": case "reported": case "cleared":
        return <Badge className="bg-success/10 text-success border-success/30 text-[10px]">✅ ناجح</Badge>;
      case "error": case "rejected":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">❌ مرفوض</Badge>;
      default:
        return <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">⏳ معلق</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6" dir="rtl">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" />
            مركز الامتثال
          </h1>
          <p className="text-xs text-muted-foreground mt-1">حالة امتثال ZATCA والضريبة والتنظيمات السعودية</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </div>

      {/* Compliance Score + KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Score Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl ${scoreBg} flex items-center justify-center`}>
                  <Award className={`w-6 h-6 ${scoreColor}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold font-english ${scoreColor}`}>{score}%</p>
                  <p className="text-[10px] text-muted-foreground">نقاط الامتثال</p>
                </div>
              </div>
              <Progress value={score} className="h-2" />
              <p className="text-[10px] text-muted-foreground mt-2">
                {score >= 80 ? "ممتاز — مؤهل للفوترة الإلكترونية" :
                 score >= 50 ? "جيد — يحتاج تحسينات" : "ضعيف — إجراءات مطلوبة"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ZATCA Phase Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <FileCheck className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-[10px]">ZATCA</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">المرحلة الأولى</span>
                  {data?.zatcaPhase1 ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">المرحلة الثانية</span>
                  {data?.zatcaPhase2Ready ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Clock className="w-4 h-4 text-warning" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">الشهادات الفعالة</span>
                  <span className="text-xs font-english font-semibold text-foreground">{data?.activeCertificates || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Submissions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <TrendingUp className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-[10px]">آخر 30 يوم</Badge>
              </div>
              <p className="text-2xl font-bold font-english text-foreground">{data?.invoicesSinceLastMonth || 0}</p>
              <p className="text-[10px] text-muted-foreground">فواتير صادرة</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">مقدمة لـ ZATCA</span>
                    <span className="font-english text-success">{data?.invoicesWithZatca || 0}</span>
                  </div>
                  <Progress value={data && data.invoicesSinceLastMonth > 0 ? (data.invoicesWithZatca / data.invoicesSinceLastMonth) * 100 : 0} className="h-1.5 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* VAT Registration */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border/60 h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Shield className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-[10px]">السجلات</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">مسجل بالضريبة</span>
                  {data?.vatRegistered ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">الرقم الضريبي</span>
                  <span className="text-[10px] font-english text-foreground">{data?.vatNumber || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">السجل التجاري</span>
                  <span className="text-[10px] font-english text-foreground">{data?.crNumber || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="overview">سجل الإرسال</TabsTrigger>
          <TabsTrigger value="certificates">الشهادات</TabsTrigger>
          <TabsTrigger value="onboarding">إعداد ZATCA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                آخر عمليات الإرسال لـ ZATCA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentSubmissions.length === 0 ? (
                <div className="text-center py-8">
                  <FileCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">لم تتم أي عمليات إرسال بعد</p>
                  <p className="text-xs text-muted-foreground mt-1">ستظهر هنا سجلات الفواتير المقدمة لهيئة الزكاة</p>
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
                            {new Date(sub.created_at).toLocaleDateString("ar-SA")}
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
            قائمة فحص الامتثال
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: "التسجيل في ضريبة القيمة المضافة", done: data?.vatRegistered },
              { label: "إدخال الرقم الضريبي", done: !!data?.vatNumber },
              { label: "إدخال السجل التجاري", done: !!data?.crNumber },
              { label: "تفعيل ZATCA المرحلة الأولى (QR)", done: data?.zatcaPhase1 },
              { label: "تفعيل ZATCA المرحلة الثانية (XML + توقيع)", done: data?.zatcaPhase2Ready },
              { label: "شهادة ZATCA فعّالة", done: (data?.activeCertificates || 0) > 0 },
              { label: "إرسال فاتورة ناجحة واحدة على الأقل", done: (data?.successfulSubmissions || 0) > 0 },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/30 transition-colors">
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
