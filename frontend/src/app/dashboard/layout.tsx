"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ModalController } from "@/components/modals/ModalController";
import { DashboardKickoffModal } from "@/components/dashboard/DashboardKickoffModal";
import { DashboardEveningReminder } from "@/components/dashboard/DashboardEveningReminder";
import { DashboardNextDayReview } from "@/components/dashboard/DashboardNextDayReview";
import { DashboardPeriodReviewPrompts } from "@/components/dashboard/DashboardPeriodReviewPrompts";
import { SyncErrorBanner } from "@/components/SyncErrorBanner";
import { useBackendSync } from "@/hooks/useBackendSync";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, onboardingComplete, authReady, workspaceHydrating, backendReady } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      onboardingComplete: state.onboardingComplete,
      authReady: state.authReady,
      workspaceHydrating: state.workspaceHydrating,
      backendReady: state.backendReady,
    })),
  );

  // Hydrate store from backend on every dashboard load
  useBackendSync();

  useEffect(() => {
    if (!authReady || workspaceHydrating) return;
    if (!currentUser) {
      router.replace("/auth");
      return;
    }
    if (!backendReady) {
      // Backend session is not linked to an auth user — user hasn't completed sign-up flow on server.
      router.replace("/auth");
      return;
    }
    if (!onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, router]);

  if (!authReady || workspaceHydrating || !currentUser || !backendReady || !onboardingComplete) {
    return (
      <AppLoadingScreen
        eyebrow="Loading the dashboard"
        title="Bringing today&apos;s workspace online"
        detail="We are reconnecting your session, syncing the latest execution data, and restoring your dashboard shell."
      />
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#f4f6f4" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <div className="px-6 md:px-8 shrink-0">
          <SyncErrorBanner />
        </div>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <BottomNav />
      </div>
      <ModalController />
      <DashboardKickoffModal />
      <DashboardEveningReminder />
      <DashboardNextDayReview />
      <Suspense fallback={null}>
        <DashboardPeriodReviewPrompts />
      </Suspense>
    </div>
  );
}
