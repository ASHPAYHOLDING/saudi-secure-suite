import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail, Loader2, CheckCircle2, XCircle, Shield, Globe,
  Building2, Server, RefreshCw, Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SmtpProvider {
  id: string;
  scope: string;
  tenant_id: string | null;
  from_name_ar: string | null;
  from_name_en: string | null;
  from_email: string;
  reply_to: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  is_active: boolean;
  last_test_at: string | null;
  last_test_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const AdminPlatformSmtp = () => {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<SmtpProvider[]>([]);
  const [platformProvider, setPlatformProvider] = useState<SmtpProvider | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("email_providers")
      .select("*")
      .order("scope")
      .order("created_at", { ascending: false });
    
    if (data) {
      setProviders(data as any[]);
      setPlatformProvider((data as any[]).find(p => p.scope === "platform") || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tenantProviders = providers.filter(p => p.scope === "tenant");
  const activeCount = tenantProviders.filter(p => p.is_active).length;
  const failedCount = tenantProviders.filter(p => p.last_test_status === "failed").length;

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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Server className="text-accent" size={28} />
          إدارة مزودي البريد
        </h1>
        <p className="text-sm text-muted-foreground">إعداد Platform SMTP (Resend) ومراقبة مزودي البريد للشركات</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-accent/10 p-3"><Globe size={22} className="text-accent" /></div>
            <div>
              <p className="text-2xl font-bold">{platformProvider ? "1" : "0"}</p>
              <p className="text-xs text-muted-foreground">Platform SMTP</p>
            </div>
            {platformProvider?.is_active ? (
              <Badge className="ms-auto bg-emerald-100 text-emerald-700 text-xs">نشط</Badge>
            ) : (
              <Badge variant="destructive" className="ms-auto text-xs">معطل</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-blue-100 dark:bg-blue-950 p-3"><Building2 size={22} className="text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{tenantProviders.length}</p>
              <p className="text-xs text-muted-foreground">مزودي الشركات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950 p-3"><CheckCircle2 size={22} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
              <p className="text-xs text-muted-foreground">نشط</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-xl bg-red-100 dark:bg-red-950 p-3"><XCircle size={22} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
              <p className="text-xs text-muted-foreground">خطأ في الإعداد</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform SMTP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe size={18} />
            Platform SMTP (Resend)
          </CardTitle>
          <CardDescription>
            مزود البريد الافتراضي للمنصة — يُستخدم لرسائل scope=platform فقط
          </CardDescription>
        </CardHeader>
        <CardContent>
          {platformProvider ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">البريد</p>
                  <p className="font-mono text-xs">{platformProvider.from_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الخادم</p>
                  <p className="font-mono text-xs">{platformProvider.smtp_host}:{platformProvider.smtp_port}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  {platformProvider.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">نشط</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">معطل</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">آخر اختبار</p>
                  <p className="text-xs">{platformProvider.last_test_at
                    ? new Date(platformProvider.last_test_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"
                  }</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">لم يتم إعداد Platform SMTP بعد</p>
              <p className="text-xs text-muted-foreground mt-1">يُستخدم Resend API كبديل افتراضي</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Providers List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 size={18} />
              مزودي SMTP للشركات
            </CardTitle>
            <CardDescription>{tenantProviders.length} شركة قامت بإعداد SMTP خاص</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw size={14} /> تحديث
          </Button>
        </CardHeader>
        <CardContent>
          {tenantProviders.length === 0 ? (
            <div className="text-center py-8">
              <Building2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">لم تقم أي شركة بإعداد SMTP خاص بعد</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المنشأة</TableHead>
                    <TableHead className="text-right">بريد المرسل</TableHead>
                    <TableHead className="text-center">الخادم</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center">آخر اختبار</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantProviders.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono">{p.tenant_id?.substring(0, 8)}...</TableCell>
                      <TableCell className="text-xs">{p.from_email}</TableCell>
                      <TableCell className="text-center text-xs font-mono">{p.smtp_host}:{p.smtp_port}</TableCell>
                      <TableCell className="text-center">
                        {p.is_active ? (
                          p.last_test_status === "success" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">نشط</Badge>
                          ) : p.last_test_status === "failed" ? (
                            <Badge variant="destructive" className="text-xs">خطأ</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">لم يُختبر</Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs">معطل</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {p.last_test_at
                          ? new Date(p.last_test_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlatformSmtp;
