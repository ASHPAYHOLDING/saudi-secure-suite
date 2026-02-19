import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Save, Loader2, Bell, FileText, ShieldAlert, Receipt } from "lucide-react";

interface EmailPreferences {
  send_invoice_email: boolean;
  send_payment_receipt: boolean;
  send_security_alert: boolean;
  from_name: string;
  reply_to_email: string;
}

const DEFAULT_PREFS: EmailPreferences = {
  send_invoice_email: true,
  send_payment_receipt: true,
  send_security_alert: true,
  from_name: "",
  reply_to_email: "",
};

const EmailPreferencesPanel = () => {
  const { tenantId } = useAuth();
  const [prefs, setPrefs] = useState<EmailPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (tenantId) fetchPrefs();
  }, [tenantId]);

  // Realtime sync
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`email-prefs-${tenantId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tenant_settings",
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload: any) => {
        const ep = payload.new?.email_preferences;
        if (ep) {
          setPrefs({ ...DEFAULT_PREFS, ...ep });
          setDirty(false);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const fetchPrefs = async () => {
    const { data } = await (supabase
      .from("tenant_settings" as any)
      .select("email_preferences")
      .eq("tenant_id", tenantId!)
      .maybeSingle() as any);

    if (data?.email_preferences) {
      setPrefs({ ...DEFAULT_PREFS, ...data.email_preferences });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);

    const { error } = await (supabase
      .from("tenant_settings" as any)
      .upsert({
        tenant_id: tenantId,
        email_preferences: prefs,
      }, { onConflict: "tenant_id" }) as any);

    setSaving(false);
    if (error) {
      toast.error("فشل حفظ إعدادات البريد: " + error.message);
    } else {
      toast.success("تم حفظ إعدادات البريد الإلكتروني");
      setDirty(false);
    }
  };

  const updatePref = <K extends keyof EmailPreferences>(key: K, value: EmailPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggles: { key: keyof EmailPreferences; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      key: "send_invoice_email",
      label: "إرسال الفواتير بالبريد",
      desc: "إرسال بريد إلكتروني تلقائي عند إصدار فاتورة جديدة",
      icon: <FileText className="h-4 w-4 text-primary" />,
    },
    {
      key: "send_payment_receipt",
      label: "إيصالات الدفع",
      desc: "إرسال إيصال إلكتروني عند تسجيل دفعة من عميل",
      icon: <Receipt className="h-4 w-4 text-accent" />,
    },
    {
      key: "send_security_alert",
      label: "التنبيهات الأمنية",
      desc: "إرسال تنبيهات تسجيل الدخول والأنشطة المشبوهة",
      icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">جارٍ تحميل إعدادات البريد...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            إعدادات البريد الإلكتروني
          </div>
          {dirty && (
            <Badge className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-200">تغييرات غير محفوظة</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email Toggles */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3">
            <Bell className="h-3.5 w-3.5" />
            التحكم في الإشعارات
          </p>
          <div className="space-y-3">
            {toggles.map(({ key, label, desc, icon }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={prefs[key] as boolean}
                  onCheckedChange={(checked) => updatePref(key, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Sender Info */}
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            بيانات المرسل
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المرسل</Label>
              <Input
                value={prefs.from_name}
                onChange={(e) => updatePref("from_name", e.target.value)}
                placeholder="مثال: شركة النجاح للتقنية"
              />
              <p className="text-[10px] text-muted-foreground">يظهر كاسم المرسل في صندوق الوارد</p>
            </div>
            <div className="space-y-2">
              <Label>بريد الرد (Reply-To)</Label>
              <Input
                type="email"
                value={prefs.reply_to_email}
                onChange={(e) => updatePref("reply_to_email", e.target.value)}
                placeholder="billing@company.sa"
                dir="ltr"
              />
              <p className="text-[10px] text-muted-foreground">البريد الذي يصل إليه ردود العملاء</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving || !dirty} className="w-full sm:w-auto">
          {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          حفظ إعدادات البريد
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmailPreferencesPanel;
