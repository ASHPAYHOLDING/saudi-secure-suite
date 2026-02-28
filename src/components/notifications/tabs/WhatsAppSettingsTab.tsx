import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Phone, AlertTriangle, Loader2, Send, CheckCircle2, XCircle,
  Shield, ArrowLeft, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";

interface WaAccount {
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  business_name: string;
  status: string;
  last_error: string | null;
}

const WhatsAppSettingsTab = () => {
  const { tenantId, userRole } = useAuth();
  const { toast } = useToast();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const { entitlementsMap } = useEntitlementsContext();
  const whatsappAllowed = entitlementsMap?.paid_integrations?.allowed ?? false;

  const [loading, setLoading] = useState(true);
  const [waAccount, setWaAccount] = useState<WaAccount | null>(null);
  const [setupStep, setSetupStep] = useState(0);
  const [setupForm, setSetupForm] = useState({ waba_id: "", phone_number_id: "", access_token: "" });
  const [verifying, setVerifying] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("tenant_whatsapp_accounts")
      .select("waba_id, phone_number_id, display_phone_number, business_name, status, last_error")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    setWaAccount(data as WaAccount | null);
    if (data?.status === "active") setSetupStep(2);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleVerify = async () => {
    if (!tenantId) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-whatsapp-connection", {
        body: { tenant_id: tenantId, ...setupForm },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: isAr ? "تم التحقق بنجاح" : "Verification successful" });
        setSetupStep(2);
      } else {
        toast({ title: isAr ? "فشل التحقق" : "Verification failed", description: data?.error, variant: "destructive" });
      }
      loadData();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setVerifying(false);
  };

  const handleTestSend = async () => {
    if (!tenantId || !testPhone) return;
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-template", {
        body: { tenant_id: tenantId, to_phone: testPhone, template_name: "hello_world", language_code: "ar", template_key: "test_send" },
      });
      if (error) throw error;
      toast({ title: data?.success ? (isAr ? "تم الإرسال" : "Sent") : (isAr ? "فشل" : "Failed"), description: data?.error, variant: data?.success ? "default" : "destructive" });
      loadData();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setTestSending(false);
  };

  if (userRole !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{isAr ? "هذه الصفحة متاحة لمالك المنشأة فقط." : "Owner only."}</p>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!whatsappAllowed) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="py-8 text-center space-y-3">
          <AlertTriangle size={40} className="mx-auto text-warning" />
          <h3 className="font-semibold">{isAr ? "ترقية الباقة مطلوبة" : "Plan Upgrade Required"}</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {isAr ? "قناة واتساب متاحة في باقة الأعمال والمؤسسات فقط." : "WhatsApp is available in Business and Enterprise plans."}
          </p>
          <Button onClick={() => window.location.href = "/dashboard/subscription"}>
            {isAr ? "ترقية الباقة" : "Upgrade Plan"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Status */}
      {waAccount && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Phone size={18} className={waAccount.status === "active" ? "text-green-600" : "text-destructive"} />
                <div>
                  <p className="text-sm font-medium">{waAccount.business_name || waAccount.display_phone_number}</p>
                  <p className="text-xs text-muted-foreground">{waAccount.display_phone_number}</p>
                </div>
              </div>
              <Badge variant={waAccount.status === "active" ? "outline" : "destructive"}>
                {waAccount.status === "active" ? (isAr ? "متصل" : "Connected") : (isAr ? "خطأ" : "Error")}
              </Badge>
            </div>
            {waAccount.last_error && <p className="text-xs text-destructive mt-2 bg-destructive/5 p-2 rounded">{waAccount.last_error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Setup stepper */}
      <div className="flex items-center gap-2 py-2 flex-wrap">
        {[isAr ? "١. بيانات الاتصال" : "1. Credentials", isAr ? "٢. التحقق" : "2. Verify", isAr ? "٣. اختبار" : "3. Test"].map((label, i) => (
          <button key={i} onClick={() => setSetupStep(i)} className={`text-xs px-3 py-1.5 rounded-full transition-colors min-h-[32px] ${setupStep === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {label}
          </button>
        ))}
      </div>

      {setupStep === 0 && (
        <Card><CardContent className="py-4 space-y-3">
          <div><Label>{isAr ? "WABA ID" : "WABA ID"}</Label><Input value={setupForm.waba_id} onChange={(e) => setSetupForm((p) => ({ ...p, waba_id: e.target.value }))} /></div>
          <div><Label>{isAr ? "Phone Number ID" : "Phone Number ID"}</Label><Input value={setupForm.phone_number_id} onChange={(e) => setSetupForm((p) => ({ ...p, phone_number_id: e.target.value }))} /></div>
          <div><Label>{isAr ? "Access Token" : "Access Token"}</Label><Input type="password" value={setupForm.access_token} onChange={(e) => setSetupForm((p) => ({ ...p, access_token: e.target.value }))} /></div>
          <Button onClick={() => setSetupStep(1)} disabled={!setupForm.waba_id || !setupForm.phone_number_id || !setupForm.access_token}>
            {isAr ? "التالي" : "Next"} {isAr ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
          </Button>
        </CardContent></Card>
      )}

      {setupStep === 1 && (
        <Card><CardContent className="py-6 text-center space-y-3">
          <MessageSquare size={32} className="mx-auto text-green-600" />
          <p className="text-sm">{isAr ? "سنتحقق من صحة بيانات الاتصال الآن." : "We'll verify your connection now."}</p>
          <Button onClick={handleVerify} disabled={verifying} className="gap-2">
            {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {isAr ? "تحقق الآن" : "Verify Now"}
          </Button>
        </CardContent></Card>
      )}

      {setupStep === 2 && (
        <Card><CardContent className="py-4 space-y-3">
          <Label>{isAr ? "رقم الهاتف للاختبار (بالصيغة الدولية)" : "Test Phone (international format)"}</Label>
          <Input placeholder="+966XXXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          <Button onClick={handleTestSend} disabled={testSending || !testPhone} className="gap-2">
            {testSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {isAr ? "إرسال اختبار" : "Send Test"}
          </Button>
        </CardContent></Card>
      )}
    </div>
  );
};

export default WhatsAppSettingsTab;
