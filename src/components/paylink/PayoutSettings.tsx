import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Building2, Save, Loader2, Settings2, CheckCircle2,
  Clock, XCircle, CalendarClock, Landmark, Send
} from "lucide-react";

interface PayoutSettingsData {
  id?: string;
  bank_name: string;
  iban: string;
  account_holder_name: string;
  payout_schedule: string;
  payout_day: number | null;
  min_payout_amount: number;
  is_active: boolean;
}

interface Payout {
  id: string;
  payout_number: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  bank_name: string | null;
  iban: string | null;
  scheduled_at: string | null;
  processed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

const PayoutSettings = () => {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<PayoutSettingsData>({
    bank_name: "",
    iban: "",
    account_holder_name: "",
    payout_schedule: "manual",
    payout_day: null,
    min_payout_amount: 100,
    is_active: true,
  });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"settings" | "history">("settings");

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [settingsRes, payoutsRes] = await Promise.all([
      supabase.from("paylink_payout_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("paylink_payouts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    ]);
    if (settingsRes.data) {
      setSettings({
        id: settingsRes.data.id,
        bank_name: settingsRes.data.bank_name,
        iban: settingsRes.data.iban,
        account_holder_name: settingsRes.data.account_holder_name,
        payout_schedule: settingsRes.data.payout_schedule,
        payout_day: settingsRes.data.payout_day,
        min_payout_amount: settingsRes.data.min_payout_amount,
        is_active: settingsRes.data.is_active,
      });
    }
    if (payoutsRes.data) setPayouts(payoutsRes.data as Payout[]);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!settings.bank_name || !settings.iban || !settings.account_holder_name) {
      toast.error("يرجى تعبئة جميع بيانات الحساب البنكي");
      return;
    }
    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      bank_name: settings.bank_name,
      iban: settings.iban,
      account_holder_name: settings.account_holder_name,
      payout_schedule: settings.payout_schedule,
      payout_day: settings.payout_day,
      min_payout_amount: settings.min_payout_amount,
      is_active: settings.is_active,
    };

    let error;
    if (settings.id) {
      ({ error } = await supabase.from("paylink_payout_settings").update(payload).eq("id", settings.id));
    } else {
      ({ error } = await supabase.from("paylink_payout_settings").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
    } else {
      toast.success("تم حفظ إعدادات التحويل بنجاح");
      fetchData();
    }
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";

  const scheduleLabel = (s: string) => {
    switch (s) {
      case "daily": return "يومي";
      case "weekly": return "أسبوعي";
      case "monthly": return "شهري";
      default: return "يدوي";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5 w-fit">
        {([
          { key: "settings" as const, label: "إعدادات التحويل", icon: Settings2 },
          { key: "history" as const, label: "سجل التحويلات", icon: CalendarClock },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="w-4 h-4 text-accent" /> إعدادات الحساب البنكي والتحويل التلقائي
            </CardTitle>
            <CardDescription>حدد حسابك البنكي وجدول التحويل التلقائي لاستلام أرباحك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bank Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" /> بيانات الحساب البنكي
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم البنك</Label>
                  <Input placeholder="مثال: بنك الراجحي" value={settings.bank_name}
                    onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>اسم صاحب الحساب</Label>
                  <Input placeholder="الاسم كما في الحساب البنكي" value={settings.account_holder_name}
                    onChange={(e) => setSettings({ ...settings, account_holder_name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>رقم الآيبان (IBAN)</Label>
                <Input placeholder="SA0000000000000000000000" value={settings.iban} dir="ltr"
                  onChange={(e) => setSettings({ ...settings, iban: e.target.value.toUpperCase() })}
                  className="font-mono tracking-wider" />
              </div>
            </div>

            <Separator />

            {/* Schedule */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> جدول التحويل
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>نوع التحويل</Label>
                  <Select value={settings.payout_schedule}
                    onValueChange={(v) => setSettings({ ...settings, payout_schedule: v, payout_day: null })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">يدوي (عند الطلب)</SelectItem>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="weekly">أسبوعي</SelectItem>
                      <SelectItem value="monthly">شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {settings.payout_schedule === "weekly" && (
                  <div className="space-y-2">
                    <Label>يوم الأسبوع</Label>
                    <Select value={settings.payout_day?.toString() || ""}
                      onValueChange={(v) => setSettings({ ...settings, payout_day: parseInt(v) })}>
                      <SelectTrigger><SelectValue placeholder="اختر اليوم" /></SelectTrigger>
                      <SelectContent>
                        {["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"].map((d, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {settings.payout_schedule === "monthly" && (
                  <div className="space-y-2">
                    <Label>يوم الشهر</Label>
                    <Input type="number" min={1} max={28} placeholder="1-28" value={settings.payout_day ?? ""}
                      onChange={(e) => setSettings({ ...settings, payout_day: parseInt(e.target.value) || null })} dir="ltr" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>الحد الأدنى للتحويل (ر.س)</Label>
                  <Input type="number" min={1} value={settings.min_payout_amount}
                    onChange={(e) => setSettings({ ...settings, min_payout_amount: parseFloat(e.target.value) || 0 })} dir="ltr" />
                </div>
              </div>
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <Label>تفعيل التحويل التلقائي</Label>
                <Switch checked={settings.is_active}
                  onCheckedChange={(v) => setSettings({ ...settings, is_active: v })} />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...</> : <><Save className="w-4 h-4" /> حفظ الإعدادات</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "history" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" /> سجل التحويلات
            </CardTitle>
            <CardDescription>جميع التحويلات المنفذة والمجدولة مع تفاصيل الرسوم</CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Send className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد تحويلات بعد</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right font-semibold">رقم التحويل</TableHead>
                      <TableHead className="text-right font-semibold">التاريخ</TableHead>
                      <TableHead className="text-right font-semibold">المبلغ</TableHead>
                      <TableHead className="text-right font-semibold">الرسوم</TableHead>
                      <TableHead className="text-right font-semibold">الصافي</TableHead>
                      <TableHead className="text-right font-semibold">البنك</TableHead>
                      <TableHead className="text-right font-semibold">IBAN</TableHead>
                      <TableHead className="text-right font-semibold">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.payout_number}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(p.processed_at || p.created_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(p.gross_amount)}</TableCell>
                        <TableCell className="text-sm text-destructive">
                          {p.fee_amount > 0 ? `-${formatCurrency(p.fee_amount)}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-accent">{formatCurrency(p.net_amount)}</TableCell>
                        <TableCell className="text-sm">{p.bank_name || "—"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.iban ? `...${p.iban.slice(-4)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${
                            p.status === "completed" ? "text-success border-success/30" :
                            p.status === "processing" ? "text-info border-info/30" :
                            p.status === "pending" ? "text-warning border-warning/30" :
                            "text-destructive border-destructive/30"
                          }`}>
                            {p.status === "completed" ? <><CheckCircle2 className="w-3 h-3 ml-1" /> مكتمل</> :
                             p.status === "processing" ? <><Loader2 className="w-3 h-3 ml-1 animate-spin" /> قيد التنفيذ</> :
                             p.status === "pending" ? <><Clock className="w-3 h-3 ml-1" /> مجدول</> :
                             <><XCircle className="w-3 h-3 ml-1" /> فشل</>}
                          </Badge>
                          {p.failure_reason && (
                            <p className="text-xs text-destructive mt-1">{p.failure_reason}</p>
                          )}
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
    </div>
  );
};

export default PayoutSettings;
