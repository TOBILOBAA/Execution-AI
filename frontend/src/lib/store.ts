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
  DashboardRecapEntry,
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
import { getWeekNumber, listWeeksForYearThroughWeek } from "./goalsView";

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
type PersistMode = "background" | "blocking";

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
  sessionTimezone: string;
  sessionWeekStartsOn: WeekStartsOn;
  setSessionId: (id: string | null) => void;
  setWeekStartsOn: (value: WeekStartsOn) => Promise<void>;
  backendReady: boolean;
  workspaceHydrating: boolean;
  dashboardLoading: boolean;
  reportsLoading: boolean;
  reportsHydrated: boolean;
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
  setOnboardingStep: (step: number) => Promise<boolean>;
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
  pendingRecaps: DashboardRecapEntry[];

  // ── Backend sync ─────────────────────────────────────────────────────────────
  loadDashboard: (planDate?: string) => Promise<void>;
  loadCurrentDashboard: () => Promise<void>;
  syncReports: (force?: boolean) => Promise<ApiReport[] | null>;

  // ── CRUD operations ─────────────────────────────────────────────────────────
  addCategory: (cat: Omit<Category, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  removeCategory: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;

  addYearlyGoal: (goal: Omit<YearlyGoal, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  updateYearlyGoal: (id: string, updates: Partial<YearlyGoal>, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  removeYearlyGoal: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  /** Persist yearly goals that only exist locally (e.g. mock ids) before leaving step 1. */
  syncYearlyGoalsToServer: (options?: { mode?: "sync" | "verify" }) => Promise<boolean>;
  /** Persist monthly goals with local-only ids before weekly AI / leaving step 2. */
  syncMonthlyGoalsToServer: (year: number, month: number, options?: { mode?: "sync" | "verify" }) => Promise<boolean>;
  /** Persist weekly goals with local-only ids before daily AI / leaving step 3. */
  syncWeeklyGoalsToServer: (year: number, weekNumber: number, options?: { mode?: "sync" | "verify" }) => Promise<boolean>;
  /** Persist local-only daily tasks / habits before completing onboarding. */
  syncDailySetupToServer: (date: string, options?: { mode?: "sync" | "verify" }) => Promise<boolean>;

  addMonthlyGoal: (goal: Omit<MonthlyGoal, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  updateMonthlyGoal: (id: string, updates: Partial<MonthlyGoal>, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  removeMonthlyGoal: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;

  addWeeklyGoal: (goal: Omit<WeeklyGoal, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  updateWeeklyGoal: (id: string, updates: Partial<WeeklyGoal>, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  removeWeeklyGoal: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;

  addDailyPriority: (priority: Omit<DailyPriority, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  updateDailyPriority: (id: string, updates: Partial<DailyPriority>, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  toggleDailyPriority: (id: string) => void;
  removeDailyPriority: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;

  addSecondaryTask: (task: Omit<DailyPriority, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  updateSecondaryTask: (id: string, updates: Partial<DailyPriority>, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  toggleSecondaryTask: (id: string) => void;
  removeSecondaryTask: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;

  toggleHabit: (id: string) => void;
  updateHabit: (id: string, updates: Partial<FoundationalHabit>, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  addHabit: (habit: Omit<FoundationalHabit, "id">, options?: { persistMode?: PersistMode }) => Promise<boolean>;
  removeHabit: (id: string, options?: { persistMode?: PersistMode }) => Promise<boolean>;

  // ── AI Plan generation ───────────────────────────────────────────────────────
  generateMonthlyPlan: (
    year: number,
    month: number,
  ) => Promise<
    | { ok: true; draft: unknown }
    | { ok: false; code: "no_session" | "yearly_sync_failed" | "no_yearly_on_server" | "api_error" }
  >;
  approveMonthlyPlan: (year: number, month: number, goals?: unknown[]) => Promise<boolean>;
  generateWeeklyPlan: (
    year: number,
    weekNumber: number,
  ) => Promise<
    | { ok: true; draft: unknown }
    | {
        ok: false;
        code:
          | "no_session"
          | "invalid_week"
          | "monthly_sync_failed"
          | "no_monthly_on_server"
          | "api_error";
      }
  >;
  approveWeeklyPlan: (year: number, weekNumber: number, goals?: unknown[]) => Promise<boolean>;
  generateDailyPlan: (
    date: string,
  ) => Promise<
    | { ok: true; draft: unknown }
    | {
        ok: false;
        code:
          | "no_session"
          | "invalid_date"
          | "weekly_sync_failed"
          | "no_weekly_or_habits"
          | "api_error";
      }
  >;
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

function getReferenceDate(isoDate: string): Date {
  const parsed = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isCurrentYearlyGoal(goal: Pick<YearlyGoal, "year">, activeDashboardDate: string): boolean {
  return goal.year === getReferenceDate(activeDashboardDate).getFullYear();
}

function isCurrentMonthlyGoal(goal: Pick<MonthlyGoal, "year" | "month">, activeDashboardDate: string): boolean {
  const referenceDate = getReferenceDate(activeDashboardDate);
  return goal.year === referenceDate.getFullYear() && goal.month === referenceDate.getMonth() + 1;
}

function isCurrentWeeklyGoal(
  goal: Pick<WeeklyGoal, "year" | "weekNumber">,
  activeDashboardDate: string,
  weekStartsOn: WeekStartsOn,
): boolean {
  const referenceDate = getReferenceDate(activeDashboardDate);
  return (
    goal.year === referenceDate.getFullYear() &&
    goal.weekNumber === getWeekNumber(referenceDate, weekStartsOn)
  );
}

function requiresServerPersistence(): boolean {
  return isCloudSupabaseConfigured() && !isAuthLocalOnly();
}

const pendingYearlyGoalCreates = new Map<string, Promise<void>>();
const pendingMonthlyGoalCreates = new Map<string, Promise<void>>();
const pendingWeeklyGoalCreates = new Map<string, Promise<void>>();
const pendingDailyPriorityCreates = new Map<string, Promise<void>>();
const pendingSecondaryTaskCreates = new Map<string, Promise<void>>();
const pendingHabitCreates = new Map<string, Promise<void>>();
const pendingCategoryCreates = new Map<string, Promise<void>>();
const pendingDashboardLoads = new Map<string, Promise<void>>();
const pendingCategoryLoads = new Map<string, Promise<void>>();
const pendingReportsLoads = new Map<string, Promise<ApiReport[] | null>>();
const loadedCategoriesForSession = new Set<string>();
const localToServerCategoryIds = new Map<string, string>();
const localToServerYearlyGoalIds = new Map<string, string>();
const localToServerMonthlyGoalIds = new Map<string, string>();
const localToServerWeeklyGoalIds = new Map<string, string>();

function upsertReport(reports: ApiReport[], incoming: ApiReport): ApiReport[] {
  const index = reports.findIndex((report) => report.id === incoming.id);
  if (index === -1) {
    return [incoming, ...reports];
  }
  return reports.map((report, reportIndex) => (reportIndex === index ? incoming : report));
}

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

async function resolveCategoryIdForSave(
  categoryId: string | undefined,
): Promise<string | undefined> {
  if (!categoryId) return undefined;
  if (isUuid(categoryId)) return categoryId;
  await waitForPendingCreates(pendingCategoryCreates, [categoryId]);
  return localToServerCategoryIds.get(categoryId);
}

async function resolveYearlyGoalIdForSave(
  yearlyGoalId: string | undefined,
): Promise<string | undefined> {
  if (!yearlyGoalId) return undefined;
  if (isUuid(yearlyGoalId)) return yearlyGoalId;
  await waitForPendingCreates(pendingYearlyGoalCreates, [yearlyGoalId]);
  return localToServerYearlyGoalIds.get(yearlyGoalId);
}

async function resolveMonthlyGoalIdForSave(
  monthlyGoalId: string | undefined,
): Promise<string | undefined> {
  if (!monthlyGoalId) return undefined;
  if (isUuid(monthlyGoalId)) return monthlyGoalId;
  await waitForPendingCreates(pendingMonthlyGoalCreates, [monthlyGoalId]);
  return localToServerMonthlyGoalIds.get(monthlyGoalId);
}

async function resolveWeeklyGoalIdForSave(
  weeklyGoalId: string | undefined,
): Promise<string | undefined> {
  if (!weeklyGoalId) return undefined;
  if (isUuid(weeklyGoalId)) return weeklyGoalId;
  await waitForPendingCreates(pendingWeeklyGoalCreates, [weeklyGoalId]);
  return localToServerWeeklyGoalIds.get(weeklyGoalId);
}

function applyServerCategories(
  categories: Awaited<ReturnType<typeof categoriesApi.list>>,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
) {
  const state = get();
  if (categories.length === 0 && !state.onboardingComplete && state.categories.length > 0) {
    return;
  }
  set({
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })),
  });
}

function categoryIdentityKey(cat: Pick<Category, "name" | "icon">): string {
  return `${cat.name.trim().toLowerCase()}::${cat.icon}`;
}

function remapLocalCategoryIds(
  mappings: Array<{ localId: string; serverId: string }>,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
): void {
  if (mappings.length === 0) return;
  for (const { localId, serverId } of mappings) {
    localToServerCategoryIds.set(localId, serverId);
  }
  set((state) => ({
    categories: state.categories.map((category) => {
      const match = mappings.find((mapping) => mapping.localId === category.id);
      return match ? { ...category, id: match.serverId } : category;
    }),
    yearlyGoals: state.yearlyGoals.map((goal) => {
      const match = mappings.find((mapping) => mapping.localId === goal.categoryId);
      return match ? { ...goal, categoryId: match.serverId } : goal;
    }),
    monthlyGoals: state.monthlyGoals.map((goal) => {
      const match = mappings.find((mapping) => mapping.localId === goal.categoryId);
      return match ? { ...goal, categoryId: match.serverId } : goal;
    }),
    habits: state.habits.map((habit) => {
      const match = mappings.find((mapping) => mapping.localId === habit.categoryId);
      return match ? { ...habit, categoryId: match.serverId } : habit;
    }),
  }));
}

async function reconcileOnboardingCategories(
  sessionId: string,
  serverCategories: Awaited<ReturnType<typeof categoriesApi.list>>,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
): Promise<Awaited<ReturnType<typeof categoriesApi.list>>> {
  const state = get();
  if (state.onboardingComplete) {
    return serverCategories;
  }

  const localPlaceholderCategories = state.categories.filter((category) => !isUuid(category.id));
  if (localPlaceholderCategories.length === 0) {
    return serverCategories;
  }

  const serverByIdentity = new Map(
    serverCategories.map((category) => [categoryIdentityKey(category), category] as const),
  );

  const alreadyMapped = localPlaceholderCategories.flatMap((localCategory) => {
    const match = serverByIdentity.get(categoryIdentityKey(localCategory));
    return match ? [{ localId: localCategory.id, serverId: match.id }] : [];
  });
  remapLocalCategoryIds(alreadyMapped, set);

  const missingLocalCategories = localPlaceholderCategories.filter(
    (localCategory) => !serverByIdentity.has(categoryIdentityKey(localCategory)),
  );
  if (missingLocalCategories.length === 0) {
    return serverCategories;
  }

  const createEntries = missingLocalCategories.map((localCategory) => {
    const request = categoriesApi
      .create(sessionId, {
        name: localCategory.name,
        icon: localCategory.icon,
        color: localCategory.color,
      })
      .then((created) => {
        remapLocalCategoryIds([{ localId: localCategory.id, serverId: created.id }], set);
        return created;
      });
    trackPendingCreate(pendingCategoryCreates, localCategory.id, request);
    return { localCategory, request };
  });

  const createdCategories = await Promise.all(
    createEntries.map(async ({ localCategory, request }) => {
      const created = await request;
      serverByIdentity.set(categoryIdentityKey(localCategory), created);
      return created;
    }),
  );

  return [...serverCategories, ...createdCategories];
}

async function loadCategoriesOnce(
  sessionId: string,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
  opts?: { force?: boolean },
): Promise<void> {
  const force = opts?.force ?? false;
  if (!force && loadedCategoriesForSession.has(sessionId)) {
    return;
  }
  const existing = pendingCategoryLoads.get(sessionId);
  if (existing) {
    return existing;
  }

  const request = categoriesApi
    .list(sessionId)
    .then(async (categories) => {
      const reconciledCategories = await reconcileOnboardingCategories(sessionId, categories, set, get);
      applyServerCategories(reconciledCategories, set, get);
      loadedCategoriesForSession.add(sessionId);
    })
    .catch((e) => {
      set({ syncError: formatApiError("Load categories", e) });
    })
    .finally(() => {
      if (pendingCategoryLoads.get(sessionId) === request) {
        pendingCategoryLoads.delete(sessionId);
      }
    });

  pendingCategoryLoads.set(sessionId, request);
  return request;
}

async function loadDashboardIntoStore(
  sessionId: string,
  requestedDate: string | undefined,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
): Promise<void> {
  const requestKey = `${sessionId}:${requestedDate ?? "__current__"}`;
  const existing = pendingDashboardLoads.get(requestKey);
  if (existing) {
    return existing;
  }

  set({ dashboardLoading: true });
  const request = dashboardApi
    .get(sessionId, requestedDate)
    .then((data) => {
      set((s) => ({
        ...s,
        ...mapDashboardToStore(data, {
          yearlyGoals: s.yearlyGoals,
          monthlyGoals: s.monthlyGoals,
          weeklyGoals: s.weeklyGoals,
        }),
        activeDashboardDate: data.today,
        syncError: null,
      }));
    })
    .catch((e) => {
      set({ syncError: formatApiError("Load dashboard from server", e) });
    })
    .finally(() => {
      if (pendingDashboardLoads.get(requestKey) === request) {
        pendingDashboardLoads.delete(requestKey);
      }
      set({ dashboardLoading: pendingDashboardLoads.size > 0 });
    });

  pendingDashboardLoads.set(requestKey, request);
  return request;
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
async function attachBackendAfterAuth(
  userId: string,
  get: () => AppState,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
) {
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
      reportsLoading: false,
      reportsHydrated: false,
      sessionWeekStartsOn: "monday",
    });
  } else if (prevOwner === null) {
    set({ workspaceOwnerId: userId });
  }

  let sid: string;
  let onboardingSnapshot: {
    onboarding_step: number;
    onboarding_done: boolean;
    timezone: string;
    week_starts_on: WeekStartsOn;
  };
  try {
    const identity = get().currentUser;
    const session = await ensureBackendSession({
      id: userId,
      name: identity?.name,
      email: identity?.email,
    });
    sid = session.id;
    onboardingSnapshot = {
      onboarding_step: session.onboarding_step,
      onboarding_done: session.onboarding_done,
      timezone: session.timezone,
      week_starts_on: session.week_starts_on,
    };
    set({ sessionId: sid, backendReady: true });
  } catch (e) {
    set({
      backendReady: false,
      dashboardLoading: false,
      reportsLoading: false,
      syncError: formatApiError("Start backend session", e),
      workspaceHydrating: false,
    });
    return;
  }

  // Fetch categories once per session in the background. They are needed across
  // onboarding + dashboard, but they should not be attached to every dashboard
  // hydration request.
  const categoriesPromise = loadCategoriesOnce(sid, set, get);

  // Fetch onboarding metadata first; only preload dashboard data immediately
  // when we already know the user is past onboarding.
  const onboardingPromise = Promise.resolve(onboardingSnapshot);
  let dashboardPromise: Promise<void> | null =
    preservedOnboardingDone && !switchingAccount ? get().loadCurrentDashboard() : null;

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
        sessionTimezone: ob.timezone,
        sessionWeekStartsOn: ob.week_starts_on,
      });
      if (done && !dashboardPromise) {
        dashboardPromise = get().loadCurrentDashboard();
      }
      if (!done) {
        await categoriesPromise;
      }
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
    if (dashboardPromise) {
      await dashboardPromise;
      if (!get().syncError) set({ syncError: null });
    }
  } catch (e) {
    set({ syncError: formatApiError("Load dashboard from server", e) });
  }

  void categoriesPromise;
}

async function ensureWritableSession(
  get: () => AppState,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  context: string,
): Promise<string | null> {
  const current = get();
  if (current.sessionId && current.backendReady) {
    return current.sessionId;
  }

  const authUserId = current.currentUser?.id;
  if (!authUserId) {
    set({ syncError: `${context}: Sign in again to continue.` });
    return null;
  }

  await attachBackendAfterAuth(authUserId, get, set);
  const refreshed = get();
  if (refreshed.sessionId && refreshed.backendReady) {
    return refreshed.sessionId;
  }
  if (!refreshed.syncError) {
    set({ syncError: `${context}: Backend session is not ready.` });
  }
  return null;
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
  active: boolean; category_id?: string; yearly_goal_id?: string; monthly_goal_id?: string; weekly_goal_id?: string; completed_today: boolean; streak: number;
}): FoundationalHabit {
  return {
    id: h.id,
    name: h.name,
    icon: h.icon,
    categoryId: h.category_id,
    yearlyGoalId: h.yearly_goal_id,
    monthlyGoalId: h.monthly_goal_id,
    weeklyGoalId: h.weekly_goal_id,
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

function mapApiRecapEntry(entry: NonNullable<ApiDashboard["pending_recaps"]>[number]): DashboardRecapEntry {
  return {
    type: entry.type,
    periodYear: entry.period_year,
    periodWeek: entry.period_week,
    periodMonth: entry.period_month,
    periodQuarter: entry.period_quarter,
    firedAt: entry.fired_at,
  };
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
    bestExecutionStreak: data.metrics.best_execution_streak ?? 0,
    yesterdayCompletion: data.metrics.yesterday_completion ?? 0,
    weeklyConsistency: padWeeklyConsistency(data.metrics.weekly_consistency),
    weeklyObjective:
      (data.weekly_objective && data.weekly_objective.trim()) ||
      fallbackWeeklyObjectiveText(data.weekly_goals),
    monthlyContext:
      (data.monthly_context_text && data.monthly_context_text.trim()) ||
      fallbackMonthlyContextText(data.monthly_context),
    weeklyCompletionRate: data.metrics.weekly_completion_rate,
    monthlyCompletionRate: data.metrics.monthly_completion_rate,
    tasksCompletedToday: data.metrics.tasks_completed_today,
    tasksTotalToday: data.metrics.tasks_total_today,
    habitsCompletedToday: data.metrics.habits_completed_today,
    habitsTotalToday: data.metrics.habits_total_today,
  };

  return {
    dailyPriorities,
    secondaryTasks,
    habits,
    metrics,
    yearlyGoals,
    monthlyGoals,
    weeklyGoals,
    pendingRecaps: (data.pending_recaps ?? []).map(mapApiRecapEntry),
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
            reportsLoading: false,
            reportsHydrated: false,
            pendingRecaps: [],
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
          reportsLoading: false,
          reportsHydrated: false,
          pendingRecaps: [],
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
            reportsLoading: false,
            reportsHydrated: false,
            pendingRecaps: [],
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
          dashboardLoading: false,
          reportsLoading: false,
          reportsHydrated: false,
          workspaceHydrating: false,
          syncError: null,
          pendingRecaps: [],
          authReady: true,
        });
      },

      hydrateAuthFromSupabase: async () => {
        const sb = getSupabaseBrowser();
        if (!sb || isAuthLocalOnly()) {
          set({
            authReady: true,
            workspaceHydrating: false,
            dashboardLoading: false,
            reportsLoading: false,
            reportsHydrated: false,
          });
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
            dashboardLoading: false,
            reportsLoading: false,
            reportsHydrated: false,
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
      sessionTimezone: "UTC",
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
          await get().loadCurrentDashboard();
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
      setOnboardingStep: async (step) => {
        const { sessionId, backendReady } = get();
        if (sessionId && backendReady) {
          set({ syncStatus: "saving" });
          try {
            await sessionsApi.update(sessionId, { onboarding_step: step });
            set({ onboardingStep: step, syncError: null, syncStatus: "saved" });
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save onboarding step", e), syncStatus: "failed" });
            return false;
          }
        }
        if (requiresServerPersistence()) {
          set({ syncError: "Save onboarding step: Backend session is not ready.", syncStatus: "failed" });
          return false;
        }
        set({ onboardingStep: step, syncError: null, syncStatus: "saved" });
        return true;
      },
      completeOnboarding: async () => {
        const { sessionId, backendReady } = get();
        if (sessionId && backendReady) {
          try {
            await sessionsApi.update(sessionId, { onboarding_done: true, onboarding_step: 4 });
            set({ onboardingComplete: true, kickoffPending: true, onboardingStep: 4, syncError: null });
            await get().loadCurrentDashboard();
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
      dashboardLoading: false,
      reportsLoading: false,
      reportsHydrated: false,

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
      pendingRecaps: [],

      // ── Backend sync ─────────────────────────────────────────────────────────
      loadDashboard: async (planDate) => {
        const { sessionId, activeDashboardDate } = get();
        if (!sessionId) return;
        return loadDashboardIntoStore(sessionId, planDate ?? activeDashboardDate, set);
      },

      loadCurrentDashboard: async () => {
        const { sessionId } = get();
        if (!sessionId) return;
        return loadDashboardIntoStore(sessionId, undefined, set);
      },

      syncReports: async (force = false) => {
        const { sessionId, reportsHydrated, reports } = get();
        if (!sessionId) return null;
        if (!force && reportsHydrated) {
          return reports;
        }
        const existing = pendingReportsLoads.get(sessionId);
        if (existing) {
          return existing;
        }

        set({ reportsLoading: true });
        const request = reportsApi
          .list(sessionId)
          .then((serverReports) => {
            set({ reports: serverReports, reportsHydrated: true, syncError: null });
            return serverReports;
          })
          .catch((e) => {
            set({ syncError: formatApiError("Load reports list", e) });
            return null;
          })
          .finally(() => {
            if (pendingReportsLoads.get(sessionId) === request) {
              pendingReportsLoads.delete(sessionId);
            }
            set({ reportsLoading: pendingReportsLoads.size > 0 });
          });

        pendingReportsLoads.set(sessionId, request);
        return request;
      },

      // ── Categories ──────────────────────────────────────────────────────────
      addCategory: async (cat, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save category"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const created = await categoriesApi.create(writableSessionId, { name: cat.name, icon: cat.icon, color: cat.color });
            set((s) => ({
              categories: [...s.categories, { ...cat, id: created.id }],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save category", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("cat");
        set((s) => ({ categories: [...s.categories, { ...cat, id: localId }] }));
        // Sync to backend (fire-and-forget)
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save category")
            .then((writableSessionId) => {
              if (!writableSessionId) return null;
              return categoriesApi.create(writableSessionId, { name: cat.name, icon: cat.icon, color: cat.color });
            })
            .then((created) => {
              if (!created) return;
              localToServerCategoryIds.set(localId, created.id);
              set((s) => ({
                categories: s.categories.map((c) => (c.id === localId ? { ...c, id: created.id } : c)),
                yearlyGoals: s.yearlyGoals.map((goal) =>
                  goal.categoryId === localId ? { ...goal, categoryId: created.id } : goal
                ),
                monthlyGoals: s.monthlyGoals.map((goal) =>
                  goal.categoryId === localId ? { ...goal, categoryId: created.id } : goal
                ),
                habits: s.habits.map((habit) =>
                  habit.categoryId === localId ? { ...habit, categoryId: created.id } : habit
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save category", e) }));
          trackPendingCreate(pendingCategoryCreates, localId, request);
        }
        return true;
      },
      removeCategory: async (id, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete category: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await categoriesApi.delete(sessionId, id);
            set((s) => ({ categories: s.categories.filter((c) => c.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete category", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
        if (sessionId && isUuid(id)) {
          categoriesApi.delete(sessionId, id).catch((e) => set({ syncError: formatApiError("Delete category", e) }));
        }
        return true;
      },

      // ── Yearly goals ────────────────────────────────────────────────────────
      addYearlyGoal: async (goal, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId, activeDashboardDate } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save yearly goal"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const categoryId = await resolveCategoryIdForSave(goal.categoryId);
            if (goal.categoryId && !categoryId) {
              throw new Error("The selected category is still syncing. Wait a moment and try again.");
            }
            const created = await yearlyGoalsApi.create(writableSessionId, {
              title: goal.title,
              ...(categoryId ? { category_id: categoryId } : {}),
              description: goal.description,
              year: goal.year,
              target_date: goal.targetDate,
            });
            set((s) => ({
              yearlyGoals: [
                ...s.yearlyGoals,
                {
                  ...goal,
                  id: created.id,
                  categoryId: created.category_id ?? goal.categoryId,
                  editable: created.editable ?? isCurrentYearlyGoal(goal, activeDashboardDate),
                },
              ],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save yearly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("yg");
        set((s) => ({
          yearlyGoals: [
            ...s.yearlyGoals,
            {
              ...goal,
              id: localId,
              editable: isCurrentYearlyGoal(goal, activeDashboardDate),
            },
          ],
        }));
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save yearly goal")
            .then(async (writableSessionId) => {
              if (!writableSessionId) return null;
            const categoryId = await resolveCategoryIdForSave(goal.categoryId);
            if (goal.categoryId && !categoryId) {
              throw new Error("The selected category is still syncing. Wait a moment and try again.");
            }
              return yearlyGoalsApi.create(writableSessionId, {
              title: goal.title,
              ...(categoryId ? { category_id: categoryId } : {}),
              description: goal.description,
              year: goal.year,
              target_date: goal.targetDate,
            });
            })
            .then((created) => {
              if (!created) return;
              localToServerYearlyGoalIds.set(localId, created.id);
              set((s) => ({
                yearlyGoals: s.yearlyGoals.map((g) =>
                  g.id === localId
                    ? {
                        ...g,
                        id: created.id,
                        categoryId: created.category_id ?? g.categoryId,
                        editable: created.editable ?? g.editable,
                      }
                    : g
                ),
                monthlyGoals: s.monthlyGoals.map((goal) =>
                  goal.yearlyGoalId === localId ? { ...goal, yearlyGoalId: created.id } : goal
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save yearly goal", e) }));
          trackPendingCreate(pendingYearlyGoalCreates, localId, request);
        }
        return true;
      },
      updateYearlyGoal: async (id, updates, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        const patch: Parameters<typeof yearlyGoalsApi.update>[2] = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) patch.description = updates.description;
        if (updates.status !== undefined) patch.status = updates.status;
        if (updates.progress !== undefined) patch.progress = updates.progress;
        if (updates.targetDate !== undefined) patch.target_date = updates.targetDate;
        if (updates.categoryId !== undefined && isUuid(updates.categoryId)) {
          patch.category_id = updates.categoryId;
        }
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Update yearly goal: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await yearlyGoalsApi.update(sessionId, id, patch);
            set((s) => ({
              yearlyGoals: s.yearlyGoals.map((g) => g.id === id ? { ...g, ...updates } : g),
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Update yearly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({
          yearlyGoals: s.yearlyGoals.map((g) => g.id === id ? { ...g, ...updates } : g),
        }));
        if (!sessionId || !isUuid(id)) return true;
        if (Object.keys(patch).length) {
          yearlyGoalsApi
            .update(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update yearly goal", e) }));
        }
        return true;
      },
      syncYearlyGoalsToServer: async (options) => {
        const mode = options?.mode ?? "sync";
        const { yearlyGoals } = get();
        let sessionId = get().sessionId;
        if (!sessionId) {
          if (requiresServerPersistence()) {
            sessionId = await ensureWritableSession(get, set, "Sync yearly goals");
            if (!sessionId) return false;
          }
        }
        if (!sessionId) {
          return true;
        }
        set({ syncStatus: "saving" });
        const localIds = yearlyGoals
          .filter((g) => g.year === getCurrentYear() && !isUuid(g.id))
          .map((g) => g.id);
        await waitForPendingCreates(pendingYearlyGoalCreates, localIds);
        const pending = get().yearlyGoals.filter((g) => g.year === getCurrentYear() && !isUuid(g.id));
        if (mode === "verify" && pending.length > 0) {
          set({
            syncError: `${pending.length} yearly goal(s) are still saving. Wait a moment and try again.`,
            syncStatus: "failed",
          });
          return false;
        }
        for (const g of pending) {
          try {
            const categoryId = await resolveCategoryIdForSave(g.categoryId);
            if (g.categoryId && !categoryId) {
              throw new Error(`The category for "${g.title}" is still syncing.`);
            }
            const created = await yearlyGoalsApi.create(sessionId, {
              title: g.title,
              ...(categoryId ? { category_id: categoryId } : {}),
              description: g.description,
              year: g.year,
              target_date: g.targetDate,
            });
            localToServerYearlyGoalIds.set(g.id, created.id);
            set((s) => ({
              yearlyGoals: s.yearlyGoals.map((yg) =>
                yg.id === g.id
                  ? {
                      ...yg,
                      id: created.id,
                      categoryId: created.category_id ?? yg.categoryId,
                      editable: created.editable ?? yg.editable,
                    }
                  : yg,
              ),
              monthlyGoals: s.monthlyGoals.map((goal) =>
                goal.yearlyGoalId === g.id ? { ...goal, yearlyGoalId: created.id } : goal
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

      syncMonthlyGoalsToServer: async (year, month, options) => {
        const mode = options?.mode ?? "sync";
        const { monthlyGoals } = get();
        let sessionId = get().sessionId;
        if (!sessionId) {
          if (requiresServerPersistence()) {
            sessionId = await ensureWritableSession(get, set, "Sync monthly goals");
            if (!sessionId) return false;
          }
        }
        if (!sessionId) {
          return true;
        }
        set({ syncStatus: "saving" });
        const localIds = monthlyGoals
          .filter((g) => g.year === year && g.month === month && !isUuid(g.id))
          .map((g) => g.id);
        await waitForPendingCreates(pendingMonthlyGoalCreates, localIds);
        const pending = get().monthlyGoals.filter((g) => g.year === year && g.month === month && !isUuid(g.id));
        if (mode === "verify" && pending.length > 0) {
          set({
            syncError: `${pending.length} monthly goal(s) are still saving. Wait a moment and try again.`,
            syncStatus: "failed",
          });
          return false;
        }
        let success = true;
        for (const g of pending) {
          try {
            const yearlyGoalId = await resolveYearlyGoalIdForSave(g.yearlyGoalId);
            const categoryId = await resolveCategoryIdForSave(g.categoryId);
            if (g.yearlyGoalId && !yearlyGoalId) {
              throw new Error(`The linked yearly goal for "${g.title}" is still syncing.`);
            }
            if (g.categoryId && !categoryId) {
              throw new Error(`The category for "${g.title}" is still syncing.`);
            }
            const created = await monthlyPlanApi.addGoal(sessionId, year, month, {
              title: g.title,
              description: g.description,
              is_main: g.isMain,
              priority: g.priority,
              ...(yearlyGoalId ? { yearly_goal_id: yearlyGoalId } : {}),
              ...(categoryId ? { category_id: categoryId } : {}),
              target_date: g.targetDate,
              workload: g.workload,
            });
            localToServerMonthlyGoalIds.set(g.id, created.id);
            set((s) => ({
              monthlyGoals: s.monthlyGoals.map((mg) =>
                mg.id === g.id
                  ? {
                      ...mg,
                      id: created.id,
                      yearlyGoalId: created.yearly_goal_id ?? mg.yearlyGoalId,
                      categoryId: created.category_id ?? mg.categoryId,
                      editable: created.editable ?? mg.editable,
                    }
                  : mg
              ),
              weeklyGoals: s.weeklyGoals.map((goal) =>
                goal.monthlyGoalId === g.id ? { ...goal, monthlyGoalId: created.id } : goal
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

      syncWeeklyGoalsToServer: async (year, weekNumber, options) => {
        const mode = options?.mode ?? "sync";
        const { weeklyGoals } = get();
        let sessionId = get().sessionId;
        if (!sessionId) {
          if (requiresServerPersistence()) {
            sessionId = await ensureWritableSession(get, set, "Sync weekly goals");
            if (!sessionId) return false;
          }
        }
        if (!sessionId) {
          return true;
        }
        set({ syncStatus: "saving" });
        const localIds = weeklyGoals
          .filter((g) => g.year === year && g.weekNumber === weekNumber && !isUuid(g.id))
          .map((g) => g.id);
        await waitForPendingCreates(pendingWeeklyGoalCreates, localIds);
        const pending = get().weeklyGoals.filter((g) => g.year === year && g.weekNumber === weekNumber && !isUuid(g.id));
        if (mode === "verify" && pending.length > 0) {
          set({
            syncError: `${pending.length} weekly goal(s) are still saving. Wait a moment and try again.`,
            syncStatus: "failed",
          });
          return false;
        }
        let success = true;
        for (const g of pending) {
          try {
            const monthlyGoalId = await resolveMonthlyGoalIdForSave(g.monthlyGoalId);
            if (g.monthlyGoalId && !monthlyGoalId) {
              throw new Error(`The linked monthly goal for "${g.title}" is still syncing.`);
            }
            const created = await weeklyPlanApi.addGoal(sessionId, year, weekNumber, {
              title: g.title,
              description: g.description,
              is_main: g.isMain,
              ...(monthlyGoalId ? { monthly_goal_id: monthlyGoalId } : {}),
              target_day: g.targetDay,
              goal_type: g.goalType,
              workload: g.workload,
            });
            localToServerWeeklyGoalIds.set(g.id, created.id);
            set((s) => ({
              weeklyGoals: s.weeklyGoals.map((wg) =>
                wg.id === g.id
                  ? {
                      ...wg,
                      id: created.id,
                      monthlyGoalId: created.monthly_goal_id ?? wg.monthlyGoalId,
                      editable: created.editable ?? wg.editable,
                    }
                  : wg
              ),
              dailyPriorities: s.dailyPriorities.map((goal) =>
                goal.weeklyGoalId === g.id ? { ...goal, weeklyGoalId: created.id } : goal
              ),
              secondaryTasks: s.secondaryTasks.map((goal) =>
                goal.weeklyGoalId === g.id ? { ...goal, weeklyGoalId: created.id } : goal
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
      removeYearlyGoal: async (id, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete yearly goal: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await yearlyGoalsApi.delete(sessionId, id);
            set((s) => ({ yearlyGoals: s.yearlyGoals.filter((g) => g.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete yearly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ yearlyGoals: s.yearlyGoals.filter((g) => g.id !== id) }));
        if (sessionId && isUuid(id)) {
          yearlyGoalsApi
            .delete(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete yearly goal", e) }));
        }
        return true;
      },

      // ── Monthly goals ────────────────────────────────────────────────────────
      addMonthlyGoal: async (goal, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId, activeDashboardDate } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save monthly goal"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const yearlyGoalId = await resolveYearlyGoalIdForSave(goal.yearlyGoalId);
            const categoryId = await resolveCategoryIdForSave(goal.categoryId);
            if (goal.yearlyGoalId && !yearlyGoalId) {
              throw new Error("The linked yearly goal is still syncing. Wait a moment and try again.");
            }
            if (goal.categoryId && !categoryId) {
              throw new Error("The selected category is still syncing. Wait a moment and try again.");
            }
            const created = await monthlyPlanApi.addGoal(writableSessionId, goal.year, goal.month, {
              title: goal.title,
              description: goal.description,
              is_main: goal.isMain,
              priority: goal.priority,
              ...(yearlyGoalId ? { yearly_goal_id: yearlyGoalId } : {}),
              ...(categoryId ? { category_id: categoryId } : {}),
              target_date: goal.targetDate,
              workload: goal.workload,
            });
            set((s) => ({
              monthlyGoals: [
                ...s.monthlyGoals,
                {
                  ...goal,
                  id: created.id,
                  yearlyGoalId: created.yearly_goal_id ?? goal.yearlyGoalId,
                  categoryId: created.category_id ?? goal.categoryId,
                  editable: created.editable ?? isCurrentMonthlyGoal(goal, activeDashboardDate),
                },
              ],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save monthly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("mg");
        set((s) => ({
          monthlyGoals: [
            ...s.monthlyGoals,
            {
              ...goal,
              id: localId,
              editable: isCurrentMonthlyGoal(goal, activeDashboardDate),
            },
          ],
        }));
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save monthly goal")
            .then(async (writableSessionId) => {
              if (!writableSessionId) return null;
            const yearlyGoalId = await resolveYearlyGoalIdForSave(goal.yearlyGoalId);
            const categoryId = await resolveCategoryIdForSave(goal.categoryId);
            if (goal.yearlyGoalId && !yearlyGoalId) {
              throw new Error("The linked yearly goal is still syncing. Wait a moment and try again.");
            }
            if (goal.categoryId && !categoryId) {
              throw new Error("The selected category is still syncing. Wait a moment and try again.");
            }
              return monthlyPlanApi.addGoal(writableSessionId, goal.year, goal.month, {
              title: goal.title,
              description: goal.description,
              is_main: goal.isMain,
              priority: goal.priority,
              ...(yearlyGoalId ? { yearly_goal_id: yearlyGoalId } : {}),
              ...(categoryId ? { category_id: categoryId } : {}),
              target_date: goal.targetDate,
              workload: goal.workload,
            });
            })
            .then((created) => {
              if (!created) return;
              localToServerMonthlyGoalIds.set(localId, created.id);
              set((s) => ({
                monthlyGoals: s.monthlyGoals.map((g) =>
                  g.id === localId
                    ? {
                        ...g,
                        id: created.id,
                        yearlyGoalId: created.yearly_goal_id ?? g.yearlyGoalId,
                        categoryId: created.category_id ?? g.categoryId,
                        editable: created.editable ?? g.editable,
                      }
                    : g
                ),
                weeklyGoals: s.weeklyGoals.map((goal) =>
                  goal.monthlyGoalId === localId ? { ...goal, monthlyGoalId: created.id } : goal
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save monthly goal", e) }));
          trackPendingCreate(pendingMonthlyGoalCreates, localId, request);
        }
        return true;
      },
      updateMonthlyGoal: async (id, updates, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
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
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Update monthly goal: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await monthlyPlanApi.updateGoal(sessionId, id, patch);
            set((s) => ({
              monthlyGoals: s.monthlyGoals.map((g) => {
                if (g.id !== id) return g;
                const merged: MonthlyGoal = { ...g, ...updates };
                if (updates.description !== undefined) merged.description = updates.description ? updates.description : undefined;
                if (updates.workload !== undefined) merged.workload = updates.workload ? updates.workload : undefined;
                return merged;
              }),
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Update monthly goal", e), syncStatus: "failed" });
            return false;
          }
        }
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
        if (!sessionId || !isUuid(id)) return true;
        if (Object.keys(patch).length) {
          monthlyPlanApi
            .updateGoal(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update monthly goal", e) }));
        }
        return true;
      },
      removeMonthlyGoal: async (id, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete monthly goal: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await monthlyPlanApi.deleteGoal(sessionId, id);
            set((s) => ({ monthlyGoals: s.monthlyGoals.filter((g) => g.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete monthly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ monthlyGoals: s.monthlyGoals.filter((g) => g.id !== id) }));
        if (sessionId && isUuid(id)) {
          monthlyPlanApi
            .deleteGoal(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete monthly goal", e) }));
        }
        return true;
      },

      // ── Weekly goals ─────────────────────────────────────────────────────────
      addWeeklyGoal: async (goal, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId, activeDashboardDate, sessionWeekStartsOn } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save weekly goal"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const monthlyGoalId = await resolveMonthlyGoalIdForSave(goal.monthlyGoalId);
            if (goal.monthlyGoalId && !monthlyGoalId) {
              throw new Error("The linked monthly goal is still syncing. Wait a moment and try again.");
            }
            const created = await weeklyPlanApi.addGoal(writableSessionId, goal.year, goal.weekNumber, {
              title: goal.title,
              description: goal.description,
              is_main: goal.isMain,
              ...(monthlyGoalId ? { monthly_goal_id: monthlyGoalId } : {}),
              target_day: goal.targetDay,
              goal_type: goal.goalType,
              workload: goal.workload,
            });
            set((s) => ({
              weeklyGoals: [
                ...s.weeklyGoals,
                {
                  ...goal,
                  id: created.id,
                  monthlyGoalId: created.monthly_goal_id ?? goal.monthlyGoalId,
                  editable: created.editable ?? isCurrentWeeklyGoal(goal, activeDashboardDate, sessionWeekStartsOn),
                },
              ],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save weekly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("wg");
        set((s) => ({
          weeklyGoals: [
            ...s.weeklyGoals,
            {
              ...goal,
              id: localId,
              editable: isCurrentWeeklyGoal(goal, activeDashboardDate, sessionWeekStartsOn),
            },
          ],
        }));
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save weekly goal")
            .then(async (writableSessionId) => {
              if (!writableSessionId) return null;
            const monthlyGoalId = await resolveMonthlyGoalIdForSave(goal.monthlyGoalId);
            if (goal.monthlyGoalId && !monthlyGoalId) {
              throw new Error("The linked monthly goal is still syncing. Wait a moment and try again.");
            }
              return weeklyPlanApi.addGoal(writableSessionId, goal.year, goal.weekNumber, {
              title: goal.title,
              description: goal.description,
              is_main: goal.isMain,
              ...(monthlyGoalId ? { monthly_goal_id: monthlyGoalId } : {}),
              target_day: goal.targetDay,
              goal_type: goal.goalType,
              workload: goal.workload,
            });
            })
            .then((created) => {
              if (!created) return;
              localToServerWeeklyGoalIds.set(localId, created.id);
              set((s) => ({
                weeklyGoals: s.weeklyGoals.map((g) =>
                  g.id === localId
                    ? {
                        ...g,
                        id: created.id,
                        monthlyGoalId: created.monthly_goal_id ?? g.monthlyGoalId,
                        editable: created.editable ?? g.editable,
                      }
                    : g
                ),
                dailyPriorities: s.dailyPriorities.map((goal) =>
                  goal.weeklyGoalId === localId ? { ...goal, weeklyGoalId: created.id } : goal
                ),
                secondaryTasks: s.secondaryTasks.map((goal) =>
                  goal.weeklyGoalId === localId ? { ...goal, weeklyGoalId: created.id } : goal
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save weekly goal", e) }));
          trackPendingCreate(pendingWeeklyGoalCreates, localId, request);
        }
        return true;
      },
      updateWeeklyGoal: async (id, updates, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
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
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Update weekly goal: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await weeklyPlanApi.updateGoal(sessionId, id, patch);
            set((s) => ({
              weeklyGoals: s.weeklyGoals.map((g) => {
                if (g.id !== id) return g;
                const merged: WeeklyGoal = { ...g, ...updates };
                if (updates.description !== undefined) merged.description = updates.description ? updates.description : undefined;
                if (updates.workload !== undefined) merged.workload = updates.workload ? updates.workload : undefined;
                return merged;
              }),
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Update weekly goal", e), syncStatus: "failed" });
            return false;
          }
        }
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
        if (!sessionId || !isUuid(id)) return true;
        if (Object.keys(patch).length) {
          weeklyPlanApi
            .updateGoal(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update weekly goal", e) }));
        }
        return true;
      },
      removeWeeklyGoal: async (id, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete weekly goal: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await weeklyPlanApi.deleteGoal(sessionId, id);
            set((s) => ({ weeklyGoals: s.weeklyGoals.filter((g) => g.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete weekly goal", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ weeklyGoals: s.weeklyGoals.filter((g) => g.id !== id) }));
        if (sessionId && isUuid(id)) {
          weeklyPlanApi
            .deleteGoal(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete weekly goal", e) }));
        }
        return true;
      },

      // ── Daily priorities ──────────────────────────────────────────────────────
      addDailyPriority: async (priority, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save daily priority"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const weeklyGoalId = await resolveWeeklyGoalIdForSave(priority.weeklyGoalId);
            if (priority.weeklyGoalId && !weeklyGoalId) {
              throw new Error("The linked weekly goal is still syncing. Wait a moment and try again.");
            }
            const created = await tasksApi.create(writableSessionId, priority.date, {
              title: priority.title,
              description: priority.description,
              priority: priority.priority,
              is_main: priority.isMain,
              estimated_minutes: priority.estimatedMinutes,
              tag: priority.tag,
              ...(weeklyGoalId ? { weekly_goal_id: weeklyGoalId } : {}),
            });
            set((s) => ({
              dailyPriorities: [
                ...s.dailyPriorities,
                { ...priority, id: created.id, weeklyGoalId: created.weekly_goal_id ?? priority.weeklyGoalId },
              ],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save daily priority", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("dp");
        set((s) => ({ dailyPriorities: [...s.dailyPriorities, { ...priority, id: localId }] }));
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save daily priority")
            .then(async (writableSessionId) => {
              if (!writableSessionId) return null;
            const weeklyGoalId = await resolveWeeklyGoalIdForSave(priority.weeklyGoalId);
            if (priority.weeklyGoalId && !weeklyGoalId) {
              throw new Error("The linked weekly goal is still syncing. Wait a moment and try again.");
            }
              return tasksApi.create(writableSessionId, priority.date, {
              title: priority.title,
              description: priority.description,
              priority: priority.priority,
              is_main: priority.isMain,
              estimated_minutes: priority.estimatedMinutes,
              tag: priority.tag,
              ...(weeklyGoalId ? { weekly_goal_id: weeklyGoalId } : {}),
            });
            })
            .then((created) => {
              if (!created) return;
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
        return true;
      },
      updateDailyPriority: async (id, updates, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        const patch: Record<string, string | number | null> = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) patch.description = updates.description ? updates.description : "";
        if (updates.estimatedMinutes !== undefined) patch.estimated_minutes = updates.estimatedMinutes;
        if (updates.priority !== undefined) patch.priority = updates.priority;
        if (updates.tag !== undefined) patch.tag = updates.tag ?? "";
        if (updates.weeklyGoalId !== undefined) patch.weekly_goal_id = isUuid(updates.weeklyGoalId) ? updates.weeklyGoalId : null;
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Update daily priority: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await tasksApi.update(sessionId, id, patch);
            set((s) => ({
              dailyPriorities: s.dailyPriorities.map((p) => {
                if (p.id !== id) return p;
                const merged: DailyPriority = { ...p, ...updates };
                if (updates.description !== undefined) merged.description = updates.description ? updates.description : undefined;
                return merged;
              }),
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Update daily priority", e), syncStatus: "failed" });
            return false;
          }
        }
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
        if (!sessionId || !isUuid(id)) return true;
        if (Object.keys(patch).length) {
          tasksApi
            .update(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update daily priority", e) }));
        }
        return true;
      },
      toggleDailyPriority: (id) => {
        const priority = get().dailyPriorities.find((p) => p.id === id);
        if (!priority) return;
        const newCompleted = !priority?.completed;
        set((s) => ({
          dailyPriorities: s.dailyPriorities.map((p) =>
            p.id === id
              ? { ...p, completed: newCompleted, status: newCompleted ? "completed" : "active" }
              : p
          ),
        }));
        // Sync to backend
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          tasksApi
            .toggleStatus(sessionId, id, newCompleted!)
            .then(() => set({ syncError: null }))
            .catch((e) =>
              set((s) => ({
                dailyPriorities: s.dailyPriorities.map((p) =>
                  p.id === id ? { ...p, completed: priority.completed, status: priority.status } : p
                ),
                syncError: formatApiError("Update task completion", e),
              }))
            );
        }
      },
      removeDailyPriority: async (id, options) => {
        const removed = get().dailyPriorities.find((p) => p.id === id);
        if (!removed) return false;
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete daily priority: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await tasksApi.delete(sessionId, id);
            set((s) => ({ dailyPriorities: s.dailyPriorities.filter((p) => p.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete daily priority", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ dailyPriorities: s.dailyPriorities.filter((p) => p.id !== id) }));
        if (sessionId && isUuid(id)) {
          tasksApi
            .delete(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) =>
              set((s) => ({
                dailyPriorities: [...s.dailyPriorities, removed].sort((a, b) =>
                  a.date.localeCompare(b.date) || (a.isMain === b.isMain ? a.title.localeCompare(b.title) : a.isMain ? -1 : 1),
                ),
                syncError: formatApiError("Delete daily priority", e),
              }))
            );
        }
        return true;
      },

      // ── Secondary tasks ───────────────────────────────────────────────────────
      addSecondaryTask: async (task, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save secondary task"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const weeklyGoalId = await resolveWeeklyGoalIdForSave(task.weeklyGoalId);
            if (task.weeklyGoalId && !weeklyGoalId) {
              throw new Error("The linked weekly goal is still syncing. Wait a moment and try again.");
            }
            const created = await tasksApi.create(writableSessionId, task.date, {
              title: task.title,
              description: task.description,
              priority: task.priority,
              is_main: false,
              estimated_minutes: task.estimatedMinutes,
              tag: task.tag,
              ...(weeklyGoalId ? { weekly_goal_id: weeklyGoalId } : {}),
            });
            set((s) => ({
              secondaryTasks: [
                ...s.secondaryTasks,
                { ...task, id: created.id, weeklyGoalId: created.weekly_goal_id ?? task.weeklyGoalId },
              ],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save secondary task", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("st");
        set((s) => ({ secondaryTasks: [...s.secondaryTasks, { ...task, id: localId }] }));
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save secondary task")
            .then(async (writableSessionId) => {
              if (!writableSessionId) return null;
            const weeklyGoalId = await resolveWeeklyGoalIdForSave(task.weeklyGoalId);
            if (task.weeklyGoalId && !weeklyGoalId) {
              throw new Error("The linked weekly goal is still syncing. Wait a moment and try again.");
            }
              return tasksApi.create(writableSessionId, task.date, {
              title: task.title,
              description: task.description,
              priority: task.priority,
              is_main: false,
              estimated_minutes: task.estimatedMinutes,
              tag: task.tag,
              ...(weeklyGoalId ? { weekly_goal_id: weeklyGoalId } : {}),
            });
            })
            .then((created) => {
              if (!created) return;
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
        return true;
      },
      updateSecondaryTask: async (id, updates, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        const patch: Record<string, string | number | null> = {};
        if (updates.title !== undefined) patch.title = updates.title;
        if (updates.description !== undefined) patch.description = updates.description ? updates.description : "";
        if (updates.estimatedMinutes !== undefined) patch.estimated_minutes = updates.estimatedMinutes;
        if (updates.priority !== undefined) patch.priority = updates.priority;
        if (updates.tag !== undefined) patch.tag = updates.tag ?? "";
        if (updates.weeklyGoalId !== undefined) patch.weekly_goal_id = isUuid(updates.weeklyGoalId) ? updates.weeklyGoalId : null;
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Update secondary task: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await tasksApi.update(sessionId, id, patch);
            set((s) => ({
              secondaryTasks: s.secondaryTasks.map((t) => {
                if (t.id !== id) return t;
                const merged: DailyPriority = { ...t, ...updates };
                if (updates.description !== undefined) merged.description = updates.description ? updates.description : undefined;
                return merged;
              }),
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Update secondary task", e), syncStatus: "failed" });
            return false;
          }
        }
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
        if (!sessionId || !isUuid(id)) return true;
        if (Object.keys(patch).length) {
          tasksApi
            .update(sessionId, id, patch)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Update secondary task", e) }));
        }
        return true;
      },
      toggleSecondaryTask: (id) => {
        const task = get().secondaryTasks.find((t) => t.id === id);
        if (!task) return;
        const newCompleted = !task?.completed;
        set((s) => ({
          secondaryTasks: s.secondaryTasks.map((t) =>
            t.id === id
              ? { ...t, completed: newCompleted, status: newCompleted ? "completed" : "active" }
              : t
          ),
        }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          tasksApi
            .toggleStatus(sessionId, id, newCompleted!)
            .then(() => set({ syncError: null }))
            .catch((e) =>
              set((s) => ({
                secondaryTasks: s.secondaryTasks.map((t) =>
                  t.id === id ? { ...t, completed: task.completed, status: task.status } : t
                ),
                syncError: formatApiError("Update secondary task", e),
              }))
            );
        }
      },
      removeSecondaryTask: async (id, options) => {
        const removed = get().secondaryTasks.find((t) => t.id === id);
        if (!removed) return false;
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete secondary task: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await tasksApi.delete(sessionId, id);
            set((s) => ({ secondaryTasks: s.secondaryTasks.filter((t) => t.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete secondary task", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ secondaryTasks: s.secondaryTasks.filter((t) => t.id !== id) }));
        if (sessionId && isUuid(id)) {
          tasksApi
            .delete(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) =>
              set((s) => ({
                secondaryTasks: [...s.secondaryTasks, removed].sort((a, b) =>
                  a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
                ),
                syncError: formatApiError("Delete secondary task", e),
              }))
            );
        }
        return true;
      },

      // ── Habits ───────────────────────────────────────────────────────────────
      toggleHabit: (id) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return;
        const newCompleted = !habit?.completedToday;
        const { activeDashboardDate } = get();
        set((s) => ({
          habits: s.habits.map((h) =>
            h.id === id ? { ...h, completedToday: newCompleted } : h
          ),
        }));
        const { sessionId } = get();
        if (sessionId && isUuid(id)) {
          habitsApi
            .toggle(sessionId, id, newCompleted!, activeDashboardDate)
            .then(() => set({ syncError: null }))
            .catch((e) =>
              set((s) => ({
                habits: s.habits.map((h) =>
                  h.id === id ? { ...h, completedToday: habit.completedToday } : h
                ),
                syncError: formatApiError("Update habit completion", e),
              }))
            );
        }
      },
      updateHabit: async (id, updates, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        const hPatch: Parameters<typeof habitsApi.update>[2] = {};
        if (updates.name !== undefined) hPatch.name = updates.name;
        if (updates.icon !== undefined) hPatch.icon = updates.icon;
        if (updates.frequency !== undefined) hPatch.frequency = updates.frequency;
        if (updates.active !== undefined) hPatch.active = updates.active;
        if (updates.categoryId !== undefined) hPatch.category_id = isUuid(updates.categoryId) ? updates.categoryId : null;
        if (updates.yearlyGoalId !== undefined) hPatch.yearly_goal_id = isUuid(updates.yearlyGoalId) ? updates.yearlyGoalId : null;
        if (updates.monthlyGoalId !== undefined) hPatch.monthly_goal_id = isUuid(updates.monthlyGoalId) ? updates.monthlyGoalId : null;
        if (updates.weeklyGoalId !== undefined) hPatch.weekly_goal_id = isUuid(updates.weeklyGoalId) ? updates.weeklyGoalId : null;
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Update habit: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await habitsApi.update(sessionId, id, hPatch);
            set((s) => ({
              habits: s.habits.map((h) => h.id === id ? { ...h, ...updates } : h),
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Update habit", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({
          habits: s.habits.map((h) => h.id === id ? { ...h, ...updates } : h),
        }));
        if (sessionId && isUuid(id)) {
          if (Object.keys(hPatch).length) {
            habitsApi
              .update(sessionId, id, hPatch)
              .then(() => set({ syncError: null }))
              .catch((e) => set({ syncError: formatApiError("Update habit", e) }));
          }
        }
        return true;
      },
      addHabit: async (habit, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock) {
          const writableSessionId =
            sessionId ?? (await ensureWritableSession(get, set, "Save habit"));
          if (!writableSessionId) {
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            const categoryId = await resolveCategoryIdForSave(habit.categoryId);
            if (habit.categoryId && !categoryId) {
              throw new Error("The selected category is still syncing. Wait a moment and try again.");
            }
            const created = await habitsApi.create(writableSessionId, {
              name: habit.name,
              icon: habit.icon,
              frequency: habit.frequency,
              ...(categoryId ? { category_id: categoryId } : {}),
              ...(isUuid(habit.yearlyGoalId) ? { yearly_goal_id: habit.yearlyGoalId } : {}),
              ...(isUuid(habit.monthlyGoalId) ? { monthly_goal_id: habit.monthlyGoalId } : {}),
              ...(isUuid(habit.weeklyGoalId) ? { weekly_goal_id: habit.weeklyGoalId } : {}),
            });
            set((s) => ({
              habits: [
                ...s.habits,
                {
                  ...habit,
                  id: created.id,
                  categoryId: created.category_id ?? habit.categoryId,
                  yearlyGoalId: created.yearly_goal_id ?? habit.yearlyGoalId,
                  monthlyGoalId: created.monthly_goal_id ?? habit.monthlyGoalId,
                  weeklyGoalId: created.weekly_goal_id ?? habit.weeklyGoalId,
                },
              ],
              syncError: null,
              syncStatus: "saved",
            }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Save habit", e), syncStatus: "failed" });
            return false;
          }
        }
        const localId = genId("hab");
        set((s) => ({ habits: [...s.habits, { ...habit, id: localId }] }));
        const currentSessionId = get().sessionId;
        if (currentSessionId || requiresServerPersistence()) {
          const request = ensureWritableSession(get, set, "Save habit")
            .then(async (writableSessionId) => {
              if (!writableSessionId) return null;
            const categoryId = await resolveCategoryIdForSave(habit.categoryId);
            if (habit.categoryId && !categoryId) {
              throw new Error("The selected category is still syncing. Wait a moment and try again.");
            }
              return habitsApi.create(writableSessionId, {
              name: habit.name,
              icon: habit.icon,
              frequency: habit.frequency,
              ...(categoryId ? { category_id: categoryId } : {}),
              ...(isUuid(habit.yearlyGoalId) ? { yearly_goal_id: habit.yearlyGoalId } : {}),
              ...(isUuid(habit.monthlyGoalId) ? { monthly_goal_id: habit.monthlyGoalId } : {}),
              ...(isUuid(habit.weeklyGoalId) ? { weekly_goal_id: habit.weeklyGoalId } : {}),
            });
            })
            .then((created) => {
              if (!created) return;
              set((s) => ({
                habits: s.habits.map((h) =>
                  h.id === localId
                    ? {
                        ...h,
                        id: created.id,
                        categoryId: created.category_id ?? h.categoryId,
                        yearlyGoalId: created.yearly_goal_id ?? h.yearlyGoalId,
                        monthlyGoalId: created.monthly_goal_id ?? h.monthlyGoalId,
                        weeklyGoalId: created.weekly_goal_id ?? h.weeklyGoalId,
                      }
                    : h
                ),
                syncError: null,
              }));
            })
            .catch((e) => set({ syncError: formatApiError("Save habit", e) }));
          trackPendingCreate(pendingHabitCreates, localId, request);
        }
        return true;
      },
      removeHabit: async (id, options) => {
        const persistMode = options?.persistMode ?? "background";
        const shouldBlock = persistMode === "blocking" && requiresServerPersistence();
        const { sessionId } = get();
        if (shouldBlock && isUuid(id)) {
          if (!sessionId) {
            set({ syncError: "Delete habit: Backend session is not ready.", syncStatus: "failed" });
            return false;
          }
          set({ syncStatus: "saving" });
          try {
            await habitsApi.delete(sessionId, id);
            set((s) => ({ habits: s.habits.filter((h) => h.id !== id), syncError: null, syncStatus: "saved" }));
            return true;
          } catch (e) {
            set({ syncError: formatApiError("Delete habit", e), syncStatus: "failed" });
            return false;
          }
        }
        set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
        if (sessionId && isUuid(id)) {
          habitsApi
            .delete(sessionId, id)
            .then(() => set({ syncError: null }))
            .catch((e) => set({ syncError: formatApiError("Delete habit", e) }));
        }
        return true;
      },

      syncDailySetupToServer: async (planDate, options) => {
        const mode = options?.mode ?? "sync";
        let sessionId = get().sessionId;
        const { dailyPriorities, secondaryTasks, habits } = get();
        if (!sessionId) {
          if (requiresServerPersistence()) {
            sessionId = await ensureWritableSession(get, set, "Sync daily setup");
            if (!sessionId) return false;
          }
        }
        if (!sessionId) {
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
        if (mode === "verify") {
          const unsavedPriorities = refreshed.dailyPriorities.filter((item) => item.date === planDate && !isUuid(item.id));
          const unsavedTasks = refreshed.secondaryTasks.filter((item) => item.date === planDate && !isUuid(item.id));
          const unsavedHabits = refreshed.habits.filter((item) => !isUuid(item.id));
          if (unsavedPriorities.length || unsavedTasks.length || unsavedHabits.length) {
            set({
              syncError: "Some daily goals or routines are still saving. Wait a moment and try again.",
              syncStatus: "failed",
            });
            return false;
          }
          set({ syncError: null });
          await get().loadDashboard(planDate);
          return true;
        }

        for (const p of refreshed.dailyPriorities.filter((item) => item.date === planDate && !isUuid(item.id))) {
          try {
            const weeklyGoalId = await resolveWeeklyGoalIdForSave(p.weeklyGoalId);
            if (p.weeklyGoalId && !weeklyGoalId) {
              throw new Error(`The linked weekly goal for "${p.title}" is still syncing.`);
            }
            const created = await tasksApi.create(sessionId, planDate, {
              title: p.title,
              description: p.description,
              priority: p.priority,
              is_main: p.isMain,
              estimated_minutes: p.estimatedMinutes,
              tag: p.tag,
              ...(weeklyGoalId ? { weekly_goal_id: weeklyGoalId } : {}),
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
            const weeklyGoalId = await resolveWeeklyGoalIdForSave(t.weeklyGoalId);
            if (t.weeklyGoalId && !weeklyGoalId) {
              throw new Error(`The linked weekly goal for "${t.title}" is still syncing.`);
            }
            const created = await tasksApi.create(sessionId, planDate, {
              title: t.title,
              description: t.description,
              priority: t.priority,
              is_main: false,
              estimated_minutes: t.estimatedMinutes,
              tag: t.tag,
              ...(weeklyGoalId ? { weekly_goal_id: weeklyGoalId } : {}),
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
            const categoryId = await resolveCategoryIdForSave(h.categoryId);
            if (h.categoryId && !categoryId) {
              throw new Error(`The category for "${h.name}" is still syncing.`);
            }
            const created = await habitsApi.create(sessionId, {
              name: h.name,
              icon: h.icon,
              frequency: h.frequency,
              ...(categoryId ? { category_id: categoryId } : {}),
              ...(isUuid(h.yearlyGoalId) ? { yearly_goal_id: h.yearlyGoalId } : {}),
              ...(isUuid(h.monthlyGoalId) ? { monthly_goal_id: h.monthlyGoalId } : {}),
              ...(isUuid(h.weeklyGoalId) ? { weekly_goal_id: h.weeklyGoalId } : {}),
            });
            set((s) => ({
              habits: s.habits.map((item) =>
                item.id === h.id
                  ? {
                      ...item,
                      id: created.id,
                      categoryId: created.category_id ?? item.categoryId,
                      yearlyGoalId: created.yearly_goal_id ?? item.yearlyGoalId,
                      monthlyGoalId: created.monthly_goal_id ?? item.monthlyGoalId,
                      weeklyGoalId: created.weekly_goal_id ?? item.weeklyGoalId,
                    }
                  : item
              ),
            }));
          } catch (e) {
            set({ syncError: formatApiError(`Sync habit "${h.name}"`, e) });
            return false;
          }
        }

        set({ syncError: null });
        await get().loadDashboard(planDate);
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
        const { sessionId, sessionWeekStartsOn } = get();
        if (!sessionId) return { ok: false as const, code: "no_session" };

        const weeks = listWeeksForYearThroughWeek(year, weekNumber, sessionWeekStartsOn);
        const row = weeks.find((w) => w.weekNumber === weekNumber);
        if (!row) {
          return { ok: false as const, code: "invalid_week" };
        }
        const anchorMonth = row.month;

        try {
          const synced = await get().syncMonthlyGoalsToServer(year, anchorMonth);
          if (!synced) {
            return { ok: false as const, code: "monthly_sync_failed" };
          }
          let monthlyPlan;
          try {
            monthlyPlan = await monthlyPlanApi.get(sessionId, year, anchorMonth);
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) {
              return { ok: false as const, code: "no_monthly_on_server" };
            }
            set({
              syncError: formatApiError("Monthly plan (load)", e),
              syncStatus: "failed",
            });
            return { ok: false as const, code: "api_error" };
          }
          if ((monthlyPlan.goals?.length ?? 0) === 0) {
            return { ok: false as const, code: "no_monthly_on_server" };
          }

          const result = await weeklyPlanApi.generate(sessionId, year, weekNumber);
          set({ syncError: null, syncStatus: "saved" });
          return { ok: true as const, draft: result.ai_draft };
        } catch (e) {
          if (
            e instanceof ApiError &&
            e.status === 404 &&
            (e.message.includes("Monthly goals") || e.message.includes("monthly"))
          ) {
            return { ok: false as const, code: "no_monthly_on_server" };
          }
          set({
            syncError: formatApiError("Weekly plan (AI generate)", e),
            syncStatus: "failed",
          });
          return { ok: false as const, code: "api_error" };
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
        const { sessionId, sessionWeekStartsOn } = get();
        if (!sessionId) return { ok: false as const, code: "no_session" };

        const planDay = new Date(`${date}T12:00:00`);
        if (Number.isNaN(planDay.getTime())) {
          return { ok: false as const, code: "invalid_date" };
        }
        const y = planDay.getFullYear();
        const wn = getWeekNumber(planDay, sessionWeekStartsOn);

        try {
          const synced = await get().syncWeeklyGoalsToServer(y, wn);
          if (!synced) {
            return { ok: false as const, code: "weekly_sync_failed" };
          }

          let weeklyGoalsCount = 0;
          try {
            const wp = await weeklyPlanApi.get(sessionId, y, wn);
            weeklyGoalsCount = wp.goals?.length ?? 0;
          } catch {
            weeklyGoalsCount = 0;
          }
          const activeHabits = get().habits.filter((h) => h.active);
          if (weeklyGoalsCount === 0 && activeHabits.length === 0) {
            return { ok: false as const, code: "no_weekly_or_habits" };
          }

          const result = await dailyPlanApi.generate(sessionId, date);
          set({ syncError: null, syncStatus: "saved" });
          return { ok: true as const, draft: result.ai_draft };
        } catch (e) {
          if (
            e instanceof ApiError &&
            e.status === 404 &&
            (e.message.includes("Weekly goals") ||
              e.message.includes("habits") ||
              e.message.includes("weekly plan"))
          ) {
            return { ok: false as const, code: "no_weekly_or_habits" };
          }
          set({ syncError: formatApiError("Daily plan (AI generate)", e), syncStatus: "failed" });
          return { ok: false as const, code: "api_error" };
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
          set((s) => ({ reports: upsertReport(s.reports, r), reportsHydrated: true, syncError: null }));
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
          set((s) => ({ reports: upsertReport(s.reports, r), reportsHydrated: true, syncError: null }));
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
          set((s) => ({ reports: upsertReport(s.reports, r), reportsHydrated: true, syncError: null }));
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
          set((s) => ({ reports: upsertReport(s.reports, r), reportsHydrated: true, syncError: null }));
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
          set((s) => ({ reports: upsertReport(s.reports, r), reportsHydrated: true, syncError: null }));
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
