import type {
  Category,
  YearlyGoal,
  MonthlyGoal,
  WeeklyGoal,
  DailyPriority,
  FoundationalHabit,
  DashboardMetrics,
  YearReport,
  MonthReport,
  WeekReport,
} from "./types";
import type { WeekStartsOn } from "./types";

// ─── Current context — lazy getters (never captured at import time) ─────────
//
// Long-running tabs (especially across midnight or week boundaries) need to
// read "today/now" on every render. Exported constants captured once at
// module-import froze stale labels and goal-list filters until a hard refresh.
// Always call the getter — never alias the result to a const at module scope.

function _localDateParts(date: Date, timezone?: string) {
  if (!timezone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? date.getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? date.getMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? date.getDate());
  return { year, month, day };
}

function _weekStartFor(date: Date, weekStartsOn: WeekStartsOn): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = copy.getUTCDay();
  const offset = weekStartsOn === "sunday" ? weekday : (weekday + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - offset);
  return copy;
}

function _weekNumber(date: Date, weekStartsOn: WeekStartsOn): number {
  const weekOneStart = _weekStartFor(new Date(Date.UTC(date.getUTCFullYear(), 0, 1)), weekStartsOn);
  const currentWeekStart = _weekStartFor(date, weekStartsOn);
  return Math.floor((currentWeekStart.getTime() - weekOneStart.getTime()) / 604800000) + 1;
}

/** Today as YYYY-MM-DD in the user's local timezone or a provided IANA timezone. */
export function getToday(timezone?: string): string {
  const d = new Date();
  const { year, month, day } = _localDateParts(d, timezone);
  const yyyy = String(year);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Current calendar year. */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/** Current month (1-12). */
export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

/** Current planning week number for the configured week model. */
export function getCurrentWeek(weekStartsOn: WeekStartsOn = "monday"): number {
  const now = new Date();
  return _weekNumber(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())), weekStartsOn);
}

// Seed-only snapshots for the static MOCK_* arrays below (intentionally frozen
// at import time — they only feed demo data, never live filters).
const _SEED_TODAY = getToday();

// ─── Categories ───────────────────────────────────────────────────────────────
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Spiritual", icon: "self_improvement" },
  { id: "cat-2", name: "Career", icon: "work" },
  { id: "cat-3", name: "Academic", icon: "school" },
  { id: "cat-4", name: "Personal Growth", icon: "trending_up" },
];

// ─── Yearly goals ─────────────────────────────────────────────────────────────
export const MOCK_YEARLY_GOALS: YearlyGoal[] = [
  {
    id: "yg-1",
    categoryId: "cat-1",
    title: "Daily mindfulness practice (20 mins)",
    year: 2026,
    status: "active",
    progress: 0,
    targetDate: "2026-03-15",
  },
  {
    id: "yg-2",
    categoryId: "cat-2",
    title: "Launch Execution AI MVP to 1,000 users",
    year: 2026,
    status: "active",
    progress: 35,
    targetDate: "2026-06-30",
  },
  {
    id: "yg-3",
    categoryId: "cat-2",
    title: "Generate $10k MRR from SaaS products",
    year: 2026,
    status: "active",
    progress: 18,
    targetDate: "2026-12-31",
  },
];

// ─── Monthly goals ────────────────────────────────────────────────────────────
export const MOCK_MONTHLY_GOALS: MonthlyGoal[] = [
  {
    id: "mg-1",
    title: "Ship onboarding flow and core dashboard",
    description: "Complete development of the user-facing MVP screens.",
    yearlyGoalId: "yg-1",
    month: 4,
    year: 2026,
    status: "active",
    progress: 60,
    priority: "high",
    isMain: true,
    aiSuggested: true,
  },
  {
    id: "mg-2",
    title: "Onboard first 50 beta users",
    description: "Conduct outreach and guide early adopters through onboarding.",
    yearlyGoalId: "yg-1",
    month: 4,
    year: 2026,
    status: "active",
    progress: 24,
    priority: "high",
    isMain: true,
    aiSuggested: true,
  },
  {
    id: "mg-3",
    title: "Maintain 4x/week training cadence",
    description: "Strength + cardio split, track in training log.",
    yearlyGoalId: "yg-3",
    month: 4,
    year: 2026,
    status: "active",
    progress: 75,
    priority: "high",
    isMain: false,
    aiSuggested: false,
  },
  {
    id: "mg-4",
    title: "Complete 2 books this month",
    description: "Currently reading: 'The Almanack of Naval Ravikant'",
    yearlyGoalId: "yg-4",
    month: 4,
    year: 2026,
    status: "active",
    progress: 50,
    priority: "medium",
    isMain: false,
    aiSuggested: false,
  },
  {
    id: "mg-5",
    title: "Save $800 toward emergency fund",
    description: "Automate transfer on the 1st of each month.",
    yearlyGoalId: "yg-5",
    month: 4,
    year: 2026,
    status: "active",
    progress: 100,
    priority: "medium",
    isMain: false,
    aiSuggested: true,
  },
];

// ─── Weekly goals ─────────────────────────────────────────────────────────────
export const MOCK_WEEKLY_GOALS: WeeklyGoal[] = [
  {
    id: "wg-1",
    title: "Submit Q4 Strategic Roadmap Draft",
    description: "Complete the full strategic document and send for review.",
    monthlyGoalId: "mg-1",
    weekNumber: 15,
    month: 4,
    year: 2026,
    status: "active",
    progress: 55,
    isMain: true,
    targetDay: "wed",
    aiSuggested: true,
  },
  {
    id: "wg-3",
    title: "Review 3 Designer portfolios",
    description: "Support for Hiring target",
    monthlyGoalId: "mg-2",
    weekNumber: 15,
    month: 4,
    year: 2026,
    status: "active",
    progress: 33,
    isMain: false,
    targetDay: "thu",
    goalType: "tactical",
    aiSuggested: false,
  },
  {
    id: "wg-4",
    title: "Schedule performance syncs",
    description: "Quarterly review cycle",
    monthlyGoalId: "mg-1",
    weekNumber: 15,
    month: 4,
    year: 2026,
    status: "active",
    progress: 67,
    isMain: false,
    targetDay: "fri",
    goalType: "operational",
    aiSuggested: false,
  },
];

// Previous weeks (locked)
export const LOCKED_WEEKLY_GOALS: WeeklyGoal[] = [
  {
    id: "wg-prev-1",
    title: "Complete Reports tab and analytics views",
    weekNumber: 14,
    month: 4,
    year: 2026,
    status: "completed",
    progress: 100,
    isMain: true,
  },
  {
    id: "wg-prev-2",
    title: "Ship app shell and navigation system",
    weekNumber: 13,
    month: 4,
    year: 2026,
    status: "completed",
    progress: 100,
    isMain: true,
  },
];

// ─── Daily priorities ─────────────────────────────────────────────────────────
export const MOCK_DAILY_PRIORITIES: DailyPriority[] = [
  {
    id: "dp-1",
    title: "Finalize Architectural Framework Review",
    description: "Complete the full structural review and prepare for sign-off.",
    weeklyGoalId: "wg-1",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "high",
    estimatedMinutes: 90,
    isMain: true,
    tag: "High Energy",
    aiSuggested: true,
  },
  {
    id: "dp-2",
    title: "Client Strategy Alignment Meeting",
    description: "Sync with client on Q4 strategic direction and next steps.",
    weeklyGoalId: "wg-1",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "high",
    estimatedMinutes: 45,
    isMain: true,
    tag: "Collaborative",
    aiSuggested: true,
  },
  {
    id: "dp-3",
    title: "Deep Work Session: Module 4 Prototyping",
    description: "Focused build session for the core module prototype.",
    weeklyGoalId: "wg-1",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "high",
    estimatedMinutes: 120,
    isMain: true,
    tag: "Deep Focus",
    aiSuggested: false,
  },
];

export const MOCK_SECONDARY_TASKS: DailyPriority[] = [
  {
    id: "st-1",
    title: "Clear email inbox to zero",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "medium",
    estimatedMinutes: 30,
    isMain: false,
    tag: "Career",
  },
  {
    id: "st-2",
    title: "Update weekly expense tracker",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "low",
    estimatedMinutes: 15,
    isMain: false,
    tag: "Personal Growth",
  },
  {
    id: "st-3",
    title: "Order new office supplies",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "medium",
    estimatedMinutes: 15,
    isMain: false,
    tag: "Health",
  },
  {
    id: "st-4",
    title: "Read 20 pages of current book",
    date: _SEED_TODAY,
    status: "active",
    completed: false,
    priority: "low",
    estimatedMinutes: 30,
    isMain: false,
    tag: "Growth",
  },
];

// ─── Foundational habits ──────────────────────────────────────────────────────
export const MOCK_HABITS: FoundationalHabit[] = [
  {
    id: "hab-1",
    name: "30-min Deep Reading",
    icon: "menu_book",
    categoryId: "cat-4",
    frequency: "daily",
    completedToday: true,
    streak: 14,
    active: true,
  },
  {
    id: "hab-2",
    name: "Strength Training (Gym)",
    icon: "fitness_center",
    categoryId: "cat-1",
    frequency: "3x_week",
    completedToday: false,
    streak: 7,
    active: true,
  },
  {
    id: "hab-3",
    name: "Morning Hydration",
    icon: "water_drop",
    categoryId: "cat-1",
    frequency: "daily",
    completedToday: false,
    streak: 5,
    active: true,
  },
  {
    id: "hab-4",
    name: "Evening Reflection",
    icon: "self_improvement",
    categoryId: "cat-1",
    frequency: "daily",
    completedToday: true,
    streak: 21,
    active: true,
  },
  {
    id: "hab-5",
    name: "Weekly Review",
    icon: "assignment_turned_in",
    frequency: "weekdays",
    completedToday: false,
    streak: 3,
    active: true,
  },
];

// ─── Dashboard metrics ────────────────────────────────────────────────────────
/** Fresh workspace / new user — no fabricated KPIs. */
export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  executionStreak: 0,
  yesterdayCompletion: 0,
  weeklyConsistency: [0, 0, 0, 0, 0, 0, 0],
  weeklyObjective: "",
  monthlyContext: "",
};

export const MOCK_METRICS: DashboardMetrics = {
  executionStreak: 14,
  yesterdayCompletion: 88,
  weeklyConsistency: [60, 80, 40, 95, 100, 70, 15],
  weeklyObjective: "Ship Goals tab and modal system for Execution AI.",
  monthlyContext: "Build and launch the Execution AI MVP to first 50 beta users.",
};

// ─── Reports ──────────────────────────────────────────────────────────────────
const WEEK_REPORTS_Q1: WeekReport[] = [
  { weekNumber: 1, year: 2026, month: 1, completionRate: 91, mainGoalsCompleted: 2, mainGoalsTotal: 2, topWin: "Completed architecture spec", status: "completed", dateRange: "Jan 1–7" },
  { weekNumber: 2, year: 2026, month: 1, completionRate: 84, mainGoalsCompleted: 2, mainGoalsTotal: 2, topWin: "Shipped landing page v1", status: "completed", dateRange: "Jan 8–14" },
  { weekNumber: 3, year: 2026, month: 1, completionRate: 76, mainGoalsCompleted: 1, mainGoalsTotal: 2, status: "completed", dateRange: "Jan 15–21" },
  { weekNumber: 4, year: 2026, month: 1, completionRate: 95, mainGoalsCompleted: 2, mainGoalsTotal: 2, topWin: "Closed first sponsor deal", status: "completed", dateRange: "Jan 22–31" },
];

function makeMonthReport(
  month: number,
  year: number,
  weeks: WeekReport[],
  completionRate: number,
  topPillar: string,
  tasksCompleted: number,
  status: MonthReport["status"]
): MonthReport {
  return { month, year, completionRate, topPillar, tasksCompleted, status, weeks };
}

export const MOCK_REPORTS: YearReport[] = [
  {
    year: 2026,
    completionRate: 87,
    topPillar: "Career & Business",
    tasksCompleted: 342,
    streak: 42,
    percentChange: 12,
    months: [
      makeMonthReport(1, 2026, WEEK_REPORTS_Q1, 87, "Career", 89, "completed"),
      makeMonthReport(2, 2026, [], 82, "Health", 76, "completed"),
      makeMonthReport(3, 2026, [], 91, "Career", 94, "completed"),
      makeMonthReport(4, 2026, [], 78, "Career", 83, "active"),
      makeMonthReport(5, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(6, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(7, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(8, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(9, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(10, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(11, 2026, [], 0, "", 0, "locked"),
      makeMonthReport(12, 2026, [], 0, "", 0, "locked"),
    ],
  },
  {
    year: 2025,
    completionRate: 79,
    topPillar: "Personal Growth",
    tasksCompleted: 1240,
    streak: 28,
    percentChange: -3,
    months: Array.from({ length: 12 }, (_, i) =>
      makeMonthReport(
        i + 1,
        2025,
        [],
        Math.floor(70 + Math.random() * 25),
        "Career",
        Math.floor(80 + Math.random() * 50),
        "completed"
      )
    ),
  },
];

// ─── AI Strategist messages ───────────────────────────────────────────────────
export const AI_INSIGHTS = {
  daily:
    "Based on your Q2 trajectory, prioritizing the Goals UI today unlocks 23% more shipping capacity next week.",
  weekly:
    "You are on pace to hit your monthly shipping target. Protect your deep work blocks this week.",
  monthly:
    "April is your highest-velocity month historically. Keep momentum strong through week 3.",
};

// ─── Month names ──────────────────────────────────────────────────────────────
export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
