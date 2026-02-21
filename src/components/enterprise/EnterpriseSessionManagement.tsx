import { useEffect, useState, useCallback } from "react";
import {
  Monitor, Smartphone, Globe, Clock, ShieldOff, ShieldCheck,
  Loader2, RefreshCw, AlertTriangle, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface Session {
  id: string;
  user_id: string;
  ip_address: string | null;
  device_info: Record<string, any> | null;
  last_activity_at: string;
  created_at: string;
  revoked: boolean;
}

const EnterpriseSessionManagement = () => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("active_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("revoked", false)
      .order("last_activity_at", { ascending: false });
    if (!error && data) {
      setSessions(data as unknown as Session[]);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    const { error } = await supabase
      .from("active_sessions")
      .update({ revoked: true })
      .eq("id", sessionId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تم إلغاء الجلسة" : "Session revoked");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
    setRevoking(null);
  };

  const revokeAllSessions = async () => {
    if (!tenantId || !user) return;
    setRevokingAll(true);
    const { error } = await supabase
      .from("active_sessions")
      .update({ revoked: true })
      .eq("tenant_id", tenantId)
      .eq("revoked", false)
      .neq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تم إلغاء جميع الجلسات" : "All sessions revoked");
      setSessions((prev) => prev.filter((s) => s.user_id === user.id));
    }
    setRevokingAll(false);
  };

  const getDeviceIcon = (info: Record<string, any> | null) => {
    const ua = info?.user_agent || info?.userAgent || "";
    if (/mobile|android|iphone/i.test(ua)) return <Smartphone className="h-4 w-4 text-muted-foreground" />;
    return <Monitor className="h-4 w-4 text-muted-foreground" />;
  };

  const getDeviceLabel = (info: Record<string, any> | null) => {
    if (!info) return isRTL ? "غير معروف" : "Unknown";
    const ua = info.user_agent || info.userAgent || "";
    if (/chrome/i.test(ua)) return "Chrome";
    if (/firefox/i.test(ua)) return "Firefox";
    if (/safari/i.test(ua)) return "Safari";
    if (/edge/i.test(ua)) return "Edge";
    return ua.slice(0, 30) || (isRTL ? "غير معروف" : "Unknown");
  };

  const activeSessions = sessions.length;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRTL ? "إدارة الجلسات" : "Session Management"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "مراقبة وإدارة الجلسات النشطة لجميع المستخدمين" : "Monitor and manage active sessions for all users"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {activeSessions} {isRTL ? "جلسة نشطة" : "active"}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 me-1.5 ${loading ? "animate-spin" : ""}`} />
            {isRTL ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Sessions Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-4 flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base">{isRTL ? "الجلسات النشطة" : "Active Sessions"}</CardTitle>
                <CardDescription>{isRTL ? "جميع الجلسات النشطة حالياً في المؤسسة" : "All currently active sessions in the organization"}</CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={activeSessions <= 1 || revokingAll}>
                    <ShieldOff className="h-3.5 w-3.5 me-1.5" />
                    {isRTL ? "إلغاء الكل" : "Revoke All"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{isRTL ? "إلغاء جميع الجلسات؟" : "Revoke all sessions?"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isRTL
                        ? "سيتم إلغاء جميع الجلسات النشطة ما عدا جلستك الحالية. لا يمكن التراجع."
                        : "All active sessions except yours will be revoked. This cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{isRTL ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction onClick={revokeAllSessions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {revokingAll && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
                      {isRTL ? "إلغاء الجميع" : "Revoke All"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mb-3" />
                  <p className="text-sm">{isRTL ? "لا توجد جلسات نشطة" : "No active sessions"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRTL ? "المستخدم" : "User"}</TableHead>
                        <TableHead>{isRTL ? "الجهاز" : "Device"}</TableHead>
                        <TableHead>{isRTL ? "عنوان IP" : "IP Address"}</TableHead>
                        <TableHead>{isRTL ? "آخر نشاط" : "Last Activity"}</TableHead>
                        <TableHead className="text-end">{isRTL ? "إجراء" : "Action"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => {
                        const isCurrentUser = session.user_id === user?.id;
                        return (
                          <TableRow key={session.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono truncate max-w-[120px]">
                                  {session.user_id.slice(0, 8)}…
                                </span>
                                {isCurrentUser && (
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    {isRTL ? "أنت" : "You"}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getDeviceIcon(session.device_info)}
                                <span className="text-sm">{getDeviceLabel(session.device_info)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-mono">{session.ip_address || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">
                                  {formatDistanceToNow(new Date(session.last_activity_at), {
                                    addSuffix: true,
                                    locale: isRTL ? ar : enUS,
                                  })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => revokeSession(session.id)}
                                disabled={revoking === session.id}
                              >
                                {revoking === session.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <ShieldOff className="h-3.5 w-3.5 me-1" />
                                    {isRTL ? "إلغاء" : "Revoke"}
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">{isRTL ? "الإلغاء التلقائي للجلسات" : "Automatic Session Revocation"}</p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "يتم إلغاء الجلسات تلقائياً عند تجاوز مهلة الجلسة المحددة في السياسات الأمنية. يمكنك تعديل المهلة من صفحة السياسات الأمنية."
                      : "Sessions are automatically revoked when the timeout defined in Security Policies is exceeded. You can adjust the timeout from the Security Policies page."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default EnterpriseSessionManagement;
