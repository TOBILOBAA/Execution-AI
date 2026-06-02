"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { describeSyncError } from "@/lib/apiErrors";

export default function RootPage() {
  const router = useRouter();
  const { currentUser, onboardingComplete, authReady, backendReady, workspaceHydrating, syncError } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      onboardingComplete: state.onboardingComplete,
      authReady: state.authReady,
      backendReady: state.backendReady,
      workspaceHydrating: state.workspaceHydrating,
      syncError: state.syncError,
    })),
  );
  const backendAttachFailed = Boolean(currentUser) && !workspaceHydrating && !backendReady && Boolean(syncError);

  useEffect(() => {
    if (!authReady || workspaceHydrating) return;
    if (!currentUser) {
      router.replace("/auth");
    } else if (!backendReady) {
      if (syncError) {
        router.replace("/auth");
      }
      return;
    } else if (onboardingComplete) {
      router.replace("/dashboard");
    } else {
      router.replace("/onboarding");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, syncError, router]);

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

  if (!authReady || workspaceHydrating || (!!currentUser && !backendReady)) {
    return (
      <AppLoadingScreen
        eyebrow="Launching your workspace"
        title="Checking where to drop you in"
        detail="We are restoring your session, syncing the latest planning data, and routing you to the right next step."
      />
    );
  }

  return (
    <AppLoadingScreen
      eyebrow="Opening Execution AI"
      title="Routing to your next screen"
      detail="Your workspace is ready. We are taking you to auth, onboarding, or today&apos;s dashboard now."
    />
  );
}
