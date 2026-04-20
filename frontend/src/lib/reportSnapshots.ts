import type { ApiReport } from "./api";

type AnyRecord = Record<string, unknown>;

export interface YearReportSnapshot {
  year: number;
  yearly: ApiReport | null;
  monthly: ApiReport[];
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function listYearSnapshots(reports: ApiReport[]): YearReportSnapshot[] {
  const grouped = new Map<number, YearReportSnapshot>();

  for (const report of reports) {
    const year = report.period_year;
    const existing = grouped.get(year) ?? { year, yearly: null, monthly: [] };

    if (report.report_type === "yearly") {
      existing.yearly = report;
    } else if (report.report_type === "monthly") {
      existing.monthly.push(report);
    }

    grouped.set(year, existing);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      monthly: [...item.monthly].sort((a, b) => (a.period_month ?? 0) - (b.period_month ?? 0)),
    }))
    .sort((a, b) => b.year - a.year);
}

export function getYearSnapshot(reports: ApiReport[], year: number): YearReportSnapshot | null {
  return listYearSnapshots(reports).find((item) => item.year === year) ?? null;
}

export function getMonthlyReport(
  reports: ApiReport[],
  year: number,
  month: number,
): ApiReport | null {
  return (
    reports.find(
      (report) =>
        report.report_type === "monthly" &&
        report.period_year === year &&
        report.period_month === month,
    ) ?? null
  );
}

export function getWeeklyReportsForMonth(
  reports: ApiReport[],
  year: number,
  month: number,
): ApiReport[] {
  return reports
    .filter((report) => {
      if (report.report_type !== "weekly" || report.period_year !== year) return false;
      if (report.period_month === month) return true;
      const metrics = asRecord(report.metrics);
      const weekStart = asString(metrics.week_start);
      if (!weekStart) return false;
      const parsed = new Date(weekStart);
      return !Number.isNaN(parsed.getTime()) && parsed.getUTCMonth() + 1 === month;
    })
    .sort((a, b) => (a.period_week ?? 0) - (b.period_week ?? 0));
}

export function yearlyCompletionRate(report: ApiReport | null): number | null {
  if (!report) return null;
  return asNumber(asRecord(report.metrics).avg_monthly_completion);
}

export function yearlyTopPillar(report: ApiReport | null): string | null {
  if (!report) return null;
  const narrative = asRecord(report.ai_narrative);
  return asString(narrative.top_pillar) ?? asString(asRecord(report.metrics).best_pillar);
}

export function yearlySummary(report: ApiReport | null): string | null {
  if (!report) return null;
  return asString(asRecord(report.ai_narrative).summary);
}

export function monthlyCompletionRate(report: ApiReport | null): number | null {
  if (!report) return null;
  return asNumber(asRecord(report.metrics).avg_weekly_completion);
}

export function monthlyMainGoalRate(report: ApiReport | null): number | null {
  if (!report) return null;
  const metrics = asRecord(report.metrics);
  const completed = asNumber(metrics.main_goals_completed);
  const total = asNumber(metrics.main_goals_total);
  if (completed === null || total === null || total <= 0) return null;
  return Math.round((completed / total) * 100);
}

export function monthlyTopPillar(report: ApiReport | null): string | null {
  if (!report) return null;
  const narrative = asRecord(report.ai_narrative);
  return asString(narrative.top_pillar) ?? asString(asRecord(report.metrics).best_pillar);
}

export function monthlySummary(report: ApiReport | null): string | null {
  if (!report) return null;
  return asString(asRecord(report.ai_narrative).summary);
}

export function monthlyReflection(report: ApiReport | null): string | null {
  if (!report) return null;
  return asString(asRecord(report.ai_narrative).reflection);
}

export function monthlyLesson(report: ApiReport | null): string | null {
  if (!report) return null;
  return asString(asRecord(report.ai_narrative).key_lesson);
}

export function monthlyNextFocus(report: ApiReport | null): string | null {
  if (!report) return null;
  return asString(asRecord(report.ai_narrative).next_month_focus);
}

export function monthName(month: number | null | undefined): string {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][(month ?? 1) - 1] ?? "Unknown";
}
