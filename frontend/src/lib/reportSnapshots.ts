import type { ApiReport } from "./api";

type AnyRecord = Record<string, unknown>;

export interface YearReportSnapshot {
  year: number;
  yearly: ApiReport | null;
  monthly: ApiReport[];
}

export interface QuarterReportSnapshot {
  quarter: 1 | 2 | 3 | 4;
  label: string;
  report: ApiReport | null;
  months: ApiReport[];
  avgCompletion: number | null;
  topPillar: string | null;
  summary: string | null;
}

export interface QuarterReviewNarrative {
  summary: string;
  reflection: string;
  nextFocus: string | null;
  coveredMonths: string[];
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

export function getWeeklyReportsForYear(reports: ApiReport[], year: number): ApiReport[] {
  return reports
    .filter((report) => report.report_type === "weekly" && report.period_year === year)
    .sort((a, b) => (a.period_week ?? 0) - (b.period_week ?? 0));
}

export function getDailyReportsForYear(reports: ApiReport[], year: number): ApiReport[] {
  return reports
    .filter((report) => report.report_type === "daily" && report.period_year === year)
    .sort((a, b) => (b.period_date ?? "").localeCompare(a.period_date ?? ""));
}

export function listQuarterSnapshots(reports: ApiReport[], year: number): QuarterReportSnapshot[] {
  const monthlyReports = reports
    .filter((report) => report.report_type === "monthly" && report.period_year === year && report.period_month)
    .sort((a, b) => (a.period_month ?? 0) - (b.period_month ?? 0));
  const quarterlyReports = reports
    .filter((report) => report.report_type === "quarterly" && report.period_year === year && report.period_quarter)
    .sort((a, b) => (a.period_quarter ?? 0) - (b.period_quarter ?? 0));

  const quarterMonths: Array<{ quarter: 1 | 2 | 3 | 4; label: string; months: number[] }> = [
    { quarter: 1, label: "Q1", months: [1, 2, 3] },
    { quarter: 2, label: "Q2", months: [4, 5, 6] },
    { quarter: 3, label: "Q3", months: [7, 8, 9] },
    { quarter: 4, label: "Q4", months: [10, 11, 12] },
  ];

  return quarterMonths.map(({ quarter, label, months }) => {
    const quarterlyReport =
      quarterlyReports.find((report) => report.period_quarter === quarter) ?? null;
    const quarterReports = monthlyReports.filter((report) => months.includes(report.period_month ?? 0));
    const quarterlyMetrics = quarterlyReport ? asRecord(quarterlyReport.metrics) : {};
    const completionValues = quarterReports
      .map((report) => monthlyCompletionRate(report))
      .filter((value): value is number => value !== null);
    const avgCompletion =
      asNumber(quarterlyMetrics.avg_monthly_completion) ??
      (completionValues.length
        ? Math.round(completionValues.reduce((sum, value) => sum + value, 0) / completionValues.length)
        : null);

    const pillarCounts = new Map<string, number>();
    for (const report of quarterReports) {
      const pillar = monthlyTopPillar(report);
      if (!pillar) continue;
      pillarCounts.set(pillar, (pillarCounts.get(pillar) ?? 0) + 1);
    }
    let topPillar: string | null = null;
    let bestCount = -1;
    for (const [pillar, count] of pillarCounts) {
      if (count > bestCount) {
        topPillar = pillar;
        bestCount = count;
      }
    }

    const summary =
      asString(asRecord(quarterlyReport?.ai_narrative).summary) ??
      quarterReports
        .map((report) => monthlySummary(report))
        .find((value): value is string => Boolean(value?.trim())) ?? null;

    return {
      quarter,
      label,
      report: quarterlyReport,
      months: quarterReports,
      avgCompletion,
      topPillar,
      summary,
    };
  });
}

export function buildQuarterReviewNarrative(
  snapshot: QuarterReportSnapshot | null | undefined,
  opts: {
    year: number;
    quarter: 1 | 2 | 3 | 4;
    nextQuarter?: 1 | 2 | 3 | 4;
    nextYear?: number;
  },
): QuarterReviewNarrative | null {
  if (!snapshot || snapshot.months.length === 0) return null;

  const coveredMonths = snapshot.months.map((monthReport) => monthName(monthReport.period_month));
  const coveredMonthsLabel = coveredMonths.join(", ");
  const summary =
    snapshot.summary ??
    `Q${opts.quarter} pulled together ${snapshot.months.length} monthly report${
      snapshot.months.length === 1 ? "" : "s"
    } across ${coveredMonthsLabel}.`;

  const reflectionParts = [
    snapshot.avgCompletion !== null ? `Average completion landed at ${snapshot.avgCompletion}%.` : null,
    snapshot.topPillar ? `The strongest pillar was ${snapshot.topPillar}.` : null,
    `This quarter covered ${coveredMonthsLabel}.`,
  ].filter(Boolean);

  const nextFocus =
    opts.nextQuarter && opts.nextYear
      ? `Open Q${opts.nextQuarter} ${opts.nextYear} and decide the operating focus before the quarter starts drifting month by month.`
      : null;

  return {
    summary,
    reflection: reflectionParts.join(" "),
    nextFocus,
    coveredMonths,
  };
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
