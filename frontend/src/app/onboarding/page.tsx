"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { StepYearly, YearlyAIGuidancePanel } from "@/components/onboarding/StepYearly";
import { StepMonthly, MonthlyAIGuidancePanel } from "@/components/onboarding/StepMonthly";
import { StepWeekly, WeeklyAIGuidancePanel } from "@/components/onboarding/StepWeekly";
import { StepDaily, DailyAIGuidancePanel } from "@/components/onboarding/StepDaily";

const STEPS = [
  { num: 1, label: "Set yearly goals" },
  { num: 2, label: "Plan this month" },
  { num: 3, label: "Plan this week" },
  { num: 4, label: "Set up today" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const {
    currentUser,
    onboardingComplete,
    onboardingStep,
    setOnboardingStep,
    completeOnboarding,
    authReady,
    workspaceHydrating,
  } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      onboardingComplete: state.onboardingComplete,
      onboardingStep: state.onboardingStep,
      setOnboardingStep: state.setOnboardingStep,
      completeOnboarding: state.completeOnboarding,
      authReady: state.authReady,
      workspaceHydrating: state.workspaceHydrating,
    })),
  );

  useEffect(() => {
    if (!authReady || workspaceHydrating) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, router]);

  if (!authReady || workspaceHydrating || !currentUser || onboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f6f4" }}>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#a8b5af" }}>Loading…</p>
      </div>
    );
  }

  const handleNext = async () => {
    if (onboardingStep < 4) {
      setOnboardingStep(onboardingStep + 1);
    } else {
      const ok = await completeOnboarding();
      if (ok) {
        router.push("/dashboard");
      }
    }
  };

  const handleBack = () => {
    if (onboardingStep > 1) setOnboardingStep(onboardingStep - 1);
  };

  const rightPanel =
    onboardingStep === 1 ? <YearlyAIGuidancePanel /> :
    onboardingStep === 2 ? <MonthlyAIGuidancePanel /> :
    onboardingStep === 3 ? <WeeklyAIGuidancePanel /> :
    onboardingStep === 4 ? <DailyAIGuidancePanel /> :
    undefined;

  return (
    <OnboardingShell
      step={onboardingStep}
      steps={STEPS}
      onNext={handleNext}
      onBack={handleBack}
      rightPanel={rightPanel}
    >
      {onboardingStep === 1 && <StepYearly onNext={handleNext} />}
      {onboardingStep === 2 && <StepMonthly onNext={handleNext} onBack={handleBack} />}
      {onboardingStep === 3 && <StepWeekly onNext={handleNext} onBack={handleBack} />}
      {onboardingStep === 4 && <StepDaily onFinish={handleNext} onBack={handleBack} />}
    </OnboardingShell>
  );
}
