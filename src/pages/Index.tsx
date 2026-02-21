import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PowerStrip from "@/components/landing/PowerStrip";
import CoreAdvantages from "@/components/landing/CoreAdvantages";
import InvoiceDemo from "@/components/landing/InvoiceDemo";
import EnterpriseSection from "@/components/landing/EnterpriseSection";
import AISection from "@/components/landing/AISection";
import DynamicPricingSection from "@/components/landing/DynamicPricingSection";
import TrustSection from "@/components/landing/TrustSection";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <HeroSection />
      <PowerStrip />
      <CoreAdvantages />
      <InvoiceDemo />
      <EnterpriseSection />
      <AISection />
      <DynamicPricingSection />
      <TrustSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
