#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { buildResendTestEmail } from "./test-email.mjs";

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

async function waitForUrl(page, pattern, timeout = 45000) {
  await page.waitForURL((url) => {
    if (pattern instanceof RegExp) return pattern.test(url.toString());
    return url.toString().includes(pattern);
  }, { timeout });
}

function onboardingNextButton(page) {
  return page.getByRole("button", { name: /^Next(\s+arrow_forward)?$/ });
}

async function waitForAiDraft(page, timeout = 180000) {
  await page.getByText("AI Suggestions Ready").waitFor({ timeout });
  await page.getByRole("button", { name: /Save selected/i }).waitFor({ timeout: 15000 });
}

async function generateRefreshRestoreApprove(page) {
  await page.getByRole("button", { name: /Generate with AI/i }).click();
  await waitForAiDraft(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("AI Suggestions Ready").waitFor({ timeout: 45000 });
  await page.getByRole("button", { name: /Save selected/i }).click();
  await page.getByText("AI Suggestions Ready").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
}

async function cleanup(admin, authUserId) {
  console.log("[cleanup] deleting session rows");
  await admin.from("sessions").delete().eq("auth_user_id", authUserId);
  console.log("[cleanup] deleting auth user");
  await admin.auth.admin.deleteUser(authUserId);
  console.log("[cleanup] done");
}

async function fillAuthAndSubmit(page, email, password) {
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder(/Your password|At least 8 characters/).fill(password);
  await page.locator("form button[type='submit']").click();
}

async function waitForYearlyStep(page) {
  await page.getByText("Start with 1 area of life you want to improve.").waitFor({ timeout: 45000 });
}

async function ensureYearlyCategoryOpen(page, categoryName) {
  const categoryButton = page.locator("button").filter({ hasText: new RegExp(categoryName, "i") }).first();
  const addYearlyGoalButton = page.getByRole("button", { name: "Add yearly goal" });

  await categoryButton.waitFor({ state: "visible", timeout: 30000 });
  await categoryButton.click();
  if (await addYearlyGoalButton.isVisible().catch(() => false)) return;
  await categoryButton.click();
  await addYearlyGoalButton.waitFor({ timeout: 10000 });
}

async function main() {
  const cwd = process.cwd();
  const frontendDir = path.basename(cwd) === "frontend" ? cwd : path.join(cwd, "frontend");
  const repoRoot = path.resolve(frontendDir, "..");
  const backendEnv = readEnvFile(path.join(repoRoot, "backend/.env"));

  const supabaseUrl = assertEnv("SUPABASE_URL", backendEnv.SUPABASE_URL);
  const serviceRoleKey = assertEnv("SUPABASE_SERVICE_ROLE_KEY", backendEnv.SUPABASE_SERVICE_ROLE_KEY);
  const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:3001";
  const skipCleanup = process.env.SKIP_SMOKE_CLEANUP === "1";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const email = buildResendTestEmail("onboarding-ai-restore", stamp);
  const password = `AiRestore!${stamp}`;
  let authUserId = null;
  let browser = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Onboarding AI Restore QA" },
    });
    if (createError || !created.user?.id) {
      throw createError ?? new Error("Could not create onboarding AI restore smoke user.");
    }
    authUserId = created.user.id;
    console.log(`[smoke] created user ${email}`);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });
    await fillAuthAndSubmit(page, email, password);
    await waitForUrl(page, "/onboarding");
    await waitForYearlyStep(page);
    console.log("[smoke] signed in and reached yearly onboarding");

    for (const categoryName of ["Spiritual", "Career", "Academic", "Personal Growth"]) {
      await ensureYearlyCategoryOpen(page, categoryName);
      await page.getByRole("button", { name: "Add yearly goal" }).click();
      const title = `AI Restore Yearly ${categoryName} ${stamp}`;
      await page.getByPlaceholder("e.g., Strategic Expansion Phase I").fill(title);
      await page.getByPlaceholder("Add more context for this yearly goal.").fill(`Yearly AI restore note ${categoryName} ${stamp}`);
      await page.getByRole("button", { name: "Add Goal" }).last().click();
      await page.getByText(title).first().waitFor({ timeout: 30000 });
    }
    console.log("[smoke] yearly goals created");

    await onboardingNextButton(page).click();

    await generateRefreshRestoreApprove(page);
    console.log("[smoke] monthly AI draft restored and approved");
    await onboardingNextButton(page).click();
    await page.getByText("Main Weekly Goals", { exact: true }).waitFor({ timeout: 30000 });

    await generateRefreshRestoreApprove(page);
    console.log("[smoke] weekly AI draft restored and approved");
    await onboardingNextButton(page).click();
    await page.getByText("Daily Focus", { exact: true }).waitFor({ timeout: 30000 });

    await generateRefreshRestoreApprove(page);
    console.log("[smoke] daily AI draft restored and approved");
    await page.getByRole("button", { name: "Begin" }).click();
    await waitForUrl(page, "/dashboard");
    console.log("[smoke] routed to dashboard");

    const sessionRes = await admin
      .from("sessions")
      .select("id,onboarding_done,onboarding_step")
      .eq("auth_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (sessionRes.error || !sessionRes.data?.[0]) {
      throw sessionRes.error ?? new Error("Could not load session after onboarding AI restore smoke.");
    }

    const session = sessionRes.data[0];
    console.log("[smoke] loaded session state");

    const [monthlyPlans, weeklyPlans, dailyPlans, monthlyGoals, weeklyGoals, dailyPriorities] = await Promise.all([
      admin.from("monthly_plans").select("status", { count: "exact", head: true }).eq("session_id", session.id),
      admin.from("weekly_plans").select("status", { count: "exact", head: true }).eq("session_id", session.id),
      admin.from("daily_plans").select("status", { count: "exact", head: true }).eq("session_id", session.id),
      admin.from("monthly_goals").select("id", { count: "exact", head: true }).eq("session_id", session.id),
      admin.from("weekly_goals").select("id", { count: "exact", head: true }).eq("session_id", session.id),
      admin.from("daily_priorities").select("id", { count: "exact", head: true }).eq("session_id", session.id),
    ]);

    for (const result of [monthlyPlans, weeklyPlans, dailyPlans, monthlyGoals, weeklyGoals, dailyPriorities]) {
      if (result.error) throw result.error;
    }
    console.log("[smoke] loaded persistence counts");

    console.log(JSON.stringify({
      baseUrl,
      email,
      authUserId,
      checks: {
        monthlyAiRefreshRestored: true,
        weeklyAiRefreshRestored: true,
        dailyAiRefreshRestored: true,
        onboardingCompletedToDashboard: session.onboarding_done === true,
        monthlyGoalsPersisted: (monthlyGoals.count ?? 0) > 0,
        weeklyGoalsPersisted: (weeklyGoals.count ?? 0) > 0,
        dailyPrioritiesPersisted: (dailyPriorities.count ?? 0) > 0,
      },
      session,
      counts: {
        monthlyPlans: monthlyPlans.count ?? 0,
        weeklyPlans: weeklyPlans.count ?? 0,
        dailyPlans: dailyPlans.count ?? 0,
        monthlyGoals: monthlyGoals.count ?? 0,
        weeklyGoals: weeklyGoals.count ?? 0,
        dailyPriorities: dailyPriorities.count ?? 0,
      },
    }, null, 2));
  } finally {
    if (browser) {
      console.log("[cleanup] closing browser");
      await browser.close().catch(() => {});
    }
    if (authUserId && !skipCleanup) {
      await cleanup(admin, authUserId).catch(() => {});
    } else if (authUserId) {
      console.log("[cleanup] skipped by SKIP_SMOKE_CLEANUP=1");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
