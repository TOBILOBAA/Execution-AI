"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/lib/mockData";
import {
  useEveningReviewReminder,
  EVENING_REMINDER_DISMISS_STORAGE_KEY,
} from "@/hooks/useEveningReviewReminder";
import { EveningReviewModal } from "./EveningReviewModal";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function DashboardEveningReminderInner() {
  const searchParams = useSearchParams();
  const testEvening = searchParams?.get("evening_test") === "1";

  useEffect(() => {
    if (!testEvening || typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(EVENING_REMINDER_DISMISS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [testEvening]);

  const cutoffAt = useMemo(() => {
    if (!testEvening) return undefined;
    const t = new Date();
    t.setSeconds(0, 0);
    t.setMilliseconds(0);
    t.setMinutes(t.getMinutes() + 2);
    return t;
  }, [testEvening]);

  const dailyPriorities = useAppStore((s) => s.dailyPriorities);
  const secondaryTasks = useAppStore((s) => s.secondaryTasks);
  const habits = useAppStore((s) => s.habits);

  const { eveningOpen, dismissEvening } = useEveningReviewReminder(18, 0, {
    cutoffAt,
    ignoreKickoff: testEvening,
    pollIntervalMs: testEvening ? 5_000 : 60_000,
  });

  const timeZoneLabel = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "your device";
    }
  }, []);

  const scheduleNote = useMemo(() => {
    if (!testEvening || !cutoffAt) return undefined;
    return `Test mode (?evening_test=1): scheduled for ${pad2(cutoffAt.getHours())}:${pad2(
      cutoffAt.getMinutes(),
    )} local time (${timeZoneLabel}), about two minutes after this page loaded. Kickoff blocking is skipped. Clear the URL param for normal 6:00 PM behavior.`;
  }, [testEvening, cutoffAt, timeZoneLabel]);

  if (!eveningOpen) return null;

  const priorities = dailyPriorities.filter((p) => p.date === TODAY);
  const tasks = secondaryTasks.filter((t) => t.date === TODAY);

  return (
    <EveningReviewModal
      priorities={priorities}
      tasks={tasks}
      habits={habits}
      onClose={dismissEvening}
      timeZoneLabel={timeZoneLabel}
      scheduleNote={scheduleNote}
    />
  );
}

/** 6:00 PM local time (default). Add `?evening_test=1` to any dashboard URL to fire ~2 minutes after load. */
export function DashboardEveningReminder() {
  return (
    <Suspense fallback={null}>
      <DashboardEveningReminderInner />
    </Suspense>
  );
}
