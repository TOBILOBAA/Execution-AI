"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";

export function LandingAuthGate() {
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
    if (!authReady || workspaceHydrating || !currentUser) return;

    if (!backendReady) return;

    if (onboardingComplete) {
      router.replace("/dashboard");
      return;
    }

    router.replace("/onboarding");
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, backendReady, router]);

  return null;
}
