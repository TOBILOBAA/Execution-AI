"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { useAppStore } from "@/lib/store";
import type { Category, MonthlyGoal, WeeklyGoal, YearlyGoal } from "@/lib/types";

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type QuarterStatus = "past" | "active" | "upcoming";
type GoalGroup = "active" | "at-risk" | "completed";

function fmtDate(iso?: string) {
  if (!iso) return "No due date";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtSyncTime(iso?: string | null) {
  if (!iso) return "Waiting for first sync";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Waiting for first sync";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function quarterStatus(year: number, quarter: number, currentYear: number, currentMonth: number): QuarterStatus {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  if (year < currentYear) return "past";
  if (year > currentYear) return "upcoming";
  if (currentMonth < startMonth) return "upcoming";
  if (currentMonth > endMonth) return "past";
  return "active";
}

function getQuarterForMonth(month: number) {
  return Math.ceil(month / 3);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((piece) => piece + piece)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `rgba(0,108,74,${alpha})`;
  }
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function resolveCategoryPalette(category?: Category) {
  const base = category?.color?.trim() || "#006c4a";
  return {
    base,
    subtle: hexToRgba(base, 0.12),
    border: hexToRgba(base, 0.2),
  };
}

function classifyYearlyGoal(
  goal: YearlyGoal,
  linkedMonthlyCount: number,
  today: string,
): GoalGroup {
  if (goal.status === "completed" || goal.progress >= 100) return "completed";
  const dueDate = goal.targetDate ? new Date(`${goal.targetDate}T12:00:00`) : null;
  const todayDate = new Date(`${today}T12:00:00`);
  const overdue = dueDate ? dueDate.getTime() < todayDate.getTime() : false;
  const dueSoon = dueDate ? (dueDate.getTime() - todayDate.getTime()) / 86400000 <= 45 : false;
  if (overdue || linkedMonthlyCount === 0 || (dueSoon && goal.progress < 50)) return "at-risk";
  return "active";
}

function statusMeta(group: GoalGroup) {
  if (group === "completed") {
    return {
      label: "Completed",
      color: "#0b7a53",
      background: "rgba(11,122,83,0.1)",
      border: "rgba(11,122,83,0.18)",
    };
  }
  if (group === "at-risk") {
    return {
      label: "Needs attention",
      color: "#b45309",
      background: "rgba(217,119,6,0.12)",
      border: "rgba(217,119,6,0.2)",
    };
  }
  return {
    label: "On track",
    color: "#006c4a",
    background: "rgba(0,108,74,0.1)",
    border: "rgba(0,108,74,0.18)",
  };
}

function cardToneForGroup(group: GoalGroup) {
  if (group === "completed") {
    return {
      background: "linear-gradient(180deg, rgba(247,252,250,1), rgba(241,249,245,1))",
      border: "rgba(11,122,83,0.12)",
    };
  }
  if (group === "at-risk") {
    return {
      background: "linear-gradient(180deg, rgba(255,251,245,1), rgba(255,248,240,1))",
      border: "rgba(217,119,6,0.14)",
    };
  }
  return {
    background: "linear-gradient(180deg, rgba(250,252,251,1), rgba(245,249,247,1))",
    border: "rgba(0,0,0,0.07)",
  };
}

function linkLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function YearDetailPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const openModal = useAppStore((state) => state.openModal);
  const toggleDailyPriority = useAppStore((state) => state.toggleDailyPriority);
  const [showAllSprints, setShowAllSprints] = useState(false);

  const {
    ready,
    loading,
    error,
    lastSyncedAt,
    today,
    currentMonth,
    currentWeekNumber,
    categories,
    yearlyGoals,
    monthlyGoals,
    weeklyGoals,
    selectedWeekDailyPriorities,
  } = useGoalsHierarchy(year);

  if (Number.isNaN(year)) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "#8a9e97" }}>Invalid year.</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/goals")}
          className="mt-4 text-sm font-bold underline"
          style={{ color: "#006c4a" }}
        >
          Goals hub
        </button>
      </div>
    );
  }

  if (!ready || loading) {
    return (
      <GoalsLoadingShell
        eyebrow={`${year} goals`}
        title="Checking the full execution stack"
        detail="We are loading the yearly outcomes, quarter layers, sprint links, and the most recent execution data from the server before showing anything actionable."
      />
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const isActiveYear = year === currentYear;

  const getCategory = (categoryId?: string) => categories.find((category) => category.id === categoryId);
  const monthlyByYearly = new Map<string, MonthlyGoal[]>();
  for (const monthlyGoal of monthlyGoals) {
    if (!monthlyGoal.yearlyGoalId) continue;
    const list = monthlyByYearly.get(monthlyGoal.yearlyGoalId) ?? [];
    list.push(monthlyGoal);
    monthlyByYearly.set(monthlyGoal.yearlyGoalId, list);
  }

  const weeklyByMonth = new Map<string, WeeklyGoal[]>();
  for (const weeklyGoal of weeklyGoals) {
    if (!weeklyGoal.monthlyGoalId) continue;
    const list = weeklyByMonth.get(weeklyGoal.monthlyGoalId) ?? [];
    list.push(weeklyGoal);
    weeklyByMonth.set(weeklyGoal.monthlyGoalId, list);
  }

  const yearCards = yearlyGoals.map((goal) => {
    const linkedMonthly = monthlyByYearly.get(goal.id) ?? [];
    const group = classifyYearlyGoal(goal, linkedMonthly.length, today);
    const linkedWeeklyCount = linkedMonthly.reduce(
      (count, monthlyGoal) => count + (weeklyByMonth.get(monthlyGoal.id)?.length ?? 0),
      0,
    );
    return {
      goal,
      group,
      linkedMonthly,
      linkedWeeklyCount,
      category: getCategory(goal.categoryId),
    };
  });

  const cardsByGroup = {
    active: yearCards.filter((item) => item.group === "active"),
    "at-risk": yearCards.filter((item) => item.group === "at-risk"),
    completed: yearCards.filter((item) => item.group === "completed"),
  };

  const completedCount = cardsByGroup.completed.length;
  const onTrackCount = cardsByGroup.active.length;
  const needsAttentionCount = cardsByGroup["at-risk"].length;
  const missingMonthlyPlanning = yearCards.filter((item) => item.linkedMonthly.length === 0);
  const missingDetails = yearCards.filter((item) => !item.goal.description || !item.goal.categoryId);
  const totalProgress = yearCards.length
    ? Math.round(yearCards.reduce((sum, item) => sum + item.goal.progress, 0) / yearCards.length)
    : 0;

  const currentQuarter = getQuarterForMonth(currentMonth);
  const currentMonthGoals = monthlyGoals.filter((goal) => goal.month === currentMonth);
  const currentWeekGoals = weeklyGoals.filter((goal) => goal.weekNumber === currentWeekNumber);
  const currentWeekMainGoal = currentWeekGoals.find((goal) => goal.isMain) ?? currentWeekGoals[0];
  const currentMonthMainGoal = currentMonthGoals.find((goal) => goal.isMain) ?? currentMonthGoals[0];
  const linkedYearlyForCurrentMonth = currentMonthMainGoal
    ? yearCards.find((item) => item.goal.id === currentMonthMainGoal.yearlyGoalId)?.goal
    : null;
  const linkedMonthlyForCurrentWeek = currentWeekMainGoal
    ? monthlyGoals.find((goal) => goal.id === currentWeekMainGoal.monthlyGoalId)
    : null;
  const linkedYearlyForCurrentWeek = linkedMonthlyForCurrentWeek
    ? yearCards.find((item) => item.goal.id === linkedMonthlyForCurrentWeek.yearlyGoalId)?.goal
    : null;

  const todayPriorities = selectedWeekDailyPriorities.filter((priority) => priority.date === today);
  const unlinkedTodayPriorities = todayPriorities.filter((priority) => !priority.weeklyGoalId);
  const monthlyWithoutWeekly = monthlyGoals.filter((goal) => (weeklyByMonth.get(goal.id)?.length ?? 0) === 0);
  const weeklyWithoutDaily = currentWeekGoals.filter(
    (goal) => !selectedWeekDailyPriorities.some((priority) => priority.weeklyGoalId === goal.id),
  );

  const nextBestAction =
    yearCards.length === 0
      ? {
          title: "Start with one or two real outcomes",
          body: `Add the yearly goals that matter most for ${year}. The rest of the stack becomes meaningful only after that top layer exists.`,
          action: () => openModal("add-yearly-goal"),
          actionLabel: "Add yearly goal",
        }
      : missingMonthlyPlanning.length > 0
        ? {
            title: "Add monthly depth to your annual goals",
            body: `${linkLabel(missingMonthlyPlanning.length, "yearly goal")} still ${missingMonthlyPlanning.length === 1 ? "has" : "have"} no monthly plan underneath. That is the biggest execution gap right now.`,
            action: () => router.push(`/dashboard/goals/${year}/q/q${currentQuarter}`),
            actionLabel: `Open Q${currentQuarter} board`,
          }
        : currentWeekGoals.length === 0
          ? {
              title: "Define this week's commitment",
              body: `You have monthly direction, but ISO week ${currentWeekNumber} has no weekly sprint yet. Add the one objective that should dominate this week.`,
              action: () => openModal("add-weekly-goal"),
              actionLabel: "Add weekly goal",
            }
          : todayPriorities.length === 0
            ? {
                title: "Translate the sprint into today's priorities",
                body: "The weekly sprint exists, but today has no saved execution list. Add priorities from the dashboard so the execution layer becomes actionable.",
                action: () => router.push("/dashboard"),
                actionLabel: "Open dashboard",
              }
            : {
                title: "Protect execution quality",
                body: "Your planning layers exist. Use the dashboard to keep daily priorities linked, completed, and reflective of the sprint you are actually running.",
                action: () => router.push("/dashboard"),
                actionLabel: "Review today",
              };

  const executionGaps = [
    missingMonthlyPlanning.length > 0
      ? `${linkLabel(missingMonthlyPlanning.length, "yearly goal")} ${missingMonthlyPlanning.length === 1 ? "has" : "have"} no monthly follow-through yet.`
      : null,
    monthlyWithoutWeekly.length > 0
      ? `${linkLabel(monthlyWithoutWeekly.length, "monthly goal")} ${monthlyWithoutWeekly.length === 1 ? "is" : "are"} missing weekly execution.`
      : null,
    weeklyWithoutDaily.length > 0
      ? `${linkLabel(weeklyWithoutDaily.length, "weekly goal")} this week ${weeklyWithoutDaily.length === 1 ? "is" : "are"} not linked to daily priorities.`
      : null,
    unlinkedTodayPriorities.length > 0
      ? `${linkLabel(unlinkedTodayPriorities.length, "priority", "priorities")} today ${unlinkedTodayPriorities.length === 1 ? "is" : "are"} not linked to the weekly sprint.`
      : null,
  ].filter((item): item is string => Boolean(item));

  const quarterCards = [1, 2, 3, 4].map((quarter) => {
    const quarterMonthlyGoals = monthlyGoals.filter((goal) => getQuarterForMonth(goal.month) === quarter);
    const mainGoal = quarterMonthlyGoals.find((goal) => goal.isMain) ?? quarterMonthlyGoals[0];
    const progress = quarterMonthlyGoals.length
      ? Math.round(quarterMonthlyGoals.reduce((sum, goal) => sum + goal.progress, 0) / quarterMonthlyGoals.length)
      : 0;
    return {
      quarter,
      status: quarterStatus(year, quarter, currentYear, currentMonth),
      months: MONTH_LONG.slice((quarter - 1) * 3, quarter * 3),
      mainGoal,
      goalsCount: quarterMonthlyGoals.length,
      progress,
    };
  });

  const weeklyRows = [...new Set(weeklyGoals.map((goal) => goal.weekNumber))]
    .sort((a, b) => b - a)
    .map((weekNumber) => {
      const goals = weeklyGoals.filter((goal) => goal.weekNumber === weekNumber);
      const mainGoal = goals.find((goal) => goal.isMain) ?? goals[0];
      const completed = goals.filter((goal) => goal.status === "completed" || goal.progress >= 100).length;
      return {
        weekNumber,
        mainGoal,
        total: goals.length,
        completed,
        linkedDailyCount: selectedWeekDailyPriorities.filter((priority) => {
          const linkedGoal = goals.find((goal) => goal.id === priority.weeklyGoalId);
          return Boolean(linkedGoal);
        }).length,
      };
    });

  const visibleWeeklyRows = showAllSprints ? weeklyRows : weeklyRows.slice(0, 6);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              type="button"
              onClick={() => router.push("/dashboard/goals")}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
              style={{ color: "#8a9e97" }}
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              Goals hub
            </button>
            <span style={{ color: "#d1d9d5" }}>/</span>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
              {year}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
            >
              Synced {fmtSyncTime(lastSyncedAt)}
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
            Execution stack
          </p>
          <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "32px", color: "#1a1f1e" }}>
            Where are you in the {year} execution stack?
          </h1>
          <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
            This view shows the truth of the chain: yearly outcomes, quarter planning depth, weekly sprint coverage,
            and whether today&apos;s execution is actually linked to the plan above it.
          </p>
        </div>

        <div
          className="rounded-2xl px-5 py-4 min-w-[260px]"
          style={{
            background: "linear-gradient(135deg, rgba(17,24,22,1), rgba(10,48,34,1))",
            color: "#fff",
            boxShadow: "0 12px 32px rgba(10,24,18,0.24)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Live stack
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p style={{ color: "rgba(255,255,255,0.9)" }}>
              Year: {yearCards.length > 0 ? `${yearCards.length} outcomes defined` : "No outcomes defined"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.76)" }}>
              Quarter: {currentMonthMainGoal ? currentMonthMainGoal.title : `No main monthly goal in ${MONTH_LONG[currentMonth - 1]}`}
            </p>
            <p style={{ color: "rgba(255,255,255,0.76)" }}>
              Week: {currentWeekMainGoal ? currentWeekMainGoal.title : `No main weekly goal in week ${currentWeekNumber}`}
            </p>
            <p style={{ color: "rgba(255,255,255,0.76)" }}>
              Today: {todayPriorities.length > 0 ? `${todayPriorities.length} saved priorities` : "No saved priorities yet"}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.15)", color: "#8a5b12" }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Yearly goals",
                value: String(yearCards.length),
                tone: "#1a1f1e",
                helper: yearCards.length ? `${completedCount} completed` : "Add your first outcome",
              },
              {
                label: "On track",
                value: String(onTrackCount),
                tone: "#006c4a",
                helper: needsAttentionCount > 0 ? `${needsAttentionCount} need attention` : "Healthy active goals",
              },
              {
                label: "Planning gaps",
                value: String(missingMonthlyPlanning.length),
                tone: missingMonthlyPlanning.length > 0 ? "#b45309" : "#006c4a",
                helper: "Yearly goals with no monthly follow-through",
              },
              {
                label: "Average progress",
                value: `${totalProgress}%`,
                tone: "#1a1f1e",
                helper: "Across all yearly outcomes",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-5"
                style={{
                  background: "#fff",
                  border: "1.5px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  {stat.label}
                </p>
                <p className="mt-2 font-headline font-extrabold" style={{ fontSize: "34px", lineHeight: 1, color: stat.tone }}>
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
                  {stat.helper}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(247,250,248,1))",
              border: "1.5px solid rgba(0,0,0,0.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                  Annual directive
                </p>
                <h2 className="font-headline font-bold text-xl mt-2" style={{ color: "#1a1f1e" }}>
                  Major outcomes for {year}
                </h2>
                <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: "#6b7c75" }}>
                  Every card below should answer: what matters, how it is progressing, and whether enough monthly depth exists to make it believable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openModal("add-yearly-goal")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add yearly goal
              </button>
            </div>

            {(missingMonthlyPlanning.length > 0 || missingDetails.length > 0) && (
              <div
                className="rounded-2xl p-4 mb-5"
                style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.12)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#a16207" }}>
                  Planning depth warnings
                </p>
                <div className="mt-2 space-y-1.5 text-sm" style={{ color: "#8a5b12" }}>
                  {missingMonthlyPlanning.length > 0 && (
                    <p>{linkLabel(missingMonthlyPlanning.length, "yearly goal")} still {missingMonthlyPlanning.length === 1 ? "has" : "have"} no monthly goals attached.</p>
                  )}
                  {missingDetails.length > 0 && (
                    <p>{linkLabel(missingDetails.length, "yearly goal")} still {missingDetails.length === 1 ? "is" : "are"} missing a category or description, which weakens scanability and trust.</p>
                  )}
                </div>
              </div>
            )}

            {yearCards.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#f7faf8", border: "1px dashed rgba(0,0,0,0.1)" }}>
                <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  No yearly goals exist for {year} yet. Add the outcomes that actually define success, and the quarter and sprint layers will become useful instead of decorative.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {(["active", "at-risk", "completed"] as GoalGroup[]).map((group) => {
                  const items = cardsByGroup[group];
                  if (items.length === 0) return null;
                  const meta = statusMeta(group);
                  return (
                    <section key={group}>
                      <div className="flex items-center gap-3 mb-4">
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.22em] px-3 py-1.5 rounded-full"
                          style={{ color: meta.color, background: meta.background, border: `1px solid ${meta.border}` }}
                        >
                          {meta.label}
                        </span>
                        <p className="text-sm" style={{ color: "#8a9e97" }}>
                          {linkLabel(items.length, "goal")}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.map((item) => {
                          const cat = resolveCategoryPalette(item.category);
                          const metaTone = statusMeta(item.group);
                          const cardTone = cardToneForGroup(item.group);
                          return (
                            <div
                              key={item.goal.id}
                              className="rounded-[24px] p-5"
                              style={{
                                background: cardTone.background,
                                border: `1.5px solid ${cardTone.border}`,
                                boxShadow: "0 8px 20px rgba(0,0,0,0.03)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.base }} />
                                    <span
                                      className="text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full"
                                      style={{ background: metaTone.background, color: metaTone.color }}
                                    >
                                      {metaTone.label}
                                    </span>
                                  </div>
                                  <h3 className="font-headline font-bold text-xl leading-tight mt-3" style={{ color: "#1a1f1e" }}>
                                    {item.goal.title}
                                  </h3>
                                  <p className="text-sm mt-3 leading-relaxed" style={{ color: item.goal.description ? "#5d6d67" : "#9aa9a3" }}>
                                    {item.goal.description || "No description saved yet. Add one so this goal is legible at a glance."}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openModal("edit-yearly-goal", item.goal)}
                                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.06)" }}
                                >
                                  <span className="material-symbols-outlined text-[18px]" style={{ color: "#6b7c75" }}>edit</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mt-5">
                                <div
                                  className="rounded-2xl px-3.5 py-3"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                    Category
                                  </p>
                                  <p className="mt-1 text-sm font-semibold" style={{ color: cat.base }}>
                                    {item.category?.name ?? "Uncategorised"}
                                  </p>
                                </div>
                                <div
                                  className="rounded-2xl px-3.5 py-3"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                    Due date
                                  </p>
                                  <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                                    {fmtDate(item.goal.targetDate)}
                                  </p>
                                </div>
                                <div
                                  className="rounded-2xl px-3.5 py-3"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                    Monthly depth
                                  </p>
                                  <p className="mt-1 text-sm font-semibold" style={{ color: item.linkedMonthly.length > 0 ? "#1a1f1e" : "#b45309" }}>
                                    {linkLabel(item.linkedMonthly.length, "linked month", "linked months")}
                                  </p>
                                </div>
                                <div
                                  className="rounded-2xl px-3.5 py-3"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                    Weekly support
                                  </p>
                                  <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                                    {linkLabel(item.linkedWeeklyCount, "linked sprint", "linked sprints")}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                    Progress
                                  </p>
                                  <p className="text-sm font-bold" style={{ color: cat.base }}>
                                    {item.goal.progress}%
                                  </p>
                                </div>
                                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${item.goal.progress}%`, background: cat.base }}
                                  />
                                </div>
                              </div>

                              <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                  Linkage
                                </p>
                                {item.linkedMonthly.length > 0 ? (
                                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "#5d6d67" }}>
                                    This goal is currently supported by{" "}
                                    {item.linkedMonthly.slice(0, 2).map((monthlyGoal) => monthlyGoal.title).join(" and ")}
                                    {item.linkedMonthly.length > 2 ? `, plus ${item.linkedMonthly.length - 2} more monthly goals.` : "."}
                                  </p>
                                ) : (
                                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "#a16207" }}>
                                    No monthly goals are attached yet, so this outcome has intention but not execution depth.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{
              background: "#fff",
              border: "1.5px solid rgba(0,0,0,0.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                  Quarter planning
                </p>
                <h2 className="font-headline font-bold text-xl mt-2" style={{ color: "#1a1f1e" }}>
                  How the year is decomposed
                </h2>
                <p className="text-sm mt-2 leading-relaxed max-w-2xl" style={{ color: "#6b7c75" }}>
                  Each quarter should answer what the main focus is, how much support work exists, and whether the planning depth is enough to trust execution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/goals/${year}/q/q${currentQuarter}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
              >
                Open current quarter
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quarterCards.map((quarterCard) => {
                const clickable = quarterCard.status !== "upcoming";
                const active = quarterCard.status === "active";
                return (
                  <button
                    key={quarterCard.quarter}
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && router.push(`/dashboard/goals/${year}/q/q${quarterCard.quarter}`)}
                    className="rounded-[24px] p-5 text-left transition-all"
                    style={{
                      background: active ? "linear-gradient(180deg, rgba(245,251,248,1), rgba(239,248,244,1))" : "#f8fbf9",
                      border: active ? "1.5px solid rgba(0,108,74,0.18)" : "1.5px solid rgba(0,0,0,0.06)",
                      opacity: clickable ? 1 : 0.55,
                      cursor: clickable ? "pointer" : "default",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: active ? "#006c4a" : "#8a9e97" }}>
                          Q{quarterCard.quarter}
                        </p>
                        <h3 className="font-headline font-bold text-lg mt-2" style={{ color: "#1a1f1e" }}>
                          {quarterCard.mainGoal?.title ?? "No main monthly goal yet"}
                        </h3>
                      </div>
                      {clickable && (
                        <span className="material-symbols-outlined text-[18px]" style={{ color: "#8a9e97" }}>chevron_right</span>
                      )}
                    </div>
                    <p className="text-sm mt-3 leading-relaxed" style={{ color: "#6b7c75" }}>
                      {quarterCard.goalsCount > 0
                        ? `${linkLabel(quarterCard.goalsCount, "monthly goal")} saved across ${quarterCard.months.map((month) => month.slice(0, 3)).join(", ")}.`
                        : `No monthly planning saved yet across ${quarterCard.months.map((month) => month.slice(0, 3)).join(", ")}.`}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Quarter progress
                      </p>
                      <p className="text-sm font-bold" style={{ color: active ? "#006c4a" : "#1a1f1e" }}>
                        {quarterCard.progress}%
                      </p>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${quarterCard.progress}%`, background: active ? "#006c4a" : "#8a9e97" }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{
              background: "#fff",
              border: "1.5px solid rgba(0,0,0,0.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                  Weekly execution
                </p>
                <h2 className="font-headline font-bold text-xl mt-2" style={{ color: "#1a1f1e" }}>
                  Sprint coverage for {year}
                </h2>
                <p className="text-sm mt-2 leading-relaxed max-w-2xl" style={{ color: "#6b7c75" }}>
                  This tells you whether your monthly direction is being translated into weekly commitments or left sitting as intention.
                </p>
              </div>
            </div>

            {weeklyRows.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#f7faf8", border: "1px dashed rgba(0,0,0,0.1)" }}>
                <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  No weekly sprints are saved for {year} yet. Add them so the product can show what each month is actually turning into.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleWeeklyRows.map((row) => {
                  const isCurrentWeek = row.weekNumber === currentWeekNumber && isActiveYear;
                  return (
                    <button
                      key={row.weekNumber}
                      type="button"
                      onClick={() => router.push(`/dashboard/goals/${year}/w/${row.weekNumber}`)}
                      className="w-full rounded-2xl px-4 py-4 text-left transition-all"
                      style={{
                        background: isCurrentWeek ? "rgba(0,108,74,0.04)" : "#f8fbf9",
                        border: isCurrentWeek ? "1.5px solid rgba(0,108,74,0.16)" : "1.5px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 flex-shrink-0 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: isCurrentWeek ? "#006c4a" : "#8a9e97" }}>
                            WK
                          </p>
                          <p className="font-headline font-extrabold text-2xl" style={{ color: "#1a1f1e" }}>
                            {row.weekNumber}
                          </p>
                        </div>
                        <div className="w-px self-stretch" style={{ background: "rgba(0,0,0,0.06)" }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" style={{ color: "#1a1f1e" }}>
                            {row.mainGoal?.title ?? `Week ${row.weekNumber}`}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "#6b7c75" }}>
                            {linkLabel(row.total, "goal")} saved · {row.completed}/{row.total} completed
                            {isCurrentWeek ? ` · ${row.linkedDailyCount} linked daily priorities` : ""}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-[18px]" style={{ color: "#8a9e97" }}>chevron_right</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {weeklyRows.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllSprints((value) => !value)}
                className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: "#006c4a" }}
              >
                {showAllSprints ? "Show fewer weeks" : `Show all ${weeklyRows.length} weeks`}
              </button>
            )}
          </div>

          {isActiveYear && (
            <div
              className="rounded-[28px] p-6"
              style={{
                background: "#fff",
                border: "1.5px solid rgba(0,0,0,0.06)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                    Daily execution
                  </p>
                  <h2 className="font-headline font-bold text-xl mt-2" style={{ color: "#1a1f1e" }}>
                    Today&apos;s linked execution state
                  </h2>
                  <p className="text-sm mt-2 leading-relaxed max-w-2xl" style={{ color: "#6b7c75" }}>
                    The goal pages should not stop at planning. This section checks whether today&apos;s priorities are actually serving the current sprint.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                >
                  Open dashboard
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              {todayPriorities.length === 0 ? (
                <div className="rounded-2xl p-6" style={{ background: "#f7faf8", border: "1px dashed rgba(0,0,0,0.1)" }}>
                  <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                    Nothing is saved for today yet. The year page can only trust what the server has, so add today&apos;s priorities from the dashboard to complete the chain from strategy to execution.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {todayPriorities.slice(0, 3).map((priority) => {
                    const linkedWeeklyGoal = weeklyGoals.find((goal) => goal.id === priority.weeklyGoalId);
                    return (
                      <div
                        key={priority.id}
                        className="rounded-[22px] p-4"
                        style={{
                          background: priority.completed ? "#f5fbf7" : "#fafcfb",
                          border: priority.weeklyGoalId ? "1.5px solid rgba(0,108,74,0.12)" : "1.5px solid rgba(217,119,6,0.14)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: priority.weeklyGoalId ? "rgba(0,108,74,0.1)" : "rgba(217,119,6,0.12)" }}
                          >
                            <span className="material-symbols-outlined text-[18px]" style={{ color: priority.weeklyGoalId ? "#006c4a" : "#b45309" }}>
                              {priority.weeklyGoalId ? "task_alt" : "priority_high"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleDailyPriority(priority.id)}
                            className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{ borderColor: priority.completed ? "#006c4a" : "#d1d9d5", background: priority.completed ? "#006c4a" : "transparent" }}
                          >
                            {priority.completed && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                          </button>
                        </div>
                        <h3 className="font-semibold text-sm mt-4 leading-snug" style={{ color: "#1a1f1e" }}>
                          {priority.title}
                        </h3>
                        <p className="text-xs mt-3 leading-relaxed" style={{ color: priority.weeklyGoalId ? "#5d6d67" : "#a16207" }}>
                          {linkedWeeklyGoal
                            ? `Supports week ${linkedWeeklyGoal.weekNumber}: ${linkedWeeklyGoal.title}`
                            : "Not linked to a weekly sprint yet."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div
            className="rounded-[28px] p-6"
            style={{
              background: "linear-gradient(180deg, rgba(17,24,22,1), rgba(12,36,28,1))",
              color: "#fff",
              boxShadow: "0 12px 32px rgba(10,24,18,0.28)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.42)" }}>
              Next best action
            </p>
            <h2 className="font-headline font-bold text-xl mt-3" style={{ color: "#fff" }}>
              {nextBestAction.title}
            </h2>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.76)" }}>
              {nextBestAction.body}
            </p>
            <button
              type="button"
              onClick={nextBestAction.action}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold"
              style={{ background: "#006c4a", color: "#fff" }}
            >
              {nextBestAction.actionLabel}
            </button>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{
              background: "#fff",
              border: "1.5px solid rgba(0,0,0,0.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Linkage chain
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Yearly outcome
                </p>
                <p className="text-sm font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                  {linkedYearlyForCurrentWeek?.title ?? linkedYearlyForCurrentMonth?.title ?? "No linked yearly outcome yet"}
                </p>
              </div>
              <div className="flex justify-center">
                <span className="material-symbols-outlined" style={{ color: "#a8b5af" }}>south</span>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Monthly focus
                </p>
                <p className="text-sm font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                  {linkedMonthlyForCurrentWeek?.title ?? currentMonthMainGoal?.title ?? "No linked monthly focus yet"}
                </p>
              </div>
              <div className="flex justify-center">
                <span className="material-symbols-outlined" style={{ color: "#a8b5af" }}>south</span>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Weekly commitment
                </p>
                <p className="text-sm font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                  {currentWeekMainGoal?.title ?? `Nothing defined for week ${currentWeekNumber}`}
                </p>
              </div>
              <div className="flex justify-center">
                <span className="material-symbols-outlined" style={{ color: "#a8b5af" }}>south</span>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Today
                </p>
                <p className="text-sm font-semibold mt-2" style={{ color: "#1a1f1e" }}>
                  {todayPriorities.length > 0 ? `${todayPriorities.length} saved priorities` : "No saved daily execution yet"}
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{
              background: "#fff",
              border: "1.5px solid rgba(0,0,0,0.06)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Execution gaps
            </p>
            {executionGaps.length === 0 ? (
              <p className="text-sm mt-4 leading-relaxed" style={{ color: "#5d6d67" }}>
                No major structural gaps are showing right now. The stack has enough linkage to be usable; the main job is keeping the execution layer honest.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {executionGaps.map((gap) => (
                  <div
                    key={gap}
                    className="rounded-2xl p-4"
                    style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.12)" }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: "#8a5b12" }}>
                      {gap}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
