import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, SkipForward, Loader2 } from "lucide-react";
import StepCompanyInfo from "./steps/StepCompanyInfo";
import StepFinanceSetup from "./steps/StepFinanceSetup";
import StepInviteTeam from "./steps/StepInviteTeam";
import StepFirstInvoice from "./steps/StepFirstInvoice";
import StepPaymentGateway from "./steps/StepPaymentGateway";

const STEP_TITLES = [
  "بيانات الشركة",
  "الإعدادات المالية",
  "دعوة الفريق",
  "أول عميل وفاتورة",
  "بوابة الدفع",
];

const SKIPPABLE_STEPS = [3, 4, 5]; // steps 3,4,5 — but 4 is required in terms of "first customer"
// Actually: steps 4 (invite team = step 3 in 1-indexed) and 5 (payment) are skippable
// Required: 1 (company), 2 (finance), 4 (first customer)
// So skippable = step index 3 (invite) and 5 (payment)

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const {
    state,
    isLoading,
    completeStep,
    skipStep,
    saving,
    TOTAL_STEPS,
    REQUIRED_STEPS,
  } = useOnboardingState();

  const [currentStep, setCurrentStep] = useState(1);
  const [stepValid, setStepValid] = useState(false);

  useEffect(() => {
    if (state?.current_step) {
      setCurrentStep(state.current_step > TOTAL_STEPS ? TOTAL_STEPS : state.current_step);
    }
  }, [state?.current_step, TOTAL_STEPS]);

  const progress = ((state?.completed_steps?.length ?? 0) / TOTAL_STEPS) * 100;

  const isSkippable = !REQUIRED_STEPS.includes(currentStep);

  const handleNext = async (stepData?: Record<string, any>) => {
    await completeStep(currentStep, stepData);
    if (currentStep >= TOTAL_STEPS) {
      toast.success("🎉 تم إعداد حسابك بنجاح! مرحباً بك في المنصة", {
        duration: 4000,
      });
      navigate("/dashboard", { replace: true });
    } else {
      setCurrentStep((s) => s + 1);
      setStepValid(false);
    }
  };

  const handleSkip = async () => {
    await skipStep(currentStep);
    if (currentStep >= TOTAL_STEPS) {
      toast.success("🎉 تم إعداد حسابك بنجاح!", { duration: 4000 });
      navigate("/dashboard", { replace: true });
    } else {
      setCurrentStep((s) => s + 1);
      setStepValid(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      setStepValid(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-foreground">إعداد الحساب</h1>
            <span className="text-sm text-muted-foreground">
              {currentStep} من {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {STEP_TITLES.map((title, i) => {
              const stepNum = i + 1;
              const done = state?.completed_steps?.includes(stepNum);
              const active = stepNum === currentStep;
              return (
                <div key={stepNum} className="flex-1 text-center">
                  <div
                    className={`h-1.5 rounded-full mb-1.5 transition-colors ${
                      done
                        ? "bg-primary"
                        : active
                        ? "bg-primary/50"
                        : "bg-muted"
                    }`}
                  />
                  <span
                    className={`text-[10px] hidden sm:block ${
                      active ? "text-primary font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep === 1 && (
              <StepCompanyInfo onValidChange={setStepValid} onSubmit={handleNext} />
            )}
            {currentStep === 2 && (
              <StepFinanceSetup onValidChange={setStepValid} onSubmit={handleNext} />
            )}
            {currentStep === 3 && (
              <StepInviteTeam onValidChange={setStepValid} onSubmit={handleNext} />
            )}
            {currentStep === 4 && (
              <StepFirstInvoice onValidChange={setStepValid} onSubmit={handleNext} />
            )}
            {currentStep === 5 && (
              <StepPaymentGateway onValidChange={setStepValid} onSubmit={handleNext} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="border-t bg-card/50 backdrop-blur-sm sticky bottom-0">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
            className="gap-2"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </Button>

          <div className="flex items-center gap-3">
            {isSkippable && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={saving}
                className="gap-2 text-muted-foreground"
              >
                <SkipForward className="w-4 h-4" />
                تخطي الآن
              </Button>
            )}
            <Button
              onClick={() => {
                // Trigger submit from step component via form
                const form = document.querySelector<HTMLFormElement>("[data-onboarding-form]");
                if (form) form.requestSubmit();
                else handleNext();
              }}
              disabled={!stepValid || saving}
              className="gap-2 min-w-[120px]"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {currentStep >= TOTAL_STEPS ? "إنهاء الإعداد" : "التالي"}
              {!saving && currentStep < TOTAL_STEPS && <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
