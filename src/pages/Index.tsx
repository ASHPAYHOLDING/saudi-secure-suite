import { lazy, Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PowerStrip from "@/components/landing/PowerStrip";
import Footer from "@/components/landing/Footer";

const InvoiceDemo = lazy(() => import("@/components/landing/InvoiceDemo"));
const ComplianceSection = lazy(() => import("@/components/landing/ComplianceSection"));
const AISection = lazy(() => import("@/components/landing/AISection"));
const GovernanceSection = lazy(() => import("@/components/landing/GovernanceSection"));
const DynamicPricingSection = lazy(() => import("@/components/landing/DynamicPricingSection"));
const TrustSection = lazy(() => import("@/components/landing/TrustSection"));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA"));

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden" dir="rtl">
      <Navbar />
      <HeroSection />
      <PowerStrip />
      <Suspense fallback={null}>
        <InvoiceDemo />
        <ComplianceSection />
        <AISection />
        <GovernanceSection />
        <DynamicPricingSection />
        <TrustSection />
        <FinalCTA />
      </Suspense>
      <Footer />
    </div>
  );
};

export default Index;
