"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

export default function RootPage() {
  const router = useRouter();
  const { currentUser, onboardingComplete, authReady, backendReady, workspaceHydrating } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      onboardingComplete: state.onboardingComplete,
      authReady: state.authReady,
      backendReady: state.backendReady,
      workspaceHydrating: state.workspaceHydrating,
    })),
  );

  useEffect(() => {
    if (!authReady || workspaceHydrating) return;
    if (!currentUser) {
      router.replace("/auth");
    } else if (!backendReady) {
      return;
    } else if (onboardingComplete) {
      router.replace("/dashboard");
    } else {
      router.replace("/onboarding");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, router]);

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
