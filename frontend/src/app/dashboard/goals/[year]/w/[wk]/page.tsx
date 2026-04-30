"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { GoalCompletionButton } from "@/components/goals/GoalCompletionButton";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { useAppStore } from "@/lib/store";

function formatDateLabel(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatWeekRange(start?: string | null, end?: string | null) {
  if (!start || !end) return "Selected week";
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Selected week";
  const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

export default function WeeklySprintPage({ params }: { params: Promise<{ year: string; wk: string }> }) {
  const { year: yearStr, wk: weekStr } = use(params);
  const year = parseInt(yearStr, 10);
  const focusWeek = parseInt(weekStr, 10);
  const router = useRouter();
  const openModal = useAppStore((state) => state.openModal);
  const toggleDailyPriority = useAppStore((state) => state.toggleDailyPriority);
  const updateWeeklyGoal = useAppStore((state) => state.updateWeeklyGoal);
  const {
    ready,
    loading,
    error,
    lastSyncedAt,
    currentWeekNumber,
    selectedWeekStart,
    selectedWeekEnd,
    weeklyGoals,
    monthlyGoals,
    yearlyGoals,
    selectedWeekDailyPriorities,
    habits,
  } = useGoalsHierarchy(year, { weekNumber: focusWeek });

  if (Number.isNaN(year) || Number.isNaN(focusWeek)) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "#8a9e97" }}>Invalid week.</p>
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

  if (!ready || loading) {
    return (
      <GoalsLoadingShell
        eyebrow={`Week ${focusWeek}`}
        title="Loading this week's execution picture"
        detail="We are pulling the sprint, its monthly parent, and the saved daily priorities for this ISO week before rendering the page."
      />
    );
  }

  const weekGoals = weeklyGoals.filter((goal) => goal.weekNumber === focusWeek);
  const mainGoal = weekGoals.find((goal) => goal.isMain) ?? weekGoals[0] ?? null;
  const linkedMonthly = mainGoal ? monthlyGoals.find((goal) => goal.id === mainGoal.monthlyGoalId) ?? null : null;
  const linkedYearly = linkedMonthly ? yearlyGoals.find((goal) => goal.id === linkedMonthly.yearlyGoalId) ?? null : null;
  const linkedPriorityCount = selectedWeekDailyPriorities.filter((priority) => priority.weeklyGoalId).length;
  const unlinkedPriorityCount = selectedWeekDailyPriorities.filter((priority) => !priority.weeklyGoalId).length;
  const completedGoals = weekGoals.filter((goal) => goal.status === "completed" || goal.progress >= 100).length;
  const weekProgress = weekGoals.length
    ? Math.round(weekGoals.reduce((sum, goal) => sum + goal.progress, 0) / weekGoals.length)
    : 0;

  const groupedPriorities = [...selectedWeekDailyPriorities]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.isMain === b.isMain ? a.title.localeCompare(b.title) : a.isMain ? -1 : 1))
    .reduce<Record<string, typeof selectedWeekDailyPriorities>>((acc, priority) => {
      acc[priority.date] = [...(acc[priority.date] ?? []), priority];
      return acc;
    }, {});

  const executionGaps = [
    weekGoals.length === 0 ? `No weekly goals are saved for week ${focusWeek}.` : null,
    weekGoals.length > 0 && linkedPriorityCount === 0 ? "The weekly sprint exists, but nothing in the daily execution layer is linked to it." : null,
    unlinkedPriorityCount > 0 ? `${unlinkedPriorityCount} daily priorit${unlinkedPriorityCount === 1 ? "y is" : "ies are"} saved this week without a weekly-goal link.` : null,
    linkedMonthly ? null : "The main weekly goal is not linked to a monthly goal yet." ,
  ].filter((item): item is string => Boolean(item));

  const nearbyWeeks = [...new Set(weeklyGoals.map((goal) => goal.weekNumber))]
    .sort((a, b) => Math.abs(a - focusWeek) - Math.abs(b - focusWeek))
    .slice(0, 6);

  const activeHabits = habits.filter((habit) => habit.active);
  const isCurrentWeek = focusWeek === currentWeekNumber;
  const weekEditable = year === Number((selectedWeekStart ?? `${year}-01-01`).slice(0, 4)) && isCurrentWeek;

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
              Week {focusWeek}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
            >
              Synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "just now"}
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
            Weekly execution board
          </p>
          <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "30px", color: "#1a1f1e" }}>
            Week {focusWeek} should make the main commitment obvious
          </h1>
          <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
            A strong week view answers four things clearly: what is the main thing, what supports it, what is done, and whether the daily layer is aligned.
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
            Main objective
          </p>
          <p className="text-lg font-bold mt-3" style={{ color: "#fff" }}>
            {mainGoal?.title ?? "No main weekly goal yet"}
          </p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {mainGoal?.description || "Add one clear main weekly goal so the sprint is more than a list of disconnected tasks."}
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
              { label: "Week range", value: formatWeekRange(selectedWeekStart, selectedWeekEnd), tone: "#1a1f1e", helper: isCurrentWeek ? "Current ISO week" : "Selected week" },
              { label: "Weekly goals", value: String(weekGoals.length), tone: "#006c4a", helper: `${completedGoals} completed` },
              { label: "Linked daily priorities", value: String(linkedPriorityCount), tone: linkedPriorityCount > 0 ? "#006c4a" : "#b45309", helper: `${unlinkedPriorityCount} unlinked` },
              { label: "Progress", value: `${weekProgress}%`, tone: "#1a1f1e", helper: linkedMonthly?.title ?? "No monthly link yet" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-5"
                style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  {stat.label}
                </p>
                <p className="mt-2 font-headline font-extrabold leading-tight" style={{ fontSize: "24px", color: stat.tone }}>
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
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                  Sprint chain
                </p>
                <h2 className="font-headline font-bold text-2xl mt-2" style={{ color: "#1a1f1e" }}>
                  {mainGoal?.title ?? `Week ${focusWeek} has no defined objective yet`}
                </h2>
                <p className="text-sm mt-2 leading-relaxed max-w-2xl" style={{ color: "#5d6d67" }}>
                  {mainGoal?.description || "The strongest upgrade for this page is adding a main weekly objective with a description that makes success unmistakable."}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {mainGoal && mainGoal.editable ? (
                  <>
                    <GoalCompletionButton
                      completed={mainGoal.status === "completed" || mainGoal.progress >= 100}
                      onClick={() =>
                        updateWeeklyGoal(mainGoal.id, {
                          status: mainGoal.status === "completed" || mainGoal.progress >= 100 ? "active" : "completed",
                          progress: mainGoal.status === "completed" || mainGoal.progress >= 100 ? Math.min(mainGoal.progress, 99) : 100,
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => openModal("edit-weekly-goal", mainGoal)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Edit main goal
                    </button>
                  </>
                ) : weekEditable ? (
                  <button
                    type="button"
                    onClick={() => openModal("add-weekly-goal", { yearOverride: year, monthOverride: linkedMonthly?.month, weekOverride: focusWeek, defaultIsMain: true })}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add weekly goal
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
              {[
                { label: "Supports monthly goal", value: linkedMonthly?.title ?? "No monthly goal linked" },
                { label: "Supports yearly goal", value: linkedYearly?.title ?? "No yearly goal linked" },
                { label: "Daily execution this week", value: selectedWeekDailyPriorities.length > 0 ? `${selectedWeekDailyPriorities.length} saved priorities` : "No saved daily priorities" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl p-4"
                  style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold mt-2 leading-relaxed" style={{ color: "#1a1f1e" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Weekly goals
            </p>
            {weekGoals.length === 0 ? (
              <p className="text-sm mt-4 leading-relaxed" style={{ color: "#6b7c75" }}>
                Nothing is saved for this week yet. That means the daily execution layer has no planning anchor unless you create one.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {weekGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="rounded-[22px] p-4"
                    style={{
                      background: goal.isMain ? "rgba(0,108,74,0.04)" : "#f8fbf9",
                      border: goal.isMain ? "1.5px solid rgba(0,108,74,0.12)" : "1.5px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                            style={{ background: goal.isMain ? "#006c4a" : "rgba(0,0,0,0.06)", color: goal.isMain ? "#fff" : "#6b7c75" }}
                          >
                            {goal.isMain ? "Main objective" : "Support goal"}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                            {goal.progress}% complete
                          </span>
                        </div>
                        <h3 className="font-semibold text-base mt-3" style={{ color: "#1a1f1e" }}>
                          {goal.title}
                        </h3>
                        <p className="text-sm mt-2 leading-relaxed" style={{ color: goal.description ? "#5d6d67" : "#8a9e97" }}>
                          {goal.description || "No description saved yet."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {goal.editable ? (
                          <>
                            <GoalCompletionButton
                              completed={goal.status === "completed" || goal.progress >= 100}
                              onClick={() =>
                                updateWeeklyGoal(goal.id, {
                                  status: goal.status === "completed" || goal.progress >= 100 ? "active" : "completed",
                                  progress: goal.status === "completed" || goal.progress >= 100 ? Math.min(goal.progress, 99) : 100,
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => openModal("edit-weekly-goal", goal)}
                              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
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
                    <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                      <div className="h-full rounded-full" style={{ width: `${goal.progress}%`, background: "#006c4a" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Daily execution linked to this week
            </p>
            {selectedWeekDailyPriorities.length === 0 ? (
              <p className="text-sm mt-4 leading-relaxed" style={{ color: "#6b7c75" }}>
                No daily priorities are saved for this week. If the sprint is real, the next move is translating it into day-level execution.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {Object.entries(groupedPriorities).map(([date, priorities]) => (
                  <div key={date}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="font-headline font-bold text-lg" style={{ color: "#1a1f1e" }}>
                        {formatDateLabel(date)}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        {priorities.length} priorit{priorities.length === 1 ? "y" : "ies"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {priorities.map((priority) => {
                        const linkedGoal = weekGoals.find((goal) => goal.id === priority.weeklyGoalId);
                        return (
                          <div
                            key={priority.id}
                            className="rounded-2xl px-4 py-3 flex items-center gap-3"
                            style={{
                              background: priority.completed ? "#f5fbf7" : "#f8fbf9",
                              border: linkedGoal ? "1px solid rgba(0,108,74,0.1)" : "1px solid rgba(217,119,6,0.14)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => priority.editable && toggleDailyPriority(priority.id)}
                              className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: priority.completed ? "#006c4a" : "#d1d9d5", background: priority.completed ? "#006c4a" : "transparent" }}
                            >
                              {priority.editable && priority.completed && <span className="material-symbols-outlined text-[12px] text-white">check</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                                {priority.title}
                              </p>
                              <p className="text-xs mt-1 leading-relaxed" style={{ color: linkedGoal ? "#5d6d67" : "#a16207" }}>
                                {linkedGoal
                                  ? `Linked to: ${linkedGoal.title}`
                                  : "Not linked to a weekly goal yet."}
                              </p>
                            </div>
                            {priority.priority && (
                              <span
                                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0"
                                style={{ background: "rgba(0,0,0,0.05)", color: "#6b7c75" }}
                              >
                                {priority.priority}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              Attention now
            </p>
            {executionGaps.length === 0 ? (
              <p className="text-sm mt-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.76)" }}>
                This week is structurally aligned. The work now is keeping the daily list honest and executing with consistency.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {executionGaps.map((gap) => (
                  <div
                    key={gap}
                    className="rounded-2xl p-4"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                      {gap}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Nearby weeks
            </p>
            <div className="mt-4 space-y-2">
              {nearbyWeeks.length === 0 ? (
                <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  No other saved weeks yet.
                </p>
              ) : (
                nearbyWeeks.map((weekNumber) => (
                  <button
                    key={weekNumber}
                    type="button"
                    onClick={() => router.push(`/dashboard/goals/${year}/w/${weekNumber}`)}
                    className="w-full rounded-2xl px-4 py-3 text-left flex items-center justify-between gap-3"
                    style={{
                      background: weekNumber === focusWeek ? "rgba(0,108,74,0.06)" : "#f8fbf9",
                      border: weekNumber === focusWeek ? "1px solid rgba(0,108,74,0.12)" : "1px solid rgba(0,0,0,0.05)",
                    }}
                  >
                    <span className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                      Week {weekNumber}
                    </span>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: "#8a9e97" }}>
                      chevron_right
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Habit support
            </p>
            {activeHabits.length === 0 ? (
              <p className="text-sm mt-4 leading-relaxed" style={{ color: "#6b7c75" }}>
                No active foundational habits are saved right now. If the weekly sprint depends on repeated behavior, that support layer should exist.
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
