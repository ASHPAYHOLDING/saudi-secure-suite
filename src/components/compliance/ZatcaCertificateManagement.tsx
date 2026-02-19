import { useState, useEffect } from "react";
import { Shield, Key, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CertificateInfo {
  id: string;
  certificate_type: string;
  environment: string;
  csid: string;
  is_active: boolean;
  is_key_encrypted: boolean;
  private_key_kid: string | null;
  issued_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface TestResult {
  type: string;
  environment: string;
  hasEncryptedKey: boolean;
  keyVersion: string | null;
  status: string;
}

const ZatcaCertificateManagement = () => {
  const { tenantId } = useAuth();
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);

  useEffect(() => {
    if (tenantId) loadCertificates();
  }, [tenantId]);

  const loadCertificates = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("zatca_certificates_safe")
      .select("*")
      .eq("tenant_id", tenantId);
    if (data) setCertificates(data);
    setLoading(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("zatca-phase2", {
        body: { action: "test-connection", tenantId },
      });
      if (error) throw error;
      setTestResults(data.certificates || []);
      toast.success(`تم فحص ${data.totalCerts} شهادة`);
    } catch (err: any) {
      toast.error("فشل اختبار الاتصال: " + (err.message || "خطأ غير معروف"));
    }
    setTesting(false);
  };

  const getStatusBadge = (cert: CertificateInfo) => {
    if (!cert.is_active) return <Badge variant="secondary">غير فعّال</Badge>;
    if (cert.expires_at && new Date(cert.expires_at) < new Date()) {
      return <Badge variant="destructive">منتهي الصلاحية</Badge>;
    }
    if (cert.is_key_encrypted) {
      return <Badge className="bg-accent/10 text-accent border-accent/20">فعّال ومشفّر</Badge>;
    }
    return <Badge className="bg-warning/10 text-warning border-warning/20">فعّال — مفتاح غير مشفّر</Badge>;
  };

  const getKeyStatus = (cert: CertificateInfo) => {
    if (cert.is_key_encrypted) {
      return (
        <div className="flex items-center gap-1 text-accent text-xs">
          <Shield size={12} />
          <span>مشفّر (v{cert.private_key_kid || "1"})</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-warning text-xs">
        <AlertTriangle size={12} />
        <span>غير مشفّر</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">إدارة شهادات ZATCA</h2>
            <p className="text-xs text-muted-foreground">عرض وإدارة شهادات الفوترة الإلكترونية</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCertificates} className="gap-2">
            <RefreshCw size={14} />
            تحديث
          </Button>
          <Button size="sm" onClick={handleTestConnection} disabled={testing} className="gap-2">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            اختبار الاتصال
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">{certificates.length}</div>
            <p className="text-xs text-muted-foreground">إجمالي الشهادات</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-accent">
              {certificates.filter(c => c.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">فعّالة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-accent">
              {certificates.filter(c => c.is_key_encrypted).length}
            </div>
            <p className="text-xs text-muted-foreground">مفاتيح مشفّرة</p>
          </CardContent>
        </Card>
      </div>

      {/* Certificates List */}
      {certificates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد شهادات مسجلة</p>
            <p className="text-xs text-muted-foreground">اذهب إلى إعداد ZATCA Phase 2 لإضافة شهادات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {certificates.map(cert => (
            <Card key={cert.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-accent" />
                      <span className="font-bold text-sm text-foreground">
                        {cert.certificate_type === "compliance" ? "شهادة الامتثال" : "شهادة الإنتاج"}
                      </span>
                      {getStatusBadge(cert)}
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <div>البيئة: <span className="font-medium text-foreground">{cert.environment}</span></div>
                      <div>CSID: <span className="font-mono" dir="ltr">{cert.csid.substring(0, 24)}...</span></div>
                      <div>تاريخ الإنشاء: {new Date(cert.created_at).toLocaleDateString("ar-SA")}</div>
                      {cert.expires_at && (
                        <div>تاريخ الانتهاء: {new Date(cert.expires_at).toLocaleDateString("ar-SA")}</div>
                      )}
                    </div>
                    {getKeyStatus(cert)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi size={16} className="text-accent" />
              نتائج اختبار الاتصال
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <div className="flex items-center gap-2 text-warning text-sm">
                <WifiOff size={16} />
                <span>لا توجد شهادات فعّالة للاختبار</span>
              </div>
            ) : (
              <div className="space-y-2">
                {testResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      {r.status === "secure" ? (
                        <CheckCircle2 size={14} className="text-accent" />
                      ) : (
                        <AlertTriangle size={14} className="text-warning" />
                      )}
                      <span className="font-medium">
                        {r.type === "compliance" ? "شهادة الامتثال" : "شهادة الإنتاج"}
                      </span>
                      <span className="text-muted-foreground">({r.environment})</span>
                    </div>
                    <Badge variant={r.status === "secure" ? "default" : "secondary"}>
                      {r.status === "secure" ? "آمن" : "مفتاح مفقود"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ZatcaCertificateManagement;
