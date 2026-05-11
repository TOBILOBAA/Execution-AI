"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getToday } from "@/lib/mockData";
import { PriorityCard } from "@/components/dashboard/PriorityCard";
import { SecondaryTaskRow } from "@/components/dashboard/SecondaryTaskRow";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { HabitsSection } from "@/components/dashboard/HabitsSection";

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
  const remaining = todayRows.filter((p) => !p.completed).length;
  const mainPriorityCapReached = todayRows.length >= 3;
  const isPreviewingAnotherDay = activeDashboardDate !== getToday();
  const displayDateLabel = useMemo(() => formatPlanDateLabel(activeDashboardDate), [activeDashboardDate]);
  const showDashboardHydratingState = dashboardLoading && todayRows.length === 0 && todayTasks.length === 0;

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
                      Tomorrow preview · {displayDateLabel}
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
                    {remaining > 0 && (
                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                      >
                        {remaining} {remaining === 1 ? "Goal" : "Goals"} Remaining
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="space-y-4 rounded-[24px] p-4 sm:rounded-[30px] sm:p-6 sm:space-y-5"
                style={{ background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 34px rgba(15, 23, 42, 0.04)" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                      Main Goals
                    </p>
                    <span className="text-xs font-medium" style={{ color: "#8a9e97" }}>
                      {displayDateLabel}
                    </span>
                  </div>
                  <button
                    onClick={() => openModal("add-daily-priority")}
                    disabled={mainPriorityCapReached}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold sm:w-auto"
                    style={{
                      background: mainPriorityCapReached ? "rgba(0,0,0,0.06)" : "rgba(0,108,74,0.08)",
                      color: mainPriorityCapReached ? "#8a9e97" : "#006c4a",
                    }}
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    {mainPriorityCapReached ? "Main goal cap reached" : "Add main goal"}
                  </button>
                </div>

                {todayRows.length === 0 ? (
                  showDashboardHydratingState ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="rounded-[24px] p-5 animate-pulse"
                          style={{ background: "#fafcfb", border: "1px solid rgba(0,0,0,0.05)" }}
                        >
                          <div className="h-3 w-20 rounded-full" style={{ background: "#e5ece8" }} />
                          <div className="mt-4 h-6 w-3/4 rounded-full" style={{ background: "#e5ece8" }} />
                          <div className="mt-3 h-3 w-full rounded-full" style={{ background: "#eef3f0" }} />
                          <div className="mt-2 h-3 w-5/6 rounded-full" style={{ background: "#eef3f0" }} />
                          <div className="mt-6 h-9 w-24 rounded-full" style={{ background: "#e5ece8" }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="rounded-2xl p-6 text-center sm:p-8"
                      style={{ background: "#fafcfb", border: "1.5px dashed rgba(0,108,74,0.25)" }}
                    >
                      <p className="font-headline font-bold text-base mb-1" style={{ color: "#1a1f1e" }}>
                        No main goals saved yet
                      </p>
                      <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "#8a9e97" }}>
                        {isPreviewingAnotherDay
                          ? `Nothing is locked in for ${displayDateLabel} yet. Add the main goals you want the user to execute first.`
                          : `The home screen shows the main goals scheduled for ${displayDateLabel}. Add them during onboarding or from here.`}
                      </p>
                      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                          type="button"
                          onClick={() => openModal("add-daily-priority")}
                          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                          style={{ background: "#006c4a" }}
                        >
                          Add first main goal
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/goals")}
                          className="rounded-xl px-5 py-2.5 text-sm font-bold"
                          style={{ background: "#fff", color: "#006c4a", border: "1.5px solid rgba(0,108,74,0.25)" }}
                        >
                          View goals hub
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {todayRows.map((priority, i) => (
                      <PriorityCard
                        key={priority.id}
                        priority={priority}
                        index={i}
                        onToggle={() => toggleDailyPriority(priority.id)}
                        onEdit={() => openModal("edit-daily-priority", priority)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Secondary Goals */}
            <div
              className="rounded-[24px] sm:rounded-[30px]"
              style={{ background: "#fbfcfb", border: "1.5px solid rgba(0,0,0,0.05)" }}
            >
              <div className="flex flex-col gap-3 px-4 pb-4 pt-4 sm:px-6 sm:pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                    Secondary Goals
                  </p>
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: "#a8b5af" }}>
                    Additional goals for the day that still deserve attention.
                  </p>
                </div>
                <button
                  onClick={() => openModal("add-secondary-task")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold sm:w-auto"
                  style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add secondary goal
                </button>
              </div>

              <div className="px-2 pb-3">
                {todayTasks.length === 0 ? (
                  showDashboardHydratingState ? (
                    <div className="space-y-3 px-4 py-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="rounded-2xl px-4 py-4 animate-pulse"
                          style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.05)" }}
                        >
                          <div className="h-3 w-24 rounded-full" style={{ background: "#e5ece8" }} />
                          <div className="mt-3 h-4 w-2/3 rounded-full" style={{ background: "#eef3f0" }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-sm text-center py-8"
                      style={{ color: "#c4d0cb" }}
                    >
                      No secondary goals saved for this day yet
                    </p>
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
          </section>

          {/* ── Right Sidebar ── */}
          <section className="hidden md:block lg:col-span-4">
            <AnalyticsPanel metrics={metrics} />
          </section>

          {/* ── Habits ── */}
          <section className="lg:col-span-12">
            <HabitsSection
              habits={habits}
              onManage={() => openModal("manage-habits")}
            />
          </section>
        </div>
      </div>
    </>
  );
}
