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
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { getToday } from "@/lib/mockData";

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
    backendReady,
    workspaceHydrating,
    sessionTimezone,
    setActiveDashboardDate,
  } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      onboardingComplete: state.onboardingComplete,
      onboardingStep: state.onboardingStep,
      setOnboardingStep: state.setOnboardingStep,
      completeOnboarding: state.completeOnboarding,
      authReady: state.authReady,
      backendReady: state.backendReady,
      workspaceHydrating: state.workspaceHydrating,
      sessionTimezone: state.sessionTimezone,
      setActiveDashboardDate: state.setActiveDashboardDate,
    })),
  );

  useEffect(() => {
    if (!authReady) return;
    if (!currentUser) {
      if (workspaceHydrating) return;
      router.replace("/auth");
      return;
    }
    if (onboardingComplete && backendReady) {
      router.replace("/dashboard");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, router]);

  useEffect(() => {
    if (!authReady || !currentUser || onboardingComplete) return;
    setActiveDashboardDate(getToday(sessionTimezone));
  }, [
    authReady,
    currentUser,
    onboardingComplete,
    sessionTimezone,
    setActiveDashboardDate,
  ]);

  const canRenderOnboarding = authReady && !!currentUser && !onboardingComplete;

  if (!canRenderOnboarding) {
    return (
      <AppLoadingScreen
        eyebrow="Preparing onboarding"
        title="Building your setup flow"
        detail="We are confirming your account and loading the yearly, monthly, weekly, and daily planning steps."
      />
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
