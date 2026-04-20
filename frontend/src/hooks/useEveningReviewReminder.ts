"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

/** sessionStorage: last local calendar date (YYYY-MM-DD) user dismissed the evening prompt. */
export const EVENING_REMINDER_DISMISS_STORAGE_KEY = "execution_ai_evening_review_dismissed_date";
const STORAGE_KEY = EVENING_REMINDER_DISMISS_STORAGE_KEY;

export function localCalendarDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today at `hour`:`minute` in local time (timestamp compare — avoids hour-only bugs). */
function wallClockReached(now: Date, hour: number, minute: number): boolean {
  const c = new Date(now);
  c.setHours(hour, minute, 0, 0);
  return now.getTime() >= c.getTime();
}

export interface EveningReminderOptions {
  /** When true, `kickoffPending` does not block opening (for `?evening_test=1`). */
  ignoreKickoff?: boolean;
  /** Polling interval in ms (default 60_000; use 5_000 during tests). */
  pollIntervalMs?: number;
  /**
   * Absolute moment the reminder may open (e.g. now + 2 min for URL test mode).
   * When set, `eveningHour` / `eveningMinute` are ignored for timing.
   */
  cutoffAt?: Date;
}

/**
 * Evening reminder: default 6:00 PM local wall clock, once per calendar day until dismissed.
 * For QA, pass `cutoffAt` + `ignoreKickoff` (see `?evening_test=1` on dashboard).
 */
export function useEveningReviewReminder(
  eveningHour = 18,
  eveningMinute = 0,
  options: EveningReminderOptions = {},
) {
  const { ignoreKickoff = false, pollIntervalMs = 60_000, cutoffAt } = options;
  const [eveningOpen, setEveningOpen] = useState(false);
  const kickoffPending = useAppStore((s) => s.kickoffPending);

  const dismissEvening = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, localCalendarDateKey());
    } catch {
      /* private mode / quota */
    }
    setEveningOpen(false);
  }, []);

  const tryOpen = useCallback(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const reached = cutoffAt
      ? now.getTime() >= cutoffAt.getTime()
      : wallClockReached(now, eveningHour, eveningMinute);
    if (!reached) return;

    let dismissedForToday = false;
    try {
      dismissedForToday = sessionStorage.getItem(STORAGE_KEY) === localCalendarDateKey(now);
    } catch {
      /* treat as not dismissed */
    }
    if (dismissedForToday) return;
    if (!ignoreKickoff && useAppStore.getState().kickoffPending) return;
    setEveningOpen(true);
  }, [eveningHour, eveningMinute, ignoreKickoff, cutoffAt]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void tryOpen(), 0);
    const interval = window.setInterval(() => tryOpen(), pollIntervalMs);

    const now = new Date();
    const deadline = cutoffAt
      ? new Date(cutoffAt)
      : (() => {
          const t = new Date(now);
          t.setHours(eveningHour, eveningMinute, 0, 0);
          return t;
        })();

    const ms = deadline.getTime() - now.getTime();
    let timeoutId: number | undefined;
    if (ms > 0 && ms < 48 * 60 * 60 * 1000) {
      timeoutId = window.setTimeout(() => void tryOpen(), ms);
    }

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [tryOpen, eveningHour, eveningMinute, pollIntervalMs, cutoffAt]);

  useEffect(() => {
    if (kickoffPending) return;
    const id = window.setTimeout(() => void tryOpen(), 0);
    return () => window.clearTimeout(id);
  }, [kickoffPending, tryOpen]);

  return { eveningOpen, dismissEvening };
}
