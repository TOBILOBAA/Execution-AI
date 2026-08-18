/**
 * Diagnose Supabase email OTP (GoTrue) from CLI.
 * Reads SUPABASE_URL + SUPABASE_ANON_KEY from backend/.env or env.
 * Usage: node scripts/test-supabase-otp.mjs
 *    or: NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node scripts/test-supabase-otp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { buildResendTestEmail } from "./test-email.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function pickUrlKey() {
  const fromEnv = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  };
  if (fromEnv.url && fromEnv.key) return fromEnv;
  const backendEnv = path.join(__dirname, "..", "..", "backend", ".env");
  const file = parseEnvFile(backendEnv);
  return {
    url: file.SUPABASE_URL || file.NEXT_PUBLIC_SUPABASE_URL,
    key: file.SUPABASE_ANON_KEY || file.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

const { url, key } = pickUrlKey();
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY (or NEXT_PUBLIC_*).");
  process.exit(1);
}

const testEmail = buildResendTestEmail("execution-ai-otp-probe");
console.log("Supabase URL:", url);
console.log("Anon key prefix:", key.slice(0, 12) + "…");
console.log("Probe email:", testEmail);

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

console.log("\n--- 1) signInWithOtp (new user, no metadata) ---");
const otpRes = await sb.auth.signInWithOtp({
  email: testEmail,
  options: { shouldCreateUser: true },
});
if (otpRes.error) {
  console.log("ERROR:", otpRes.error.message);
  console.log("status:", otpRes.error.status, "code:", otpRes.error.code);
} else {
  console.log("OK: OTP request accepted (check inbox for", testEmail + ").");
}

console.log("\n--- 2) verifyOtp wrong code (expect failure) ---");
for (const type of ["email", "signup"]) {
  const v = await sb.auth.verifyOtp({ email: testEmail, token: "000000", type });
  console.log(`type=${type}`, v.error ? `error: ${v.error.message}` : "unexpected success");
}

console.log("\n--- 3) signInWithOtp (existing user path, shouldCreateUser: false) ---");
const signOnly = await sb.auth.signInWithOtp({
  email: testEmail,
  options: { shouldCreateUser: false },
});
if (signOnly.error) {
  console.log("ERROR:", signOnly.error.message);
} else {
  console.log("OK (email may still be sent)");
}

console.log("\nDone.");
