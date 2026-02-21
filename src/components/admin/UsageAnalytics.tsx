import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Eye, EyeOff, Clock, Users, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface UsageSummary {
  route: string;
  category: string | null;
  view_count: number;
  unique_users: number;
  unique_tenants: number;
  last_used: string;
}

// All known routes for zero-usage detection
const ALL_KNOWN_ROUTES = [
  "/dashboard", "/dashboard/invoices", "/dashboard/expenses", "/dashboard/clients",
  "/dashboard/products", "/dashboard/reports", "/dashboard/settings",
  "/dashboard/contracts", "/dashboard/stamps", "/dashboard/stock",
  "/dashboard/payments", "/dashboard/receipts", "/dashboard/journal",
  "/dashboard/budget", "/dashboard/cost-centers", "/dashboard/projects",
  "/dashboard/hr", "/dashboard/pos", "/dashboard/ecommerce",
  "/admin", "/admin/companies", "/admin/subscriptions", "/admin/users",
  "/admin/features", "/admin/security", "/admin/finance",
  "/admin/templates", "/admin/email-templates", "/admin/email-center",
  "/admin/ai", "/admin/infrastructure", "/admin/platform-health",
  "/admin/monitoring", "/admin/paylink-fees", "/admin/paylink-management",
  "/admin/support", "/admin/wallet-requests", "/admin/discount-codes",
  "/admin/affiliates", "/admin/integrations/docs", "/admin/system/full-audit",
  "/admin/system/usage",
];

const UsageAnalytics = () => {
  const [days, setDays] = useState(7);

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["usage-summary", days],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_usage_summary", { p_days: days });
      if (error) throw error;
      return (data || []) as UsageSummary[];
    },
  });

  // Tenant-type and role breakdown from raw events
  const { data: breakdownData = [] } = useQuery({
    queryKey: ["usage-breakdown", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("app_usage_events" as any)
        .select("route, tenant_id, user_id, category, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const usedRoutes = new Set(summary.map((s) => s.route));
  const zeroUsageRoutes = ALL_KNOWN_ROUTES.filter((r) => !usedRoutes.has(r));

  const totalViews = summary.reduce((s, r) => s + r.view_count, 0);
  const totalUniqueUsers = new Set(breakdownData.map((e: any) => e.user_id)).size;
  const totalUniqueTenants = new Set(breakdownData.filter((e: any) => e.tenant_id).map((e: any) => e.tenant_id)).size;

  // Category aggregation
  const categoryMap: Record<string, number> = {};
  for (const row of summary) {
    const cat = row.category || "other";
    categoryMap[cat] = (categoryMap[cat] || 0) + row.view_count;
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">تحليلات الاستخدام</h1>
        </div>
        <Badge variant="outline" className="text-xs">
          بدون بيانات شخصية
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Eye className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalViews}</p>
              <p className="text-xs text-muted-foreground">إجمالي المشاهدات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalUniqueUsers}</p>
              <p className="text-xs text-muted-foreground">مستخدمين فريدين</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-accent-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalUniqueTenants}</p>
              <p className="text-xs text-muted-foreground">شركات فريدة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <EyeOff className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{zeroUsageRoutes.length}</p>
              <p className="text-xs text-muted-foreground">صفحات بدون استخدام</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="top" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top" onClick={() => setDays(7)}>أعلى 7 أيام</TabsTrigger>
          <TabsTrigger value="top30" onClick={() => setDays(30)}>أعلى 30 يوم</TabsTrigger>
          <TabsTrigger value="zero">بدون استخدام</TabsTrigger>
          <TabsTrigger value="categories">حسب القسم</TabsTrigger>
        </TabsList>

        <TabsContent value="top" className="space-y-4">
          <TopPagesTable data={summary} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="top30" className="space-y-4">
          <TopPagesTable data={summary} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="zero" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">صفحات بدون أي زيارة ({days} يوم)</CardTitle>
            </CardHeader>
            <CardContent>
              {zeroUsageRoutes.length === 0 ? (
                <p className="text-muted-foreground text-sm">جميع الصفحات تم زيارتها ✅</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {zeroUsageRoutes.map((r) => (
                    <div key={r} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                      <EyeOff className="h-4 w-4 text-destructive shrink-0" />
                      <code className="text-xs">{r}</code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الاستخدام حسب القسم</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(categoryMap)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="font-medium capitalize">{cat}</span>
                      <div className="flex items-center gap-3">
                        <div className="h-2 rounded-full bg-primary/20 w-32">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.min(100, (count / totalViews) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-left">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const TopPagesTable = ({ data, isLoading }: { data: UsageSummary[]; isLoading: boolean }) => (
  <Card>
    <CardContent className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المسار</TableHead>
            <TableHead>القسم</TableHead>
            <TableHead className="text-center">المشاهدات</TableHead>
            <TableHead className="text-center">مستخدمين</TableHead>
            <TableHead className="text-center">شركات</TableHead>
            <TableHead>آخر استخدام</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                جاري التحميل...
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                لا توجد بيانات بعد
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={i}>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.route}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{row.category || "—"}</Badge>
                </TableCell>
                <TableCell className="text-center font-semibold">{row.view_count}</TableCell>
                <TableCell className="text-center">{row.unique_users}</TableCell>
                <TableCell className="text-center">{row.unique_tenants}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {row.last_used
                      ? formatDistanceToNow(new Date(row.last_used), { addSuffix: true, locale: ar })
                      : "—"}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

export default UsageAnalytics;
