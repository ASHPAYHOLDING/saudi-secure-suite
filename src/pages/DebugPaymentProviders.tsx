import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, CheckCircle2, AlertTriangle, Circle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProviderRow {
  id: string;
  tenant_id: string;
  provider: string;
  status: string;
  webhook_secret_encrypted: string | null;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_ICON: Record<string, any> = {
  disconnected: Circle,
  connected: CheckCircle2,
  tested: CheckCircle2,
  active: CheckCircle2,
  disabled: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  disconnected: "text-muted-foreground",
  connected: "text-blue-500",
  tested: "text-amber-500",
  active: "text-green-500",
  disabled: "text-destructive",
};

const DebugPaymentProviders = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTenantId, setMyTenantId] = useState<string | null>(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const load = async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }

    const { data: member } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) { setLoading(false); return; }
    setMyTenantId(member.tenant_id);

    const { data } = await supabase
      .from("tenant_payment_providers")
      .select("*")
      .eq("tenant_id", member.tenant_id)
      .order("provider");

    setRows((data as ProviderRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🔧 تشخيص بوابات الدفع</h1>
          <p className="text-sm text-muted-foreground mt-1">حالة بوابات الدفع المرتبطة بـ tenant الحالي</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw size={14} className={cn(loading && "animate-spin")} />
          تحديث
        </Button>
      </div>

      {myTenantId && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-3">
            <p className="text-xs font-mono text-muted-foreground" dir="ltr">
              <strong>Tenant ID:</strong> {myTenantId}
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Circle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد بوابات دفع مُعدَّة بعد.</p>
            <p className="text-xs text-muted-foreground mt-1">
              اذهب إلى{" "}
              <a href="/dashboard/integrations/payments" className="text-primary underline">
                بوابات الدفع
              </a>{" "}
              لإضافة بوابتك الأولى.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {["tap", "moyasar", "hyperpay"].map((provider) => {
            const row = rows.find((r) => r.provider === provider);
            const StatusIcon = row ? STATUS_ICON[row.status] || Circle : Circle;
            const statusColor = row ? STATUS_COLOR[row.status] || "text-muted-foreground" : "text-muted-foreground";
            const webhookUrl = myTenantId
              ? `${supabaseUrl}/functions/v1/payment-webhook?provider=${provider}&tenant_id=${myTenantId}`
              : "";

            return (
              <Card key={provider} className={cn(!row && "opacity-50")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold capitalize">{provider}</CardTitle>
                    <StatusIcon size={18} className={statusColor} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {!row ? (
                    <p className="text-muted-foreground">غير مُعدَّة</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">الحالة</span>
                        <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Webhook Secret</span>
                        {row.webhook_secret_encrypted ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 size={11} /> موجود
                          </span>
                        ) : (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertTriangle size={11} /> مفقود
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">آخر اختبار</span>
                        <span className="text-foreground">
                          {row.last_tested_at
                            ? new Date(row.last_tested_at).toLocaleDateString("ar-SA")
                            : "لم يُختبر"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">آخر تحديث</span>
                        <span className="text-foreground">{new Date(row.updated_at).toLocaleDateString("ar-SA")}</span>
                      </div>
                      {webhookUrl && (
                        <div className="pt-1 border-t">
                          <p className="text-muted-foreground mb-1">Webhook URL</p>
                          <p className="font-mono text-[9px] break-all text-foreground/70 bg-muted rounded px-1.5 py-1" dir="ltr">
                            {webhookUrl}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ملخص الأمان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-green-500" />
            <span>المفاتيح مشفرة باستخدام AES-256-GCM (لا يُخزَّن plaintext)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-green-500" />
            <span>كل Webhook يتحقق من التوقيع قبل المعالجة</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-green-500" />
            <span>Idempotency عبر جدول webhook_events (لا تكرار في المعالجة)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-green-500" />
            <span>التحقق من tenant_id + المبلغ + العملة قبل تحديث الفاتورة</span>
          </div>
          {rows.some((r) => !r.webhook_secret_encrypted) && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded bg-amber-500/10">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span className="text-amber-700">
                بعض المزودين ليس لديهم Webhook Secret. أضفه لتفعيل التحقق من التوقيع.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DebugPaymentProviders;
