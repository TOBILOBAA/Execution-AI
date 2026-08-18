import type { ApiReport } from "./api";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractReportUserNote(report: ApiReport | null | undefined): string | null {
  if (!report) return null;
  return (
    asString(report.user_note) ??
    asString(asRecord(report.ai_narrative)._user_note_fallback) ??
    null
  );
}
