"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ModalController } from "@/components/modals/ModalController";
import { KickoffModal } from "@/components/dashboard/KickoffModal";
import { CompletionModal } from "@/components/dashboard/CompletionModal";
import { PlanTomorrowModal } from "@/components/dashboard/PlanTomorrowModal";
import { DashboardPeriodReviewPrompts } from "@/components/dashboard/DashboardPeriodReviewPrompts";
import { SyncErrorBanner } from "@/components/SyncErrorBanner";
import { useBackendSync } from "@/hooks/useBackendSync";

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
    if (!authReady) return;
    if (workspaceHydrating && currentUser && onboardingComplete) return;
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

  const canRenderShell = authReady && !!currentUser && backendReady && onboardingComplete;

  if (!canRenderShell) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f6f4" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: "#006c4a" }}>
            <span className="material-symbols-outlined text-[20px] text-white">bolt</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#a8b5af" }}>Loading…</p>
        </div>
      </div>
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
      <KickoffModal />
      <CompletionModal />
      <PlanTomorrowModal />
      <Suspense fallback={null}>
        <DashboardPeriodReviewPrompts />
      </Suspense>
    </div>
  );
}
