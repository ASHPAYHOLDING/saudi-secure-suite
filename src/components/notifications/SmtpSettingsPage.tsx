import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Loader2, CheckCircle2, XCircle, Send, Trash2, Shield, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface SmtpProvider {
  id: string;
  from_name_ar: string | null;
  from_name_en: string | null;
  from_email: string;
  reply_to: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  is_active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_error: string | null;
}

const SmtpSettingsPage = () => {
  const { tenantId } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [provider, setProvider] = useState<SmtpProvider | null>(null);

  const [form, setForm] = useState({
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: true,
    smtp_username: "",
    smtp_password: "",
    from_name_ar: "",
    from_name_en: "",
    from_email: "",
    reply_to: "",
  });

  useEffect(() => {
    if (!tenantId) return;
    loadProvider();
  }, [tenantId]);

  const loadProvider = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("smtp-settings", {
        body: { action: "get", tenant_id: tenantId },
      });
      if (data?.provider) {
        setProvider(data.provider);
        setForm({
          smtp_host: data.provider.smtp_host || "",
          smtp_port: data.provider.smtp_port || 587,
          smtp_secure: data.provider.smtp_secure ?? true,
          smtp_username: data.provider.smtp_username || "",
          smtp_password: "",
          from_name_ar: data.provider.from_name_ar || "",
          from_name_en: data.provider.from_name_en || "",
          from_email: data.provider.from_email || "",
          reply_to: data.provider.reply_to || "",
        });
      }
    } catch {
      // No provider configured
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-settings", {
        body: { action: "upsert", tenant_id: tenantId, ...form },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: isAr ? "تم حفظ إعدادات SMTP" : "SMTP settings saved" });
      await loadProvider();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!tenantId) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-settings", {
        body: { action: "test", tenant_id: tenantId },
      });
      if (error || data?.error) {
        toast({
          title: isAr ? "فشل الاختبار" : "Test failed",
          description: data?.error || error?.message,
          variant: "destructive",
        });
      } else {
        toast({ title: isAr ? "تم الاتصال بنجاح" : "Connection successful" });
      }
      await loadProvider();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setTesting(false);
  };

  const handleDelete = async () => {
    if (!tenantId) return;
    setDeleting(true);
    try {
      await supabase.functions.invoke("smtp-settings", {
        body: { action: "delete", tenant_id: tenantId },
      });
      setProvider(null);
      setForm({
        smtp_host: "", smtp_port: 587, smtp_secure: true,
        smtp_username: "", smtp_password: "",
        from_name_ar: "", from_name_en: "",
        from_email: "", reply_to: "",
      });
      toast({ title: isAr ? "تم حذف إعدادات SMTP" : "SMTP settings removed" });
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Mail size={22} />
          {isAr ? "إعدادات البريد الإلكتروني (SMTP)" : "Email Settings (SMTP)"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "فعّل SMTP خاص بمنشأتك لإرسال الإشعارات والرسائل باسم شركتك."
            : "Configure your own SMTP to send notifications and emails under your brand."}
        </p>
      </div>

      {/* DNS Warning */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-medium">{isAr ? "تأكد من إعدادات DNS" : "DNS Configuration Required"}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {isAr
                  ? "لضمان وصول الرسائل، تأكد من إعداد سجلات SPF و DKIM و DMARC بشكل صحيح لنطاق بريدك."
                  : "Ensure SPF, DKIM, and DMARC records are properly configured for your email domain."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      {provider && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{isAr ? "حالة الاتصال" : "Connection Status"}</p>
                  <p className="text-xs text-muted-foreground">{provider.smtp_host}:{provider.smtp_port}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {provider.last_test_status === "success" ? (
                  <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                    <CheckCircle2 size={12} className="me-1" />
                    {isAr ? "متصل" : "Connected"}
                  </Badge>
                ) : provider.last_test_status === "failed" ? (
                  <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                    <XCircle size={12} className="me-1" />
                    {isAr ? "فشل" : "Failed"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {isAr ? "لم يُختبر" : "Untested"}
                  </Badge>
                )}
              </div>
            </div>
            {provider.last_error && (
              <p className="text-xs text-destructive mt-2 bg-destructive/5 rounded p-2">
                {provider.last_error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAr ? "إعدادات الخادم" : "Server Configuration"}
          </CardTitle>
          <CardDescription>
            {isAr ? "أدخل بيانات خادم SMTP الخاص بمنشأتك" : "Enter your SMTP server details"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isAr ? "خادم SMTP" : "SMTP Host"}</Label>
              <Input
                placeholder="smtp.example.com"
                value={form.smtp_host}
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "المنفذ" : "Port"}</Label>
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isAr ? "اسم المستخدم" : "Username"}</Label>
              <Input
                placeholder="user@example.com"
                value={form.smtp_username}
                onChange={(e) => setForm({ ...form, smtp_username: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "كلمة المرور" : "Password"}</Label>
              <Input
                type="password"
                placeholder={provider ? "••••••••" : ""}
                value={form.smtp_password}
                onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 py-2">
            <Switch
              checked={form.smtp_secure}
              onCheckedChange={(v) => setForm({ ...form, smtp_secure: v })}
            />
            <Label className="text-sm">{isAr ? "اتصال آمن (TLS/SSL)" : "Secure connection (TLS/SSL)"}</Label>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isAr ? "اسم المرسل (عربي)" : "Sender Name (Arabic)"}</Label>
              <Input
                value={form.from_name_ar}
                onChange={(e) => setForm({ ...form, from_name_ar: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "اسم المرسل (إنجليزي)" : "Sender Name (English)"}</Label>
              <Input
                value={form.from_name_en}
                onChange={(e) => setForm({ ...form, from_name_en: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{isAr ? "بريد المرسل" : "From Email"}</Label>
              <Input
                type="email"
                placeholder="info@company.com"
                value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "بريد الرد" : "Reply-To"}</Label>
              <Input
                type="email"
                placeholder="support@company.com"
                value={form.reply_to}
                onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {isAr ? "حفظ الإعدادات" : "Save Settings"}
            </Button>
            {provider && (
              <>
                <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-1.5">
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {isAr ? "اختبار الاتصال" : "Test Connection"}
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {isAr ? "حذف" : "Delete"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SmtpSettingsPage;
