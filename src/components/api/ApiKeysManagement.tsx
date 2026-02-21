import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Key, Plus, Copy, Trash2, Loader2, Shield, Clock, Eye, EyeOff,
  Activity, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ─── Available Scopes ─── */
const SCOPE_CATEGORIES = [
  {
    label: "الفواتير",
    labelEn: "Invoices",
    scopes: [
      { key: "invoices:read", label: "قراءة الفواتير", labelEn: "Read invoices" },
      { key: "invoices:write", label: "إنشاء/تعديل الفواتير", labelEn: "Create/update invoices" },
    ],
  },
  {
    label: "العملاء",
    labelEn: "Customers",
    scopes: [
      { key: "customers:read", label: "قراءة العملاء", labelEn: "Read customers" },
      { key: "customers:write", label: "إنشاء/تعديل العملاء", labelEn: "Create/update customers" },
    ],
  },
  {
    label: "المدفوعات",
    labelEn: "Payments",
    scopes: [
      { key: "payments:read", label: "قراءة المدفوعات", labelEn: "Read payments" },
    ],
  },
  {
    label: "القيود المحاسبية",
    labelEn: "Journal",
    scopes: [
      { key: "journal:read", label: "قراءة القيود", labelEn: "Read journal entries" },
      { key: "journal:write", label: "إنشاء قيود", labelEn: "Create journal entries" },
    ],
  },
  {
    label: "المنتجات",
    labelEn: "Products",
    scopes: [
      { key: "products:read", label: "قراءة المنتجات", labelEn: "Read products" },
    ],
  },
];

// Map legacy scope names
function normalizeScopeDisplay(scope: string): string {
  const map: Record<string, string> = {
    "read:invoices": "invoices:read",
    "read:customers": "customers:read",
  };
  return map[scope] || scope;
}

const ApiKeysManagement = () => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Default Key");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["invoices:read", "customers:read"]);
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; id: string } | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("api_keys")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setKeys(data || []);
    setLoading(false);
  };

  const fetchLogs = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("api_request_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    setRecentLogs(data || []);
  };

  useEffect(() => { fetchKeys(); fetchLogs(); }, [tenantId]);

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async () => {
    if (!tenantId || selectedScopes.length === 0) return;
    setCreating(true);
    const { data, error } = await secureRpc("generate_api_key", {
      _tenant_id: tenantId,
      _name: newKeyName,
      _scopes: selectedScopes,
    });

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      setNewKeyResult({ key: data.key, id: data.id });
      toast({ title: "تم إنشاء المفتاح بنجاح" });
      // Audit log
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: user?.id,
        action: "create_api_key",
        entity_type: "api_key",
        entity_id: data.id,
        entity_label: newKeyName,
        after_value: { scopes: selectedScopes },
      }).then(() => {});
      fetchKeys();
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    await supabase.from("api_keys").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
    // Audit
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId!,
      user_id: user?.id ?? "",
      action: "revoke_api_key",
      entity_type: "api_key",
      entity_id: id,
    }).then(() => {});
    toast({ title: "تم إلغاء المفتاح" });
    setRevokeConfirm(null);
    fetchKeys();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await supabase.from("api_keys").update({ is_active: !isActive }).eq("id", id);
    fetchKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ" });
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const apiBaseUrl = `https://${projectId}.supabase.co/functions/v1/public-api/v1`;

  return (
    <div dir="rtl" className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-3">
            <Key className="h-6 w-6 text-primary" />
            واجهة برمجة التطبيقات (API)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة مفاتيح الوصول والصلاحيات — Enterprise
          </p>
        </div>
        <Button onClick={() => { setShowCreate(true); setNewKeyResult(null); setNewKeyName("Default Key"); setSelectedScopes(["invoices:read", "customers:read"]); }} className="gap-2">
          <Plus className="h-4 w-4" />
          مفتاح جديد
        </Button>
      </div>

      {/* API Endpoint Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-foreground">نقطة الوصول الأساسية</p>
              <div className="flex items-center gap-2">
                <code className="bg-background rounded px-3 py-1.5 text-xs font-mono text-foreground flex-1 truncate" dir="ltr">
                  {apiBaseUrl}
                </code>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(apiBaseUrl)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                أرسل المفتاح في header: <code className="font-mono bg-background px-1 rounded" dir="ltr">x-api-key: nmx_live_...</code>
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">GET /invoices</Badge>
                <Badge variant="outline" className="text-[10px]">GET /invoices/:id</Badge>
                <Badge variant="outline" className="text-[10px]">GET /customers</Badge>
                <Badge variant="outline" className="text-[10px]">GET /customers/:id</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keys Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            مفاتيح API ({keys.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد مفاتيح — أنشئ مفتاح API للبدء</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">المفتاح</TableHead>
                  <TableHead className="text-right">الصلاحيات</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">آخر استخدام</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id} className={cn(!key.is_active && "opacity-50")}>
                    <TableCell className="font-medium text-sm">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded" dir="ltr">
                        {key.key_prefix}••••••••
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap max-w-[200px]">
                        {(key.scopes || []).map((s: string) => (
                          <Badge key={s} variant="outline" className="text-[9px]">{normalizeScopeDisplay(s)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={key.is_active ? "default" : "secondary"}
                        className={cn("text-[10px]", key.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20")}
                      >
                        {key.is_active ? "نشط" : "ملغي"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString("ar-SA")
                        : "لم يُستخدم"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {key.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                            onClick={() => setRevokeConfirm(key.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent API Logs */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              آخر الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الوقت</TableHead>
                  <TableHead className="text-right">Method</TableHead>
                  <TableHead className="text-right">المسار</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الزمن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground" dir="ltr">
                      {new Date(log.created_at).toLocaleTimeString("ar-SA")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">{log.method}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono" dir="ltr">{log.path}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          log.status_code < 300 ? "text-success border-success/20" :
                          log.status_code < 500 ? "text-warning border-warning/20" :
                          "text-destructive border-destructive/20"
                        )}
                      >
                        {log.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.response_time_ms}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog with Scope Matrix */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setNewKeyResult(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              إنشاء مفتاح API جديد
            </DialogTitle>
          </DialogHeader>

          {newKeyResult ? (
            <div className="space-y-4">
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">مهم — انسخ المفتاح الآن</p>
                    <p className="text-xs text-muted-foreground mt-1">لن يتم عرض هذا المفتاح مرة أخرى</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-muted rounded px-3 py-2 text-xs font-mono flex-1 break-all" dir="ltr">
                  {newKeyResult.key}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKeyResult.key)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setShowCreate(false); setNewKeyResult(null); }}>
                <CheckCircle2 className="h-4 w-4 me-2" />
                تم — نسخت المفتاح
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>اسم المفتاح</Label>
                  <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="مثال: تكامل ERP" />
                </div>

                {/* Scope Checkbox Matrix */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    الصلاحيات (Scopes)
                  </Label>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {SCOPE_CATEGORIES.map((cat) => (
                      <div key={cat.labelEn} className="p-3 space-y-2">
                        <p className="text-xs font-semibold text-foreground">{cat.label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {cat.scopes.map((scope) => (
                            <label
                              key={scope.key}
                              className={cn(
                                "flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors",
                                selectedScopes.includes(scope.key)
                                  ? "border-primary/40 bg-primary/5"
                                  : "border-border/50 hover:border-border"
                              )}
                            >
                              <Checkbox
                                checked={selectedScopes.includes(scope.key)}
                                onCheckedChange={() => toggleScope(scope.key)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{scope.label}</p>
                                <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{scope.key}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedScopes.length === 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      يجب اختيار صلاحية واحدة على الأقل
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating || !newKeyName.trim() || selectedScopes.length === 0}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Key className="h-4 w-4 me-2" />}
                  إنشاء المفتاح
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <Dialog open={!!revokeConfirm} onOpenChange={() => setRevokeConfirm(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              تأكيد إلغاء المفتاح
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            سيتم إلغاء هذا المفتاح نهائياً ولن يمكن استخدامه مجدداً. هل أنت متأكد؟
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRevokeConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => revokeConfirm && handleRevoke(revokeConfirm)} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              إلغاء المفتاح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiKeysManagement;
