"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Category,
  YearlyGoal,
  MonthlyGoal,
  WeeklyGoal,
  DailyPriority,
  FoundationalHabit,
  ModalType,
  WeekStartsOn,
} from "./types";
import {
  DEFAULT_CATEGORIES,
  EMPTY_DASHBOARD_METRICS,
  getCurrentYear,
  getToday,
} from "./mockData";
import { isUuid } from "./uuid";
import type { DashboardMetrics } from "./types";
import {
  ApiError,
  categoriesApi,
  yearlyGoalsApi,
  monthlyPlanApi,
  weeklyPlanApi,
  dailyPlanApi,
  tasksApi,
  habitsApi,
  dashboardApi,
  reportsApi,
  sessionsApi,
  type ApiDashboard,
  type ApiReport,
  type ApiYearlyGoal,
  type ApiMonthlyGoal,
  type ApiWeeklyGoal,
} from "./api";
import { ensureBackendSession, clearSessionId } from "./session";
import { formatApiError } from "./apiErrors";
import { getSupabaseBrowser } from "./supabaseClient";
import type { User } from "@supabase/supabase-js";
import { isAuthLocalOnly, isCloudOtpAuthEnabled, isCloudSupabaseConfigured } from "./authMode";

/** Align onboarding UI with the workspace row in Supabase (source of truth when logged in). */
async function pullOnboardingFromServer(sessionId: string): Promise<{
  onboarding_step: number;
  onboarding_done: boolean;
  week_starts_on: WeekStartsOn;
} | null> {
  try {
    const row = await sessionsApi.get(sessionId);
    return {
      onboarding_step: row.onboarding_step,
      onboarding_done: row.onboarding_done,
      week_starts_on: row.week_starts_on,
    };
  } catch {
    return null;
  }
}

// ── Auth types ─────────────────────────────────────────────────────────────────
export interface AuthUser { id: string; name: string; email: string; plan: string }
interface StoredUser { id: string; name: string; email: string; password: string; plan: string }

function authUserFromSupabase(u: User, nameFallback?: string): AuthUser {
  const mail = (u.email ?? "").trim();
  const meta = u.user_metadata as { full_name?: string } | undefined;
  const fromMeta = (meta?.full_name as string | undefined)?.trim();
  return {
    id: u.id,
    name: fromMeta || nameFallback?.trim() || mail.split("@")[0] || "User",
    email: mail,
    plan: "Free",
  };
}

/** Result of email/password auth (local demo or Supabase). */
export type AuthActionResult =
  | { success: true; needsEmailConfirmation?: boolean }
  | { success: false; error: string };

export type SendEmailOtpResult = { success: true } | { success: false; error: string };

interface AppState {
  // ── Auth ────────────────────────────────────────────────────────────────────
  currentUser: AuthUser | null;
  authReady: boolean;
  registeredUsers: StoredUser[];
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthActionResult>;
  /** Supabase: send a 6-digit code (Magic Link email template must include `{{ .Token }}`). */
  sendEmailOtp: (
    email: string,
    opts: { intent: "signin" | "signup"; fullName?: string },
  ) => Promise<SendEmailOtpResult>;
  /** Supabase: exchange code from email for a session. */
  verifyEmailOtp: (
    email: string,
    token: string,
    opts: { intent: "signin" | "signup"; fullName?: string },
  ) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  /** Restore session after OAuth/email link callback (Supabase). */
  hydrateAuthFromSupabase: () => Promise<void>;
  /** Password reset email (Supabase + Resend SMTP in project settings). */
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;

  // ── Backend session ──────────────────────────────────────────────────────────
  sessionId: string | null;
  sessionWeekStartsOn: WeekStartsOn;
  setSessionId: (id: string | null) => void;
  setWeekStartsOn: (value: WeekStartsOn) => Promise<void>;
  backendReady: boolean;
  workspaceHydrating: boolean;
  /** User id that owns the persisted workspace below; changes when a different account signs in. */
  workspaceOwnerId: string | null;
  /** Last server save / sync failure (not persisted). */
  syncError: string | null;
  /** Explicit server write state so UI copy does not infer from local state. */
  syncStatus: "idle" | "saving" | "saved" | "failed";
  clearSyncError: () => void;
  activeDashboardDate: string;
  setActiveDashboardDate: (date: string) => void;

  // ── Onboarding ──────────────────────────────────────────────────────────────
  onboardingStep: number;
  onboardingComplete: boolean;
  kickoffPending: boolean;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => Promise<boolean>;
  dismissKickoff: () => void;

  // ── Data ────────────────────────────────────────────────────────────────────
  categories: Category[];
  yearlyGoals: YearlyGoal[];
  monthlyGoals: MonthlyGoal[];
  weeklyGoals: WeeklyGoal[];
  dailyPriorities: DailyPriority[];
  secondaryTasks: DailyPriority[];
  habits: FoundationalHabit[];
  metrics: DashboardMetrics;
  reports: ApiReport[];

  // ── Backend sync ─────────────────────────────────────────────────────────────
  loadDashboard: (planDate?: string) => Promise<void>;
  syncReports: () => Promise<void>;

  // ── CRUD operations ─────────────────────────────────────────────────────────
  addCategory: (cat: Omit<Category, "id">) => void;
  removeCategory: (id: string) => void;

  addYearlyGoal: (goal: Omit<YearlyGoal, "id">) => void;
  updateYearlyGoal: (id: string, updates: Partial<YearlyGoal>) => void;
  removeYearlyGoal: (id: string) => void;
  /** Persist yearly goals that only exist locally (e.g. mock ids) before leaving step 1. */
  syncYearlyGoalsToServer: () => Promise<boolean>;
  /** Persist monthly goals with local-only ids before weekly AI / leaving step 2. */
  syncMonthlyGoalsToServer: (year: number, month: number) => Promise<boolean>;
  /** Persist weekly goals with local-only ids before daily AI / leaving step 3. */
  syncWeeklyGoalsToServer: (year: number, weekNumber: number) => Promise<boolean>;
  /** Persist local-only daily tasks / habits before completing onboarding. */
  syncDailySetupToServer: (date: string) => Promise<boolean>;

  addMonthlyGoal: (goal: Omit<MonthlyGoal, "id">) => void;
  updateMonthlyGoal: (id: string, updates: Partial<MonthlyGoal>) => void;
  removeMonthlyGoal: (id: string) => void;

  addWeeklyGoal: (goal: Omit<WeeklyGoal, "id">) => void;
  updateWeeklyGoal: (id: string, updates: Partial<WeeklyGoal>) => void;
  removeWeeklyGoal: (id: string) => void;

  addDailyPriority: (priority: Omit<DailyPriority, "id">) => void;
  updateDailyPriority: (id: string, updates: Partial<DailyPriority>) => void;
  toggleDailyPriority: (id: string) => void;
  removeDailyPriority: (id: string) => void;

  addSecondaryTask: (task: Omit<DailyPriority, "id">) => void;
  updateSecondaryTask: (id: string, updates: Partial<DailyPriority>) => void;
  toggleSecondaryTask: (id: string) => void;
  removeSecondaryTask: (id: string) => void;

  toggleHabit: (id: string) => void;
  updateHabit: (id: string, updates: Partial<FoundationalHabit>) => void;
  addHabit: (habit: Omit<FoundationalHabit, "id">) => void;
  removeHabit: (id: string) => void;

  // ── AI Plan generation ───────────────────────────────────────────────────────
  generateMonthlyPlan: (
    year: number,
    month: number,
  ) => Promise<
    | { ok: true; draft: unknown }
    | { ok: false; code: "no_session" | "yearly_sync_failed" | "no_yearly_on_server" | "api_error" }
  >;
  approveMonthlyPlan: (year: number, month: number, goals?: unknown[]) => Promise<boolean>;
  generateWeeklyPlan: (year: number, weekNumber: number) => Promise<{ draft: unknown } | null>;
  approveWeeklyPlan: (year: number, weekNumber: number, goals?: unknown[]) => Promise<boolean>;
  generateDailyPlan: (date: string) => Promise<{ draft: unknown } | null>;
  approveDailyPlan: (date: string, priorities?: unknown[]) => Promise<boolean>;

  // ── Report generation ────────────────────────────────────────────────────────
  generateDailyReport: (date: string) => Promise<ApiReport | null>;
  generateWeeklyReport: (year: number, weekNumber: number) => Promise<ApiReport | null>;
  generateMonthlyReport: (year: number, month: number) => Promise<ApiReport | null>;
  generateQuarterlyReport: (year: number, quarter: number) => Promise<ApiReport | null>;
  generateYearlyReport: (year: number) => Promise<ApiReport | null>;

  // ── Modal ───────────────────────────────────────────────────────────────────
  activeModal: ModalType | null;
  modalData: unknown;
  openModal: (type: ModalType, data?: unknown) => void;
  closeModal: () => void;
}

let idCounter = 1000;
const genId = (prefix: string) => `${prefix}-${++idCounter}`;

function requiresServerPersistence(): boolean {
  return isCloudSupabaseConfigured() && !isAuthLocalOnly();
}

const pendingYearlyGoalCreates = new Map<string, Promise<void>>();
const pendingMonthlyGoalCreates = new Map<string, Promise<void>>();
const pendingWeeklyGoalCreates = new Map<string, Promise<void>>();
const pendingDailyPriorityCreates = new Map<string, Promise<void>>();
const pendingSecondaryTaskCreates = new Map<string, Promise<void>>();
const pendingHabitCreates = new Map<string, Promise<void>>();

function trackPendingCreate(
  pendingMap: Map<string, Promise<void>>,
  localId: string,
  promise: Promise<unknown>,
): void {
  const tracked = promise.then(() => undefined, () => undefined).finally(() => {
    if (pendingMap.get(localId) === tracked) {
      pendingMap.delete(localId);
    }
  });
  pendingMap.set(localId, tracked);
}

async function waitForPendingCreates(
  pendingMap: Map<string, Promise<void>>,
  localIds: string[],
): Promise<void> {
  const pending = localIds
    .map((localId) => pendingMap.get(localId))
    .filter((promise): promise is Promise<void> => Boolean(promise));
  if (pending.length) {
    await Promise.all(pending);
  }
}

// Pre-seeded demo user
const DEMO_USER: StoredUser = {
  id: "user-demo",
  name: "Alex Chen",
  email: "alex@executionai.com",
  password: "demo123",
  plan: "Pro",
};

/** Extra logins for product testing (same password). Merged on sign-in/up if missing from persisted store. */
const SEEDED_TEST_USERS: StoredUser[] = [
  { id: "user-test-sarah", name: "Sarah Kim", email: "sarah@test.local", password: "test123", plan: "Free" },
  { id: "user-test-marcus", name: "Marcus Reed", email: "marcus@test.local", password: "test123", plan: "Free" },
  { id: "user-test-nina", name: "Nina Patel", email: "nina@test.local", password: "test123", plan: "Free" },
];

const INITIAL_REGISTERED: StoredUser[] = [DEMO_USER, ...SEEDED_TEST_USERS];

/** Shown on /auth when using local password mode. */
export const LOCAL_TEST_SIGNIN_HINTS: { label: string; email: string; password: string }[] = [
  { label: `${DEMO_USER.name} (demo)`, email: DEMO_USER.email, password: DEMO_USER.password },
  ...SEEDED_TEST_USERS.map((u) => ({ label: u.name, email: u.email, password: u.password })),
];

function mergeSeededRegistryUsers(set: (partial: Partial<AppState>) => void, get: () => AppState) {
  const next = [...get().registeredUsers];
  const has = (email: string) => next.some((r) => r.email.toLowerCase() === email.toLowerCase());
  let changed = false;
  if (!has(DEMO_USER.email)) {
    next.unshift({ ...DEMO_USER });
    changed = true;
  }
  for (const u of SEEDED_TEST_USERS) {
    if (!has(u.email)) {
      next.push({ ...u });
      changed = true;
    }
  }
  if (changed) set({ registeredUsers: next });
}

/**
 * After login: bind workspace to this user, ensure backend session, then pull
 * onboarding metadata + dashboard data in parallel.
 *
 * Critical-path optimisation:
 *   The dashboard layout and onboarding shell both gate their first render on
 *   `workspaceHydrating`. Previously this stayed true through the full chain
 *   (session start → onboarding pull → dashboard load) which meant the user
 *   sat behind a single global spinner for ~3× the round-trip time. We now:
 *     1. block on session start (we need the session id),
 *     2. fan out onboarding pull + dashboard load with Promise.allSettled,
 *     3. release `workspaceHydrating` as soon as onboarding metadata is in
 *        (so the router can pick /dashboard vs /onboarding) — dashboard rows
 *        either appear with the parallel response, or fill in moments later.
 *
 * If session start fails → backendReady false.
 * If only dashboard load fails → keep backendReady true so POST/PATCH saves
 * can still succeed; the failure surfaces via syncError.
 */
async function attachBackendAfterAuth(userId: string, get: () => AppState, set: (p: Partial<AppState>) => void) {
  set({ workspaceHydrating: true });
  const prevOwner = get().workspaceOwnerId ?? null;
  /** Snapshot before any reset — after a full reset `get().onboardingComplete` would wrongly read false. */
  const preservedOnboardingDone = get().onboardingComplete;
  const preservedOnboardingStep = get().onboardingStep;
  const switchingAccount = prevOwner !== null && prevOwner !== userId;
  const serverPersistence = requiresServerPersistence();

  if (switchingAccount) {
    set({
      workspaceOwnerId: userId,
      onboardingComplete: false,
      onboardingStep: 1,
      kickoffPending: false,
      categories: DEFAULT_CATEGORIES,
      yearlyGoals: [],
      monthlyGoals: [],
      weeklyGoals: [],
      dailyPriorities: [],
      secondaryTasks: [],
      habits: [],
      metrics: EMPTY_DASHBOARD_METRICS,
      reports: [],
      sessionWeekStartsOn: "monday",
    });
  } else if (prevOwner === null) {
    set({ workspaceOwnerId: userId });
  }

  let sid: string;
  try {
    sid = await ensureBackendSession(userId);
    set({ sessionId: sid, backendReady: true });
  } catch (e) {
    set({
      backendReady: false,
      syncError: formatApiError("Start backend session", e),
      workspaceHydrating: false,
    });
    return;
  }

  // Fan out: onboarding metadata + dashboard payload land in parallel.
  const onboardingPromise = pullOnboardingFromServer(sid);
  const dashboardPromise = get().loadDashboard();

  // Apply onboarding metadata as soon as it lands so the router can decide
  // /dashboard vs /onboarding without waiting for the dashboard payload.
  try {
    const ob = await onboardingPromise;
    if (ob) {
      const localDone = switchingAccount || serverPersistence ? false : preservedOnboardingDone;
      const localStep = switchingAccount || serverPersistence ? 1 : preservedOnboardingStep;
      const done = Boolean(ob.onboarding_done || localDone);
      const step = done ? 4 : Math.max(ob.onboarding_step, localStep, 1);
      set({
        onboardingComplete: done,
        onboardingStep: step,
        sessionWeekStartsOn: ob.week_starts_on,
      });
      if (done && !ob.onboarding_done) {
        void sessionsApi
          .update(sid, { onboarding_done: true, onboarding_step: 4 })
          .catch(() => {});
      }
    }
  } catch (e) {
    set({ syncError: formatApiError("Load workspace state", e) });
  } finally {
    // Release the gate immediately — any remaining dashboard load runs in
    // the background and updates store state when it resolves.
    set({ workspaceHydrating: false });
  }

  try {
    await dashboardPromise;
    if (!get().syncError) set({ syncError: null });
  } catch (e) {
    set({ syncError: formatApiError("Load dashboard from server", e) });
  }
}

// ─── Mapper helpers: API response → frontend types ────────────────────────────

function mapApiGoalToPriority(p: {
  id: string; title: string; description?: string; date: string;
  status: string; completed: boolean; priority: string; estimated_minutes?: number;
  is_main: boolean; tag?: string; ai_suggested: boolean; weekly_goal_id?: string; editable?: boolean;
}): DailyPriority {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    weeklyGoalId: p.weekly_goal_id,
    date: p.date,
    status: p.status as DailyPriority["status"],
    completed: p.completed,
    priority: p.priority as DailyPriority["priority"],
    estimatedMinutes: p.estimated_minutes,
    isMain: p.is_main,
    tag: p.tag,
    aiSuggested: p.ai_suggested,
    editable: p.editable,
  };
}

function mapApiHabit(h: {
  id: string; name: string; icon: string; frequency: string;
  active: boolean; category_id?: string; completed_today: boolean; streak: number;
}): FoundationalHabit {
  return {
    id: h.id,
    name: h.name,
    icon: h.icon,
    categoryId: h.category_id,
    frequency: h.frequency as FoundationalHabit["frequency"],
    completedToday: h.completed_today,
    streak: h.streak,
    active: h.active,
  };
}

function padWeeklyConsistency(raw: number[] | undefined): number[] {
  const a = (raw ?? []).map((n) =>
    typeof n === "number" && !Number.isNaN(n) ? Math.min(100, Math.max(0, n)) : 0,
  );
  while (a.length < 7) a.push(0);
  return a.slice(0, 7);
}

function mapApiYearlyGoalToStore(g: ApiYearlyGoal): YearlyGoal {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    year: g.year,
    ...(g.category_id ? { categoryId: g.category_id } : {}),
    targetDate: g.target_date,
    status: g.status as YearlyGoal["status"],
    progress: g.progress,
    aiSuggested: g.ai_suggested,
    editable: g.editable,
  };
}

function mapApiMonthlyGoalToStore(g: ApiMonthlyGoal): MonthlyGoal {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    yearlyGoalId: g.yearly_goal_id,
    categoryId: g.category_id,
    targetDate: g.target_date,
    workload: g.workload,
    month: g.month,
    year: g.year,
    status: g.status as MonthlyGoal["status"],
    progress: g.progress,
    priority: g.priority as MonthlyGoal["priority"],
    isMain: g.is_main,
    aiSuggested: g.ai_suggested,
    editable: g.editable,
  };
}

function mapApiWeeklyGoalToStore(g: ApiWeeklyGoal): WeeklyGoal {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    monthlyGoalId: g.monthly_goal_id,
    weekNumber: g.week_number,
    month: g.month,
    year: g.year,
    status: g.status as WeeklyGoal["status"],
    progress: g.progress,
    isMain: g.is_main,
    targetDay: g.target_day,
    goalType: g.goal_type as WeeklyGoal["goalType"],
    workload: g.workload,
    aiSuggested: g.ai_suggested,
    editable: g.editable,
  };
}

function fallbackWeeklyObjectiveText(goals: ApiWeeklyGoal[] | undefined): string {
  if (!goals?.length) return "";
  const mains = goals.filter((g) => g.is_main).map((g) => g.title);
  const titles = mains.length ? mains : goals.map((g) => g.title).filter(Boolean);
  if (!titles.length) return "";
  if (titles.length === 1) return titles[0];
  return `${titles[0]} and ${titles.length - 1} more`;
}

function fallbackMonthlyContextText(goals: ApiMonthlyGoal[] | undefined): string {
  if (!goals?.length) return "";
  const mains = goals.filter((g) => g.is_main).map((g) => g.title);
  const titles = mains.length ? mains : goals.map((g) => g.title).filter(Boolean);
  if (!titles.length) return "";
  if (titles.length === 1) return titles[0];
  return `${titles[0]} (+${titles.length - 1} more)`;
}

function mapDashboardToStore(
  data: ApiDashboard,
  prev: { yearlyGoals: YearlyGoal[]; monthlyGoals: MonthlyGoal[]; weeklyGoals: WeeklyGoal[] },
) {
  const dailyPriorities = data.daily_priorities.map(mapApiGoalToPriority);
  const secondaryTasks = data.secondary_tasks.map(mapApiGoalToPriority);
  const habits = data.habits.map(mapApiHabit);
  const y = data.year;
  const mo = data.month;
  const wn = data.week_number;

  const yearlyGoals =
    data.yearly_goals !== undefined
      ? [...prev.yearlyGoals.filter((g) => g.year !== y), ...data.yearly_goals.map(mapApiYearlyGoalToStore)]
      : prev.yearlyGoals;

  const monthlyGoals =
    data.monthly_context !== undefined
      ? [
          ...prev.monthlyGoals.filter((goal) => !(goal.year === y && goal.month === mo)),
          ...data.monthly_context.map(mapApiMonthlyGoalToStore),
        ]
      : prev.monthlyGoals;

  const weeklyGoals =
    data.weekly_goals !== undefined
      ? [
          ...prev.weeklyGoals.filter((goal) => !(goal.year === y && goal.weekNumber === wn)),
          ...data.weekly_goals.map(mapApiWeeklyGoalToStore),
        ]
      : prev.weeklyGoals;

  const metrics: DashboardMetrics = {
    executionStreak: data.metrics.execution_streak ?? 0,
    yesterdayCompletion: data.metrics.yesterday_completion ?? 0,
    weeklyConsistency: padWeeklyConsistency(data.metrics.weekly_consistency),
    weeklyObjective:
      (data.weekly_objective && data.weekly_objective.trim()) ||
      fallbackWeeklyObjectiveText(data.weekly_goals),
    monthlyContext:
      (data.monthly_context_text && data.monthly_context_text.trim()) ||
      fallbackMonthlyContextText(data.monthly_context),
    tasksCompletedToday: data.metrics.tasks_completed_today,
    tasksTotalToday: data.metrics.tasks_total_today,
    habitsCompletedToday: data.metrics.habits_completed_today,
    habitsTotalToday: data.metrics.habits_total_today,
    weeklyCompletionRate: data.metrics.weekly_completion_rate,
    monthlyCompletionRate: data.metrics.monthly_completion_rate,
  };

  return {
    dailyPriorities,
    secondaryTasks,
    habits,
    metrics,
    yearlyGoals,
    monthlyGoals,
    weeklyGoals,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Auth ────────────────────────────────────────────────────────────────
      currentUser: null,
      authReady: false,
      registeredUsers: INITIAL_REGISTERED,

      signIn: async (email, password) => {
        mergeSeededRegistryUsers(set, get);
        const em = email.toLowerCase().trim();
        const users = get().registeredUsers;
        const match = users.find((u) => u.email.toLowerCase() === em && u.password === password);
        if (match) {
          const user = { id: match.id, name: match.name, email: match.email, plan: match.plan };
          set({ currentUser: user, syncError: null, authReady: true, workspaceHydrating: true });
          await attachBackendAfterAuth(match.id, get, set);
          return { success: true };
        }

        const sb = getSupabaseBrowser();
        if (isAuthLocalOnly() || !sb) {
          return {
            success: false,
            error: isAuthLocalOnly()
              ? "Invalid email or password. Use a test account from the list below or sign up with any email + password."
              : "Invalid email or password, or configure Supabase (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY) for cloud accounts.",
          };
        }
        if (isCloudOtpAuthEnabled()) {
          return {
            success: false,
            error: "Cloud accounts use an email code. Enter your email and tap “Send code”.",
          };
        }
        const { data, error } = await sb.auth.signInWithPassword({ email: em, password });
        if (error || !data.user) {
          return { success: false, error: error?.message ?? "Sign in failed." };
        }
        const u = data.user;
        const mail = u.email ?? em;
        const meta = u.user_metadata as { full_name?: string } | undefined;
        const user: AuthUser = {
          id: u.id,
          name: (meta?.full_name as string | undefined)?.trim() || mail.split("@")[0] || "User",
          email: mail,
          plan: "Free",
        };
        set({ currentUser: user, syncError: null, authReady: true, workspaceHydrating: true });
        await attachBackendAfterAuth(u.id, get, set);
        return { success: true };
      },

      signUp: async (name, email, password) => {
        mergeSeededRegistryUsers(set, get);
        const em = email.toLowerCase().trim();
        const users = get().registeredUsers;
        if (users.some((u) => u.email.toLowerCase() === em)) {
          return { success: false, error: "An account with this email already exists (demo registry)." };
        }

        const sb = getSupabaseBrowser();
        if (isAuthLocalOnly() || !sb) {
          const newUser: StoredUser = { id: genId("user"), name: name.trim(), email: em, password, plan: "Free" };
          const authUser = { id: newUser.id, name: newUser.name, email: newUser.email, plan: newUser.plan };
          set({
            registeredUsers: [...get().registeredUsers, newUser],
            currentUser: authUser,
            onboardingComplete: false,
            onboardingStep: 1,
            kickoffPending: false,
            categories: DEFAULT_CATEGORIES,
            yearlyGoals: [],
            monthlyGoals: [],
            weeklyGoals: [],
            dailyPriorities: [],
            secondaryTasks: [],
            habits: [],
            metrics: EMPTY_DASHBOARD_METRICS,
            reports: [],
            syncError: null,
            authReady: true,
            workspaceHydrating: true,
          });
          await attachBackendAfterAuth(newUser.id, get, set);
          return { success: true };
        }

        if (isCloudOtpAuthEnabled()) {
          return {
            success: false,
            error: "Cloud sign-up uses a 6-digit email code. Use “Send code” on the sign-up tab.",
          };
        }

        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { data, error } = await sb.auth.signUp({
          email: em,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
          },
        });
        if (error) {
          const raw = error.message ?? "";
          if (/confirmation email|sending confirmation/i.test(raw)) {
            return {
              success: false,
              error:
                "Supabase could not send the confirmation email. Fix it in the Supabase Dashboard: Authentication → Providers → Email — turn off “Confirm email” for local dev, or Project Settings → Authentication → set up Custom SMTP (e.g. Resend). Docs: https://supabase.com/docs/guides/auth/auth-smtp",
            };
          }
          return { success: false, error: raw };
        }
        if (!data.user?.email) return { success: false, error: "Sign up failed." };

        if (!data.session) {
          return {
            success: true,
            needsEmailConfirmation: true,
          };
        }

        const u = data.user;
        const authUser: AuthUser = {
          id: u.id,
          name: name.trim(),
          email: u.email ?? em,
          plan: "Free",
        };
        set({
          currentUser: authUser,
          onboardingComplete: false,
          onboardingStep: 1,
          kickoffPending: false,
          categories: DEFAULT_CATEGORIES,
          yearlyGoals: [],
          monthlyGoals: [],
          weeklyGoals: [],
          dailyPriorities: [],
          secondaryTasks: [],
          habits: [],
          metrics: EMPTY_DASHBOARD_METRICS,
          reports: [],
          syncError: null,
          authReady: true,
          workspaceHydrating: true,
        });
        await attachBackendAfterAuth(u.id, get, set);
        return { success: true };
      },

      sendEmailOtp: async (email, opts) => {
        if (isAuthLocalOnly()) return { success: false, error: "Local test mode uses password sign-in, not email codes." };
        const sb = getSupabaseBrowser();
        if (!sb) return { success: false, error: "Supabase is not configured." };
        const em = email.toLowerCase().trim();
        // Do not pass `options.data` here: with `user_metadata` on first OTP, GoTrue may send the
        // "Confirm sign up" email instead of the Magic link flow — teams often only add {{ .Token }}
        // to Magic link. Name is applied after verify via updateUser.
        const { error } = await sb.auth.signInWithOtp({
          email: em,
          options: {
            shouldCreateUser: opts.intent === "signup",
          },
        });
        if (error) {
          const msg = error.message;
          const mailDown =
            /confirmation email|error sending|smtp|mailer|email.*fail/i.test(msg) ||
            error.status === 500;
          return {
            success: false,
            error: mailDown
              ? `${msg} Check Supabase → Authentication → SMTP (Resend API key, sender domain DNS) and the Resend dashboard for errors.`
              : msg,
          };
        }
        return { success: true };
      },

      verifyEmailOtp: async (email, token, opts) => {
        if (isAuthLocalOnly()) return { success: false, error: "Local test mode uses password sign-in, not email codes." };
        const sb = getSupabaseBrowser();
        if (!sb) return { success: false, error: "Supabase is not configured." };
        const em = email.toLowerCase().trim();
        const clean = token.replace(/\D/g, "");
        if (clean.length !== 6) {
          return { success: false, error: "Enter the 6-digit code from your email." };
        }

        const tryTypes =
          opts.intent === "signup"
            ? (["signup", "email"] as const)
            : (["email", "signup"] as const);

        let data: Awaited<ReturnType<typeof sb.auth.verifyOtp>>["data"] | null = null;
        let lastMessage = "Invalid or expired code.";
        for (const type of tryTypes) {
          const res = await sb.auth.verifyOtp({
            email: em,
            token: clean,
            type,
          });
          if (!res.error && res.data.user) {
            data = res.data;
            break;
          }
          if (res.error?.message) lastMessage = res.error.message;
        }
        if (!data?.user) {
          return { success: false, error: lastMessage };
        }

        let u = data.user;
        const fn = opts.fullName?.trim();
        if (fn && opts.intent === "signup") {
          const { data: upd, error: metaErr } = await sb.auth.updateUser({ data: { full_name: fn } });
          if (!metaErr && upd.user) u = upd.user;
        }
        const authUser = authUserFromSupabase(u, opts.fullName);

        if (opts.intent === "signup") {
          set({
            currentUser: authUser,
            onboardingComplete: false,
            onboardingStep: 1,
            kickoffPending: false,
            categories: DEFAULT_CATEGORIES,
            yearlyGoals: [],
            monthlyGoals: [],
            weeklyGoals: [],
            dailyPriorities: [],
            secondaryTasks: [],
            habits: [],
            metrics: EMPTY_DASHBOARD_METRICS,
            reports: [],
            syncError: null,
            authReady: true,
            workspaceHydrating: true,
          });
        } else {
          set({ currentUser: authUser, syncError: null, authReady: true, workspaceHydrating: true });
        }

        await attachBackendAfterAuth(u.id, get, set);
        return { success: true };
      },

      signOut: async () => {
        const user = get().currentUser;
        if (user && user.id !== DEMO_USER.id) {
          await getSupabaseBrowser()?.auth.signOut();
        }
        if (user) clearSessionId(user.id);
        set({
          currentUser: null,
          sessionId: null,
          sessionWeekStartsOn: "monday",
          activeDashboardDate: getToday(),
          backendReady: false,
          workspaceHydrating: false,
          syncError: null,
          authReady: true,
        });
      },

      hydrateAuthFromSupabase: async () => {
        const sb = getSupabaseBrowser();
        if (!sb || isAuthLocalOnly()) {
          set({ authReady: true, workspaceHydrating: false });
          return;
        }
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session?.user?.email) {
          set({
            currentUser: null,
            sessionId: null,
            sessionWeekStartsOn: "monday",
            activeDashboardDate: getToday(),
            backendReady: false,
            workspaceHydrating: false,
            syncError: null,
            authReady: true,
          });
          return;
        }
        const u = session.user;
        const authUser = authUserFromSupabase(u);
        const state = get();
        const sameUser = state.currentUser?.id === authUser.id;
        if (sameUser && state.workspaceHydrating) {
          set({ authReady: true });
          return;
        }
        if (sameUser && state.backendReady && state.sessionId) {
          set({ authReady: true, currentUser: authUser, syncError: null });
          return;
        }
        set({ currentUser: authUser, syncError: null, workspaceHydrating: true });
        try {
          await attachBackendAfterAuth(u.id, get, set);
        } finally {
          set({ authReady: true });
        }
      },

      sendPasswordReset: async (email) => {
        if (isAuthLocalOnly()) {
          return { success: false, error: "Password reset is not used in local test mode." };
        }
        const sb = getSupabaseBrowser();
        if (!sb) {
          return { success: false, error: "Configure Supabase environment variables to reset passwords." };
        }
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: origin ? `${origin}/auth/update-password` : undefined,
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
      },

      // ── Backend session ──────────────────────────────────────────────────────
      sessionId: null,
      sessionWeekStartsOn: "monday",
      backendReady: false,
      workspaceHydrating: false,
      workspaceOwnerId: null,
      activeDashboardDate: getToday(),
      setSessionId: (id) => set({ sessionId: id }),
      setActiveDashboardDate: (date) => set({ activeDashboardDate: date }),
      setWeekStartsOn: async (value) => {
        const { sessionId, backendReady, sessionWeekStartsOn } = get();
        if (value === sessionWeekStartsOn) return;
        set({ sessionWeekStartsOn: value });
        if (!sessionId || !backendReady) {
          return;
        }
        try {
          const session = await sessionsApi.update(sessionId, { week_starts_on: value });
          set({ sessionWeekStartsOn: session.week_starts_on, syncError: null });
          await get().loadDashboard();
        } catch (e) {
          set({
            sessionWeekStartsOn,
            syncError: formatApiError("Save week start preference", e),
          });
        }
      },
      syncError: null,
      syncStatus: "idle",
      clearSyncError: () => set({ syncError: null }),

      // ── Onboarding ──────────────────────────────────────────────────────────
      onboardingStep: 1,
      onboardingComplete: false,
      kickoffPending: false,
      setOnboardingStep: (step) => {
        set({ onboardingStep: step });
        const { sessionId, backendReady } = get();
        if (sessionId && backendReady) {
          void sessionsApi
            .update(sessionId, { onboarding_step: step })
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Save onboarding step", e) }));
        }
      },
      completeOnboarding: async () => {
        const { sessionId, backendReady } = get();
        if (sessionId && backendReady) {
          try {
            await sessionsApi.update(sessionId, { onboarding_done: true, onboarding_step: 4 });
            set({ onboardingComplete: true, kickoffPending: true, onboardingStep: 4, syncError: null });
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Complete onboarding on server", e) });
            return false;
          }
        }
        if (requiresServerPersistence()) {
          set({ syncError: "Complete onboarding on server: Backend session is not ready." });
          return false;
        }
        set({ onboardingComplete: true, kickoffPending: true, onboardingStep: 4 });
        return true;
      },
      dismissKickoff: () => set({ kickoffPending: false }),

      // ── Initial data (production: empty until user + server populate) ───────
      categories: DEFAULT_CATEGORIES,
      yearlyGoals: [],
      monthlyGoals: [],
      weeklyGoals: [],
      dailyPriorities: [],
      secondaryTasks: [],
      habits: [],
      metrics: EMPTY_DASHBOARD_METRICS,
      reports: [],

      // ── Backend sync ─────────────────────────────────────────────────────────
      loadDashboard: async (planDate) => {
        const { sessionId, activeDashboardDate } = get();
        if (!sessionId) return;
        const requestedDate = planDate ?? activeDashboardDate;
        try {
          const [data, categories] = await Promise.all([
            dashboardApi.get(sessionId, requestedDate),
            categoriesApi.list(sessionId).catch(() => null),
          ]);
          set((s) => ({
            ...s,
            ...(
              categories
                ? categories.length > 0 || s.onboardingComplete || s.categories.length === 0
                  ? { categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })) }
                  : {}
                : {}
            ),
            ...mapDashboardToStore(data, {
              yearlyGoals: s.yearlyGoals,
              monthlyGoals: s.monthlyGoals,
              weeklyGoals: s.weeklyGoals,
            }),
            activeDashboardDate: data.today,
            syncError: null,
          }));
        } catch (e) {
          set({ syncError: formatApiError("Load dashboard from server", e) });
        }
      },

      syncReports: async () => {
        const { sessionId } = get();
        if (!sessionId) return;
        try {
          const reports = await reportsApi.list(sessionId);
          set({ reports, syncError: null });
        } catch (e) {
          set({ syncError: formatApiError("Load reports list", e) });
        }
      },

      // ── Categories ──────────────────────────────────────────────────────────
      addCategory: (cat) => {
        const localId = genId("cat");
        set((s) => ({ categories: [...s.categories, { ...cat, id: localId }] }));
        // Sync to backend (fire-and-forget)
        const { sessionId } = get();
        if (sessionId) {
          categoriesApi
            .create(sessionId, { name: cat.name, icon: cat.icon, color: cat.color })
            .then((created) => {
              set((s) => ({
                categories: s.categories.map((c) => (c.id === localId ? { ...c, id: created.id } : c)),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save category", e) }));
        }
      },
      removeCategory: (id) => {
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          categoriesApi.delete(sessionId, id).catch((e) => set({ syncError: formatApiError("Delete category", e) }));
        }
      },

      // ── Yearly goals ────────────────────────────────────────────────────────
      addYearlyGoal: (goal) => {
        const localId = genId("yg");
        set((s) => ({ yearlyGoals: [...s.yearlyGoals, { ...goal, id: localId }] }));
        const { sessionId } = get();
        if (sessionId) {
          const request = yearlyGoalsApi
            .create(sessionId, {
              title: goal.title,
              ...(isUuid(goal.categoryId) ? { category_id: goal.categoryId } : {}),
              description: goal.description,
              year: goal.year,
              target_date: goal.targetDate,
            })
            .then((created) => {
              set((s) => ({
                yearlyGoals: s.yearlyGoals.map((g) =>
                  g.id === localId ? { ...g, id: created.id, categoryId: created.category_id ?? g.categoryId } : g
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save yearly goal", e) }));
          trackPendingCreate(pendingYearlyGoalCreates, localId, request);
        }
      },
      updateYearlyGoal: (id, updates) => {
        set((s) => ({
          yearlyGoals: s.yearlyGoals.map((g) => g.id === id ? { ...g, ...updates } : g),
        }));
        const { sessionId } = get();
        if (!sessionId || !isUuid(id)) return;
        const patch: Parameters<typeof yearlyGoalsApi.update>[2] = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) patch.description = updates.description;
        if (updates.status !== undefined) patch.status = updates.status;
        if (updates.progress !== undefined) patch.progress = updates.progress;
        if (updates.targetDate !== undefined) patch.target_date = updates.targetDate;
        if (updates.categoryId !== undefined && isUuid(updates.categoryId)) {
          patch.category_id = updates.categoryId;
        }
        if (Object.keys(patch).length) {
          yearlyGoalsApi
            .update(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update yearly goal", e) }));
        }
      },
      syncYearlyGoalsToServer: async () => {
        const { sessionId, yearlyGoals } = get();
        if (!sessionId) {
          if (requiresServerPersistence()) {
            set({ syncError: "Sync yearly goals: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          return true;
        }
        set({ syncStatus: "saving" });
        const localIds = yearlyGoals
          .filter((g) => g.year === getCurrentYear() && !isUuid(g.id))
          .map((g) => g.id);
        await waitForPendingCreates(pendingYearlyGoalCreates, localIds);
        const pending = get().yearlyGoals.filter((g) => g.year === getCurrentYear() && !isUuid(g.id));
        for (const g of pending) {
          try {
            const created = await yearlyGoalsApi.create(sessionId, {
              title: g.title,
              ...(isUuid(g.categoryId) ? { category_id: g.categoryId } : {}),
              description: g.description,
              year: g.year,
              target_date: g.targetDate,
            });
            set((s) => ({
              yearlyGoals: s.yearlyGoals.map((yg) =>
                yg.id === g.id ? { ...yg, id: created.id, categoryId: created.category_id ?? yg.categoryId } : yg,
              ),
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync yearly goal "${g.title}"`, e), syncStatus: "failed" });
            return false;
          }
        }
        const stillLocal = get().yearlyGoals.filter((g) => g.year === getCurrentYear() && !isUuid(g.id));
        if (stillLocal.length > 0) {
          set({
            syncError: `${stillLocal.length} yearly goal(s) could not be synced (still local-only). Check your connection and try again.`,
            syncStatus: "failed",
          });
          return false;
        }
        try {
          const serverGoals = await yearlyGoalsApi.list(sessionId, getCurrentYear());
          set((s) => ({
            yearlyGoals: [
              ...s.yearlyGoals.filter((goal) => goal.year !== getCurrentYear()),
              ...serverGoals.map(mapApiYearlyGoalToStore),
            ],
            syncError: null,
            syncStatus: "saved",
          }));
        } catch (e) {
          set({ syncError: formatApiError("Verify yearly goals on server", e), syncStatus: "failed" });
          return false;
        }
        return true;
      },

      syncMonthlyGoalsToServer: async (year, month) => {
        const { sessionId, monthlyGoals } = get();
        if (!sessionId) {
          if (requiresServerPersistence()) {
            set({ syncError: "Sync monthly goals: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          return true;
        }
        set({ syncStatus: "saving" });
        const localIds = monthlyGoals
          .filter((g) => g.year === year && g.month === month && !isUuid(g.id))
          .map((g) => g.id);
        await waitForPendingCreates(pendingMonthlyGoalCreates, localIds);
        const pending = get().monthlyGoals.filter((g) => g.year === year && g.month === month && !isUuid(g.id));
        let success = true;
        for (const g of pending) {
          try {
            const created = await monthlyPlanApi.addGoal(sessionId, year, month, {
              title: g.title,
              description: g.description,
              is_main: g.isMain,
              priority: g.priority,
              ...(isUuid(g.yearlyGoalId) ? { yearly_goal_id: g.yearlyGoalId } : {}),
              ...(isUuid(g.categoryId) ? { category_id: g.categoryId } : {}),
              target_date: g.targetDate,
              workload: g.workload,
            });
            set((s) => ({
              monthlyGoals: s.monthlyGoals.map((mg) =>
                mg.id === g.id ? { ...mg, id: created.id, yearlyGoalId: created.yearly_goal_id ?? mg.yearlyGoalId } : mg
              ),
              syncError: null,
              syncStatus: "saved",
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync monthly goal "${g.title}"`, e), syncStatus: "failed" });
            success = false;
            break;
          }
        }
        if (success) set({ syncError: null, syncStatus: "saved" });
        return success;
      },

      syncWeeklyGoalsToServer: async (year, weekNumber) => {
        const { sessionId, weeklyGoals } = get();
        if (!sessionId) {
          if (requiresServerPersistence()) {
            set({ syncError: "Sync weekly goals: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          return true;
        }
        set({ syncStatus: "saving" });
        const localIds = weeklyGoals
          .filter((g) => g.year === year && g.weekNumber === weekNumber && !isUuid(g.id))
          .map((g) => g.id);
        await waitForPendingCreates(pendingWeeklyGoalCreates, localIds);
        const pending = get().weeklyGoals.filter((g) => g.year === year && g.weekNumber === weekNumber && !isUuid(g.id));
        let success = true;
        for (const g of pending) {
          try {
            const created = await weeklyPlanApi.addGoal(sessionId, year, weekNumber, {
              title: g.title,
              description: g.description,
              is_main: g.isMain,
              ...(isUuid(g.monthlyGoalId) ? { monthly_goal_id: g.monthlyGoalId } : {}),
              target_day: g.targetDay,
              goal_type: g.goalType,
              workload: g.workload,
            });
            set((s) => ({
              weeklyGoals: s.weeklyGoals.map((wg) =>
                wg.id === g.id ? { ...wg, id: created.id, monthlyGoalId: created.monthly_goal_id ?? wg.monthlyGoalId } : wg
              ),
              syncError: null,
              syncStatus: "saved",
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync weekly goal "${g.title}"`, e), syncStatus: "failed" });
            success = false;
            break;
          }
        }
        if (success) set({ syncError: null, syncStatus: "saved" });
        return success;
      },
      removeYearlyGoal: (id) => {
        set((s) => ({ yearlyGoals: s.yearlyGoals.filter((g) => g.id !== id) }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          yearlyGoalsApi
            .delete(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete yearly goal", e) }));
        }
      },

      // ── Monthly goals ────────────────────────────────────────────────────────
      addMonthlyGoal: (goal) => {
        const localId = genId("mg");
        set((s) => ({ monthlyGoals: [...s.monthlyGoals, { ...goal, id: localId }] }));
        const { sessionId } = get();
        if (sessionId) {
          const request = monthlyPlanApi
            .addGoal(sessionId, goal.year, goal.month, {
              title: goal.title,
              description: goal.description,
              is_main: goal.isMain,
              priority: goal.priority,
              ...(isUuid(goal.yearlyGoalId) ? { yearly_goal_id: goal.yearlyGoalId } : {}),
              ...(isUuid(goal.categoryId) ? { category_id: goal.categoryId } : {}),
              target_date: goal.targetDate,
              workload: goal.workload,
            })
            .then((created) => {
              set((s) => ({
                monthlyGoals: s.monthlyGoals.map((g) =>
                  g.id === localId
                    ? {
                        ...g,
                        id: created.id,
                        yearlyGoalId: created.yearly_goal_id ?? g.yearlyGoalId,
                      }
                    : g
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save monthly goal", e) }));
          trackPendingCreate(pendingMonthlyGoalCreates, localId, request);
        }
      },
      updateMonthlyGoal: (id, updates) => {
        set((s) => ({
          monthlyGoals: s.monthlyGoals.map((g) => {
            if (g.id !== id) return g;
            const merged: MonthlyGoal = { ...g, ...updates };
            if (updates.description !== undefined) {
              merged.description = updates.description ? updates.description : undefined;
            }
            if (updates.workload !== undefined) {
              merged.workload = updates.workload ? updates.workload : undefined;
            }
            return merged;
          }),
        }));
        const { sessionId } = get();
        if (!sessionId || !isUuid(id)) return;
        const patch: Parameters<typeof monthlyPlanApi.updateGoal>[2] = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) {
          patch.description = updates.description ? updates.description : undefined;
        }
        if (updates.status !== undefined) patch.status = updates.status;
        if (updates.progress !== undefined) patch.progress = updates.progress;
        if (updates.targetDate !== undefined) patch.target_date = updates.targetDate;
        if (updates.workload !== undefined) {
          patch.workload = updates.workload ? updates.workload : undefined;
        }
        if (updates.priority !== undefined) patch.priority = updates.priority;
        if (updates.isMain !== undefined) patch.is_main = updates.isMain;
        if (updates.categoryId !== undefined && isUuid(updates.categoryId)) {
          patch.category_id = updates.categoryId;
        }
        if (updates.yearlyGoalId !== undefined) {
          patch.yearly_goal_id = isUuid(updates.yearlyGoalId) ? updates.yearlyGoalId : undefined;
        }
        if (Object.keys(patch).length) {
          monthlyPlanApi
            .updateGoal(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update monthly goal", e) }));
        }
      },
      removeMonthlyGoal: (id) => {
        set((s) => ({ monthlyGoals: s.monthlyGoals.filter((g) => g.id !== id) }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          monthlyPlanApi
            .deleteGoal(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete monthly goal", e) }));
        }
      },

      // ── Weekly goals ─────────────────────────────────────────────────────────
      addWeeklyGoal: (goal) => {
        const localId = genId("wg");
        set((s) => ({ weeklyGoals: [...s.weeklyGoals, { ...goal, id: localId }] }));
        const { sessionId } = get();
        if (sessionId) {
          const request = weeklyPlanApi
            .addGoal(sessionId, goal.year, goal.weekNumber, {
              title: goal.title,
              description: goal.description,
              is_main: goal.isMain,
              ...(isUuid(goal.monthlyGoalId) ? { monthly_goal_id: goal.monthlyGoalId } : {}),
              target_day: goal.targetDay,
              goal_type: goal.goalType,
              workload: goal.workload,
            })
            .then((created) => {
              set((s) => ({
                weeklyGoals: s.weeklyGoals.map((g) =>
                  g.id === localId
                    ? {
                        ...g,
                        id: created.id,
                        monthlyGoalId: created.monthly_goal_id ?? g.monthlyGoalId,
                      }
                    : g
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save weekly goal", e) }));
          trackPendingCreate(pendingWeeklyGoalCreates, localId, request);
        }
      },
      updateWeeklyGoal: (id, updates) => {
        set((s) => ({
          weeklyGoals: s.weeklyGoals.map((g) => {
            if (g.id !== id) return g;
            const merged: WeeklyGoal = { ...g, ...updates };
            if (updates.description !== undefined) {
              merged.description = updates.description ? updates.description : undefined;
            }
            if (updates.workload !== undefined) {
              merged.workload = updates.workload ? updates.workload : undefined;
            }
            return merged;
          }),
        }));
        const { sessionId } = get();
        if (!sessionId || !isUuid(id)) return;
        const patch = {} as Parameters<typeof weeklyPlanApi.updateGoal>[2];
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) {
          patch.description = updates.description ? updates.description : undefined;
        }
        if (updates.status !== undefined) patch.status = updates.status;
        if (updates.progress !== undefined) patch.progress = updates.progress;
        if (updates.targetDay !== undefined) patch.target_day = updates.targetDay;
        if (updates.goalType !== undefined) patch.goal_type = updates.goalType;
        if (updates.workload !== undefined) {
          patch.workload = updates.workload ? updates.workload : undefined;
        }
        if (updates.monthlyGoalId !== undefined) {
          patch.monthly_goal_id = isUuid(updates.monthlyGoalId) ? updates.monthlyGoalId : undefined;
        }
        if (Object.keys(patch).length) {
          weeklyPlanApi
            .updateGoal(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update weekly goal", e) }));
        }
      },
      removeWeeklyGoal: (id) => {
        set((s) => ({ weeklyGoals: s.weeklyGoals.filter((g) => g.id !== id) }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          weeklyPlanApi
            .deleteGoal(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete weekly goal", e) }));
        }
      },

      // ── Daily priorities ──────────────────────────────────────────────────────
      addDailyPriority: (priority) => {
        const localId = genId("dp");
        set((s) => ({ dailyPriorities: [...s.dailyPriorities, { ...priority, id: localId }] }));
        const { sessionId } = get();
        if (sessionId) {
          const request = tasksApi
            .create(sessionId, priority.date, {
              title: priority.title,
              description: priority.description,
              priority: priority.priority,
              is_main: priority.isMain,
              estimated_minutes: priority.estimatedMinutes,
              tag: priority.tag,
              ...(isUuid(priority.weeklyGoalId) ? { weekly_goal_id: priority.weeklyGoalId } : {}),
            })
            .then((created) => {
              set((s) => ({
                dailyPriorities: s.dailyPriorities.map((p) =>
                  p.id === localId ? { ...p, id: created.id, weeklyGoalId: created.weekly_goal_id ?? p.weeklyGoalId } : p
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save daily priority", e) }));
          trackPendingCreate(pendingDailyPriorityCreates, localId, request);
        }
      },
      updateDailyPriority: (id, updates) => {
        set((s) => ({
          dailyPriorities: s.dailyPriorities.map((p) => {
            if (p.id !== id) return p;
            const merged: DailyPriority = { ...p, ...updates };
            if (updates.description !== undefined) {
              merged.description = updates.description ? updates.description : undefined;
            }
            return merged;
          }),
        }));
        const { sessionId } = get();
        if (!sessionId || !isUuid(id)) return;
        const patch: Record<string, string | number | null> = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) {
          patch.description = updates.description ? updates.description : "";
        }
        if (updates.estimatedMinutes !== undefined) patch.estimated_minutes = updates.estimatedMinutes;
        if (updates.priority !== undefined) patch.priority = updates.priority;
        if (updates.tag !== undefined) patch.tag = updates.tag ?? "";
        if (updates.weeklyGoalId !== undefined) {
          patch.weekly_goal_id = isUuid(updates.weeklyGoalId) ? updates.weeklyGoalId : null;
        }
        if (Object.keys(patch).length) {
          tasksApi
            .update(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update daily priority", e) }));
        }
      },
      toggleDailyPriority: (id) => {
        const priority = get().dailyPriorities.find((p) => p.id === id);
        const newCompleted = !priority?.completed;
        set((s) => ({
          dailyPriorities: s.dailyPriorities.map((p) =>
            p.id === id ? { ...p, completed: !p.completed } : p
          ),
        }));
        // Sync to backend
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          tasksApi
            .toggleStatus(sessionId, id, newCompleted!)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update task completion", e) }));
        }
      },
      removeDailyPriority: (id) =>
        set((s) => ({ dailyPriorities: s.dailyPriorities.filter((p) => p.id !== id) })),

      // ── Secondary tasks ───────────────────────────────────────────────────────
      addSecondaryTask: (task) => {
        const localId = genId("st");
        set((s) => ({ secondaryTasks: [...s.secondaryTasks, { ...task, id: localId }] }));
        const { sessionId } = get();
        if (sessionId) {
          const request = tasksApi
            .create(sessionId, task.date, {
              title: task.title,
              description: task.description,
              priority: task.priority,
              is_main: false,
              estimated_minutes: task.estimatedMinutes,
              tag: task.tag,
              ...(isUuid(task.weeklyGoalId) ? { weekly_goal_id: task.weeklyGoalId } : {}),
            })
            .then((created) => {
              set((s) => ({
                secondaryTasks: s.secondaryTasks.map((t) =>
                  t.id === localId ? { ...t, id: created.id, weeklyGoalId: created.weekly_goal_id ?? t.weeklyGoalId } : t
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save secondary task", e) }));
          trackPendingCreate(pendingSecondaryTaskCreates, localId, request);
        }
      },
      updateSecondaryTask: (id, updates) => {
        set((s) => ({
          secondaryTasks: s.secondaryTasks.map((t) => {
            if (t.id !== id) return t;
            const merged: DailyPriority = { ...t, ...updates };
            if (updates.description !== undefined) {
              merged.description = updates.description ? updates.description : undefined;
            }
            return merged;
          }),
        }));
        const { sessionId } = get();
        if (!sessionId || !isUuid(id)) return;
        const patch: Record<string, string | number | null> = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) {
          patch.description = updates.description ? updates.description : "";
        }
        if (updates.estimatedMinutes !== undefined) patch.estimated_minutes = updates.estimatedMinutes;
        if (updates.priority !== undefined) patch.priority = updates.priority;
        if (updates.tag !== undefined) patch.tag = updates.tag ?? "";
        if (updates.weeklyGoalId !== undefined) {
          patch.weekly_goal_id = isUuid(updates.weeklyGoalId) ? updates.weeklyGoalId : null;
        }
        if (Object.keys(patch).length) {
          tasksApi
            .update(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update secondary task", e) }));
        }
      },
      toggleSecondaryTask: (id) => {
        const task = get().secondaryTasks.find((t) => t.id === id);
        const newCompleted = !task?.completed;
        set((s) => ({
          secondaryTasks: s.secondaryTasks.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
          ),
        }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          tasksApi
            .toggleStatus(sessionId, id, newCompleted!)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update secondary task", e) }));
        }
      },
      removeSecondaryTask: (id) =>
        set((s) => ({ secondaryTasks: s.secondaryTasks.filter((t) => t.id !== id) })),

      // ── Habits ───────────────────────────────────────────────────────────────
      toggleHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        const newCompleted = !habit?.completedToday;
        const { activeDashboardDate } = get();
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, completedToday: !h.completedToday } : h
          ),
        }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          habitsApi
            .toggle(sessionId, id, newCompleted!, activeDashboardDate)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update habit completion", e) }));
        }
      },
      updateHabit: (id, updates) => {
        set((s) => ({
          habits: s.habits.map((h) => h.id === id ? { ...h, ...updates } : h),
        }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          const hPatch: Parameters<typeof habitsApi.update>[2] = {};
          if (updates.name !== undefined) hPatch.name = updates.name;
          if (updates.icon !== undefined) hPatch.icon = updates.icon;
          if (updates.frequency !== undefined) hPatch.frequency = updates.frequency;
          if (updates.active !== undefined) hPatch.active = updates.active;
          if (updates.categoryId !== undefined && isUuid(updates.categoryId)) {
            hPatch.category_id = updates.categoryId;
          }
          if (Object.keys(hPatch).length) {
            habitsApi
              .update(sessionId, id, hPatch)
              .then(() => set({ syncError: null }))
              .catch((e) => set({ syncError: formatApiError("Update habit", e) }));
          }
        }
      },
      addHabit: (habit) => {
        const localId = genId("hab");
        set((s) => ({ habits: [...s.habits, { ...habit, id: localId }] }));
        const { sessionId } = get();
        if (sessionId) {
          const request = habitsApi
            .create(sessionId, {
              name: habit.name,
              icon: habit.icon,
              frequency: habit.frequency,
              ...(isUuid(habit.categoryId) ? { category_id: habit.categoryId } : {}),
            })
            .then((created) => {
              set((s) => ({
                habits: s.habits.map((h) =>
                  h.id === localId
                    ? { ...h, id: created.id, categoryId: created.category_id ?? h.categoryId }
                    : h
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save habit", e) }));
          trackPendingCreate(pendingHabitCreates, localId, request);
        }
      },
      removeHabit: (id) => {
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          habitsApi
            .delete(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete habit", e) }));
        }
      },

      syncDailySetupToServer: async (planDate) => {
        const { sessionId, dailyPriorities, secondaryTasks, habits } = get();
        if (!sessionId) {
          if (requiresServerPersistence()) {
            set({ syncError: "Sync daily setup: Backend session is not ready." });
            return false;
          }
          return true;
        }

        await waitForPendingCreates(
          pendingDailyPriorityCreates,
          dailyPriorities.filter((item) => item.date === planDate && !isUuid(item.id)).map((item) => item.id),
        );
        await waitForPendingCreates(
          pendingSecondaryTaskCreates,
          secondaryTasks.filter((item) => item.date === planDate && !isUuid(item.id)).map((item) => item.id),
        );
        await waitForPendingCreates(
          pendingHabitCreates,
          habits.filter((item) => !isUuid(item.id)).map((item) => item.id),
        );

        const refreshed = get();

        for (const p of refreshed.dailyPriorities.filter((item) => item.date === planDate && !isUuid(item.id))) {
          try {
            const created = await tasksApi.create(sessionId, planDate, {
              title: p.title,
              description: p.description,
              priority: p.priority,
              is_main: p.isMain,
              estimated_minutes: p.estimatedMinutes,
              tag: p.tag,
              ...(isUuid(p.weeklyGoalId) ? { weekly_goal_id: p.weeklyGoalId } : {}),
            });
            set((s) => ({
              dailyPriorities: s.dailyPriorities.map((item) =>
                item.id === p.id ? { ...item, id: created.id, weeklyGoalId: created.weekly_goal_id ?? item.weeklyGoalId } : item
              ),
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync daily priority "${p.title}"`, e) });
            return false;
          }
        }

        for (const t of refreshed.secondaryTasks.filter((item) => item.date === planDate && !isUuid(item.id))) {
          try {
            const created = await tasksApi.create(sessionId, planDate, {
              title: t.title,
              description: t.description,
              priority: t.priority,
              is_main: false,
              estimated_minutes: t.estimatedMinutes,
              tag: t.tag,
              ...(isUuid(t.weeklyGoalId) ? { weekly_goal_id: t.weeklyGoalId } : {}),
            });
            set((s) => ({
              secondaryTasks: s.secondaryTasks.map((item) =>
                item.id === t.id ? { ...item, id: created.id, weeklyGoalId: created.weekly_goal_id ?? item.weeklyGoalId } : item
              ),
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync secondary task "${t.title}"`, e) });
            return false;
          }
        }

        for (const h of refreshed.habits.filter((item) => !isUuid(item.id))) {
          try {
            const created = await habitsApi.create(sessionId, {
              name: h.name,
              icon: h.icon,
              frequency: h.frequency,
              ...(isUuid(h.categoryId) ? { category_id: h.categoryId } : {}),
            });
            set((s) => ({
              habits: s.habits.map((item) =>
                item.id === h.id ? { ...item, id: created.id, categoryId: created.category_id ?? item.categoryId } : item
              ),
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync habit "${h.name}"`, e) });
            return false;
          }
        }

        set({ syncError: null });
        return true;
      },

      // ── AI Plan generation ────────────────────────────────────────────────────
      generateMonthlyPlan: async (year, month) => {
        const { sessionId } = get();
        if (!sessionId) {
          return { ok: false as const, code: "no_session" };
        }
        try {
          const synced = await get().syncYearlyGoalsToServer();
          if (!synced) {
            return { ok: false as const, code: "yearly_sync_failed" };
          }
          const serverYearlyGoals = await yearlyGoalsApi.list(sessionId, year);
          if (serverYearlyGoals.length === 0) {
            return { ok: false as const, code: "no_yearly_on_server" };
          }
          set((s) => ({
            yearlyGoals: [
              ...s.yearlyGoals.filter((goal) => goal.year !== year),
              ...serverYearlyGoals.map(mapApiYearlyGoalToStore),
            ],
            syncError: null,
            syncStatus: "saved",
          }));
          const result = await monthlyPlanApi.generate(sessionId, year, month);
          set({ syncError: null, syncStatus: "saved" });
          return { ok: true as const, draft: result.ai_draft };
        } catch (e) {
          if (
            e instanceof ApiError &&
            e.status === 404 &&
            (e.message.includes("Yearly goals") || e.message.includes("yearly"))
          ) {
            return { ok: false as const, code: "no_yearly_on_server" };
          }
          set({ syncError: formatApiError("Monthly plan (AI generate)", e), syncStatus: "failed" });
          return { ok: false as const, code: "api_error" };
        }
      },
      approveMonthlyPlan: async (year, month, goals) => {
        const { sessionId } = get();
        if (!sessionId) return false;
        try {
          await monthlyPlanApi.approve(sessionId, year, month, goals);
          // Refresh monthly goals from backend
          const plan = await monthlyPlanApi.get(sessionId, year, month);
          if (plan.goals) {
            const mapped: MonthlyGoal[] = plan.goals.map((g) => ({
              id: g.id,
              title: g.title,
              description: g.description,
              yearlyGoalId: g.yearly_goal_id,
              categoryId: g.category_id,
              month: g.month,
              year: g.year,
              status: g.status as MonthlyGoal["status"],
              progress: g.progress,
              priority: g.priority as MonthlyGoal["priority"],
              isMain: g.is_main,
              aiSuggested: g.ai_suggested,
              targetDate: g.target_date,
              workload: g.workload,
            }));
            set((s) => ({
              monthlyGoals: [
                ...s.monthlyGoals.filter((g) => g.month !== month || g.year !== year),
                ...mapped,
              ],
              syncError: null,
            }));
          }
          return true;
        } catch (e) {
          set({ syncError: formatApiError("Monthly plan (save / approve)", e) });
          return false;
        }
      },

      generateWeeklyPlan: async (year, weekNumber) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const result = await weeklyPlanApi.generate(sessionId, year, weekNumber);
          set({ syncError: null });
          return { draft: result.ai_draft };
        } catch (e) {
          set({ syncError: formatApiError("Weekly plan (AI generate)", e) });
          return null;
        }
      },
      approveWeeklyPlan: async (year, weekNumber, goals) => {
        const { sessionId } = get();
        if (!sessionId) return false;
        try {
          await weeklyPlanApi.approve(sessionId, year, weekNumber, goals);
          const plan = await weeklyPlanApi.get(sessionId, year, weekNumber);
          if (plan.goals) {
            const mapped: WeeklyGoal[] = plan.goals.map((g) => ({
              id: g.id,
              title: g.title,
              description: g.description,
              monthlyGoalId: g.monthly_goal_id,
              weekNumber: g.week_number,
              month: g.month,
              year: g.year,
              status: g.status as WeeklyGoal["status"],
              progress: g.progress,
              isMain: g.is_main,
              targetDay: g.target_day,
              goalType: g.goal_type as WeeklyGoal["goalType"],
              workload: g.workload,
              aiSuggested: g.ai_suggested,
            }));
            set((s) => ({
              weeklyGoals: [
                ...s.weeklyGoals.filter((g) => g.weekNumber !== weekNumber || g.year !== year),
                ...mapped,
              ],
              syncError: null,
            }));
          }
          return true;
        } catch (e) {
          set({ syncError: formatApiError("Weekly plan (save / approve)", e) });
          return false;
        }
      },

      generateDailyPlan: async (date) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const result = await dailyPlanApi.generate(sessionId, date);
          set({ syncError: null });
          return { draft: result.ai_draft };
        } catch (e) {
          set({ syncError: formatApiError("Daily plan (AI generate)", e) });
          return null;
        }
      },
      approveDailyPlan: async (date, priorities) => {
        const { sessionId } = get();
        if (!sessionId) return false;
        try {
          await dailyPlanApi.approve(sessionId, date, priorities);
          const plan = await dailyPlanApi.get(sessionId, date);
          if (plan.priorities) {
            const mainItems = plan.priorities.filter((p) => p.is_main).map(mapApiGoalToPriority);
            const secondaryItems = plan.priorities.filter((p) => !p.is_main).map(mapApiGoalToPriority);
            set((s) => ({
              dailyPriorities: [
                ...s.dailyPriorities.filter((p) => p.date !== date),
                ...mainItems,
              ],
              secondaryTasks: [
                ...s.secondaryTasks.filter((t) => t.date !== date),
                ...secondaryItems,
              ],
              syncError: null,
            }));
          }
          return true;
        } catch (e) {
          set({ syncError: formatApiError("Daily plan (save / approve)", e) });
          return false;
        }
      },

      // ── Report generation ────────────────────────────────────────────────────
      generateDailyReport: async (date) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const r = await reportsApi.generateDaily(sessionId, date);
          set({ syncError: null });
          return r;
        } catch (e) {
          set({ syncError: formatApiError("Daily report (AI generate)", e) });
          return null;
        }
      },
      generateWeeklyReport: async (year, weekNumber) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const r = await reportsApi.generateWeekly(sessionId, year, weekNumber);
          set({ syncError: null });
          return r;
        } catch (e) {
          set({ syncError: formatApiError("Weekly report (AI generate)", e) });
          return null;
        }
      },
      generateMonthlyReport: async (year, month) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const r = await reportsApi.generateMonthly(sessionId, year, month);
          set({ syncError: null });
          return r;
        } catch (e) {
          set({ syncError: formatApiError("Monthly report (AI generate)", e) });
          return null;
        }
      },
      generateQuarterlyReport: async (year, quarter) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const r = await reportsApi.generateQuarterly(sessionId, year, quarter);
          set({ syncError: null });
          return r;
        } catch (e) {
          set({ syncError: formatApiError("Quarterly report (AI generate)", e) });
          return null;
        }
      },
      generateYearlyReport: async (year) => {
        const { sessionId } = get();
        if (!sessionId) return null;
        try {
          const r = await reportsApi.generateYearly(sessionId, year);
          set({ syncError: null });
          return r;
        } catch (e) {
          set({ syncError: formatApiError("Yearly report (AI generate)", e) });
          return null;
        }
      },

      // ── Modal ─────────────────────────────────────────────────────────────────
      activeModal: null,
      modalData: null,
      openModal: (type, data) => set({ activeModal: type, modalData: data }),
      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    {
      name: "execution-ai-store",
      partialize: (state) => ({
        currentUser: state.currentUser,
        registeredUsers: state.registeredUsers,
        sessionId: state.sessionId,
        activeDashboardDate: state.activeDashboardDate,
        workspaceOwnerId: state.workspaceOwnerId,
        onboardingComplete: state.onboardingComplete,
        onboardingStep: state.onboardingStep,
        kickoffPending: state.kickoffPending,
        categories: state.categories,
        yearlyGoals: state.yearlyGoals,
        monthlyGoals: state.monthlyGoals,
        weeklyGoals: state.weeklyGoals,
        dailyPriorities: state.dailyPriorities,
        secondaryTasks: state.secondaryTasks,
        habits: state.habits,
      }),
    }
  )
);
