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

async function waitForUrl(page, pattern, timeout = 45000) {
  await page.waitForURL((url) => {
    if (pattern instanceof RegExp) return pattern.test(url.toString());
    return url.toString().includes(pattern);
  }, { timeout });
}

async function cleanup(admin, authUserId) {
  await admin.from("sessions").delete().eq("auth_user_id", authUserId);
  await admin.auth.admin.deleteUser(authUserId);
}

async function fillAuthAndSubmit(page, email, password) {
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder(/Your password|At least 8 characters/).fill(password);
  await page.locator("form button[type='submit']").click();
}

async function ensureYearlyCategoryOpen(page, categoryName) {
  const categoryButton = page.getByRole("button", { name: new RegExp(categoryName, "i") }).first();
  const addYearlyGoalButton = page.getByRole("button", { name: "Add yearly goal" });

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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const email = `onboarding-restore-${stamp}@example.com`;
  const password = `Restore!${stamp}`;
  let authUserId = null;
  let browser = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Onboarding Restore QA" },
    });
    if (createError || !created.user?.id) {
      throw createError ?? new Error("Could not create onboarding restore smoke user.");
    }
    authUserId = created.user.id;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle" });
    await fillAuthAndSubmit(page, email, password);
    await waitForUrl(page, "/onboarding");

    for (const categoryName of ["Spiritual", "Career", "Academic", "Personal Growth"]) {
      await ensureYearlyCategoryOpen(page, categoryName);
      await page.getByRole("button", { name: "Add yearly goal" }).click();
      const title = `Restore Yearly ${categoryName} ${stamp}`;
      await page.getByPlaceholder("e.g., Strategic Expansion Phase I").fill(title);
      await page.getByPlaceholder("Add more context for this yearly goal.").fill(`Yearly restore note ${categoryName} ${stamp}`);
      await page.getByRole("button", { name: "Add Goal" }).last().click();
      await page.getByText(title).first().waitFor({ timeout: 30000 });
    }

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(`Restore Yearly Spiritual ${stamp}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: /ADD GOAL/i }).first().click();
    await page.getByPlaceholder("e.g. Launch the Q1 Marketing Campaign").fill(`Restore Monthly ${stamp}`);
    await page.getByRole("textbox").nth(1).fill(`Monthly restore note ${stamp}`);
    await page.getByRole("button", { name: "Add to Plan" }).click();
    await page.getByText(`Restore Monthly ${stamp}`).first().waitFor({ timeout: 30000 });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(`Restore Monthly ${stamp}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByText("Main Weekly Goals", { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /ADD GOAL/i }).first().click();
    await page.getByPlaceholder("e.g., Draft first 5 pages of the strategy document").fill(`Restore Weekly ${stamp}`);
    await page.getByRole("textbox").nth(1).fill(`Weekly restore note ${stamp}`);
    await page.getByRole("button", { name: "Add to Week" }).click();
    await page.getByText(`Restore Weekly ${stamp}`).first().waitFor({ timeout: 30000 });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(`Restore Weekly ${stamp}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByText("Daily Focus", { exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /ADD PRIORITY/i }).first().click();
    await page.getByPlaceholder("What is your primary execution focus?").fill(`Restore Daily ${stamp}`);
    await page.getByRole("button", { name: "Add Main Goal" }).click();
    await page.getByText(`Restore Daily ${stamp}`).first().waitFor({ timeout: 30000 });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(`Restore Daily ${stamp}`).first().waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: "Begin" }).click();
    await waitForUrl(page, "/dashboard");
    await page.getByText(`Restore Daily ${stamp}`).first().waitFor({ timeout: 30000 });

    const sessionRes = await admin
      .from("sessions")
      .select("id,onboarding_done,onboarding_step")
      .eq("auth_user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (sessionRes.error || !sessionRes.data?.[0]) {
      throw sessionRes.error ?? new Error("Could not load session after onboarding restore smoke.");
    }

    const session = sessionRes.data[0];

    console.log(JSON.stringify({
      baseUrl,
      email,
      authUserId,
      checks: {
        yearlyRefreshRestored: true,
        monthlyRefreshRestored: true,
        weeklyRefreshRestored: true,
        dailyRefreshRestored: true,
        onboardingCompletedToDashboard: session.onboarding_done === true,
      },
      session,
    }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (authUserId) await cleanup(admin, authUserId).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
