import { useEffect, useState, useMemo, useCallback } from "react";
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
  Award, PieChart, ExternalLink, Hash, Star, Globe, BarChart2,
  CreditCard, Shield, Rocket, RefreshCw, MessageCircle, FileText, Upload,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart as RePieChart, Pie,
} from "recharts";
import { useNavigate } from "react-router-dom";
import AffiliateOnboardingWizard from "./AffiliateOnboardingWizard";

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
  notes: string | null;
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

const TIER_LABELS: Record<string, { label: string; labelEn: string; icon: string; rate: string }> = {
  bronze: { label: "برونزي", labelEn: "Bronze", icon: "🥉", rate: "10%" },
  silver: { label: "فضي", labelEn: "Silver", icon: "🥈", rate: "15%" },
  gold: { label: "ذهبي", labelEn: "Gold", icon: "🥇", rate: "20%" },
  platinum: { label: "بلاتيني", labelEn: "Platinum", icon: "💎", rate: "25%" },
};

const formatAmount = (n: number) => n.toLocaleString("ar-SA");

// ── Animated KPI Card ──
const KPICard = ({ icon: Icon, title, value, suffix, trend, trendLabel, delay = 0, masked = false, onToggleMask, gradient }: {
  icon: any; title: string; value: number; suffix?: string; trend?: number; trendLabel?: string; delay?: number;
  masked?: boolean; onToggleMask?: () => void; gradient?: string;
}) => {
  const animatedValue = useCountUp(masked ? 0 : value, 600);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className={`relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg group ${gradient || ""}`}>
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

// ═══════════════════════════════════════════════════════════
// ── STATE 1: Marketing / No Affiliate ──
// ═══════════════════════════════════════════════════════════
const MarketingState = ({ userId, tenantId, userEmail, userName, onComplete }: { userId: string; tenantId: string; userEmail: string; userName: string; onComplete: () => void }) => {
  const [showWizard, setShowWizard] = useState(false);
  
  if (showWizard) {
    return (
      <AffiliateOnboardingWizard
        userId={userId}
        tenantId={tenantId}
        userEmail={userEmail}
        userName={userName}
        onComplete={onComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }
  
  const onJoin = () => setShowWizard(true);
  const benefits = [
    { icon: DollarSign, title: "عمولة شهرية مستمرة", desc: "احصل على عمولة متكررة مع كل تجديد اشتراك" },
    { icon: Globe, title: "نظام عالمي", desc: "شارك مع عملاء من أي مكان في العالم" },
    { icon: BarChart2, title: "تقارير لحظية", desc: "تابع أرباحك وإحالاتك في الوقت الفعلي" },
    { icon: CreditCard, title: "سحب أرباح بسهولة", desc: "اسحب أرباحك إلى المحفظة أو حسابك البنكي" },
  ];

  const tiers = Object.entries(TIER_LABELS);

  return (
    <div dir="rtl" className="min-h-[80vh] flex flex-col">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border border-primary/10 p-6 sm:p-10 mb-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5"
          >
            <Rocket className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 leading-tight">
            ابدأ بالربح مع برنامج شركاء نيوماكسيو
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-6 max-w-lg">
            انضم إلى شبكة شركائنا واحصل على عمولات متكررة عن كل عميل تحيله. نظام شفاف، تتبع لحظي، وسحب سهل.
          </p>
          <Button
            size="lg"
            onClick={onJoin}
            className="gap-2 text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <Star className="w-5 h-5" />
            انضم الآن
          </Button>
        </div>
        {/* Decorative elements */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full border border-primary/10 opacity-50"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute left-20 -bottom-20 w-60 h-60 rounded-full border border-accent/10 opacity-30"
        />
      </motion.div>

      {/* Benefits Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {benefits.map((b, i) => (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <Card className="border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-md h-full group">
              <CardContent className="p-5">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{b.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tier Commission Rates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              نسبة العمولة حسب المستوى
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map(([key, tier], i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-primary/10"
                >
                  <span className="text-2xl">{tier.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{tier.label}</p>
                    <p className="text-[11px] text-muted-foreground">{tier.labelEn}</p>
                  </div>
                  <span className="text-lg font-bold text-primary">{tier.rate}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ── STATE 2: Pending Review ──
// ═══════════════════════════════════════════════════════════
const PendingState = () => {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        <Card className="border-primary/20 overflow-hidden">
          <div className="h-2 bg-gradient-to-l from-primary via-accent to-primary" />
          <CardContent className="p-8">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6"
            >
              <Clock className="w-10 h-10 text-warning" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              طلبك قيد المراجعة
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              نقوم بمراجعة طلبك للانضمام لبرنامج الشركاء. عادةً ما يتم الرد خلال <span className="font-semibold text-foreground">24-48 ساعة عمل</span>.
            </p>

            <div className="space-y-3 mb-6">
              {[
                { label: "تقديم الطلب", done: true },
                { label: "مراجعة البيانات", done: false, active: true },
                { label: "تفعيل الحساب", done: false },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-start ${step.active ? "bg-warning/5 border border-warning/20" : step.done ? "bg-success/5" : "bg-muted/20"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.done ? "bg-success/10" : step.active ? "bg-warning/10" : "bg-muted/30"}`}>
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : step.active ? (
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        <Loader2 className="w-4 h-4 text-warning animate-spin" />
                      </motion.div>
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                    )}
                  </div>
                  <span className={`text-sm ${step.active ? "font-semibold text-foreground" : step.done ? "text-success" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>

            <Button
              variant="outline"
              className="gap-2 w-full"
              onClick={() => navigate("/dashboard/support/new")}
            >
              <MessageCircle className="w-4 h-4" />
              تواصل مع الدعم
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ── STATE 3: Rejected ──
// ═══════════════════════════════════════════════════════════
const RejectedState = ({ reason, onResubmit, loading: resubmitLoading }: { reason: string | null; onResubmit: () => void; loading: boolean }) => {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-[60vh] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        <Card className="border-destructive/20 overflow-hidden">
          <div className="h-2 bg-gradient-to-l from-destructive/80 to-destructive" />
          <CardContent className="p-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6"
            >
              <XCircle className="w-10 h-10 text-destructive" />
            </motion.div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              تم رفض الطلب
            </h2>
            {reason && (
              <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4 mb-6 text-start">
                <p className="text-xs font-semibold text-destructive mb-1">سبب الرفض:</p>
                <p className="text-sm text-foreground leading-relaxed">{reason}</p>
              </div>
            )}
            {!reason && (
              <p className="text-sm text-muted-foreground mb-6">
                للأسف لم تتم الموافقة على طلبك. يمكنك إعادة التقديم بعد استيفاء المتطلبات.
              </p>
            )}

            <div className="space-y-3">
              <Button
                onClick={onResubmit}
                disabled={resubmitLoading}
                className="gap-2 w-full"
              >
                {resubmitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    إعادة تقديم الطلب
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="gap-2 w-full"
                onClick={() => navigate("/dashboard/support/new")}
              >
                <MessageCircle className="w-4 h-4" />
                تواصل مع الدعم
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──
// ═══════════════════════════════════════════════════════════
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
  const [joinLoading, setJoinLoading] = useState<boolean>(false);

  // Filters
  const [commissionFilter, setCommissionFilter] = useState("all");
  const [commissionSearch, setCommissionSearch] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"wallet" | "bank_transfer">("wallet");
  const [payoutLoading, setPayoutLoading] = useState(false);

  // UTM
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
      } else {
        setAffiliate(null);
      }
    } catch (err) {
      console.error("Failed to fetch affiliate data:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!affiliate || affiliate.status !== "active") return;
    const channel = supabase
      .channel("affiliate-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_commissions", filter: `affiliate_id=eq.${affiliate.id}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "affiliate_payouts", filter: `affiliate_id=eq.${affiliate.id}` }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "affiliate_referrals", filter: `affiliate_id=eq.${affiliate.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [affiliate?.id, affiliate?.status, fetchData]);

  // Resubmit handler (join is now handled by the wizard)
  const handleResubmit = async () => {
    if (!affiliate) return;
    setJoinLoading(true);
    try {
      const { error } = await supabase.from("affiliates").update({ status: "pending", notes: null }).eq("id", affiliate.id);
      if (error) throw error;
      toast.success(isRTL ? "تم إعادة تقديم الطلب" : "Resubmitted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
    setJoinLoading(false);
  };

  // Computed
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
    const forecast = thisMonthEarnings > 0 ? Math.round(thisMonthEarnings * 1.1) : 0;
    return { totalEarnings: affiliate.total_earnings, thisMonthEarnings, pendingAmount, conversionRate, referralCount: referrals.length, forecast, trend };
  }, [affiliate, commissions, referrals]);

  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    commissions.filter(c => c.status !== "cancelled").forEach(c => {
      const key = format(new Date(c.created_at), "yyyy-MM");
      months[key] = (months[key] || 0) + c.commission_amount;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, amount]) => ({ month: format(new Date(month + "-01"), "MMM yyyy", { locale: ar }), amount }));
  }, [commissions]);

  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    commissions.forEach(c => { dist[c.status] = (dist[c.status] || 0) + 1; });
    return Object.entries(dist).map(([status, count]) => ({ name: COMMISSION_STATUS[status]?.label || status, value: count, status }));
  }, [commissions]);

  const bestCampaign = useMemo(() => {
    const campaigns: Record<string, number> = {};
    referrals.forEach(r => { const key = r.utm_campaign || "مباشر"; campaigns[key] = (campaigns[key] || 0) + 1; });
    const sorted = Object.entries(campaigns).sort(([, a], [, b]) => b - a);
    return sorted[0] ? { name: sorted[0][0], count: sorted[0][1] } : null;
  }, [referrals]);

  const filteredCommissions = useMemo(() => {
    let result = commissions;
    if (commissionFilter !== "all") result = result.filter(c => c.status === commissionFilter);
    if (commissionSearch) result = result.filter(c => c.id.includes(commissionSearch) || String(c.commission_amount).includes(commissionSearch));
    return result;
  }, [commissions, commissionFilter, commissionSearch]);

  const availableForPayout = useMemo(() =>
    commissions.filter(c => c.status === "approved").reduce((s, c) => s + c.commission_amount, 0),
  [commissions]);

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
      const { error } = await supabase.rpc("request_affiliate_payout", { _affiliate_id: affiliate.id, _method: payoutMethod });
      if (error) throw error;
      toast.success(isRTL ? "تم إرسال طلب السحب بنجاح" : "Payout request submitted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
    setPayoutLoading(false);
  };

  const exportPayoutsCSV = () => {
    if (payouts.length === 0) { toast.info("لا توجد سحوبات"); return; }
    const header = "التاريخ,المبلغ,الطريقة,الحالة";
    const rows = payouts.map(p => `${format(new Date(p.created_at), "yyyy-MM-dd")},${p.amount},${p.method === "wallet" ? "محفظة" : "تحويل بنكي"},${PAYOUT_STATUS[p.status]?.label || p.status}`);
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    toast.success("تم التصدير");
  };

  const exportCommissionsCSV = () => {
    if (filteredCommissions.length === 0) { toast.info("لا توجد عمولات"); return; }
    const header = "التاريخ,المبلغ الإجمالي,العمولة,النسبة,الحالة";
    const rows = filteredCommissions.map(c => `${format(new Date(c.created_at), "yyyy-MM-dd")},${c.gross_amount},${c.commission_amount},${c.commission_rate}%,${COMMISSION_STATUS[c.status]?.label || c.status}`);
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `commissions-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    toast.success("تم التصدير");
  };

  const PIE_COLORS = ["hsl(var(--warning))", "hsl(var(--primary))", "hsl(var(--success))", "hsl(210, 70%, 55%)", "hsl(var(--destructive))"];

  // ── LOADING ──
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

  // ── STATE ROUTING ──
  if (!affiliate) {
    return <div className="p-4 sm:p-6"><MarketingState userId={user!.id} tenantId={tenantId!} userEmail={user?.email || ""} userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || ""} onComplete={fetchData} /></div>;
  }

  if (affiliate.status === "pending") {
    return <div className="p-4 sm:p-6"><PendingState /></div>;
  }

  if (affiliate.status === "rejected") {
    return <div className="p-4 sm:p-6"><RejectedState reason={affiliate.notes} onResubmit={handleResubmit} loading={joinLoading} /></div>;
  }

  // ── STATE 4: ACTIVE DASHBOARD ──
  const tierInfo = TIER_LABELS[affiliate.tier] || TIER_LABELS.bronze;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="space-y-6 p-4 sm:p-6">
      {/* Header with gradient accent */}
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm font-semibold gap-1.5 py-1 px-3">
            {tierInfo.icon} {isRTL ? tierInfo.label : tierInfo.labelEn}
          </Badge>
          <Badge variant="outline" className="text-sm gap-1.5 py-1 px-3">
            <Hash size={14} /> {affiliate.code}
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
              <tab.icon size={16} /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ DASHBOARD ═══ */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KPICard icon={DollarSign} title={isRTL ? "إجمالي الأرباح" : "Total Earnings"} value={stats?.totalEarnings || 0} suffix={isRTL ? "ر.س" : "SAR"} delay={0} masked={masked} onToggleMask={() => setMasked(!masked)} />
            <KPICard icon={TrendingUp} title={isRTL ? "أرباح هذا الشهر" : "This Month"} value={stats?.thisMonthEarnings || 0} suffix={isRTL ? "ر.س" : "SAR"} trend={stats?.trend} trendLabel={isRTL ? "مقارنة بالشهر السابق" : "vs last month"} delay={0.05} masked={masked} />
            <KPICard icon={Clock} title={isRTL ? "قيد الانتظار" : "Pending"} value={stats?.pendingAmount || 0} suffix={isRTL ? "ر.س" : "SAR"} delay={0.1} masked={masked} />
            <KPICard icon={Target} title={isRTL ? "معدل التحويل" : "Conversion Rate"} value={stats?.conversionRate || 0} suffix="%" delay={0.15} />
            <KPICard icon={Users} title={isRTL ? "العملاء المحالين" : "Referrals"} value={stats?.referralCount || 0} delay={0.2} />
            <KPICard icon={Zap} title={isRTL ? "توقع الأرباح" : "Forecast"} value={stats?.forecast || 0} suffix={isRTL ? "ر.س" : "SAR"} delay={0.25} masked={masked} />
          </div>

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
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(val: number) => [`${formatAmount(val)} ر.س`, isRTL ? "العمولة" : "Commission"]} />
                        <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#areaGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick referral link */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card className="border-primary/10 bg-primary/[0.02]">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">{isRTL ? "رابط الإحالة الخاص بك" : "Your Referral Link"}</p>
                  <p className="text-sm font-mono text-foreground truncate" dir="ltr">{referralLink}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyText(referralLink, isRTL ? "الرابط" : "Link")} className="shrink-0 gap-1.5">
                  <Copy size={14} /> {isRTL ? "نسخ" : "Copy"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ REFERRAL TOOLS ═══ */}
        <TabsContent value="referrals" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><Link2 size={16} className="text-primary" /> {isRTL ? "رابط الإحالة" : "Referral Link"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={referralLink} readOnly className="text-xs font-mono bg-muted/30" dir="ltr" />
                    <Button size="sm" variant="outline" onClick={() => copyText(referralLink, isRTL ? "الرابط" : "Link")} className="shrink-0"><Copy size={14} /></Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><QrCode size={16} className="text-primary" /> {isRTL ? "رمز QR" : "QR Code"}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={referralLink} size={140} level="M" /></div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><ExternalLink size={16} className="text-primary" /> {isRTL ? "إنشاء روابط حملات UTM" : "UTM Campaign Builder"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">utm_source</label><Input value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="partner" dir="ltr" className="text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">utm_medium</label><Input value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="referral" dir="ltr" className="text-sm" /></div>
                  <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">utm_campaign</label><Input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="summer2025" dir="ltr" className="text-sm" /></div>
                </div>
                <div className="flex gap-2">
                  <Input value={utmLink} readOnly className="text-xs font-mono bg-muted/30" dir="ltr" />
                  <Button size="sm" variant="outline" onClick={() => copyText(utmLink, isRTL ? "رابط الحملة" : "Campaign link")} className="shrink-0"><Copy size={14} /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ═══ ANALYTICS ═══ */}
        <TabsContent value="analytics" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isRTL ? "الأداء الشهري" : "Monthly Performance"}</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(val: number) => [`${formatAmount(val)} ر.س`, isRTL ? "العمولة" : "Commission"]} />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isRTL ? "توزيع العمولات" : "Commission Distribution"}</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56 flex items-center justify-center">
                    {statusDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {statusDistribution.map((_, idx) => (<Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center">
                        <PieChart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{isRTL ? "ستظهر التحليلات هنا عند إضافة عمولات" : "Analytics will appear here"}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
          {bestCampaign && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Award className="w-6 h-6 text-primary" /></div>
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

        {/* ═══ PAYOUTS ═══ */}
        <TabsContent value="payouts" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Wallet size={16} className="text-primary" /> {isRTL ? "طلب سحب" : "Request Payout"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <span className="text-sm text-muted-foreground">{isRTL ? "المتاح للسحب" : "Available"}</span>
                  <span className="text-lg font-bold text-foreground">{formatAmount(availableForPayout)} {isRTL ? "ر.س" : "SAR"}</span>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{isRTL ? "طريقة الصرف" : "Payout Method"}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPayoutMethod("wallet")} className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${payoutMethod === "wallet" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>
                      <Wallet size={18} /> {isRTL ? "المحفظة" : "Wallet"}
                    </button>
                    <button onClick={() => setPayoutMethod("bank_transfer")} className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${payoutMethod === "bank_transfer" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/30"}`}>
                      <Building2 size={18} /> {isRTL ? "تحويل بنكي" : "Bank Transfer"}
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
                <p className="text-[11px] text-muted-foreground">{isRTL ? "الحد الأدنى للسحب: 500 ر.س • يتم المراجعة خلال 24-48 ساعة" : "Min withdrawal: 500 SAR • Review within 24-48 hours"}</p>
                <Button onClick={handleRequestPayout} disabled={availableForPayout < 500 || payoutLoading} className="w-full" size="lg">
                  {payoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><ArrowUpRight size={16} className="me-2" /> {isRTL ? `سحب ${formatAmount(availableForPayout)} ر.س` : `Withdraw ${formatAmount(availableForPayout)} SAR`}</>)}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">{isRTL ? "سجل السحوبات" : "Payout History"}</CardTitle>
              <Button size="sm" variant="outline" onClick={exportPayoutsCSV} className="gap-1.5"><Download size={14} /> CSV</Button>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{isRTL ? "ستظهر سحوباتك هنا بعد طلب أول سحب" : "Your payouts will appear here"}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((p, idx) => {
                    const st = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                    return (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
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

        {/* ═══ COMMISSION LEDGER ═══ */}
        <TabsContent value="ledger" className="space-y-4 mt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={commissionSearch} onChange={e => setCommissionSearch(e.target.value)} placeholder={isRTL ? "بحث بالمعرّف أو المبلغ..." : "Search by ID or amount..."} className="ps-9 text-sm" />
            </div>
            <Select value={commissionFilter} onValueChange={setCommissionFilter}>
              <SelectTrigger className="w-full sm:w-40"><Filter size={14} className="me-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الحالات" : "All Statuses"}</SelectItem>
                {Object.entries(COMMISSION_STATUS).map(([key, val]) => (<SelectItem key={key} value={key}>{isRTL ? val.label : val.labelEn}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCommissionsCSV} className="gap-1.5 shrink-0"><Download size={14} /> CSV</Button>
          </div>
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
                        <td colSpan={6} className="text-center py-12">
                          <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">{isRTL ? "ستظهر عمولاتك هنا تلقائياً عند تحقق المبيعات" : "Commissions will appear here automatically"}</p>
                        </td>
                      </tr>
                    ) : filteredCommissions.map((c, idx) => {
                      const st = COMMISSION_STATUS[c.status] || COMMISSION_STATUS.pending;
                      return (
                        <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: idx * 0.02 }} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
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
            <span>{isRTL ? "إجمالي العمولات:" : "Total:"} {formatAmount(filteredCommissions.reduce((s, c) => s + c.commission_amount, 0))} {isRTL ? "ر.س" : "SAR"}</span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AffiliateDashboardPage;
