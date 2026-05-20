// ─── Core domain types for Execution AI ───────────────────────────────────────

export type GoalStatus =
  | "active"
  | "completed"
  | "missed"
  | "locked"
  | "pending";

export type PriorityLevel = "high" | "medium" | "low";

export type TimeHorizon = "yearly" | "monthly" | "weekly" | "daily";

export type HabitFrequency = "daily" | "weekdays" | "3x_week" | "5x_week" | "weekends" | "flexible";
export type WeekStartsOn = "sunday" | "monday";
export type RecapType = "weekly" | "monthly" | "quarterly" | "yearly";

// ─── Category / Bucket ────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string; // Material Symbol name
  color?: string;
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export interface YearlyGoal {
  id: string;
  categoryId?: string;
  title: string;
  description?: string;
  year: number;
  status: GoalStatus;
  progress: number; // 0–100
  targetDate?: string; // ISO date string
  aiSuggested?: boolean;
  editable?: boolean;
}

export interface MonthlyGoal {
  id: string;
  title: string;
  description?: string;
  yearlyGoalId?: string;
  categoryId?: string;
  targetDate?: string;
  workload?: string; // e.g. "~6 hours workload"
  month: number; // 1–12
  year: number;
  status: GoalStatus;
  progress: number;
  priority: PriorityLevel;
  isMain: boolean;
  aiSuggested?: boolean;
  editable?: boolean;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  description?: string;
  monthlyGoalId?: string;
  weekNumber: number;
  month: number;
  year: number;
  status: GoalStatus;
  progress: number;
  isMain: boolean;
  targetDay?: string; // "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
  goalType?: "tactical" | "operational"; // for secondary goals
  workload?: string;
  aiSuggested?: boolean;
  editable?: boolean;
}

export interface DailyPriority {
  id: string;
  title: string;
  description?: string;
  weeklyGoalId?: string;
  date: string; // ISO date string
  status: GoalStatus;
  completed: boolean;
  priority: PriorityLevel;
  estimatedMinutes?: number;
  isMain: boolean;
  tag?: string;
  aiSuggested?: boolean;
  editable?: boolean;
}

// ─── Habits ───────────────────────────────────────────────────────────────────

export interface FoundationalHabit {
  id: string;
  name: string;
  icon: string; // Material Symbol name
  categoryId?: string;
  yearlyGoalId?: string;
  monthlyGoalId?: string;
  weeklyGoalId?: string;
  frequency: HabitFrequency;
  completedToday: boolean;
  streak: number;
  active: boolean;
}

export interface DashboardRecapEntry {
  type: RecapType;
  periodYear: number;
  periodWeek?: number;
  periodMonth?: number;
  periodQuarter?: number;
  firedAt: string;
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export interface DashboardMetrics {
  executionStreak: number;
  yesterdayCompletion: number;
  weeklyConsistency: number[]; // 7 values in the workspace's week order (0–100)
  weeklyObjective: string;
  monthlyContext: string;
  weeklyCompletionRate?: number;
  monthlyCompletionRate?: number;
  /** From dashboard API (optional for older persisted state). */
  tasksCompletedToday?: number;
  tasksTotalToday?: number;
  habitsCompletedToday?: number;
  habitsTotalToday?: number;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface WeekReport {
  weekNumber: number;
  year: number;
  month: number;
  completionRate: number;
  mainGoalsCompleted: number;
  mainGoalsTotal: number;
  topWin?: string;
  status: "completed" | "active" | "locked";
  dateRange: string;
}

export interface MonthReport {
  month: number;
  year: number;
  completionRate: number;
  topPillar?: string;
  tasksCompleted: number;
  status: "completed" | "active" | "locked";
  weeks: WeekReport[];
}

export interface YearReport {
  year: number;
  completionRate: number;
  topPillar?: string;
  tasksCompleted: number;
  streak: number;
  percentChange?: number;
  months: MonthReport[];
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export type OnboardingStep = "yearly" | "monthly" | "weekly" | "daily";

export interface OnboardingState {
  step: number; // 1–4
  categories: Category[];
  yearlyGoals: YearlyGoal[];
  monthlyGoals: MonthlyGoal[];
  weeklyGoals: WeeklyGoal[];
  dailyPriorities: DailyPriority[];
  habits: FoundationalHabit[];
}

// ─── App Store ────────────────────────────────────────────────────────────────

export interface AppStore {
  // Onboarding
  onboardingStep: number;
  onboardingComplete: boolean;

  // Data
  categories: Category[];
  yearlyGoals: YearlyGoal[];
  monthlyGoals: MonthlyGoal[];
  weeklyGoals: WeeklyGoal[];
  dailyPriorities: DailyPriority[];
  habits: FoundationalHabit[];
  metrics: DashboardMetrics;
  reports: YearReport[];
  pendingRecaps: DashboardRecapEntry[];

  // UI State
  activeModal: ModalType | null;
  modalData: unknown;
}

export type ModalType =
  | "add-category"
  | "add-yearly-goal"
  | "add-monthly-goal"
  | "add-weekly-goal"
  | "add-daily-priority"
  | "add-secondary-task"
  | "edit-secondary-task"
  | "edit-yearly-goal"
  | "edit-monthly-goal"
  | "edit-weekly-goal"
  | "edit-daily-priority"
  | "manage-habits"
  | "daily-report"
  | "quarterly-report"
  | "weekly-report"
  | "monthly-report"
  | "yearly-report";
