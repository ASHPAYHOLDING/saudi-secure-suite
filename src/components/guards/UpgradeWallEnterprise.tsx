import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2,
  Crown,
  Shield,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Phone,
  Users,
  Scale,
  FileCheck,
  Workflow,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Types ─── */
export interface ComparisonRow {
  label: string;
  professional: string | boolean;
  enterprise: string | boolean;
}

interface UpgradeWallEnterpriseProps {
  featureKey?: string;
  title?: string;
  description?: string;
  comparisonData?: ComparisonRow[];
}

/* ─── Defaults ─── */
const DEFAULT_COMPARISON: ComparisonRow[] = [
  { label: "Governance Center", professional: false, enterprise: true },
  { label: "Role Templates", professional: false, enterprise: true },
  { label: "شجرة حسابات مؤسسية", professional: false, enterprise: true },
  { label: "موافقات متعددة المستويات", professional: "محدودة", enterprise: "غير محدودة" },
  { label: "SSO + IP Restriction", professional: false, enterprise: true },
];

const VALUE_POINTS = [
  { icon: Scale, text: "مركز الحوكمة المؤسسية" },
  { icon: Users, text: "قوالب أدوار جاهزة للشركات" },
  { icon: FileCheck, text: "مراقبة الامتثال والتقارير" },
  { icon: Workflow, text: "موافقات مالية متعددة المستويات" },
  { icon: Lock, text: "SSO وتقييد عناوين IP" },
];

/* ─── Cell renderer ─── */
function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto" />;
  if (value === false) return <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

/* ─── Component ─── */
export default function UpgradeWallEnterprise({
  title = "هذه ميزة مؤسسية متقدمة",
  description = "ارتقِ بإدارة أعمالك مع باقة المؤسسات — حوكمة كاملة، أمان متقدم، وتحكّم غير محدود.",
  comparisonData = DEFAULT_COMPARISON,
}: UpgradeWallEnterpriseProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    navigate("/dashboard/subscription?upgrade=enterprise");
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl space-y-8"
      >
        {/* ── Header ── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 p-4 mx-auto">
            <Crown className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* ── Value Points ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VALUE_POINTS.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3"
            >
              <div className="shrink-0 rounded-md bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{text}</span>
            </div>
          ))}
        </div>

        {/* ── Comparison Table ── */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/60 px-4 py-3 text-sm font-semibold text-muted-foreground border-b border-border">
            <span>الميزة</span>
            <span className="text-center">احترافي</span>
            <span className="text-center flex items-center justify-center gap-1.5">
              <Building2 className="h-4 w-4 text-amber-600" />
              مؤسسي
            </span>
          </div>
          {comparisonData.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 items-center px-4 py-3 text-sm ${
                i < comparisonData.length - 1 ? "border-b border-border/50" : ""
              }`}
            >
              <span className="font-medium text-foreground">{row.label}</span>
              <div className="text-center">
                <CellValue value={row.professional} />
              </div>
              <div className="text-center">
                <CellValue value={row.enterprise} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Social Proof ── */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-primary/70" />
          <span>مصمم للشركات التي يتجاوز عدد موظفيها 10</span>
        </div>

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={handleUpgrade}
            className="gap-2 min-w-[200px] bg-gradient-to-l from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white shadow-md"
          >
            <ArrowUpCircle className="h-5 w-5" />
            الترقية إلى مؤسسي
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/dashboard/support")}
            className="gap-2 min-w-[200px]"
          >
            <Phone className="h-5 w-5" />
            تواصل مع المبيعات
          </Button>
        </div>

        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-muted-foreground"
          >
            العودة للرئيسية
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
