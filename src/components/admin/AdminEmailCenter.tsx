import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Mail, Search, Send, CheckCircle2, XCircle, Clock, BarChart3,
  Filter, Eye, Power, PowerOff, RefreshCw, TestTube, AlertTriangle,
  Building2, User, FileText, Shield, Wallet, Bell, ArrowUpDown,
  ChevronDown, Play, Pause, Settings2, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EmailLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  email_type: string;
  sender_address: string;
  recipient_email: string;
  subject: string;
  status: string;
  metadata: Record<string, unknown> | null;
  entity_type: string | null;
  entity_id: string | null;
  failure_reason: string | null;
  provider_id: string | null;
  provider_response: Record<string, unknown> | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  queued: number;
  pending: number;
  retrying: number;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  sent: { label: "مُرسل", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle2 },
  failed: { label: "فاشل", color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", icon: XCircle },
  queued: { label: "في الطابور", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: Clock },
  pending: { label: "قيد المعالجة", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: Clock },
  retrying: { label: "إعادة المحاولة", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", icon: RefreshCw },
};

const TYPE_LABELS: Record<string, { label: string; icon: typeof Mail }> = {
  financial_invoice: { label: "فاتورة", icon: FileText },
  financial_payment_receipt: { label: "إيصال دفع", icon: CheckCircle2 },
  financial_payment_failed: { label: "دفع فاشل", icon: XCircle },
  financial_refund: { label: "استرداد", icon: Wallet },
  financial_wallet_notification: { label: "محفظة", icon: Wallet },
  general_welcome: { label: "ترحيب", icon: Mail },
  security_alert: { label: "تنبيه أمني", icon: Shield },
};

const AdminEmailCenter = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, queued: 0, pending: 0, retrying: 0 });
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterTenant, setFilterTenant] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [viewLog, setViewLog] = useState<EmailLog | null>(null);
  const [testDialog, setTestDialog] = useState(false);
  const [controlsDialog, setControlsDialog] = useState(false);

  // Test email
  const [testEmail, setTestEmail] = useState("");
  const [testType, setTestType] = useState("general_welcome");
  const [testSending, setTestSending] = useState(false);

  // Controls
  const [sandboxMode, setSandboxMode] = useState(false);
  const [fromName, setFromName] = useState("Numaxio");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [logsRes, tenantsRes] = await Promise.all([
      supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("tenants" as any)
        .select("id, name")
        .order("name")
        .limit(200),
    ]);

    if (logsRes.data) {
      const data = logsRes.data as unknown as EmailLog[];
      setLogs(data);
      setStats({
        total: data.length,
        sent: data.filter(l => l.status === "sent").length,
        failed: data.filter(l => l.status === "failed").length,
        queued: data.filter(l => l.status === "queued").length,
        pending: data.filter(l => l.status === "pending").length,
        retrying: data.filter(l => l.status === "retrying").length,
      });
    }
    if (tenantsRes.data) setTenants(tenantsRes.data as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterType !== "all" && l.email_type !== filterType) return false;
      if (filterTenant !== "all" && l.tenant_id !== filterTenant) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return l.recipient_email.toLowerCase().includes(q) ||
          l.subject.toLowerCase().includes(q) ||
          l.email_type.includes(q);
      }
      return true;
    });
  }, [logs, filterStatus, filterType, filterTenant, searchQuery]);

  const successRate = stats.total > 0
    ? Math.round((stats.sent / stats.total) * 100)
    : 0;

  // Category stats
  const categoryStats = useMemo(() => {
    const financial = logs.filter(l => l.email_type.startsWith("financial_"));
    const security = logs.filter(l => l.email_type.startsWith("security_"));
    const general = logs.filter(l => l.email_type.startsWith("general_"));
    return { financial: financial.length, security: security.length, general: general.length };
  }, [logs]);

  const uniqueTypes = useMemo(() => {
    return [...new Set(logs.map(l => l.email_type))];
  }, [logs]);

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({ title: "خطأ", description: "البريد الإلكتروني مطلوب", variant: "destructive" });
      return;
    }
    setTestSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          action: "send",
          recipient_email: testEmail,
          email_type: testType,
          templateData: {
            company_name: "شركة اختبار",
            invoice_number: "TEST-001",
            amount: "1,000.00",
            currency: "ر.س",
            customer_name: "عميل تجريبي",
            grand_total: "1,150.00",
            subtotal: "1,000.00",
            vat_total: "150.00",
            invoice_date: new Date().toISOString().split("T")[0],
            due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
            user_name: "مدير النظام",
            wallet_balance: "5,000.00",
          },
        },
      });
      if (error) throw error;
      toast({ title: "تم الإرسال", description: `تم إرسال بريد تجريبي إلى ${testEmail}` });
      setTestDialog(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    }
    setTestSending(false);
  };

  const toggleTemplateActive = async (emailType: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("email_template_definitions" as any)
      .update({ is_active: !currentActive } as any)
      .eq("email_type", emailType);
    if (!error) {
      toast({ title: currentActive ? "تم التعطيل" : "تم التفعيل", description: `نوع البريد: ${emailType}` });
    }
  };

  const getTenantName = (id: string | null) => {
    if (!id) return "—";
    return tenants.find(t => t.id === id)?.name || id.substring(0, 8) + "...";
  };

  const getStatusInfo = (s: string) => STATUS_MAP[s] || { label: s, color: "bg-muted text-muted-foreground", icon: Clock };
  const getTypeInfo = (t: string) => TYPE_LABELS[t] || { label: t, icon: Mail };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="text-accent" size={28} />
            مركز البريد
          </h1>
          <p className="text-sm text-muted-foreground">مراقبة وإدارة جميع رسائل البريد الإلكتروني المرسلة من المنصة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setControlsDialog(true)} className="gap-2">
            <Settings2 size={16} /> التحكم
          </Button>
          <Button variant="outline" onClick={() => setTestDialog(true)} className="gap-2">
            <TestTube size={16} /> إرسال تجريبي
          </Button>
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw size={16} /> تحديث
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 size={14} /> لوحة الإحصائيات</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><FileText size={14} /> السجلات</TabsTrigger>
        </TabsList>

        {/* ═══ Dashboard Tab ═══ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-accent/10 p-3"><Send size={22} className="text-accent" /></div>
                <div>
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">إجمالي الرسائل</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950 p-3"><CheckCircle2 size={22} className="text-emerald-600" /></div>
                <div>
                  <p className="text-3xl font-bold text-emerald-600">{successRate}%</p>
                  <p className="text-xs text-muted-foreground">نسبة النجاح ({stats.sent} مرسلة)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-red-100 dark:bg-red-950 p-3"><XCircle size={22} className="text-red-600" /></div>
                <div>
                  <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">رسائل فاشلة</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-xl bg-amber-100 dark:bg-amber-950 p-3"><Clock size={22} className="text-amber-600" /></div>
                <div>
                  <p className="text-3xl font-bold text-amber-600">{stats.queued + stats.pending}</p>
                  <p className="text-xs text-muted-foreground">في الانتظار</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Wallet size={16} /> رسائل مالية</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{categoryStats.financial}</p>
                <p className="text-xs text-muted-foreground">فواتير، إيصالات، محفظة</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Shield size={16} /> رسائل أمنية</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{categoryStats.security}</p>
                <p className="text-xs text-muted-foreground">تنبيهات أمنية، تسجيل دخول</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Mail size={16} /> رسائل عامة</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{categoryStats.general}</p>
                <p className="text-xs text-muted-foreground">ترحيب، إشعارات</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Failed */}
          {stats.failed > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2"><AlertTriangle size={16} /> آخر الرسائل الفاشلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {logs.filter(l => l.status === "failed").slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                      <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-red-500 shrink-0" />
                        <span className="font-mono text-xs">{l.recipient_email}</span>
                        <span className="text-muted-foreground">—</span>
                        <span className="text-xs">{getTypeInfo(l.email_type).label}</span>
                      </div>
                      <span className="text-xs text-red-500 truncate max-w-[200px]">{l.failure_reason || "غير محدد"}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ Logs Tab ═══ */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="بحث بالبريد أو العنوان..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40"><SelectValue placeholder="النوع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {uniqueTypes.map(t => <SelectItem key={t} value={t}>{getTypeInfo(t).label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTenant} onValueChange={setFilterTenant}>
              <SelectTrigger className="w-44"><SelectValue placeholder="المنشأة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنشآت</SelectItem>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">{filtered.length} سجل</div>

          {/* Logs Table */}
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المستلم</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-center">النوع</TableHead>
                    <TableHead className="text-center">المنشأة</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center">المحاولات</TableHead>
                    <TableHead className="text-center">التاريخ</TableHead>
                    <TableHead className="text-center w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(l => {
                    const si = getStatusInfo(l.status);
                    const ti = getTypeInfo(l.email_type);
                    const StatusIcon = si.icon;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs" dir="ltr">{l.recipient_email}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{l.subject}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs gap-1">{ti.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{getTenantName(l.tenant_id)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs gap-1 ${si.color}`}><StatusIcon size={11} />{si.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono">{l.retry_count}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleDateString("ar-SA")}
                          <br />
                          <span className="text-[10px]">{new Date(l.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="ghost" onClick={() => setViewLog(l)} className="h-7 w-7 p-0"><Eye size={14} /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد سجلات</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ View Log Dialog ═══ */}
      <Dialog open={!!viewLog} onOpenChange={() => setViewLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye size={18} className="text-accent" /> تفاصيل الرسالة</DialogTitle>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">المستلم:</span> <span className="font-mono" dir="ltr">{viewLog.recipient_email}</span></div>
                <div><span className="text-muted-foreground">المرسل:</span> <span className="font-mono text-xs" dir="ltr">{viewLog.sender_address}</span></div>
                <div><span className="text-muted-foreground">النوع:</span> <Badge variant="outline" className="text-xs">{getTypeInfo(viewLog.email_type).label}</Badge></div>
                <div><span className="text-muted-foreground">الحالة:</span> <Badge className={`text-xs ${getStatusInfo(viewLog.status).color}`}>{getStatusInfo(viewLog.status).label}</Badge></div>
                <div><span className="text-muted-foreground">المنشأة:</span> {getTenantName(viewLog.tenant_id)}</div>
                <div><span className="text-muted-foreground">المحاولات:</span> {viewLog.retry_count}</div>
                <div><span className="text-muted-foreground">الإنشاء:</span> {new Date(viewLog.created_at).toLocaleString("ar-SA")}</div>
                {viewLog.sent_at && <div><span className="text-muted-foreground">الإرسال:</span> {new Date(viewLog.sent_at).toLocaleString("ar-SA")}</div>}
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">العنوان</Label>
                <p className="mt-1 text-sm bg-muted rounded-lg p-3">{viewLog.subject}</p>
              </div>

              {viewLog.failure_reason && (
                <div>
                  <Label className="text-sm font-medium text-red-600">سبب الفشل</Label>
                  <p className="mt-1 text-xs font-mono bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-red-700 dark:text-red-300">{viewLog.failure_reason}</p>
                </div>
              )}

              {viewLog.metadata && Object.keys(viewLog.metadata).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">البيانات (Metadata)</Label>
                  <pre className="mt-1 text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto max-h-[200px]" dir="ltr">
                    {JSON.stringify(viewLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {viewLog.provider_response && (
                <div>
                  <Label className="text-sm font-medium">استجابة المزود</Label>
                  <pre className="mt-1 text-xs font-mono bg-muted rounded-lg p-3 overflow-x-auto" dir="ltr">
                    {JSON.stringify(viewLog.provider_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Test Email Dialog ═══ */}
      <Dialog open={testDialog} onOpenChange={setTestDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TestTube size={18} className="text-accent" /> إرسال بريد تجريبي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>نوع القالب</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              سيتم إرسال بريد حقيقي ببيانات تجريبية. تأكد من صحة العنوان.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTestDialog(false)}>إلغاء</Button>
            <Button onClick={sendTestEmail} disabled={testSending} className="gap-2">
              <Send size={14} />
              {testSending ? "جاري الإرسال..." : "إرسال"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Controls Dialog ═══ */}
      <Dialog open={controlsDialog} onOpenChange={setControlsDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 size={18} className="text-accent" /> التحكم في البريد</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Sandbox Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">وضع Sandbox</p>
                <p className="text-xs text-muted-foreground">تُسجل الرسائل دون إرسال حقيقي</p>
              </div>
              <Switch checked={sandboxMode} onCheckedChange={setSandboxMode} />
            </div>
            {sandboxMode && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                وضع Sandbox مفعّل — لن يتم إرسال أي بريد فعلي. تُسجل الرسائل فقط في السجلات.
              </div>
            )}

            <Separator />

            {/* From Name */}
            <div className="space-y-2">
              <Label>اسم المرسل (From Name)</Label>
              <Input value={fromName} onChange={e => setFromName(e.target.value)} dir="ltr" />
              <p className="text-xs text-muted-foreground">يظهر للمستلم كاسم المرسل في صندوق الوارد</p>
            </div>

            <Separator />

            {/* Provider */}
            <div className="space-y-2">
              <Label>مزود البريد (Provider)</Label>
              <Select defaultValue="resend">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="sendgrid" disabled>SendGrid (قريباً)</SelectItem>
                  <SelectItem value="ses" disabled>Amazon SES (قريباً)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Toggle email types */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">إيقاف / تفعيل أنواع الرسائل</Label>
              {Object.entries(TYPE_LABELS).map(([type, info]) => (
                <div key={type} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <info.icon size={14} className="text-muted-foreground" />
                    {info.label}
                    <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">{type}</span>
                  </div>
                  <Switch
                    defaultChecked={true}
                    onCheckedChange={(checked) => toggleTemplateActive(type, !checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailCenter;
