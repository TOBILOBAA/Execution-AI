#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

function assertEnv(name, value) {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function currentYear() {
  return new Date().getFullYear();
}

function currentIsoWeek() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(page, pattern, timeout = 45000) {
  await page.waitForURL((url) => {
    if (pattern instanceof RegExp) return pattern.test(url.toString());
    return url.toString().includes(pattern);
  }, { timeout });
}

async function snapshotPageState(page, label) {
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const screenshotPath = `/tmp/${safeLabel}.png`;
  let bodyText = "";
  try {
    bodyText = (await page.locator("body").innerText()).slice(0, 4000);
  } catch {
    bodyText = "<could not read body text>";
  }
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch {
    // Best effort only.
  }
  return {
    label,
    url: page.url(),
    screenshotPath,
    bodyText,
  };
}

async function fillAuthAndSubmit(page, email, password, fullName) {
  if (fullName) {
    await page.getByRole("button", { name: /sign up/i }).first().click();
    await page.getByPlaceholder("Your full name").fill(fullName);
  }
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder(/Your password|At least 8 characters/).fill(password);
  await page.locator("form button[type='submit']").click();
}

async function completeSignupVerificationIfNeeded(page, admin, email, password, baseUrl) {
  await page.getByText("Check your email.").waitFor({ timeout: 15000 });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${baseUrl}/auth/callback` },
  });
  if (error || !data?.properties?.action_link) {
    throw error ?? new Error("Could not generate sign-up verification link for smoke test.");
  }

  await page.goto(data.properties.action_link, { waitUntil: "domcontentloaded", timeout: 45000 });
  return true;
}

async function ensureYearlyCategoryOpen(page, categoryName) {
  const categoryButton = page.getByRole("button", { name: new RegExp(categoryName, "i") }).first();
  const addYearlyGoalButton = page.getByRole("button", { name: "Add yearly goal" });

  await categoryButton.click();
  if (await addYearlyGoalButton.isVisible().catch(() => false)) {
    return;
  }

  await categoryButton.click();
  await addYearlyGoalButton.waitFor({ timeout: 10000 });
}

/** Regression guard: this exact phrase was a false-negative UX bug (blamed yearly goals for any failure). */
const FORBIDDEN_MONTHLY_AI_MISLEADING = "Make sure you have yearly goals saved first";

/**
 * On Monthly Targets step: run AI Generate, wait for completion, assert we never show the old misleading copy.
 * If the model returns a draft, dismiss it so the rest of the smoke flow can add a manual monthly goal.
 */
async function runMonthlyAiGenerateSmokeAssert(page) {
  await page.getByText(/Bedrock/).first().waitFor({ timeout: 30000 });
  const genBtn = page.getByRole("button", { name: "AI Generate" });
  await genBtn.waitFor({ state: "visible", timeout: 15000 });
  await genBtn.click();

  try {
    await page.getByRole("button", { name: "Generating…" }).waitFor({ state: "visible", timeout: 5000 });
  } catch {
    /* fast failure path may skip loading state */
  }

  await page.getByRole("button", { name: "AI Generate" }).waitFor({ state: "visible", timeout: 180000 });

  const body = await page.locator("body").innerText();
  if (body.includes(FORBIDDEN_MONTHLY_AI_MISLEADING)) {
    throw new Error(
      `Monthly AI smoke: forbidden misleading copy still present (${FORBIDDEN_MONTHLY_AI_MISLEADING}). ` +
        "Non-yearly errors must not use this message.",
    );
  }

  if (body.includes("AI Suggestions Ready")) {
    const draftCard = page.locator("div.rounded-2xl").filter({ hasText: "AI Suggestions Ready" });
    await draftCard.locator("span.material-symbols-outlined", { hasText: "close" }).click();
    await draftCard.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
  }

  console.log(
    JSON.stringify({
      monthlyAiSmoke: {
        ok: true,
        hadDraft: body.includes("AI Suggestions Ready"),
        note: "Forbidden misleading yearly-goals copy was not shown after AI generate.",
      },
    }),
  );
}

async function completeOnboarding(page, admin, email, password, uniqueSuffix, options = {}) {
  const { testMonthlyAI = false } = options;
  try {
    let flowState = "unknown";
    try {
      await Promise.race([
        waitForUrl(page, "/onboarding", 15000).then(() => {
          flowState = "onboarding";
        }),
        page.getByText("Check your email.").waitFor({ timeout: 15000 }).then(() => {
          flowState = "verify-email";
        }),
      ]);
    } catch {
      flowState = "unknown";
    }

    if (flowState === "verify-email") {
      await completeSignupVerificationIfNeeded(page, admin, email, password, "http://127.0.0.1:3000");
      await waitForUrl(page, "/onboarding", 45000);
    } else if (flowState !== "onboarding") {
      await waitForUrl(page, "/onboarding", 45000);
    }

    const categoryButtons = page.getByRole("button", { name: /Spiritual|Career|Academic|Personal Growth/ });
    if ((await categoryButtons.count()) === 0) {
      await page.getByRole("button", { name: "Add Custom Category" }).click();
      await page.getByPlaceholder("e.g., Spiritual Growth, Career Advancement...").fill(`UI Smoke Category ${uniqueSuffix}`);
      await page.getByRole("button", { name: "Create Category" }).click();
    }

    const visibleCategoryNames = [];
    for (const categoryName of ["Spiritual", "Career", "Academic", "Personal Growth"]) {
      if ((await page.getByRole("button", { name: new RegExp(categoryName, "i") }).count()) > 0) {
        visibleCategoryNames.push(categoryName);
      }
    }
    if (visibleCategoryNames.length === 0) {
      visibleCategoryNames.push(`UI Smoke Category ${uniqueSuffix}`);
    }

    for (const [index, categoryName] of visibleCategoryNames.entries()) {
      await ensureYearlyCategoryOpen(page, categoryName);
      await page.getByRole("button", { name: "Add yearly goal" }).click();

      const yearlyTitle =
        index === 0 ? `UI Smoke Yearly ${uniqueSuffix}` : `UI Smoke Yearly ${categoryName} ${uniqueSuffix}`;
      await page.getByPlaceholder("e.g., Strategic Expansion Phase I").fill(yearlyTitle);
      await page.getByPlaceholder("Add more context for this yearly goal.").fill(`Yearly description ${categoryName} ${uniqueSuffix}`);
      await page.getByRole("button", { name: "Add Goal" }).last().click();
      await page.getByText(yearlyTitle).first().waitFor({ timeout: 30000 });
    }

    await page.getByRole("button", { name: "Next" }).click();

    if (testMonthlyAI) {
      await runMonthlyAiGenerateSmokeAssert(page);
    }

    await page.getByRole("button", { name: /ADD GOAL/i }).first().click();
    await page.getByPlaceholder("e.g. Launch the Q1 Marketing Campaign").waitFor({ timeout: 10000 });
    await page.getByPlaceholder("e.g. Launch the Q1 Marketing Campaign").fill(`UI Smoke Monthly ${uniqueSuffix}`);
    await page.getByRole("textbox").nth(1).fill(`Monthly description ${uniqueSuffix}`);
    await page.getByRole("button", { name: "Add to Plan" }).click();
    await page.getByText(`UI Smoke Monthly ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByText("Main Weekly Goals", { exact: true }).waitFor({ timeout: 30000 });

    await page.getByRole("button", { name: /ADD GOAL/i }).first().click();
    await page.getByPlaceholder("e.g., Draft first 5 pages of the strategy document").waitFor({ timeout: 10000 });
    await page.getByPlaceholder("e.g., Draft first 5 pages of the strategy document").fill(`UI Smoke Weekly ${uniqueSuffix}`);
    await page.getByRole("textbox").nth(1).fill(`Weekly description ${uniqueSuffix}`);
    await page.getByRole("button", { name: "Add to Week" }).click();
    await page.getByText(`UI Smoke Weekly ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByText("Daily Focus", { exact: true }).waitFor({ timeout: 30000 });

    await page.getByRole("button", { name: /ADD PRIORITY/i }).first().click();
    await page.getByPlaceholder("What is your primary execution focus?").waitFor({ timeout: 10000 });
    await page.getByPlaceholder("What is your primary execution focus?").fill(`UI Smoke Daily ${uniqueSuffix}`);
    await page.getByRole("button", { name: "Add Main Goal" }).click();
    await page.getByText(`UI Smoke Daily ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Begin" }).click();
    await waitForUrl(page, "/dashboard");
  } catch (error) {
    const state = await snapshotPageState(page, "ui-smoke-onboarding-failure");
    console.error(JSON.stringify({
      onboardingFailure: state,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    throw error;
  }
}

async function verifyDashboardPersistence(page, uniqueSuffix) {
  await page.getByText(`UI Smoke Daily ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
  await page.reload({ waitUntil: "networkidle" });
  await waitForUrl(page, "/dashboard");
  await page.getByText(`UI Smoke Daily ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
}

async function verifyGoalsSurfaces(page, uniqueSuffix) {
  const year = currentYear();
  const week = currentIsoWeek();
  const quarter = currentQuarter();
  const checks = {
    goalsHubLoaded: false,
    yearPageLoaded: false,
    quarterPageLoaded: false,
    weekPageLoaded: false,
  };
  const diagnostics = [];

  try {
    await page.goto(`http://127.0.0.1:3000/dashboard/goals`, { waitUntil: "domcontentloaded" });
    await dismissBlockingDashboardOverlays(page);
    await page.getByText(`${year} Goals Overview`).waitFor({ timeout: 30000 });
    checks.goalsHubLoaded = true;
  } catch (error) {
    diagnostics.push({
      ...(await snapshotPageState(page, "ui-smoke-goals-hub-failure")),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await page.goto(`http://127.0.0.1:3000/dashboard/goals/${year}`, { waitUntil: "domcontentloaded" });
    await dismissBlockingDashboardOverlays(page);
    await page.getByRole("heading", { name: `UI Smoke Yearly ${uniqueSuffix}` }).first().waitFor({ timeout: 30000 });
    await page.getByText("Planning depth warnings").waitFor({ timeout: 30000 }).catch(() => {});
    checks.yearPageLoaded = true;
  } catch (error) {
    diagnostics.push({
      ...(await snapshotPageState(page, "ui-smoke-goals-year-failure")),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await page.goto(`http://127.0.0.1:3000/dashboard/goals/${year}/q/q${quarter}`, { waitUntil: "domcontentloaded" });
    await dismissBlockingDashboardOverlays(page);
    await page.getByText(`UI Smoke Monthly ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
    checks.quarterPageLoaded = true;
  } catch (error) {
    diagnostics.push({
      ...(await snapshotPageState(page, "ui-smoke-goals-quarter-failure")),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await page.goto(`http://127.0.0.1:3000/dashboard/goals/${year}/w/${week}`, { waitUntil: "domcontentloaded" });
    await dismissBlockingDashboardOverlays(page);
    await page.getByText(`UI Smoke Weekly ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissBlockingDashboardOverlays(page);
    await page.getByText(`UI Smoke Weekly ${uniqueSuffix}`).first().waitFor({ timeout: 30000 });
    checks.weekPageLoaded = true;
  } catch (error) {
    diagnostics.push({
      ...(await snapshotPageState(page, "ui-smoke-goals-week-failure")),
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { checks, diagnostics };
}

async function dismissBlockingDashboardOverlays(page) {
  const beginExecuting = page.getByRole("button", { name: "Begin Executing" });
  if (await beginExecuting.isVisible().catch(() => false)) {
    await beginExecuting.click();
    await beginExecuting.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  }

  const closeReviewPrompt = page.getByLabel("Close review prompt");
  if (await closeReviewPrompt.isVisible().catch(() => false)) {
    await closeReviewPrompt.click();
    await closeReviewPrompt.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  }

  const closeCompletion = page.getByRole("button", { name: /Close for now|Remind me tomorrow/i });
  if (await closeCompletion.isVisible().catch(() => false)) {
    await closeCompletion.click();
    await closeCompletion.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  }
}

async function signOut(page) {
  await dismissBlockingDashboardOverlays(page);
  await page.getByLabel("Account menu").click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await waitForUrl(page, "/auth");
}

async function readServerState(admin, authUserId) {
  const sessionRes = await admin
    .from("sessions")
    .select("id,onboarding_done,onboarding_step,auth_user_id,updated_at")
    .eq("auth_user_id", authUserId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (sessionRes.error) throw sessionRes.error;
  const session = sessionRes.data?.[0];
  if (!session) {
    return { session: null, yearlyGoals: 0, monthlyGoals: 0, weeklyGoals: 0, dailyPriorities: 0 };
  }

  const [yearlyGoals, monthlyGoals, weeklyGoals, dailyPriorities] = await Promise.all([
    admin.from("yearly_goals").select("id", { count: "exact", head: true }).eq("session_id", session.id),
    admin.from("monthly_goals").select("id", { count: "exact", head: true }).eq("session_id", session.id),
    admin.from("weekly_goals").select("id", { count: "exact", head: true }).eq("session_id", session.id),
    admin.from("daily_priorities").select("id", { count: "exact", head: true }).eq("session_id", session.id),
  ]);

  for (const res of [yearlyGoals, monthlyGoals, weeklyGoals, dailyPriorities]) {
    if (res.error) throw res.error;
  }

  return {
    session,
    yearlyGoals: yearlyGoals.count ?? 0,
    monthlyGoals: monthlyGoals.count ?? 0,
    weeklyGoals: weeklyGoals.count ?? 0,
    dailyPriorities: dailyPriorities.count ?? 0,
  };
}

async function cleanup(admin, authUserId) {
  await admin.from("sessions").delete().eq("auth_user_id", authUserId);
  await admin.auth.admin.deleteUser(authUserId);
}

async function main() {
  const frontendDir = process.cwd();
  const repoRoot = path.resolve(frontendDir, "..");
  const backendEnv = readEnvFile(path.join(repoRoot, "backend/.env"));
  const frontendEnv = readEnvFile(path.join(frontendDir, ".env.local"));

  const supabaseUrl = assertEnv("SUPABASE_URL", backendEnv.SUPABASE_URL);
  const serviceRoleKey = assertEnv("SUPABASE_SERVICE_ROLE_KEY", backendEnv.SUPABASE_SERVICE_ROLE_KEY);
  const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:3000";
  const testMonthlyAI = process.env.UI_SMOKE_TEST_MONTHLY_AI === "1";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const email = `ui-smoke-${stamp}@example.com`;
  const password = `UiSmoke!${stamp}`;
  const fullName = "UI Smoke User";
  let authUserId = null;
  let browser = null;
  const checks = {
    onboardingCompletedInUi: false,
    dashboardReloadStayedOnDashboard: false,
    monthlyAiGenerateExercised: testMonthlyAI,
    goalsHubLoaded: false,
    yearPageLoaded: false,
    quarterPageLoaded: false,
    weekPageLoaded: false,
    returningUserSameBrowser: false,
    returningUserFreshBrowser: false,
  };
  const diagnostics = [];

  try {
    browser = await chromium.launch({ headless: true });

    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
    await fillAuthAndSubmit(page1, email, password, fullName);
    await completeOnboarding(page1, admin, email, password, String(stamp), { testMonthlyAI });
    console.log(JSON.stringify({ checkpoint: "signup-onboarding-complete" }));
    checks.onboardingCompletedInUi = true;
    await verifyDashboardPersistence(page1, String(stamp));
    console.log(JSON.stringify({ checkpoint: "dashboard-reload-persisted" }));
    checks.dashboardReloadStayedOnDashboard = true;
    authUserId = await page1.evaluate(() => {
      const raw = localStorage.getItem("execution-ai-store");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.currentUser?.id ?? null;
    });
    if (!authUserId) throw new Error("Could not read current user id from persisted store after signup");

    const goalsPass1 = await verifyGoalsSurfaces(page1, String(stamp));
    Object.assign(checks, goalsPass1.checks);
    diagnostics.push(...goalsPass1.diagnostics);
    const serverState = await readServerState(admin, authUserId);
    console.log(JSON.stringify({ checkpoint: "first-session-goals-verified" }));

    await signOut(page1);
    console.log(JSON.stringify({ checkpoint: "signed-out-first-session" }));
    await context1.close();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
    await fillAuthAndSubmit(page2, email, password);
    await waitForUrl(page2, "/dashboard");
    await page2.getByText(`UI Smoke Daily ${stamp}`).first().waitFor({ timeout: 30000 });
    checks.returningUserSameBrowser = true;
    console.log(JSON.stringify({ checkpoint: "returning-user-same-browser" }));
    const goalsPass2 = await verifyGoalsSurfaces(page2, String(stamp));
    checks.goalsHubLoaded = checks.goalsHubLoaded && goalsPass2.checks.goalsHubLoaded;
    checks.yearPageLoaded = checks.yearPageLoaded && goalsPass2.checks.yearPageLoaded;
    checks.quarterPageLoaded = checks.quarterPageLoaded && goalsPass2.checks.quarterPageLoaded;
    checks.weekPageLoaded = checks.weekPageLoaded && goalsPass2.checks.weekPageLoaded;
    diagnostics.push(...goalsPass2.diagnostics);
    await context2.close();

    const context3 = await browser.newContext();
    const page3 = await context3.newPage();
    await page3.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
    await fillAuthAndSubmit(page3, email, password);
    await waitForUrl(page3, "/dashboard");
    await page3.getByText(`UI Smoke Daily ${stamp}`).first().waitFor({ timeout: 30000 });
    checks.returningUserFreshBrowser = true;
    console.log(JSON.stringify({ checkpoint: "returning-user-fresh-browser" }));
    const goalsPass3 = await verifyGoalsSurfaces(page3, String(stamp));
    checks.goalsHubLoaded = checks.goalsHubLoaded && goalsPass3.checks.goalsHubLoaded;
    checks.yearPageLoaded = checks.yearPageLoaded && goalsPass3.checks.yearPageLoaded;
    checks.quarterPageLoaded = checks.quarterPageLoaded && goalsPass3.checks.quarterPageLoaded;
    checks.weekPageLoaded = checks.weekPageLoaded && goalsPass3.checks.weekPageLoaded;
    diagnostics.push(...goalsPass3.diagnostics);
    await context3.close();

    const result = {
      baseUrl,
      email,
      authUserId,
      apiBaseUrl: frontendEnv.NEXT_PUBLIC_API_URL,
      uiSmokeTestMonthlyAI: testMonthlyAI,
      serverState,
      checks,
      diagnostics,
    };

    console.log(JSON.stringify(result, null, 2));

    if (!serverState.session?.onboarding_done) {
      throw new Error("Server session is not marked onboarding_done after UI onboarding");
    }
    if (
      serverState.yearlyGoals < 1 ||
      serverState.monthlyGoals < 1 ||
      serverState.weeklyGoals < 1 ||
      serverState.dailyPriorities < 1
    ) {
      throw new Error("Server-side onboarding data counts are incomplete after UI smoke flow");
    }
    if (!checks.goalsHubLoaded || !checks.yearPageLoaded || !checks.quarterPageLoaded || !checks.weekPageLoaded) {
      throw new Error("One or more goals surfaces failed smoke validation");
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (authUserId) {
      await Promise.race([
        cleanup(admin, authUserId).catch(() => {}),
        sleep(10000),
      ]);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
