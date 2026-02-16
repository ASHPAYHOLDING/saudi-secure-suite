import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import WhySection from "@/components/landing/WhySection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import DynamicPricingSection from "@/components/landing/DynamicPricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <WhySection />
      <TestimonialsSection />
      <DynamicPricingSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
