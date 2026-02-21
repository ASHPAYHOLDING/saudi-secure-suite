/**
 * EnterpriseUpgradeWall — compelling upgrade prompt for enterprise features.
 * Can be used standalone or inline (compact mode).
 */
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { motion } from "framer-motion";
import {
  Shield, Lock, Globe, Activity, Users, Scale,
  Crown, CheckCircle2, ArrowUpRight, Zap, Building2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Props {
  /** Compact mode for inline usage inside other pages */
  compact?: boolean;
  /** Which feature triggered the wall (for contextual copy) */
  featureContext?: string;
}

const ENTERPRISE_FEATURES = [
  {
    icon: Scale,
    titleAr: "فصل المهام",
    titleEn: "Segregation of Duties",
    descAr: "لا يمكن لنفس الشخص إنشاء واعتماد نفس المعاملة",
    descEn: "Same person cannot create and approve the same transaction",
  },
  {
    icon: Globe,
    titleAr: "تقييد IP",
    titleEn: "IP Restrictions",
    descAr: "قيّد الوصول لشبكة مكتبك فقط",
    descEn: "Restrict access to your office network only",
  },
  {
    icon: Activity,
    titleAr: "مراقبة الجلسات",
    titleEn: "Session Monitoring",
    descAr: "تتبع وإنهاء الجلسات النشطة لحظياً",
    descEn: "Track and revoke active sessions in real-time",
  },
  {
    icon: Crown,
    titleAr: "قوالب أدوار مؤسسية",
    titleEn: "Corporate Role Templates",
    descAr: "CFO، مدقق داخلي، مسؤول امتثال — بنقرة واحدة",
    descEn: "CFO, Internal Auditor, Compliance Officer — one click",
  },
  {
    icon: Lock,
    titleAr: "موافقة مزدوجة",
    titleEn: "Dual Approval",
    descAr: "معاملات عالية القيمة تتطلب موافقتين مختلفتين",
    descEn: "High-value transactions require two different approvals",
  },
  {
    icon: Shield,
    titleAr: "تدقيق بمعايير SOCPA",
    titleEn: "SOCPA-ready Audit",
    descAr: "تصدير سجلات تدقيق بتنسيق يقبله المراجعون",
    descEn: "Export audit logs in auditor-accepted format",
  },
];

const SOCIAL_PROOF = [
  { ar: "أكثر من 500 سياسة حوكمة مُفعّلة", en: "500+ governance policies active" },
  { ar: "99.9% وقت تشغيل مضمون", en: "99.9% guaranteed uptime" },
  { ar: "متوافق مع متطلبات هيئة السوق المالية", en: "CMA compliance ready" },
];

const EnterpriseUpgradeWall = ({ compact = false, featureContext }: Props) => {
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-accent/20 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
          <CardContent className="relative pt-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  <h3 className="font-bold text-lg">
                    {isRTL ? "حوكمة على مستوى المؤسسات" : "Enterprise-Grade Governance"}
                  </h3>
                  <Badge className="enterprise-indicator border-accent/25 text-accent text-[9px] px-1.5 py-0">
                    Enterprise
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isRTL
                    ? "ارفع مستوى الأمان والامتثال في منشأتك مع أدوات حوكمة بمعايير SAP — بسعر سعودي."
                    : "Elevate your organization's security and compliance with SAP-grade governance tools — at a Saudi price."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ENTERPRISE_FEATURES.slice(0, 3).map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
                      <span>{isRTL ? f.titleAr : f.titleEn}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                size="lg"
                className="shrink-0 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => navigate("/dashboard/subscription")}
              >
                {isRTL ? "تواصل مع المبيعات" : "Contact Sales"}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Full-page upgrade wall
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center enterprise-shadow">
            <Building2 className="h-8 w-8 text-accent" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isRTL ? "حوكمة مؤسسية بمعايير عالمية" : "World-Class Enterprise Governance"}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {isRTL
            ? "نفس أدوات الحوكمة التي تستخدمها الشركات الكبرى مع SAP و Oracle — الآن متاحة لك في نيوماكسيو بجزء من التكلفة."
            : "The same governance tools used by enterprises with SAP & Oracle — now available in Numaxio at a fraction of the cost."}
        </p>

        {featureContext && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm">
            <Lock className="h-4 w-4" />
            {isRTL
              ? `"${featureContext}" متاحة في باقة المؤسسات فقط`
              : `"${featureContext}" is available in Enterprise plan only`}
          </div>
        )}
      </motion.div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ENTERPRISE_FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <h3 className="font-semibold text-sm">
                      {isRTL ? feature.titleAr : feature.titleEn}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isRTL ? feature.descAr : feature.descEn}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Social Proof */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center gap-6 flex-wrap"
      >
        {SOCIAL_PROOF.map((proof, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span>{isRTL ? proof.ar : proof.en}</span>
          </div>
        ))}
      </motion.div>

      <Separator />

      {/* Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center space-y-4"
      >
        <h2 className="text-xl font-bold">
          {isRTL ? "لماذا نيوماكسيو وليس SAP؟" : "Why Numaxio, Not SAP?"}
        </h2>
        <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
          <Card className="border-accent/20">
            <CardContent className="pt-4 text-center space-y-1">
              <Badge className="enterprise-indicator text-[10px]">Numaxio</Badge>
              <p className="text-2xl font-bold text-accent">~5,000</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "ريال/سنة" : "SAR/year"}</p>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardContent className="pt-4 text-center space-y-1">
              <Badge variant="outline" className="text-[10px]">SAP</Badge>
              <p className="text-2xl font-bold text-muted-foreground">500,000+</p>
              <p className="text-xs text-muted-foreground">{isRTL ? "ريال/سنة" : "SAR/year"}</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground">
          {isRTL
            ? "نفس مستوى الحوكمة. 1% من التكلفة. بدعم سعودي 100%."
            : "Same governance level. 1% of the cost. 100% Saudi support."}
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center space-y-3"
      >
        <Button
          size="lg"
          className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-8"
          onClick={() => navigate("/dashboard/subscription")}
        >
          {isRTL ? "تواصل مع فريق المبيعات" : "Contact Sales Team"}
          <ArrowUpRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          {isRTL
            ? "فريقنا سيتواصل معك خلال 24 ساعة لتصميم عرض يناسب منشأتك"
            : "Our team will reach out within 24 hours to design a tailored offer"}
        </p>
      </motion.div>
    </div>
  );
};

export default EnterpriseUpgradeWall;
