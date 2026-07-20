"use client";

import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoalsHierarchyNav } from "@/components/goals/GoalsHierarchyNav";
import { GoalsInfoTooltip } from "@/components/goals/GoalsInfoTooltip";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { dashboardApi, type ApiDailyPriority, type ApiDashboard, type ApiHabit } from "@/lib/api";
import {
  classifyGoalState,
  countGoalStates,
  formatGoalDay,
  getGoalDisplayStatusLabel,
  isGoalComplete,
  getGoalStateMeta,
  getProgressTone,
  listDaysForYearThroughDate,
} from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";
import type { DailyPriority, FoundationalHabit, ModalType } from "@/lib/types";

const STATUS_GUIDE_DETAIL = [
  "Completed: daily goals already finished.",
  "In Progress: goals started and still moving without being overdue.",
  "At Risk: goals overdue or already marked missed.",
  "Not Started: goals with no progress yet.",
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
    truthStatus: priority.truth_status as DailyPriority["truthStatus"],
    truthProgress: priority.truth_progress,
    truthReason: priority.truth_reason,
    hasActivity: priority.has_activity,
    linkedChildrenCount: priority.linked_children_count,
    completedChildrenCount: priority.completed_children_count,
    periodClosed: priority.period_closed,
  };
}

function mapStorePriorityToApiShape(priority: DailyPriority): ApiDailyPriority {
  return {
    id: priority.id,
    session_id: "",
    daily_plan_id: "",
    weekly_goal_id: priority.weeklyGoalId,
    title: priority.title,
    description: priority.description,
    date: priority.date,
    status: priority.status,
    completed: priority.completed,
    priority: priority.priority,
    estimated_minutes: priority.estimatedMinutes,
    is_main: priority.isMain,
    tag: priority.tag,
    ai_suggested: priority.aiSuggested ?? false,
    editable: priority.editable,
    truth_status: priority.truthStatus,
    truth_progress: priority.truthProgress,
    truth_reason: priority.truthReason,
    has_activity: priority.hasActivity,
    linked_children_count: priority.linkedChildrenCount,
    completed_children_count: priority.completedChildrenCount,
    period_closed: priority.periodClosed,
    created_at: "",
    updated_at: "",
  };
}

function mapStoreHabitToApiShape(habit: FoundationalHabit): ApiHabit {
  return {
    id: habit.id,
    session_id: "",
    name: habit.name,
    icon: habit.icon,
    frequency: habit.frequency,
    active: habit.active,
    category_id: habit.categoryId,
    yearly_goal_id: habit.yearlyGoalId,
    monthly_goal_id: habit.monthlyGoalId,
    weekly_goal_id: habit.weeklyGoalId,
    sort_order: 0,
    completed_today: habit.completedToday,
    streak: habit.streak,
    created_at: "",
    updated_at: "",
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
  const toggleDailyPriority = useAppStore((state) => state.toggleDailyPriority);
  const toggleSecondaryTask = useAppStore((state) => state.toggleSecondaryTask);
  const toggleHabitInStore = useAppStore((state) => state.toggleHabit);
  const activeModal = useAppStore((state) => state.activeModal);
  const storeDailyPriorities = useAppStore((state) => state.dailyPriorities);
  const storeSecondaryTasks = useAppStore((state) => state.secondaryTasks);
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
    weeklyGoals,
    monthlyGoals,
    yearlyGoals,
  } = useGoalsHierarchy(year);
  const dayQuery = searchParams?.get("day");
  const selectedDay = dayQuery && dayQuery.startsWith(`${year}-`) ? dayQuery : null;
  const selectedDayDetail = selectedDay ? selectedDayDetailsByDate[selectedDay] ?? null : null;

  const liveYear = Number(today.slice(0, 4));
  const activeYearDailyPriorities = useMemo(
    () => storeDailyPriorities.filter((priority) => priority.date.startsWith(`${year}-`)),
    [storeDailyPriorities, year],
  );
  const throughDate =
    year === liveYear
      ? today
      : yearDailyPriorities.reduce((latest, item) => (item.date > latest ? item.date : latest), `${year}-12-31`);
  const daySlots = useMemo(() => listDaysForYearThroughDate(year, throughDate), [year, throughDate]);
  const selectedDayIsCurrent = selectedDay === today;
  const secondaryTasksForYear = useMemo(
    () => storeSecondaryTasks.filter((task) => task.date.startsWith(`${year}-`)),
    [storeSecondaryTasks, year],
  );
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

    const secondaryTasks = storeSecondaryTasks
      .filter((item) => item.date === selectedDay)
      .map((item) => ({
        id: item.id,
        title: item.title,
        weeklyGoalId: item.weeklyGoalId,
        completed: item.completed,
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

    return JSON.stringify({ priorities, secondaryTasks, habits });
  }, [selectedDay, storeDailyPriorities, storeHabits, storeSecondaryTasks]);
  const weeklyGoalById = useMemo(
    () => new Map(weeklyGoals.map((goal) => [goal.id, goal])),
    [weeklyGoals],
  );
  const monthlyGoalById = useMemo(
    () => new Map(monthlyGoals.map((goal) => [goal.id, goal])),
    [monthlyGoals],
  );
  const yearlyGoalById = useMemo(
    () => new Map(yearlyGoals.map((goal) => [goal.id, goal])),
    [yearlyGoals],
  );

  const immediateSelectedDayDetail = useMemo(() => {
    if (!selectedDay) return null;

    const mainPrioritiesSource = selectedDayIsCurrent
      ? storeDailyPriorities.filter((item) => item.date === selectedDay && item.isMain)
      : yearDailyPriorities.filter((item) => item.date === selectedDay && item.isMain);
    const secondaryTasksSource = selectedDayIsCurrent
      ? storeSecondaryTasks.filter((item) => item.date === selectedDay)
      : [];
    const habitsSource = selectedDayIsCurrent ? storeHabits.filter((habit) => habit.active) : [];

    if (!mainPrioritiesSource.length && !secondaryTasksSource.length && !habitsSource.length) {
      return null;
    }

    return {
      session_id: sessionId ?? "",
      today: selectedDay,
      week_number: 0,
      month: Number(selectedDay.slice(5, 7)) || 0,
      year: Number(selectedDay.slice(0, 4)) || year,
      week_start: selectedDay,
      week_end: selectedDay,
      days_left_in_week: 0,
      days_left_in_month: 0,
      daily_priorities: mainPrioritiesSource.map(mapStorePriorityToApiShape),
      secondary_tasks: secondaryTasksSource.map(mapStorePriorityToApiShape),
      weekly_goals: [],
      monthly_context: [],
      habits: habitsSource.map(mapStoreHabitToApiShape),
      metrics: {
        execution_streak: 0,
        best_execution_streak: 0,
        yesterday_completion: 0,
        weekly_consistency: [],
        tasks_completed_today: 0,
        tasks_total_today: 0,
        habits_completed_today: 0,
        habits_total_today: 0,
        weekly_completion_rate: 0,
        monthly_completion_rate: 0,
      },
    } satisfies ApiDashboard;
  }, [selectedDay, selectedDayIsCurrent, sessionId, storeDailyPriorities, storeHabits, storeSecondaryTasks, year, yearDailyPriorities]);

  const resolvedSelectedDayDetail = selectedDayIsCurrent
    ? immediateSelectedDayDetail ?? selectedDayDetail
    : selectedDayDetail ?? immediateSelectedDayDetail;

  const refreshSelectedDayDetail = useCallback(async (options?: { background?: boolean }) => {
    if (!selectedDay || !sessionId || !backendReady) return;
    const hasVisibleDetail = Boolean(selectedDayDetailsByDate[selectedDay] ?? immediateSelectedDayDetail);
    if (!options?.background || !hasVisibleDetail) {
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
      if (!options?.background || !hasVisibleDetail) {
        setSelectedDayLoading(false);
      }
    }
  }, [backendReady, immediateSelectedDayDetail, selectedDay, selectedDayDetailsByDate, sessionId]);

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
    if (immediateSelectedDayDetail) {
      setSelectedDayError(null);
      setSelectedDayLoading(false);
      void refreshSelectedDayDetail({ background: true });
      return;
    }
    void refreshSelectedDayDetail();
  }, [immediateSelectedDayDetail, refreshSelectedDayDetail, selectedDay, selectedDayDetailsByDate]);

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
        detail="We are pulling daily goals across the year so the table reflects the real day-by-day progression of execution."
      />
    );
  }

  const prioritiesForRows = (year === liveYear ? activeYearDailyPriorities : yearDailyPriorities).filter(
    (priority) => priority.isMain,
  );

  const rows = daySlots.map((date) => {
    const priorities = prioritiesForRows.filter((priority) => priority.date === date);
    const secondaryTasks = secondaryTasksForYear.filter((task) => task.date === date);
    const activeHabits = date === today ? storeHabits.filter((habit) => habit.active) : [];
    const taskItems = [...priorities, ...secondaryTasks];
    const taskStateCounts = countGoalStates(taskItems, today);
    const completedHabits = activeHabits.filter((habit) => habit.completedToday).length;
    const openHabits = activeHabits.length - completedHabits;
    const completedCount = taskItems.filter((item) => isGoalComplete(item)).length + completedHabits;
    const totalCount = taskItems.length + activeHabits.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return {
      date,
      plannedItemsCount: totalCount,
      completed: taskStateCounts.completed + completedHabits,
      inProgress: taskStateCounts["on-track"],
      atRisk: taskStateCounts["at-risk"],
      notStarted: taskStateCounts["not-started"] + openHabits,
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
    if (!selectedDayIsCurrent) return;
    if (task.is_main) {
      toggleDailyPriority(task.id);
      return;
    }
    toggleSecondaryTask(task.id);
  }

  async function toggleHabit(habitId: string) {
    if (!selectedDayIsCurrent || !selectedDay) return;
    setActiveDashboardDate(selectedDay);
    toggleHabitInStore(habitId);
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
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  void openCurrentDayModal("add-daily-priority");
                }}
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-[0_12px_28px_rgba(0,108,74,0.16)] sm:w-auto"
                style={{ background: "#006c4a", color: "#fff" }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add main goal
              </button>
              <button
                type="button"
                onClick={() => {
                  void openCurrentDayModal("add-secondary-task");
                }}
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold sm:w-auto"
                style={{ background: "#fff", color: "#006c4a", border: "1px solid rgba(0,108,74,0.18)" }}
              >
                <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                Add secondary goal
              </button>
              <button
                type="button"
                onClick={() => {
                  void openCurrentDayModal("manage-habits");
                }}
                className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold sm:w-auto"
                style={{ background: "#fff", color: "#006c4a", border: "1px solid rgba(0,108,74,0.18)" }}
              >
                <span className="material-symbols-outlined text-[16px]">settings</span>
                Manage routines
              </button>
            </div>
          ) : (
            <span
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold sm:w-auto"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7c75" }}
            >
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Read only
            </span>
          )}
        </div>

        {selectedDayLoading && !resolvedSelectedDayDetail ? (
          <div className="mt-5 rounded-2xl p-5 text-sm" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", color: "#6b7c75" }}>
            Loading this day&apos;s plan…
          </div>
        ) : selectedDayError ? (
          <div className="mt-5 rounded-2xl p-5 text-sm" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.12)", color: "#8a5b12" }}>
            {selectedDayError}
          </div>
        ) : resolvedSelectedDayDetail ? (
          <div className="mt-5 space-y-6">
            {selectedDayLoading ? (
              <div
                className="rounded-2xl px-4 py-3 text-sm"
                style={{ background: "rgba(0,108,74,0.06)", border: "1px solid rgba(0,108,74,0.10)", color: "#2f6d58" }}
              >
                Refreshing this day&apos;s plan in the background…
              </div>
            ) : null}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Main goals
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {resolvedSelectedDayDetail.daily_priorities.length} main goal{resolvedSelectedDayDetail.daily_priorities.length === 1 ? "" : "s"}
                </p>
              </div>
              {resolvedSelectedDayDetail.daily_priorities.length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No main goals were saved for this day.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {resolvedSelectedDayDetail.daily_priorities.map((priority) => {
                    const storePriority = mapApiPriorityToStoreShape(priority);
                    const statusState = classifyGoalState(storePriority, today);
                    const statusMeta = getGoalStateMeta(statusState);
                    const linkedWeeklyGoal = priority.weekly_goal_id ? weeklyGoalById.get(priority.weekly_goal_id) : null;
                    const linkedMonthlyGoal =
                      linkedWeeklyGoal?.monthlyGoalId ? monthlyGoalById.get(linkedWeeklyGoal.monthlyGoalId) : null;
                    const linkedYearlyGoal =
                      linkedMonthlyGoal?.yearlyGoalId ? yearlyGoalById.get(linkedMonthlyGoal.yearlyGoalId) : null;
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                              style={{
                                background: priority.completed ? "rgba(0,108,74,0.10)" : "rgba(0,0,0,0.05)",
                                color: priority.completed ? "#006c4a" : "#6b7c75",
                              }}
                            >
                              {priority.completed ? "Done" : "Open"}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                              style={{
                                background: statusMeta.background,
                                border: `1px solid ${statusMeta.border}`,
                                color: statusMeta.text,
                              }}
                            >
                              {getGoalDisplayStatusLabel(storePriority)}
                            </span>
                          </div>
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
                          <div className="space-y-1">
                            <p className="text-xs" style={{ color: linkedWeeklyGoal ? "#1f6f5a" : "#8a9e97" }}>
                              {linkedWeeklyGoal ? `Linked weekly goal: ${linkedWeeklyGoal.title}` : "Unlinked: no weekly goal connected yet."}
                            </p>
                            {linkedMonthlyGoal ? (
                              <p className="text-xs" style={{ color: "#6b7c75" }}>
                                Monthly parent: {linkedMonthlyGoal.title}
                              </p>
                            ) : null}
                            {linkedYearlyGoal ? (
                              <p className="text-xs" style={{ color: "#6b7c75" }}>
                                Yearly parent: {linkedYearlyGoal.title}
                              </p>
                            ) : null}
                            {priority.truth_reason ? (
                              <p className="text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
                                {priority.truth_reason}
                              </p>
                            ) : null}
                          </div>

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
                  Secondary goals
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {resolvedSelectedDayDetail.secondary_tasks.length} secondary goal{resolvedSelectedDayDetail.secondary_tasks.length === 1 ? "" : "s"}
                </p>
              </div>
              {resolvedSelectedDayDetail.secondary_tasks.length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No secondary goals were saved for this day.
                </p>
              ) : (
                <div className="space-y-2">
                  {resolvedSelectedDayDetail.secondary_tasks.map((task) => {
                    const storeTask = mapApiPriorityToStoreShape(task);
                    const statusState = classifyGoalState(storeTask, today);
                    const statusMeta = getGoalStateMeta(statusState);
                    const linkedWeeklyGoal = task.weekly_goal_id ? weeklyGoalById.get(task.weekly_goal_id) : null;
                    return (
                      <div
                        key={task.id}
                        className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="text-sm font-semibold"
                              style={{
                                color: task.completed ? "#8a9e97" : "#1a1f1e",
                                textDecoration: task.completed ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </p>
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                              style={{
                                background: statusMeta.background,
                                border: `1px solid ${statusMeta.border}`,
                                color: statusMeta.text,
                              }}
                            >
                              {getGoalDisplayStatusLabel(storeTask)}
                            </span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: linkedWeeklyGoal ? "#1f6f5a" : "#8a9e97" }}>
                            {linkedWeeklyGoal ? `Linked weekly goal: ${linkedWeeklyGoal.title}` : "Unlinked: no weekly goal connected yet."}
                          </p>
                          {task.truth_reason ? (
                            <p className="text-xs mt-2 leading-relaxed" style={{ color: "#6b7c75" }}>
                              {task.truth_reason}
                            </p>
                          ) : null}
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
                  Routine status
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {resolvedSelectedDayDetail.habits.filter((habit) => habit.active).length} active routine{resolvedSelectedDayDetail.habits.filter((habit) => habit.active).length === 1 ? "" : "s"}
                </p>
              </div>
              {resolvedSelectedDayDetail.habits.filter((habit) => habit.active).length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No active routines were available for this day.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {resolvedSelectedDayDetail.habits.filter((habit) => habit.active).map((habit) => (
                    (() => {
                      const linkedWeeklyGoal = habit.weekly_goal_id ? weeklyGoalById.get(habit.weekly_goal_id) : null;
                      const linkedMonthlyGoal = habit.monthly_goal_id ? monthlyGoalById.get(habit.monthly_goal_id) : null;
                      const linkedYearlyGoal = habit.yearly_goal_id ? yearlyGoalById.get(habit.yearly_goal_id) : null;
                      return (
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
                              <p className="text-xs mt-2" style={{ color: linkedWeeklyGoal || linkedMonthlyGoal || linkedYearlyGoal ? "#1f6f5a" : "#8a9e97" }}>
                                {linkedWeeklyGoal
                                  ? `Linked weekly goal: ${linkedWeeklyGoal.title}`
                                  : linkedMonthlyGoal
                                    ? `Linked monthly goal: ${linkedMonthlyGoal.title}`
                                    : linkedYearlyGoal
                                      ? `Linked yearly goal: ${linkedYearlyGoal.title}`
                                      : "Unlinked: no goal connected yet."}
                              </p>
                            </div>
                            {selectedDayIsCurrent ? (
                              <button
                                type="button"
                                onClick={() => void toggleHabit(habit.id)}
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
                      );
                    })()
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl p-5 text-sm" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", color: "#6b7c75" }}>
            Choose a day from the table to inspect the exact main goals, secondary goals, and routines for that date.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 md:p-8">
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
            className="hidden items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium md:inline-flex"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
          >
            <span>Status guide</span>
            <GoalsInfoTooltip label="Daily goal statuses" detail={STATUS_GUIDE_DETAIL} />
          </div>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {paginatedRows.map((row) => {
            const progressTone = getProgressTone(row.progress);
            const current = row.date === today && year === liveYear;
            const selected = selectedDay === row.date;
            return (
              <Fragment key={row.date}>
                <button
                  type="button"
                  onClick={() => pushDay(row.date)}
                  className="w-full rounded-[22px] p-4 text-left"
                  style={{
                    background: current ? "rgba(0,108,74,0.03)" : "#fff",
                    border: current ? "1.5px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold" style={{ color: current ? "#006c4a" : "#1a1f1e" }}>
                        {formatGoalDay(row.date)}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "#8a9e97" }}>
                        {row.plannedItemsCount} planned item{row.plannedItemsCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                      style={{ background: "rgba(0,108,74,0.08)", color: progressTone }}
                    >
                      {row.progress}%
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        Completed
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("completed").text }}>
                        {row.completed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        In Progress
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("on-track").text }}>
                        {row.inProgress}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        At Risk
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("at-risk").text }}>
                        {row.atRisk}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        Not Started
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("not-started").text }}>
                        {row.notStarted}
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs font-semibold"
                    style={{ borderColor: "rgba(0,0,0,0.06)", color: current ? "#006c4a" : "#6b7c75" }}
                  >
                    <span>{current ? "Open today to edit goals and routines" : "Tap to review this day"}</span>
                    <span className="material-symbols-outlined text-[16px]">{selected ? "expand_less" : "chevron_right"}</span>
                  </div>
                </button>
                {selected ? renderSelectedDayDetail() : null}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-[22px] md:block" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          <table className="min-w-full">
            <thead>
              <tr className="text-left" style={{ background: "#fbfcfb" }}>
                {["Day", "Planned Items", "Completed", "In Progress", "At Risk", "Not Started", "Progress"].map((label) => (
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
                        {row.plannedItemsCount}
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

        <div className="mt-5 hidden items-center justify-between gap-4 flex-wrap text-sm md:flex" style={{ color: "#6b7c75" }}>
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
