"use client";

import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoalsHierarchyNav } from "@/components/goals/GoalsHierarchyNav";
import { GoalsInfoTooltip } from "@/components/goals/GoalsInfoTooltip";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { dashboardApi, habitsApi, tasksApi, type ApiDailyPriority, type ApiDashboard } from "@/lib/api";
import {
  countGoalStates,
  formatGoalDay,
  getGoalStateMeta,
  getProgressTone,
  listDaysForYearThroughDate,
} from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";
import type { DailyPriority, ModalType } from "@/lib/types";

const STATUS_GUIDE_DETAIL = [
  "Completed: daily priorities already finished.",
  "In Progress: priorities started and still moving without being overdue.",
  "At Risk: priorities overdue or already marked missed.",
  "Not Started: priorities with no progress yet.",
].join(" ");

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

function mapApiPriorityToStoreShape(priority: ApiDailyPriority): DailyPriority {
  return {
    id: priority.id,
    title: priority.title,
    description: priority.description,
    weeklyGoalId: priority.weekly_goal_id,
    date: priority.date,
    status: priority.status as DailyPriority["status"],
    completed: priority.completed,
    priority: priority.priority as DailyPriority["priority"],
    estimatedMinutes: priority.estimated_minutes,
    isMain: priority.is_main,
    tag: priority.tag,
    aiSuggested: priority.ai_suggested,
    editable: priority.editable,
  };
}

export default function DailyGoalsPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = useAppStore((state) => state.sessionId);
  const backendReady = useAppStore((state) => state.backendReady);
  const openModal = useAppStore((state) => state.openModal);
  const loadDashboard = useAppStore((state) => state.loadDashboard);
  const setActiveDashboardDate = useAppStore((state) => state.setActiveDashboardDate);
  const activeModal = useAppStore((state) => state.activeModal);
  const storeDailyPriorities = useAppStore((state) => state.dailyPriorities);
  const storeHabits = useAppStore((state) => state.habits);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedDayDetailsByDate, setSelectedDayDetailsByDate] = useState<Record<string, ApiDashboard>>({});
  const [selectedDayLoading, setSelectedDayLoading] = useState(false);
  const [selectedDayError, setSelectedDayError] = useState<string | null>(null);
  const modalDaySnapshotRef = useRef<string>("");
  const previousModalRef = useRef<ModalType | null>(null);

  const {
    ready,
    hasCachedData,
    error,
    today,
    yearDailyPriorities,
  } = useGoalsHierarchy(year);
  const dayQuery = searchParams?.get("day");
  const selectedDay = dayQuery && dayQuery.startsWith(`${year}-`) ? dayQuery : null;
  const selectedDayDetail = selectedDay ? selectedDayDetailsByDate[selectedDay] ?? null : null;

  const liveYear = Number(today.slice(0, 4));
  const throughDate =
    year === liveYear
      ? today
      : yearDailyPriorities.reduce((latest, item) => (item.date > latest ? item.date : latest), `${year}-12-31`);
  const daySlots = useMemo(() => listDaysForYearThroughDate(year, throughDate), [year, throughDate]);
  const selectedDayIsCurrent = selectedDay === today;
  const selectedDayStoreSnapshot = useMemo(() => {
    if (!selectedDay) return "";

    const priorities = storeDailyPriorities
      .filter((item) => item.date === selectedDay)
      .map((item) => ({
        id: item.id,
        title: item.title,
        weeklyGoalId: item.weeklyGoalId,
        completed: item.completed,
        isMain: item.isMain,
        tag: item.tag ?? "",
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const habits = storeHabits
      .map((habit) => ({
        id: habit.id,
        name: habit.name,
        frequency: habit.frequency,
        active: habit.active,
        completedToday: habit.completedToday,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return JSON.stringify({ priorities, habits });
  }, [selectedDay, storeDailyPriorities, storeHabits]);

  const refreshSelectedDayDetail = useCallback(async (options?: { background?: boolean }) => {
    if (!selectedDay || !sessionId || !backendReady) return;
    const hasCachedDetail = Boolean(selectedDayDetailsByDate[selectedDay]);
    if (!options?.background || !hasCachedDetail) {
      setSelectedDayLoading(true);
    }
    setSelectedDayError(null);
    try {
      const detail = await dashboardApi.get(sessionId, selectedDay);
      setSelectedDayDetailsByDate((current) => ({
        ...current,
        [selectedDay]: detail,
      }));
    } catch (error) {
      setSelectedDayError(error instanceof Error ? error.message : "Could not load this day.");
    } finally {
      if (!options?.background || !hasCachedDetail) {
        setSelectedDayLoading(false);
      }
    }
  }, [backendReady, selectedDay, selectedDayDetailsByDate, sessionId]);

  useEffect(() => {
    if (!selectedDay) {
      setSelectedDayError(null);
      setSelectedDayLoading(false);
      return;
    }
    if (selectedDayDetailsByDate[selectedDay]) {
      setSelectedDayError(null);
      setSelectedDayLoading(false);
      return;
    }
    void refreshSelectedDayDetail();
  }, [refreshSelectedDayDetail, selectedDay, selectedDayDetailsByDate]);

  useEffect(() => {
    const previousModal = previousModalRef.current;
    const currentModal = activeModal;
    const relevantModals: ModalType[] = [
      "add-daily-priority",
      "edit-daily-priority",
      "add-secondary-task",
      "edit-secondary-task",
      "manage-habits",
    ];

    if (
      previousModal &&
      relevantModals.includes(previousModal) &&
      currentModal === null &&
      selectedDayIsCurrent &&
      selectedDay &&
      modalDaySnapshotRef.current !== selectedDayStoreSnapshot
    ) {
      void refreshSelectedDayDetail({ background: true });
    }

    previousModalRef.current = currentModal;
  }, [activeModal, refreshSelectedDayDetail, selectedDay, selectedDayIsCurrent, selectedDayStoreSnapshot]);

  const pageSize = 14;

  useEffect(() => {
    if (!selectedDay) return;
    const dayIndex = daySlots.findIndex((day) => day === selectedDay);
    if (dayIndex === -1) return;
    const orderedIndex = sortOrder === "desc" ? daySlots.length - 1 - dayIndex : dayIndex;
    setPage(Math.floor(orderedIndex / pageSize) + 1);
  }, [daySlots, pageSize, selectedDay, sortOrder]);

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
          Goals overview
        </button>
      </div>
    );
  }

  if (!ready && !hasCachedData) {
    return (
      <GoalsLoadingShell
        eyebrow={`${year} daily goals`}
        title="Loading the daily execution layer"
        detail="We are pulling daily priorities across the year so the table reflects the real day-by-day progression of execution."
      />
    );
  }

  const rows = daySlots.map((date) => {
    const priorities = yearDailyPriorities.filter((priority) => priority.date === date);
    const stateCounts = countGoalStates(priorities, today);
    const completedCount = priorities.filter((priority) => priority.completed || priority.status === "completed").length;
    const progress = priorities.length > 0 ? Math.round((completedCount / priorities.length) * 100) : 0;
    return {
      date,
      prioritiesCount: priorities.length,
      completed: stateCounts.completed,
      inProgress: stateCounts["on-track"],
      atRisk: stateCounts["at-risk"],
      notStarted: stateCounts["not-started"],
      progress,
    };
  });

  const sortedRows = [...rows].sort((a, b) =>
    sortOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
  );
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(sortedRows.length, currentPage * pageSize);

  function pushDay(day: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("day", day);
    router.push(`/dashboard/goals/${year}/daily?${params.toString()}`, { scroll: false });
  }

  async function prepareCurrentDayEditing() {
    if (!selectedDay) return;
    setActiveDashboardDate(selectedDay);
    try {
      await loadDashboard(selectedDay);
    } catch {
      // Open the modal anyway so a dashboard refresh hiccup does not block editing.
    }
  }

  async function openCurrentDayModal(modal: ModalType, payload?: unknown) {
    modalDaySnapshotRef.current = selectedDayStoreSnapshot;
    await prepareCurrentDayEditing();
    openModal(modal, payload);
  }

  async function toggleTask(task: ApiDailyPriority) {
    if (!sessionId || !selectedDayIsCurrent) return;
    await tasksApi.toggleStatus(sessionId, task.id, !task.completed);
    await refreshSelectedDayDetail();
    await loadDashboard(selectedDay ?? today);
  }

  async function toggleHabit(habitId: string, completedToday: boolean) {
    if (!sessionId || !selectedDayIsCurrent || !selectedDay) return;
    await habitsApi.toggle(sessionId, habitId, !completedToday, selectedDay);
    await refreshSelectedDayDetail();
    await loadDashboard(selectedDay);
  }

  function renderSelectedDayDetail() {
    if (!selectedDay) return null;

    return (
      <div
        className="rounded-[24px] p-5"
        style={{ background: "#f9fbfa", border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              This day
            </p>
            <h2 className="font-headline font-bold text-2xl mt-2" style={{ color: "#1a1f1e" }}>
              {formatGoalDay(selectedDay)}
            </h2>
            <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: "#6b7c75" }}>
              See what was planned for this day. If it is today, you can still edit it.
            </p>
          </div>

          {selectedDayIsCurrent ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  void openCurrentDayModal("add-daily-priority");
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-[0_12px_28px_rgba(0,108,74,0.16)]"
                style={{ background: "#006c4a", color: "#fff" }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add main priority
              </button>
              <button
                type="button"
                onClick={() => {
                  void openCurrentDayModal("add-secondary-task");
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#fff", color: "#006c4a", border: "1px solid rgba(0,108,74,0.18)" }}
              >
                <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                Add supporting task
              </button>
              <button
                type="button"
                onClick={() => {
                  void openCurrentDayModal("manage-habits");
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#fff", color: "#006c4a", border: "1px solid rgba(0,108,74,0.18)" }}
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                Manage habits
              </button>
            </div>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7c75" }}
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Read only
            </span>
          )}
        </div>

        {selectedDayLoading ? (
          <div className="mt-5 rounded-2xl p-5 text-sm" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", color: "#6b7c75" }}>
            Loading this day&apos;s plan…
          </div>
        ) : selectedDayError ? (
          <div className="mt-5 rounded-2xl p-5 text-sm" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.12)", color: "#8a5b12" }}>
            {selectedDayError}
          </div>
        ) : selectedDayDetail ? (
          <div className="mt-5 space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Main priorities
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {selectedDayDetail.daily_priorities.length} priority{selectedDayDetail.daily_priorities.length === 1 ? "" : "ies"}
                </p>
              </div>
              {selectedDayDetail.daily_priorities.length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No main priorities were saved for this day.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {selectedDayDetail.daily_priorities.map((priority) => {
                    const storePriority = mapApiPriorityToStoreShape(priority);
                    return (
                      <div
                        key={priority.id}
                        className="bg-white rounded-2xl p-5 flex h-full min-h-[220px] flex-col gap-4"
                        style={{
                          border: priority.completed ? "1px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.07)",
                          opacity: priority.completed ? 0.72 : 1,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                            style={{
                              background: priority.completed ? "rgba(0,108,74,0.10)" : "rgba(0,0,0,0.05)",
                              color: priority.completed ? "#006c4a" : "#6b7c75",
                            }}
                          >
                            {priority.completed ? "Done" : "Open"}
                          </span>
                          {selectedDayIsCurrent ? (
                            <button
                              type="button"
                              onClick={() => {
                                void openCurrentDayModal("edit-daily-priority", storePriority);
                              }}
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)", color: "#6b7c75" }}
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                          ) : null}
                        </div>

                        <div className="flex flex-1 flex-col justify-between gap-4">
                          <p
                            className="text-sm font-semibold leading-snug"
                            style={{
                              color: priority.completed ? "#8a9e97" : "#1a1f1e",
                              textDecoration: priority.completed ? "line-through" : "none",
                            }}
                          >
                            {priority.title}
                          </p>

                          {selectedDayIsCurrent ? (
                            <button
                              type="button"
                              onClick={() => void toggleTask(priority)}
                              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                              style={{
                                background: priority.completed ? "rgba(0,108,74,0.09)" : "#f7faf8",
                                border: priority.completed ? "1px solid rgba(0,108,74,0.16)" : "1px solid rgba(0,0,0,0.08)",
                                color: priority.completed ? "#006c4a" : "#4b635b",
                              }}
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {priority.completed ? "task_alt" : "check_circle"}
                              </span>
                              {priority.completed ? "Completed" : "Mark complete"}
                            </button>
                          ) : (
                            <p className="text-xs font-semibold" style={{ color: priority.completed ? "#006c4a" : "#8a9e97" }}>
                              {priority.completed ? "Completed on this day" : "Left incomplete on this day"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Supporting tasks
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {selectedDayDetail.secondary_tasks.length} task{selectedDayDetail.secondary_tasks.length === 1 ? "" : "s"}
                </p>
              </div>
              {selectedDayDetail.secondary_tasks.length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No supporting tasks were saved for this day.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayDetail.secondary_tasks.map((task) => {
                    const storeTask = mapApiPriorityToStoreShape(task);
                    return (
                      <div
                        key={task.id}
                        className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                      >
                        <div className="min-w-0">
                          <p
                            className="text-sm font-semibold"
                            style={{
                              color: task.completed ? "#8a9e97" : "#1a1f1e",
                              textDecoration: task.completed ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "#6b7c75" }}>
                            {task.tag || "Supporting task"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedDayIsCurrent ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void toggleTask(task)}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                                style={{
                                  background: task.completed ? "rgba(0,108,74,0.09)" : "#f7faf8",
                                  border: task.completed ? "1px solid rgba(0,108,74,0.16)" : "1px solid rgba(0,0,0,0.08)",
                                  color: task.completed ? "#006c4a" : "#4b635b",
                                }}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {task.completed ? "task_alt" : "check_circle"}
                                </span>
                                {task.completed ? "Done" : "Complete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void openCurrentDayModal("edit-secondary-task", storeTask);
                                }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)", color: "#6b7c75" }}
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            </>
                          ) : (
                            <p className="text-xs font-semibold" style={{ color: task.completed ? "#006c4a" : "#8a9e97" }}>
                              {task.completed ? "Completed on this day" : "Left incomplete on this day"}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  Habit status
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {selectedDayDetail.habits.filter((habit) => habit.active).length} active habit{selectedDayDetail.habits.filter((habit) => habit.active).length === 1 ? "" : "s"}
                </p>
              </div>
              {selectedDayDetail.habits.filter((habit) => habit.active).length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No active habits were available for this day.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {selectedDayDetail.habits.filter((habit) => habit.active).map((habit) => (
                    <div
                      key={habit.id}
                      className="rounded-2xl p-4"
                      style={{
                        background: "#fff",
                        border: habit.completed_today ? "1px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]" style={{ color: habit.completed_today ? "#006c4a" : "#8a9e97" }}>
                              {habit.icon}
                            </span>
                            <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                              {habit.name}
                            </p>
                          </div>
                          <p className="text-xs mt-2" style={{ color: "#6b7c75" }}>
                            {habit.frequency.replace("_", " ")}
                          </p>
                        </div>
                        {selectedDayIsCurrent ? (
                          <button
                            type="button"
                            onClick={() => void toggleHabit(habit.id, habit.completed_today)}
                            className="w-7 h-7 rounded-full flex items-center justify-center"
                            style={{
                              background: habit.completed_today ? "#006c4a" : "#f7faf8",
                              border: habit.completed_today ? "none" : "1px solid rgba(0,0,0,0.08)",
                              color: habit.completed_today ? "#fff" : "#6b7c75",
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {habit.completed_today ? "check" : "add"}
                            </span>
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                            style={{
                              background: habit.completed_today ? "rgba(0,108,74,0.08)" : "rgba(0,0,0,0.05)",
                              color: habit.completed_today ? "#006c4a" : "#8a9e97",
                            }}
                          >
                            {habit.completed_today ? "Done" : "Not done"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl p-5 text-sm" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", color: "#6b7c75" }}>
            Choose a day from the table to inspect the exact priorities, tasks, and habits for that date.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/goals/${year}/weekly`)}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
                style={{ color: "#8a9e97" }}
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                Weekly goals
              </button>
              <span style={{ color: "#d1d9d5" }}>/</span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
                Daily goals
              </span>
            </div>

            <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "30px", color: "#1a1f1e" }}>
              All Daily Goals
            </h1>
            <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
              A snapshot of daily execution across the year.
            </p>
          </div>

          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#1a1f1e" }}
          >
            <span className="material-symbols-outlined text-[17px]">calendar_month</span>
            <span>{formatHeaderDate(today)}</span>
          </div>
        </div>

        <GoalsHierarchyNav year={year} active="daily" />
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
        className="rounded-[28px] p-5"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <label
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
          >
            <span>Sort</span>
            <select
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as "desc" | "asc");
                setPage(1);
              }}
              className="bg-transparent text-sm font-semibold outline-none"
              style={{ color: "#1a1f1e" }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>

          <div
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
          >
            <span>Status guide</span>
            <GoalsInfoTooltip label="Daily goal statuses" detail={STATUS_GUIDE_DETAIL} />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[22px]" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          <table className="min-w-full">
            <thead>
              <tr className="text-left" style={{ background: "#fbfcfb" }}>
                {["Day", "Tasks / Goals", "Completed", "In Progress", "At Risk", "Not Started", "Progress"].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: "#8a9e97" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const progressTone = getProgressTone(row.progress);
                const current = row.date === today && year === liveYear;
                return (
                  <Fragment key={row.date}>
                    <tr
                      onClick={() => pushDay(row.date)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderTop: "1px solid rgba(0,0,0,0.06)",
                        background: current ? "rgba(0,108,74,0.03)" : "transparent",
                      }}
                    >
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold" style={{ color: current ? "#006c4a" : "#1a1f1e" }}>
                          {formatGoalDay(row.date)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {row.prioritiesCount}
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("completed").text }}>
                        {row.completed}
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("on-track").text }}>
                        {row.inProgress}
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("at-risk").text }}>
                        {row.atRisk}
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("not-started").text }}>
                        {row.notStarted}
                      </td>
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold min-w-[36px]" style={{ color: progressTone }}>
                            {row.progress}%
                          </span>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${row.progress}%`, background: progressTone }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                    {selectedDay === row.date ? (
                      <tr style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <td colSpan={7} className="px-3 py-4" style={{ background: "#fcfdfc" }}>
                          {renderSelectedDayDetail()}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 flex-wrap text-sm" style={{ color: "#6b7c75" }}>
          <p>
            Showing {startRow} to {endRow} of {sortedRows.length} days
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3 rounded-xl inline-flex items-center justify-center"
                style={{
                  background: currentPage === 1 ? "#f6f8f7" : "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: currentPage === 1 ? "#b0bdb7" : "#4b635b",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className="w-9 h-9 rounded-xl text-sm font-bold"
                  style={{
                    background: pageNumber === currentPage ? "rgba(0,108,74,0.08)" : "#fff",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: pageNumber === currentPage ? "#006c4a" : "#6b7c75",
                  }}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-3 rounded-xl inline-flex items-center justify-center"
                style={{
                  background: currentPage === totalPages ? "#f6f8f7" : "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: currentPage === totalPages ? "#b0bdb7" : "#4b635b",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          ) : (
            <div className="h-9" />
          )}
        </div>

      </div>
    </div>
  );
}
