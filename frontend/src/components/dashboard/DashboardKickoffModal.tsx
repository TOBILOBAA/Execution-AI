"use client";

import { useAppStore } from "@/lib/store";
import { TODAY } from "@/lib/mockData";
import { DailyKickoffModal } from "./DailyKickoffModal";

/** Renders post-onboarding kickoff on every dashboard route so `kickoffPending` can always be cleared. */
export function DashboardKickoffModal() {
  const dailyPriorities = useAppStore((s) => s.dailyPriorities);
  const secondaryTasks = useAppStore((s) => s.secondaryTasks);
  const habits = useAppStore((s) => s.habits);
  const kickoffPending = useAppStore((s) => s.kickoffPending);
  const dismissKickoff = useAppStore((s) => s.dismissKickoff);

  if (!kickoffPending) return null;

  const todayPriorities = dailyPriorities.filter((p) => p.date === TODAY);
  const todayTasks = secondaryTasks.filter((t) => t.date === TODAY);

  return (
    <DailyKickoffModal
      priorities={todayPriorities}
      tasks={todayTasks}
      habits={habits}
      onBegin={dismissKickoff}
    />
  );
}
