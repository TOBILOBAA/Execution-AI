import type { DailyPriority, GoalStatus, MonthlyGoal, WeeklyGoal, WeekStartsOn, YearlyGoal } from "./types";

export const GOALS_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type GoalStateKey = "completed" | "on-track" | "at-risk" | "not-started";
export type YearlyReviewStateKey =
  | "completed"
  | "ready-for-review"
  | "in-progress"
  | "at-risk"
  | "not-started";

type GoalLike = {
  status?: GoalStatus;
  progress?: number;
  targetDate?: string;
  completed?: boolean;
};

type MonthExecutionSummary = {
  monthGoal: MonthlyGoal;
  weeklyGoals: WeeklyGoal[];
  dailyPriorities: DailyPriority[];
  executionProgress: number;
  monthClosed: boolean;
  readyForReview: boolean;
  recoverySignal: boolean;
};

export type YearlyGoalReviewSummary = {
  state: YearlyReviewStateKey;
  progress: number;
  readyMonths: number;
  unresolvedMissedMonths: number;
  recoveredMissedMonths: number;
  linkedMonthlyGoals: number;
  canMarkComplete: boolean;
  note: string | null;
};

export function getMonthName(month: number): string {
  return GOALS_MONTH_NAMES[month - 1] ?? `Month ${month}`;
}

export function getMonthShortName(month: number): string {
  return getMonthName(month).slice(0, 3);
}

export function formatGoalDate(iso?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "No due date";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", options ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatGoalDay(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function getQuarterFromMonth(month: number): number {
  return Math.min(4, Math.max(1, Math.ceil(month / 3)));
}

function isOverdue(targetDate?: string, todayIso = new Date().toISOString().slice(0, 10)): boolean {
  if (!targetDate) return false;
  const due = new Date(`${targetDate}T12:00:00`);
  const today = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(today.getTime())) return false;
  return due.getTime() < today.getTime();
}

export function classifyGoalState(goal: GoalLike, todayIso = new Date().toISOString().slice(0, 10)): GoalStateKey {
  if (goal.completed || goal.status === "completed" || (goal.progress ?? 0) >= 100) {
    return "completed";
  }
  if (goal.status === "missed" || isOverdue(goal.targetDate, todayIso)) {
    return "at-risk";
  }
  if ((goal.progress ?? 0) <= 0 || goal.status === "pending" || goal.status === "locked") {
    return "not-started";
  }
  return "on-track";
}

function isGoalComplete(goal: GoalLike): boolean {
  return goal.completed || goal.status === "completed" || (goal.progress ?? 0) >= 100;
}

function goalProgress(goal: GoalLike): number {
  return isGoalComplete(goal) ? 100 : Math.max(0, Math.min(100, goal.progress ?? 0));
}

function getYearMonthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function isMonthClosed(monthGoal: MonthlyGoal, todayIso: string): boolean {
  const todayYear = Number(todayIso.slice(0, 4));
  const todayMonth = Number(todayIso.slice(5, 7));
  if (!todayYear || !todayMonth) return false;
  return getYearMonthIndex(monthGoal.year, monthGoal.month) < getYearMonthIndex(todayYear, todayMonth);
}

function compareMonthlyGoals(a: MonthlyGoal, b: MonthlyGoal): number {
  return getYearMonthIndex(a.year, a.month) - getYearMonthIndex(b.year, b.month);
}

function hasCompletedDailyPriority(priority: DailyPriority): boolean {
  return priority.completed || priority.status === "completed";
}

function computeMonthlyExecutionProgress(
  monthGoal: MonthlyGoal,
  weeklyGoals: WeeklyGoal[],
  dailyPriorities: DailyPriority[],
): number {
  const monthlySignal = goalProgress(monthGoal);
  const weeklySignal = weeklyGoals.length
    ? Math.round(weeklyGoals.reduce((sum, goal) => sum + goalProgress(goal), 0) / weeklyGoals.length)
    : monthlySignal;
  const dailySignal = dailyPriorities.length
    ? Math.round(
        (dailyPriorities.filter((priority) => hasCompletedDailyPriority(priority)).length / dailyPriorities.length) * 100,
      )
    : weeklySignal;
  return Math.round(monthlySignal * 0.55 + weeklySignal * 0.25 + dailySignal * 0.2);
}

function isMonthReadyForReview(summary: MonthExecutionSummary): boolean {
  const monthlyDone = isGoalComplete(summary.monthGoal);
  const weeklyDone = summary.weeklyGoals.length > 0 && summary.weeklyGoals.every((goal) => isGoalComplete(goal));
  const dailyDone =
    summary.dailyPriorities.length > 0 &&
    summary.dailyPriorities.every((priority) => hasCompletedDailyPriority(priority));

  if (summary.dailyPriorities.length > 0) {
    return (monthlyDone || weeklyDone) && dailyDone;
  }
  if (summary.weeklyGoals.length > 0) {
    return monthlyDone || weeklyDone;
  }
  return monthlyDone;
}

function hasMonthRecoverySignal(summary: MonthExecutionSummary): boolean {
  return (
    summary.readyForReview ||
    summary.executionProgress > 0 ||
    summary.monthGoal.status === "active" ||
    summary.weeklyGoals.length > 0 ||
    summary.dailyPriorities.length > 0
  );
}

export function deriveYearlyGoalReviewSummary(
  yearlyGoal: YearlyGoal,
  monthlyGoals: MonthlyGoal[],
  weeklyGoalsByMonthly: Map<string, WeeklyGoal[]>,
  dailyPrioritiesByWeekly: Map<string, DailyPriority[]>,
  todayIso = new Date().toISOString().slice(0, 10),
): YearlyGoalReviewSummary {
  if (yearlyGoal.status === "completed") {
    return {
      state: "completed",
      progress: 100,
      readyMonths: 0,
      unresolvedMissedMonths: 0,
      recoveredMissedMonths: 0,
      linkedMonthlyGoals: monthlyGoals.length,
      canMarkComplete: true,
      note: "Outcome confirmed.",
    };
  }

  const sortedMonthlyGoals = [...monthlyGoals].sort(compareMonthlyGoals);
  if (sortedMonthlyGoals.length === 0) {
    return {
      state: "not-started",
      progress: 0,
      readyMonths: 0,
      unresolvedMissedMonths: 0,
      recoveredMissedMonths: 0,
      linkedMonthlyGoals: 0,
      canMarkComplete: false,
      note: "Link a monthly goal to start this yearly outcome.",
    };
  }

  const monthSummaries: MonthExecutionSummary[] = sortedMonthlyGoals.map((monthGoal) => {
    const weeklyGoals = weeklyGoalsByMonthly.get(monthGoal.id) ?? [];
    const dailyPriorities = weeklyGoals.flatMap((goal) => dailyPrioritiesByWeekly.get(goal.id) ?? []);
    const executionProgress = computeMonthlyExecutionProgress(monthGoal, weeklyGoals, dailyPriorities);
    const monthClosed = isMonthClosed(monthGoal, todayIso);
    const baseSummary: MonthExecutionSummary = {
      monthGoal,
      weeklyGoals,
      dailyPriorities,
      executionProgress,
      monthClosed,
      readyForReview: false,
      recoverySignal: false,
    };
    const readyForReview = isMonthReadyForReview(baseSummary);
    return {
      ...baseSummary,
      readyForReview,
      recoverySignal: hasMonthRecoverySignal({ ...baseSummary, readyForReview, recoverySignal: false }),
    };
  });

  const unresolvedMissedMonths: MonthExecutionSummary[] = [];
  let recoveredMissedMonths = 0;

  monthSummaries.forEach((summary, index) => {
    if (!summary.monthClosed || summary.readyForReview) return;
    const recoveredLater = monthSummaries
      .slice(index + 1)
      .some((futureMonth) => compareMonthlyGoals(futureMonth.monthGoal, summary.monthGoal) > 0 && futureMonth.recoverySignal);
    if (recoveredLater) {
      recoveredMissedMonths += 1;
      return;
    }
    unresolvedMissedMonths.push(summary);
  });

  const readyMonths = monthSummaries.filter((summary) => summary.readyForReview).length;
  const derivedProgress = averageProgress(
    monthSummaries.map((summary) => ({
      progress: summary.executionProgress,
    })),
  );
  const progress = Math.max(yearlyGoal.progress ?? 0, derivedProgress);

  if (unresolvedMissedMonths.length > 0) {
    const missedCount = unresolvedMissedMonths.length;
    return {
      state: "at-risk",
      progress,
      readyMonths,
      unresolvedMissedMonths: missedCount,
      recoveredMissedMonths,
      linkedMonthlyGoals: sortedMonthlyGoals.length,
      canMarkComplete: false,
      note: `${missedCount} missed month${missedCount === 1 ? "" : "s"} still need a recovery plan.`,
    };
  }

  if (readyMonths > 0) {
    const note =
      recoveredMissedMonths > 0
        ? `${recoveredMissedMonths} missed month${recoveredMissedMonths === 1 ? "" : "s"} recovered.`
        : `${readyMonths} month${readyMonths === 1 ? "" : "s"} finished and ready to review.`;
    return {
      state: "ready-for-review",
      progress,
      readyMonths,
      unresolvedMissedMonths: 0,
      recoveredMissedMonths,
      linkedMonthlyGoals: sortedMonthlyGoals.length,
      canMarkComplete: true,
      note,
    };
  }

  return {
    state: "in-progress",
    progress,
    readyMonths: 0,
    unresolvedMissedMonths: 0,
    recoveredMissedMonths,
    linkedMonthlyGoals: sortedMonthlyGoals.length,
    canMarkComplete: false,
    note:
      recoveredMissedMonths > 0
        ? `${recoveredMissedMonths} missed month${recoveredMissedMonths === 1 ? "" : "s"} recovered.`
        : "Aligned work is in motion.",
  };
}

export function getGoalStateMeta(state: GoalStateKey) {
  switch (state) {
    case "completed":
      return {
        label: "Completed",
        text: "#0b7a53",
        background: "rgba(11,122,83,0.1)",
        border: "rgba(11,122,83,0.18)",
      };
    case "at-risk":
      return {
        label: "At Risk",
        text: "#b45309",
        background: "rgba(217,119,6,0.12)",
        border: "rgba(217,119,6,0.18)",
      };
    case "not-started":
      return {
        label: "Not Started",
        text: "#667781",
        background: "rgba(148,163,184,0.14)",
        border: "rgba(148,163,184,0.18)",
      };
    default:
      return {
        label: "On Track",
        text: "#006c4a",
        background: "rgba(0,108,74,0.1)",
        border: "rgba(0,108,74,0.16)",
      };
  }
}

export function getYearlyGoalStateMeta(state: YearlyReviewStateKey) {
  switch (state) {
    case "completed":
      return {
        label: "Completed",
        text: "#0b7a53",
        background: "rgba(11,122,83,0.1)",
        border: "rgba(11,122,83,0.18)",
      };
    case "ready-for-review":
      return {
        label: "Ready for Review",
        text: "#1d4ed8",
        background: "rgba(37,99,235,0.09)",
        border: "rgba(37,99,235,0.16)",
      };
    case "at-risk":
      return {
        label: "At Risk",
        text: "#b45309",
        background: "rgba(217,119,6,0.12)",
        border: "rgba(217,119,6,0.18)",
      };
    case "not-started":
      return {
        label: "Not Started",
        text: "#667781",
        background: "rgba(148,163,184,0.14)",
        border: "rgba(148,163,184,0.18)",
      };
    default:
      return {
        label: "In Progress",
        text: "#006c4a",
        background: "rgba(0,108,74,0.1)",
        border: "rgba(0,108,74,0.16)",
      };
  }
}

export function getProgressTone(progress: number): string {
  if (progress >= 75) return "#006c4a";
  if (progress >= 40) return "#d97706";
  return "#94a3b8";
}

export function averageProgress<T extends { progress: number }>(items: T[]): number {
  if (items.length === 0) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length);
}

export function countGoalStates<T extends GoalLike>(
  items: T[],
  todayIso = new Date().toISOString().slice(0, 10),
) {
  return items.reduce(
    (acc, item) => {
      const state = classifyGoalState(item, todayIso);
      acc[state] += 1;
      return acc;
    },
    {
      completed: 0,
      "on-track": 0,
      "at-risk": 0,
      "not-started": 0,
    } as Record<GoalStateKey, number>,
  );
}

function startOfWeek(date: Date, weekStartsOn: WeekStartsOn = "monday"): Date {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = copy.getUTCDay();
  const offset = weekStartsOn === "sunday" ? weekday : (weekday + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - offset);
  return copy;
}

function endOfWeek(date: Date, weekStartsOn: WeekStartsOn = "monday"): Date {
  const start = startOfWeek(date, weekStartsOn);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end;
}

export function getWeekNumber(date: Date, weekStartsOn: WeekStartsOn = "monday"): number {
  const normalized = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekOneStart = startOfWeek(new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1)), weekStartsOn);
  const currentWeekStart = startOfWeek(normalized, weekStartsOn);
  return Math.floor((currentWeekStart.getTime() - weekOneStart.getTime()) / 604800000) + 1;
}

export function formatWeekWindow(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${startLabel} - ${endLabel}`;
}

export function listWeeksForMonth(year: number, month: number): Array<{
  weekNumber: number;
  start: string;
  end: string;
}>;
export function listWeeksForMonth(
  year: number,
  month: number,
  weekStartsOn?: WeekStartsOn,
): Array<{
  weekNumber: number;
  start: string;
  end: string;
}> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const seen = new Set<number>();
  const rows: Array<{ weekNumber: number; start: string; end: string }> = [];

  for (let day = new Date(first); day <= last; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekNumber = getWeekNumber(day, weekStartsOn);
    if (seen.has(weekNumber)) continue;
    seen.add(weekNumber);
    const start = startOfWeek(day, weekStartsOn);
    const end = endOfWeek(day, weekStartsOn);
    rows.push({
      weekNumber,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }

  return rows.sort((a, b) => a.weekNumber - b.weekNumber);
}

export function listWeeksForYearThroughWeek(
  year: number,
  throughWeek: number,
  weekStartsOn: WeekStartsOn = "monday",
): Array<{ weekNumber: number; start: string; end: string; month: number }> {
  const safeWeek = Math.max(1, throughWeek);
  const weekOneStart = startOfWeek(new Date(Date.UTC(year, 0, 1)), weekStartsOn);

  return Array.from({ length: safeWeek }, (_, index) => {
    const weekNumber = index + 1;
    const start = new Date(weekOneStart);
    start.setUTCDate(weekOneStart.getUTCDate() + index * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      weekNumber,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      month: start.getUTCMonth() + 1,
    };
  });
}

export function listDaysBetween(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return [] as string[];
  const start = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [] as string[];

  const rows: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    rows.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

export function listDaysForYearThroughDate(year: number, throughIso: string) {
  const start = new Date(`${year}-01-01T12:00:00`);
  const end = new Date(`${throughIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [] as string[];

  const rows: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    rows.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

export function groupMonthlyGoalsByYearly(goals: MonthlyGoal[]) {
  const map = new Map<string, MonthlyGoal[]>();
  for (const goal of goals) {
    if (!goal.yearlyGoalId) continue;
    const list = map.get(goal.yearlyGoalId) ?? [];
    list.push(goal);
    map.set(goal.yearlyGoalId, list);
  }
  return map;
}

export function groupWeeklyGoalsByMonthly(goals: WeeklyGoal[]) {
  const map = new Map<string, WeeklyGoal[]>();
  for (const goal of goals) {
    if (!goal.monthlyGoalId) continue;
    const list = map.get(goal.monthlyGoalId) ?? [];
    list.push(goal);
    map.set(goal.monthlyGoalId, list);
  }
  return map;
}

export function groupDailyByWeekly(priorities: DailyPriority[]) {
  const map = new Map<string, DailyPriority[]>();
  for (const priority of priorities) {
    if (!priority.weeklyGoalId) continue;
    const list = map.get(priority.weeklyGoalId) ?? [];
    list.push(priority);
    map.set(priority.weeklyGoalId, list);
  }
  return map;
}

export function countCompletedDaily(priorities: DailyPriority[]) {
  return priorities.filter((priority) => priority.completed || priority.status === "completed").length;
}

export function countInProgressDaily(priorities: DailyPriority[]) {
  return priorities.filter((priority) => !priority.completed && classifyGoalState(priority) === "on-track").length;
}

export function countNotStartedDaily(priorities: DailyPriority[]) {
  return priorities.filter((priority) => !priority.completed && classifyGoalState(priority) === "not-started").length;
}

export function countAtRiskDaily(priorities: DailyPriority[]) {
  return priorities.filter((priority) => !priority.completed && classifyGoalState(priority) === "at-risk").length;
}

export function asPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function sortGoalsByMain<T extends { isMain?: boolean; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.isMain) === Boolean(b.isMain)) return a.title.localeCompare(b.title);
    return a.isMain ? -1 : 1;
  });
}

export type GoalCollection = YearlyGoal[] | MonthlyGoal[] | WeeklyGoal[];
