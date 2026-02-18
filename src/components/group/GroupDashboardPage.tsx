import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, TrendingUp, TrendingDown, DollarSign, Link2, BarChart3 } from "lucide-react";
import SubsidiaryManagement from "./SubsidiaryManagement";
import ConsolidatedPL from "./ConsolidatedPL";
import ConsolidatedBalanceSheet from "./ConsolidatedBalanceSheet";
import IntercompanyLinks from "./IntercompanyLinks";

const GroupDashboardPage = () => {
  const { tenantId, user } = useAuth();
  const { isRTL } = useLanguage();
  const [summary, setSummary] = useState<any>(null);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !user) return;

    const checkAccess = async () => {
      // Check if current tenant is a holding company (has subsidiaries)
      const { data: subs } = await supabase
        .from("tenants")
        .select("id")
        .eq("parent_tenant_id", tenantId)
        .limit(1);

      if (!subs || subs.length === 0) {
        setIsGroupAdmin(false);
        setLoading(false);
        return;
      }

      // Check group admin status
      const { data: ga } = await supabase
        .from("group_admins")
        .select("id")
        .eq("parent_tenant_id", tenantId)
        .eq("user_id", user.id)
        .maybeSingle();

      setIsGroupAdmin(!!ga);

      // Fetch summary
      if (ga) {
        const { data: summaryData } = await supabase.rpc("get_group_summary", {
          _parent_tenant_id: tenantId,
        });
        setSummary(summaryData);
      }

      setLoading(false);
    };

    checkAccess();
  }, [tenantId, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isGroupAdmin) {
    return (
      <div className="p-6" dir={isRTL ? "rtl" : "ltr"}>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {isRTL ? "لا توجد صلاحيات مجموعة" : "No Group Access"}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {isRTL
                ? "هذه الشركة ليست شركة قابضة أو ليس لديك صلاحيات إدارة المجموعة."
                : "This company is not a holding company or you don't have group admin access."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      label: isRTL ? "الشركات التابعة" : "Subsidiaries",
      value: summary?.subsidiary_count || 0,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: isRTL ? "إجمالي الموظفين" : "Total Employees",
      value: summary?.total_employees || 0,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: isRTL ? "إجمالي الإيرادات (السنة)" : "Total Revenue (YTD)",
      value: Number(summary?.total_revenue || 0).toLocaleString(),
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
      suffix: isRTL ? " ر.س" : " SAR",
    },
    {
      label: isRTL ? "إجمالي المصروفات (السنة)" : "Total Expenses (YTD)",
      value: Number(summary?.total_expenses || 0).toLocaleString(),
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30",
      suffix: isRTL ? " ر.س" : " SAR",
    },
  ];

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold">
          {isRTL ? "إدارة المجموعة" : "Group Management"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isRTL
            ? "لوحة تحكم الشركة القابضة والتقارير الموحدة"
            : "Holding company dashboard and consolidated reports"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">
                  {stat.value}
                  {stat.suffix && <span className="text-sm font-normal text-muted-foreground">{stat.suffix}</span>}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subsidiaries" dir={isRTL ? "rtl" : "ltr"}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="subsidiaries" className="gap-1.5">
            <Building2 size={14} />
            <span className="hidden sm:inline">{isRTL ? "الشركات التابعة" : "Subsidiaries"}</span>
          </TabsTrigger>
          <TabsTrigger value="pl" className="gap-1.5">
            <BarChart3 size={14} />
            <span className="hidden sm:inline">{isRTL ? "الأرباح والخسائر" : "P&L"}</span>
          </TabsTrigger>
          <TabsTrigger value="bs" className="gap-1.5">
            <DollarSign size={14} />
            <span className="hidden sm:inline">{isRTL ? "الميزانية العمومية" : "Balance Sheet"}</span>
          </TabsTrigger>
          <TabsTrigger value="intercompany" className="gap-1.5">
            <Link2 size={14} />
            <span className="hidden sm:inline">{isRTL ? "البينية" : "Intercompany"}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subsidiaries">
          <SubsidiaryManagement parentTenantId={tenantId!} />
        </TabsContent>
        <TabsContent value="pl">
          <ConsolidatedPL parentTenantId={tenantId!} />
        </TabsContent>
        <TabsContent value="bs">
          <ConsolidatedBalanceSheet parentTenantId={tenantId!} />
        </TabsContent>
        <TabsContent value="intercompany">
          <IntercompanyLinks parentTenantId={tenantId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GroupDashboardPage;
