import { useState, useCallback, lazy, Suspense } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  BarChart3, PieChart, TrendingUp, Calendar, Building2, Filter, RefreshCw, Loader2, GitBranch,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/dashboard/PageHeader";

const ExecutiveAnalyticsDashboard = lazy(() => import("./ExecutiveAnalyticsDashboard"));
const FinancialHealthPage = lazy(() => import("./FinancialHealthPage"));
const AnalyticsPage = lazy(() => import("./AnalyticsPage"));

/* ─── Date helpers ─── */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const PRESET_RANGES: Record<string, { from: string; to: string; label: string; labelEn: string }> = {
  "7d": { from: daysAgo(7), to: daysAgo(0), label: "آخر 7 أيام", labelEn: "Last 7 days" },
  "30d": { from: daysAgo(30), to: daysAgo(0), label: "آخر 30 يوم", labelEn: "Last 30 days" },
  "90d": { from: daysAgo(90), to: daysAgo(0), label: "آخر 90 يوم", labelEn: "Last 90 days" },
  ytd: {
    from: `${new Date().getFullYear()}-01-01`,
    to: daysAgo(0),
    label: "من بداية السنة",
    labelEn: "Year to date",
  },
};

const TAB_SUBTITLES: Record<string, { ar: string; en: string }> = {
  executive: { ar: "مؤشرات مالية سريعة من البيانات المجمّعة", en: "Fast financial KPIs from pre-aggregated data" },
  "financial-health": { ar: "تقييم شامل للوضع المالي", en: "Comprehensive financial health assessment" },
  analytics: { ar: "رؤية شاملة لأداء منشأتك المالي والتشغيلي", en: "Complete view of financial and operational performance" },
};

export default function AnalyticsUnifiedPage() {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Determine initial tab from path or query
  const validTabs = ["executive", "financial-health", "analytics"];
  const pathTab = location.pathname.includes("financial-health")
    ? "financial-health"
    : location.pathname.endsWith("/analytics/executive")
      ? "executive"
      : null;
  const paramTab = searchParams.get("tab");
  const initialTab = pathTab || (validTabs.includes(paramTab || "") ? paramTab! : "executive");
  const [activeTab, setActiveTab] = useState(initialTab);

  // Shared filters
  const [preset, setPreset] = useState("30d");
  const [dateFrom, setDateFrom] = useState(PRESET_RANGES["30d"].from);
  const [dateTo, setDateTo] = useState(PRESET_RANGES["30d"].to);
  const [branchFilter, setBranchFilter] = useState("all");

  const handlePreset = (key: string) => {
    setPreset(key);
    const r = PRESET_RANGES[key];
    if (r) { setDateFrom(r.from); setDateTo(r.to); }
  };

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSearchParams(tab === "executive" ? {} : { tab }, { replace: true });
  }, [setSearchParams]);

  // Fetch branches for filter
  const { data: branches } = useQuery({
    queryKey: ["branches-filter", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const subtitle = TAB_SUBTITLES[activeTab];

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* ── Unified Header ── */}
      <PageHeader
        title={isRTL ? "التحليلات" : "Analytics"}
        description={subtitle ? (isRTL ? subtitle.ar : subtitle.en) : ""}
      />

      {/* ── Top Filter Bar ── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Quick presets */}
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "الفترة" : "Period"}</Label>
              <div className="flex gap-1.5">
                {Object.entries(PRESET_RANGES).map(([key, r]) => (
                  <Button
                    key={key}
                    variant={preset === key ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => handlePreset(key)}
                  >
                    {isRTL ? r.label : r.labelEn}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom dates */}
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "من" : "From"}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPreset(""); }}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isRTL ? "إلى" : "To"}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPreset(""); }}
                className="h-8 w-36 text-xs"
              />
            </div>

            {/* Branch filter */}
            {branches && branches.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />{isRTL ? "الفرع" : "Branch"}
                </Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "جميع الفروع" : "All branches"}</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} dir={isRTL ? "rtl" : "ltr"}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-max h-9">
            <TabsTrigger value="executive" className="text-xs gap-1.5 px-3">
              <BarChart3 className="h-3.5 w-3.5" />{isRTL ? "نظرة تنفيذية" : "Executive"}
            </TabsTrigger>
            <TabsTrigger value="financial-health" className="text-xs gap-1.5 px-3">
              <PieChart className="h-3.5 w-3.5" />{isRTL ? "الصحة المالية" : "Financial Health"}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs gap-1.5 px-3">
              <TrendingUp className="h-3.5 w-3.5" />{isRTL ? "التحليلات" : "Analytics"}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="executive" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <ExecutiveAnalyticsDashboard embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="financial-health" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <FinancialHealthPage embedded />
          </Suspense>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <AnalyticsPage embedded />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
