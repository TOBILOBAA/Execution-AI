"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reportsApi, type ApiReport } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getCurrentYear } from "@/lib/mockData";
import {
  listYearSnapshots,
  monthName,
  monthlyCompletionRate,
  monthlySummary,
  yearlyCompletionRate,
  yearlySummary,
  yearlyTopPillar,
} from "@/lib/reportSnapshots";
import type { Category, YearlyGoal } from "@/lib/types";

function topPillarFromYearlyGoals(goals: YearlyGoal[], categories: Category[]): string {
  if (!goals.length) return "—";
  const counts = new Map<string, number>();
  for (const g of goals) {
    const id = g.categoryId ?? "";
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let bestId = "";
  let bestN = -1;
  for (const [id, n] of counts) {
    if (n > bestN) {
      bestN = n;
      bestId = id;
    }
  }
  return categories.find((c) => c.id === bestId)?.name ?? "Mixed";
}

export default function ReportsPage() {
  const router = useRouter();
  const { sessionId, yearlyGoals, monthlyGoals, metrics, categories } = useAppStore(
    useShallow((state) => ({
      sessionId: state.sessionId,
      yearlyGoals: state.yearlyGoals,
      monthlyGoals: state.monthlyGoals,
      metrics: state.metrics,
      categories: state.categories,
    })),
  );
  const [reports, setReports] = useState<ApiReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

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
  }, [sessionId]);

  const currentYearGoals = yearlyGoals.filter((goal) => goal.year === getCurrentYear());
  const completionRate = currentYearGoals.length
    ? Math.round(currentYearGoals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / currentYearGoals.length)
    : Math.min(100, metrics.monthlyCompletionRate ?? 0);
  const topPillar = topPillarFromYearlyGoals(currentYearGoals, categories);
  const tasksLine =
    (metrics.tasksTotalToday ?? 0) > 0 || (metrics.habitsTotalToday ?? 0) > 0
      ? `Today: ${metrics.tasksCompletedToday ?? 0}/${metrics.tasksTotalToday ?? 0} priorities · ${metrics.habitsCompletedToday ?? 0}/${metrics.habitsTotalToday ?? 0} habits`
      : currentYearGoals.length
        ? `${currentYearGoals.filter((goal) => goal.status === "completed").length} yearly goals completed`
        : "Generate reports to build a historical archive";

  const yearSnapshots = useMemo(() => listYearSnapshots(reports ?? []), [reports]);
  const generatedYears = yearSnapshots.filter((item) => item.yearly || item.monthly.length);
  const recentMonthly = useMemo(
    () =>
      (reports ?? [])
        .filter((report) => report.report_type === "monthly" && report.period_month)
        .sort((a, b) => {
          if (a.period_year !== b.period_year) return b.period_year - a.period_year;
          return (b.period_month ?? 0) - (a.period_month ?? 0);
        })
        .slice(0, 6),
    [reports],
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#006c4a" }}>
          Historical Archive
        </p>
        <h1
          className="font-headline font-extrabold tracking-tight mb-3"
          style={{ fontSize: "clamp(32px,5vw,52px)", color: "#1a1f1e", lineHeight: 1.1 }}
        >
          Reports built from your actual workspace.
        </h1>
        <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "#6b7b74" }}>
          This archive reflects saved snapshots and reconstructed historical summaries from your real goals, weekly
          plans, daily execution, and habits. If a period still has no usable history, we say that plainly.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
        <div
          className="bg-white rounded-2xl p-8"
          style={{ border: "1.5px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 16px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-start justify-between mb-2 flex-wrap gap-3">
            <p className="font-headline font-extrabold" style={{ fontSize: "52px", color: "#1a1f1e", lineHeight: 1 }}>
              {getCurrentYear()}
            </p>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mt-2"
              style={{ background: "#f4f6f4", color: "#6b7c75" }}
            >
              Active workspace
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-8" style={{ color: "#006c4a" }}>
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            <span className="text-sm font-semibold">Week focus: {metrics.weeklyObjective || "Not set yet"}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Current Completion
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span
                  className="font-headline font-extrabold"
                  style={{ fontSize: "40px", color: "#1a1f1e", lineHeight: 1 }}
                >
                  {completionRate}
                </span>
                <span className="text-xl font-bold" style={{ color: "#a8b5af" }}>
                  %
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e8eeeb" }}>
                <div className="h-full rounded-full" style={{ width: `${completionRate}%`, background: "#006c4a" }} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Top Pillar
              </p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                {topPillar}
              </p>
              <p className="text-xs mt-1" style={{ color: "#a8b5af" }}>
                {tasksLine}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Monthly Goal Layers
              </p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                {monthlyGoals.filter((goal) => goal.year === getCurrentYear()).length || "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#a8b5af" }}>
                Saved monthly objectives in the current year
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push(`/dashboard/reports/${getCurrentYear()}`)}
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
            style={{ color: "#006c4a" }}
          >
            Open {getCurrentYear()} archive
            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>
                Generated Years
              </p>
              {reports === null && (
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#c4d0cb" }}>
                  Loading
                </span>
              )}
            </div>

            {!sessionId ? (
              <p className="text-sm" style={{ color: "#8a9e97" }}>
                Sign in and create a backend session to build a report archive.
              </p>
            ) : error ? (
              <p className="text-sm" style={{ color: "#b91c1c" }}>
                {error}
              </p>
            ) : generatedYears.length === 0 ? (
              <p className="text-sm" style={{ color: "#8a9e97" }}>
                No yearly or monthly report history is available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {generatedYears.map((item) => {
                  const yearlyRate = yearlyCompletionRate(item.yearly);
                  const monthlyCount = item.monthly.length;
                  return (
                    <button
                      key={item.year}
                      onClick={() => router.push(`/dashboard/reports/${item.year}`)}
                      className="w-full text-left rounded-xl px-4 py-3 transition-all hover:opacity-80"
                      style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.06)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-headline font-bold text-xl" style={{ color: "#1a1f1e" }}>
                            {item.year}
                          </p>
                          <p className="text-xs" style={{ color: "#8a9e97" }}>
                            {monthlyCount} monthly snapshot{monthlyCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                            {yearlyRate === null ? "—" : `${yearlyRate}%`}
                          </p>
                          <p className="text-[10px]" style={{ color: "#a8b5af" }}>
                            {yearlyTopPillar(item.yearly) ?? "No yearly narrative"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5" style={{ background: "#1c2b25" }}>
            <p className="text-sm font-bold mb-3" style={{ color: "#e8f5ef" }}>
              Archive Rule
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "#8ab5a0" }}>
              This archive is built only from real workspace history. We may reconstruct missing summaries from saved
              planning rows, but we never fabricate activity that is not in your data.
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-headline font-bold text-2xl mb-1" style={{ color: "#1a1f1e" }}>
              Recent Monthly Snapshots
            </h2>
            <p className="text-sm" style={{ color: "#8a9e97" }}>
              Latest monthly summaries available from your backend history.
            </p>
          </div>
        </div>

        {recentMonthly.length === 0 ? (
          <div
            className="bg-white rounded-2xl p-6"
            style={{ border: "1.5px dashed rgba(0,108,74,0.25)", background: "#fafcfb" }}
          >
            <p className="text-sm" style={{ color: "#8a9e97" }}>
              No monthly report history is available yet. As more tracked periods exist, this list will populate
              automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentMonthly.map((report) => (
              <button
                key={report.id}
                onClick={() => router.push(`/dashboard/reports/${report.period_year}/${report.period_month}`)}
                className="bg-white rounded-2xl p-5 text-left transition-all hover:opacity-80"
                style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-headline font-bold text-xl" style={{ color: "#1a1f1e" }}>
                      {monthName(report.period_month)} {report.period_year}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                      {report.status}
                    </p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: "#006c4a" }}>
                    {monthlyCompletionRate(report) === null ? "—" : `${monthlyCompletionRate(report)}%`}
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  {monthlySummary(report) ?? "No AI summary saved for this report yet."}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {generatedYears.length > 0 && (
        <div>
          <h2 className="font-headline font-bold text-2xl mb-1" style={{ color: "#1a1f1e" }}>
            Yearly Summaries
          </h2>
          <p className="text-sm mb-6" style={{ color: "#8a9e97" }}>
            Narrative snapshots only appear when a yearly report has actually been generated.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {generatedYears
              .filter((item) => item.yearly)
              .map((item) => (
                <button
                  key={`${item.year}-summary`}
                  onClick={() => router.push(`/dashboard/reports/${item.year}`)}
                  className="rounded-2xl p-6 text-left transition-opacity hover:opacity-80"
                  style={{ background: "#f7f9f8", border: "1.5px solid rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                      {item.year}
                    </p>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                    >
                      {yearlyCompletionRate(item.yearly) === null ? "No score" : `${yearlyCompletionRate(item.yearly)}%`}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
                    {yearlySummary(item.yearly) ?? "No yearly narrative saved for this report yet."}
                  </p>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
