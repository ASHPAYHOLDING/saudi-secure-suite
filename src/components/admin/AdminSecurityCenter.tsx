import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, Search, AlertTriangle, Lock, Unlock, Eye,
  Activity, Globe, Smartphone, RefreshCw, Download, Filter,
  CheckCircle, XCircle, Clock, UserX, ShieldCheck, Fingerprint
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ───
interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  changes: any;
  ip_address: string | null;
  created_at: string;
  user_name?: string;
  tenant_name?: string;
}

interface SecurityEvent {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  event_type: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: any;
  metadata: any;
  description: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  user_name?: string;
}

interface AccountLock {
  id: string;
  user_id: string;
  locked_by: string;
  reason: string;
  locked_at: string;
  unlocked_at: string | null;
  unlocked_by: string | null;
  is_active: boolean;
  user_name?: string;
  user_email?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  tenant_id: string | null;
  is_active: boolean;
}

// ─── Constants ───
const SEVERITY_MAP: Record<string, { label: string; color: string; icon: any }> = {
  info: { label: "معلومات", color: "bg-blue-100 text-blue-700", icon: Activity },
  warning: { label: "تحذير", color: "bg-amber-100 text-amber-700", icon: AlertTriangle },
  critical: { label: "حرج", color: "bg-destructive/10 text-destructive", icon: ShieldAlert },
};

const EVENT_TYPE_MAP: Record<string, { label: string; icon: string }> = {
  login_success: { label: "تسجيل دخول ناجح", icon: "✅" },
  login_failed: { label: "محاولة دخول فاشلة", icon: "❌" },
  password_reset: { label: "إعادة تعيين كلمة المرور", icon: "🔑" },
  account_locked: { label: "قفل حساب", icon: "🔒" },
  account_unlocked: { label: "فتح حساب", icon: "🔓" },
  suspicious_activity: { label: "نشاط مشبوه", icon: "⚠️" },
  multiple_failed_logins: { label: "محاولات دخول متعددة فاشلة", icon: "🚫" },
  unusual_ip: { label: "IP غير معتاد", icon: "🌐" },
  new_device: { label: "جهاز جديد", icon: "📱" },
  force_logout: { label: "تسجيل خروج إجباري", icon: "🚪" },
  tenant_security_reset: { label: "إعادة تعيين أمان المنشأة", icon: "🏢" },
  data_export: { label: "تصدير بيانات", icon: "📤" },
};

const ACTION_MAP: Record<string, string> = {
  create: "إنشاء",
  update: "تحديث",
  delete: "حذف",
  sign: "توقيع",
  cancel: "إلغاء",
  mark_paid: "تحصيل",
};

const ENTITY_MAP: Record<string, string> = {
  invoice: "فاتورة",
  contract: "عقد",
  stamp: "ختم",
  customer: "عميل",
  tenant: "منشأة",
};

const AdminSecurityCenter = () => {
  const { user } = useAuth();

  // ─── State ───
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [accountLocks, setAccountLocks] = useState<AccountLock[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [tenantMap, setTenantMap] = useState<Record<string, string>>({});
  const [profileMap, setProfileMap] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState("all");
  const [auditEntity, setAuditEntity] = useState("all");
  const [eventSearch, setEventSearch] = useState("");
  const [eventSeverity, setEventSeverity] = useState("all");
  const [eventType, setEventType] = useState("all");

  // Dialogs
  const [lockDialog, setLockDialog] = useState(false);
  const [lockUserId, setLockUserId] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [resolveDialog, setResolveDialog] = useState(false);
  const [resolveEvent, setResolveEvent] = useState<SecurityEvent | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [detailDialog, setDetailDialog] = useState(false);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  // ─── Data Fetching ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [logsRes, eventsRes, locksRes, profilesRes, tenantsRes] = await Promise.all([
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("account_locks").select("*").order("locked_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email, tenant_id, is_active"),
      supabase.from("tenants").select("id, name"),
    ]);

    const tMap: Record<string, string> = {};
    tenantsRes.data?.forEach(t => { tMap[t.id] = t.name; });
    setTenantMap(tMap);

    const pMap: Record<string, { name: string; email: string }> = {};
    profilesRes.data?.forEach(p => { pMap[p.id] = { name: p.full_name, email: p.email }; });
    setProfileMap(pMap);

    if (profilesRes.data) setProfiles(profilesRes.data);

    if (logsRes.data) {
      setAuditLogs(logsRes.data.map(l => ({
        ...l,
        user_name: pMap[l.user_id]?.name || "غير معروف",
        tenant_name: tMap[l.tenant_id] || "غير معروف",
      })));
    }

    if (eventsRes.data) {
      setSecurityEvents(eventsRes.data.map(e => ({
        ...e,
        user_name: e.user_id ? pMap[e.user_id]?.name || "غير معروف" : "—",
      })));
    }

    if (locksRes.data) {
      setAccountLocks(locksRes.data.map(l => ({
        ...l,
        user_name: pMap[l.user_id]?.name || "غير معروف",
        user_email: pMap[l.user_id]?.email || "",
      })));
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Actions ───
  const lockAccount = async () => {
    if (!lockUserId || !lockReason.trim() || !user) {
      toast({ title: "خطأ", description: "اختر المستخدم وأدخل السبب", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("account_locks").insert({
      user_id: lockUserId,
      locked_by: user.id,
      reason: lockReason.trim(),
    });

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    // Log the event
    await supabase.from("security_events").insert({
      user_id: lockUserId,
      event_type: "account_locked",
      severity: "warning",
      description: `تم قفل الحساب: ${lockReason.trim()}`,
      metadata: { locked_by: user.id },
    });

    // Deactivate user profile
    await supabase.from("profiles").update({ is_active: false }).eq("id", lockUserId);

    toast({ title: "تم القفل", description: "تم قفل الحساب بنجاح" });
    setLockDialog(false);
    setLockUserId("");
    setLockReason("");
    fetchData();
  };

  const unlockAccount = async (lock: AccountLock) => {
    if (!user) return;

    const { error } = await supabase.from("account_locks").update({
      is_active: false,
      unlocked_at: new Date().toISOString(),
      unlocked_by: user.id,
    }).eq("id", lock.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("security_events").insert({
      user_id: lock.user_id,
      event_type: "account_unlocked",
      severity: "info",
      description: "تم فتح الحساب",
      metadata: { unlocked_by: user.id },
    });

    await supabase.from("profiles").update({ is_active: true }).eq("id", lock.user_id);

    toast({ title: "تم الفتح", description: "تم فتح الحساب بنجاح" });
    fetchData();
  };

  const resolveSecurityEvent = async () => {
    if (!resolveEvent || !user) return;

    const { error } = await supabase.from("security_events").update({
      is_resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      resolution_notes: resolveNotes.trim() || null,
    }).eq("id", resolveEvent.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "تم الحل", description: "تم تحديث حالة الحدث الأمني" });
    setResolveDialog(false);
    setResolveEvent(null);
    setResolveNotes("");
    fetchData();
  };

  const logForceLogout = async (userId: string) => {
    if (!user) return;
    const userName = profileMap[userId]?.name || "غير معروف";

    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: "force_logout",
      severity: "warning",
      description: `تسجيل خروج إجباري للمستخدم: ${userName}`,
      metadata: { forced_by: user.id },
    });

    toast({ title: "تم التسجيل", description: `تم تسجيل خروج إجباري لـ ${userName}. يرجى ملاحظة أن هذا يسجل الحدث فقط - سيتم فصل الجلسة عند انتهاء التوكن.` });
    fetchData();
  };

  const resetTenantSecurity = async (tenantId: string) => {
    if (!user) return;
    const tenantName = tenantMap[tenantId] || "غير معروف";

    await supabase.from("security_events").insert({
      tenant_id: tenantId,
      event_type: "tenant_security_reset",
      severity: "critical",
      description: `إعادة تعيين أمان المنشأة: ${tenantName}`,
      metadata: { reset_by: user.id },
    });

    // Remove all active locks for tenant users
    const tenantProfiles = profiles.filter(p => p.tenant_id === tenantId);
    for (const p of tenantProfiles) {
      await supabase.from("account_locks").update({
        is_active: false,
        unlocked_at: new Date().toISOString(),
        unlocked_by: user.id,
      }).eq("user_id", p.id).eq("is_active", true);

      await supabase.from("profiles").update({ is_active: true }).eq("id", p.id);
    }

    toast({ title: "تم إعادة التعيين", description: `تم إعادة تعيين أمان ${tenantName}` });
    fetchData();
  };

  // ─── Export ───
  const exportAuditCSV = () => {
    const headers = ["التاريخ", "المستخدم", "المنشأة", "الإجراء", "النوع", "الكيان", "IP"];
    const rows = filteredAuditLogs.map(l => [
      new Date(l.created_at).toLocaleString("ar-SA"),
      l.user_name || "",
      l.tenant_name || "",
      ACTION_MAP[l.action] || l.action,
      ENTITY_MAP[l.entity_type] || l.entity_type,
      l.entity_label || "",
      l.ip_address || "",
    ]);

    const bom = "\uFEFF";
    const csv = bom + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم التصدير", description: `تم تصدير ${filteredAuditLogs.length} سجل` });
  };

  // ─── Filtering ───
  const filteredAuditLogs = auditLogs.filter(l => {
    const matchSearch = l.user_name?.includes(auditSearch) || l.tenant_name?.includes(auditSearch) || l.entity_label?.includes(auditSearch) || l.ip_address?.includes(auditSearch);
    const matchAction = auditAction === "all" || l.action === auditAction;
    const matchEntity = auditEntity === "all" || l.entity_type === auditEntity;
    return matchSearch && matchAction && matchEntity;
  });

  const filteredEvents = securityEvents.filter(e => {
    const matchSearch = e.user_name?.includes(eventSearch) || e.description.includes(eventSearch) || e.ip_address?.includes(eventSearch);
    const matchSeverity = eventSeverity === "all" || e.severity === eventSeverity;
    const matchType = eventType === "all" || e.event_type === eventType;
    return matchSearch && matchSeverity && matchType;
  });

  const activeLocks = accountLocks.filter(l => l.is_active);

  // ─── KPIs ───
  const totalEvents = securityEvents.length;
  const criticalEvents = securityEvents.filter(e => e.severity === "critical" && !e.is_resolved).length;
  const unresolvedEvents = securityEvents.filter(e => !e.is_resolved).length;
  const uniqueIPs = new Set([...auditLogs.map(l => l.ip_address), ...securityEvents.map(e => e.ip_address)].filter(Boolean)).size;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `منذ ${diffMin} د`;
    if (diffHr < 24) return `منذ ${diffHr} س`;
    if (diffDay < 7) return `منذ ${diffDay} ي`;
    return d.toLocaleDateString("ar-SA");
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="text-destructive" size={28} />
            مركز الأمان والتدقيق
          </h1>
          <p className="text-sm text-muted-foreground">مراقبة النشاطات وإدارة أمان المنصة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw size={16} /> تحديث
          </Button>
          <Button variant="outline" onClick={() => setLockDialog(true)} className="gap-2 text-destructive hover:text-destructive">
            <Lock size={16} /> قفل حساب
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-100 p-2"><Activity size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{auditLogs.length}</p>
              <p className="text-xs text-muted-foreground">سجلات التدقيق</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2"><ShieldAlert size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{totalEvents}</p>
              <p className="text-xs text-muted-foreground">أحداث أمنية</p>
            </div>
          </CardContent>
        </Card>
        <Card className={criticalEvents > 0 ? "border-destructive/50" : ""}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-lg p-2 ${criticalEvents > 0 ? "bg-destructive/10" : "bg-muted"}`}>
              <AlertTriangle size={20} className={criticalEvents > 0 ? "text-destructive" : "text-muted-foreground"} />
            </div>
            <div>
              <p className="text-2xl font-bold">{criticalEvents}</p>
              <p className="text-xs text-muted-foreground">حرجة غير محلولة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-100 p-2"><Lock size={20} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold">{activeLocks.length}</p>
              <p className="text-xs text-muted-foreground">حسابات مقفلة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-purple-100 p-2"><Globe size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold">{uniqueIPs}</p>
              <p className="text-xs text-muted-foreground">عناوين IP فريدة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">📋 سجل التدقيق</TabsTrigger>
          <TabsTrigger value="events">🛡️ الأحداث الأمنية</TabsTrigger>
          <TabsTrigger value="locks">🔒 الحسابات المقفلة</TabsTrigger>
          <TabsTrigger value="actions">⚡ إجراءات سريعة</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Audit Logs ─── */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="بحث في السجلات..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pr-9" />
            </div>
            <Select value={auditAction} onValueChange={setAuditAction}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الإجراءات</SelectItem>
                {Object.entries(ACTION_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={auditEntity} onValueChange={setAuditEntity}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {Object.entries(ENTITY_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportAuditCSV} className="gap-2">
              <Download size={16} /> تصدير
            </Button>
          </div>

          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الوقت</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">المنشأة</TableHead>
                    <TableHead className="text-center">الإجراء</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الكيان</TableHead>
                    <TableHead className="text-center">IP</TableHead>
                    <TableHead className="text-center">تفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatTime(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.user_name}</TableCell>
                      <TableCell className="text-sm">{log.tenant_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {ACTION_MAP[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ENTITY_MAP[log.entity_type] || log.entity_type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.entity_label || "—"}</TableCell>
                      <TableCell className="text-center">
                        {log.ip_address ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.ip_address}</code>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.changes && Object.keys(log.changes).length > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => { setDetailLog(log); setDetailDialog(true); }}>
                            <Eye size={14} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAuditLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        لا توجد سجلات
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Security Events ─── */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input placeholder="بحث في الأحداث..." value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} className="pr-9" />
            </div>
            <Select value={eventSeverity} onValueChange={setEventSeverity}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الخطورة</SelectItem>
                {Object.entries(SEVERITY_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                {Object.entries(EVENT_TYPE_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الوقت</TableHead>
                    <TableHead className="text-center">الخطورة</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-center">IP</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map(event => {
                    const sev = SEVERITY_MAP[event.severity] || SEVERITY_MAP.info;
                    const evType = EVENT_TYPE_MAP[event.event_type];

                    return (
                      <TableRow key={event.id} className={event.severity === "critical" && !event.is_resolved ? "bg-destructive/5" : ""}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatTime(event.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${sev.color}`}>{sev.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1">
                            <span>{evType?.icon || "📌"}</span>
                            <span>{evType?.label || event.event_type}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{event.user_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {event.description}
                        </TableCell>
                        <TableCell className="text-center">
                          {event.ip_address ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{event.ip_address}</code>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {event.is_resolved ? (
                            <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700">
                              <CheckCircle size={12} /> محلول
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700">
                              <Clock size={12} /> معلّق
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {!event.is_resolved && (
                            <Button size="sm" variant="ghost" onClick={() => { setResolveEvent(event); setResolveNotes(""); setResolveDialog(true); }}>
                              <CheckCircle size={14} className="text-emerald-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        لا توجد أحداث أمنية
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: Account Locks ─── */}
        <TabsContent value="locks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الحسابات المقفلة</CardTitle>
              <CardDescription>حسابات المستخدمين المقفلة حالياً وسجل القفل السابق</CardDescription>
            </CardHeader>
            <CardContent>
              {accountLocks.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">لا توجد حسابات مقفلة</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">البريد</TableHead>
                      <TableHead className="text-right">السبب</TableHead>
                      <TableHead className="text-center">تاريخ القفل</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountLocks.map(lock => (
                      <TableRow key={lock.id}>
                        <TableCell className="font-medium">{lock.user_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground" dir="ltr">{lock.user_email}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{lock.reason}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {new Date(lock.locked_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell className="text-center">
                          {lock.is_active ? (
                            <Badge variant="destructive" className="gap-1"><Lock size={12} /> مقفل</Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700">
                              <Unlock size={12} /> مفتوح
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {lock.is_active && (
                            <Button size="sm" variant="outline" onClick={() => unlockAccount(lock)} className="gap-1">
                              <Unlock size={14} /> فتح
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Quick Actions ─── */}
        <TabsContent value="actions" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Force Logout */}
            <Card className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserX size={18} className="text-amber-600" />
                  تسجيل خروج إجباري
                </CardTitle>
                <CardDescription>إنهاء جلسة مستخدم محدد</CardDescription>
              </CardHeader>
              <CardContent>
                <Select onValueChange={(v) => logForceLogout(v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المستخدم" /></SelectTrigger>
                  <SelectContent>
                    {profiles.filter(p => p.is_active).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Lock Account */}
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock size={18} className="text-destructive" />
                  قفل حساب
                </CardTitle>
                <CardDescription>منع مستخدم من الوصول للنظام</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setLockDialog(true)} className="w-full gap-2">
                  <Lock size={16} /> قفل حساب مستخدم
                </Button>
              </CardContent>
            </Card>

            {/* Reset Tenant Security */}
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck size={18} className="text-purple-600" />
                  إعادة تعيين أمان منشأة
                </CardTitle>
                <CardDescription>فتح جميع الحسابات المقفلة في منشأة</CardDescription>
              </CardHeader>
              <CardContent>
                <Select onValueChange={(v) => resetTenantSecurity(v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المنشأة" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tenantMap).map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Summary stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ملخص الأمان</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{unresolvedEvents}</p>
                  <p className="text-sm text-muted-foreground mt-1">أحداث غير محلولة</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{activeLocks.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">حسابات مقفلة نشطة</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-3xl font-bold text-foreground">{securityEvents.filter(e => e.severity === "critical").length}</p>
                  <p className="text-sm text-muted-foreground mt-1">أحداث حرجة (الكل)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Lock Account Dialog ─── */}
      <Dialog open={lockDialog} onOpenChange={setLockDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={18} className="text-destructive" /> قفل حساب مستخدم
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المستخدم</Label>
              <Select value={lockUserId} onValueChange={setLockUserId}>
                <SelectTrigger><SelectValue placeholder="اختر المستخدم" /></SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>سبب القفل</Label>
              <Textarea value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="أدخل سبب قفل الحساب..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialog(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={lockAccount} disabled={!lockUserId || !lockReason.trim()} className="gap-2">
              <Lock size={16} /> قفل الحساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Resolve Event Dialog ─── */}
      <Dialog open={resolveDialog} onOpenChange={setResolveDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>حل الحدث الأمني</DialogTitle>
          </DialogHeader>
          {resolveEvent && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm font-medium">{EVENT_TYPE_MAP[resolveEvent.event_type]?.label || resolveEvent.event_type}</p>
                <p className="text-xs text-muted-foreground">{resolveEvent.description}</p>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات الحل</Label>
                <Textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} placeholder="وصف الإجراء المتخذ..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(false)}>إلغاء</Button>
            <Button onClick={resolveSecurityEvent} className="gap-2">
              <CheckCircle size={16} /> تم الحل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Dialog ─── */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل التغييرات</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">المستخدم:</span>
                <span className="font-medium">{detailLog.user_name}</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">الإجراء:</span>
                <span>{ACTION_MAP[detailLog.action] || detailLog.action}</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">التاريخ:</span>
                <span>{new Date(detailLog.created_at).toLocaleString("ar-SA")}</span>
              </div>
              <div className="rounded-lg bg-muted p-3 overflow-auto max-h-[300px]">
                <pre className="text-xs whitespace-pre-wrap" dir="ltr">
                  {JSON.stringify(detailLog.changes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSecurityCenter;
