"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAppStore } from "@/lib/store";
import { activityApi, ApiActivityOverview, ApiDailyUserActivity } from "@/lib/api";

const DAY_RANGE_OPTIONS = [14, 30] as const;

function formatDateLabel(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeLabel(isoDateTime?: string) {
  if (!isoDateTime) return "Not seen yet";
  return new Date(isoDateTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stageMeta(stage: ApiActivityOverview["current_stage"]) {
  switch (stage) {
    case "executing":
      return { label: "Executing", tone: "#006c4a", bg: "rgba(0,108,74,0.10)" };
    case "reviewing":
      return { label: "Reviewing", tone: "#155eef", bg: "rgba(21,94,239,0.10)" };
    case "daily_planning":
      return { label: "Daily Planning", tone: "#b54708", bg: "rgba(181,71,8,0.10)" };
    case "planning_foundation":
      return { label: "Planning Foundation", tone: "#6941c6", bg: "rgba(105,65,198,0.10)" };
    case "inactive":
      return { label: "Inactive", tone: "#b42318", bg: "rgba(180,35,24,0.10)" };
    default:
      return { label: "Onboarding", tone: "#667085", bg: "rgba(102,112,133,0.10)" };
  }
}

function buildRecentCalendar(days: number, rows: ApiDailyUserActivity[]) {
  const byDate = new Map(rows.map((row) => [row.activity_date, row]));
  const today = new Date();
  const calendar: Array<{ date: string; row: ApiDailyUserActivity | null }> = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const iso = day.toISOString().slice(0, 10);
    calendar.push({ date: iso, row: byDate.get(iso) ?? null });
  }

  return calendar;
}

function summarizeDay(row: ApiDailyUserActivity | null) {
  if (!row) {
    return {
      label: "Absent",
      detail: "No activity row was recorded for this day.",
      accent: "#b42318",
      bg: "rgba(180,35,24,0.08)",
      border: "rgba(180,35,24,0.16)",
    };
  }
  if (row.approved_next_day_review || row.handled_recap) {
    return {
      label: "Review",
      detail: "The user closed a feedback loop or approved the next-day setup.",
      accent: "#155eef",
      bg: "rgba(21,94,239,0.08)",
      border: "rgba(21,94,239,0.16)",
    };
  }
  if (row.completed_tasks_count > 0 || row.completed_habits_count > 0) {
    return {
      label: "Execution",
      detail: `Completed ${row.completed_tasks_count} task(s) and ${row.completed_habits_count} habit(s).`,
      accent: "#006c4a",
      bg: "rgba(0,108,74,0.08)",
      border: "rgba(0,108,74,0.14)",
    };
  }
  if (row.created_daily_plan || row.created_weekly_goal || row.created_monthly_goal || row.created_yearly_goal) {
    return {
      label: "Planning",
      detail: "A planning layer was created or updated on this day.",
      accent: "#b54708",
      bg: "rgba(181,71,8,0.08)",
      border: "rgba(181,71,8,0.16)",
    };
  }
  return {
    label: "Visited",
    detail: "The app was opened, but there was no strong execution signal.",
    accent: "#667085",
    bg: "rgba(102,112,133,0.08)",
    border: "rgba(102,112,133,0.16)",
  };
}

export default function AnalyticsDashboardPage() {
  const sessionId = useAppStore((state) => state.sessionId);
  const currentUser = useAppStore((state) => state.currentUser);
  const [range, setRange] = useState<(typeof DAY_RANGE_OPTIONS)[number]>(14);
  const [overview, setOverview] = useState<ApiActivityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setLoading(true);
    activityApi
      .getOverview(sessionId, range)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load analytics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, range]);

  const recentCalendar = useMemo(
    () => buildRecentCalendar(range, overview?.recent_days ?? []),
    [overview?.recent_days, range],
  );

  const stage = overview ? stageMeta(overview.current_stage) : null;
  const todayRow = overview?.recent_days.find((row) => row.activity_date === new Date().toISOString().slice(0, 10)) ?? null;

  const refresh = () => {
    if (!sessionId) return;
    startRefresh(() => {
      activityApi
        .getOverview(sessionId, range)
        .then((data) => {
          setOverview(data);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Could not refresh analytics."));
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <section
        className="rounded-[30px] p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, #0f2a1f 0%, #12392a 56%, #f4fbf7 56%, #f9fcfa 100%)",
          boxShadow: "0 24px 56px rgba(18,57,42,0.16)",
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "rgba(133,248,196,0.72)" }}>
                Admin Analytics
              </p>
              <h1 className="mt-2 font-headline text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                Usage pulse for this workspace.
              </h1>
              <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.74)" }}>
                Track whether {currentUser?.name ?? "this user"} is showing up daily, what layer they reached, and where their execution cadence starts to fade.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {DAY_RANGE_OPTIONS.map((option) => {
                const active = option === range;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors"
                    style={{
                      background: active ? "#85f8c4" : "rgba(255,255,255,0.08)",
                      color: active ? "#0f2a1f" : "rgba(255,255,255,0.74)",
                    }}
                  >
                    Last {option} days
                  </button>
                );
              })}
              <button
                type="button"
                onClick={refresh}
                className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.74)" }}
              >
                {isRefreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>

          <div
            className="rounded-[28px] p-5 sm:p-6"
            style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.5)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Current Stage
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                  {stage?.label ?? "Loading"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  {overview?.days_since_last_seen === undefined
                    ? "We have not seen this workspace yet."
                    : overview.days_since_last_seen === 0
                      ? "They have been seen today."
                      : `They were last seen ${overview.days_since_last_seen} day(s) ago.`}
                </p>
              </div>
              {stage && (
                <span
                  className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: stage.tone, background: stage.bg }}
                >
                  {stage.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: "rgba(180,35,24,0.08)", border: "1px solid rgba(180,35,24,0.18)", color: "#b42318" }}
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] p-5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>Last Seen</p>
          <p className="mt-3 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            {loading ? "..." : formatDateTimeLabel(overview?.last_seen_at)}
          </p>
          <p className="mt-2 text-sm" style={{ color: "#6b7c75" }}>
            Most recent moment this workspace opened the app.
          </p>
        </div>

        <div className="rounded-[24px] p-5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>Last Active</p>
          <p className="mt-3 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            {loading ? "..." : formatDateTimeLabel(overview?.last_active_at)}
          </p>
          <p className="mt-2 text-sm" style={{ color: "#6b7c75" }}>
            Updated when the user actually plans, executes, or reviews.
          </p>
        </div>

        <div className="rounded-[24px] p-5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>Today&apos;s Output</p>
          <p className="mt-3 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            {todayRow ? `${todayRow.completed_tasks_count}T / ${todayRow.completed_habits_count}H` : "No signal"}
          </p>
          <p className="mt-2 text-sm" style={{ color: "#6b7c75" }}>
            Tasks and habits completed so far today.
          </p>
        </div>

        <div className="rounded-[24px] p-5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>Onboarding Evidence</p>
          <p className="mt-3 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            {overview?.onboarding_evidence.complete ? "Complete" : "Incomplete"}
          </p>
          <p className="mt-2 text-sm" style={{ color: "#6b7c75" }}>
            Verified against actual yearly, monthly, weekly, and daily setup data.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <div
          className="rounded-[28px] p-5 sm:p-6 space-y-4"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Integrity Checklist
            </p>
            <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
              Setup proof
            </h2>
          </div>

          {[
            { label: "Yearly goal exists", done: Boolean(overview?.onboarding_evidence.has_yearly_goals) },
            { label: "Monthly goal exists", done: Boolean(overview?.onboarding_evidence.has_monthly_goals) },
            { label: "Weekly goal exists", done: Boolean(overview?.onboarding_evidence.has_weekly_goals) },
            { label: "Daily plan exists", done: Boolean(overview?.onboarding_evidence.has_daily_plan) },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: item.done ? "rgba(0,108,74,0.06)" : "rgba(180,35,24,0.06)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>{item.label}</span>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: item.done ? "rgba(0,108,74,0.12)" : "rgba(180,35,24,0.12)",
                  color: item.done ? "#006c4a" : "#b42318",
                }}
              >
                {item.done ? "Yes" : "No"}
              </span>
            </div>
          ))}
        </div>

        <div
          className="rounded-[28px] p-5 sm:p-6"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                Daily Ledger
              </p>
              <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                Show-up history
              </h2>
            </div>
            <p className="text-sm" style={{ color: "#6b7c75" }}>
              Missing rows mean the user did not come in that day.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {recentCalendar.map(({ date, row }) => {
              const summary = summarizeDay(row);
              return (
                <div
                  key={date}
                  className="rounded-[24px] p-4"
                  style={{
                    background: summary.bg,
                    border: `1px solid ${summary.border}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                        {date}
                      </p>
                      <h3 className="mt-1 text-base font-bold" style={{ color: "#1a1f1e" }}>
                        {formatDateLabel(date)}
                      </h3>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ background: "#fff", color: summary.accent }}
                    >
                      {summary.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "#50615b" }}>
                    {summary.detail}
                  </p>

                  {row && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.68)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          Tasks / habits
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {row.completed_tasks_count} / {row.completed_habits_count}
                        </p>
                      </div>
                      <div className="rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.68)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          Planning
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {row.created_daily_plan || row.created_weekly_goal || row.created_monthly_goal || row.created_yearly_goal ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
