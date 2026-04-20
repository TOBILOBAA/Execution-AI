"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reportsApi, type ApiReport } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import {
  getYearSnapshot,
  monthName,
  monthlyCompletionRate,
  monthlySummary,
  yearlyCompletionRate,
  yearlySummary,
  yearlyTopPillar,
} from "@/lib/reportSnapshots";

export default function YearlyReportPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const sessionId = useAppStore((state) => state.sessionId);
  const [reports, setReports] = useState<ApiReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || Number.isNaN(year)) return;

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
  }, [sessionId, year]);

  const snapshot = useMemo(() => getYearSnapshot(reports ?? [], year), [reports, year]);

  if (Number.isNaN(year)) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "#8a9e97" }}>
          Invalid year.
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

  const yearlyReport = snapshot?.yearly ?? null;
  const monthlyReports = snapshot?.monthly ?? [];
  const hasAnyData = Boolean(yearlyReport || monthlyReports.length);
  const completionRate = yearlyCompletionRate(yearlyReport);
  const topPillar = yearlyTopPillar(yearlyReport);
  const summary = yearlySummary(yearlyReport);
  const yearlyMetrics = yearlyReport?.metrics as Record<string, unknown> | undefined;
  const monthsWithData = typeof yearlyMetrics?.months_with_data === "number" ? yearlyMetrics.months_with_data : monthlyReports.length;
  const tasksCompleted = typeof yearlyMetrics?.tasks_completed === "number" ? yearlyMetrics.tasks_completed : null;
  const streak = typeof yearlyMetrics?.execution_streak === "number" ? yearlyMetrics.execution_streak : null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => router.push("/dashboard/reports")}
            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
            style={{ color: "#8a9e97" }}
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>Reports
          </button>
          <span style={{ color: "#d1d9d5" }}>/</span>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
            {year}
          </span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
          Annual Archive
        </p>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1
              className="font-headline font-extrabold tracking-tight"
              style={{ fontSize: "clamp(28px,4vw,42px)", color: "#1a1f1e" }}
            >
              {year} report archive
            </h1>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: "#8a9e97" }}>
              This view is assembled from real yearly and monthly snapshots saved in the backend.
            </p>
          </div>
          {reports === null && (
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#c4d0cb" }}>
              Loading
            </span>
          )}
        </div>
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
      ) : !hasAnyData && reports !== null ? (
        <div className="rounded-2xl p-6 bg-white" style={{ border: "1.5px dashed rgba(0,108,74,0.25)" }}>
          <p className="text-sm" style={{ color: "#8a9e97" }}>
            No yearly or monthly report history exists for {year} yet.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                Completion Rate
              </p>
              <p className="font-headline font-extrabold text-4xl" style={{ color: "#1a1f1e" }}>
                {completionRate === null ? "—" : `${completionRate}%`}
              </p>
              <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                From saved yearly metrics
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                Top Pillar
              </p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                {topPillar ?? "—"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                Narrative or computed best pillar
              </p>
            </div>
            <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                Coverage
              </p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                {monthsWithData || 0} months
              </p>
              <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                {tasksCompleted === null && streak === null
                  ? "Built from generated monthly snapshots"
                  : `${tasksCompleted ?? 0} completed tasks · ${streak ?? 0} day streak`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.15)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#006c4a" }}>
                <span className="material-symbols-outlined text-[18px] text-white">auto_awesome</span>
              </div>
              <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                Yearly Narrative
              </p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
              {summary ?? "A yearly narrative has not been generated yet. Monthly report cards below still reflect saved snapshots."}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h2 className="font-headline font-bold text-xl" style={{ color: "#1a1f1e" }}>
                  Monthly Breakdown
                </h2>
                <p className="text-sm mt-1" style={{ color: "#8a9e97" }}>
                  Only months with real saved or reconstructed history appear here.
                </p>
              </div>
            </div>

            {monthlyReports.length === 0 ? (
              <div className="bg-white rounded-2xl p-6" style={{ border: "1.5px dashed rgba(0,108,74,0.25)" }}>
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No monthly report history is available for {year} yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {monthlyReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => router.push(`/dashboard/reports/${year}/${report.period_month}`)}
                    className="rounded-xl p-4 text-left transition-all hover:opacity-80"
                    style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.07)" }}
                  >
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>
                        {monthName(report.period_month).slice(0, 3)}
                      </p>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                      >
                        {monthlyCompletionRate(report) === null ? "—" : `${monthlyCompletionRate(report)}%`}
                      </span>
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#1a1f1e" }}>
                      {monthName(report.period_month)}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#8a9e97" }}>
                      {monthlySummary(report) ?? "Open for monthly metrics and narrative."}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
