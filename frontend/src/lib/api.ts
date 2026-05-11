/**
 * Execution AI — Backend API Client
 *
 * Typed wrapper around all backend endpoints.
 * Uses fetch. All calls inject the session_id where required.
 * Throws on non-2xx responses with a structured ApiError.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Error handling ───────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs, signal: outerSignal, ...fetchOpts } = options;
  const controller = typeof timeoutMs === "number" ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
  const signal = outerSignal ?? controller?.signal;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...fetchOpts.headers },
      ...fetchOpts,
      ...(signal ? { signal } : {}),
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      throw new ApiError(
        408,
        "Request timed out. The server took too long to respond (often the AI step). Try again, or set GEMINI_MODEL to a supported Gemini model like gemini-2.5-flash on the backend.",
      );
    }
    throw e;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>(path);
/** AI plan/report generation can take 30–90s; default fetch has no timeout so the UI hangs. */
const AI_GENERATE_TIMEOUT_MS = 150_000;

const post = <T>(path: string, body?: unknown, timeoutMs?: number) =>
  request<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ─── Types (mirrors backend responses) ───────────────────────────────────────

export interface Session {
  id: string;
  onboarding_step: number;
  onboarding_done: boolean;
  timezone: string;
  week_starts_on: "sunday" | "monday";
  created_at: string;
  auth_user_id?: string;
  pending_recaps?: ApiRecapQueueEntry[];
  handled_recaps?: string[];
}

export interface ApiRecapQueueEntry {
  type: "weekly" | "monthly" | "quarterly" | "yearly";
  period_year: number;
  period_week?: number;
  period_month?: number;
  period_quarter?: number;
  fired_at: string;
}

export interface ApiCategory {
  id: string;
  session_id: string;
  name: string;
  icon: string;
  color?: string;
  sort_order: number;
  created_at: string;
}

export interface ApiYearlyGoal {
  id: string;
  session_id: string;
  category_id?: string;
  title: string;
  description?: string;
  year: number;
  status: string;
  progress: number;
  target_date?: string;
  ai_suggested: boolean;
  editable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiMonthlyGoal {
  id: string;
  session_id: string;
  monthly_plan_id: string;
  yearly_goal_id?: string;
  category_id?: string;
  title: string;
  description?: string;
  year: number;
  month: number;
  status: string;
  progress: number;
  priority: string;
  is_main: boolean;
  target_date?: string;
  workload?: string;
  ai_suggested: boolean;
  editable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiWeeklyGoal {
  id: string;
  session_id: string;
  weekly_plan_id: string;
  monthly_goal_id?: string;
  title: string;
  description?: string;
  year: number;
  month: number;
  week_number: number;
  status: string;
  progress: number;
  is_main: boolean;
  target_day?: string;
  goal_type?: string;
  workload?: string;
  ai_suggested: boolean;
  editable?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiDailyPriority {
  id: string;
  session_id: string;
  daily_plan_id: string;
  weekly_goal_id?: string;
  title: string;
  description?: string;
  date: string;
  status: string;
  completed: boolean;
  completed_at?: string;
  priority: string;
  estimated_minutes?: number;
  is_main: boolean;
  tag?: string;
  ai_suggested: boolean;
  editable?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiHabit {
  id: string;
  session_id: string;
  name: string;
  icon: string;
  frequency: string;
  active: boolean;
  category_id?: string;
  sort_order: number;
  completed_today: boolean;
  streak: number;
  created_at: string;
  updated_at: string;
}

export interface ApiDashboard {
  session_id: string;
  today: string;
  week_number: number;
  month: number;
  year: number;
  week_start: string;
  week_end: string;
  days_left_in_week: number;
  days_left_in_month: number;
  daily_priorities: ApiDailyPriority[];
  secondary_tasks: ApiDailyPriority[];
  weekly_goals: ApiWeeklyGoal[];
  monthly_context: ApiMonthlyGoal[];
  /** Present on current API; omitted on older backends. */
  yearly_goals?: ApiYearlyGoal[];
  habits: ApiHabit[];
  pending_recaps?: ApiRecapQueueEntry[];
  metrics: {
    execution_streak: number;
    yesterday_completion: number;
    weekly_consistency: number[];
    tasks_completed_today: number;
    tasks_total_today: number;
    habits_completed_today: number;
    habits_total_today: number;
    weekly_completion_rate: number;
    monthly_completion_rate: number;
  };
  weekly_objective?: string;
  monthly_context_text?: string;
}

export interface ApiNextDayReviewItem {
  title: string;
  description?: string;
  priority: string;
  estimated_minutes?: number;
  tag?: string;
  weekly_goal_id?: string;
  is_main?: boolean;
}

export interface ApiNextDayReview {
  today: string;
  source_date: string;
  should_open: boolean;
  already_planned_today: boolean;
  yesterday_summary: {
    completion_rate: number;
    completed_main_count: number;
    main_count: number;
    completed_task_count: number;
    task_count: number;
    completed_habit_count: number;
    habit_count: number;
    completed_main_titles: string[];
    completed_task_titles: string[];
    completed_habit_names: string[];
    incomplete_main_titles: string[];
    incomplete_task_titles: string[];
    missed_habit_names: string[];
  };
  reflection?: string;
  insights: string[];
  proposal: {
    priorities: ApiNextDayReviewItem[];
    tasks: ApiNextDayReviewItem[];
    weekly_objective?: string | null;
    monthly_context?: string | null;
  };
}

export interface ApiGoalsHierarchy {
  year: number;
  last_synced_at: string;
  yearly_goals: ApiYearlyGoal[];
  categories: ApiCategory[];
  current_month: number;
  monthly_goals: ApiMonthlyGoal[];
  current_week_number: number;
  weekly_goals: ApiWeeklyGoal[];
  today: string;
  year_daily_priorities: ApiDailyPriority[];
  selected_week_number: number | null;
  selected_week_start: string | null;
  selected_week_end: string | null;
  selected_week_daily_priorities: ApiDailyPriority[];
}

export interface ApiReport {
  id: string;
  session_id: string;
  report_type: string;
  period_date?: string;
  period_week?: number;
  period_month?: number;
  period_quarter?: number;
  period_year: number;
  metrics: Record<string, unknown>;
  ai_narrative?: Record<string, unknown>;
  tailored_pattern?: string | null;
  tailored_action?: string | null;
  has_execution_data?: boolean;
  ai_generated_at?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessionsApi = {
  create: (
    timezone = "UTC",
    authUserId?: string,
    deviceHint?: string,
    weekStartsOn?: "sunday" | "monday",
  ) =>
    post<Session>("/session/start", {
      timezone,
      auth_user_id: authUserId,
      device_hint: deviceHint,
      week_starts_on: weekStartsOn,
    }),

  get: (sessionId: string) =>
    get<Session>(`/session/${sessionId}`),

  update: (
    sessionId: string,
    updates: {
      onboarding_step?: number;
      onboarding_done?: boolean;
      auth_user_id?: string;
      timezone?: string;
      week_starts_on?: "sunday" | "monday";
      pending_recaps?: ApiRecapQueueEntry[];
      handled_recaps?: string[];
    },
  ) =>
    patch<Session>(`/session/${sessionId}`, updates),
};

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoriesApi = {
  list: (sessionId: string) =>
    get<ApiCategory[]>(`/yearly-goals/${sessionId}/categories`),

  create: (sessionId: string, data: { name: string; icon: string; color?: string }) =>
    post<ApiCategory>(`/yearly-goals/${sessionId}/categories`, data),

  delete: (sessionId: string, categoryId: string) =>
    del<void>(`/yearly-goals/${sessionId}/categories/${categoryId}`),
};

// ─── Yearly Goals ─────────────────────────────────────────────────────────────

export const yearlyGoalsApi = {
  list: (sessionId: string, year: number) =>
    get<ApiYearlyGoal[]>(`/yearly-goals/${sessionId}?year=${year}`),

  create: (sessionId: string, data: {
    title: string;
    category_id?: string;
    description?: string;
    year: number;
    target_date?: string;
  }) => post<ApiYearlyGoal>(`/yearly-goals/${sessionId}`, data),

  update: (sessionId: string, goalId: string, data: Partial<{
    title: string;
    description: string;
    status: string;
    progress: number;
    category_id: string;
    target_date: string;
  }>) => patch<ApiYearlyGoal>(`/yearly-goals/${sessionId}/${goalId}`, data),

  delete: (sessionId: string, goalId: string) =>
    del<void>(`/yearly-goals/${sessionId}/${goalId}`),
};

// ─── Monthly Plans ────────────────────────────────────────────────────────────

export const monthlyPlanApi = {
  generate: (sessionId: string, year: number, month: number) =>
    post<{ id: string; ai_draft: Record<string, unknown> }>(
      "/monthly-plan/generate",
      { session_id: sessionId, year, month },
      AI_GENERATE_TIMEOUT_MS,
    ),

  approve: (sessionId: string, year: number, month: number, goals?: unknown[]) =>
    post<{ id: string; status: string }>(`/monthly-plan/save?session_id=${sessionId}&year=${year}&month=${month}`, { goals }),

  get: (sessionId: string, year: number, month: number) =>
    get<{ id: string; goals: ApiMonthlyGoal[]; status: string }>
      (`/monthly-plan/${sessionId}?year=${year}&month=${month}`),

  addGoal: (sessionId: string, year: number, month: number, data: {
    title: string;
    description?: string;
    is_main: boolean;
    priority: string;
    yearly_goal_id?: string;
    category_id?: string;
    target_date?: string;
    workload?: string;
  }) => post<ApiMonthlyGoal>(`/monthly-plan/${sessionId}/goals?year=${year}&month=${month}`, data),

  updateGoal: (sessionId: string, goalId: string, data: Partial<ApiMonthlyGoal>) =>
    patch<ApiMonthlyGoal>(`/monthly-goals/${goalId}?session_id=${sessionId}`, data),

  deleteGoal: (sessionId: string, goalId: string) =>
    del<void>(`/monthly-goals/${goalId}?session_id=${sessionId}`),
};

// ─── Weekly Plans ─────────────────────────────────────────────────────────────

export const weeklyPlanApi = {
  generate: (sessionId: string, year: number, weekNumber: number) =>
    post<{ id: string; ai_draft: Record<string, unknown> }>(
      "/weekly-plan/generate",
      { session_id: sessionId, year, week_number: weekNumber },
      AI_GENERATE_TIMEOUT_MS,
    ),

  approve: (sessionId: string, year: number, weekNumber: number, goals?: unknown[]) =>
    post<{ id: string; status: string }>(`/weekly-plan/save?session_id=${sessionId}&year=${year}&week_number=${weekNumber}`, { goals }),

  get: (sessionId: string, year: number, weekNumber: number) =>
    get<{ id: string; goals: ApiWeeklyGoal[]; status: string }>
      (`/weekly-plan/${sessionId}?year=${year}&week_number=${weekNumber}`),

  addGoal: (sessionId: string, year: number, weekNumber: number, data: {
    title: string;
    description?: string;
    is_main: boolean;
    monthly_goal_id?: string;
    target_day?: string;
    goal_type?: string;
    workload?: string;
  }) => post<ApiWeeklyGoal>(`/weekly-plan/${sessionId}/goals?year=${year}&week_number=${weekNumber}`, data),

  updateGoal: (sessionId: string, goalId: string, data: Partial<ApiWeeklyGoal>) =>
    patch<ApiWeeklyGoal>(`/weekly-goals/${goalId}?session_id=${sessionId}`, data),

  deleteGoal: (sessionId: string, goalId: string) =>
    del<void>(`/weekly-goals/${goalId}?session_id=${sessionId}`),
};

// ─── Daily Plans ──────────────────────────────────────────────────────────────

export const dailyPlanApi = {
  generate: (sessionId: string, date: string) =>
    post<{ id: string; ai_draft: Record<string, unknown> }>(
      "/daily-plan/generate",
      { session_id: sessionId, date },
      AI_GENERATE_TIMEOUT_MS,
    ),

  approve: (sessionId: string, date: string, priorities?: unknown[]) =>
    post<{ id: string; status: string }>(`/daily-plan/save?session_id=${sessionId}&date=${date}`, { priorities }),

  get: (sessionId: string, date: string) =>
    get<{ id: string; priorities: ApiDailyPriority[]; status: string }>
      (`/daily-plan/${sessionId}?date=${date}`),
};

// ─── Tasks / Execution ────────────────────────────────────────────────────────

export const tasksApi = {
  toggleStatus: (sessionId: string, taskId: string, completed: boolean) =>
    patch<ApiDailyPriority>(`/tasks/${taskId}/status?session_id=${sessionId}&completed=${completed}`),

  update: (sessionId: string, taskId: string, data: Partial<{
    title: string;
    description: string;
    notes: string;
    priority: string;
    estimated_minutes: number;
    tag: string;
    weekly_goal_id: string | null;
  }>) => patch<ApiDailyPriority>(`/tasks/${taskId}?session_id=${sessionId}`, data),

  create: (sessionId: string, date: string, data: {
    title: string;
    description?: string;
    priority: string;
    is_main: boolean;
    estimated_minutes?: number;
    tag?: string;
    weekly_goal_id?: string;
  }) => post<ApiDailyPriority>(`/tasks?session_id=${sessionId}&date=${date}`, data),

  updateGoalProgress: (
    sessionId: string,
    goalType: "yearly" | "monthly" | "weekly",
    goalId: string,
    progress: number,
    status?: string
  ) => {
    const params = new URLSearchParams({ session_id: sessionId, progress: String(progress) });
    if (status) params.append("status", status);
    return patch<unknown>(`/goals/${goalType}/${goalId}/progress?${params}`);
  },
};

// ─── Habits ───────────────────────────────────────────────────────────────────

export const habitsApi = {
  list: (sessionId: string) =>
    get<ApiHabit[]>(`/habits/${sessionId}`),

  create: (sessionId: string, data: {
    name: string;
    icon: string;
    frequency: string;
    category_id?: string;
  }) => post<ApiHabit>(`/habits/${sessionId}`, data),

  update: (sessionId: string, habitId: string, data: Partial<{
    name: string;
    icon: string;
    frequency: string;
    active: boolean;
    category_id: string;
  }>) => patch<ApiHabit>(`/habits/${sessionId}/${habitId}`, data),

  delete: (sessionId: string, habitId: string) =>
    del<void>(`/habits/${sessionId}/${habitId}`),

  toggle: (sessionId: string, habitId: string, completed: boolean, date?: string) => {
    const params = new URLSearchParams({ session_id: sessionId, completed: String(completed) });
    if (date) params.append("log_date", date);
    return patch<unknown>(`/habits/${habitId}/status?${params}`);
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  get: (sessionId: string, planDate?: string) =>
    get<ApiDashboard>(`/dashboard/${sessionId}${planDate ? `?plan_date=${encodeURIComponent(planDate)}` : ""}`),

  getNextDayReview: (sessionId: string, planDate?: string) =>
    get<ApiNextDayReview>(
      `/dashboard/${sessionId}/next-day-review${planDate ? `?plan_date=${encodeURIComponent(planDate)}` : ""}`,
    ),

  approveNextDayReview: (
    sessionId: string,
    data: { priorities: ApiNextDayReviewItem[]; tasks: ApiNextDayReviewItem[]; date?: string }
  ) => {
    const params = data.date ? `?plan_date=${data.date}` : "";
    return post<{ id: string; status: string; saved_priorities: number; saved_tasks: number; date: string }>(
      `/dashboard/${sessionId}/next-day-review/approve${params}`,
      { priorities: data.priorities, tasks: data.tasks },
    );
  },
};

// ─── Goals Hierarchy ──────────────────────────────────────────────────────────

export const goalsApi = {
  years: (sessionId: string) =>
    get<number[]>(`/goals/years/${sessionId}`),

  hierarchy: (
    sessionId: string,
    opts?: { year?: number; weekNumber?: number },
  ) => {
    const params = new URLSearchParams();
    if (opts?.year) params.set("year", String(opts.year));
    if (opts?.weekNumber) params.set("week_number", String(opts.weekNumber));
    const query = params.toString();
    return get<ApiGoalsHierarchy>(`/goals/${sessionId}${query ? `?${query}` : ""}`);
  },
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsApi = {
  list: (sessionId: string) =>
    get<ApiReport[]>(`/reports/${sessionId}`),

  generateDaily: (sessionId: string, date: string) =>
    post<ApiReport>("/reports/daily/generate", { session_id: sessionId, date }, AI_GENERATE_TIMEOUT_MS),

  generateWeekly: (sessionId: string, year: number, weekNumber: number) =>
    post<ApiReport>(
      "/reports/weekly/generate",
      { session_id: sessionId, year, week_number: weekNumber },
      AI_GENERATE_TIMEOUT_MS,
    ),

  generateMonthly: (sessionId: string, year: number, month: number) =>
    post<ApiReport>("/reports/monthly/generate", { session_id: sessionId, year, month }, AI_GENERATE_TIMEOUT_MS),

  generateQuarterly: (sessionId: string, year: number, quarter: number) =>
    post<ApiReport>("/reports/quarterly/generate", { session_id: sessionId, year, quarter }, AI_GENERATE_TIMEOUT_MS),

  generateYearly: (sessionId: string, year: number) =>
    post<ApiReport>("/reports/yearly/generate", { session_id: sessionId, year }, AI_GENERATE_TIMEOUT_MS),
};
