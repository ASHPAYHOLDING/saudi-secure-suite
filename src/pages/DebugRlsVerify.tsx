import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Shield, Copy } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface RoleSummary {
  base_role: string;
  financial_perm_count: number;
  permissions: string[] | null;
}

interface SimEntry {
  status: string;
  invoices?: boolean;
  journal_entries?: boolean;
  expenses?: boolean;
  wallet?: boolean;
  customers?: boolean;
  suppliers?: boolean;
}

interface VerifyResult {
  generated_at: string;
  overall_status: string;
  role_summary: RoleSummary[];
  unlinked_permissions: string[] | null;
  access_simulation: Record<string, SimEntry>;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك",
  admin: "مدير",
  manager: "مدير قسم",
  hr: "موارد بشرية",
  accountant: "محاسب",
  member: "موظف",
};

const EXPECTED: Record<string, string[]> = {
  owner: ["invoices.view", "customers.view", "customers.edit", "suppliers.view", "expenses.view", "journal_entries.view", "wallet.view"],
  admin: ["invoices.view", "customers.view", "customers.edit", "suppliers.view", "expenses.view", "journal_entries.view", "wallet.view"],
  accountant: ["invoices.view", "customers.view", "customers.edit", "suppliers.view", "expenses.view", "journal_entries.view", "wallet.view"],
  manager: ["invoices.view", "customers.view", "customers.edit", "expenses.view", "suppliers.view"],
  hr: [],
  member: [],
};

export default function DebugRlsVerify() {
  const [data, setData] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.rpc("verify_permissions_seed" as any);
      if (err) throw err;
      setData(result as unknown as VerifyResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const isPass = data?.overall_status === "ALL PASS";

  return (
    <div className="min-h-screen bg-background p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">تحقق توزيع الصلاحيات (RLS Verify)</h1>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                toast.success("تم نسخ التقرير");
              }}
            >
              <Copy className="h-4 w-4 ml-2" />
              نسخ JSON
            </Button>
          )}
          <Button onClick={fetchReport} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 ml-2 ${loading ? "animate-spin" : ""}`} />
            تحديث التقرير
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Overall Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                {isPass ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
                الحالة العامة: {isPass ? "جميع الاختبارات ناجحة ✅" : "يوجد إخفاقات ⚠️"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              تم التوليد: {new Date(data.generated_at).toLocaleString("ar-SA")}
            </CardContent>
          </Card>

          {/* Before/After Table */}
          <Card>
            <CardHeader><CardTitle>جدول توزيع الصلاحيات المالية (Before → After)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-right p-2 font-medium text-muted-foreground">الدور</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">قبل (Before)</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">بعد (After)</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">العدد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["owner", "admin", "accountant", "manager", "hr", "member"].map((role) => {
                      const summary = data.role_summary.find(r => r.base_role === role);
                      const perms = summary?.permissions?.filter(Boolean) ?? [];
                      const beforePerms = role === "member" ? "invoices, customers, suppliers, expenses" :
                        role === "hr" ? "customers, suppliers, expenses" :
                        role === "manager" ? "invoices, customers, suppliers, expenses" :
                        "invoices, customers, suppliers, expenses";
                      return (
                        <tr key={role} className="border-b border-border/50">
                          <td className="p-2 font-medium">
                            {ROLE_LABELS[role] || role}
                            <span className="text-xs text-muted-foreground mr-1">({role})</span>
                          </td>
                          <td className="p-2 text-center text-xs text-muted-foreground">{beforePerms}</td>
                          <td className="p-2 text-center">
                            {perms.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {perms.map(p => (
                                  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">لا صلاحيات مالية</span>
                            )}
                          </td>
                          <td className="p-2 text-center font-mono">{summary?.financial_perm_count ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Access Simulation */}
          <Card>
            <CardHeader><CardTitle>محاكاة الوصول (Access Simulation)</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.access_simulation).map(([role, sim]) => (
                  <Card key={role} className={`border ${sim.status === "PASS" ? "border-success/30" : "border-destructive/30"}`}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ROLE_LABELS[role] || role}</span>
                        <Badge variant={sim.status === "PASS" ? "default" : "destructive"}>
                          {sim.status}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {Object.entries(sim).filter(([k]) => k !== "status").map(([key, val]) => (
                          <div key={key} className="flex items-center gap-1">
                            {val ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                            <span>{key}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Unlinked Permissions */}
          {data.unlinked_permissions && data.unlinked_permissions.length > 0 && (
            <Card className="border-warning">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  صلاحيات غير موزعة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {data.unlinked_permissions.map(p => (
                    <Badge key={p} variant="destructive">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
