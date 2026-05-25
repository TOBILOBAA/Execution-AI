function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function readConfiguredSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return normalizeBaseUrl(raw);
}

function readWindowOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeBaseUrl(window.location.origin);
}

export function getPublicSiteUrl(): string | null {
  return readConfiguredSiteUrl() ?? readWindowOrigin();
}

export function buildPublicUrl(path: string): string | undefined {
  const base = getPublicSiteUrl();
  if (!base) return undefined;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function readAuthErrorParam(url: URL): string | null {
  const direct =
    url.searchParams.get("error_description") ??
    url.searchParams.get("error") ??
    null;
  if (direct) return direct;

  const hash = url.hash.replace(/^#/, "");
  if (!hash) return null;
  const hashParams = new URLSearchParams(hash);
  return hashParams.get("error_description") ?? hashParams.get("error");
}

export function describeSupabaseAuthError(raw: string | null | undefined): string {
  const message = decodeURIComponent((raw ?? "").trim());
  if (!message) {
    return "This auth link is invalid or has expired. Request a new one and try again.";
  }

  if (/expired|otp_expired|token has expired/i.test(message)) {
    return "This auth link or code has expired. Request a new one and try again.";
  }

  if (/invalid|otp.*invalid|token.*invalid|verification failed|access denied/i.test(message)) {
    return "This auth link or code is invalid. Request a new one and try again.";
  }

  if (/same password/i.test(message)) {
    return "Choose a new password that is different from your current one.";
  }

  return message;
}

export function readSupabaseAuthErrorFromUrl(url: URL): string | null {
  const raw = readAuthErrorParam(url);
  if (!raw) return null;
  return describeSupabaseAuthError(raw);
}
