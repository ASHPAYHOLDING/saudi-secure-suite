import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PowerStrip from "@/components/landing/PowerStrip";
import Footer from "@/components/landing/Footer";
import { useLanguage } from "@/hooks/useLanguage";

const WhyNumaxioSection = lazy(() => import("@/components/landing/WhyNumaxioSection"));
const ERPModulesSection = lazy(() => import("@/components/landing/ERPModulesSection"));
const InvoiceDemo = lazy(() => import("@/components/landing/InvoiceDemo"));
const AIAccountantSection = lazy(() => import("@/components/landing/AIAccountantSection"));
const ZATCAComplianceSection = lazy(() => import("@/components/landing/ZATCAComplianceSection"));
const EnterpriseGovernanceSection = lazy(() => import("@/components/landing/EnterpriseGovernanceSection"));
const PaymentGatewaySection = lazy(() => import("@/components/landing/PaymentGatewaySection"));
const ExecutiveReportsSection = lazy(() => import("@/components/landing/ExecutiveReportsSection"));
const DynamicPricingSection = lazy(() => import("@/components/landing/DynamicPricingSection"));
const UseCasesSection = lazy(() => import("@/components/landing/UseCasesSection"));
const SecurityStrip = lazy(() => import("@/components/landing/SecurityStrip"));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA"));

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Numaxio ERP",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "نظام ERP سعودي مؤسسي متكامل — فواتير إلكترونية ZATCA، ذكاء محاسبي مدمج، حوكمة مؤسسية",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "SAR",
    description: "14 يوم تجربة مجانية",
  },
};

const Index = () => {
  useLanguage();

  return (
    <>
      <Helmet>
        <title>Numaxio ERP — نظام ERP سعودي مؤسسي لإدارة مالية متكاملة</title>
        <meta
          name="description"
          content="نظام ERP سعودي مؤسسي متكامل: فواتير إلكترونية ZATCA Phase 2، ذكاء محاسبي مدمج، حوكمة مؤسسية. ابدأ تجربتك المجانية 14 يوم بدون بطاقة بنكية."
        />
        <link rel="canonical" href="https://saudi-secure-suite.lovable.app/" />
        <script type="application/ld+json">{JSON.stringify(softwareJsonLd)}</script>
      </Helmet>
      <div className="min-h-screen bg-background overflow-x-hidden">
        <Navbar />
        <main>
          <HeroSection />
          <PowerStrip />
          <Suspense fallback={null}>
            <WhyNumaxioSection />
            <ERPModulesSection />
            <InvoiceDemo />
            <AIAccountantSection />
            <ZATCAComplianceSection />
            <SecurityStrip />
            <EnterpriseGovernanceSection />
            <PaymentGatewaySection />
            <ExecutiveReportsSection />
            <DynamicPricingSection />
            <UseCasesSection />
            <FinalCTA />
          </Suspense>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
