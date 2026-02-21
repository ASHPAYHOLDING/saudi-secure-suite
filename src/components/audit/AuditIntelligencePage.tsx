import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { secureRpc } from "@/lib/secure-rpc";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as ReTooltip, Legend,
} from "recharts";
import {
  ShieldAlert, TrendingUp, Clock, AlertTriangle, Users, Activity,
  Zap, Eye, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS_OPTIONS = [
  { value: "7", label: "7 days" , labelAr: "٧ أيام" },
  { value: "14", label: "14 days", labelAr: "١٤ يوم" },
  { value: "30", label: "30 days", labelAr: "٣٠ يوم" },
  { value: "90", label: "90 days", labelAr: "٩٠ يوم" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_OF_WEEK_AR = ["إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت", "أحد"];

const AuditIntelligencePage = () => {
  const { tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [days, setDays] = useState("30");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  const daysNum = parseInt(days);

  // ── Data Fetching ──
  const { data: riskScores = [], isLoading: loadingRisk } = useQuery({
    queryKey: ["audit-risk-scores", tenantId, daysNum],
    queryFn: async () => {
      const { data, error } = await secureRpc("get_audit_risk_scores", {
        p_tenant_id: tenantId, p_days: daysNum,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: heatmapData = [] } = useQuery({
    queryKey: ["audit-heatmap", tenantId, daysNum],
    queryFn: async () => {
      const { data, error } = await secureRpc("get_audit_heatmap", {
        p_tenant_id: tenantId, p_days: daysNum,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["audit-timeline", tenantId, daysNum],
    queryFn: async () => {
      const { data, error } = await secureRpc("get_audit_timeline", {
        p_tenant_id: tenantId, p_days: daysNum,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  const { data: rapidChains = [] } = useQuery({
    queryKey: ["audit-rapid-chains", tenantId, daysNum],
    queryFn: async () => {
      const { data, error } = await secureRpc("get_rapid_approval_chains", {
        p_tenant_id: tenantId, p_days: daysNum,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!tenantId,
  });

  // Profiles for user names
  const userIds = useMemo(() => [...new Set(riskScores.map((r: any) => r.user_id))], [riskScores]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-audit", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, full_name_en, email, avatar_url")
        .in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    profiles.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const getUserName = (uid: string) => {
    const p = profileMap.get(uid);
    if (!p) return uid.slice(0, 8);
    return isRTL ? (p.full_name || p.email) : (p.full_name_en || p.full_name || p.email);
  };

  // Drill-down user activity
  const { data: userActivity = [] } = useQuery({
    queryKey: ["audit-user-activity", selectedUserId, tenantId, daysNum],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_label, created_at, ip_address")
        .eq("tenant_id", tenantId!)
        .eq("user_id", selectedUserId)
        .gte("created_at", new Date(Date.now() - daysNum * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!selectedUserId && !!tenantId,
  });

  // ── Heatmap aggregation (all users) ──
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    heatmapData.forEach((h: any) => {
      const dow = (h.day_of_week || 1) - 1; // 1=Mon
      const hour = h.hour_of_day || 0;
      if (dow >= 0 && dow < 7 && hour >= 0 && hour < 24) {
        grid[dow][hour] += h.action_count || 0;
      }
    });
    return grid;
  }, [heatmapData]);

  const maxHeatVal = useMemo(() => Math.max(1, ...heatmapGrid.flat()), [heatmapGrid]);

  const getHeatColor = (val: number) => {
    if (val === 0) return "bg-muted/30";
    const ratio = val / maxHeatVal;
    if (ratio > 0.75) return "bg-destructive/80";
    if (ratio > 0.5) return "bg-warning/70";
    if (ratio > 0.25) return "bg-primary/50";
    return "bg-primary/20";
  };

  // ── Risk level badge ──
  const getRiskBadge = (score: number) => {
    if (score >= 20) return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs">{isRTL ? "حرج" : "Critical"}</Badge>;
    if (score >= 10) return <Badge className="bg-warning/15 text-warning border-warning/30 text-xs">{isRTL ? "عالي" : "High"}</Badge>;
    if (score >= 5) return <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">{isRTL ? "متوسط" : "Medium"}</Badge>;
    return <Badge variant="secondary" className="text-xs">{isRTL ? "منخفض" : "Low"}</Badge>;
  };

  // ── Summary Stats ──
  const totalUsers = riskScores.length;
  const highRiskUsers = riskScores.filter((r: any) => r.risk_score >= 10).length;
  const spikeUsers = riskScores.filter((r: any) => r.spike_detected).length;
  const totalViolations = riskScores.reduce((a: number, r: any) => a + (r.policy_violations || 0), 0);

  const top10 = riskScores.slice(0, 10);

  const openDrillDown = (uid: string) => {
    setSelectedUserId(uid);
    setDrillDownOpen(true);
  };

  const dayLabels = isRTL ? DAYS_OF_WEEK_AR : DAYS_OF_WEEK;

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            {isRTL ? "لوحة الذكاء الرقابي" : "Audit Intelligence"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "تحليل المخاطر واكتشاف الأنماط غير الاعتيادية" : "Risk analysis and anomaly detection"}
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DAYS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{isRTL ? o.labelAr : o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "مستخدمون نشطون" : "Active Users"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{highRiskUsers}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "مستخدمون عالي المخاطر" : "High Risk Users"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/10"><Zap className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-2xl font-bold">{spikeUsers}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "ارتفاعات مفاجئة" : "Spike Detected"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/10"><ShieldAlert className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{totalViolations}</p>
                <p className="text-xs text-muted-foreground">{isRTL ? "انتهاكات السياسات" : "Policy Violations"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="risk">
        <TabsList>
          <TabsTrigger value="risk">{isRTL ? "المخاطر" : "Risk Scores"}</TabsTrigger>
          <TabsTrigger value="heatmap">{isRTL ? "خريطة النشاط" : "Activity Heatmap"}</TabsTrigger>
          <TabsTrigger value="timeline">{isRTL ? "المخطط الزمني" : "Timeline"}</TabsTrigger>
          <TabsTrigger value="rapid">
            {isRTL ? "موافقات سريعة" : "Rapid Approvals"}
            {rapidChains.length > 0 && (
              <Badge variant="destructive" className="ms-1.5 h-4 px-1 text-[10px]">{rapidChains.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Risk Scores Tab ── */}
        <TabsContent value="risk" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isRTL ? "أعلى ١٠ مستخدمين خطورة" : "Top 10 Risky Users"}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRisk ? (
                <p className="text-center text-muted-foreground py-8">{isRTL ? "جاري التحليل..." : "Analyzing..."}</p>
              ) : top10.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isRTL ? "لا توجد بيانات كافية" : "No data available"}</p>
              ) : (
                <div className="space-y-2">
                  {top10.map((r: any, i: number) => {
                    const maxScore = Math.max(1, top10[0]?.risk_score || 1);
                    const pct = Math.min(100, (r.risk_score / maxScore) * 100);
                    return (
                      <div
                        key={r.user_id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group"
                        onClick={() => openDrillDown(r.user_id)}
                      >
                        <span className="text-sm font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">{getUserName(r.user_id)}</span>
                            {getRiskBadge(r.risk_score)}
                            {r.spike_detected && (
                              <Badge variant="outline" className="text-[10px] text-warning border-warning/30 gap-0.5">
                                <TrendingUp className="h-3 w-3" />{isRTL ? "ارتفاع" : "Spike"}
                              </Badge>
                            )}
                          </div>
                          {/* Risk bar */}
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                r.risk_score >= 20 ? "bg-destructive" : r.risk_score >= 10 ? "bg-warning" : "bg-primary"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>{isRTL ? "انتهاكات" : "Violations"}: {r.policy_violations}</span>
                            <span>{isRTL ? "موافقات كبيرة" : "High-val"}: {r.high_value_approvals}</span>
                            <span>{isRTL ? "خارج الدوام" : "After-hrs"}: {r.after_hours_actions}</span>
                            <span>{isRTL ? "إجمالي" : "Total"}: {r.total_actions}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground">{r.risk_score}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Formula explanation */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-mono">
                risk_score = (policy_violations × 5) + (high_value_approvals × 2) + (after_hours_actions × 1)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Heatmap Tab ── */}
        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isRTL ? "خريطة حرارية: النشاط بالساعة واليوم" : "Activity Heatmap: Hour × Day"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Hour labels */}
                  <div className="flex items-center gap-0.5 mb-1 ps-16">
                    {HOURS.map(h => (
                      <div key={h} className="w-6 text-[9px] text-muted-foreground text-center">
                        {h.toString().padStart(2, "0")}
                      </div>
                    ))}
                  </div>
                  {/* Grid rows */}
                  {heatmapGrid.map((row, dow) => (
                    <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                      <span className="text-[10px] text-muted-foreground w-14 text-end pe-2 shrink-0">
                        {dayLabels[dow]}
                      </span>
                      <TooltipProvider>
                        {row.map((val, hour) => (
                          <Tooltip key={hour}>
                            <TooltipTrigger asChild>
                              <div className={cn("w-6 h-6 rounded-sm transition-colors", getHeatColor(val))} />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              {dayLabels[dow]} {hour.toString().padStart(2, "0")}:00 — {val} {isRTL ? "عملية" : "actions"}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </TooltipProvider>
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center gap-2 mt-3 ps-16">
                    <span className="text-[10px] text-muted-foreground">{isRTL ? "أقل" : "Less"}</span>
                    <div className="w-4 h-4 rounded-sm bg-muted/30" />
                    <div className="w-4 h-4 rounded-sm bg-primary/20" />
                    <div className="w-4 h-4 rounded-sm bg-primary/50" />
                    <div className="w-4 h-4 rounded-sm bg-warning/70" />
                    <div className="w-4 h-4 rounded-sm bg-destructive/80" />
                    <span className="text-[10px] text-muted-foreground">{isRTL ? "أكثر" : "More"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Timeline Tab ── */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{isRTL ? "المخطط الزمني للنشاط" : "Activity Timeline"}</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{isRTL ? "لا توجد بيانات" : "No data"}</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="action_date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: string) => v.slice(5)}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <ReTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      labelFormatter={(l: string) => l}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone" dataKey="total_actions" stackId="1"
                      stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)"
                      name={isRTL ? "إجمالي العمليات" : "Total Actions"}
                    />
                    <Area
                      type="monotone" dataKey="high_risk_actions" stackId="2"
                      stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.15)"
                      name={isRTL ? "عمليات خارج الدوام" : "After-Hours"}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rapid Approvals Tab ── */}
        <TabsContent value="rapid" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                {isRTL ? "موافقات سريعة (أقل من ٦٠ ثانية)" : "Rapid Approvals (< 60 seconds)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rapidChains.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">{isRTL ? "لا توجد موافقات سريعة مشبوهة" : "No suspicious rapid approvals found"}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rapidChains.map((rc: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-warning/5 border-warning/20">
                      <Zap className="h-4 w-4 text-warning shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{rc.document_type}</span>
                          <Badge variant="outline" className="text-[10px]">{rc.document_number || "—"}</Badge>
                          <Badge className="bg-warning/15 text-warning text-[10px]">
                            {Math.round(rc.approval_seconds)}s
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {isRTL ? "المبلغ:" : "Amount:"} {rc.document_amount?.toLocaleString()} |{" "}
                          {isRTL ? "بواسطة:" : "By:"} {getUserName(rc.acted_by)} |{" "}
                          {new Date(rc.acted_at).toLocaleString(isRTL ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Drill-Down Dialog ── */}
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {selectedUserId ? getUserName(selectedUserId) : ""} — {isRTL ? "سجل النشاط" : "Activity Log"}
            </DialogTitle>
          </DialogHeader>

          {/* User risk summary */}
          {selectedUserId && (() => {
            const ur = riskScores.find((r: any) => r.user_id === selectedUserId);
            if (!ur) return null;
            return (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold">{ur.risk_score}</p>
                  <p className="text-[10px] text-muted-foreground">{isRTL ? "درجة الخطر" : "Risk Score"}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-destructive/5">
                  <p className="text-lg font-bold text-destructive">{ur.policy_violations}</p>
                  <p className="text-[10px] text-muted-foreground">{isRTL ? "انتهاكات" : "Violations"}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-warning/5">
                  <p className="text-lg font-bold text-warning">{ur.high_value_approvals}</p>
                  <p className="text-[10px] text-muted-foreground">{isRTL ? "موافقات كبيرة" : "High-Val"}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-primary/5">
                  <p className="text-lg font-bold text-primary">{ur.after_hours_actions}</p>
                  <p className="text-[10px] text-muted-foreground">{isRTL ? "خارج الدوام" : "After-Hrs"}</p>
                </div>
              </div>
            );
          })()}

          {/* Activity list */}
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {userActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">{isRTL ? "لا توجد سجلات" : "No records"}</p>
            ) : userActivity.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-muted-foreground w-28 shrink-0">
                  {new Date(a.created_at).toLocaleString(isRTL ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">{a.action}</Badge>
                <span className="text-xs truncate">{a.entity_type}: {a.entity_label || a.id?.slice(0, 8)}</span>
                {a.ip_address && <span className="text-[9px] text-muted-foreground ms-auto">{a.ip_address}</span>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditIntelligencePage;
