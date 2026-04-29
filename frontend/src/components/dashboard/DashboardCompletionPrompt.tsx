"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { DashboardNextDayReview } from "./DashboardNextDayReview";

const DISMISS_KEY = "execution_ai_tomorrow_prompt_dismissed";

function readSessionKey(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionKey(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore private mode / quota issues */
  }
}

function nextIsoDate(isoDate: string) {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

export function DashboardCompletionPrompt() {
  const sessionId = useAppStore((s) => s.sessionId);
  const kickoffPending = useAppStore((s) => s.kickoffPending);
  const activeDashboardDate = useAppStore((s) => s.activeDashboardDate);
  const dailyPriorities = useAppStore((s) => s.dailyPriorities);
  const secondaryTasks = useAppStore((s) => s.secondaryTasks);

  const [open, setOpen] = useState(false);

  const todayPriorities = useMemo(
    () => dailyPriorities.filter((item) => item.date === activeDashboardDate),
    [activeDashboardDate, dailyPriorities],
  );
  const todayTasks = useMemo(
    () => secondaryTasks.filter((item) => item.date === activeDashboardDate),
    [activeDashboardDate, secondaryTasks],
  );

  const totalItems = todayPriorities.length + todayTasks.length;
  const completedItems =
    todayPriorities.filter((item) => item.completed).length +
    todayTasks.filter((item) => item.completed).length;
  const allExecutionDone = totalItems > 0 && completedItems === totalItems;
  const tomorrow = useMemo(() => nextIsoDate(activeDashboardDate), [activeDashboardDate]);

  useEffect(() => {
    if (!sessionId || kickoffPending) return;
    if (!allExecutionDone) {
      setOpen(false);
      return;
    }
    const alreadyDismissed = readSessionKey(DISMISS_KEY) === activeDashboardDate;
    if (!alreadyDismissed) {
      setOpen(true);
    }
  }, [activeDashboardDate, allExecutionDone, kickoffPending, sessionId]);

  if (!sessionId || kickoffPending || !open) return null;

  return (
    <DashboardNextDayReview
      planDate={tomorrow}
      startOpen
      onClose={() => {
        writeSessionKey(DISMISS_KEY, activeDashboardDate);
        setOpen(false);
      }}
    />
  );
}
