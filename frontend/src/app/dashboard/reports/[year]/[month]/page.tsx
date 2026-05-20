"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reportsApi, type ApiReport } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  getMonthlyReport,
  getWeeklyReportsForMonth,
  monthName,
  monthlyCompletionRate,
  monthlyLesson,
  monthlyMainGoalRate,
  monthlyNextFocus,
  monthlyReflection,
  monthlySummary,
  monthlyTopPillar,
} from "@/lib/reportSnapshots";

export default function MonthlyReportPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year: yearStr, month: monthStr } = use(params);
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const router = useRouter();
  const sessionId = useAppStore((state) => state.sessionId);
  const [reports, setReports] = useState<ApiReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || Number.isNaN(year) || Number.isNaN(month)) return;

    let cancelled = false;

    reportsApi
      .list(sessionId)
      .then((data) => {
        if (!cancelled) {
          setReports(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load reports.");
          setReports([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, year, month]);

  const report = useMemo(() => getMonthlyReport(reports ?? [], year, month), [reports, year, month]);
  const weeklyReports = useMemo(() => getWeeklyReportsForMonth(reports ?? [], year, month), [reports, year, month]);

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "#8a9e97" }}>
          Invalid report route.
        </p>
        <button
          onClick={() => router.push("/dashboard/reports")}
          className="mt-4 text-sm font-bold underline"
          style={{ color: "#006c4a" }}
        >
          Back to reports
        </button>
      </div>
    );
  }

  const label = `${monthName(month)} ${year}`;
  const metrics = (report?.metrics ?? {}) as Record<string, unknown>;
  const completionRate = monthlyCompletionRate(report);
  const mainGoalRate = monthlyMainGoalRate(report);
  const topPillar = monthlyTopPillar(report);
  const weeksCount = typeof metrics.weeks_count === "number" ? metrics.weeks_count : weeklyReports.length;
  const tasksCompleted = typeof metrics.tasks_completed === "number" ? metrics.tasks_completed : null;
  const tasksTotal = typeof metrics.tasks_total === "number" ? metrics.tasks_total : null;
  const bestWeek = typeof metrics.best_week === "number" ? metrics.best_week : null;
  const today = new Date();
  const periodKey = year * 12 + month;
  const currentPeriodKey = today.getFullYear() * 12 + (today.getMonth() + 1);
  const periodState: "future" | "current" | "past" =
    periodKey > currentPeriodKey ? "future" : periodKey < currentPeriodKey ? "past" : "current";
  const hasSavedAiReview = Boolean(report?.ai_generated_at);
  const isHistoricalSnapshot = Boolean(report) && !hasSavedAiReview;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/dashboard/reports")}
          className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: "#8a9e97" }}
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>Reports
        </button>
        <span style={{ color: "#d1d9d5" }}>/</span>
        <button
          onClick={() => router.push(`/dashboard/reports/${year}`)}
          className="text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: "#8a9e97" }}
        >
          {year}
        </button>
        <span style={{ color: "#d1d9d5" }}>/</span>
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
          {monthName(month).slice(0, 3)}
        </span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
            Monthly Snapshot
          </p>
          <h1
            className="font-headline font-extrabold tracking-tight"
            style={{ fontSize: "clamp(28px,5vw,42px)", color: "#1a1f1e" }}
          >
            {label}
          </h1>
        </div>
        {reports === null && (
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#c4d0cb" }}>
            Loading
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.20)" }}>
          <p className="text-sm" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        </div>
      )}

      {!sessionId ? (
        <div className="rounded-2xl p-6 bg-white" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
          <p className="text-sm" style={{ color: "#8a9e97" }}>
            Sign in and create a backend session to view your report history.
          </p>
        </div>
      ) : !report && reports !== null ? (
        <div className="rounded-2xl p-6 bg-white" style={{ border: "1.5px dashed rgba(0,108,74,0.25)" }}>
          <p className="text-sm" style={{ color: "#8a9e97" }}>
            {periodState === "future"
              ? `${label} has not started yet. Its archive will appear once work begins in that month.`
              : periodState === "current"
                ? `${label} is still in progress. The final monthly review will appear after the month closes.`
                : `No monthly report history exists for ${label} yet.`}
          </p>
        </div>
      ) : (
        <>
          {periodState === "current" ? (
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(0,108,74,0.05)", border: "1.5px solid rgba(0,108,74,0.12)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
                Month in progress
              </p>
              <p className="text-sm leading-relaxed mt-2" style={{ color: "#4a5c54" }}>
                This page shows the live snapshot so far. We should not treat it as the final monthly review until the month has actually closed.
              </p>
            </div>
          ) : isHistoricalSnapshot ? (
            <div
              className="rounded-2xl p-5"
              style={{ background: "#f7faf8", border: "1.5px solid rgba(0,0,0,0.07)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6b7b74" }}>
                Historical snapshot
              </p>
              <p className="text-sm leading-relaxed mt-2" style={{ color: "#4a5c54" }}>
                This month was reconstructed from saved plans, weekly reports, and execution rows. It is useful as a truthful archive snapshot, but it is not the same as a final saved AI monthly review.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                Avg Weekly Completion
              </p>
              <p className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>
                {completionRate === null ? "—" : `${completionRate}%`}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                Main Goal Rate
              </p>
              <p className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>
                {mainGoalRate === null ? "—" : `${mainGoalRate}%`}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                Coverage
              </p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                {weeksCount || 0} weeks
              </p>
              <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                {tasksCompleted === null || tasksTotal === null
                  ? "Based on saved monthly metrics"
                  : `${tasksCompleted}/${tasksTotal} completed tasks`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.15)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#006c4a" }}>
                <span className="material-symbols-outlined text-[18px] text-white">auto_awesome</span>
              </div>
              <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                {periodState === "current" ? "Live Monthly Snapshot" : isHistoricalSnapshot ? "Historical Monthly Snapshot" : "Monthly Narrative"}
              </p>
            </div>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a5c54" }}>
              {periodState === "current"
                ? monthlySummary(report) ??
                  "This month is still underway. The metrics below reflect progress so far, while the full reflection and next-month focus will appear after the period closes."
                : isHistoricalSnapshot
                  ? monthlySummary(report) ??
                    "This month was reconstructed from saved planning rows and linked weekly execution history."
                  : monthlySummary(report) ?? "No monthly summary was saved with this report."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                  Top Pillar
                </p>
                <p style={{ color: "#1a1f1e" }}>{topPillar ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                  {periodState === "current" ? "Current Status" : "Key Lesson"}
                </p>
                <p style={{ color: "#1a1f1e" }}>
                  {periodState === "current"
                    ? `${weeksCount || 0} tracked week${weeksCount === 1 ? "" : "s"} so far`
                    : monthlyLesson(report) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                  {periodState === "current" ? "Review Status" : "Next Focus"}
                </p>
                <p style={{ color: "#1a1f1e" }}>
                  {periodState === "current"
                    ? "Final reflection not generated yet"
                    : monthlyNextFocus(report) ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                {periodState === "current" ? "Current Reflection Status" : "Reflection"}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
                {periodState === "current"
                  ? "The month is still active, so this reflection intentionally stays in progress until the period closes."
                  : monthlyReflection(report) ?? "No reflection was saved with this report."}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Best Week
              </p>
              <p className="font-headline font-bold text-2xl mb-1" style={{ color: "#1a1f1e" }}>
                {bestWeek === null ? "—" : `Week ${bestWeek}`}
              </p>
              <p className="text-sm" style={{ color: "#8a9e97" }}>
                {weeklyReports.length} weekly report snapshot{weeklyReports.length === 1 ? "" : "s"} linked to this month
              </p>
            </div>
          </div>

          <div>
            <h2 className="font-headline font-bold text-xl mb-4" style={{ color: "#1a1f1e" }}>
              Weekly Snapshots In This Month
            </h2>
            {weeklyReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px dashed rgba(0,108,74,0.25)" }}>
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No weekly report history is available for this month.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {weeklyReports.map((weekly) => {
                  const weeklyMetrics = weekly.metrics as Record<string, unknown>;
                  const weeklyRate =
                    typeof weeklyMetrics.avg_daily_completion === "number"
                      ? weeklyMetrics.avg_daily_completion
                      : null;
                  const labelText =
                    typeof weekly.period_week === "number" ? `Week ${weekly.period_week}` : "Weekly report";
                  return (
                    <div
                      key={weekly.id}
                      className="bg-white rounded-xl p-4"
                      style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-semibold text-sm" style={{ color: "#1a1f1e" }}>
                          {labelText}
                        </p>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                        >
                          {weeklyRate === null ? "—" : `${weeklyRate}%`}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: "#8a9e97" }}>
                        {weekly.ai_narrative && typeof weekly.ai_narrative === "object" && "summary" in weekly.ai_narrative
                          ? String((weekly.ai_narrative as Record<string, unknown>).summary ?? "")
                          : "Open weekly reports from generation flows for deeper context."}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
