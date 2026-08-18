function sanitizeLabel(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9+-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildResendTestEmail(label, suffix = Date.now()) {
  const safeLabel = sanitizeLabel(label);
  return `delivered+${safeLabel}-${suffix}@resend.dev`;
}
