"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

export default function RootPage() {
  const router = useRouter();
  const { currentUser, onboardingComplete, authReady, workspaceHydrating } = useAppStore(
    useShallow((state) => ({
      currentUser: state.currentUser,
      onboardingComplete: state.onboardingComplete,
      authReady: state.authReady,
      workspaceHydrating: state.workspaceHydrating,
    })),
  );

  useEffect(() => {
    if (!authReady || workspaceHydrating) return;
    if (!currentUser) {
      router.replace("/auth");
    } else if (onboardingComplete) {
      router.replace("/dashboard");
    } else {
      router.replace("/onboarding");
    }
  }, [authReady, workspaceHydrating, currentUser, onboardingComplete, router]);

  if (!authReady || workspaceHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f6f4" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: "#006c4a" }}>
            <span className="material-symbols-outlined text-[20px] text-white">bolt</span>
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#a8b5af" }}>
            Loading Execution AI
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f6f4" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: "#006c4a" }}>
          <span className="material-symbols-outlined text-[20px] text-white">bolt</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#a8b5af" }}>
          Loading Execution AI
        </p>
      </div>
    </div>
  );
}
