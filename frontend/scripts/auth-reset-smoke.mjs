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

async function generateAdminLink(supabaseUrl, serviceRoleKey, payload) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase admin generate_link failed (${response.status}): ${bodyText}`);
  }

  return JSON.parse(bodyText);
}

async function waitForResetRequestOutcome(page) {
  const success = page.getByText("Check your inbox. The reset link is good for 1 hour.");
  const deliveryError = page.getByText(/Check Supabase .* SMTP/i);

  await Promise.race([
    success.waitFor({ timeout: 30000 }),
    deliveryError.waitFor({ timeout: 30000 }),
  ]);

  if (await deliveryError.isVisible().catch(() => false)) {
    const body = await page.locator("body").innerText().catch(() => "");
    throw new Error(`Forgot password request failed in UI: ${body.slice(0, 1200)}`);
  }
}

async function cleanup(admin, authUserId) {
  await admin.from("sessions").delete().eq("auth_user_id", authUserId);
  await admin.auth.admin.deleteUser(authUserId);
}

async function main() {
  const cwd = process.cwd();
  const frontendDir = path.basename(cwd) === "frontend" ? cwd : path.join(cwd, "frontend");
  const repoRoot = path.resolve(frontendDir, "..");
  const backendEnv = readEnvFile(path.join(repoRoot, "backend/.env"));

  const supabaseUrl = assertEnv("SUPABASE_URL", backendEnv.SUPABASE_URL);
  const serviceRoleKey = assertEnv("SUPABASE_SERVICE_ROLE_KEY", backendEnv.SUPABASE_SERVICE_ROLE_KEY);
  const baseUrl = process.env.UI_SMOKE_BASE_URL || "http://127.0.0.1:3000";

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const email = buildResendTestEmail("auth-reset", stamp);
  const startingPassword = `Start!${stamp}`;
  const newPassword = `Reset!${stamp}`;
  let authUserId = null;
  let browser = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: startingPassword,
      email_confirm: true,
      user_metadata: { full_name: "Reset QA User" },
    });
    if (createError || !created.user?.id) {
      throw createError ?? new Error("Could not create reset smoke user.");
    }
    authUserId = created.user.id;

    browser = await chromium.launch({ headless: true });

    const page = await browser.newPage();
    await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });
    await page.getByText("Forgot password?").click();
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await waitForResetRequestOutcome(page);

    const recoveryData = await generateAdminLink(supabaseUrl, serviceRoleKey, {
      type: "recovery",
      email,
      redirect_to: `${baseUrl}/auth/update-password`,
    });
    if (!recoveryData?.action_link) {
      throw new Error("Could not generate recovery link.");
    }

    await page.goto(recoveryData.action_link, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.getByText("Set a new password.").waitFor({ timeout: 30000 });
    await page.locator("input[type='password']").nth(0).fill(newPassword);
    await page.locator("input[type='password']").nth(1).fill(newPassword);
    await page.getByRole("button", { name: "Update password" }).click();
    await waitForUrl(page, "/onboarding");

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });
    await page2.getByPlaceholder("you@example.com").fill(email);
    await page2.getByPlaceholder(/Your password|At least 8 characters/).fill(newPassword);
    await page2.locator("form button[type='submit']").click();
    await waitForUrl(page2, "/onboarding");
    await context2.close();

    console.log(JSON.stringify({
      baseUrl,
      email,
      authUserId,
      checks: {
        forgotPasswordRequestAccepted: true,
        resetLinkReachedUpdatePassword: true,
        resetPasswordRedirectedIncompleteUserToOnboarding: true,
        signInWithNewPasswordReturnedToOnboarding: true,
      },
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
