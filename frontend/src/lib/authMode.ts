/**
 * Auth routing:
 * - NEXT_PUBLIC_AUTH_LOCAL_ONLY=true → browser registry + seeded users only (no Supabase).
 * - Supabase URL + anon key set, local off, OTP flag off → **email + password** (good for testing without SMTP).
 * - NEXT_PUBLIC_SUPABASE_OTP_AUTH=true → **email OTP** (needs SMTP + {{ .Token }} templates).
 */
export function isAuthLocalOnly(): boolean {
  const v = process.env.NEXT_PUBLIC_AUTH_LOCAL_ONLY;
  if (typeof v !== "string") return false;
  const t = v.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

export function isCloudSupabaseConfigured(): boolean {
  if (isAuthLocalOnly()) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return typeof url === "string" && url.length > 0 && typeof key === "string" && key.length > 0;
}

/** Email OTP (requires working outbound mail). Opt-in only. */
export function isCloudOtpAuthEnabled(): boolean {
  if (!isCloudSupabaseConfigured()) return false;
  const v = process.env.NEXT_PUBLIC_SUPABASE_OTP_AUTH;
  return v === "1" || v === "true" || v === "yes";
}

/** Supabase email + password (signInWithPassword / signUp). Default when cloud is on and OTP is not. */
export function isCloudPasswordAuthEnabled(): boolean {
  return isCloudSupabaseConfigured() && !isCloudOtpAuthEnabled();
}
