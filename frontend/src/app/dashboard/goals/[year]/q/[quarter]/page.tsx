"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { GoalCompletionButton } from "@/components/goals/GoalCompletionButton";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { averageProgress, getGoalDisplayProgress, isGoalComplete } from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";
import type { MonthlyGoal } from "@/lib/types";

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function quarterNumberFromId(quarterId: string) {
  const value = parseInt(quarterId.replace(/^q/i, ""), 10);
  return Number.isNaN(value) || value < 1 || value > 4 ? null : value;
}

function monthShortName(month: number) {
  return MONTH_LONG[month - 1]?.slice(0, 3) ?? `M${month}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "No due date";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function QuarterPage({ params }: { params: Promise<{ year: string; quarter: string }> }) {
  const { year: yearStr, quarter: quarterId } = use(params);
  const year = parseInt(yearStr, 10);
  const quarter = quarterNumberFromId(quarterId);
  const router = useRouter();
  const openModal = useAppStore((state) => state.openModal);
  const updateMonthlyGoal = useAppStore((state) => state.updateMonthlyGoal);
  const {
    ready,
    hasCachedData,
    error,
    lastSyncedAt,
    today,
    currentMonth,
    monthlyGoals,
    weeklyGoals,
    yearlyGoals,
    habits,
  } = useGoalsHierarchy(year);

  if (Number.isNaN(year) || quarter === null) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "#8a9e97" }}>Quarter not found.</p>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/goals/${year}`)}
          className="mt-4 text-sm font-bold underline"
          style={{ color: "#006c4a" }}
        >
          Back to year view
        </button>
      </div>
    );
  }

  if (!ready && !hasCachedData) {
    return <GoalsLoadingShell title="Loading this quarter" />;
  }

  const startMonth = (quarter - 1) * 3 + 1;
  const months = [startMonth, startMonth + 1, startMonth + 2];
  const quarterMonthlyGoals = monthlyGoals.filter((goal) => months.includes(goal.month));
  const quarterWeeklyGoals = weeklyGoals.filter((goal) => months.includes(goal.month));
  const weeklyByMonthly = new Map<string, typeof weeklyGoals>();
  for (const weeklyGoal of quarterWeeklyGoals) {
    if (!weeklyGoal.monthlyGoalId) continue;
    const list = weeklyByMonthly.get(weeklyGoal.monthlyGoalId) ?? [];
    list.push(weeklyGoal);
    weeklyByMonthly.set(weeklyGoal.monthlyGoalId, list);
  }

  const monthCards = months.map((month) => {
    const goals = quarterMonthlyGoals.filter((goal) => goal.month === month);
    const mainGoal = goals.find((goal) => goal.isMain) ?? goals[0] ?? null;
    const supportGoals = goals.filter((goal) => !mainGoal || goal.id !== mainGoal.id);
    const progress = averageProgress(goals);
    const weeklyCount = goals.reduce((count, goal) => count + (weeklyByMonthly.get(goal.id)?.length ?? 0), 0);
    const yearlyGoal = mainGoal ? yearlyGoals.find((goal) => goal.id === mainGoal.yearlyGoalId) : null;
    return {
      month,
      name: MONTH_LONG[month - 1],
      goals,
      mainGoal,
      supportGoals,
      progress,
      weeklyCount,
      yearlyGoal,
    };
  });

  const mainGoalCount = quarterMonthlyGoals.filter((goal) => goal.isMain).length;
  const completedCount = quarterMonthlyGoals.filter((goal) => isGoalComplete(goal)).length;
  const missingWeeklyCount = quarterMonthlyGoals.filter((goal) => (weeklyByMonthly.get(goal.id)?.length ?? 0) === 0).length;
  const overallProgress = averageProgress(quarterMonthlyGoals);
  const mainFocus = monthCards.find((card) => card.mainGoal)?.mainGoal ?? null;
  const currentMonthInQuarter = months.includes(currentMonth);
  const currentYear = Number(today.slice(0, 4));
  const activeHabits = habits.filter((habit) => habit.active);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/goals/${year}`)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
              style={{ color: "#8a9e97" }}
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              Yearly goals
            </button>
            <span style={{ color: "#d1d9d5" }}>/</span>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
              Q{quarter}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
            >
              Synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "just now"}
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
            Quarter focus board
          </p>
          <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "30px", color: "#1a1f1e" }}>
            Q{quarter} should answer the main thing, the support work, and what needs attention now
          </h1>
          <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
            This board is built from the monthly goals already saved in the system. It is designed to show whether the quarter feels operational or just aspirational.
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
            Main thing
          </p>
          <p className="text-lg font-bold mt-3" style={{ color: "#fff" }}>
            {mainFocus?.title ?? "No main monthly goal yet"}
          </p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {mainFocus?.description || "Define a main monthly goal in this quarter so the board has a clear anchor instead of three disconnected months."}
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              {
                label: "Monthly goals",
                value: String(quarterMonthlyGoals.length),
                tone: "#1a1f1e",
                helper: "All saved goals in this quarter",
              },
              {
                label: "Main focuses",
                value: String(mainGoalCount),
                tone: "#006c4a",
                helper: "Primary monthly anchors",
              },
              {
                label: "Missing weekly depth",
                value: String(missingWeeklyCount),
                tone: missingWeeklyCount > 0 ? "#b45309" : "#006c4a",
                helper: "Monthly goals with no weekly support",
              },
              {
                label: "Average progress",
                value: `${overallProgress}%`,
                tone: "#1a1f1e",
                helper: `${completedCount} completed`,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-5"
                style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  {stat.label}
                </p>
                <p className="mt-2 font-headline font-extrabold" style={{ fontSize: "32px", lineHeight: 1, color: stat.tone }}>
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
                  {stat.helper}
                </p>
              </div>
            ))}
          </div>

          {missingWeeklyCount > 0 && (
            <div
              className="rounded-2xl p-4"
              style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.12)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#a16207" }}>
                Execution gap
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "#8a5b12" }}>
                {missingWeeklyCount} monthly goal{missingWeeklyCount === 1 ? "" : "s"} in Q{quarter} still have no weekly sprint beneath them.
              </p>
            </div>
          )}

          <div className="space-y-5">
            {monthCards.map((card) => {
              const isCurrent = currentMonthInQuarter && card.month === currentMonth;
              const monthEditable = year === currentYear && card.month === Number(today.slice(5, 7));
              const missingWeeklyForMonth = card.goals.filter((goal) => (weeklyByMonthly.get(goal.id)?.length ?? 0) === 0).length;
              return (
                <div
                  key={card.month}
                  className="rounded-[28px] p-6"
                  style={{
                    background: isCurrent ? "linear-gradient(180deg, rgba(245,251,248,1), rgba(239,248,244,1))" : "#fff",
                    border: isCurrent ? "1.5px solid rgba(0,108,74,0.18)" : "1.5px solid rgba(0,0,0,0.06)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: isCurrent ? "#006c4a" : "#8a9e97" }}>
                          {card.name}
                        </p>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: "#006c4a", color: "#fff" }}>
                            Current month
                          </span>
                        )}
                      </div>
                      <h2 className="font-headline font-bold text-2xl mt-2" style={{ color: "#1a1f1e" }}>
                        {card.mainGoal?.title ?? `No main goal saved for ${card.name}`}
                      </h2>
                      <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: card.mainGoal?.description ? "#5d6d67" : "#8a9e97" }}>
                        {card.mainGoal?.description || "Create a main monthly goal so this month has a clear focal point instead of scattered work."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {card.mainGoal && card.mainGoal.editable ? (
                        <>
                          <GoalCompletionButton
                            completed={isGoalComplete(card.mainGoal)}
                            onClick={() =>
                              updateMonthlyGoal(card.mainGoal!.id, {
                                status: isGoalComplete(card.mainGoal!) ? "active" : "completed",
                                progress: isGoalComplete(card.mainGoal!) ? Math.min(getGoalDisplayProgress(card.mainGoal!), 99) : 100,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => openModal("edit-monthly-goal", card.mainGoal)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit main goal
                          </button>
                        </>
                      ) : monthEditable ? (
                        <button
                          type="button"
                          onClick={() => openModal("add-monthly-goal", { yearOverride: year, monthOverride: card.month, defaultIsMain: true })}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                          style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          Add monthly goal
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7c75" }}
                          title="This period is locked. You can review it, but only the current period is editable."
                        >
                          <span className="material-symbols-outlined text-[16px]">lock</span>
                          Locked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
                    {[
                      { label: "Goals saved", value: String(card.goals.length), tone: "#1a1f1e" },
                      { label: "Weekly support", value: String(card.weeklyCount), tone: card.weeklyCount > 0 ? "#006c4a" : "#b45309" },
                      { label: "Progress", value: `${card.progress}%`, tone: "#1a1f1e" },
                      { label: "Linked yearly goal", value: card.yearlyGoal?.title ?? "Missing", tone: card.yearlyGoal ? "#1a1f1e" : "#b45309" },
                    ].map((stat) => (
                      <div
                        key={`${card.month}-${stat.label}`}
                        className="rounded-2xl px-3.5 py-3"
                        style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          {stat.label}
                        </p>
                        <p className="text-sm font-semibold mt-1 leading-snug" style={{ color: stat.tone }}>
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {card.mainGoal && (
                    <div className="mt-5 rounded-2xl p-4" style={{ background: "rgba(0,108,74,0.04)", border: "1px solid rgba(0,108,74,0.08)" }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                        Linkage
                      </p>
                      <p className="text-sm mt-2 leading-relaxed" style={{ color: "#5d6d67" }}>
                        {card.name}&apos;s main goal links to {card.yearlyGoal?.title ?? "no linked yearly goal yet"} and currently has {card.weeklyCount} weekly goal{card.weeklyCount === 1 ? "" : "s"} underneath it.
                      </p>
                    </div>
                  )}

                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Secondary goals
                      </p>
                      <p className="text-xs font-semibold" style={{ color: missingWeeklyForMonth > 0 ? "#b45309" : "#6b7c75" }}>
                        {missingWeeklyForMonth > 0 ? `${missingWeeklyForMonth} missing weekly follow-through` : "All goals have some weekly support or this month is empty"}
                      </p>
                    </div>
                    {card.supportGoals.length === 0 ? (
                      <p className="text-sm leading-relaxed" style={{ color: "#8a9e97" }}>
                        {card.goals.length === 0
                          ? "No monthly goals saved for this month yet."
                          : "No additional secondary goals are saved. Add them only if they genuinely reduce ambiguity or execution risk."}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {card.supportGoals.map((goal: MonthlyGoal) => (
                          <div
                            key={goal.id}
                            className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                            style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.05)" }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "#1a1f1e" }}>
                                {goal.title}
                              </p>
                              <p className="text-xs mt-1" style={{ color: "#6b7c75" }}>
                                {fmtDate(goal.targetDate)} · {(weeklyByMonthly.get(goal.id)?.length ?? 0)} linked weekly goal{(weeklyByMonthly.get(goal.id)?.length ?? 0) === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {goal.editable ? (
                                <>
                                  <GoalCompletionButton
                                    completed={isGoalComplete(goal)}
                                    onClick={() =>
                                      updateMonthlyGoal(goal.id, {
                                        status: isGoalComplete(goal) ? "active" : "completed",
                                        progress: isGoalComplete(goal) ? Math.min(getGoalDisplayProgress(goal), 99) : 100,
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => openModal("edit-monthly-goal", goal)}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
                                  >
                                    <span className="material-symbols-outlined text-[16px]" style={{ color: "#6b7c75" }}>edit</span>
                                  </button>
                                </>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", color: "#6b7c75" }}
                                  title="This period is locked. You can review it, but only the current period is editable."
                                >
                                  <span className="material-symbols-outlined text-[14px]">lock</span>
                                  Locked
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Quarter storyline
            </p>
            <div className="mt-4 space-y-3 text-sm" style={{ color: "#5d6d67" }}>
              <p>What is the main thing? {mainFocus?.title ?? "No main monthly focus yet."}</p>
              <p>What else is on the board? {quarterMonthlyGoals.length > 1 ? `${quarterMonthlyGoals.length - 1} additional monthly goals` : "No secondary goals yet."}</p>
              <p>What is done? {completedCount} completed monthly goal{completedCount === 1 ? "" : "s"}.</p>
              <p>What needs attention now? {missingWeeklyCount > 0 ? `${missingWeeklyCount} monthly goal${missingWeeklyCount === 1 ? "" : "s"} need weekly follow-through.` : "The main risk is execution consistency, not planning depth."}</p>
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Completion trend
            </p>
            <div className="mt-5 flex items-end gap-3 h-40">
              {monthCards.map((card) => (
                <div key={card.month} className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-full rounded-t-2xl overflow-hidden" style={{ background: "rgba(0,0,0,0.05)", height: "120px", position: "relative" }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-t-2xl"
                      style={{
                        height: `${Math.max(8, Math.min(120, Math.round((card.progress / 100) * 120)))}px`,
                        background: card.month === currentMonth ? "#006c4a" : "rgba(0,108,74,0.45)",
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>{monthShortName(card.month)}</p>
                    <p className="text-[11px]" style={{ color: "#8a9e97" }}>{card.progress}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Routine pressure
            </p>
            {activeHabits.length === 0 ? (
              <p className="text-sm mt-4 leading-relaxed" style={{ color: "#6b7c75" }}>
                No active routines are saved. If this product is meant to help execution, routines should exist where they materially strengthen the quarter.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {activeHabits.slice(0, 5).map((habit) => (
                  <div
                    key={habit.id}
                    className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                    style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.05)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="material-symbols-outlined text-[18px]" style={{ color: "#7c3aed" }}>{habit.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#1a1f1e" }}>{habit.name}</p>
                        <p className="text-xs" style={{ color: "#6b7c75" }}>{habit.frequency.replace("_", " ")}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>
                      {habit.streak} day streak
                    </span>
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
