/**
 * EnterpriseUpgradeWall — compelling upgrade prompt for enterprise features.
 * Can be used standalone or inline (compact mode).
 * Supports RTL/LTR and respects prefers-reduced-motion.
 */
import { useState, useEffect } from "react";
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
  compact?: boolean;
  featureContext?: string;
}

const ENTERPRISE_FEATURES = [
  { icon: Scale, ar: "فصل المهام", en: "Segregation of Duties", descAr: "لا يمكن لنفس الشخص إنشاء واعتماد نفس المعاملة", descEn: "Same person cannot create and approve the same transaction" },
  { icon: Globe, ar: "تقييد IP", en: "IP Restrictions", descAr: "قيّد الوصول لشبكة مكتبك فقط", descEn: "Restrict access to your office network only" },
  { icon: Activity, ar: "مراقبة الجلسات", en: "Session Monitoring", descAr: "تتبع وإنهاء الجلسات النشطة لحظياً", descEn: "Track and revoke active sessions in real-time" },
  { icon: Crown, ar: "قوالب أدوار مؤسسية", en: "Corporate Role Templates", descAr: "CFO، مدقق داخلي، مسؤول امتثال — بنقرة واحدة", descEn: "CFO, Internal Auditor, Compliance Officer — one click" },
  { icon: Lock, ar: "موافقة مزدوجة", en: "Dual Approval", descAr: "معاملات عالية القيمة تتطلب موافقتين مختلفتين", descEn: "High-value transactions require two different approvals" },
  { icon: Shield, ar: "تدقيق بمعايير SOCPA", en: "SOCPA-ready Audit", descAr: "تصدير سجلات تدقيق بتنسيق يقبله المراجعون", descEn: "Export audit logs in auditor-accepted format" },
];

const SOCIAL_PROOF = [
  { ar: "أكثر من 500 سياسة حوكمة مُفعّلة", en: "500+ governance policies active" },
  { ar: "99.9% وقت تشغيل مضمون", en: "99.9% guaranteed uptime" },
  { ar: "متوافق مع متطلبات هيئة السوق المالية", en: "CMA compliance ready" },
];

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

const EnterpriseUpgradeWall = ({ compact = false, featureContext }: Props) => {
  const navigate = useNavigate();
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";
  const reduced = useReducedMotion();

  const Wrapper = reduced ? ("div" as any) : motion.div;
  const fadeProps = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.35 },
  };

  if (compact) {
    return (
      <Wrapper {...fadeProps(0.3)}>
        <Card className="border-accent/20 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
          <CardContent className="relative pt-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  <h3 className="font-bold text-lg">
                    {isAr ? "حوكمة على مستوى المؤسسات" : "Enterprise-Grade Governance"}
                  </h3>
                  <Badge className="enterprise-indicator border-accent/25 text-accent text-[9px] px-1.5 py-0">Enterprise</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isAr
                    ? "ارفع مستوى الأمان والامتثال في منشأتك مع أدوات حوكمة بمعايير SAP — بسعر سعودي."
                    : "Elevate your organization's security and compliance with SAP-grade governance tools — at a Saudi price."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ENTERPRISE_FEATURES.slice(0, 3).map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
                      <span>{isAr ? f.ar : f.en}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                size="lg"
                className="shrink-0 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => navigate("/dashboard/subscription")}
              >
                {isAr ? "تواصل مع المبيعات" : "Contact Sales"}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Wrapper>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <Wrapper {...fadeProps()} className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-accent" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isAr ? "حوكمة مؤسسية بمعايير عالمية" : "World-Class Enterprise Governance"}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {isAr
            ? "نفس أدوات الحوكمة التي تستخدمها الشركات الكبرى مع SAP و Oracle — الآن متاحة لك في نيوماكسيو بجزء من التكلفة."
            : "The same governance tools used by enterprises with SAP & Oracle — now available in Numaxio at a fraction of the cost."}
        </p>
        {featureContext && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm">
            <Lock className="h-4 w-4" />
            {isAr ? `"${featureContext}" متاحة في باقة المؤسسات فقط` : `"${featureContext}" is available in Enterprise plan only`}
          </div>
        )}
      </Wrapper>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ENTERPRISE_FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <Wrapper key={i} {...fadeProps(0.1 + i * 0.05)}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <h3 className="font-semibold text-sm">{isAr ? feature.ar : feature.en}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isAr ? feature.descAr : feature.descEn}
                  </p>
                </CardContent>
              </Card>
            </Wrapper>
          );
        })}
      </div>

      {/* Social Proof */}
      <Wrapper {...fadeProps(0.5)} className="flex justify-center gap-6 flex-wrap">
        {SOCIAL_PROOF.map((proof, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span>{isAr ? proof.ar : proof.en}</span>
          </div>
        ))}
      </Wrapper>

      <Separator />

      {/* Value Proposition */}
      <Wrapper {...fadeProps(0.6)} className="text-center space-y-4">
        <h2 className="text-xl font-bold">{isAr ? "لماذا نيوماكسيو للمؤسسات؟" : "Why Numaxio for Enterprises?"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
          <Card className="border-accent/20">
            <CardContent className="pt-4 text-center space-y-1">
              <p className="text-2xl font-bold text-accent">100%</p>
              <p className="text-xs text-muted-foreground">{isAr ? "دعم سعودي" : "Saudi Support"}</p>
            </CardContent>
          </Card>
          <Card className="border-accent/20">
            <CardContent className="pt-4 text-center space-y-1">
              <p className="text-2xl font-bold text-accent">ZATCA</p>
              <p className="text-xs text-muted-foreground">{isAr ? "جاهز Phase 2" : "Phase 2 Ready"}</p>
            </CardContent>
          </Card>
          <Card className="border-accent/20">
            <CardContent className="pt-4 text-center space-y-1">
              <p className="text-2xl font-bold text-accent">24/7</p>
              <p className="text-xs text-muted-foreground">{isAr ? "حوكمة مؤسسية" : "Enterprise Governance"}</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground">
          {isAr ? "حوكمة مؤسسية كاملة بتكلفة مناسبة وبدعم سعودي 100%." : "Full enterprise governance at an affordable cost with 100% Saudi support."}
        </p>
      </Wrapper>

      {/* CTA */}
      <Wrapper {...fadeProps(0.8)} className="text-center space-y-3">
        <Button
          size="lg"
          className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground px-8"
          onClick={() => navigate("/dashboard/subscription")}
        >
          {isAr ? "تواصل مع فريق المبيعات" : "Contact Sales Team"}
          <ArrowUpRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          {isAr ? "فريقنا سيتواصل معك خلال 24 ساعة لتصميم عرض يناسب منشأتك" : "Our team will reach out within 24 hours to design a tailored offer"}
        </p>
      </Wrapper>
    </div>
  );
};

export default EnterpriseUpgradeWall;
