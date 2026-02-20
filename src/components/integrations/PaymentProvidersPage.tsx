import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Loader2, Plug, RefreshCw, Save, TestTube2, Copy, Eye, EyeOff, AlertTriangle, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderStatus = "disconnected" | "connected" | "tested" | "active" | "disabled";

interface ProviderRecord {
  status: ProviderStatus;
  last_tested_at: string | null;
  has_webhook_secret: boolean;
}

interface ProviderDef {
  key: "tap" | "moyasar" | "hyperpay" | "stripe" | "geidea";
  label: string;
  description: string;
  color: string;
  webhookFn?: string; // if has dedicated webhook function
  credentialFields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}

const PROVIDERS: ProviderDef[] = [
  {
    key: "tap",
    label: "Tap Payments",
    description: "بوابة الدفع الرائدة في منطقة الخليج – تدعم مدى، فيزا، ماستركارد، Apple Pay.",
    color: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
    credentialFields: [
      { key: "secret_key", label: "Secret Key", placeholder: "sk_live_...", secret: true },
      { key: "publishable_key", label: "Publishable Key", placeholder: "pk_live_..." },
    ],
  },
  {
    key: "moyasar",
    label: "Moyasar",
    description: "حل دفع سعودي محلي يدعم مدى، Apple Pay، وبطاقات الائتمان.",
    color: "from-green-500/10 to-green-600/5 border-green-500/20",
    credentialFields: [
      { key: "secret_key", label: "Secret Key (sk_...)", placeholder: "sk_test_...", secret: true },
      { key: "publishable_key", label: "Publishable Key (pk_...)", placeholder: "pk_test_..." },
    ],
  },
  {
    key: "hyperpay",
    label: "HyperPay",
    description: "بوابة دفع عالمية تعمل في السعودية والإمارات وألمانيا – تدعم مدى، فيزا، ماستركارد.",
    color: "from-purple-500/10 to-purple-600/5 border-purple-500/20",
    credentialFields: [
      { key: "access_token", label: "Access Token", placeholder: "OGE4...", secret: true },
      { key: "entity_id", label: "Entity ID", placeholder: "8a8294174b7ecb28014b9699220015ca" },
    ],
  },
  {
    key: "stripe",
    label: "Stripe",
    description: "بوابة الدفع العالمية الأشهر – تدعم أكثر من 135 عملة وطرق دفع متعددة.",
    color: "from-indigo-500/10 to-indigo-600/5 border-indigo-500/20",
    webhookFn: "stripe-webhook",
    credentialFields: [
      { key: "secret_key", label: "Secret Key (sk_...)", placeholder: "sk_live_...", secret: true },
      { key: "publishable_key", label: "Publishable Key (pk_...)", placeholder: "pk_live_..." },
    ],
  },
  {
    key: "geidea",
    label: "Geidea",
    description: "بوابة دفع سعودية رائدة – تدعم مدى، فيزا، ماستركارد، والدفع عبر الرابط.",
    color: "from-orange-500/10 to-orange-600/5 border-orange-500/20",
    webhookFn: "geidea-webhook",
    credentialFields: [
      { key: "merchant_public_key", label: "Merchant Public Key", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "api_password", label: "API Password", placeholder: "Password123!", secret: true },
    ],
  },
];

const STATUS_CONFIG: Record<ProviderStatus, { label: string; color: string; icon: any }> = {
  disconnected: { label: "غير متصل", color: "bg-muted text-muted-foreground", icon: Circle },
  connected: { label: "متصل", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Plug },
  tested: { label: "تم الاختبار ✓", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: TestTube2 },
  active: { label: "نشط ✓", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  disabled: { label: "معطل", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
};

const PaymentProvidersPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [providerRecords, setProviderRecords] = useState<Record<string, ProviderRecord>>({});
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});
  const [webhookSecrets, setWebhookSecrets] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Load tenant and provider statuses
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: member } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }
      setTenantId(member.tenant_id);

      const { data: records } = await supabase
        .from("tenant_payment_providers")
        .select("provider, status, last_tested_at, webhook_secret_encrypted")
        .eq("tenant_id", member.tenant_id);

      const map: Record<string, ProviderRecord> = {};
      for (const r of records || []) {
        map[r.provider] = {
          status: r.status as ProviderStatus,
          last_tested_at: r.last_tested_at,
          has_webhook_secret: !!r.webhook_secret_encrypted,
        };
      }
      setProviderRecords(map);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCredentialChange = useCallback((provider: string, field: string, value: string) => {
    setCredentials((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [field]: value },
    }));

    // Smart autosave after 800ms idle
    if (autosaveTimers.current[provider]) clearTimeout(autosaveTimers.current[provider]);
    autosaveTimers.current[provider] = setTimeout(() => {
      handleSave(provider);
    }, 800);
  }, []);

  const handleWebhookSecretChange = useCallback((provider: string, value: string) => {
    setWebhookSecrets((prev) => ({ ...prev, [provider]: value }));
    if (autosaveTimers.current[`ws_${provider}`]) clearTimeout(autosaveTimers.current[`ws_${provider}`]);
    autosaveTimers.current[`ws_${provider}`] = setTimeout(() => {
      handleSave(provider);
    }, 800);
  }, []);

  const handleSave = async (provider: string) => {
    const creds = credentials[provider];
    if (!creds || Object.keys(creds).length === 0) return;
    const hasValues = Object.values(creds).some((v) => v && v.trim());
    if (!hasValues) return;

    setSaving((p) => ({ ...p, [provider]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          provider,
          credentials: creds,
          webhookSecret: webhookSecrets[provider] || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setProviderRecords((p) => ({
        ...p,
        [provider]: {
          ...p[provider],
          status: "connected",
          has_webhook_secret: !!(webhookSecrets[provider]),
        },
      }));
      toast({ title: "تم الحفظ", description: `تم حفظ بيانات ${provider} بأمان ✓` });
    } catch (err: any) {
      toast({ title: "خطأ في الحفظ", description: err.message, variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleTest = async (provider: string) => {
    setTesting((p) => ({ ...p, [provider]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/provider-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();

      if (data.success) {
        setProviderRecords((p) => ({
          ...p,
          [provider]: { ...p[provider], status: "tested", last_tested_at: new Date().toISOString() },
        }));
        toast({ title: "نجاح الاختبار", description: data.message });
      } else {
        toast({ title: "فشل الاختبار", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setTesting((p) => ({ ...p, [provider]: false }));
    }
  };

  const getWebhookUrl = (providerKey: string) => {
    if (!tenantId) return "";
    const dedicatedFn = PROVIDERS.find((p) => p.key === providerKey)?.webhookFn;
    if (dedicatedFn) return `${supabaseUrl}/functions/v1/${dedicatedFn}?tenant_id=${tenantId}`;
    return `${supabaseUrl}/functions/v1/payment-webhook?provider=${providerKey}&tenant_id=${tenantId}`;
  };

  const copyWebhookUrl = (providerKey: string) => {
    const url = getWebhookUrl(providerKey);
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "تم النسخ", description: "تم نسخ Webhook URL" });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">بوابات الدفع</h1>
        <p className="text-muted-foreground mt-1">أضف مفاتيح بوابة الدفع الخاصة بك — تُخزَّن مشفرة بالكامل ولا يمكن قراءتها.</p>
      </div>

      <div className="grid gap-6">
        {PROVIDERS.map((provider) => {
          const record = providerRecords[provider.key];
          const status = record?.status || "disconnected";
          const StatusIcon = STATUS_CONFIG[status].icon;
          const isSaving = saving[provider.key];
          const isTesting = testing[provider.key];

          return (
            <Card key={provider.key} className={cn("border bg-gradient-to-br", provider.color)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {provider.label}
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </CardTitle>
                    <CardDescription className="mt-1">{provider.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className={cn("flex items-center gap-1.5 text-xs font-medium", STATUS_CONFIG[status].color)}>
                    <StatusIcon size={12} />
                    {STATUS_CONFIG[status].label}
                  </Badge>
                </div>
                {record?.last_tested_at && (
                  <p className="text-xs text-muted-foreground">
                    آخر اختبار: {new Date(record.last_tested_at).toLocaleString("ar-SA")}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Credential fields */}
                <div className="grid gap-3">
                  {provider.credentialFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs font-medium">{field.label}</Label>
                      <div className="relative">
                        <Input
                          type={field.secret && !showSecrets[`${provider.key}_${field.key}`] ? "password" : "text"}
                          placeholder={field.placeholder}
                          value={credentials[provider.key]?.[field.key] || ""}
                          onChange={(e) => handleCredentialChange(provider.key, field.key, e.target.value)}
                          className="bg-background/60 font-mono text-sm pe-10"
                          dir="ltr"
                        />
                        {field.secret && (
                          <button
                            type="button"
                            onClick={() => setShowSecrets((p) => ({
                              ...p,
                              [`${provider.key}_${field.key}`]: !p[`${provider.key}_${field.key}`],
                            }))}
                            className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                          >
                            {showSecrets[`${provider.key}_${field.key}`] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Webhook Secret */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Webhook Secret <span className="text-muted-foreground font-normal">(مطلوب للتحقق من الـ Webhooks)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showSecrets[`${provider.key}_ws`] ? "text" : "password"}
                      placeholder="السر المشترك من لوحة إعدادات المزود"
                      value={webhookSecrets[provider.key] || ""}
                      onChange={(e) => handleWebhookSecretChange(provider.key, e.target.value)}
                      className="bg-background/60 font-mono text-sm pe-10"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets((p) => ({ ...p, [`${provider.key}_ws`]: !p[`${provider.key}_ws`] }))}
                      className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[`${provider.key}_ws`] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {!record?.has_webhook_secret && status !== "disconnected" && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={11} /> لم يتم إعداد Webhook Secret — الـ Webhooks ستُرفض.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(provider.key)}
                    disabled={isSaving}
                    className="gap-2"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    حفظ
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTest(provider.key)}
                    disabled={isTesting || status === "disconnected"}
                    className="gap-2"
                  >
                    {isTesting ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
                    اختبار الاتصال
                  </Button>

                  {status !== "disconnected" && tenantId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyWebhookUrl(provider.key)}
                      className="gap-2 text-muted-foreground"
                    >
                      <Copy size={14} />
                      نسخ Webhook URL
                    </Button>
                  )}
                </div>

                {/* Webhook URL display */}
                {status !== "disconnected" && tenantId && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                    <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <LinkIcon size={11} />
                      Webhook URL الخاص بك (ضعه في لوحة إعدادات {provider.label})
                    </p>
                    <p className="text-xs font-mono text-foreground break-all" dir="ltr">
                      {getWebhookUrl(provider.key)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info box */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            🔒 <strong>أمان كامل:</strong> جميع المفاتيح والأسرار تُشفَّر باستخدام AES-256-GCM قبل التخزين.
            لا تُخزَّن أي مفاتيح بنص واضح في قاعدة البيانات أبداً.
            يتحقق النظام تلقائياً من توقيع كل Webhook ليمنع أي طلب مزوّر.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentProvidersPage;
