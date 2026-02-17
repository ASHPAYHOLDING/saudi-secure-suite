import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Percent, Settings2, Building2, Save, Loader2,
  Receipt, CheckCircle2, Search, Edit2
} from "lucide-react";

interface TenantFeeConfig {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  fee_type: string;
  fee_percentage: number;
  fee_fixed_amount: number;
  min_fee: number;
  max_fee: number | null;
  is_active: boolean;
}

interface FeeLog {
  id: string;
  tenant_id: string;
  fee_type: string;
  fee_percentage: number | null;
  fee_fixed: number | null;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  description: string | null;
  created_at: string;
}

const AdminPaylinkFees = () => {
  const [configs, setConfigs] = useState<TenantFeeConfig[]>([]);
  const [feeLogs, setFeeLogs] = useState<FeeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editConfig, setEditConfig] = useState<TenantFeeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"configs" | "logs">("configs");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [configsRes, logsRes] = await Promise.all([
      supabase.from("paylink_fee_configs").select("*, tenants(name)").order("created_at", { ascending: false }),
      supabase.from("paylink_fee_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    if (configsRes.data) {
      setConfigs(configsRes.data.map((c: any) => ({
        ...c,
        tenant_name: c.tenants?.name || "غير معروف",
      })));
    }
    if (logsRes.data) setFeeLogs(logsRes.data as FeeLog[]);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editConfig) return;
    setSaving(true);

    const { error } = await supabase
      .from("paylink_fee_configs")
      .update({
        fee_type: editConfig.fee_type,
        fee_percentage: editConfig.fee_percentage,
        fee_fixed_amount: editConfig.fee_fixed_amount,
        min_fee: editConfig.min_fee,
        max_fee: editConfig.max_fee,
        is_active: editConfig.is_active,
      })
      .eq("id", editConfig.id);

    setSaving(false);
    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } else {
      toast.success("تم تحديث إعدادات الرسوم بنجاح");
      setEditConfig(null);
      fetchData();
    }
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";

  const feeTypeLabel = (t: string) =>
    t === "percentage" ? "نسبة مئوية" : t === "fixed" ? "مبلغ ثابت" : "مشترك";

  const filteredConfigs = configs.filter((c) =>
    !search || c.tenant_name?.includes(search) || c.tenant_id.includes(search)
  );

  const totalFeesCollected = feeLogs.reduce((s, l) => s + l.fee_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">إجمالي الرسوم المحصّلة</span>
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-accent" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalFeesCollected)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">عدد الشركات المربوطة</span>
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-info" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{configs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">عدد سجلات الرسوم</span>
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-warning" />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{feeLogs.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5 w-fit">
        {([
          { key: "configs" as const, label: "إعدادات الرسوم", icon: Settings2 },
          { key: "logs" as const, label: "سجل الرسوم", icon: Receipt },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "configs" && (
        <Card className="border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">إعدادات رسوم الشركات</CardTitle>
                <CardDescription>تعديل نسبة أو مبلغ الرسوم لكل شركة</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث بالشركة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredConfigs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Settings2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد إعدادات رسوم بعد</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-semibold">الشركة</TableHead>
                      <TableHead className="text-right font-semibold">نوع الرسوم</TableHead>
                      <TableHead className="text-right font-semibold">النسبة %</TableHead>
                      <TableHead className="text-right font-semibold">مبلغ ثابت</TableHead>
                      <TableHead className="text-right font-semibold">الحد الأدنى</TableHead>
                      <TableHead className="text-right font-semibold">الحد الأقصى</TableHead>
                      <TableHead className="text-right font-semibold">الحالة</TableHead>
                      <TableHead className="text-right font-semibold">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConfigs.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-sm">{c.tenant_name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{feeTypeLabel(c.fee_type)}</Badge></TableCell>
                        <TableCell className="text-sm">{c.fee_percentage}%</TableCell>
                        <TableCell className="text-sm">{formatCurrency(c.fee_fixed_amount)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(c.min_fee)}</TableCell>
                        <TableCell className="text-sm">{c.max_fee ? formatCurrency(c.max_fee) : "—"}</TableCell>
                        <TableCell>
                          <Badge className={c.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                            {c.is_active ? "مفعّل" : "معطّل"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setEditConfig({ ...c })} className="gap-1">
                            <Edit2 className="w-3.5 h-3.5" /> تعديل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "logs" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-accent" /> سجل الرسوم المحصّلة
            </CardTitle>
            <CardDescription>جميع الرسوم المقتطعة من المعاملات</CardDescription>
          </CardHeader>
          <CardContent>
            {feeLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد سجلات رسوم بعد</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-semibold">التاريخ</TableHead>
                      <TableHead className="text-right font-semibold">نوع الرسوم</TableHead>
                      <TableHead className="text-right font-semibold">المبلغ الإجمالي</TableHead>
                      <TableHead className="text-right font-semibold">الرسوم</TableHead>
                      <TableHead className="text-right font-semibold">الصافي</TableHead>
                      <TableHead className="text-right font-semibold">الوصف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm">{new Date(log.created_at).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{feeTypeLabel(log.fee_type)}</Badge></TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(log.gross_amount)}</TableCell>
                        <TableCell className="text-sm text-destructive font-semibold">-{formatCurrency(log.fee_amount)}</TableCell>
                        <TableCell className="text-sm text-accent font-semibold">{formatCurrency(log.net_amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.description || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editConfig} onOpenChange={(open) => !open && setEditConfig(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-accent" /> تعديل رسوم: {editConfig?.tenant_name}
            </DialogTitle>
          </DialogHeader>
          {editConfig && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>نوع الرسوم</Label>
                <Select value={editConfig.fee_type} onValueChange={(v) => setEditConfig({ ...editConfig, fee_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                    <SelectItem value="combined">مشترك (نسبة + ثابت)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editConfig.fee_type === "percentage" || editConfig.fee_type === "combined") && (
                <div className="space-y-2">
                  <Label>النسبة المئوية (%)</Label>
                  <Input type="number" value={editConfig.fee_percentage} step="0.1" min="0" max="100"
                    onChange={(e) => setEditConfig({ ...editConfig, fee_percentage: parseFloat(e.target.value) || 0 })} dir="ltr" />
                </div>
              )}
              {(editConfig.fee_type === "fixed" || editConfig.fee_type === "combined") && (
                <div className="space-y-2">
                  <Label>المبلغ الثابت (ر.س)</Label>
                  <Input type="number" value={editConfig.fee_fixed_amount} step="0.5" min="0"
                    onChange={(e) => setEditConfig({ ...editConfig, fee_fixed_amount: parseFloat(e.target.value) || 0 })} dir="ltr" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الحد الأدنى للرسوم (ر.س)</Label>
                  <Input type="number" value={editConfig.min_fee} step="0.5" min="0"
                    onChange={(e) => setEditConfig({ ...editConfig, min_fee: parseFloat(e.target.value) || 0 })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الحد الأقصى للرسوم (ر.س)</Label>
                  <Input type="number" value={editConfig.max_fee ?? ""} step="0.5" min="0" placeholder="بدون حد"
                    onChange={(e) => setEditConfig({ ...editConfig, max_fee: e.target.value ? parseFloat(e.target.value) : null })} dir="ltr" />
                </div>
              </div>
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <Label>تفعيل الرسوم</Label>
                <Switch checked={editConfig.is_active} onCheckedChange={(v) => setEditConfig({ ...editConfig, is_active: v })} />
              </div>

              {/* Fee Preview */}
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">معاينة: على مبلغ 1,000 ر.س</p>
                {(() => {
                  let fee = 0;
                  if (editConfig.fee_type === "percentage") fee = 1000 * (editConfig.fee_percentage / 100);
                  else if (editConfig.fee_type === "fixed") fee = editConfig.fee_fixed_amount;
                  else fee = 1000 * (editConfig.fee_percentage / 100) + editConfig.fee_fixed_amount;
                  if (fee < editConfig.min_fee) fee = editConfig.min_fee;
                  if (editConfig.max_fee && fee > editConfig.max_fee) fee = editConfig.max_fee;
                  fee = Math.round(fee * 100) / 100;
                  return (
                    <div className="flex justify-between text-sm">
                      <span>الرسوم: <strong className="text-destructive">{formatCurrency(fee)}</strong></span>
                      <span>الصافي: <strong className="text-accent">{formatCurrency(1000 - fee)}</strong></span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditConfig(null)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...</> : <><Save className="w-4 h-4" /> حفظ التعديلات</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaylinkFees;
