"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { goalsApi } from "@/lib/api";
import { averageProgress, countGoalStates, getQuarterFromMonth, isGoalComplete } from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";

function weeksRemainingInQuarter(todayIso: string, month: number) {
  const [year, , day] = todayIso.split("-").map(Number);
  const quarter = getQuarterFromMonth(month);
  const quarterEndMonth = quarter * 3;
  const quarterEnd = new Date(Date.UTC(year, quarterEndMonth, 0));
  const now = new Date(Date.UTC(year, month - 1, day));
  const diff = quarterEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
}

function formatHeaderDate(todayIso: string) {
  const date = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return todayIso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function GoalsOverviewPage() {
  const router = useRouter();
  const metrics = useAppStore((state) => state.metrics);
  const allKnownYearlyGoals = useAppStore((state) => state.yearlyGoals);
  const sessionId = useAppStore((state) => state.sessionId);
  const backendReady = useAppStore((state) => state.backendReady);
  const activeDashboardDate = useAppStore((state) => state.activeDashboardDate);
  const [currentYear, setCurrentYear] = useState<number>(() => Number(activeDashboardDate.slice(0, 4)) || new Date().getFullYear());
  const [knownYears, setKnownYears] = useState<number[]>([currentYear]);
  const {
    ready,
    hasCachedData,
    error,
    currentMonth,
    today,
    yearlyGoals,
  } = useGoalsHierarchy(currentYear);

  useEffect(() => {
    const sessionYear = Number(today.slice(0, 4));
    if (sessionYear && sessionYear !== currentYear) {
      setCurrentYear(sessionYear);
    }
  }, [currentYear, today]);

  useEffect(() => {
    if (!sessionId || !backendReady) {
      setKnownYears([currentYear]);
      return;
    }
    let cancelled = false;
    void goalsApi.years(sessionId)
      .then((years) => {
        if (!cancelled && years.length > 0) setKnownYears(years);
      })
      .catch(() => {
        if (!cancelled) setKnownYears([currentYear]);
      });
    return () => {
      cancelled = true;
    };
  }, [backendReady, currentYear, sessionId]);

  if (!ready && !hasCachedData) {
    return <GoalsLoadingShell title="Loading goals overview" />;
  }

  const stateCounts = countGoalStates(yearlyGoals, today);
  const averageYearProgress = averageProgress(yearlyGoals);
  const consistency = metrics.weeklyConsistency.length
    ? Math.round(metrics.weeklyConsistency.reduce((sum, value) => sum + value, 0) / metrics.weeklyConsistency.length)
    : 0;
  const streak = metrics.executionStreak;
  const currentQuarter = getQuarterFromMonth(currentMonth);
  const remainingWeeks = weeksRemainingInQuarter(today, currentMonth);
  const progressRing = `conic-gradient(#0b7a53 ${averageYearProgress * 3.6}deg, #edf3ef 0deg)`;

  const fallbackYears = [...new Set([...allKnownYearlyGoals.map((goal) => goal.year), currentYear])].sort((a, b) => b - a);
  const effectiveYears = knownYears.length > 0 ? knownYears : fallbackYears;
  const pastYears = effectiveYears.filter((year) => year !== currentYear);

  const yearRows = pastYears.map((year) => {
    const goals = allKnownYearlyGoals.filter((goal) => goal.year === year);
    return {
      year,
      count: goals.length,
      progress: averageProgress(goals),
      completed: goals.filter((goal) => isGoalComplete(goal)).length,
    };
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#6b7c75" }}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Goals</span>
            <span>/</span>
            <span>Year Overview</span>
          </div>
          <h1 className="font-headline font-extrabold tracking-tight mt-6" style={{ fontSize: "32px", color: "#1a1f1e" }}>
            {currentYear} Goals Overview
          </h1>
          <p className="text-sm mt-2" style={{ color: "#6b7c75" }}>
            Your execution at a glance. Focus on what matters most.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#1a1f1e" }}>
          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
          <span>{formatHeaderDate(today)}</span>
        </div>
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.15)", color: "#8a5b12" }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-[28px] p-5 space-y-5 md:hidden"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Current year
            </p>
            <h2 className="font-headline font-extrabold text-[28px] leading-[1.05] mt-2" style={{ color: "#1a1f1e" }}>
              {currentYear} goals
            </h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#6b7c75" }}>
              Keep this year simple on phone: review progress, then jump straight into editing.
            </p>
          </div>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shrink-0"
            style={{ background: progressRing }}
          >
            <div className="w-[58px] h-[58px] rounded-full bg-white flex flex-col items-center justify-center">
              <span className="font-headline font-extrabold text-lg" style={{ color: "#1a1f1e" }}>
                {averageYearProgress}%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Yearly Goals", value: yearlyGoals.length, color: "#1a1f1e" },
            { label: "On Track", value: stateCounts["on-track"], color: "#0b7a53" },
            { label: "At Risk", value: stateCounts["at-risk"], color: "#d97706" },
            { label: "Weeks Left in Q", value: remainingWeeks, color: "#1a1f1e" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[22px] px-4 py-3"
              style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}
            >
              <p className="text-[26px] font-headline font-extrabold leading-none" style={{ color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-[11px] mt-2 font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => router.push(`/dashboard/goals/${currentYear}`)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[22px] px-4 py-3.5 text-sm font-bold"
          style={{ background: "#006c4a", color: "#fff", boxShadow: "0 16px 32px rgba(0,108,74,0.18)" }}
        >
          <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
          Open yearly goals
        </button>
      </div>

      <div
        className="hidden rounded-[28px] p-6 md:block"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Year progress
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/goals/${currentYear}`)}
            className="interactive-card inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-[0_12px_28px_rgba(0,108,74,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[--color-primary]/15"
            style={{ background: "#006c4a", color: "#fff" }}
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            Plan This Year
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-8 items-center">
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 items-center min-w-0">
            <div className="w-36 h-36 rounded-full flex items-center justify-center shrink-0 mx-auto md:mx-0" style={{ background: progressRing }}>
              <div className="w-[102px] h-[102px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]">
                <span className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>
                  {averageYearProgress}%
                </span>
                <span className="text-xs text-center" style={{ color: "#6b7c75" }}>
                  of the year completed
                </span>
              </div>
            </div>

            <div className="min-w-0 max-w-[440px]">
              <h2 className="font-headline font-bold text-[34px] leading-[1.05] tracking-tight" style={{ color: "#1a1f1e" }}>
                You&apos;re making steady progress.
              </h2>
              <p className="text-sm mt-3 leading-relaxed max-w-[340px]" style={{ color: "#6b7c75" }}>
                Stay consistent with your weekly plans to hit your yearly targets.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-x-4 gap-y-5 xl:gap-y-0">
            {[
              { label: "Yearly Goals", value: yearlyGoals.length, color: "#1a1f1e" },
              { label: "On Track", value: stateCounts["on-track"], color: "#0b7a53" },
              { label: "At Risk", value: stateCounts["at-risk"], color: "#d97706" },
              { label: "Not Started", value: stateCounts["not-started"], color: "#64748b" },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="min-w-0 xl:pl-5"
                style={{
                  borderLeft: index === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                  paddingLeft: index === 0 ? 0 : undefined,
                }}
              >
                <p className="text-[34px] font-headline font-extrabold leading-none" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-sm mt-2 leading-relaxed max-w-[110px]" style={{ color: "#6b7c75" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6">
            {[
              { label: "Overall Completion", value: `${averageYearProgress}%`, accent: "#1a1f1e", note: null },
              { label: "Consistency (weekly avg)", value: `${consistency}%`, accent: "#1a1f1e", note: null },
              { label: "Day Streak", value: streak, accent: "#1a1f1e", note: null },
              { label: `Weeks Remaining in Q${currentQuarter}`, value: remainingWeeks, accent: "#1a1f1e", note: null },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="min-w-0 lg:pl-8"
                style={{
                  borderLeft: index === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                  paddingLeft: index === 0 ? 0 : undefined,
                }}
              >
                <p className="text-[34px] font-headline font-extrabold leading-none" style={{ color: stat.accent }}>
                  {stat.value}
                </p>
                <p className="text-sm mt-2 leading-relaxed max-w-[170px]" style={{ color: "#6b7c75" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="rounded-[28px] p-6"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Other years
            </p>
            <h2 className="font-headline font-bold text-xl mt-2" style={{ color: "#1a1f1e" }}>
              Past goal years
            </h2>
          </div>
        </div>

        {yearRows.length === 0 ? (
          <p className="text-sm mt-4" style={{ color: "#8a9e97" }}>
            No other years are stored yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {yearRows.map((row) => (
              <button
                key={row.year}
                type="button"
                onClick={() => router.push(`/dashboard/goals/${row.year}`)}
                className="w-full rounded-2xl p-4 text-left flex items-center justify-between gap-4 transition-colors"
                style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <div>
                  <p className="text-lg font-headline font-bold" style={{ color: "#1a1f1e" }}>
                    {row.year}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#6b7c75" }}>
                    {row.count} yearly goal{row.count === 1 ? "" : "s"} · {row.completed} completed
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                    {row.progress}%
                  </span>
                  <span className="material-symbols-outlined text-[18px]" style={{ color: "#8a9e97" }}>
                    chevron_right
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
