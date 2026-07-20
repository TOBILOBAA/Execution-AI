"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DashboardMetrics } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getGoalDisplayProgress, getWeekNumber } from "@/lib/goalsView";
import { useShallow } from "zustand/react/shallow";

interface AnalyticsPanelProps {
  metrics: DashboardMetrics;
}

function clampProgress(value: number | undefined) {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function getReferenceDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function AnalyticsPanel({ metrics }: AnalyticsPanelProps) {
  const {
    yearlyGoals,
    monthlyGoals,
    weeklyGoals,
    categories,
    activeDashboardDate,
    sessionWeekStartsOn,
  } = useAppStore(
    useShallow((state) => ({
      yearlyGoals: state.yearlyGoals,
      monthlyGoals: state.monthlyGoals,
      weeklyGoals: state.weeklyGoals,
      categories: state.categories,
      activeDashboardDate: state.activeDashboardDate,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
    })),
  );

  const referenceDate = getReferenceDate(activeDashboardDate);
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const currentWeek = getWeekNumber(referenceDate, sessionWeekStartsOn);

  const currentYearGoals = useMemo(
    () => yearlyGoals.filter((goal) => goal.year === currentYear),
    [currentYear, yearlyGoals],
  );

  const currentMonthlyGoals = useMemo(
    () => monthlyGoals.filter((goal) => goal.year === currentYear && goal.month === currentMonth),
    [currentMonth, currentYear, monthlyGoals],
  );

  const currentWeeklyGoals = useMemo(
    () => weeklyGoals.filter((goal) => goal.year === currentYear && goal.weekNumber === currentWeek),
    [currentWeek, currentYear, weeklyGoals],
  );

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const yearlyProgressByGoalId = useMemo(() => {
    const direct = new Map<string, number>();
    currentYearGoals.forEach((goal) => {
      direct.set(goal.id, getGoalDisplayProgress(goal));
    });
    return direct;
  }, [currentYearGoals]);

  const averageProgress = currentYearGoals.length
    ? Math.round(
        currentYearGoals.reduce((sum, goal) => sum + (yearlyProgressByGoalId.get(goal.id) ?? getGoalDisplayProgress(goal)), 0) /
          currentYearGoals.length,
      )
    : 0;
  const completedYearlyGoals = currentYearGoals.filter((goal) => getGoalDisplayProgress(goal) >= 100).length;

  const highlightedYearlyGoals = useMemo(
    () =>
      [...currentYearGoals]
        .sort(
          (a, b) =>
            (yearlyProgressByGoalId.get(b.id) ?? getGoalDisplayProgress(b)) -
            (yearlyProgressByGoalId.get(a.id) ?? getGoalDisplayProgress(a)),
        )
        .slice(0, 2),
    [currentYearGoals, yearlyProgressByGoalId],
  );
  const currentWeeklyObjective = useMemo(
    () =>
      currentWeeklyGoals.find((goal) => goal.isMain) ??
      [...currentWeeklyGoals].sort((a, b) => getGoalDisplayProgress(b) - getGoalDisplayProgress(a))[0] ??
      null,
    [currentWeeklyGoals],
  );
  const currentMonthlyObjective = useMemo(
    () =>
      currentMonthlyGoals.find((goal) => goal.isMain) ??
      [...currentMonthlyGoals].sort((a, b) => getGoalDisplayProgress(b) - getGoalDisplayProgress(a))[0] ??
      null,
    [currentMonthlyGoals],
  );

  const weeklyObjectiveProgress = currentWeeklyObjective
    ? getGoalDisplayProgress(currentWeeklyObjective)
    : clampProgress(metrics.weeklyCompletionRate);
  const monthlyObjectiveProgress = currentMonthlyObjective
    ? getGoalDisplayProgress(currentMonthlyObjective)
    : clampProgress(metrics.monthlyCompletionRate);
  const contextualRailCopy = currentWeeklyObjective
    ? `This week is anchored by "${currentWeeklyObjective.title}". Keep today connected to that outcome.`
    : currentMonthlyObjective
      ? `This month still needs a clear weekly push. Keep "${currentMonthlyObjective.title}" moving with the next concrete step.`
      : currentYearGoals.length > 0
        ? "Your yearly progress moves when monthly and weekly goals stay connected to what you actually complete."
        : "Start by saving the outcomes you want this year, then connect this month and week to them.";
  const contextualRailHref = currentWeeklyObjective
    ? `/dashboard/goals/${currentYear}/weekly`
    : `/dashboard/goals/${currentYear}`;
  const contextualRailCta = currentWeeklyObjective ? "Open weekly goals" : "Open goals";

  return (
    <div
      className="rounded-[30px] p-6 text-white md:p-7"
      style={{
        background: "linear-gradient(180deg, #0f1d18 0%, #13231d 100%)",
        boxShadow: "0 22px 60px rgba(10, 18, 15, 0.22)",
      }}
    >
      <div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.58)" }}>
              Yearly Progress
            </p>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.12em]"
              style={{ border: "1px solid rgba(127,243,190,0.34)", color: "#85f8c4", background: "rgba(127,243,190,0.08)" }}
            >
              {currentYear}
            </span>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-headline text-[72px] font-extrabold leading-none tracking-[-0.06em]" style={{ color: "#85f8c4" }}>
              {averageProgress}%
            </span>
          </div>
          <p className="mt-2 max-w-[320px] text-[15px] leading-7" style={{ color: "rgba(255,255,255,0.62)" }}>
            average progress across your yearly goals
          </p>
          <p className="mt-2 text-sm leading-6" style={{ color: "rgba(255,255,255,0.48)" }}>
            {currentYearGoals.length > 0
              ? `${completedYearlyGoals} of ${currentYearGoals.length} yearly goals completed`
              : "No yearly goals saved for this year yet."}
          </p>
        </div>
      </div>

      <div className="mt-8 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />

      <div className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.58)" }}>
            Yearly Goals Overview
          </p>
          <Link
            href={`/dashboard/goals/${currentYear}`}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[15px] font-semibold transition-opacity hover:opacity-85"
            style={{ color: "#85f8c4" }}
          >
            View all
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>

        <div className="mt-5 space-y-0">
          {highlightedYearlyGoals.length === 0 ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-6">
              <p className="text-[17px] font-medium text-white/82">No yearly goals saved for this year yet.</p>
              <p className="mt-2 text-sm leading-7 text-white/54">
                Start by adding the outcomes you want this year, then connect them to your monthly and weekly execution.
              </p>
            </div>
          ) : (
            highlightedYearlyGoals.map((goal, index) => {
              const category = goal.categoryId ? categoryById.get(goal.categoryId) : null;
              const progress = yearlyProgressByGoalId.get(goal.id) ?? getGoalDisplayProgress(goal);
              return (
                <div
                  key={goal.id}
                  className={`${index > 0 ? "border-t" : ""} py-4`}
                  style={{ borderColor: "rgba(255,255,255,0.10)" }}
                >
                  <div className="grid grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-3">
                    <div
                      className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px]"
                      style={{
                        background: category?.color
                          ? `${category.color}22`
                          : "linear-gradient(180deg, rgba(127,243,190,0.12) 0%, rgba(127,243,190,0.04) 100%)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span className="material-symbols-outlined text-[20px]" style={{ color: category?.color || "#85f8c4" }}>
                        {category?.icon || "track_changes"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-white">{goal.title}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #7ff3be 0%, #6bddac 100%)" }}
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[15px] font-semibold tracking-[-0.02em]" style={{ color: "#85f8c4" }}>
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-7 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />

      <ObjectiveRow
        label="Weekly Objective"
        title={(currentWeeklyObjective?.title ?? metrics.weeklyObjective) || "No weekly sprint saved for this week yet."}
        progress={weeklyObjectiveProgress}
        href={`/dashboard/goals/${currentYear}/weekly`}
      />

      <div className="mt-5 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />

      <ObjectiveRow
        label="Monthly Objective"
        title={(currentMonthlyObjective?.title ?? metrics.monthlyContext) || "No monthly objective is connected yet."}
        progress={monthlyObjectiveProgress}
        href={`/dashboard/goals/${currentYear}`}
      />

      <div className="mt-7 h-px" style={{ background: "rgba(255,255,255,0.10)" }} />

      <div className="mt-6 space-y-4">
        <p className="text-[14px] leading-7" style={{ color: "rgba(255,255,255,0.58)" }}>
          {contextualRailCopy}
        </p>
        <Link
          href={contextualRailHref}
          className="inline-flex items-center gap-2 text-[15px] font-semibold transition-opacity hover:opacity-85"
          style={{ color: "#85f8c4" }}
        >
          <span className="material-symbols-outlined text-[18px]">north_east</span>
          {contextualRailCta}
        </Link>
      </div>
    </div>
  );
}

function ObjectiveRow({
  label,
  title,
  progress,
  href,
}: {
  label: string;
  title: string;
  progress: number;
  href: string;
}) {
  return (
    <div className="mt-6">
      <p className="text-[13px] font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.54)" }}>
        {label}
      </p>

      <Link
        href={href}
        className="mt-5 grid grid-cols-[40px_minmax(0,1.2fr)_48px_74px_18px] items-center gap-3 transition-opacity hover:opacity-90"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#7ff3be]/30 bg-[#7ff3be]/8">
          <span className="material-symbols-outlined text-[20px]" style={{ color: "#85f8c4" }}>
            task_alt
          </span>
        </span>
        <p className="line-clamp-2 pr-1 text-[15px] leading-6 text-white">{title}</p>
        <span className="text-right text-[17px] font-semibold tracking-[-0.02em]" style={{ color: "#85f8c4" }}>
          {progress}%
        </span>
        <div className="h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #7ff3be 0%, #6bddac 100%)" }}
          />
        </div>
        <span className="material-symbols-outlined text-[20px]" style={{ color: "rgba(255,255,255,0.42)" }}>
          chevron_right
        </span>
      </Link>
    </div>
  );
}
