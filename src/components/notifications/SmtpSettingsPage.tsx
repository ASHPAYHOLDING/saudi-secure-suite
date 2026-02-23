import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail, Loader2, CheckCircle2, XCircle, Send, Trash2, Shield,
  AlertTriangle, Copy, Info, KeyRound, Globe, Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const { tenantId, userRole } = useAuth();
  const { toast } = useToast();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [provider, setProvider] = useState<SmtpProvider | null>(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

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
        setShowPasswordField(false);
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
      // No provider
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const payload: any = { action: "upsert", tenant_id: tenantId, ...form };
      // Don't send empty password on update (keeps existing)
      if (provider && !form.smtp_password) {
        delete payload.smtp_password;
      }
      const { data, error } = await supabase.functions.invoke("smtp-settings", { body: payload });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: isAr ? "تم حفظ إعدادات SMTP" : "SMTP settings saved" });
      await loadProvider();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleToggle = async (active: boolean) => {
    if (!tenantId) return;
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-settings", {
        body: { action: "toggle", tenant_id: tenantId, is_active: active },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: isAr ? (active ? "تم التفعيل" : "تم الإيقاف") : (active ? "Enabled" : "Disabled") });
      await loadProvider();
    } catch (err: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    }
    setToggling(false);
  };

  const handleTest = async () => {
    if (!tenantId || !testRecipient) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-settings", {
        body: { action: "test", tenant_id: tenantId, recipient_email: testRecipient },
      });
      if (error || data?.error) {
        toast({
          title: isAr ? "فشل الاختبار" : "Test failed",
          description: data?.error || error?.message,
          variant: "destructive",
        });
      } else {
        toast({ title: isAr ? "تم إرسال بريد الاختبار بنجاح" : "Test email sent successfully" });
        setTestDialogOpen(false);
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
      setShowPasswordField(false);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: isAr ? "تم النسخ" : "Copied" });
  };

  const getStatusInfo = () => {
    if (!provider) return { label: isAr ? "غير مهيأ" : "Inactive", variant: "secondary" as const, icon: null };
    if (!provider.is_active) return { label: isAr ? "معطّل" : "Inactive", variant: "secondary" as const, icon: null };
    if (provider.last_test_status === "success") return { label: isAr ? "نشط" : "Active", variant: "outline" as const, icon: <CheckCircle2 size={12} className="me-1 text-green-600" /> };
    if (provider.last_test_status === "failed") return { label: isAr ? "خطأ في الإعداد" : "Misconfigured", variant: "destructive" as const, icon: <XCircle size={12} className="me-1" /> };
    return { label: isAr ? "لم يُختبر" : "Untested", variant: "secondary" as const, icon: null };
  };

  // Owner guard
  if (userRole !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground text-sm max-w-md">
          {isAr ? "هذه الصفحة متاحة لمالك المنشأة فقط." : "This page is available to the tenant owner only."}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  const status = getStatusInfo();
  const domain = form.from_email.includes("@") ? form.from_email.split("@")[1] : "yourdomain.com";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
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
        <Badge variant={status.variant} className="shrink-0 h-7">
          {status.icon}
          {status.label}
        </Badge>
      </div>

      {/* Toggle Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {isAr ? "تفعيل SMTP الخاص بالمنشأة" : "Enable Custom SMTP"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "عند الإيقاف، لن يتم إرسال رسائل بريدية من المنشأة."
                    : "When disabled, no emails will be sent from your organization."}
                </p>
              </div>
            </div>
            <Switch
              checked={provider?.is_active ?? false}
              disabled={!provider || toggling}
              onCheckedChange={handleToggle}
            />
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
              {provider.last_test_at && (
                <p className="text-xs text-muted-foreground">
                  {isAr ? "آخر اختبار: " : "Last test: "}
                  {new Date(provider.last_test_at).toLocaleDateString(isAr ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            {provider.last_error && provider.last_test_status === "failed" && (
              <p className="text-xs text-destructive mt-2 bg-destructive/5 rounded p-2">
                {isAr ? "خطأ في الاتصال — تحقق من بيانات الخادم وكلمة المرور." : "Connection error — verify your server details and credentials."}
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
          {/* SMTP Host & Port */}
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

          {/* Username & Password */}
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
              {provider && !showPasswordField ? (
                <Button
                  variant="outline"
                  className="w-full gap-1.5 justify-start text-muted-foreground"
                  onClick={() => setShowPasswordField(true)}
                >
                  <KeyRound size={14} />
                  {isAr ? "تحديث كلمة المرور" : "Update Password"}
                </Button>
              ) : (
                <Input
                  type="password"
                  placeholder={provider ? (isAr ? "كلمة مرور جديدة" : "New password") : ""}
                  value={form.smtp_password}
                  onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                  dir="ltr"
                />
              )}
            </div>
          </div>

          {/* TLS Toggle */}
          <div className="flex items-center gap-3 py-2">
            <Switch
              checked={form.smtp_secure}
              onCheckedChange={(v) => setForm({ ...form, smtp_secure: v })}
            />
            <Label className="text-sm">{isAr ? "اتصال آمن (TLS/SSL)" : "Secure connection (TLS/SSL)"}</Label>
          </div>

          <Separator />

          {/* From Names */}
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

          {/* From Email & Reply-To */}
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
              <Label>
                {isAr ? "بريد الرد" : "Reply-To"}
                <span className="text-muted-foreground text-xs ms-1">({isAr ? "اختياري" : "optional"})</span>
              </Label>
              <Input
                type="email"
                placeholder="support@company.com"
                value={form.reply_to}
                onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                dir="ltr"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {isAr ? "حفظ الإعدادات" : "Save Settings"}
            </Button>
            {provider && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setTestRecipient(""); setTestDialogOpen(true); }}
                  disabled={testing || !provider.is_active}
                  className="gap-1.5"
                >
                  <Send size={14} />
                  {isAr ? "اختبار إرسال" : "Send Test"}
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

      {/* DNS Guidance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe size={18} />
            {isAr ? "إعدادات DNS المقترحة" : "Recommended DNS Settings"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "لضمان وصول الرسائل وعدم تصنيفها كبريد مزعج، أضف السجلات التالية لنطاقك."
              : "To ensure email deliverability and avoid spam filters, add these DNS records for your domain."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* SPF */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">SPF</Badge>
              <span className="text-sm font-medium">{isAr ? "سجل التحقق من المرسل" : "Sender Policy Framework"}</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <code className="text-xs flex-1 break-all font-mono" dir="ltr">
                v=spf1 include:_spf.{domain} ~all
              </code>
              <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={() => copyToClipboard(`v=spf1 include:_spf.${domain} ~all`)}>
                <Copy size={13} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "أضف هذا السجل كـ TXT record في إعدادات DNS الخاصة بنطاقك. عدّل include حسب مزود SMTP الخاص بك."
                : "Add this as a TXT record in your domain DNS. Adjust the include based on your SMTP provider."}
            </p>
          </div>

          <Separator />

          {/* DKIM */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">DKIM</Badge>
              <span className="text-sm font-medium">{isAr ? "توقيع البريد الرقمي" : "DomainKeys Identified Mail"}</span>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 flex gap-2">
              <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "يتم توليد مفتاح DKIM من مزود خدمة SMTP (مثل: Google Workspace, Microsoft 365, Mailgun). راجع لوحة تحكم المزود للحصول على سجل DKIM وأضفه كـ TXT record باسم: default._domainkey"
                  : "DKIM keys are generated by your SMTP provider (e.g., Google Workspace, Microsoft 365, Mailgun). Check your provider's admin panel for the DKIM record and add it as a TXT record with name: default._domainkey"}
              </p>
            </div>
          </div>

          <Separator />

          {/* DMARC */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">DMARC</Badge>
              <span className="text-sm font-medium">{isAr ? "سياسة حماية النطاق" : "Domain-based Message Authentication"}</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
              <code className="text-xs flex-1 break-all font-mono" dir="ltr">
                v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}; pct=100
              </code>
              <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7" onClick={() => copyToClipboard(`v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; pct=100`)}>
                <Copy size={13} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "أضف هذا السجل كـ TXT record باسم _dmarc في إعدادات DNS. يمكنك تغيير p=quarantine إلى p=reject بعد التأكد من الإعدادات."
                : "Add this as a TXT record with name _dmarc in your DNS. You can change p=quarantine to p=reject after verifying your setup."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Email Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "اختبار إرسال بريد" : "Send Test Email"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? "أدخل عنوان البريد الإلكتروني للمستلم لإرسال رسالة اختبار. (حد أقصى 3 اختبارات كل 10 دقائق)"
                : "Enter the recipient email address to send a test message. (Max 3 tests per 10 minutes)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{isAr ? "بريد المستلم" : "Recipient Email"}</Label>
            <Input
              type="email"
              placeholder="test@example.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleTest} disabled={testing || !testRecipient} className="gap-1.5">
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isAr ? "إرسال" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SmtpSettingsPage;
