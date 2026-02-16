import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Plug, ShoppingCart, Store, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Settings2, History } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Integration {
  id: string;
  tenant_id: string;
  integration_type: string;
  display_name: string;
  is_enabled: boolean;
  config: Record<string, any>;
  sync_sales: boolean;
  sync_inventory: boolean;
  last_sync_at: string | null;
  last_sync_status: string;
  created_at: string;
  updated_at: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_synced: number;
  records_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

const AVAILABLE_INTEGRATIONS = [
  {
    type: "pos_foodics",
    name: "Foodics",
    nameAr: "فوديكس",
    description: "ربط مع نظام نقاط البيع فوديكس لمزامنة المبيعات والمخزون",
    icon: Store,
    category: "pos",
    fields: [
      { key: "api_key", label: "مفتاح API", type: "password" },
      { key: "business_id", label: "معرف المنشأة", type: "text" },
    ],
  },
  {
    type: "ecommerce_shopify",
    name: "Shopify",
    nameAr: "شوبيفاي",
    description: "ربط مع متجر شوبيفاي لمزامنة الطلبات والمخزون",
    icon: ShoppingCart,
    category: "ecommerce",
    fields: [
      { key: "store_url", label: "رابط المتجر", type: "text", placeholder: "your-store.myshopify.com" },
      { key: "api_key", label: "مفتاح API", type: "password" },
      { key: "api_secret", label: "سر API", type: "password" },
    ],
  },
  {
    type: "ecommerce_woocommerce",
    name: "WooCommerce",
    nameAr: "ووكوميرس",
    description: "ربط مع متجر ووكوميرس لمزامنة الطلبات والمخزون",
    icon: ShoppingCart,
    category: "ecommerce",
    fields: [
      { key: "store_url", label: "رابط المتجر", type: "text", placeholder: "https://your-store.com" },
      { key: "consumer_key", label: "مفتاح المستهلك", type: "password" },
      { key: "consumer_secret", label: "سر المستهلك", type: "password" },
    ],
  },
];

const IntegrationsPage = () => {
  const { tenantId } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialog, setConfigDialog] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedIntegrationLogs, setSelectedIntegrationLogs] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId) fetchIntegrations();
  }, [tenantId]);

  const fetchIntegrations = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("tenant_integrations")
      .select("*")
      .eq("tenant_id", tenantId);
    setIntegrations(data || []);
    setLoading(false);
  };

  const fetchSyncLogs = async (integrationId: string) => {
    setSelectedIntegrationLogs(integrationId);
    const { data } = await (supabase as any)
      .from("integration_sync_logs")
      .select("*")
      .eq("integration_id", integrationId)
      .order("created_at", { ascending: false })
      .limit(20);
    setSyncLogs(data || []);
  };

  const getIntegration = (type: string) => integrations.find((i) => i.integration_type === type);

  const handleSetup = (type: string) => {
    const existing = getIntegration(type);
    setConfigValues(existing?.config || {});
    setConfigDialog(type);
  };

  const handleSaveConfig = async () => {
    if (!configDialog || !tenantId) return;
    setSaving(true);
    const existing = getIntegration(configDialog);
    const meta = AVAILABLE_INTEGRATIONS.find((a) => a.type === configDialog);

    if (existing) {
      await (supabase as any)
        .from("tenant_integrations")
        .update({ config: configValues })
        .eq("id", existing.id);
    } else {
      await (supabase as any)
        .from("tenant_integrations")
        .insert({
          tenant_id: tenantId,
          integration_type: configDialog,
          display_name: meta?.nameAr || "",
          config: configValues,
          is_enabled: false,
        });
    }

    toast({ title: "تم حفظ إعدادات التكامل" });
    setSaving(false);
    setConfigDialog(null);
    fetchIntegrations();
  };

  const handleToggle = async (type: string, enabled: boolean) => {
    const integration = getIntegration(type);
    if (!integration) return;

    // Check config has values before enabling
    if (enabled && Object.keys(integration.config).length === 0) {
      toast({ title: "يرجى إعداد التكامل أولاً", variant: "destructive" });
      return;
    }

    await (supabase as any)
      .from("tenant_integrations")
      .update({ is_enabled: enabled })
      .eq("id", integration.id);

    toast({ title: enabled ? "تم تفعيل التكامل" : "تم تعطيل التكامل" });
    fetchIntegrations();
  };

  const handleToggleSync = async (integrationId: string, field: "sync_sales" | "sync_inventory", value: boolean) => {
    await (supabase as any)
      .from("tenant_integrations")
      .update({ [field]: value })
      .eq("id", integrationId);
    fetchIntegrations();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50"><CheckCircle2 size={12} /> ناجح</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><XCircle size={12} /> خطأ</Badge>;
      case "syncing":
        return <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50"><RefreshCw size={12} className="animate-spin" /> جاري</Badge>;
      case "partial":
        return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50"><AlertTriangle size={12} /> جزئي</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock size={12} /> لم يتم</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مركز التكاملات</h1>
          <p className="text-muted-foreground mt-1">ربط الأنظمة الخارجية ومزامنة البيانات تلقائياً</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Plug size={14} />
          {integrations.filter((i) => i.is_enabled).length} تكامل نشط
        </Badge>
      </div>

      <Tabs defaultValue="available" dir="rtl">
        <TabsList>
          <TabsTrigger value="available">التكاملات المتاحة</TabsTrigger>
          <TabsTrigger value="active">التكاملات النشطة</TabsTrigger>
          <TabsTrigger value="logs">سجل المزامنة</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_INTEGRATIONS.map((avail) => {
              const integration = getIntegration(avail.type);
              const Icon = avail.icon;
              return (
                <Card key={avail.type} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Icon size={20} className="text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{avail.nameAr}</CardTitle>
                          <p className="text-xs text-muted-foreground">{avail.name}</p>
                        </div>
                      </div>
                      {integration && (
                        <Switch
                          checked={integration.is_enabled}
                          onCheckedChange={(v) => handleToggle(avail.type, v)}
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CardDescription>{avail.description}</CardDescription>

                    {integration && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>آخر مزامنة:</span>
                        {integration.last_sync_at
                          ? format(new Date(integration.last_sync_at), "dd MMM yyyy HH:mm", { locale: ar })
                          : "لم يتم بعد"}
                        {statusBadge(integration.last_sync_status)}
                      </div>
                    )}

                    {integration && integration.is_enabled && (
                      <div className="flex items-center gap-4 pt-2 border-t">
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={integration.sync_sales}
                            onCheckedChange={(v) => handleToggleSync(integration.id, "sync_sales", v)}
                          />
                          مزامنة المبيعات
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={integration.sync_inventory}
                            onCheckedChange={(v) => handleToggleSync(integration.id, "sync_inventory", v)}
                          />
                          مزامنة المخزون
                        </label>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleSetup(avail.type)}>
                        <Settings2 size={14} />
                        {integration ? "تعديل الإعدادات" : "إعداد التكامل"}
                      </Button>
                      {integration && (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => fetchSyncLogs(integration.id)}>
                          <History size={14} />
                          السجل
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          {integrations.filter((i) => i.is_enabled).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Plug size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">لا توجد تكاملات نشطة حالياً</p>
                <p className="text-xs text-muted-foreground mt-1">قم بتفعيل التكاملات من التبويب "التكاملات المتاحة"</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {integrations.filter((i) => i.is_enabled).map((integration) => {
                const meta = AVAILABLE_INTEGRATIONS.find((a) => a.type === integration.integration_type);
                const Icon = meta?.icon || Plug;
                return (
                  <Card key={integration.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                          <Icon size={20} className="text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{integration.display_name || meta?.nameAr}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {statusBadge(integration.last_sync_status)}
                            {integration.sync_sales && <Badge variant="secondary" className="text-[10px]">مبيعات</Badge>}
                            {integration.sync_inventory && <Badge variant="secondary" className="text-[10px]">مخزون</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => fetchSyncLogs(integration.id)}>
                          <History size={14} />
                        </Button>
                        <Switch
                          checked={integration.is_enabled}
                          onCheckedChange={(v) => handleToggle(integration.integration_type, v)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {!selectedIntegrationLogs ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <History size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">اختر تكاملاً لعرض سجل المزامنة</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">سجل المزامنة</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>النوع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>سجلات ناجحة</TableHead>
                      <TableHead>سجلات فاشلة</TableHead>
                      <TableHead>البداية</TableHead>
                      <TableHead>النهاية</TableHead>
                      <TableHead>الخطأ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          لا توجد سجلات مزامنة
                        </TableCell>
                      </TableRow>
                    ) : (
                      syncLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.sync_type === "sales" ? "مبيعات" : log.sync_type === "inventory" ? "مخزون" : "كامل"}</TableCell>
                          <TableCell>{statusBadge(log.status)}</TableCell>
                          <TableCell>{log.records_synced}</TableCell>
                          <TableCell>{log.records_failed}</TableCell>
                          <TableCell className="text-xs">{format(new Date(log.started_at), "dd/MM HH:mm")}</TableCell>
                          <TableCell className="text-xs">{log.completed_at ? format(new Date(log.completed_at), "dd/MM HH:mm") : "-"}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[200px] truncate">{log.error_message || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعداد {AVAILABLE_INTEGRATIONS.find((a) => a.type === configDialog)?.nameAr}</DialogTitle>
            <DialogDescription>أدخل بيانات الاتصال بالنظام الخارجي. البيانات تُخزّن بشكل آمن.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {AVAILABLE_INTEGRATIONS.find((a) => a.type === configDialog)?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  type={field.type}
                  placeholder={(field as any).placeholder || ""}
                  value={configValues[field.key] || ""}
                  onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>إلغاء</Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegrationsPage;
