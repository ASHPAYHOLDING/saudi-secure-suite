import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Globe, Plus, Trash2, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

export const SsoSettingsPage = () => {
  const { user, tenantId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState({
    id: "",
    provider_type: "saml" as "saml" | "oidc",
    issuer: "",
    entry_point: "",
    cert: "",
    client_id: "",
    enabled: false,
  });

  const [domains, setDomains] = useState<Array<{ id: string; domain: string; is_verified: boolean; verified_at: string | null }>>([]);
  const [newDomain, setNewDomain] = useState("");

  useEffect(() => {
    if (tenantId) loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: ssoData } = await supabase
        .from("tenant_sso_settings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (ssoData) {
        setSettings({
          id: ssoData.id,
          provider_type: ssoData.provider_type as "saml" | "oidc",
          issuer: ssoData.issuer || "",
          entry_point: ssoData.entry_point || "",
          cert: ssoData.cert || "",
          client_id: ssoData.client_id || "",
          enabled: ssoData.enabled,
        });
      }

      const { data: domainData } = await supabase
        .from("sso_domains")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at");

      if (domainData) setDomains(domainData);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!tenantId || !user) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        provider_type: settings.provider_type,
        issuer: settings.issuer || null,
        entry_point: settings.entry_point || null,
        cert: settings.cert || null,
        client_id: settings.client_id || null,
        enabled: settings.enabled,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await supabase
          .from("tenant_sso_settings")
          .update(payload)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tenant_sso_settings")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setSettings((s) => ({ ...s, id: data.id }));
      }

      toast({ title: "تم الحفظ", description: "تم حفظ إعدادات SSO بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addDomain = async () => {
    if (!newDomain.trim() || !tenantId) return;
    try {
      const { data, error } = await supabase
        .from("sso_domains")
        .insert({ tenant_id: tenantId, domain: newDomain.toLowerCase().trim() })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          toast({ title: "خطأ", description: "هذا النطاق مسجل بالفعل لمنشأة أخرى", variant: "destructive" });
        } else throw error;
        return;
      }
      setDomains((d) => [...d, data]);
      setNewDomain("");
      toast({ title: "تمت الإضافة", description: `تمت إضافة النطاق ${newDomain}` });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  const removeDomain = async (id: string) => {
    try {
      const { error } = await supabase.from("sso_domains").delete().eq("id", id);
      if (error) throw error;
      setDomains((d) => d.filter((x) => x.id !== id));
      toast({ title: "تم الحذف" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="text-accent" size={24} />
          تسجيل الدخول المؤسسي (SSO)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          اربط مزود الهوية الخاص بمنشأتك (SAML / OIDC) لتمكين تسجيل الدخول المؤسسي للموظفين.
        </p>
      </div>

      {/* Provider Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck size={18} />
            إعدادات المزود
          </CardTitle>
          <CardDescription>اختر نوع المزود وأدخل بيانات الاتصال</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>نوع المزود</Label>
              <Select
                value={settings.provider_type}
                onValueChange={(v) => setSettings((s) => ({ ...s, provider_type: v as "saml" | "oidc" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saml">SAML 2.0</SelectItem>
                  <SelectItem value="oidc">OpenID Connect (OIDC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <div className="flex items-center gap-3 pt-2">
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
                />
                <span className="text-sm">{settings.enabled ? "مفعّل" : "معطّل"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Issuer / Entity ID</Label>
            <Input
              value={settings.issuer}
              onChange={(e) => setSettings((s) => ({ ...s, issuer: e.target.value }))}
              placeholder="https://idp.company.com"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{settings.provider_type === "saml" ? "SSO Login URL (Entry Point)" : "Authorization Endpoint"}</Label>
            <Input
              value={settings.entry_point}
              onChange={(e) => setSettings((s) => ({ ...s, entry_point: e.target.value }))}
              placeholder="https://idp.company.com/sso/saml"
              dir="ltr"
            />
          </div>

          {settings.provider_type === "saml" && (
            <div className="space-y-1.5">
              <Label>X.509 Certificate</Label>
              <textarea
                value={settings.cert}
                onChange={(e) => setSettings((s) => ({ ...s, cert: e.target.value }))}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                dir="ltr"
              />
            </div>
          )}

          {settings.provider_type === "oidc" && (
            <div className="space-y-1.5">
              <Label>Client ID</Label>
              <Input
                value={settings.client_id}
                onChange={(e) => setSettings((s) => ({ ...s, client_id: e.target.value }))}
                placeholder="your-client-id"
                dir="ltr"
              />
            </div>
          )}

          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>

      {/* Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe size={18} />
            نطاقات البريد المؤسسي
          </CardTitle>
          <CardDescription>
            أضف نطاقات البريد الإلكتروني التابعة لمنشأتك. سيتم توجيه أي مستخدم ببريد ينتمي لهذه النطاقات إلى SSO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="company.com"
              dir="ltr"
              className="flex-1"
            />
            <Button variant="outline" onClick={addDomain} className="gap-1">
              <Plus size={16} />
              إضافة
            </Button>
          </div>

          {domains.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <AlertTriangle size={24} className="mx-auto mb-2 opacity-50" />
              لم تتم إضافة أي نطاق بعد
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Globe size={16} className="text-muted-foreground" />
                    <span className="font-mono text-sm" dir="ltr">{d.domain}</span>
                    <Badge variant={d.is_verified ? "default" : "secondary"} className="text-[10px]">
                      {d.is_verified ? "مُتحقق" : "بانتظار التحقق"}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeDomain(d.id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/60">
            ⚠️ يجب التحقق من ملكية النطاق قبل تفعيل SSO. يتم العزل الكامل بحيث لا يمكن لمنشأة استخدام نطاق مسجل لمنشأة أخرى.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
