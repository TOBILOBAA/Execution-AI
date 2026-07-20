"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { ApiReport } from "@/lib/api";
import {
  EVENING_REMINDER_DISMISS_STORAGE_KEY,
  useEveningReviewReminder,
} from "@/hooks/useEveningReviewReminder";
import { PlanTomorrowModal } from "./PlanTomorrowModal";

const COMPLETE_DISMISS_KEY = "execution_ai_completion_modal_dismissed";

type CompletionTrigger = "complete" | "evening";

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
    /* ignore */
  }
}

function nextIsoDate(isoDate: string) {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + 1);
  return base.toISOString().slice(0, 10);
}

function formatPlanDateLabel(isoDate: string) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getDailyNarrative(report: ApiReport | null) {
  const narrative = (report?.ai_narrative ?? {}) as Record<string, unknown>;
  return {
    summary:
      typeof narrative.summary === "string"
        ? narrative.summary
        : "Your day is ready for review.",
    reflection:
      typeof narrative.reflection === "string"
        ? narrative.reflection
        : "The system captured what moved and what still needs a deliberate decision.",
    tomorrowFocus:
      typeof narrative.tomorrow_focus === "string" ? narrative.tomorrow_focus : null,
  };
}

function CompletionModalInner() {
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

  const sessionId = useAppStore((s) => s.sessionId);
  const kickoffPending = useAppStore((s) => s.kickoffPending);
  const activeDashboardDate = useAppStore((s) => s.activeDashboardDate);
  const dailyPriorities = useAppStore((s) => s.dailyPriorities);
  const secondaryTasks = useAppStore((s) => s.secondaryTasks);
  const habits = useAppStore((s) => s.habits);
  const generateDailyReport = useAppStore((s) => s.generateDailyReport);

  const [trigger, setTrigger] = useState<CompletionTrigger | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [report, setReport] = useState<ApiReport | null>(null);
  const [loadedReportDate, setLoadedReportDate] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const todayPriorities = useMemo(
    () => dailyPriorities.filter((item) => item.date === activeDashboardDate),
    [activeDashboardDate, dailyPriorities],
  );
  const todayTasks = useMemo(
    () => secondaryTasks.filter((item) => item.date === activeDashboardDate),
    [activeDashboardDate, secondaryTasks],
  );
  const activeHabits = useMemo(() => habits.filter((habit) => habit.active), [habits]);

  const totalItems = todayPriorities.length + todayTasks.length + activeHabits.length;
  const completedItems =
    todayPriorities.filter((item) => item.completed).length +
    todayTasks.filter((item) => item.completed).length +
    activeHabits.filter((habit) => habit.completedToday).length;
  const allExecutionDone = totalItems > 0 && completedItems === totalItems;
  const tomorrow = useMemo(() => nextIsoDate(activeDashboardDate), [activeDashboardDate]);
  const completionDismissed = readSessionKey(COMPLETE_DISMISS_KEY) === activeDashboardDate;

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
    )} local time (${timeZoneLabel}), about two minutes after this page loaded. Kickoff blocking is skipped.`;
  }, [cutoffAt, testEvening, timeZoneLabel]);

  const narrative = useMemo(() => getDailyNarrative(report), [report]);

  useEffect(() => {
    if (!sessionId || kickoffPending || plannerOpen || trigger) return;
    if (allExecutionDone && !completionDismissed) {
      setTrigger("complete");
    }
  }, [allExecutionDone, completionDismissed, kickoffPending, plannerOpen, sessionId, trigger]);

  useEffect(() => {
    if (!sessionId || kickoffPending || plannerOpen || trigger) return;
    if (eveningOpen && !allExecutionDone) {
      setTrigger("evening");
    }
  }, [allExecutionDone, eveningOpen, kickoffPending, plannerOpen, sessionId, trigger]);

  useEffect(() => {
    if (!trigger || !sessionId) return;
    if (loadedReportDate === activeDashboardDate) return;

    let cancelled = false;
    setLoadingReport(true);
    setReportError(null);

    generateDailyReport(activeDashboardDate)
      .then((generated) => {
        if (cancelled) return;
        if (!generated) {
          setReportError("The reflection could not be generated right now, but you can still continue to tomorrow’s plan.");
          return;
        }
        setReport(generated);
        setLoadedReportDate(activeDashboardDate);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingReport(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeDashboardDate, generateDailyReport, loadedReportDate, sessionId, trigger]);

  useEffect(() => {
    setReport(null);
    setLoadedReportDate(null);
    setReportError(null);
    setNoteDraft("");
  }, [activeDashboardDate]);

  useEffect(() => {
    setNoteDraft(report?.user_note ?? "");
  }, [report?.id, report?.user_note]);

  async function persistDailyNoteIfNeeded() {
    const currentNote = noteDraft.trim();
    const savedNote = (report?.user_note ?? "").trim();
    if (currentNote === savedNote) return true;

    setSavingNote(true);
    setReportError(null);
    try {
      const saved = await generateDailyReport(activeDashboardDate, noteDraft);
      if (!saved) {
        setReportError("Could not save your note yet. Try again in a moment.");
        return false;
      }
      setReport(saved);
      setLoadedReportDate(activeDashboardDate);
      return true;
    } finally {
      setSavingNote(false);
    }
  }

  async function closeCompletion() {
    const noteSaved = await persistDailyNoteIfNeeded();
    if (!noteSaved) return;
    if (trigger === "complete") {
      writeSessionKey(COMPLETE_DISMISS_KEY, activeDashboardDate);
    }
    if (trigger === "evening") {
      dismissEvening();
    }
    setTrigger(null);
  }

  async function continueToPlanner() {
    const noteSaved = await persistDailyNoteIfNeeded();
    if (!noteSaved) return;
    if (trigger === "complete") {
      writeSessionKey(COMPLETE_DISMISS_KEY, activeDashboardDate);
    }
    if (trigger === "evening") {
      dismissEvening();
    }
    setTrigger(null);
    setPlannerOpen(true);
  }

  if (plannerOpen) {
    return (
      <PlanTomorrowModal
        planDate={tomorrow}
        startOpen
        onClose={() => setPlannerOpen(false)}
      />
    );
  }

  if (!trigger || !sessionId || kickoffPending) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
    >
      <div
        className="bg-white w-full max-w-[640px] rounded-3xl shadow-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #0d4a36, #006c4a)" }} />

        <div className="px-8 pt-8 pb-0">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,108,74,0.1)" }}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ color: "#006c4a" }}>
                {trigger === "complete" ? "check_circle" : "bedtime"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                Step 1 of 2
              </p>
              <h2
                id="completion-modal-title"
                className="font-headline text-2xl font-extrabold leading-tight"
                style={{ color: "#1a1f1e" }}
              >
                {trigger === "complete" ? "Close the day while the signal is fresh" : "Wrap today, then set up tomorrow"}
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "#8a9e97" }}>
                {scheduleNote ?? (
                  trigger === "complete"
                    ? `Everything on ${formatPlanDateLabel(activeDashboardDate)} is complete. Capture the signal now, then lock ${formatPlanDateLabel(tomorrow)} in.`
                    : `It’s 6:00 PM in your local time (${timeZoneLabel}). Review the real signal from today, then decide tomorrow on purpose.`
                )}
              </p>
            </div>
          </div>

          <div
            className="rounded-[26px] p-5 mb-5"
            style={{ background: "linear-gradient(180deg, rgba(0,108,74,0.08), rgba(0,108,74,0.03))", border: "1px solid rgba(0,108,74,0.12)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
              Daily reflection
            </p>
            {loadingReport ? (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                Generating today’s reflection...
              </p>
            ) : (
              <>
                <h3 className="mt-2 text-base font-extrabold" style={{ color: "#1a1f1e" }}>
                  {narrative.summary}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                  {narrative.reflection}
                </p>
                {narrative.tomorrowFocus && (
                  <div
                    className="mt-4 rounded-2xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.78)", border: "1px solid rgba(0,108,74,0.08)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                      Carry forward
                    </p>
                    <p className="mt-1.5 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                      {narrative.tomorrowFocus}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className="rounded-[26px] p-5 mb-5"
            style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Your context
                </p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "#5a6b65" }}>
                  Add anything the system should remember about why the day went this way. This note stays attached to today&apos;s review and can inform later summaries.
                </p>
              </div>
              {savingNote ? (
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Saving
                </span>
              ) : null}
            </div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Example: I lost the afternoon because the client call overran, so the unfinished work was not procrastination, it was a timing problem."
              rows={4}
              className="mt-4 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ border: "1px solid rgba(0,0,0,0.08)", background: "#fff", color: "#1a1f1e" }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="rounded-2xl px-4 py-3.5" style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                Main goals
              </p>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                {todayPriorities.filter((item) => item.completed).length}/{todayPriorities.length} done
              </p>
            </div>
            <div className="rounded-2xl px-4 py-3.5" style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                Secondary goals
              </p>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                {todayTasks.filter((item) => item.completed).length}/{todayTasks.length} done
              </p>
            </div>
            <div className="rounded-2xl px-4 py-3.5" style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                Routines
              </p>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                {activeHabits.filter((habit) => habit.completedToday).length}/{activeHabits.length} done
              </p>
            </div>
          </div>

          {reportError && (
            <div
              className="mb-6 rounded-2xl px-4 py-3 text-sm"
              style={{ background: "rgba(165,42,42,0.08)", color: "#8b2c2c" }}
            >
              {reportError}
            </div>
          )}
        </div>

        <div
          className="px-8 py-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <button
            type="button"
            onClick={() => {
              void closeCompletion();
            }}
            disabled={savingNote}
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
          >
            {trigger === "evening" ? "Remind me tomorrow" : "Close for now"}
          </button>
          <button
            type="button"
            onClick={() => {
              void continueToPlanner();
            }}
            disabled={savingNote}
            className="flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
          >
            {trigger === "evening" ? "Done for today" : "Plan tomorrow"}
            <span className="material-symbols-outlined text-[18px]">east</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Canonical completion state-machine entrypoint. Both all-done and 6 PM paths flow through here. */
export function CompletionModal() {
  return (
    <Suspense fallback={null}>
      <CompletionModalInner />
    </Suspense>
  );
}
