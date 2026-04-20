"use client";

import { useEffect, useMemo, useState } from "react";
import {
  goalsApi,
  habitsApi,
  type ApiCategory,
  type ApiDailyPriority,
  type ApiGoalsHierarchy,
  type ApiHabit,
  type ApiMonthlyGoal,
  type ApiWeeklyGoal,
  type ApiYearlyGoal,
} from "@/lib/api";
import { formatApiError } from "@/lib/apiErrors";
import { useAppStore } from "@/lib/store";
import type {
  Category,
  DailyPriority,
  FoundationalHabit,
  MonthlyGoal,
  WeeklyGoal,
  YearlyGoal,
} from "@/lib/types";

type GoalsSlice = Pick<
  ReturnType<typeof useAppStore.getState>,
  | "sessionId"
  | "backendReady"
  | "workspaceHydrating"
  | "categories"
  | "yearlyGoals"
  | "monthlyGoals"
  | "weeklyGoals"
  | "dailyPriorities"
  | "habits"
>;

export interface UseGoalsHierarchyResult {
  ready: boolean;
  loading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  year: number;
  today: string;
  currentMonth: number;
  currentWeekNumber: number;
  selectedWeekNumber: number | null;
  selectedWeekStart: string | null;
  selectedWeekEnd: string | null;
  categories: Category[];
  yearlyGoals: YearlyGoal[];
  monthlyGoals: MonthlyGoal[];
  weeklyGoals: WeeklyGoal[];
  selectedWeekDailyPriorities: DailyPriority[];
  habits: FoundationalHabit[];
  refresh: () => Promise<void>;
}

function mapApiCategory(category: ApiCategory): Category {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
  };
}

function mapApiYearlyGoal(goal: ApiYearlyGoal): YearlyGoal {
  return {
    id: goal.id,
    categoryId: goal.category_id,
    title: goal.title,
    description: goal.description,
    year: goal.year,
    status: goal.status as YearlyGoal["status"],
    progress: goal.progress,
    targetDate: goal.target_date,
    aiSuggested: goal.ai_suggested,
  };
}

function mapApiMonthlyGoal(goal: ApiMonthlyGoal): MonthlyGoal {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    yearlyGoalId: goal.yearly_goal_id,
    categoryId: goal.category_id,
    targetDate: goal.target_date,
    workload: goal.workload,
    month: goal.month,
    year: goal.year,
    status: goal.status as MonthlyGoal["status"],
    progress: goal.progress,
    priority: goal.priority as MonthlyGoal["priority"],
    isMain: goal.is_main,
    aiSuggested: goal.ai_suggested,
  };
}

function mapApiWeeklyGoal(goal: ApiWeeklyGoal): WeeklyGoal {
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    monthlyGoalId: goal.monthly_goal_id,
    weekNumber: goal.week_number,
    month: goal.month,
    year: goal.year,
    status: goal.status as WeeklyGoal["status"],
    progress: goal.progress,
    isMain: goal.is_main,
    targetDay: goal.target_day,
    goalType: goal.goal_type as WeeklyGoal["goalType"],
    workload: goal.workload,
    aiSuggested: goal.ai_suggested,
  };
}

function mapApiDailyPriority(priority: ApiDailyPriority): DailyPriority {
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
  };
}

function mapApiHabit(habit: ApiHabit): FoundationalHabit {
  return {
    id: habit.id,
    name: habit.name,
    icon: habit.icon,
    categoryId: habit.category_id,
    frequency: habit.frequency as FoundationalHabit["frequency"],
    completedToday: habit.completed_today,
    streak: habit.streak,
    active: habit.active,
  };
}

function hydrateGoalsStore(snapshot: ApiGoalsHierarchy, habits: ApiHabit[]) {
  const nextCategories = snapshot.categories.map(mapApiCategory);
  const nextYearlyGoals = snapshot.yearly_goals.map(mapApiYearlyGoal);
  const nextMonthlyGoals = snapshot.monthly_goals.map(mapApiMonthlyGoal);
  const nextWeeklyGoals = snapshot.weekly_goals.map(mapApiWeeklyGoal);
  const nextDailyPriorities = snapshot.selected_week_daily_priorities.map(mapApiDailyPriority);
  const nextHabits = habits.map(mapApiHabit);
  const selectedDates = new Set(nextDailyPriorities.map((priority) => priority.date));

  useAppStore.setState((state) => ({
    categories: nextCategories,
    yearlyGoals: [
      ...state.yearlyGoals.filter((goal) => goal.year !== snapshot.year),
      ...nextYearlyGoals,
    ],
    monthlyGoals: [
      ...state.monthlyGoals.filter((goal) => goal.year !== snapshot.year),
      ...nextMonthlyGoals,
    ],
    weeklyGoals: [
      ...state.weeklyGoals.filter((goal) => goal.year !== snapshot.year),
      ...nextWeeklyGoals,
    ],
    dailyPriorities: [
      ...state.dailyPriorities.filter((priority) => !selectedDates.has(priority.date)),
      ...nextDailyPriorities,
    ].sort((a, b) => {
      if (a.date === b.date) {
        if (a.isMain === b.isMain) return a.title.localeCompare(b.title);
        return a.isMain ? -1 : 1;
      }
      return a.date.localeCompare(b.date);
    }),
    habits: nextHabits,
    syncError: null,
  }));
}

async function fetchGoalsHierarchy(
  sessionId: string,
  year: number,
  weekNumber?: number,
): Promise<{ hierarchy: ApiGoalsHierarchy; habits: ApiHabit[] }> {
  const [hierarchy, habits] = await Promise.all([
    goalsApi.hierarchy(sessionId, { year, weekNumber }),
    habitsApi.list(sessionId).catch(() => []),
  ]);
  hydrateGoalsStore(hierarchy, habits);
  return { hierarchy, habits };
}

export function useGoalsHierarchy(
  year: number,
  opts?: { weekNumber?: number },
): UseGoalsHierarchyResult {
  const sessionId = useAppStore((state): GoalsSlice["sessionId"] => state.sessionId);
  const backendReady = useAppStore((state): GoalsSlice["backendReady"] => state.backendReady);
  const workspaceHydrating = useAppStore((state): GoalsSlice["workspaceHydrating"] => state.workspaceHydrating);
  const storeCategories = useAppStore((state): GoalsSlice["categories"] => state.categories);
  const storeYearlyGoals = useAppStore((state): GoalsSlice["yearlyGoals"] => state.yearlyGoals);
  const storeMonthlyGoals = useAppStore((state): GoalsSlice["monthlyGoals"] => state.monthlyGoals);
  const storeWeeklyGoals = useAppStore((state): GoalsSlice["weeklyGoals"] => state.weeklyGoals);
  const storeDailyPriorities = useAppStore((state): GoalsSlice["dailyPriorities"] => state.dailyPriorities);
  const storeHabits = useAppStore((state): GoalsSlice["habits"] => state.habits);

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [today, setToday] = useState<string>(new Date().toISOString().slice(0, 10));
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [currentWeekNumber, setCurrentWeekNumber] = useState<number | null>(null);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(opts?.weekNumber ?? null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<string | null>(null);

  async function refresh() {
    if (Number.isNaN(year)) {
      setReady(true);
      return;
    }

    if (!sessionId || !backendReady) {
      setReady(!workspaceHydrating);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { hierarchy } = await fetchGoalsHierarchy(sessionId, year, opts?.weekNumber);
      setLastSyncedAt(hierarchy.last_synced_at);
      setToday(hierarchy.today);
      setCurrentMonth(hierarchy.current_month);
      setCurrentWeekNumber(hierarchy.current_week_number);
      setSelectedWeekNumber(hierarchy.selected_week_number);
      setSelectedWeekStart(hierarchy.selected_week_start);
      setSelectedWeekEnd(hierarchy.selected_week_end);
    } catch (err) {
      setError(formatApiError("Load goals hierarchy", err));
    } finally {
      setLoading(false);
      setReady(true);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (cancelled) return;
      await refresh();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, backendReady, workspaceHydrating, year, opts?.weekNumber]);

  const currentWeekFallback = useMemo(() => {
    const now = new Date();
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }, []);

  const effectiveCurrentWeek = currentWeekNumber ?? currentWeekFallback;
  const effectiveSelectedWeek = selectedWeekNumber ?? opts?.weekNumber ?? null;

  return {
    ready,
    loading,
    error,
    lastSyncedAt,
    year,
    today,
    currentMonth,
    currentWeekNumber: effectiveCurrentWeek,
    selectedWeekNumber: effectiveSelectedWeek,
    selectedWeekStart,
    selectedWeekEnd,
    categories: storeCategories,
    yearlyGoals: storeYearlyGoals.filter((goal) => goal.year === year),
    monthlyGoals: storeMonthlyGoals.filter((goal) => goal.year === year),
    weeklyGoals: storeWeeklyGoals.filter((goal) => goal.year === year),
    selectedWeekDailyPriorities:
      selectedWeekStart && selectedWeekEnd
        ? storeDailyPriorities.filter(
            (priority) => priority.date >= selectedWeekStart && priority.date <= selectedWeekEnd,
          )
        : effectiveSelectedWeek === null
          ? []
          : storeDailyPriorities.filter((priority) => {
              if (!priority.weeklyGoalId) return false;
              const linkedGoal = storeWeeklyGoals.find((goal) => goal.id === priority.weeklyGoalId);
              return linkedGoal?.year === year && linkedGoal.weekNumber === effectiveSelectedWeek;
            }),
    habits: storeHabits,
    refresh,
  };
}
