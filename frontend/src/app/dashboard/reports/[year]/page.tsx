"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reportsApi, type ApiReport } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { MetricInfoTooltip } from "@/components/reports/MetricInfoTooltip";
import {
  average,
  buildExecutionScore,
  buildMomentumScore,
  buildRealismScore,
  getExecutionGrade,
} from "@/lib/reportMetrics";
import {
  getDailyReportsForYear,
  getWeeklyReportsForYear,
  getYearSnapshot,
  listQuarterSnapshots,
  monthName,
  monthlyCompletionRate,
  monthlySummary,
  monthlyTopPillar,
  yearlyCompletionRate,
  yearlySummary,
  yearlyTopPillar,
} from "@/lib/reportSnapshots";

type ArchiveTab = "overview" | "quarterly" | "monthly" | "weekly" | "daily";

const REPORT_TABS: Array<{ id: ArchiveTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "quarterly", label: "Quarterly" },
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function narrativeField(report: ApiReport | null, key: string): string | null {
  if (!report) return null;
  return asString(asRecord(report.ai_narrative)[key]);
}

function completionBadge(rate: number | null) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
      style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
    >
      {rate === null ? "No score" : `${rate}%`}
    </span>
  );
}

function weeklyRange(report: ApiReport): string {
  const metrics = asRecord(report.metrics);
  const start = asString(metrics.week_start);
  const end = asString(metrics.week_end);
  if (!start || !end) {
    return typeof report.period_week === "number" ? `Week ${report.period_week}` : "Weekly report";
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return typeof report.period_week === "number" ? `Week ${report.period_week}` : "Weekly report";
  }
  return `${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

function dailyCompletion(report: ApiReport): number | null {
  return asNumber(asRecord(report.metrics).completion_rate);
}

function firstSentence(value: string | null): string | null {
  if (!value) return null;
  const match = value.trim().match(/.*?[.!?](\s|$)/);
  return (match?.[0] ?? value).trim();
}

function compactBullets(values: Array<string | null | undefined>, fallback: string): string[] {
  const bullets = values
    .map((value) => firstSentence(value ?? null) ?? (value?.trim() || null))
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);
  return bullets.length > 0 ? bullets : [fallback];
}

function daysInYearScope(year: number): number {
  const now = new Date();
  if (year === now.getFullYear()) {
    const start = new Date(year, 0, 1);
    return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
  }
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function monthBarColor(score: number | null): string {
  if (score === null) return "#d8dfdb";
  if (score >= 75) return "#006c4a";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isoWeekCount(year: number): number {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const day = dec28.getUTCDay() || 7;
  dec28.setUTCDate(dec28.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dec28.getUTCFullYear(), 0, 1));
  return Math.ceil((((dec28.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function weekRangeForYear(year: number, week: number): { start: string; end: string } {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const day = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function prettyDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

function periodAvailabilityMessage(args: {
  kind: "quarter" | "month" | "week" | "day";
  label: string;
  status: "future" | "current" | "past";
}) {
  if (args.status === "future") {
    return `${args.label} has not started yet. Once execution begins in this ${args.kind}, its report will appear here automatically.`;
  }
  if (args.status === "current") {
    return `${args.label} is currently in progress. No ${args.kind} report has been generated yet, so this layer is still waiting for execution history.`;
  }
  return `${args.label} has no saved ${args.kind} report yet. It is shown here intentionally so the archive stays complete even when that period was not started.`;
}

function inactiveCardStyle(status: "future" | "current" | "past") {
  if (status === "future") {
    return {
      background: "#f7faf8",
      border: "1.5px dashed rgba(138,158,151,0.34)",
      color: "#53635d",
      badgeBg: "rgba(138,158,151,0.12)",
      badgeColor: "#6b7b74",
    };
  }
  if (status === "current") {
    return {
      background: "rgba(0,108,74,0.04)",
      border: "1.5px solid rgba(0,108,74,0.12)",
      color: "#3f534b",
      badgeBg: "rgba(0,108,74,0.10)",
      badgeColor: "#006c4a",
    };
  }
  return {
    background: "rgba(245,158,11,0.06)",
    border: "1.5px solid rgba(245,158,11,0.14)",
    color: "#5d574d",
    badgeBg: "rgba(245,158,11,0.12)",
    badgeColor: "#b45309",
  };
}

function inactiveBadgeLabel(status: "future" | "current" | "past") {
  if (status === "future") return "Not reached yet";
  if (status === "current") return "In progress";
  return "No report created";
}

function archiveCardTone(score: number | null) {
  if (score === null) return { border: "rgba(0,0,0,0.07)", accent: "#8a9e97" };
  if (score >= 75) return { border: "rgba(0,108,74,0.16)", accent: "#006c4a" };
  if (score >= 60) return { border: "rgba(245,158,11,0.18)", accent: "#b45309" };
  return { border: "rgba(239,68,68,0.16)", accent: "#dc2626" };
}

function scoreTone(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "Strong", color: "#006c4a" };
  if (score >= 60) return { label: "Building", color: "#b45309" };
  return { label: "Needs attention", color: "#dc2626" };
}

function metricTitle(label: string): string {
  return `${label[0].toUpperCase()}${label.slice(1)}`;
}

function weekdayLabel(dateIso: string | null | undefined): string | null {
  if (!dateIso) return null;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { weekday: "short" });
}

function diagnosisSummary(args: {
  year: number;
  completionRate: number;
  consistencyScore: number;
  alignmentScore: number;
  realismScore: number;
  momentumScore: number;
  summary: string | null;
  reflection: string | null;
}) {
  if (args.summary && args.reflection) {
    return `${firstSentence(args.summary)} ${firstSentence(args.reflection)}`.trim();
  }
  if (args.completionRate >= 70 && args.consistencyScore >= 65 && args.momentumScore >= 65) {
    return `You have shown strong intent and stable follow-through through ${args.year} so far, but there is still room to tighten the system before it plateaus.`;
  }
  return `You started ${args.year} with real intent and structure, but execution consistency and habit follow-through are now limiting how much of that plan turns into results.`;
}

export default function YearlyReportPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const sessionId = useAppStore((state) => state.sessionId);
  const monthlyGoals = useAppStore((state) => state.monthlyGoals);
  const [reports, setReports] = useState<ApiReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ArchiveTab>("overview");
  const [expandedDailyMonths, setExpandedDailyMonths] = useState<number[]>(() => [new Date().getMonth() + 1]);

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
  const yearlyReport = snapshot?.yearly ?? null;
  const monthlyReports = useMemo(() => snapshot?.monthly ?? [], [snapshot]);
  const monthlyRates = useMemo(
    () =>
      monthlyReports
        .map((report) => monthlyCompletionRate(report))
        .filter((rate): rate is number => rate !== null),
    [monthlyReports],
  );
  const quarterSnapshots = useMemo(() => listQuarterSnapshots(reports ?? [], year), [reports, year]);
  const weeklyReports = useMemo(() => getWeeklyReportsForYear(reports ?? [], year), [reports, year]);
  const dailyReports = useMemo(() => getDailyReportsForYear(reports ?? [], year), [reports, year]);

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

  const hasAnyData = Boolean(yearlyReport || monthlyReports.length || weeklyReports.length || dailyReports.length);
  const yearlyMetrics = asRecord(yearlyReport?.metrics);
  const completionRate = yearlyCompletionRate(yearlyReport) ?? average(monthlyRates);
  const topPillar = yearlyTopPillar(yearlyReport);
  const summary = yearlySummary(yearlyReport);
  const reflection = narrativeField(yearlyReport, "reflection");
  const biggestWin = narrativeField(yearlyReport, "biggest_win");
  const keyPattern = narrativeField(yearlyReport, "key_pattern");
  const nextYearFocus = narrativeField(yearlyReport, "next_year_focus");
  const monthsWithData = asNumber(yearlyMetrics.months_with_data) ?? monthlyReports.length;
  const tasksCompleted = asNumber(yearlyMetrics.tasks_completed);
  const tasksTotal = asNumber(yearlyMetrics.tasks_total);
  const percentChange = asNumber(yearlyMetrics.percent_change);
  const yearMonthlyGoals = monthlyGoals.filter((goal) => goal.year === year);
  const alignmentScore = yearMonthlyGoals.length
    ? Math.round((yearMonthlyGoals.filter((goal) => goal.yearlyGoalId).length / yearMonthlyGoals.length) * 100)
    : 0;
  const consistencyScore = dailyReports.length
    ? Math.round((dailyReports.length / daysInYearScope(year)) * 100)
    : average(
        weeklyReports
          .map((report) => asNumber(asRecord(report.metrics).habit_consistency))
          .filter((value): value is number => value !== null),
      );
  const realismScore = buildRealismScore(completionRate);
  const momentumScore = buildMomentumScore(monthlyRates);
  const executionScore = buildExecutionScore({
    completion: completionRate,
    consistency: consistencyScore,
    alignment: alignmentScore,
    realism: realismScore,
    momentum: momentumScore,
  });
  const executionGrade = getExecutionGrade(executionScore);
  const weakestMetrics = [
    { label: "completion", value: completionRate },
    { label: "consistency", value: consistencyScore },
    { label: "alignment", value: alignmentScore },
    { label: "realism", value: realismScore },
    { label: "momentum", value: momentumScore },
  ]
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);
  const monthlyByNumber = new Map(monthlyReports.map((report) => [report.period_month ?? 0, report]));
  const weeklyByNumber = new Map(
    weeklyReports
      .filter((report) => typeof report.period_week === "number")
      .map((report) => [report.period_week as number, report]),
  );
  const dailyByDate = new Map(
    dailyReports
      .filter((report) => report.period_date)
      .map((report) => [report.period_date as string, report]),
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const quarterArchive = Array.from({ length: 4 }, (_, index) => {
    const quarter = index + 1;
    const months = [index * 3 + 1, index * 3 + 2, index * 3 + 3];
    const snapshot = quarterSnapshots[index];
    const startIso = isoDate(year, months[0], 1);
    const endIso = isoDate(year, months[2], new Date(year, months[2], 0).getDate());
    const status: "future" | "current" | "past" =
      todayIso < startIso ? "future" : todayIso > endIso ? "past" : "current";
    return {
      quarter,
      label: `Q${quarter}`,
      months,
      snapshot,
      hasReport: snapshot.months.length > 0,
      status,
    };
  });
  const monthArchive = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const report = monthlyByNumber.get(month) ?? null;
    const startIso = isoDate(year, month, 1);
    const endIso = isoDate(year, month, new Date(year, month, 0).getDate());
    const status: "future" | "current" | "past" =
      todayIso < startIso ? "future" : todayIso > endIso ? "past" : "current";
    return { month, report, status };
  });
  const totalWeeks = isoWeekCount(year);
  const weekArchive = Array.from({ length: totalWeeks }, (_, index) => {
    const week = index + 1;
    const report = weeklyByNumber.get(week) ?? null;
    const range = weekRangeForYear(year, week);
    const status: "future" | "current" | "past" =
      todayIso < range.start ? "future" : todayIso > range.end ? "past" : "current";
    return { week, report, range, status };
  });
  const dailyArchiveMonths = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const daysInThisMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInThisMonth }, (_, dayIndex) => {
      const day = dayIndex + 1;
      const date = isoDate(year, month, day);
      const report = dailyByDate.get(date) ?? null;
      const status: "future" | "current" | "past" =
        date > todayIso ? "future" : date < todayIso ? "past" : "current";
      return { day, date, report, status };
    });
    return { month, days };
  });
  const weeklyScores = weeklyReports
    .map((report) => ({
      report,
      score: asNumber(asRecord(report.metrics).avg_daily_completion),
    }))
    .filter((entry): entry is { report: ApiReport; score: number } => entry.score !== null);
  const dailyScores = dailyReports
    .map((report) => ({
      report,
      score: dailyCompletion(report),
      weekday: weekdayLabel(report.period_date),
    }))
    .filter(
      (entry): entry is { report: ApiReport; score: number; weekday: string | null } =>
        entry.score !== null,
    );
  const bestWeek = weeklyScores.reduce<{ report: ApiReport; score: number } | null>(
    (best, entry) => (!best || entry.score > best.score ? entry : best),
    null,
  );
  const weakestWeek = weeklyScores.reduce<{ report: ApiReport; score: number } | null>(
    (worst, entry) => (!worst || entry.score < worst.score ? entry : worst),
    null,
  );
  const weeklyAverage = average(weeklyScores.map((entry) => entry.score));
  const recentWeeks = weeklyScores.slice(-3);
  const weeklyRecentAverage = average(recentWeeks.map((entry) => entry.score));
  const dailyByWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
    const matches = dailyScores.filter((entry) => entry.weekday === day);
    return {
      day,
      score: matches.length ? average(matches.map((entry) => entry.score)) : null,
    };
  });
  const rankedDays = dailyByWeekday.filter((entry): entry is { day: string; score: number } => entry.score !== null);
  const strongestDay = rankedDays.reduce<{ day: string; score: number } | null>(
    (best, entry) => (!best || entry.score > best.score ? entry : best),
    null,
  );
  const weakestDay = rankedDays.reduce<{ day: string; score: number } | null>(
    (worst, entry) => (!worst || entry.score < worst.score ? entry : worst),
    null,
  );
  const diagnosis = diagnosisSummary({
    year,
    completionRate,
    consistencyScore,
    alignmentScore,
    realismScore,
    momentumScore,
    summary,
    reflection,
  });
  const priorityFixes = weakestMetrics.map((metric) => metricTitle(metric.label));
  const recommendationHeadline =
    executionScore >= 70
      ? "Your system is working, but discipline and load management need tightening."
      : "Your system has structure, but the execution layer needs reinforcement.";
  const recommendationSteps = [
    realismScore < 70
      ? "Reduce secondary workload by 20-30% so your weekly plan matches your actual execution capacity."
      : null,
    consistencyScore < 70
      ? "Reinforce one or two foundational habits first, then scale your task load after follow-through stabilizes."
      : null,
    alignmentScore < 70
      ? "Link every monthly priority back to a yearly goal so effort is not spread across low-value work."
      : null,
    momentumScore < 70
      ? "Protect the part of the week where execution dips and deliberately schedule lighter recovery work there."
      : null,
    completionRate < 70
      ? "Focus on fewer commitments and finish more of them before adding new priorities."
      : null,
  ]
    .filter((step): step is string => Boolean(step))
    .slice(0, 4);

  const happeningBullets = compactBullets(
    [
      summary,
      biggestWin ? `Strongest win: ${biggestWin}` : null,
      topPillar ? `Top pillar this year: ${topPillar}` : null,
    ],
    "Your overview summary will appear here as yearly report narratives become available.",
  );
  const whyBullets = compactBullets(
    [
      keyPattern,
      reflection,
      weakestMetrics[0]
        ? `${weakestMetrics[0].label[0].toUpperCase()}${weakestMetrics[0].label.slice(1)} is the biggest drag on performance right now.`
        : null,
    ],
    "The system will explain the main behavioral drivers once more yearly narrative data exists.",
  );
  const affectsBullets = compactBullets(
    [
      completionRate < 70 ? "Lower completion is reducing the amount of planned work that turns into real results." : null,
      alignmentScore < 70 ? "Low alignment means activity is not always feeding the goals that matter most." : null,
      momentumScore < 70 ? "Momentum is harder to sustain when progress drops between reporting periods." : null,
    ],
    "The overview will explain what the current execution pattern is affecting as more data accumulates.",
  );
  const recommendationBullets = compactBullets(
    [
      nextYearFocus,
      recommendationSteps[0] ?? null,
      recommendationSteps[1] ?? null,
      recommendationSteps[2] ?? null,
    ],
    "AI recommendations will appear here once a yearly narrative has been generated.",
  );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => router.push("/dashboard/reports")}
            className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
            style={{ color: "#8a9e97" }}
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            Reports
          </button>
          <span style={{ color: "#d1d9d5" }}>/</span>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
            {year}
          </span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
          Annual archive
        </p>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1
              className="font-headline font-extrabold tracking-tight"
              style={{ fontSize: "clamp(28px,4vw,42px)", color: "#1a1f1e" }}
            >
              {year} execution report
            </h1>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: "#8a9e97" }}>
              Overview shows the full behavioral lowdown. The remaining tabs separate quarterly, monthly, weekly, and daily archives.
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
            No yearly, quarterly, monthly, weekly, or daily report history exists for {year} yet.
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-2xl p-2"
            style={{ background: "#f4f6f4", border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <div className="flex flex-wrap gap-2">
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: activeTab === tab.id ? "#fff" : "transparent",
                    color: activeTab === tab.id ? "#1a1f1e" : "#6b7b74",
                    boxShadow: activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1a1f1e" }}>
                    1. Performance Metrics
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                  {[
                    {
                      label: "Execution Score",
                      value: executionGrade.grade,
                      subvalue: `${executionScore} / 100`,
                      helper: executionGrade.label,
                      detail:
                        "A simplified grade for your execution system. It blends completion, consistency, alignment, realism, and momentum.",
                    },
                    {
                      label: "Completion",
                      value: `${completionRate}%`,
                      subvalue: "planned tasks finished",
                      detail: "How much of your planned work actually got completed.",
                    },
                    {
                      label: "Consistency",
                      value: `${consistencyScore}%`,
                      subvalue: "regular action",
                      detail: "How regularly you showed up and generated daily execution activity across this year.",
                    },
                    {
                      label: "Alignment",
                      value: `${alignmentScore}%`,
                      subvalue: "linked to goals",
                      detail: "How much of your monthly work is clearly linked back to yearly goals.",
                    },
                    {
                      label: "Realism",
                      value: `${realismScore}%`,
                      subvalue: "plan accuracy",
                      detail: "Whether the workload you set appears achievable relative to what you actually complete.",
                    },
                    {
                      label: "Momentum",
                      value: `${momentumScore}%`,
                      subvalue: "sustained progress",
                      detail: "Whether your execution is being sustained over time instead of fading between periods.",
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-white rounded-2xl p-5"
                      style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>
                          {metric.label}
                        </p>
                        <MetricInfoTooltip label={metric.label} detail={metric.detail} />
                      </div>
                      <p
                        className="font-headline font-extrabold mt-3"
                        style={{
                          color: "#1a1f1e",
                          fontSize: metric.label === "Execution Score" ? "40px" : "32px",
                          lineHeight: 1,
                        }}
                      >
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

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1a1f1e" }}>
                    2. AI Overview
                  </p>
                </div>
                <div
                  className="rounded-2xl p-6"
                  style={{ background: "linear-gradient(135deg, rgba(0,108,74,0.07), rgba(0,108,74,0.02))", border: "1.5px solid rgba(0,108,74,0.14)" }}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 max-w-3xl">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "#006c4a" }}
                      >
                        <span className="material-symbols-outlined text-white text-[20px]">auto_awesome</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#006c4a" }}>
                          AI Executive Summary
                        </p>
                        <p className="text-lg font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                          {recommendationHeadline}
                        </p>
                        <p className="text-sm leading-relaxed mt-3" style={{ color: "#4a5c54" }}>
                          {diagnosis}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl px-4 py-3" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        Priority fixes
                      </p>
                      <p className="text-sm font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                        {priorityFixes.length ? priorityFixes.join(" + ") : "Execution hygiene"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[
                    {
                      title: "What’s Happening",
                      tone: "rgba(0,108,74,0.05)",
                      border: "rgba(0,108,74,0.10)",
                      color: "#006c4a",
                      bullets: happeningBullets,
                    },
                    {
                      title: "Why It’s Happening",
                      tone: "rgba(245,158,11,0.06)",
                      border: "rgba(245,158,11,0.14)",
                      color: "#b45309",
                      bullets: whyBullets,
                    },
                    {
                      title: "What It Affects",
                      tone: "rgba(239,68,68,0.05)",
                      border: "rgba(239,68,68,0.12)",
                      color: "#dc2626",
                      bullets: affectsBullets,
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="rounded-2xl p-5"
                      style={{ background: card.tone, border: `1.5px solid ${card.border}` }}
                    >
                      <p className="font-bold text-sm mb-3" style={{ color: card.color }}>
                        {card.title}
                      </p>
                      <div className="space-y-2.5">
                        {card.bullets.map((bullet) => (
                          <div key={bullet} className="flex items-start gap-2.5">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: card.color }} />
                            <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
                              {bullet}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="rounded-2xl p-5"
                  style={{ background: "rgba(0,108,74,0.05)", border: "1.5px solid rgba(0,108,74,0.10)" }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#006c4a" }}>
                        AI Recommendation
                      </p>
                      <p className="text-sm mt-2 max-w-3xl" style={{ color: "#4a5c54" }}>
                        {executionScore >= 70
                          ? "You have shown strong intent and structured planning, but your system will improve faster if you tighten follow-through and remove low-value drag."
                          : "Your system has the right structure, but it is still carrying too much friction. Focus less, finish more, and rebuild clean execution momentum first."}
                      </p>
                    </div>
                    {typeof percentChange === "number" && (
                      <p className="text-xs" style={{ color: percentChange >= 0 ? "#006c4a" : "#b45309" }}>
                        {percentChange >= 0 ? `Up ${percentChange}%` : `${Math.abs(percentChange)}% lower`} vs previous year
                      </p>
                    )}
                  </div>
                  <div className="space-y-2.5 mb-4">
                    {recommendationBullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-2.5">
                        <span className="material-symbols-outlined text-[16px] mt-0.5" style={{ color: "#006c4a" }}>
                          check
                        </span>
                        <p className="text-sm leading-relaxed" style={{ color: "#4a5c54" }}>
                          {bullet}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {recommendationSteps.slice(0, 4).map((step, index) => (
                      <div
                        key={step}
                        className="rounded-2xl p-4"
                        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                          Next step {index + 1}
                        </p>
                        <p className="text-sm leading-relaxed mt-2" style={{ color: "#1a1f1e" }}>
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1a1f1e" }}>
                    3. Quarterly Performance
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {quarterSnapshots.map((quarter) => (
                    <div
                      key={quarter.quarter}
                      className="bg-white rounded-2xl p-5"
                      style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                            {quarter.label}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                            {quarter.months.length
                              ? quarter.months.map((monthReport) => monthName(monthReport.period_month)).join(", ")
                              : "No monthly reports yet"}
                          </p>
                        </div>
                        {completionBadge(quarter.avgCompletion)}
                      </div>
                      <p className="text-xs font-semibold mb-2" style={{ color: "#006c4a" }}>
                        {quarter.topPillar ?? "No pillar yet"}
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: "#5d6d67" }}>
                        {quarter.summary ?? "Generate monthly reports in this quarter to build its narrative."}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1a1f1e" }}>
                    4. Monthly Performance
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-12 gap-3">
                    {Array.from({ length: 12 }, (_, index) => {
                      const month = index + 1;
                      const report = monthlyByNumber.get(month) ?? null;
                      const score = report ? monthlyCompletionRate(report) : null;

                      return (
                        <div key={month} className="rounded-xl p-3" style={{ background: "#f7faf8" }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
                            {monthName(month).slice(0, 3)}
                          </p>
                          <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                            {score === null ? "—" : `${score}%`}
                          </p>
                          <div className="mt-3 h-16 flex items-end">
                            <div
                              className="w-full rounded-full"
                              style={{
                                background: monthBarColor(score),
                                height: score === null ? "6px" : `${Math.max(12, Math.round(score * 0.64))}px`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs mt-4" style={{ color: "#8a9e97" }}>
                    {tasksCompleted === null || tasksTotal === null
                      ? `${monthsWithData} month${monthsWithData === 1 ? "" : "s"} of report data are currently available for this year.`
                      : `${tasksCompleted}/${tasksTotal} tracked tasks were completed across the saved yearly snapshot.`}
                  </p>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1a1f1e" }}>
                    5. Weekly Performance
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      Pattern
                    </p>
                    <p className="text-sm leading-relaxed mt-3" style={{ color: "#4a5c54" }}>
                      {weeklyScores.length
                        ? `Across ${weeklyScores.length} reported weeks, your average weekly execution is ${weeklyAverage}%. Recent weeks are ${weeklyRecentAverage >= weeklyAverage ? "holding or improving" : "slipping behind"} the yearly weekly average.`
                        : "Weekly patterns will appear here once weekly reports have been generated."}
                    </p>
                    {weeklyScores.length > 0 && (
                      <p className="text-xs mt-3" style={scoreTone(weeklyRecentAverage).color ? { color: scoreTone(weeklyRecentAverage).color } : undefined}>
                        {scoreTone(weeklyRecentAverage).label}
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      Strongest window
                    </p>
                    <p className="font-semibold text-lg mt-3" style={{ color: "#1a1f1e" }}>
                      {bestWeek ? `Week ${bestWeek.report.period_week}` : "No weekly data yet"}
                    </p>
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: "#4a5c54" }}>
                      {bestWeek
                        ? `${weeklyRange(bestWeek.report)} performed best at ${bestWeek.score}%.`
                        : "Generate weekly reports to surface your strongest execution period."}
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      Needs attention
                    </p>
                    <p className="font-semibold text-lg mt-3" style={{ color: "#1a1f1e" }}>
                      {weakestWeek ? `Week ${weakestWeek.report.period_week}` : "No weekly data yet"}
                    </p>
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: "#4a5c54" }}>
                      {weakestWeek
                        ? `${weeklyRange(weakestWeek.report)} was the weakest at ${weakestWeek.score}%. Protect this kind of week before adding more workload.`
                        : "Weekly dips will be easier to diagnose once more report history exists."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1a1f1e" }}>
                    6. Daily Performance
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-4">
                  <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                          Daily pattern map
                        </p>
                        <p className="text-sm mt-2" style={{ color: "#4a5c54" }}>
                          Averages by day help show where execution is strongest and where momentum starts to fade.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                      {dailyByWeekday.map((entry) => (
                        <div key={entry.day} className="rounded-xl p-3" style={{ background: "#f7faf8" }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
                            {entry.day}
                          </p>
                          <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                            {entry.score === null ? "—" : `${entry.score}%`}
                          </p>
                          <div className="mt-3 h-14 flex items-end">
                            <div
                              className="w-full rounded-full"
                              style={{
                                background: monthBarColor(entry.score),
                                height: entry.score === null ? "6px" : `${Math.max(12, Math.round(entry.score * 0.56))}px`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        Strongest day
                      </p>
                      <p className="font-semibold text-lg mt-3" style={{ color: "#1a1f1e" }}>
                        {strongestDay ? strongestDay.day : "No daily data yet"}
                      </p>
                      <p className="text-sm mt-2" style={{ color: "#4a5c54" }}>
                        {strongestDay
                          ? `${strongestDay.day} is your strongest execution day on average at ${strongestDay.score}%.`
                          : "Daily reports are needed before day-level patterns can be surfaced."}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl p-5" style={{ border: "1.5px solid rgba(0,0,0,0.07)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        Weakest day
                      </p>
                      <p className="font-semibold text-lg mt-3" style={{ color: "#1a1f1e" }}>
                        {weakestDay ? weakestDay.day : "No daily data yet"}
                      </p>
                      <p className="text-sm mt-2" style={{ color: "#4a5c54" }}>
                        {weakestDay
                          ? `${weakestDay.day} is where your execution usually slips first at ${weakestDay.score}%.`
                          : "Weak days become visible once daily reports accumulate."}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "quarterly" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quarterArchive.map((quarter) => {
                const strongestMonth = [...quarter.snapshot.months]
                  .map((report) => ({
                    report,
                    score: monthlyCompletionRate(report),
                  }))
                  .filter((entry): entry is { report: ApiReport; score: number } => entry.score !== null)
                  .sort((a, b) => b.score - a.score)[0] ?? null;

                if (!quarter.hasReport) {
                  const inactive = inactiveCardStyle(quarter.status);
                  return (
                    <div
                      key={quarter.label}
                      className="rounded-2xl p-6"
                      style={{ background: inactive.background, border: inactive.border }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="font-headline font-bold text-2xl" style={{ color: inactive.color }}>
                            {quarter.label}
                          </p>
                          <p className="text-sm mt-1" style={{ color: "#7c8d86" }}>
                            {quarter.months.map((month) => monthName(month)).join(", ")}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: inactive.badgeBg, color: inactive.badgeColor }}
                        >
                          {inactiveBadgeLabel(quarter.status)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: inactive.color }}>
                        {periodAvailabilityMessage({ kind: "quarter", label: quarter.label, status: quarter.status })}
                      </p>
                    </div>
                  );
                }

                const tone = archiveCardTone(quarter.snapshot.avgCompletion);

                return (
                  <div
                    key={quarter.label}
                    className="bg-white rounded-2xl p-6"
                    style={{ border: `1.5px solid ${tone.border}` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>
                          {quarter.label}
                        </p>
                        <p className="text-sm mt-1" style={{ color: "#8a9e97" }}>
                          {quarter.snapshot.months.map((monthReport) => monthName(monthReport.period_month)).join(", ")}
                        </p>
                      </div>
                      {completionBadge(quarter.snapshot.avgCompletion)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl p-4" style={{ background: "#f7faf8", borderLeft: `4px solid ${tone.accent}` }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                          Quarterly report
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                          {firstSentence(quarter.snapshot.summary) ??
                            "A quarterly narrative has been stitched from the monthly reports in this period."}
                        </p>
                      </div>
                      <div className="rounded-xl p-4" style={{ background: "#f7faf8" }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                          Strongest month
                        </p>
                        <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {strongestMonth ? `${monthName(strongestMonth.report.period_month)} (${strongestMonth.score}%)` : "-"}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#5d6d67" }}>
                      {quarter.snapshot.summary ??
                        "Monthly reports exist in this quarter, but no stitched quarter narrative has been formed yet."}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "monthly" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {monthArchive.map((entry) => {
                if (!entry.report) {
                  const inactive = inactiveCardStyle(entry.status);
                  return (
                    <div
                      key={entry.month}
                      className="rounded-2xl p-5"
                      style={{ background: inactive.background, border: inactive.border }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-headline font-bold text-xl" style={{ color: inactive.color }}>
                            {monthName(entry.month)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "#7c8d86" }}>
                            Monthly archive layer
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: inactive.badgeBg, color: inactive.badgeColor }}
                        >
                          {inactiveBadgeLabel(entry.status)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: inactive.color }}>
                        {periodAvailabilityMessage({ kind: "month", label: monthName(entry.month), status: entry.status })}
                      </p>
                    </div>
                  );
                }

                const rate = monthlyCompletionRate(entry.report);
                const tone = archiveCardTone(rate);

                return (
                  <button
                    key={entry.month}
                    type="button"
                    onClick={() => router.push(`/dashboard/reports/${year}/${entry.month}`)}
                    className="bg-white rounded-2xl p-5 text-left transition-opacity hover:opacity-80"
                    style={{ border: `1.5px solid ${tone.border}` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-headline font-bold text-xl" style={{ color: "#1a1f1e" }}>
                          {monthName(entry.month)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                          {monthlyTopPillar(entry.report) ?? "Saved monthly report"}
                        </p>
                      </div>
                      {completionBadge(rate)}
                    </div>
                    <div className="rounded-xl p-4 mb-3" style={{ background: "#f7faf8", borderLeft: `4px solid ${tone.accent}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                        Monthly report
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                        {firstSentence(monthlySummary(entry.report)) ??
                          "Open this month for its full report, reflection, and linked weekly archive."}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "#5d6d67" }}>
                      {monthlySummary(entry.report) ?? "Open this month for its full report, reflection, and linked weekly archive."}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                          Reflection
                        </p>
                        <p style={{ color: "#1a1f1e" }}>{narrativeField(entry.report, "reflection") ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                          Next focus
                        </p>
                        <p style={{ color: "#1a1f1e" }}>{narrativeField(entry.report, "next_month_focus") ?? "-"}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "weekly" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {weekArchive.map((entry) => {
                if (!entry.report) {
                  const inactive = inactiveCardStyle(entry.status);
                  return (
                    <div
                      key={entry.week}
                      className="rounded-2xl p-5"
                      style={{ background: inactive.background, border: inactive.border }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-headline font-bold text-xl" style={{ color: inactive.color }}>
                            Week {entry.week}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "#7c8d86" }}>
                            {prettyDateRange(entry.range.start, entry.range.end)}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: inactive.badgeBg, color: inactive.badgeColor }}
                        >
                          {inactiveBadgeLabel(entry.status)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: inactive.color }}>
                        {periodAvailabilityMessage({ kind: "week", label: `Week ${entry.week}`, status: entry.status })}
                      </p>
                    </div>
                  );
                }

                const weeklyRate = asNumber(asRecord(entry.report.metrics).avg_daily_completion);
                const tone = archiveCardTone(weeklyRate);
                return (
                  <div
                    key={entry.week}
                    className="bg-white rounded-2xl p-5"
                    style={{ border: `1.5px solid ${tone.border}` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-headline font-bold text-xl" style={{ color: "#1a1f1e" }}>
                          Week {entry.week}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                          {weeklyRange(entry.report)}
                        </p>
                      </div>
                      {completionBadge(weeklyRate)}
                    </div>
                    <div className="rounded-xl p-4 mb-3" style={{ background: "#f7faf8", borderLeft: `4px solid ${tone.accent}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                        Weekly report
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                        {firstSentence(narrativeField(entry.report, "summary")) ?? "A saved weekly report exists for this range."}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                          Key pattern
                        </p>
                        <p style={{ color: "#1a1f1e" }}>{narrativeField(entry.report, "key_pattern") ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
                          Next week priority
                        </p>
                        <p style={{ color: "#1a1f1e" }}>{narrativeField(entry.report, "next_week_priority") ?? "-"}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "daily" && (
            <div className="space-y-6">
              {dailyArchiveMonths.map((monthEntry) => {
                const isExpanded = expandedDailyMonths.includes(monthEntry.month);
                const savedDays = monthEntry.days.filter((entry) => entry.report).length;
                const futureDays = monthEntry.days.filter((entry) => entry.status === "future").length;
                return (
                  <section key={monthEntry.month} className="rounded-2xl border" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDailyMonths((current) =>
                          current.includes(monthEntry.month)
                            ? current.filter((month) => month !== monthEntry.month)
                            : [...current, monthEntry.month].sort((a, b) => a - b),
                        )
                      }
                      className="w-full flex items-center justify-between gap-4 p-4 text-left"
                      style={{ background: "#fff" }}
                    >
                      <div>
                        <p className="font-headline font-bold text-xl" style={{ color: "#1a1f1e" }}>
                          {monthName(monthEntry.month)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                          {savedDays > 0
                            ? `${savedDays} saved daily ${savedDays === 1 ? "report" : "reports"}`
                            : futureDays === monthEntry.days.length
                              ? "Not reached yet"
                              : "No daily reports saved yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                        >
                          {savedDays}/{monthEntry.days.length} days
                        </span>
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 items-center justify-center rounded-full transition-transform"
                          style={{
                            background: "#f3f7f5",
                            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 5.25L7 9.25L11 5.25" stroke="#5d6d67" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 p-4 pt-0">
                        {monthEntry.days.map((entry) => {
                          if (!entry.report) {
                            const inactive = inactiveCardStyle(entry.status);
                            return (
                              <div
                                key={entry.date}
                                className="rounded-xl p-3"
                                style={{ background: inactive.background, border: inactive.border }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: inactive.badgeColor }}>
                                    {pad2(entry.day)}
                                  </p>
                                  <span
                                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                                    style={{ background: inactive.badgeBg, color: inactive.badgeColor }}
                                  >
                                    {entry.status === "future" ? "Future" : entry.status === "current" ? "Today" : "Empty"}
                                  </span>
                                </div>
                                <p className="text-xs mt-2 leading-relaxed" style={{ color: inactive.color }}>
                                  {periodAvailabilityMessage({
                                    kind: "day",
                                    label: `${monthName(monthEntry.month)} ${entry.day}`,
                                    status: entry.status,
                                  })}
                                </p>
                              </div>
                            );
                          }

                          const tone = archiveCardTone(dailyCompletion(entry.report));
                          return (
                            <div
                              key={entry.date}
                              className="rounded-xl p-3"
                              style={{ background: "#fff", border: `1.5px solid ${tone.border}` }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                                  {pad2(entry.day)}
                                </p>
                                {completionBadge(dailyCompletion(entry.report))}
                              </div>
                              <p className="text-xs font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                                {narrativeField(entry.report, "top_win") ?? "Saved daily review"}
                              </p>
                              <p className="text-xs mt-2 leading-relaxed" style={{ color: "#5d6d67" }}>
                                {firstSentence(narrativeField(entry.report, "summary")) ??
                                  firstSentence(narrativeField(entry.report, "reflection")) ??
                                  "Open the saved daily report details."}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
