import { lazy, Suspense } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PowerStrip from "@/components/landing/PowerStrip";
import CoreAdvantages from "@/components/landing/CoreAdvantages";
import Footer from "@/components/landing/Footer";

const InvoiceDemo = lazy(() => import("@/components/landing/InvoiceDemo"));
const EnterpriseSection = lazy(() => import("@/components/landing/EnterpriseSection"));
const AISection = lazy(() => import("@/components/landing/AISection"));
const DynamicPricingSection = lazy(() => import("@/components/landing/DynamicPricingSection"));
const TrustSection = lazy(() => import("@/components/landing/TrustSection"));
const FinalCTA = lazy(() => import("@/components/landing/FinalCTA"));

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden" dir="rtl">
      <Navbar />
      <HeroSection />
      <PowerStrip />
      <CoreAdvantages />
      <Suspense fallback={null}>
        <InvoiceDemo />
        <EnterpriseSection />
        <AISection />
        <DynamicPricingSection />
        <TrustSection />
        <FinalCTA />
      </Suspense>
      <Footer />
    </div>
  );
};

export default Index;
