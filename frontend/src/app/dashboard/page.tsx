"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { TODAY } from "@/lib/mockData";
import { PriorityCard } from "@/components/dashboard/PriorityCard";
import { SecondaryTaskRow } from "@/components/dashboard/SecondaryTaskRow";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { HabitsSection } from "@/components/dashboard/HabitsSection";
export default function DashboardHome() {
  const router = useRouter();
  const {
    dailyPriorities,
    secondaryTasks,
    metrics,
    habits,
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
      openModal: state.openModal,
      toggleDailyPriority: state.toggleDailyPriority,
      toggleSecondaryTask: state.toggleSecondaryTask,
      removeSecondaryTask: state.removeSecondaryTask,
    })),
  );

  const todayRows = dailyPriorities.filter((p) => p.date === TODAY);
  const remaining = todayRows.filter((p) => !p.completed).length;

  return (
    <>
      <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* ── Main Stage ── */}
          <section className="lg:col-span-8 space-y-7">
            {/* Today's Focus */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3
                    className="font-headline font-extrabold tracking-tight"
                    style={{ fontSize: "26px", color: "#1a1f1e" }}
                  >
                    Today&apos;s Focus
                  </h3>
                  {remaining > 0 && (
                    <span
                      className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                    >
                      {remaining} {remaining === 1 ? "Priority" : "Priorities"} Remaining
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal("add-daily-priority")}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={{ color: "#006c4a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,108,74,0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    Add priority
                  </button>
                  <button
                    onClick={() => openModal("edit-daily-priority")}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={{ color: "#5a6b65" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span className="material-symbols-outlined text-[15px]">tune</span>
                    Manage
                  </button>
                </div>
              </div>

              {todayRows.length === 0 ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{ background: "#fafcfb", border: "1.5px dashed rgba(0,108,74,0.25)" }}
                >
                  <p className="font-headline font-bold text-base mb-1" style={{ color: "#1a1f1e" }}>
                    No priorities for today yet
                  </p>
                  <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "#8a9e97" }}>
                    The home screen only shows tasks dated {TODAY}. Add them during onboarding (final step) or tap Edit to
                    define what you are executing today.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => openModal("add-daily-priority")}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                      style={{ background: "#006c4a" }}
                    >
                      Add today&apos;s first priority
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

            {/* Secondary Tasks */}
            <div
              className="rounded-2xl"
              style={{ background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.06)" }}
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>
                    Secondary Tasks
                  </p>
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: "#c4d0cb" }}>
                    Maintenance &amp; Quick Wins
                  </p>
                </div>
                <button
                  onClick={() => openModal("add-secondary-task")}
                  className="flex items-center gap-1 text-sm font-semibold transition-colors"
                  style={{ color: "#006c4a" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add New Task
                </button>
              </div>

              <div className="px-2 pb-3">
                {secondaryTasks.length === 0 ? (
                  <p
                    className="text-sm text-center py-8"
                    style={{ color: "#c4d0cb" }}
                  >
                    No secondary tasks yet — add one to get started
                  </p>
                ) : (
                  secondaryTasks.map((task) => (
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
            <AnalyticsPanel metrics={metrics} onDayReport={() => openModal("daily-report")} onWeekReport={() => openModal("weekly-report")} />
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
