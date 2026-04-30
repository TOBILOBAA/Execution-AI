"use client";

import { useAppStore } from "@/lib/store";
import { getToday } from "@/lib/mockData";
import { DailyKickoffModal } from "./DailyKickoffModal";

/** Canonical kickoff state-machine entrypoint for the home funnel. */
export function KickoffModal() {
  const dailyPriorities = useAppStore((s) => s.dailyPriorities);
  const secondaryTasks = useAppStore((s) => s.secondaryTasks);
  const habits = useAppStore((s) => s.habits);
  const kickoffPending = useAppStore((s) => s.kickoffPending);
  const dismissKickoff = useAppStore((s) => s.dismissKickoff);

  if (!kickoffPending) return null;

  const todayPriorities = dailyPriorities.filter((p) => p.date === getToday());
  const todayTasks = secondaryTasks.filter((t) => t.date === getToday());

  return (
    <DailyKickoffModal
      priorities={todayPriorities}
      tasks={todayTasks}
      habits={habits}
      onBegin={dismissKickoff}
    />
  );
}
