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
import { describeSyncError } from "@/lib/apiErrors";

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
    syncError,
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
      syncError: state.syncError,
      sessionTimezone: state.sessionTimezone,
      setActiveDashboardDate: state.setActiveDashboardDate,
    })),
  );
  const backendAttachFailed = Boolean(currentUser) && !workspaceHydrating && !backendReady && Boolean(syncError);

  useEffect(() => {
    if (!authReady || workspaceHydrating) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (!backendReady) {
      if (syncError) {
        router.replace("/auth");
      }
      return;
    }
    if (onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, syncError, router]);

  useEffect(() => {
    if (!authReady || workspaceHydrating || !currentUser || !backendReady || onboardingComplete) return;
    setActiveDashboardDate(getToday(sessionTimezone));
  }, [
    authReady,
    workspaceHydrating,
    currentUser,
    backendReady,
    onboardingComplete,
    sessionTimezone,
    setActiveDashboardDate,
  ]);

  if (backendAttachFailed) {
    const { title, message, footer } = describeSyncError(syncError ?? "");
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f6f4" }}>
        <div
          className="w-full max-w-md rounded-3xl px-7 py-8 bg-white"
          style={{ boxShadow: "0 24px 70px rgba(15, 23, 42, 0.08)" }}
        >
          <p className="text-[10px] uppercase tracking-widest font-bold mb-3" style={{ color: "#a8b5af" }}>
            Workspace connection
          </p>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-3" style={{ color: "#1a1f1e" }}>
            {title}
          </h1>
          <p className="text-sm leading-relaxed mb-2" style={{ color: "#475569" }}>
            {message}
          </p>
          <p className="text-xs leading-relaxed mb-6" style={{ color: "#64748b" }}>
            {footer}
          </p>
        </div>
      </div>
    );
  }

  if (!authReady || workspaceHydrating || !currentUser || !backendReady || onboardingComplete) {
    return <AppLoadingScreen title="Loading onboarding" />;
  }

  const handleNext = async () => {
    if (onboardingStep < 4) {
      await setOnboardingStep(onboardingStep + 1);
    } else {
      const ok = await completeOnboarding();
      if (ok) {
        router.push("/dashboard");
      }
    }
  };

  const handleBack = async () => {
    if (onboardingStep > 1) {
      await setOnboardingStep(onboardingStep - 1);
    }
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
