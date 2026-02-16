import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const notificationTypes = [
  { key: "invoice_due", label: "تذكير فاتورة مستحقة", description: "تنبيه قبل موعد استحقاق الفاتورة", hasDays: true },
  { key: "invoice_overdue", label: "فاتورة متأخرة", description: "تنبيه عند تأخر سداد فاتورة", hasDays: false },
  { key: "low_stock", label: "نقص المخزون", description: "تنبيه عند وصول المنتج لحد المخزون المنخفض", hasDays: false },
  { key: "subscription_expiry", label: "انتهاء الاشتراك", description: "تذكير قبل انتهاء فترة الاشتراك", hasDays: true },
  { key: "compliance_warning", label: "تحذيرات الامتثال", description: "تنبيهات ضريبة القيمة المضافة و ZATCA", hasDays: false },
];

interface Pref { notification_type: string; is_enabled: boolean; days_before: number | null; }

const NotificationPreferences = () => {
  const { tenantId, user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await (supabase as any).from("notification_preferences").select("*").eq("tenant_id", tenantId);
      const map: Record<string, Pref> = {};
      notificationTypes.forEach((t) => {
        const existing = data?.find((d: any) => d.notification_type === t.key);
        map[t.key] = existing || { notification_type: t.key, is_enabled: true, days_before: t.hasDays ? 3 : null };
      });
      setPrefs(map);
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const toggle = (key: string) => {
    setPrefs((prev) => ({ ...prev, [key]: { ...prev[key], is_enabled: !prev[key].is_enabled } }));
  };

  const setDays = (key: string, days: number) => {
    setPrefs((prev) => ({ ...prev, [key]: { ...prev[key], days_before: days } }));
  };

  const save = async () => {
    if (!tenantId || !user) return;
    setSaving(true);
    for (const [key, pref] of Object.entries(prefs)) {
      await (supabase as any).from("notification_preferences").upsert(
        { tenant_id: tenantId, notification_type: key, is_enabled: pref.is_enabled, days_before: pref.days_before, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,notification_type" }
      );
    }
    toast({ title: "تم حفظ تفضيلات الإشعارات" });
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell size={20} /> إعدادات الإشعارات
        </CardTitle>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          حفظ
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {notificationTypes.map((t) => {
          const pref = prefs[t.key];
          if (!pref) return null;
          return (
            <div key={t.key} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                {t.hasDays && pref.is_enabled && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">تنبيه قبل</span>
                    <Input type="number" min={1} max={30} value={pref.days_before || 3} onChange={(e) => setDays(t.key, parseInt(e.target.value) || 3)} className="w-16 h-7 text-xs text-center" />
                    <span className="text-xs text-muted-foreground">يوم</span>
                  </div>
                )}
              </div>
              <Switch checked={pref.is_enabled} onCheckedChange={() => toggle(t.key)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferences;
