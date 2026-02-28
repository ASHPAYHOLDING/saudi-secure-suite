import { useState } from "react";
import { fmtCurrency } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle, TrendingDown, DollarSign, Clock, Users, RefreshCw,
  Shield, ShieldAlert, ShieldCheck, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerRisk {
  customer_id: string;
  customer_name: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  avg_payment_delay_days: number;
  overdue_ratio: number;
  dispute_frequency: number;
  invoice_size_volatility: number;
  recommended_action?: string;
}

interface CollectionsSummary {
  total_overdue: number;
  dso: number;
  expected_collections_30d: number;
  heatmap: { high: number; medium: number; low: number };
  total_customers: number;
}

const formatCurrency = (amount: number) => fmtCurrency(amount, { decimals: 0 });

const CollectionsIntelligencePage = () => {
  const { tenantId } = useAuth();
  const { t, isRTL } = useLanguage();
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["collections-intelligence", tenantId],
    queryFn: async () => {
      const { data: funcData, error } = await supabase.functions.invoke("collections-intelligence", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      // Track analytics event
      supabase.rpc("track_usage_event" as any, {
        p_tenant_id: tenantId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_event_type: "collections_viewed",
        p_route: "/dashboard/finance/collections-intelligence",
        p_category: "analytics",
        p_metadata: {},
      });
      return funcData as { customers: CustomerRisk[]; summary: CollectionsSummary };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const handleSendReminder = async (customer: CustomerRisk) => {
    setSendingReminder(customer.customer_id);
    try {
      // Determine tone based on overdue severity
      const tone = customer.avg_payment_delay_days >= 21 ? "legal"
        : customer.avg_payment_delay_days >= 14 ? "formal" : "friendly";

      await supabase.from("reminder_logs").insert({
        tenant_id: tenantId!,
        customer_id: customer.customer_id,
        tone,
        sent_by: (await supabase.auth.getUser()).data.user?.id,
      } as any);

      // Track event
      supabase.rpc("track_usage_event" as any, {
        p_tenant_id: tenantId,
        p_user_id: (await supabase.auth.getUser()).data.user?.id,
        p_event_type: "reminder_sent",
        p_route: "/dashboard/finance/collections-intelligence",
        p_category: "analytics",
        p_metadata: { customer_id: customer.customer_id, tone },
      });

      toast.success(isRTL ? "تم إرسال التذكير بنجاح" : "Reminder sent successfully");
    } catch {
      toast.error(isRTL ? "فشل إرسال التذكير" : "Failed to send reminder");
    } finally {
      setSendingReminder(null);
    }
  };

  const summary = data?.summary;
  const customers = data?.customers || [];

  const getRiskColor = (level: string) => {
    if (level === "high") return "text-destructive";
    if (level === "medium") return "text-warning";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const getRiskBg = (level: string) => {
    if (level === "high") return "bg-destructive/10 border-destructive/20";
    if (level === "medium") return "bg-warning/10 border-warning/20";
    return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800";
  };

  const getRiskIcon = (level: string) => {
    if (level === "high") return ShieldAlert;
    if (level === "medium") return Shield;
    return ShieldCheck;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "ذكاء التحصيل" : "Collections Intelligence"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "تحليل مخاطر العملاء وإدارة التحصيل الذكي" : "Customer risk analysis & smart collections management"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 me-2", isFetching && "animate-spin")} />
          {isRTL ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <DollarSign className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي المتأخرات" : "Total Overdue"}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(summary?.total_overdue || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "أيام التحصيل (DSO)" : "Days Sales Outstanding"}</p>
                <p className="text-xl font-bold text-foreground">{summary?.dso || 0} {isRTL ? "يوم" : "days"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "التحصيل المتوقع (30 يوم)" : "Expected Collections (30d)"}</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(summary?.expected_collections_30d || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/50">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي العملاء" : "Total Customers"}</p>
                <p className="text-xl font-bold text-foreground">{summary?.total_customers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Heatmap */}
      {summary?.heatmap && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? "خريطة المخاطر" : "Risk Heatmap"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className={cn("rounded-xl p-4 text-center border", getRiskBg("high"))}>
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-3xl font-bold text-destructive">{summary.heatmap.high}</p>
                <p className="text-xs text-muted-foreground mt-1">{isRTL ? "خطر مرتفع" : "High Risk"}</p>
              </div>
              <div className={cn("rounded-xl p-4 text-center border", getRiskBg("medium"))}>
                <Shield className="h-8 w-8 mx-auto mb-2 text-warning" />
                <p className="text-3xl font-bold text-warning">{summary.heatmap.medium}</p>
                <p className="text-xs text-muted-foreground mt-1">{isRTL ? "خطر متوسط" : "Medium Risk"}</p>
              </div>
              <div className={cn("rounded-xl p-4 text-center border", getRiskBg("low"))}>
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{summary.heatmap.low}</p>
                <p className="text-xs text-muted-foreground mt-1">{isRTL ? "خطر منخفض" : "Low Risk"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Risk Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">{isRTL ? "تصنيف مخاطر العملاء" : "Customer Risk Scoring"}</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{isRTL ? "لا توجد بيانات كافية" : "Not enough data"}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-start py-3 px-2 font-medium text-muted-foreground">{isRTL ? "العميل" : "Customer"}</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">{isRTL ? "درجة المخاطر" : "Risk Score"}</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">{isRTL ? "المستوى" : "Level"}</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">{isRTL ? "تأخير الدفع" : "Delay (days)"}</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">{isRTL ? "نسبة التأخر" : "Overdue %"}</th>
                    <th className="text-start py-3 px-2 font-medium text-muted-foreground">{isRTL ? "التوصية" : "Action"}</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">{isRTL ? "تذكير" : "Remind"}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((customer) => {
                      const RiskIcon = getRiskIcon(customer.risk_level);
                      return (
                        <tr key={customer.customer_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-2 font-medium text-foreground">{customer.customer_name}</td>
                          <td className="py-3 px-2 text-center">
                            <span className={cn("font-bold text-lg", getRiskColor(customer.risk_level))}>
                              {customer.risk_score}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge variant="outline" className={cn("gap-1", getRiskColor(customer.risk_level))}>
                              <RiskIcon className="h-3 w-3" />
                              {customer.risk_level === "high"
                                ? (isRTL ? "مرتفع" : "High")
                                : customer.risk_level === "medium"
                                ? (isRTL ? "متوسط" : "Medium")
                                : (isRTL ? "منخفض" : "Low")}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-center text-foreground">{customer.avg_payment_delay_days}</td>
                          <td className="py-3 px-2 text-center text-foreground">{Math.round(customer.overdue_ratio * 100)}%</td>
                          <td className="py-3 px-2 text-xs text-muted-foreground max-w-[200px]">
                            {customer.recommended_action || (isRTL ? "—" : "—")}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {(customer.risk_level === "high" || customer.risk_level === "medium") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendReminder(customer)}
                                disabled={sendingReminder === customer.customer_id}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Reminder Policy Info */}
      <Card className="border-border bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {isRTL ? "سياسة التذكير التلقائي" : "Auto Reminder Policy"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  7 {isRTL ? "أيام" : "days"}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">{isRTL ? "تذكير ودي" : "Friendly Reminder"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "رسالة تذكير لطيفة بالمبلغ المستحق" : "Gentle payment reminder"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-warning/20 text-warning">
                  14 {isRTL ? "يوم" : "days"}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">{isRTL ? "تذكير رسمي" : "Formal Notice"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "إشعار رسمي بضرورة السداد" : "Formal payment notice"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="bg-destructive/20 text-destructive">
                  21 {isRTL ? "يوم" : "days"}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">{isRTL ? "إشعار قانوني" : "Legal Notice"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "إنذار قانوني نهائي قبل اتخاذ إجراءات" : "Final legal notice before action"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CollectionsIntelligencePage;
