import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { useCountUp } from "@/hooks/useCountUp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp, DollarSign, Users, Clock, ArrowUpRight, ArrowDownRight,
  Copy, QrCode, Link2, Filter, Search, Download, Wallet, Building2,
  CheckCircle2, XCircle, Loader2, BarChart3, Target, Zap, Eye, EyeOff,
  Calendar, Award, PieChart, ArrowRight, Plus, ExternalLink, Hash,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie,
} from "recharts";

// ── Types ──
interface AffiliateData {
  id: string;
  code: string;
  commission_rate: number;
  tier: string;
  total_earnings: number;
  total_paid: number;
  total_pending: number;
  status: string;
  bank_name: string | null;
  bank_iban: string | null;
  bank_account_name: string | null;
}

interface Commission {
  id: string;
  gross_amount: number;
  net_amount: number;
  commission_amount: number;
  commission_rate: number;
  status: string;
  created_at: string;
  locked_until: string | null;
  paid_at: string | null;
  payout_id: string | null;
}

interface Payout {
  id: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
  created_at: string;
  processed_at: string | null;
}

interface Referral {
  id: string;
  created_at: string;
  source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  referred_tenant_id: string | null;
  subscription_id: string | null;
}

// ── Status Maps ──
const COMMISSION_STATUS: Record<string, { label: string; labelEn: string; color: string }> = {
  pending: { label: "معلقة", labelEn: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
  locked: { label: "فترة تبريد", labelEn: "Cooling", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  approved: { label: "معتمدة", labelEn: "Approved", color: "bg-success/10 text-success border-success/20" },
  paid: { label: "مدفوعة", labelEn: "Paid", color: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "ملغاة", labelEn: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const PAYOUT_STATUS: Record<string, { label: string; labelEn: string; color: string }> = {
  pending: { label: "قيد المراجعة", labelEn: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
  approved: { label: "تمت الموافقة", labelEn: "Approved", color: "bg-success/10 text-success border-success/20" },
  paid: { label: "تم الصرف", labelEn: "Paid", color: "bg-primary/10 text-primary border-primary/20" },
  rejected: { label: "مرفوض", labelEn: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const TIER_LABELS: Record<string, { label: string; labelEn: string; icon: string }> = {
  bronze: { label: "برونزي", labelEn: "Bronze", icon: "🥉" },
  silver: { label: "فضي", labelEn: "Silver", icon: "🥈" },
  gold: { label: "ذهبي", labelEn: "Gold", icon: "🥇" },
  platinum: { label: "بلاتيني", labelEn: "Platinum", icon: "💎" },
};

const formatAmount = (n: number) => n.toLocaleString("ar-SA");

// ── Animated KPI Card ──
const KPICard = ({ icon: Icon, title, value, suffix, trend, trendLabel, delay = 0, masked = false, onToggleMask }: {
  icon: any; title: string; value: number; suffix?: string; trend?: number; trendLabel?: string; delay?: number;
  masked?: boolean; onToggleMask?: () => void;
}) => {
  const animatedValue = useCountUp(masked ? 0 : value, 600);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg group">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            {onToggleMask && (
              <button onClick={onToggleMask} className="text-muted-foreground hover:text-foreground transition-colors">
                {masked ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {masked ? "●●●●●" : formatAmount(animatedValue)}
            </span>
            {suffix && !masked && <span className="text-xs text-muted-foreground">{suffix}</span>}
          </div>
          {trend !== undefined && !masked && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-success" : "text-destructive"}`}>
              {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{Math.abs(trend)}%</span>
              {trendLabel && <span className="text-muted-foreground font-normal">{trendLabel}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ── Main Component ──
const AffiliateDashboardPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL, t } = useLanguage();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [masked, setMasked] = useState(true);

  // Filters
  const [commissionFilter, setCommissionFilter] = useState("all");
  const [commissionSearch, setCommissionSearch] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"wallet" | "bank_transfer">("wallet");
  const [payoutLoading, setPayoutLoading] = useState(false);

  // UTM campaign builder
  const [utmSource, setUtmSource] = useState("partner");
  const [utmMedium, setUtmMedium] = useState("referral");
  const [utmCampaign, setUtmCampaign] = useState("");

  const baseUrl = window.location.origin;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (aff) {
        setAffiliate(aff);
        const [{ data: comms }, { data: pays }, { data: refs }] = await Promise.all([
          supabase.from("affiliate_commissions").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }),
          supabase.from("affiliate_payouts").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }),
          supabase.from("affiliate_referrals").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }),
        ]);
        setCommissions(comms || []);
        setPayouts(pays || []);
        setReferrals(refs || []);
      }
    } catch (err) {
      console.error("Failed to fetch affiliate data:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!affiliate) return;
    const channel = supabase
      .channel("affiliate-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_commissions", filter: `affiliate_id=eq.${affiliate.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_payouts", filter: `affiliate_id=eq.${affiliate.id}` }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "affiliate_referrals", filter: `affiliate_id=eq.${affiliate.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [affiliate?.id, fetchData]);

  // Computed values
  const stats = useMemo(() => {
    if (!affiliate) return null;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const thisMonthEarnings = commissions
      .filter(c => new Date(c.created_at) >= thisMonth && c.status !== "cancelled")
      .reduce((s, c) => s + c.commission_amount, 0);
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthEarnings = commissions
      .filter(c => { const d = new Date(c.created_at); return d >= lastMonth && d < thisMonth && c.status !== "cancelled"; })
      .reduce((s, c) => s + c.commission_amount, 0);
    const pendingAmount = commissions
      .filter(c => ["pending", "locked", "approved"].includes(c.status))
      .reduce((s, c) => s + c.commission_amount, 0);
    const conversionRate = referrals.length > 0
      ? Math.round((referrals.filter(r => r.subscription_id).length / referrals.length) * 100)
      : 0;
    const trend = lastMonthEarnings > 0
      ? Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100)
      : thisMonthEarnings > 0 ? 100 : 0;
    // Forecast: average of last 3 months
    const forecast = thisMonthEarnings > 0 ? Math.round(thisMonthEarnings * 1.1) : 0;

    return {
      totalEarnings: affiliate.total_earnings,
      thisMonthEarnings,
      pendingAmount,
      conversionRate,
      referralCount: referrals.length,
      forecast,
      trend,
    };
  }, [affiliate, commissions, referrals]);

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    commissions.filter(c => c.status !== "cancelled").forEach(c => {
      const key = format(new Date(c.created_at), "yyyy-MM");
      months[key] = (months[key] || 0) + c.commission_amount;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({ month: format(new Date(month + "-01"), "MMM yyyy", { locale: ar }), amount }));
  }, [commissions]);

  // Status distribution for pie
  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    commissions.forEach(c => { dist[c.status] = (dist[c.status] || 0) + 1; });
    return Object.entries(dist).map(([status, count]) => ({ name: COMMISSION_STATUS[status]?.label || status, value: count, status }));
  }, [commissions]);

  // Best campaign
  const bestCampaign = useMemo(() => {
    const campaigns: Record<string, number> = {};
    referrals.forEach(r => {
      const key = r.utm_campaign || "مباشر";
      campaigns[key] = (campaigns[key] || 0) + 1;
    });
    const sorted = Object.entries(campaigns).sort(([, a], [, b]) => b - a);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [referrals]);

  // Filtered commissions
  const filteredCommissions = useMemo(() => {
    let result = commissions;
    if (commissionFilter !== "all") result = result.filter(c => c.status === commissionFilter);
    if (commissionSearch) result = result.filter(c => c.id.includes(commissionSearch) || String(c.commission_amount).includes(commissionSearch));
    return result;
  }, [commissions, commissionFilter, commissionSearch]);

  // Available for payout
  const availableForPayout = useMemo(() => {
    return commissions.filter(c => c.status === "approved").reduce((s, c) => s + c.commission_amount, 0);
  }, [commissions]);

  const referralLink = affiliate ? `${baseUrl}/auth?ref=${affiliate.code}` : "";
  const utmLink = affiliate
    ? `${baseUrl}/auth?ref=${affiliate.code}&utm_source=${utmSource}&utm_medium=${utmMedium}${utmCampaign ? `&utm_campaign=${utmCampaign}` : ""}`
    : "";

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(isRTL ? `تم نسخ ${label}` : `${label} copied`);
  };

  const handleRequestPayout = async () => {
    if (!affiliate) return;
    if (availableForPayout < 500) {
      toast.error(isRTL ? "الحد الأدنى للسحب 500 ر.س" : "Minimum withdrawal is 500 SAR");
      return;
    }
    setPayoutLoading(true);
    try {
      const { error } = await supabase.rpc("request_affiliate_payout", {
        _affiliate_id: affiliate.id,
        _method: payoutMethod,
      });
      if (error) throw error;
      toast.success(isRTL ? "تم إرسال طلب السحب بنجاح" : "Payout request submitted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to request payout");
    }
    setPayoutLoading(false);
  };

  const exportPayoutsCSV = () => {
    if (payouts.length === 0) { toast.info(isRTL ? "لا توجد سحوبات" : "No payouts"); return; }
    const header = "التاريخ,المبلغ,الطريقة,الحالة";
    const rows = payouts.map(p =>
      `${format(new Date(p.created_at), "yyyy-MM-dd")},${p.amount},${p.method === "wallet" ? "محفظة" : "تحويل بنكي"},${PAYOUT_STATUS[p.status]?.label || p.status}`
    );
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success(isRTL ? "تم التصدير" : "Exported");
  };

  const exportCommissionsCSV = () => {
    if (filteredCommissions.length === 0) { toast.info(isRTL ? "لا توجد عمولات" : "No commissions"); return; }
    const header = "التاريخ,المبلغ الإجمالي,العمولة,النسبة,الحالة";
    const rows = filteredCommissions.map(c =>
      `${format(new Date(c.created_at), "yyyy-MM-dd")},${c.gross_amount},${c.commission_amount},${c.commission_rate}%,${COMMISSION_STATUS[c.status]?.label || c.status}`
    );
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commissions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success(isRTL ? "تم التصدير" : "Exported");
  };

  const PIE_COLORS = ["hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))", "hsl(210, 70%, 55%)", "hsl(var(--destructive))"];

  if (loading) {
    return (
      <div dir="rtl" className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Award className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            {isRTL ? "لوحة الشركاء" : "Partner Dashboard"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            {isRTL ? "لم يتم تفعيل حساب الشريك الخاص بك بعد. تواصل مع الإدارة للانضمام لبرنامج الشركاء." : "Your partner account is not yet activated. Contact admin to join the partner program."}
          </p>
        </motion.div>
      </div>
    );
  }

  const tierInfo = TIER_LABELS[affiliate.tier] || TIER_LABELS.bronze;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            {isRTL ? "لوحة الشركاء" : "Partner Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "إدارة إحالاتك وأرباحك" : "Manage your referrals and earnings"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm font-semibold gap-1.5 py-1 px-3">
            {tierInfo.icon} {isRTL ? tierInfo.label : tierInfo.labelEn}
          </Badge>
          <Badge variant="outline" className="text-sm gap-1.5 py-1 px-3">
            <Hash size={14} />
            {affiliate.code}
          </Badge>
          <Badge variant="outline" className="text-sm gap-1.5 py-1 px-3">
            {affiliate.commission_rate}%
          </Badge>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-muted/50 p-1 h-auto rounded-xl">
          {[
            { value: "dashboard", label: isRTL ? "نظرة عامة" : "Overview", icon: BarChart3 },
            { value: "referrals", label: isRTL ? "أدوات الإحالة" : "Referral Tools", icon: Link2 },
            { value: "analytics", label: isRTL ? "التحليلات" : "Analytics", icon: PieChart },
            { value: "payouts", label: isRTL ? "السحوبات" : "Payouts", icon: Wallet },
            { value: "ledger", label: isRTL ? "سجل العمولات" : "Commissions", icon: DollarSign },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-2">
              <tab.icon size={16} />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══════ 1. DASHBOARD ═══════ */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KPICard icon={DollarSign} title={isRTL ? "إجمالي الأرباح" : "Total Earnings"} value={stats?.totalEarnings || 0} suffix={isRTL ? "ر.س" : "SAR"} delay={0} masked={masked} onToggleMask={() => setMasked(!masked)} />
            <KPICard icon={TrendingUp} title={isRTL ? "أرباح هذا الشهر" : "This Month"} value={stats?.thisMonthEarnings || 0} suffix={isRTL ? "ر.س" : "SAR"} trend={stats?.trend} trendLabel={isRTL ? "مقارنة بالشهر السابق" : "vs last month"} delay={0.05} masked={masked} />
            <KPICard icon={Clock} title={isRTL ? "قيد الانتظار" : "Pending"} value={stats?.pendingAmount || 0} suffix={isRTL ? "ر.س" : "SAR"} delay={0.1} masked={masked} />
            <KPICard icon={Target} title={isRTL ? "معدل التحويل" : "Conversion Rate"} value={stats?.conversionRate || 0} suffix="%" delay={0.15} />
            <KPICard icon={Users} title={isRTL ? "العملاء المحالين" : "Referrals"} value={stats?.referralCount || 0} delay={0.2} />
            <KPICard icon={Zap} title={isRTL ? "توقع الأرباح" : "Forecast"} value={stats?.forecast || 0} suffix={isRTL ? "ر.س" : "SAR"} delay={0.25} masked={masked} />
          </div>

          {/* Quick summary chart */}
          {monthlyData.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    {isRTL ? "الأرباح الشهرية" : "Monthly Earnings"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyData}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                          formatter={(val: number) => [`${formatAmount(val)} ر.س`, isRTL ? "العمولة" : "Commission"]}
                        />
                        <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#areaGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* ═══════ 2. REFERRAL TOOLS ═══════ */}
        <TabsContent value="referrals" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Referral Link */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Link2 size={16} className="text-primary" />
                    {isRTL ? "رابط الإحالة" : "Referral Link"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={referralLink} readOnly className="text-xs font-mono bg-muted/30" dir="ltr" />
                    <Button size="sm" variant="outline" onClick={() => copyText(referralLink, isRTL ? "الرابط" : "Link")} className="shrink-0">
                      <Copy size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* QR Code */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <QrCode size={16} className="text-primary" />
                    {isRTL ? "رمز QR" : "QR Code"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCodeSVG value={referralLink} size={140} level="M" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* UTM Builder */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink size={16} className="text-primary" />
                  {isRTL ? "إنشاء روابط حملات UTM" : "UTM Campaign Builder"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">utm_source</label>
                    <Input value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="partner" dir="ltr" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">utm_medium</label>
                    <Input value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="referral" dir="ltr" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">utm_campaign</label>
                    <Input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="summer2025" dir="ltr" className="text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input value={utmLink} readOnly className="text-xs font-mono bg-muted/30" dir="ltr" />
                  <Button size="sm" variant="outline" onClick={() => copyText(utmLink, isRTL ? "رابط الحملة" : "Campaign link")} className="shrink-0">
                    <Copy size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══════ 3. ANALYTICS ═══════ */}
        <TabsContent value="analytics" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Monthly chart */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {isRTL ? "الأداء الشهري" : "Monthly Performance"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                          formatter={(val: number) => [`${formatAmount(val)} ر.س`, isRTL ? "العمولة" : "Commission"]}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Status Distribution */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {isRTL ? "توزيع العمولات" : "Commission Distribution"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56 flex items-center justify-center">
                    {statusDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {statusDistribution.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد بيانات" : "No data"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Best campaign */}
          {bestCampaign && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Award className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{isRTL ? "أفضل حملة" : "Best Campaign"}</p>
                    <p className="text-lg font-bold text-foreground">{bestCampaign.name}</p>
                    <p className="text-xs text-muted-foreground">{bestCampaign.count} {isRTL ? "إحالة" : "referrals"}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* ═══════ 4. PAYOUTS ═══════ */}
        <TabsContent value="payouts" className="space-y-6 mt-0">
          {/* Request Payout */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wallet size={16} className="text-primary" />
                  {isRTL ? "طلب سحب" : "Request Payout"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <span className="text-sm text-muted-foreground">{isRTL ? "المتاح للسحب" : "Available"}</span>
                  <span className="text-lg font-bold text-foreground">{formatAmount(availableForPayout)} {isRTL ? "ر.س" : "SAR"}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{isRTL ? "طريقة الصرف" : "Payout Method"}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPayoutMethod("wallet")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${payoutMethod === "wallet" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}
                    >
                      <Wallet size={18} />
                      {isRTL ? "المحفظة" : "Wallet"}
                    </button>
                    <button
                      onClick={() => setPayoutMethod("bank_transfer")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${payoutMethod === "bank_transfer" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}
                    >
                      <Building2 size={18} />
                      {isRTL ? "تحويل بنكي" : "Bank Transfer"}
                    </button>
                  </div>
                </div>

                {payoutMethod === "bank_transfer" && affiliate.bank_iban && (
                  <div className="p-3 rounded-xl bg-muted/30 space-y-1 text-xs">
                    <p><span className="text-muted-foreground">{isRTL ? "البنك:" : "Bank:"}</span> {affiliate.bank_name}</p>
                    <p><span className="text-muted-foreground">IBAN:</span> {affiliate.bank_iban}</p>
                    <p><span className="text-muted-foreground">{isRTL ? "اسم الحساب:" : "Account:"}</span> {affiliate.bank_account_name}</p>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  {isRTL ? "الحد الأدنى للسحب: 500 ر.س • يتم المراجعة خلال 24-48 ساعة" : "Min withdrawal: 500 SAR • Review within 24-48 hours"}
                </p>

                <Button
                  onClick={handleRequestPayout}
                  disabled={availableForPayout < 500 || payoutLoading}
                  className="w-full"
                  size="lg"
                >
                  {payoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <ArrowUpRight size={16} className="me-2" />
                      {isRTL ? `سحب ${formatAmount(availableForPayout)} ر.س` : `Withdraw ${formatAmount(availableForPayout)} SAR`}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Payout History */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {isRTL ? "سجل السحوبات" : "Payout History"}
              </CardTitle>
              <Button size="sm" variant="outline" onClick={exportPayoutsCSV} className="gap-1.5">
                <Download size={14} />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{isRTL ? "لا توجد سحوبات" : "No payouts yet"}</p>
              ) : (
                <div className="space-y-2">
                  {payouts.map((p, idx) => {
                    const st = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                            {p.method === "wallet" ? <Wallet size={16} className="text-primary" /> : <Building2 size={16} className="text-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{formatAmount(p.amount)} {isRTL ? "ر.س" : "SAR"}</p>
                            <p className="text-[11px] text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy", { locale: ar })}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>{isRTL ? st.label : st.labelEn}</Badge>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ 5. COMMISSION LEDGER ═══════ */}
        <TabsContent value="ledger" className="space-y-4 mt-0">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={commissionSearch}
                onChange={e => setCommissionSearch(e.target.value)}
                placeholder={isRTL ? "بحث بالمعرّف أو المبلغ..." : "Search by ID or amount..."}
                className="ps-9 text-sm"
              />
            </div>
            <Select value={commissionFilter} onValueChange={setCommissionFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter size={14} className="me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الحالات" : "All Statuses"}</SelectItem>
                {Object.entries(COMMISSION_STATUS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{isRTL ? val.label : val.labelEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCommissionsCSV} className="gap-1.5 shrink-0">
              <Download size={14} />
              CSV
            </Button>
          </div>

          {/* Table */}
          <Card className="border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">{isRTL ? "التاريخ" : "Date"}</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">{isRTL ? "المبلغ الإجمالي" : "Gross"}</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">{isRTL ? "النسبة" : "Rate"}</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">{isRTL ? "العمولة" : "Commission"}</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">{isRTL ? "الحالة" : "Status"}</th>
                    <th className="text-start p-3 text-xs font-semibold text-muted-foreground">{isRTL ? "التبريد حتى" : "Locked Until"}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredCommissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground">{isRTL ? "لا توجد عمولات" : "No commissions"}</td>
                      </tr>
                    ) : filteredCommissions.map((c, idx) => {
                      const st = COMMISSION_STATUS[c.status] || COMMISSION_STATUS.pending;
                      return (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                        >
                          <td className="p-3 text-xs tabular-nums">{format(new Date(c.created_at), "dd/MM/yyyy")}</td>
                          <td className="p-3 text-xs tabular-nums font-medium">{formatAmount(c.gross_amount)} {isRTL ? "ر.س" : "SAR"}</td>
                          <td className="p-3 text-xs tabular-nums">{c.commission_rate}%</td>
                          <td className="p-3 text-xs tabular-nums font-bold text-primary">{formatAmount(c.commission_amount)} {isRTL ? "ر.س" : "SAR"}</td>
                          <td className="p-3"><Badge variant="outline" className={`text-[10px] ${st.color}`}>{isRTL ? st.label : st.labelEn}</Badge></td>
                          <td className="p-3 text-xs tabular-nums text-muted-foreground">{c.locked_until ? format(new Date(c.locked_until), "dd/MM/yyyy") : "—"}</td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>{filteredCommissions.length} {isRTL ? "عمولة" : "commissions"}</span>
            <span>
              {isRTL ? "إجمالي العمولات:" : "Total:"} {formatAmount(filteredCommissions.reduce((s, c) => s + c.commission_amount, 0))} {isRTL ? "ر.س" : "SAR"}
            </span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AffiliateDashboardPage;
