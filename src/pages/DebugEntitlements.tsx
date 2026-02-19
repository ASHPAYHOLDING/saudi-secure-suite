import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { FEATURE_KEYS } from "@/lib/entitlement-types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

const allFeatureKeys = Object.values(FEATURE_KEYS);

const DebugEntitlements = () => {
  const {
    tenantId,
    fetchedAt,
    planSlug,
    planStatus,
    entitlementsMap,
    loading,
    isTrial,
    error,
    fetchCount,
    invalidate,
  } = useEntitlementsContext();

  const responseKeys = Object.keys(entitlementsMap);
  const missingKeys = allFeatureKeys.filter((k) => !responseKeys.includes(k));

  return (
    <div dir="rtl" className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">🔍 تشخيص الصلاحيات</h1>
        <Button size="sm" variant="outline" onClick={invalidate} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          إعادة جلب
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Tenant ID</p>
            <p className="text-sm font-mono break-all">{tenantId || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">الباقة</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">{planSlug || "—"}</p>
              <Badge variant={planStatus === "active" ? "default" : "destructive"} className="text-[10px]">
                {planStatus || "unknown"}
              </Badge>
              {isTrial && <Badge variant="secondary" className="text-[10px]">تجريبي</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">آخر جلب</p>
            <p className="text-sm font-mono">
              {fetchedAt ? new Date(fetchedAt).toLocaleTimeString("ar-SA") : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              عدد مرات الجلب: {fetchCount} | الحالة: {loading ? "⏳ جارٍ..." : error ? "❌ خطأ" : "✅ جاهز"}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm text-destructive font-mono">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Entitlements Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            قائمة الميزات
            <Badge variant="secondary" className="text-[10px]">
              {responseKeys.length} في الاستجابة / {allFeatureKeys.length} في الكود
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-start py-2 pe-3">المفتاح</th>
                  <th className="text-start py-2 pe-3">الحالة</th>
                  <th className="text-start py-2 pe-3">السبب</th>
                  <th className="text-start py-2 pe-3">الحد</th>
                  <th className="text-start py-2">الباقة</th>
                </tr>
              </thead>
              <tbody>
                {allFeatureKeys.map((key) => {
                  const entry = entitlementsMap[key];
                  const inResponse = !!entry;
                  return (
                    <tr
                      key={key}
                      className={`border-b border-border/20 hover:bg-muted/30 ${
                        !inResponse ? "bg-destructive/5" : ""
                      }`}
                    >
                      <td className="py-2 pe-3 font-mono text-xs">{key}</td>
                      <td className="py-2 pe-3">
                        {!inResponse ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <AlertTriangle size={12} />
                            <span className="text-[10px]">مفقود</span>
                          </div>
                        ) : entry.allowed ? (
                          <div className="flex items-center gap-1 text-accent">
                            <CheckCircle2 size={12} />
                            <span className="text-[10px]">مسموح</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-destructive">
                            <XCircle size={12} />
                            <span className="text-[10px]">محظور</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pe-3 text-xs text-muted-foreground">
                        {entry?.reason || "—"}
                      </td>
                      <td className="py-2 pe-3 text-xs font-mono">
                        {entry?.limit != null ? entry.limit : "—"}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {entry?.plan || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Missing Keys Warning */}
      {missingKeys.length > 0 && (
        <Card className="border-muted">
        <CardHeader className="pb-2">
            <CardTitle className="text-sm text-warning flex items-center gap-2">
              <AlertTriangle size={14} />
              مفاتيح مفقودة من الاستجابة ({missingKeys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              هذه المفاتيح موجودة في الكود (FEATURE_KEYS) لكن غير موجودة في استجابة الـ RPC.
              قد تكون غير مضافة في plan_entitlements أو أن اسم المفتاح مختلف.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missingKeys.map((k) => (
                <Badge key={k} variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                  {k}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DebugEntitlements;
