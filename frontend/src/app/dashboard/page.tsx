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
import { DashboardCompletionPrompt } from "@/components/dashboard/DashboardCompletionPrompt";

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
      openModal: state.openModal,
      toggleDailyPriority: state.toggleDailyPriority,
      toggleSecondaryTask: state.toggleSecondaryTask,
      removeSecondaryTask: state.removeSecondaryTask,
    })),
  );

  const todayRows = dailyPriorities.filter((p) => p.date === activeDashboardDate);
  const todayTasks = secondaryTasks.filter((task) => task.date === activeDashboardDate);
  const remaining = todayRows.filter((p) => !p.completed).length;
  const isPreviewingAnotherDay = activeDashboardDate !== getToday();
  const displayDateLabel = useMemo(() => formatPlanDateLabel(activeDashboardDate), [activeDashboardDate]);

  return (
    <>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* ── Main Stage ── */}
          <section className="lg:col-span-8 space-y-7">
            {/* Today's Focus */}
            <div className="space-y-5">
              <div className="flex items-end justify-between gap-4 flex-wrap">
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
                      <h3
                        className="font-headline font-extrabold tracking-tight"
                        style={{ fontSize: "26px", color: "#1a1f1e" }}
                      >
                        Today&apos;s Focus
                      </h3>
                    </div>
                    {remaining > 0 && (
                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                      >
                        {remaining} {remaining === 1 ? "Priority" : "Priorities"} Remaining
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="rounded-[30px] p-5 sm:p-6 space-y-5"
                style={{ background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 10px 34px rgba(15, 23, 42, 0.04)" }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                      Main Priorities
                    </p>
                    <span className="text-xs font-medium" style={{ color: "#8a9e97" }}>
                      {displayDateLabel}
                    </span>
                  </div>
                  <button
                    onClick={() => openModal("add-daily-priority")}
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                    style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    Add main priority
                  </button>
                </div>

                {todayRows.length === 0 ? (
                  <div
                    className="rounded-2xl p-8 text-center"
                    style={{ background: "#fafcfb", border: "1.5px dashed rgba(0,108,74,0.25)" }}
                  >
                    <p className="font-headline font-bold text-base mb-1" style={{ color: "#1a1f1e" }}>
                      No main priorities saved yet
                    </p>
                    <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "#8a9e97" }}>
                      {isPreviewingAnotherDay
                        ? `Nothing is locked in for ${displayDateLabel} yet. Add the main priorities you want the user to execute first.`
                        : `The home screen shows the main priorities scheduled for ${displayDateLabel}. Add them during onboarding or from here.`}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => openModal("add-daily-priority")}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                        style={{ background: "#006c4a" }}
                      >
                        Add first main priority
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/goals")}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: "#fff", color: "#006c4a", border: "1.5px solid rgba(0,108,74,0.25)" }}
                      >
                        View goals hub
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            {/* Secondary Tasks */}
            <div
              className="rounded-[30px]"
              style={{ background: "#fbfcfb", border: "1.5px solid rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                    Supporting Tasks
                  </p>
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: "#a8b5af" }}>
                    Helpful work that supports the main priorities without competing with them.
                  </p>
                </div>
                <button
                  onClick={() => openModal("add-secondary-task")}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add supporting task
                </button>
              </div>

              <div className="px-2 pb-3">
                {todayTasks.length === 0 ? (
                  <p
                    className="text-sm text-center py-8"
                    style={{ color: "#c4d0cb" }}
                  >
                    No supporting tasks saved for this day yet
                  </p>
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
          <section className="lg:col-span-4">
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
      <DashboardCompletionPrompt />
    </>
  );
}
