import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Building2, Crown, Shield, CheckCircle2, XCircle,
  ArrowUpCircle, Phone, Users, Scale, FileCheck,
  Workflow, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export interface ComparisonRow {
  labelAr: string;
  labelEn: string;
  professional: string | boolean;
  enterprise: string | boolean;
}

interface UpgradeWallEnterpriseProps {
  featureKey?: string;
  title?: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  comparisonData?: ComparisonRow[];
}

const DEFAULT_COMPARISON: ComparisonRow[] = [
  { labelAr: "مركز الحوكمة", labelEn: "Governance Center", professional: false, enterprise: true },
  { labelAr: "قوالب الأدوار", labelEn: "Role Templates", professional: false, enterprise: true },
  { labelAr: "شجرة حسابات مؤسسية", labelEn: "Enterprise COA", professional: false, enterprise: true },
  { labelAr: "موافقات متعددة المستويات", labelEn: "Multi-level Approvals", professional: "محدودة", enterprise: "غير محدودة" },
  { labelAr: "SSO + تقييد IP", labelEn: "SSO + IP Restriction", professional: false, enterprise: true },
];

const VALUE_POINTS = [
  { icon: Scale, ar: "مركز الحوكمة المؤسسية", en: "Enterprise Governance Center" },
  { icon: Users, ar: "قوالب أدوار جاهزة للشركات", en: "Ready-made Corporate Role Templates" },
  { icon: FileCheck, ar: "مراقبة الامتثال والتقارير", en: "Compliance Monitoring & Reports" },
  { icon: Workflow, ar: "موافقات مالية متعددة المستويات", en: "Multi-level Financial Approvals" },
  { icon: Lock, ar: "SSO وتقييد عناوين IP", en: "SSO & IP Restrictions" },
];

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) return <CheckCircle2 className="h-5 w-5 text-success mx-auto" />;
  if (value === false) return <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
};

export default function UpgradeWallEnterprise({
  title = "هذه ميزة مؤسسية متقدمة",
  titleEn = "This is an Advanced Enterprise Feature",
  description = "ارتقِ بإدارة أعمالك مع باقة المؤسسات — حوكمة كاملة، أمان متقدم، وتحكّم غير محدود.",
  descriptionEn = "Elevate your business with the Enterprise plan — full governance, advanced security, and unlimited control.",
  comparisonData = DEFAULT_COMPARISON,
}: UpgradeWallEnterpriseProps) {
  const navigate = useNavigate();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const reduced = useReducedMotion();

  const handleUpgrade = () => navigate("/dashboard/subscription?upgrade=enterprise");

  const Wrapper = reduced ? ("div" as any) : motion.div;
  const fadeProps = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut", delay },
  };

  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-10">
      <Wrapper {...fadeProps()} className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20 p-4 mx-auto">
            <Crown className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {isAr ? title : titleEn}
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            {isAr ? description : descriptionEn}
          </p>
        </div>

        {/* Value Points */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VALUE_POINTS.map(({ icon: Icon, ar, en }) => (
            <div key={ar} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
              <div className="shrink-0 rounded-md bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{isAr ? ar : en}</span>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/60 px-4 py-3 text-sm font-semibold text-muted-foreground border-b border-border">
            <span>{isAr ? "الميزة" : "Feature"}</span>
            <span className="text-center">{isAr ? "احترافي" : "Professional"}</span>
            <span className="text-center flex items-center justify-center gap-1.5">
              <Building2 className="h-4 w-4 text-amber-600" />
              {isAr ? "مؤسسي" : "Enterprise"}
            </span>
          </div>
          {comparisonData.map((row, i) => (
            <div
              key={row.labelAr}
              className={`grid grid-cols-3 items-center px-4 py-3 text-sm ${
                i < comparisonData.length - 1 ? "border-b border-border/50" : ""
              }`}
            >
              <span className="font-medium text-foreground">{isAr ? row.labelAr : row.labelEn}</span>
              <div className="text-center"><CellValue value={row.professional} /></div>
              <div className="text-center"><CellValue value={row.enterprise} /></div>
            </div>
          ))}
        </div>

        {/* Social Proof */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-primary/70" />
          <span>{isAr ? "مصمم للشركات التي يتجاوز عدد موظفيها 10" : "Designed for companies with 10+ employees"}</span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={handleUpgrade}
            className="gap-2 min-w-[200px] bg-gradient-to-l from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white shadow-md"
          >
            <ArrowUpCircle className="h-5 w-5" />
            {isAr ? "الترقية إلى مؤسسي" : "Upgrade to Enterprise"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/dashboard/support")}
            className="gap-2 min-w-[200px]"
          >
            <Phone className="h-5 w-5" />
            {isAr ? "تواصل مع المبيعات" : "Contact Sales"}
          </Button>
        </div>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground">
            {isAr ? "العودة للرئيسية" : "Back to Dashboard"}
          </Button>
        </div>
      </Wrapper>
    </div>
  );
}
