"use client";

/**
 * useBackendSync — runs once on dashboard mount to pull live data from the backend.
 *
 * Strategy:
 * 1. If backend is ready (sessionId exists), fetch dashboard data and hydrate the store.
 * 2. If backend is unreachable, the store keeps its local/mock state silently.
 * 3. Re-runs whenever the sessionId changes (e.g. after sign-in).
 */

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

export function useBackendSync() {
  const { sessionId, backendReady, loadCurrentDashboard } = useAppStore(
    useShallow((state) => ({
      sessionId: state.sessionId,
      backendReady: state.backendReady,
      loadCurrentDashboard: state.loadCurrentDashboard,
    })),
  );

  useEffect(() => {
    if (sessionId && backendReady) {
      loadCurrentDashboard();
    }
  }, [sessionId, backendReady, loadCurrentDashboard]);
}
