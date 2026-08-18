"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getToday } from "@/lib/mockData";
import { SecondaryTaskRow } from "@/components/dashboard/SecondaryTaskRow";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { HabitsSection } from "@/components/dashboard/HabitsSection";
import { DAILY_MAIN_GOAL_CAP, DAILY_SECONDARY_GOAL_CAP } from "@/lib/planningConstraints";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

function formatPlanDateLabel(isoDate: string) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function compactDescription(value?: string, fallback?: string) {
  const copy = (value?.trim() || fallback || "").replace(/\s+/g, " ");
  if (!copy) return "";
  return copy.length > 120 ? `${copy.slice(0, 117).trimEnd()}...` : copy;
}

function InlineSectionLoader({ title }: { title: string }) {
  return (
    <div className="rounded-[24px] bg-[#fafcfb] p-4 sm:p-5">
      <AppLoadingScreen fullscreen={false} title={title} />
    </div>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const {
    dailyPriorities,
    secondaryTasks,
    metrics,
    habits,
    activeDashboardDate,
    dashboardLoading,
    openModal,
    toggleDailyPriority,
    toggleSecondaryTask,
    removeSecondaryTask,
  } = useAppStore(
    useShallow((state) => ({
      dailyPriorities: state.dailyPriorities,
      secondaryTasks: state.secondaryTasks,
      metrics: state.metrics,
      habits: state.habits,
      activeDashboardDate: state.activeDashboardDate,
      dashboardLoading: state.dashboardLoading,
      openModal: state.openModal,
      toggleDailyPriority: state.toggleDailyPriority,
      toggleSecondaryTask: state.toggleSecondaryTask,
      removeSecondaryTask: state.removeSecondaryTask,
    })),
  );

  const todayRows = dailyPriorities.filter((p) => p.date === activeDashboardDate);
  const todayTasks = secondaryTasks.filter((task) => task.date === activeDashboardDate);
  const featuredMainGoal =
    todayRows.find((priority) => !priority.completed) ??
    todayRows[0] ??
    null;
  const completedGoalsToday =
    todayRows.filter((priority) => priority.completed).length + todayTasks.filter((task) => task.completed).length;
  const totalGoalsToday = todayRows.length + todayTasks.length;
  const todaysProgress = totalGoalsToday > 0 ? Math.round((completedGoalsToday / totalGoalsToday) * 100) : 0;
  const mainPriorityCapReached = todayRows.length >= DAILY_MAIN_GOAL_CAP;
  const secondaryGoalCapReached = todayTasks.length >= DAILY_SECONDARY_GOAL_CAP;
  const isPreviewingAnotherDay = activeDashboardDate !== getToday();
  const displayDateLabel = useMemo(() => formatPlanDateLabel(activeDashboardDate), [activeDashboardDate]);
  const showDashboardHydratingState = dashboardLoading && todayRows.length === 0 && todayTasks.length === 0;
  const softActionStyle = {
    background: "rgba(0,108,74,0.06)",
    color: "#006c4a",
    border: "1px solid rgba(0,108,74,0.08)",
  } as const;
  const sectionSurfaceStyle = {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(251,252,251,0.98) 100%)",
    border: "1.5px solid rgba(0,0,0,0.05)",
    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.045)",
  } as const;
  const interactiveButtonClass =
    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]";
  const featuredDescription = featuredMainGoal
    ? compactDescription(featuredMainGoal.description, "Keep this goal clear, focused, and easy to move forward today.")
    : "";
  const featuredTruthReason = featuredMainGoal?.truthReason?.trim() || "";

  return (
    <>
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        <div className="grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12 lg:gap-8">
          {/* ── Main Stage ── */}
          <section className="space-y-5 md:space-y-7 lg:col-span-8">
            {/* Today's Focus */}
            <div className="space-y-4 md:space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3 md:gap-4">
                <div className="flex flex-col gap-2">
                  {isPreviewingAnotherDay && (
                    <span
                      className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                    >
                      <span className="material-symbols-outlined text-[14px]">calendar_clock</span>
                      Planned day · {displayDateLabel}
                    </span>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Daily Execution
                      </p>
                      <h3 className="font-headline text-[24px] font-extrabold tracking-tight sm:text-[26px]" style={{ color: "#1a1f1e" }}>
                        Today&apos;s Focus
                      </h3>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-[24px] p-5 sm:rounded-[30px] sm:p-6"
                style={sectionSurfaceStyle}
              >
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                      Today&apos;s Progress
                    </p>
                    <div className="flex items-end gap-3">
                      <span className="font-headline text-[42px] font-extrabold leading-none tracking-tight" style={{ color: "#1a1f1e" }}>
                        {completedGoalsToday}
                      </span>
                      <span className="pb-1 text-[24px] font-semibold" style={{ color: "#8a9e97" }}>
                        of {totalGoalsToday || 0}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "#8a9e97" }}>
                      goals completed
                    </p>
                    <div className="pt-1">
                      <div className="h-3 w-full rounded-full bg-black/5">
                        <div
                          className="h-3 rounded-full"
                          style={{ width: `${todaysProgress}%`, background: "linear-gradient(90deg, #006c4a 0%, #0a8754 100%)" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:justify-self-end">
                    <div className="rounded-[22px] px-4 py-4" style={{ background: "rgba(0,108,74,0.04)", border: "1px solid rgba(0,108,74,0.08)" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}>
                          <span className="material-symbols-outlined text-[24px]">local_fire_department</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                            Main Goal Streak
                          </p>
                          <div className="mt-1 flex items-end gap-2">
                            <span className="font-headline text-[34px] font-extrabold leading-none tracking-tight" style={{ color: "#1a1f1e" }}>
                              {metrics.executionStreak}
                            </span>
                            <span className="pb-1 text-sm" style={{ color: "#8a9e97" }}>
                              days
                            </span>
                          </div>
                          <p className="mt-2 max-w-[190px] text-[11px] leading-5" style={{ color: "#8a9e97" }}>
                            Counts only when your main goal for the day is completed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="space-y-4 rounded-[24px] p-4 sm:rounded-[30px] sm:p-6 sm:space-y-5"
                style={sectionSurfaceStyle}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                      Main Goal
                    </p>
                    <p className="mt-1 text-sm leading-6" style={{ color: "#8a9e97" }}>
                      The single priority that should define a successful day.
                    </p>
                  </div>
                  <button
                    onClick={() => openModal("add-daily-priority")}
                    disabled={mainPriorityCapReached}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold sm:w-auto ${mainPriorityCapReached ? "" : interactiveButtonClass}`}
                    style={{
                      ...(mainPriorityCapReached
                        ? { background: "rgba(0,0,0,0.06)", color: "#8a9e97", border: "1px solid rgba(0,0,0,0.03)" }
                        : softActionStyle),
                    }}
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    {mainPriorityCapReached ? "Main goal saved" : "Set main goal"}
                  </button>
                </div>

                {featuredMainGoal === null ? (
                  showDashboardHydratingState ? (
                    <InlineSectionLoader title="Loading today's main goal" />
                  ) : (
                    <div
                      className="rounded-[24px] p-6 text-center sm:p-8"
                      style={{ background: "#fafcfb", border: "1.5px dashed rgba(0,108,74,0.25)" }}
                    >
                      <div
                        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                      >
                        <span className="material-symbols-outlined text-[24px]">target</span>
                      </div>
                      <p className="font-headline font-bold text-lg mb-1" style={{ color: "#1a1f1e" }}>
                        No main goal saved yet
                      </p>
                      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "#8a9e97" }}>
                        {isPreviewingAnotherDay
                          ? `Nothing is planned for ${displayDateLabel} yet. Add the main goal that should lead that day.`
                          : "Start with the one goal that matters most today and let everything else support it."}
                      </p>
                      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                          type="button"
                          onClick={() => openModal("add-daily-priority")}
                          className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${interactiveButtonClass}`}
                          style={{ background: "#006c4a" }}
                        >
                          Add main goal
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/goals")}
                          className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${interactiveButtonClass}`}
                          style={{ background: "#fff", color: "#006c4a", border: "1.5px solid rgba(0,108,74,0.25)" }}
                        >
                          View goals hub
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div
                    className="rounded-[26px] px-5 py-5 sm:px-6 sm:py-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(0,108,74,0.10)]"
                    style={{
                      background: "linear-gradient(180deg, rgba(248,252,250,0.98) 0%, rgba(255,255,255,0.98) 100%)",
                      border: "1px solid rgba(0,108,74,0.10)",
                      boxShadow: "0 6px 26px rgba(15,23,42,0.035)",
                    }}
                  >
                    <div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                                Main Goal
                              </p>
                              <h4 className="mt-2 font-headline text-[22px] font-extrabold leading-tight tracking-tight" style={{ color: "#101615" }}>
                                {featuredMainGoal.title}
                              </h4>
                              {featuredMainGoal.tag ? (
                                <div className="mt-3">
                                  <span
                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                                    style={{
                                      background: "rgba(0,108,74,0.08)",
                                      color: "#0a8754",
                                    }}
                                  >
                                    {featuredMainGoal.tag}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void useAppStore.getState().removeDailyPriority(featuredMainGoal.id)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-black/6 bg-white text-[#8a9e97] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#fff4f4] hover:text-[#d43d3d] hover:shadow-[0_10px_20px_rgba(212,61,61,0.10)]"
                            aria-label="Delete main goal"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>

                        <p className="max-w-2xl text-[15px] leading-7 line-clamp-2" style={{ color: "#667670" }}>
                          {featuredDescription}
                        </p>

                        {featuredTruthReason ? (
                          <p className="text-sm leading-6" style={{ color: "#6b7c75" }}>
                            {featuredTruthReason}
                          </p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm" style={{ color: "#667670" }}>
                          {featuredMainGoal.estimatedMinutes ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px]">schedule</span>
                              {featuredMainGoal.estimatedMinutes} min
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => toggleDailyPriority(featuredMainGoal.id)}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white ${interactiveButtonClass}`}
                            style={{ background: "#0a8754" }}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {featuredMainGoal.completed ? "undo" : "task_alt"}
                            </span>
                            {featuredMainGoal.completed ? "Mark as active" : "Mark as complete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openModal("edit-daily-priority", featuredMainGoal)}
                            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${interactiveButtonClass}`}
                            style={{ background: "#fff", color: "#5d6c67", border: "1.5px solid rgba(0,0,0,0.08)" }}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            Edit Goal
                          </button>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Goals */}
            <div
              className="rounded-[24px] sm:rounded-[30px]"
              style={sectionSurfaceStyle}
            >
                <div className="flex flex-col gap-3 px-4 pb-4 pt-4 sm:px-6 sm:pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                      Secondary Goals
                    </p>
                    <p className="mt-1 text-sm leading-6" style={{ color: "#8a9e97" }}>
                      Additional goals for the day that still deserve attention.
                    </p>
                  </div>
                  <button
                    onClick={() => openModal("add-secondary-task")}
                    disabled={secondaryGoalCapReached}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold sm:w-auto ${secondaryGoalCapReached ? "" : interactiveButtonClass}`}
                    style={
                      secondaryGoalCapReached
                        ? { background: "rgba(0,0,0,0.06)", color: "#8a9e97", border: "1px solid rgba(0,0,0,0.03)" }
                        : softActionStyle
                    }
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    {secondaryGoalCapReached ? "3 secondary goals saved" : "Add goal"}
                  </button>
              </div>

              <div className="px-2 pb-3">
                {todayTasks.length === 0 ? (
                  showDashboardHydratingState ? (
                    <div className="px-3 pb-2">
                      <InlineSectionLoader title="Loading secondary goals" />
                    </div>
                  ) : (
                    <div
                      className="mx-3 mb-2 rounded-[24px] px-5 py-5 text-center"
                      style={{ background: "#ffffff", border: "1px dashed rgba(0,108,74,0.18)" }}
                    >
                      <div
                        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{ background: "rgba(0,108,74,0.06)", color: "#006c4a" }}
                      >
                        <span className="material-symbols-outlined text-[22px]">checklist</span>
                      </div>
                      <p className="font-headline font-bold text-lg" style={{ color: "#1a1f1e" }}>
                        No secondary goals planned for this day
                      </p>
                      <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: "#8a9e97" }}>
                        That is okay. Keep the day lighter, let your main goals lead, and use routines to carry the rest.
                      </p>
                    </div>
                  )
                ) : (
                  todayTasks.map((task) => (
                    <SecondaryTaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggleSecondaryTask(task.id)}
                      onRemove={() => removeSecondaryTask(task.id)}
                      onEdit={() => openModal("edit-secondary-task", task)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Routines */}
            <div
              className="rounded-[24px] p-4 sm:rounded-[30px] sm:p-6"
              style={sectionSurfaceStyle}
            >
              <HabitsSection
                habits={habits}
                onManage={() => openModal("manage-habits")}
                description="These are the repeated actions that steady the day around your main and secondary goals."
                eyebrow="Today’s Routines"
                actionLabel="View all"
                actionIcon="arrow_forward"
              />
            </div>
          </section>

          {/* ── Right Sidebar ── */}
          <section className="hidden lg:block lg:col-span-4">
            <AnalyticsPanel metrics={metrics} />
          </section>
        </div>
      </div>
    </>
  );
}
