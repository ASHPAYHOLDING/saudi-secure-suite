import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  const { user, tenantId } = useAuth();
  const location = useLocation();

  // Detect context: platform admin (/admin/*) vs tenant dashboard (/dashboard/*)
  const isPlatformContext = location.pathname.startsWith("/admin");
  const scopedTenantId = isPlatformContext ? null : tenantId;

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

    // Build scoped queries — tenant dashboard only sees own tenant data
    let logsQuery = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
    let eventsQuery = supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(500);
    let locksQuery = supabase.from("account_locks").select("*").order("locked_at", { ascending: false });
    let profilesQuery = supabase.from("profiles").select("id, full_name, email, tenant_id, is_active");
    let tenantsQuery = supabase.from("tenants").select("id, name");

    if (scopedTenantId) {
      logsQuery = logsQuery.eq("tenant_id", scopedTenantId);
      eventsQuery = eventsQuery.eq("tenant_id", scopedTenantId);
      profilesQuery = profilesQuery.eq("tenant_id", scopedTenantId);
      tenantsQuery = tenantsQuery.eq("id", scopedTenantId);
    }

    const [logsRes, eventsRes, locksRes, profilesRes, tenantsRes] = await Promise.all([
      logsQuery, eventsQuery, locksQuery, profilesQuery, tenantsQuery,
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
  }, [scopedTenantId]);

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
          <p className="text-sm text-muted-foreground">
            {isPlatformContext ? "مراقبة النشاطات وإدارة أمان المنصة" : "مراقبة النشاطات الأمنية لمنشأتك"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw size={16} /> تحديث
          </Button>
          {isPlatformContext && (
            <Button variant="outline" onClick={() => setLockDialog(true)} className="gap-2 text-destructive hover:text-destructive">
              <Lock size={16} /> قفل حساب
            </Button>
          )}
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

      <Tabs defaultValue="audit" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
          <TabsTrigger value="audit" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
            سجل التدقيق
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
            الأحداث الأمنية
            {unresolvedEvents > 0 && <Badge className="mr-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-[10px]">{unresolvedEvents}</Badge>}
          </TabsTrigger>
          {isPlatformContext && (
            <TabsTrigger value="locks" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-6">
              الحسابات المقفلة
            </TabsTrigger>
          )}
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4 pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في السجلات..."
                className="pr-9"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            <Select value={auditAction} onValueChange={setAuditAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="تصفية حسب الإجراء" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الإجراءات</SelectItem>
                {Object.entries(ACTION_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportAuditCSV} className="gap-2">
              <Download size={16} /> تصدير
            </Button>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الإجراء</TableHead>
                  <TableHead className="text-right">الكيان</TableHead>
                  <TableHead className="text-right">IP</TableHead>
                  <TableHead className="text-right">التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد نتائج</TableCell>
                  </TableRow>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{formatTime(log.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{log.user_name}</span>
                          {isPlatformContext && <span className="text-[10px] text-muted-foreground">{log.tenant_name}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {ACTION_MAP[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{ENTITY_MAP[log.entity_type] || log.entity_type}</span>
                          {log.entity_label && <span className="text-xs text-muted-foreground">({log.entity_label})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.ip_address || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailLog(log); setDetailDialog(true); }}>
                          <Eye size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Security Events Tab */}
        <TabsContent value="events" className="space-y-4 pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث في الأحداث..."
                className="pr-9"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
              />
            </div>
            <Select value={eventSeverity} onValueChange={setEventSeverity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="تصفية حسب الشدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="info">معلومات</SelectItem>
                <SelectItem value="warning">تحذير</SelectItem>
                <SelectItem value="critical">حرج</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12 border rounded-lg border-dashed text-muted-foreground">لا توجد أحداث أمنية تطابق البحث</div>
            ) : (
              filteredEvents.map((event) => {
                const SeverityIcon = SEVERITY_MAP[event.severity]?.icon || Activity;
                const severityClass = SEVERITY_MAP[event.severity]?.color || "bg-muted text-muted-foreground";
                const typeMeta = EVENT_TYPE_MAP[event.event_type] || { label: event.event_type, icon: "🛡️" };

                return (
                  <div key={event.id} className={`flex items-start justify-between rounded-lg border p-4 transition-colors ${event.is_resolved ? "bg-card opacity-70" : "bg-card shadow-sm border-l-4 border-l-accent"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full ${severityClass}`}>
                        <SeverityIcon size={18} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{typeMeta.label}</h4>
                          <Badge variant="outline" className="text-[10px]">{event.user_name}</Badge>
                          <span className="text-xs text-muted-foreground font-mono ml-2">{formatTime(event.created_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-3 pt-1">
                          {event.ip_address && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              <Globe size={10} /> {event.ip_address}
                            </div>
                          )}
                          {event.user_agent && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={event.user_agent}>
                              <Smartphone size={10} /> {event.user_agent}
                            </div>
                          )}
                        </div>
                        {event.is_resolved && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
                            <CheckCircle size={12} />
                            تم الحل بواسطة المشرف في {new Date(event.resolved_at!).toLocaleDateString("ar-SA")}
                          </div>
                        )}
                      </div>
                    </div>
                    {isPlatformContext && !event.is_resolved && (
                      <Button size="sm" variant="outline" onClick={() => { setResolveEvent(event); setResolveDialog(true); }}>
                        حل المشكلة
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Locks Tab */}
        <TabsContent value="locks" className="space-y-4 pt-4">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">السبب</TableHead>
                  <TableHead className="text-right">تاريخ القفل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountLocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد حسابات مقفلة</TableCell>
                  </TableRow>
                ) : (
                  accountLocks.map((lock) => (
                    <TableRow key={lock.id}>
                      <TableCell className="font-medium">{lock.user_name}</TableCell>
                      <TableCell className="font-mono text-xs">{lock.user_email}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={lock.reason}>{lock.reason}</TableCell>
                      <TableCell className="font-mono text-xs">{new Date(lock.locked_at).toLocaleString("ar-SA")}</TableCell>
                      <TableCell>
                        <Badge variant={lock.is_active ? "destructive" : "outline"}>
                          {lock.is_active ? "مقفول" : "تم الفتح"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lock.is_active && (
                          <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => unlockAccount(lock)}>
                            <Unlock size={14} className="ml-1" /> فتح الحساب
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lock Dialog */}
      <Dialog open={lockDialog} onOpenChange={setLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>قفل حساب مستخدم</DialogTitle>
            <DialogDescription>
              سيتم منع المستخدم من تسجيل الدخول فوراً وتسجيل خروجه من جميع الأجهزة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>المستخدم</Label>
              <Select value={lockUserId} onValueChange={setLockUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر مستخدم..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>سبب القفل</Label>
              <Textarea
                placeholder="مثال: نشاط مشبوه، طلب من الإدارة، استقالة..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialog(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={lockAccount}>تأكيد القفل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialog} onOpenChange={setResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حل حدث أمني</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-semibold mb-1">الحدث:</p>
              <p>{resolveEvent?.description}</p>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات الحل (اختياري)</Label>
              <Textarea
                placeholder="كيف تم التعامل مع هذا الحدث..."
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(false)}>إلغاء</Button>
            <Button onClick={resolveSecurityEvent}>تأكيد الحل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل السجل</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">المستخدم</Label>
                  <p className="font-medium">{detailLog.user_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">المنشأة</Label>
                  <p className="font-medium">{detailLog.tenant_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">التوقيت</Label>
                  <p className="font-mono">{new Date(detailLog.created_at).toLocaleString("ar-SA")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP Address</Label>
                  <p className="font-mono">{detailLog.ip_address || "—"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground mb-1 block">التغييرات (JSON)</Label>
                <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/50 p-4">
                  <pre className="text-xs font-mono" dir="ltr">
                    {JSON.stringify(detailLog.changes, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSecurityCenter;
