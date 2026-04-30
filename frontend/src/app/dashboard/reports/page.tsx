"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reportsApi, type ApiReport } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { CURRENT_YEAR } from "@/lib/mockData";
import { MetricInfoTooltip } from "@/components/reports/MetricInfoTooltip";
import {
  listYearSnapshots,
  monthlyCompletionRate,
  yearlyCompletionRate,
  yearlyTopPillar,
} from "@/lib/reportSnapshots";
import {
  buildExecutionScore,
  buildMomentumScore,
  buildRealismScore,
  getExecutionGrade,
  average,
} from "@/lib/reportMetrics";

export default function ReportsPage() {
  const router = useRouter();
  const { sessionId, yearlyGoals, monthlyGoals, metrics } = useAppStore(
    useShallow((state) => ({
      sessionId: state.sessionId,
      yearlyGoals: state.yearlyGoals,
      monthlyGoals: state.monthlyGoals,
      metrics: state.metrics,
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

  const currentYearGoals = yearlyGoals.filter((goal) => goal.year === CURRENT_YEAR);
  const currentYearMonthlyGoals = monthlyGoals.filter((goal) => goal.year === CURRENT_YEAR);
  const yearSnapshots = useMemo(() => listYearSnapshots(reports ?? []), [reports]);
  const generatedYears = yearSnapshots
    .filter((item) => item.yearly || item.monthly.length)
    .sort((a, b) => b.year - a.year);
  const pastYears = generatedYears.filter((item) => item.year !== CURRENT_YEAR);
  const activeYearSnapshot = generatedYears.find((item) => item.year === CURRENT_YEAR);
  const completionFromReports = yearlyCompletionRate(activeYearSnapshot?.yearly ?? null);
  const completionRate =
    completionFromReports ??
    (currentYearGoals.length
      ? Math.round(currentYearGoals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / currentYearGoals.length)
      : Math.min(100, metrics.monthlyCompletionRate ?? 0));
  const consistencyScore = average(metrics.weeklyConsistency ?? []);
  const linkedMonthlyGoals = currentYearMonthlyGoals.filter((goal) => goal.yearlyGoalId).length;
  const alignmentScore = currentYearMonthlyGoals.length
    ? Math.round((linkedMonthlyGoals / currentYearMonthlyGoals.length) * 100)
    : 0;
  const realismScore = buildRealismScore(completionRate);
  const momentumScore = buildMomentumScore(
    (activeYearSnapshot?.monthly ?? [])
      .map((report) => monthlyCompletionRate(report))
      .filter((rate): rate is number => rate !== null),
  );
  const executionScore = buildExecutionScore({
    completion: completionRate,
    consistency: consistencyScore,
    alignment: alignmentScore,
    realism: realismScore,
    momentum: momentumScore,
  });
  const executionGrade = getExecutionGrade(executionScore);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#006c4a" }}>
          Reports
        </p>
        <h1
          className="font-headline font-extrabold tracking-tight mb-3"
          style={{ fontSize: "clamp(32px,5vw,48px)", color: "#1a1f1e", lineHeight: 1.1 }}
        >
          Your execution archive.
        </h1>
        <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "#6b7b74" }}>
          Start with the active year. Open a specific year to see the full breakdown across overview, quarterly,
          monthly, weekly, and daily report layers.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.20)" }}>
          <p className="text-sm" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        </div>
      )}

      <section
        className="rounded-[28px] p-7 md:p-8"
        style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.07)", boxShadow: "0 8px 28px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
              Active year
            </p>
            <h2 className="font-headline font-extrabold mt-2" style={{ fontSize: "56px", lineHeight: 1, color: "#006c4a" }}>
              {CURRENT_YEAR}
            </h2>
            <p className="text-sm mt-3 leading-relaxed max-w-xl" style={{ color: "#5d6d67" }}>
              {executionGrade.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/reports/${CURRENT_YEAR}`)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
            style={{ background: "#006c4a", color: "#fff" }}
          >
            Open active year
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 mt-8">
          {[
            {
              label: "Execution Score",
              value: `${executionGrade.grade}`,
              subvalue: `${executionScore} / 100`,
              helper: `${executionGrade.label} · ${executionGrade.rangeLabel}`,
              detail: "A = 85-100, B = 70-84, C = 55-69, D = 40-54, F = 0-39. The grade blends completion, consistency, alignment, realism, and momentum.",
            },
            {
              label: "Completion",
              value: `${completionRate}%`,
              subvalue: "planned work finished",
              detail: "How much of your planned work actually got completed.",
            },
            {
              label: "Consistency",
              value: `${consistencyScore}%`,
              subvalue: "showing up regularly",
              detail: "How regularly you show up and take meaningful action.",
            },
            {
              label: "Alignment",
              value: `${alignmentScore}%`,
              subvalue: "linked to goals",
              detail: "How much of your monthly work is tied back to bigger goals.",
            },
            {
              label: "Realism",
              value: `${realismScore}%`,
              subvalue: "plan accuracy",
              detail: "Whether your plan looks achievable relative to your actual completion capacity.",
            },
            {
              label: "Momentum",
              value: `${momentumScore}%`,
              subvalue: "sustained progress",
              detail: "Whether your execution is being sustained across time instead of dropping off.",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl p-4"
              style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  {metric.label}
                </p>
                <MetricInfoTooltip label={metric.label} detail={metric.detail} />
              </div>
              <p className="font-headline font-extrabold mt-3" style={{ fontSize: "30px", color: "#1a1f1e", lineHeight: 1 }}>
                {metric.value}
              </p>
              <p className="text-xs mt-2" style={{ color: "#6b7c75" }}>
                {metric.subvalue}
              </p>
              {"helper" in metric && metric.helper && (
                <p className="text-xs mt-2" style={{ color: "#006c4a" }}>
                  {metric.helper}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
              Past years
            </p>
            <h2 className="font-headline font-bold text-2xl mt-1" style={{ color: "#1a1f1e" }}>
              Historical report archive
            </h2>
          </div>
          {reports === null && (
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#c4d0cb" }}>
              Loading
            </span>
          )}
        </div>

        {!sessionId ? (
          <div className="rounded-2xl p-6 bg-white" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <p className="text-sm" style={{ color: "#8a9e97" }}>
              Sign in and create a backend session to build a report archive.
            </p>
          </div>
        ) : pastYears.length === 0 ? (
          <div className="rounded-2xl p-6 bg-white" style={{ border: "1.5px dashed rgba(0,108,74,0.25)" }}>
            <p className="text-sm" style={{ color: "#8a9e97" }}>
              No past yearly reports are available yet. They will appear here once historical snapshots exist.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pastYears.map((item) => {
              const yearlyRate = yearlyCompletionRate(item.yearly);
              return (
                <button
                  key={item.year}
                  type="button"
                  onClick={() => router.push(`/dashboard/reports/${item.year}`)}
                  className="rounded-2xl p-5 text-left transition-all hover:opacity-80"
                  style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.07)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>
                        {item.year}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                        {item.monthly.length} monthly report{item.monthly.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                    >
                      {yearlyRate === null ? "No score" : `${yearlyRate}%`}
                    </span>
                  </div>
                  <p className="text-sm mt-4 leading-relaxed" style={{ color: "#5d6d67" }}>
                    {yearlyTopPillar(item.yearly) ?? "Open this year to review its saved report layers."}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
