"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { sessionsApi, type ApiReport } from "@/lib/api";
import { AddYearlyGoalModal } from "@/components/modals/AddYearlyGoalModal";
import { AddMonthlyGoalModal as PlanningMonthlyGoalModal } from "@/components/onboarding/AddMonthlyGoalModal";
import { AddWeeklyGoalModal as PlanningWeeklyGoalModal } from "@/components/onboarding/AddWeeklyGoalModal";
import { AddHabitModal } from "@/components/onboarding/AddHabitModal";
import {
  startOfLocalWeek,
} from "@/lib/reportAvailability";
import { getWeekNumber } from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";
import type { DashboardRecapEntry, FoundationalHabit, MonthlyGoal, WeeklyGoal, YearlyGoal } from "@/lib/types";

type ReviewType = "weekly" | "monthly" | "quarterly" | "yearly";

interface ReviewCandidate {
  type: ReviewType;
  key: string;
  periodLabel: string;
  entry: DashboardRecapEntry;
  generate: () => Promise<ApiReport | null>;
}

interface DraftGoal {
  title: string;
  description?: string;
  estimated_effort?: string;
  target_date?: string;
}

interface PeriodPlanDraft {
  reasoning?: string;
  main_goals?: DraftGoal[];
  secondary_goals?: DraftGoal[];
}

interface PeriodPlanGoalPayload extends DraftGoal {
  priority: "high" | "medium";
  is_main: boolean;
}

const MAX_PERIOD_MAIN_GOALS = 3;

type GoalEditorState =
  | null
  | { type: "weekly"; goal?: WeeklyGoal; defaultIsMain?: boolean }
  | { type: "monthly"; goal?: MonthlyGoal; defaultIsMain?: boolean };

type HabitEditorState = null | { habit?: FoundationalHabit };

function parseForcedReview(value: string | null): ReviewType | null {
  if (value === "weekly" || value === "monthly" || value === "quarterly" || value === "yearly") {
    return value;
  }
  return null;
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTargetDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekNumberForDate(ref: Date, weekStartsOn: "sunday" | "monday") {
  // Use the UTC-safe shared helper so DST boundaries do not shift week numbers
  // inside the review modal flow.
  return getWeekNumber(ref, weekStartsOn);
}

function getWeekContext(now: Date, weekStartsOn: "sunday" | "monday") {
  const isSundayModel = weekStartsOn === "sunday";
  const onClosingDay =
    isSundayModel ? now.getDay() === 6 && now.getHours() >= 18 : now.getDay() === 0 && now.getHours() >= 18;
  const reviewDate = onClosingDay
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const nextWeekDate = new Date(startOfLocalWeek(reviewDate, weekStartsOn));
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);

  return {
    reviewYear: reviewDate.getFullYear(),
    reviewWeek: weekNumberForDate(reviewDate, weekStartsOn),
    nextYear: nextWeekDate.getFullYear(),
    nextWeek: weekNumberForDate(nextWeekDate, weekStartsOn),
  };
}

function getMonthContext(now: Date) {
  const onClosingDay =
    now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() && now.getHours() >= 18;
  if (onClosingDay) {
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      reviewYear: now.getFullYear(),
      reviewMonth: now.getMonth() + 1,
      nextYear: nextMonthDate.getFullYear(),
      nextMonth: nextMonthDate.getMonth() + 1,
    };
  }

  const previousMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    reviewYear: previousMonthDate.getFullYear(),
    reviewMonth: previousMonthDate.getMonth() + 1,
    nextYear: now.getFullYear(),
    nextMonth: now.getMonth() + 1,
  };
}

function quarterNumber(month: number) {
  return Math.floor((month - 1) / 3) + 1;
}

function quarterLabel(quarter: number) {
  return `Q${quarter}`;
}

function quarterMonths(quarter: number) {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

function getQuarterContext(now: Date) {
  const currentQuarter = quarterNumber(now.getMonth() + 1);
  const quarterEndMonth = currentQuarter * 3;
  const quarterEndDate = new Date(now.getFullYear(), quarterEndMonth, 0).getDate();
  const onClosingDay =
    now.getMonth() + 1 === quarterEndMonth && now.getDate() === quarterEndDate && now.getHours() >= 18;
  const onQuarterStart = [0, 3, 6, 9].includes(now.getMonth()) && now.getDate() === 1;

  if (onClosingDay) {
    const nextQuarter = currentQuarter === 4 ? 1 : (currentQuarter + 1) as 1 | 2 | 3 | 4;
    const nextYear = currentQuarter === 4 ? now.getFullYear() + 1 : now.getFullYear();
    return {
      reviewYear: now.getFullYear(),
      reviewQuarter: currentQuarter as 1 | 2 | 3 | 4,
      nextYear,
      nextQuarter,
      ready: true,
    };
  }

  if (onQuarterStart) {
    const previousQuarter = currentQuarter === 1 ? 4 : (currentQuarter - 1) as 1 | 2 | 3 | 4;
    const reviewYear = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
    return {
      reviewYear,
      reviewQuarter: previousQuarter,
      nextYear: now.getFullYear(),
      nextQuarter: currentQuarter as 1 | 2 | 3 | 4,
      ready: true,
    };
  }

  return {
    reviewYear: now.getFullYear(),
    reviewQuarter: currentQuarter as 1 | 2 | 3 | 4,
    nextYear: now.getFullYear(),
    nextQuarter: currentQuarter as 1 | 2 | 3 | 4,
    ready: false,
  };
}

function getYearContext(now: Date) {
  const onClosingDay = now.getMonth() === 11 && now.getDate() === 31 && now.getHours() >= 18;
  return onClosingDay
    ? { reviewYear: now.getFullYear(), nextYear: now.getFullYear() + 1 }
    : { reviewYear: now.getFullYear() - 1, nextYear: now.getFullYear() };
}

function extractNarrative(report: ApiReport | null) {
  const narrative = (report?.ai_narrative ?? {}) as Record<string, unknown>;
  return {
    summary: typeof narrative.summary === "string" ? narrative.summary : "Your execution report is ready.",
    reflection:
      typeof narrative.reflection === "string"
        ? narrative.reflection
        : "The system has captured the main patterns from this period.",
    nextFocus:
      (typeof narrative.tomorrow_focus === "string" && narrative.tomorrow_focus) ||
      (typeof narrative.next_week_priority === "string" && narrative.next_week_priority) ||
      (typeof narrative.next_month_focus === "string" && narrative.next_month_focus) ||
      (typeof narrative.next_year_focus === "string" && narrative.next_year_focus) ||
      null,
  };
}

function extractTailoredInsight(report: ApiReport | null) {
  const narrative = (report?.ai_narrative ?? {}) as Record<string, unknown>;
  const tailoredPattern =
    report?.tailored_pattern
    ?? (typeof narrative.tailored_pattern === "string" ? narrative.tailored_pattern : null);
  const tailoredAction =
    report?.tailored_action
    ?? (typeof narrative.tailored_action === "string" ? narrative.tailored_action : null);
  return { tailoredPattern, tailoredAction };
}

function recapKey(entry: {
  type: ReviewType;
  periodYear: number;
  periodWeek?: number;
  periodMonth?: number;
  periodQuarter?: number;
}) {
  return [
    entry.type,
    entry.periodYear,
    entry.periodQuarter ?? "",
    entry.periodMonth ?? "",
    entry.periodWeek ?? "",
  ].join(":");
}

function buildRecapLabel(entry: DashboardRecapEntry) {
  if (entry.type === "weekly") return `Week ${entry.periodWeek} Review`;
  if (entry.type === "monthly") return `${monthLabel(entry.periodYear, entry.periodMonth ?? 1)} Review`;
  if (entry.type === "quarterly") return `Q${entry.periodQuarter} ${entry.periodYear} Review`;
  return `${entry.periodYear} Review`;
}

function weekContextFromEntry(entry: DashboardRecapEntry, weekStartsOn: "sunday" | "monday") {
  const reviewWeek = entry.periodWeek ?? 1;
  const weekOneStart = startOfLocalWeek(new Date(entry.periodYear, 0, 1), weekStartsOn);
  const reviewWeekStart = new Date(weekOneStart);
  reviewWeekStart.setDate(reviewWeekStart.getDate() + (reviewWeek - 1) * 7);
  const nextWeekStart = new Date(reviewWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  return {
    reviewYear: entry.periodYear,
    reviewWeek,
    nextYear: nextWeekStart.getFullYear(),
    nextWeek: weekNumberForDate(nextWeekStart, weekStartsOn),
    nextMonth: nextWeekStart.getMonth() + 1,
  };
}

function monthContextFromEntry(entry: DashboardRecapEntry) {
  const reviewMonth = entry.periodMonth ?? 1;
  const nextMonthDate = new Date(entry.periodYear, reviewMonth, 1);
  return {
    reviewYear: entry.periodYear,
    reviewMonth,
    nextYear: nextMonthDate.getFullYear(),
    nextMonth: nextMonthDate.getMonth() + 1,
  };
}

function quarterContextFromEntry(entry: DashboardRecapEntry) {
  const reviewQuarter = entry.periodQuarter ?? 1;
  const nextQuarter = reviewQuarter === 4 ? 1 : (reviewQuarter + 1) as 1 | 2 | 3 | 4;
  const nextYear = reviewQuarter === 4 ? entry.periodYear + 1 : entry.periodYear;
  return {
    reviewYear: entry.periodYear,
    reviewQuarter,
    nextYear,
    nextQuarter,
  };
}

function yearContextFromEntry(entry: DashboardRecapEntry) {
  return {
    reviewYear: entry.periodYear,
    nextYear: entry.periodYear + 1,
  };
}

function buildDraftRowKeys(draft: PeriodPlanDraft) {
  const next = new Set<string>();
  draft.main_goals?.forEach((_, index) => next.add(`m:${index}`));
  draft.secondary_goals?.forEach((_, index) => next.add(`s:${index}`));
  return next;
}

function normalizePlanDraft(draft: PeriodPlanDraft): PeriodPlanDraft {
  return {
    ...draft,
    main_goals: (draft.main_goals ?? []).slice(0, MAX_PERIOD_MAIN_GOALS),
    secondary_goals: draft.secondary_goals ?? [],
  };
}

function reviewQueueSignature(entries: ReviewCandidate[]) {
  return entries.map((entry) => entry.key).join("|");
}
function normalizePlanGoals(draft: PeriodPlanDraft, selectedKeys: Set<string>): PeriodPlanGoalPayload[] {
  const goals: PeriodPlanGoalPayload[] = [];
  (draft.main_goals ?? []).slice(0, MAX_PERIOD_MAIN_GOALS).forEach((goal, index) => {
    if (!selectedKeys.has(`m:${index}`)) return;
    goals.push({
      title: goal.title,
      description: goal.description,
      estimated_effort: goal.estimated_effort,
      target_date: goal.target_date,
      priority: "high",
      is_main: true,
    });
  });
  draft.secondary_goals?.forEach((goal, index) => {
    if (!selectedKeys.has(`s:${index}`)) return;
    goals.push({
      title: goal.title,
      description: goal.description,
      estimated_effort: goal.estimated_effort,
      target_date: goal.target_date,
      priority: "medium",
      is_main: false,
    });
  });
  return goals;
}

function promptHeading(type: ReviewType) {
  if (type === "weekly") return "Your week is ready for review.";
  if (type === "monthly") return "Your month is ready for review.";
  if (type === "quarterly") return "Your quarter is ready for review.";
  return "Your year is ready for review.";
}

function planHeading(type: ReviewType) {
  if (type === "weekly") return "Shape next week.";
  if (type === "monthly") return "Shape next month.";
  if (type === "quarterly") return "Shape next quarter.";
  return "Shape next year.";
}

function nextMoveLabel(type: ReviewType) {
  if (type === "weekly") return "Next week";
  if (type === "monthly") return "Next month";
  if (type === "quarterly") return "Next quarter";
  return "Next year";
}

function planButtonLabel(type: ReviewType) {
  if (type === "weekly") return "Plan next week";
  if (type === "monthly") return "Plan next month";
  if (type === "quarterly") return "Prepare next quarter";
  return "Prepare next year";
}

function returnHomeLabel(type: ReviewType) {
  if (type === "weekly") return "Return home for next week";
  if (type === "monthly") return "Return home for next month";
  if (type === "quarterly") return "Return home for next quarter";
  return "Return home for next year";
}

function aiButtonLabel(type: ReviewType) {
  if (type === "weekly") return "AI Generate week";
  return "AI Generate month";
}

function supportCopy(type: ReviewType) {
  if (type === "weekly") {
    return "Keep only the main weekly goal and the supporting moves that actually deserve space on the board.";
  }
  if (type === "monthly") {
    return "Group the month around a few meaningful anchors, then let the board carry the detail.";
  }
  if (type === "quarterly") {
    return "Use the next quarter handoff to check whether the upcoming months already have a clear backbone.";
  }
  return "Use the next year handoff to check whether the yearly outcomes are defined clearly enough to break down.";
}

function startOfNextWeekIso(entry: DashboardRecapEntry, weekStartsOn: "sunday" | "monday") {
  const reviewWeek = entry.periodWeek ?? 1;
  const weekOneStart = startOfLocalWeek(new Date(entry.periodYear, 0, 1), weekStartsOn);
  const nextWeekStart = new Date(weekOneStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + reviewWeek * 7);
  return `${nextWeekStart.getFullYear()}-${String(nextWeekStart.getMonth() + 1).padStart(2, "0")}-${String(nextWeekStart.getDate()).padStart(2, "0")}`;
}

function firstDayOfNextMonthIso(entry: DashboardRecapEntry) {
  const reviewMonth = entry.periodMonth ?? 1;
  const nextMonthDate = new Date(entry.periodYear, reviewMonth, 1);
  return `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
}

function firstDayOfNextQuarterIso(entry: DashboardRecapEntry) {
  const reviewQuarter = entry.periodQuarter ?? 1;
  const nextQuarterStartMonth = reviewQuarter === 4 ? 1 : (reviewQuarter * 3) + 1;
  const nextQuarterYear = reviewQuarter === 4 ? entry.periodYear + 1 : entry.periodYear;
  return `${nextQuarterYear}-${String(nextQuarterStartMonth).padStart(2, "0")}-01`;
}

function firstDayOfNextYearIso(entry: DashboardRecapEntry) {
  return `${entry.periodYear + 1}-01-01`;
}

function cardPalette(tone: "default" | "soft" | "accent") {
  if (tone === "accent") {
    return {
      background: "linear-gradient(180deg, rgba(0,108,74,0.08), rgba(0,108,74,0.03))",
      border: "1px solid rgba(0,108,74,0.12)",
    };
  }
  if (tone === "soft") {
    return {
      background: "#f8fbf9",
      border: "1px solid rgba(0,0,0,0.05)",
    };
  }
  return {
    background: "white",
    border: "1px solid rgba(0,0,0,0.06)",
  };
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  tone = "default",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "soft" | "accent";
}) {
  return (
    <section className="rounded-[26px] p-5" style={cardPalette(tone)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
        {eyebrow}
      </p>
      <h3 className="mt-2 text-base font-extrabold" style={{ color: "#1a1f1e" }}>
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "#6f817a" }}>
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Subsection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function EmptyBlock({ copy }: { copy: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-5 text-sm"
      style={{ background: "white", border: "1.5px dashed rgba(0,108,74,0.16)", color: "#8a9e97" }}
    >
      {copy}
    </div>
  );
}

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold"
      style={{ background: "white", color: "#1a1f1e", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      {children}
    </span>
  );
}

function StepIndicator({
  screen,
}: {
  screen: "review" | "plan";
}) {
  const steps = [
    { key: "review", label: "Review", description: "See the signal" },
    { key: "plan", label: "Plan", description: "Shape next period" },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const active = screen === step.key;
        const complete = screen === "plan" && step.key === "review";
        return (
          <div
            key={step.key}
            className="flex min-w-[160px] items-center gap-3 rounded-2xl px-3.5 py-3"
            style={{
              background: active ? "rgba(0,108,74,0.08)" : "#f7faf8",
              border: active ? "1px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                background: active || complete ? "#006c4a" : "white",
                color: active || complete ? "white" : "#8a9e97",
                border: active || complete ? "none" : "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {complete ? (
                <span className="material-symbols-outlined text-[16px]">check</span>
              ) : (
                index + 1
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: active ? "#006c4a" : "#8a9e97" }}>
                Step {index + 1}
              </p>
              <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                {step.label}
              </p>
              <p className="text-[11px]" style={{ color: "#6f817a" }}>
                {step.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GoalPreviewCard({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  meta?: string[];
  actions?: React.ReactNode;
}) {
  const visibleMeta = meta?.filter(Boolean) ?? [];
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
            {title}
          </p>
          {description && (
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#6f817a" }}>
              {description}
            </p>
          )}
          {visibleMeta.length > 0 && (
            <p className="mt-2 text-[11px]" style={{ color: "#8a9e97" }}>
              {visibleMeta.join(" • ")}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

function SelectableDraftCard({
  goal,
  selected,
  onToggle,
}: {
  goal: DraftGoal;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = [goal.estimated_effort, formatTargetDate(goal.target_date)].filter(Boolean) as string[];
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-[border,box-shadow]"
      style={{
        background: "white",
        border: selected ? "1.5px solid rgba(0,108,74,0.32)" : "1px solid rgba(0,0,0,0.07)",
        boxShadow: selected ? "0 6px 18px rgba(0,108,74,0.08)" : "none",
      }}
    >
      <span
        className="material-symbols-outlined mt-0.5 shrink-0 text-[19px]"
        style={{ color: selected ? "#006c4a" : "#c3cfc9" }}
      >
        {selected ? "check_circle" : "radio_button_unchecked"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
          {goal.title}
        </p>
        {goal.description && (
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#6f817a" }}>
            {goal.description}
          </p>
        )}
        {meta.length > 0 && (
          <p className="mt-2 text-[11px]" style={{ color: "#8a9e97" }}>
            {meta.join(" • ")}
          </p>
        )}
      </div>
    </button>
  );
}

function OverviewStat({
  label,
  value,
  tone = "#1a1f1e",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-snug" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

function formatWeeklyGoalMeta(goal: WeeklyGoal) {
  return [goal.workload].filter(Boolean) as string[];
}

function formatMonthlyGoalMeta(goal: MonthlyGoal) {
  return [goal.workload, formatTargetDate(goal.targetDate)].filter(Boolean) as string[];
}

function formatYearlyGoalMeta(goal: YearlyGoal, monthlyCount: number) {
  return [
    monthlyCount > 0 ? `${monthlyCount} monthly link${monthlyCount === 1 ? "" : "s"}` : "No monthly breakdown yet",
    formatTargetDate(goal.targetDate) ? `Target ${formatTargetDate(goal.targetDate)}` : null,
  ].filter(Boolean) as string[];
}

function formatHabitFrequencyLabel(value: FoundationalHabit["frequency"]) {
  if (value === "3x_week") return "3x per week";
  if (value === "5x_week") return "5x per week";
  if (value === "weekdays") return "Weekdays";
  if (value === "weekends") return "Weekends";
  return "Daily";
}

export function DashboardPeriodReviewPrompts() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    sessionId,
    onboardingComplete,
    kickoffPending,
    pendingRecaps,
    sessionWeekStartsOn,
    yearlyGoals,
    weeklyGoals,
    monthlyGoals,
    categories,
    habits,
    addWeeklyGoal,
    updateWeeklyGoal,
    addMonthlyGoal,
    updateMonthlyGoal,
    addHabit,
    updateHabit,
    removeHabit,
    removeWeeklyGoal,
    removeMonthlyGoal,
    generateWeeklyReport,
    generateMonthlyReport,
    generateQuarterlyReport,
    generateYearlyReport,
    generateWeeklyPlan,
    generateMonthlyPlan,
    approveWeeklyPlan,
    approveMonthlyPlan,
    setActiveDashboardDate,
    loadDashboard,
  } = useAppStore(
    useShallow((state) => ({
      sessionId: state.sessionId,
      onboardingComplete: state.onboardingComplete,
      kickoffPending: state.kickoffPending,
      pendingRecaps: state.pendingRecaps,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
      yearlyGoals: state.yearlyGoals,
      weeklyGoals: state.weeklyGoals,
      monthlyGoals: state.monthlyGoals,
      categories: state.categories,
      habits: state.habits,
      addWeeklyGoal: state.addWeeklyGoal,
      updateWeeklyGoal: state.updateWeeklyGoal,
      addMonthlyGoal: state.addMonthlyGoal,
      updateMonthlyGoal: state.updateMonthlyGoal,
      addHabit: state.addHabit,
      updateHabit: state.updateHabit,
      removeHabit: state.removeHabit,
      removeWeeklyGoal: state.removeWeeklyGoal,
      removeMonthlyGoal: state.removeMonthlyGoal,
      generateWeeklyReport: state.generateWeeklyReport,
      generateMonthlyReport: state.generateMonthlyReport,
      generateQuarterlyReport: state.generateQuarterlyReport,
      generateYearlyReport: state.generateYearlyReport,
      generateWeeklyPlan: state.generateWeeklyPlan,
      generateMonthlyPlan: state.generateMonthlyPlan,
      approveWeeklyPlan: state.approveWeeklyPlan,
      approveMonthlyPlan: state.approveMonthlyPlan,
      setActiveDashboardDate: state.setActiveDashboardDate,
      loadDashboard: state.loadDashboard,
    })),
  );

  const [candidate, setCandidate] = useState<ReviewCandidate | null>(null);
  const [report, setReport] = useState<ApiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<"review" | "plan">("review");
  const [planLoading, setPlanLoading] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planDraft, setPlanDraft] = useState<PeriodPlanDraft | null>(null);
  const [draftKeys, setDraftKeys] = useState<Set<string>>(() => new Set());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [goalEditor, setGoalEditor] = useState<GoalEditorState>(null);
  const [habitEditor, setHabitEditor] = useState<HabitEditorState>(null);
  const [yearGoalModalOpen, setYearGoalModalOpen] = useState(false);
  /** Weekly/monthly: saved-plan tooling appears only after AI generate/save or adding a goal from the editor. */
  const [planSectionUnlocked, setPlanSectionUnlocked] = useState(false);
  const [now, setNow] = useState(() => new Date());
  /** Bumps when the modal closes so in-flight AI/report calls cannot mutate state afterward. */
  const modalAiEpochRef = useRef(0);
  const forcedReview = parseForcedReview(searchParams?.get("review_test") ?? null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setScreen("review");
    setPlanDraft(null);
    setDraftKeys(new Set());
    setSavedNotice(null);
    setGoalEditor(null);
    setHabitEditor(null);
    setYearGoalModalOpen(false);
    setPlanSectionUnlocked(false);
  }, [candidate?.key]);

  const weekContext = useMemo(() => getWeekContext(now, sessionWeekStartsOn), [now, sessionWeekStartsOn]);
  const monthContext = useMemo(() => getMonthContext(now), [now]);
  const quarterContext = useMemo(() => getQuarterContext(now), [now]);
  const yearContext = useMemo(() => getYearContext(now), [now]);
  const activeHabits = useMemo(() => habits.filter((habit) => habit.active), [habits]);
  const activeWeekContext = useMemo(
    () => (candidate?.type === "weekly" ? weekContextFromEntry(candidate.entry, sessionWeekStartsOn) : null),
    [candidate, sessionWeekStartsOn],
  );
  const activeMonthContext = useMemo(
    () => (candidate?.type === "monthly" ? monthContextFromEntry(candidate.entry) : null),
    [candidate],
  );
  const activeQuarterContext = useMemo(
    () => (candidate?.type === "quarterly" ? quarterContextFromEntry(candidate.entry) : null),
    [candidate],
  );
  const activeYearContext = useMemo(
    () => (candidate?.type === "yearly" ? yearContextFromEntry(candidate.entry) : null),
    [candidate],
  );
  const nextQuarterMonths = useMemo(
    () => (activeQuarterContext ? quarterMonths(activeQuarterContext.nextQuarter) : []),
    [activeQuarterContext],
  );
  const nextWeekGoals = useMemo(
    () =>
      activeWeekContext
        ? weeklyGoals.filter(
            (goal) => goal.year === activeWeekContext.nextYear && goal.weekNumber === activeWeekContext.nextWeek,
          )
        : [],
    [activeWeekContext, weeklyGoals],
  );
  const nextWeekMonth = useMemo(() => activeWeekContext?.nextMonth ?? monthContext.nextMonth, [activeWeekContext, monthContext.nextMonth]);
  const nextMonthGoals = useMemo(
    () =>
      activeMonthContext
        ? monthlyGoals.filter(
            (goal) => goal.year === activeMonthContext.nextYear && goal.month === activeMonthContext.nextMonth,
          )
        : [],
    [activeMonthContext, monthlyGoals],
  );
  const nextQuarterGoals = useMemo(
    () =>
      activeQuarterContext
        ? monthlyGoals.filter(
            (goal) => goal.year === activeQuarterContext.nextYear && nextQuarterMonths.includes(goal.month),
          )
        : [],
    [activeQuarterContext, monthlyGoals, nextQuarterMonths],
  );
  const nextYearGoals = useMemo(
    () =>
      activeYearContext
        ? yearlyGoals.filter((goal) => goal.year === activeYearContext.nextYear)
        : [],
    [activeYearContext, yearlyGoals],
  );
  const candidateMonthlyGoalsForWeekly = useMemo(
    () =>
      monthlyGoals.filter(
        (goal) =>
          goal.year === (activeWeekContext?.nextYear ?? weekContext.nextYear) &&
          goal.month === (nextWeekGoals[0]?.month ?? nextWeekMonth),
      ),
    [activeWeekContext, monthlyGoals, nextWeekGoals, nextWeekMonth, weekContext.nextYear],
  );

  useEffect(() => {
    if (!sessionId || !onboardingComplete || kickoffPending || candidate) return;
    const forcedEntry =
      forcedReview === "weekly"
        ? {
            type: "weekly" as const,
            periodYear: weekContext.reviewYear,
            periodWeek: weekContext.reviewWeek,
            firedAt: new Date().toISOString(),
          }
        : forcedReview === "monthly"
          ? {
              type: "monthly" as const,
              periodYear: monthContext.reviewYear,
              periodMonth: monthContext.reviewMonth,
              firedAt: new Date().toISOString(),
            }
          : forcedReview === "quarterly"
            ? {
                type: "quarterly" as const,
                periodYear: quarterContext.reviewYear,
                periodQuarter: quarterContext.reviewQuarter,
                firedAt: new Date().toISOString(),
              }
            : forcedReview === "yearly"
              ? {
                  type: "yearly" as const,
                  periodYear: yearContext.reviewYear,
                  firedAt: new Date().toISOString(),
                }
              : null;
    const nextEntry = forcedEntry ?? pendingRecaps[0];
    if (!nextEntry) return;

    const chosen: ReviewCandidate = {
      type: nextEntry.type,
      key: recapKey(nextEntry),
      periodLabel: buildRecapLabel(nextEntry),
      entry: nextEntry,
      generate: async () => {
        if (nextEntry.type === "weekly" && nextEntry.periodWeek) {
          return generateWeeklyReport(nextEntry.periodYear, nextEntry.periodWeek);
        }
        if (nextEntry.type === "monthly" && nextEntry.periodMonth) {
          return generateMonthlyReport(nextEntry.periodYear, nextEntry.periodMonth);
        }
        if (nextEntry.type === "quarterly" && nextEntry.periodQuarter) {
          return generateQuarterlyReport(nextEntry.periodYear, nextEntry.periodQuarter);
        }
        if (nextEntry.type === "yearly") {
          return generateYearlyReport(nextEntry.periodYear);
        }
        return null;
      },
    };
    const epoch = modalAiEpochRef.current;
    setCandidate(chosen);
    setLoading(true);
    setError(null);
    chosen
      .generate()
      .then((generated) => {
        if (epoch !== modalAiEpochRef.current) return;
        setReport(generated);
        if (!generated) {
          const banner = useAppStore.getState().syncError;
          const detail =
            banner &&
            (banner.includes("Weekly report") ||
              banner.includes("Monthly report") ||
              banner.includes("Quarterly report") ||
              banner.includes("Yearly report"))
              ? banner
              : "We couldn’t generate this report yet. You can try again once more data is available.";
          setError(detail);
        }
      })
      .finally(() => {
        if (epoch !== modalAiEpochRef.current) return;
        setLoading(false);
      });
  }, [
    candidate,
    forcedReview,
    generateMonthlyReport,
    generateQuarterlyReport,
    generateWeeklyReport,
    generateYearlyReport,
    kickoffPending,
    onboardingComplete,
    pendingRecaps,
    sessionId,
    weekContext.reviewWeek,
    weekContext.reviewYear,
    monthContext.reviewMonth,
    monthContext.reviewYear,
    quarterContext.reviewQuarter,
    quarterContext.reviewYear,
    yearContext.reviewYear,
  ]);

  const selectedDraftCount = useMemo(() => {
    if (!planDraft) return 0;
    let count = 0;
    planDraft.main_goals?.forEach((_, index) => {
      if (draftKeys.has(`m:${index}`)) count += 1;
    });
    planDraft.secondary_goals?.forEach((_, index) => {
      if (draftKeys.has(`s:${index}`)) count += 1;
    });
    return count;
  }, [draftKeys, planDraft]);

  if (!candidate) return null;
  const activeCandidate = candidate;

  const narrative = extractNarrative(report);
  const { tailoredPattern, tailoredAction } = extractTailoredInsight(report);

  const nextPeriodLabel =
    activeCandidate.type === "weekly" && activeWeekContext
      ? `Week ${activeWeekContext.nextWeek}`
      : activeCandidate.type === "monthly" && activeMonthContext
      ? monthLabel(activeMonthContext.nextYear, activeMonthContext.nextMonth)
      : activeCandidate.type === "quarterly" && activeQuarterContext
      ? `${quarterLabel(activeQuarterContext.nextQuarter)} ${activeQuarterContext.nextYear}`
      : `${activeYearContext?.nextYear ?? yearContext.nextYear}`;

  const existingMainGoals =
    activeCandidate.type === "weekly"
      ? nextWeekGoals.filter((goal) => goal.isMain).map((goal) => ({
          key: goal.id,
          goal,
          title: goal.title,
          description: goal.description,
          meta: formatWeeklyGoalMeta(goal),
        }))
      : activeCandidate.type === "monthly"
      ? nextMonthGoals.filter((goal) => goal.isMain).map((goal) => ({
          key: goal.id,
          goal,
          title: goal.title,
          description: goal.description,
          meta: formatMonthlyGoalMeta(goal),
        }))
      : [];

  const existingSecondaryGoals =
    activeCandidate.type === "weekly"
      ? nextWeekGoals.filter((goal) => !goal.isMain).map((goal) => ({
          key: goal.id,
          goal,
          title: goal.title,
          description: goal.description,
          meta: formatWeeklyGoalMeta(goal),
        }))
      : activeCandidate.type === "monthly"
      ? nextMonthGoals.filter((goal) => !goal.isMain).map((goal) => ({
          key: goal.id,
          goal,
          title: goal.title,
          description: goal.description,
          meta: formatMonthlyGoalMeta(goal),
        }))
      : [];

  const mainGoalCapReached = existingMainGoals.length >= MAX_PERIOD_MAIN_GOALS;

  const nextQuarterCards = nextQuarterMonths.map((month) => {
    const goals = nextQuarterGoals.filter((goal) => goal.month === month);
    const mainGoal = goals.find((goal) => goal.isMain) ?? goals[0] ?? null;
    return {
      month,
      label: monthLabel(activeQuarterContext?.nextYear ?? quarterContext.nextYear, month).split(" ")[0],
      mainGoal,
      supportCount: goals.filter((goal) => !mainGoal || goal.id !== mainGoal.id).length,
    };
  });

  const monthlyByYearly = new Map<string, MonthlyGoal[]>();
  for (const goal of monthlyGoals) {
    if (!goal.yearlyGoalId) continue;
    const list = monthlyByYearly.get(goal.yearlyGoalId) ?? [];
    list.push(goal);
    monthlyByYearly.set(goal.yearlyGoalId, list);
  }

  const nextHomeDate =
    activeCandidate.type === "weekly"
      ? startOfNextWeekIso(activeCandidate.entry, sessionWeekStartsOn)
      : activeCandidate.type === "monthly"
      ? firstDayOfNextMonthIso(activeCandidate.entry)
      : activeCandidate.type === "quarterly"
      ? firstDayOfNextQuarterIso(activeCandidate.entry)
      : firstDayOfNextYearIso(activeCandidate.entry);

  function acknowledgePrompt(closedCandidate: ReviewCandidate) {
    if (!sessionId) return;
    const nextPending = useAppStore
      .getState()
      .pendingRecaps
      .filter((entry) => recapKey(entry) !== recapKey(closedCandidate.entry));
    useAppStore.setState({ pendingRecaps: nextPending });
    void sessionsApi
      .get(sessionId)
      .then((session) => {
        const backendPending = (session.pending_recaps ?? []).filter((entry) => {
          const mapped: DashboardRecapEntry = {
            type: entry.type,
            periodYear: entry.period_year,
            periodWeek: entry.period_week,
            periodMonth: entry.period_month,
            periodQuarter: entry.period_quarter,
            firedAt: entry.fired_at,
          };
          return recapKey(mapped) !== recapKey(closedCandidate.entry);
        });
        const handled = Array.from(new Set([...(session.handled_recaps ?? []), recapKey(closedCandidate.entry)]));
        return sessionsApi.update(sessionId, {
          pending_recaps: backendPending.length ? backendPending : [],
          handled_recaps: handled,
        });
      })
      .catch(() => {
        /* best effort; the local queue has already advanced */
      });
  }

  function closePrompt() {
    modalAiEpochRef.current += 1;
    if (candidate) acknowledgePrompt(candidate);
    setCandidate(null);
    setReport(null);
    setError(null);
    setScreen("review");
    setPlanDraft(null);
    setDraftKeys(new Set());
    setSavedNotice(null);
    setGoalEditor(null);
    setHabitEditor(null);
    setYearGoalModalOpen(false);
    setPlanSectionUnlocked(false);
    setLoading(false);
    setPlanLoading(false);
    setPlanSaving(false);
  }

  function toggleDraftRow(key: string) {
    setDraftKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openMainGoalEditor() {
    setPlanSectionUnlocked(true);
    if (mainGoalCapReached) {
      setSavedNotice("Main goals are capped at 3 for each period.");
      return;
    }
    if (activeCandidate.type === "weekly") {
      setGoalEditor({ type: "weekly", defaultIsMain: true });
      return;
    }
    if (activeCandidate.type === "monthly") {
      setGoalEditor({ type: "monthly", defaultIsMain: true });
    }
  }

  function openSupportingGoalEditor() {
    setPlanSectionUnlocked(true);
    if (activeCandidate.type === "weekly") {
      setGoalEditor({ type: "weekly", defaultIsMain: false });
      return;
    }
    if (activeCandidate.type === "monthly") {
      setGoalEditor({ type: "monthly", defaultIsMain: false });
    }
  }

  function openExistingGoalEditor(goal: WeeklyGoal | MonthlyGoal) {
    setPlanSectionUnlocked(true);
    if (activeCandidate.type === "weekly") {
      setGoalEditor({ type: "weekly", goal: goal as WeeklyGoal });
      return;
    }
    if (activeCandidate.type === "monthly") {
      setGoalEditor({ type: "monthly", goal: goal as MonthlyGoal });
    }
  }

  function handleGoalEditorSubmitWeekly(data: {
    title: string;
    monthlyGoalId?: string;
    targetDay?: string;
    description: string;
    workload: string;
  }) {
    if (goalEditor?.type !== "weekly" || !activeWeekContext) return;
    const payload = {
      title: data.title,
      monthlyGoalId: data.monthlyGoalId || undefined,
      targetDay: data.targetDay || undefined,
      description: data.description || undefined,
      workload: data.workload || undefined,
      isMain: goalEditor.goal?.isMain ?? goalEditor.defaultIsMain ?? true,
    };

    if (goalEditor.goal) {
      updateWeeklyGoal(goalEditor.goal.id, payload);
      setSavedNotice("Weekly goal updated.");
    } else {
      addWeeklyGoal({
        ...payload,
        weekNumber: activeWeekContext.nextWeek,
        month: nextWeekGoals[0]?.month ?? nextWeekMonth,
        year: activeWeekContext.nextYear,
        status: "active",
        progress: 0,
      });
      setSavedNotice("Weekly goal added to the saved plan.");
      setPlanSectionUnlocked(true);
    }
    setGoalEditor(null);
  }

  function handleGoalEditorSubmitMonthly(
    title: string,
    categoryId: string,
    yearlyGoalId: string,
    targetDate: string,
    description: string,
    workload: string,
  ) {
    if (goalEditor?.type !== "monthly" || !activeMonthContext) return;
    const payload = {
      title,
      categoryId: categoryId || undefined,
      yearlyGoalId: yearlyGoalId || undefined,
      targetDate: targetDate || undefined,
      description: description || undefined,
      workload: workload || undefined,
      isMain: goalEditor.goal?.isMain ?? goalEditor.defaultIsMain ?? true,
      priority: (goalEditor.goal?.isMain ?? goalEditor.defaultIsMain ?? true) ? "high" as const : "medium" as const,
    };

    if (goalEditor.goal) {
      updateMonthlyGoal(goalEditor.goal.id, payload);
      setSavedNotice("Monthly goal updated.");
    } else {
      addMonthlyGoal({
        ...payload,
        month: activeMonthContext.nextMonth,
        year: activeMonthContext.nextYear,
        status: "active",
        progress: 0,
      });
      setSavedNotice("Monthly goal added to the saved plan.");
      setPlanSectionUnlocked(true);
    }
    setGoalEditor(null);
  }

  function handleHabitSubmit(name: string, icon: string, categoryId: string, frequency: FoundationalHabit["frequency"]) {
    setPlanSectionUnlocked(true);
    if (habitEditor?.habit) {
      updateHabit(habitEditor.habit.id, { name, icon, categoryId: categoryId || undefined, frequency, active: true });
      setSavedNotice("Foundational habit updated.");
    } else {
      addHabit({ name, icon, categoryId: categoryId || undefined, frequency, completedToday: false, streak: 0, active: true });
      setSavedNotice("Foundational habit added.");
    }
    setHabitEditor(null);
  }

  function removeExistingGoal(goalId: string) {
    if (activeCandidate.type === "weekly") {
      removeWeeklyGoal(goalId);
      setSavedNotice("That weekly goal was removed from the visible plan.");
      return;
    }
    if (activeCandidate.type === "monthly") {
      removeMonthlyGoal(goalId);
      setSavedNotice("That monthly goal was removed from the visible plan.");
    }
  }

  function removeExistingHabit(habitId: string) {
    removeHabit(habitId);
    setSavedNotice("Foundational habit removed.");
  }

  async function handleGenerateDraft() {
    if (activeCandidate.type !== "weekly" && activeCandidate.type !== "monthly") return;
    const epoch = modalAiEpochRef.current;
    setPlanLoading(true);
    setError(null);
    setSavedNotice(null);
    try {
      if (activeCandidate.type === "weekly") {
        if (!activeWeekContext) throw new Error("Missing next-week context.");
        const generated = await generateWeeklyPlan(activeWeekContext.nextYear, activeWeekContext.nextWeek);
        if (epoch !== modalAiEpochRef.current) return;
        if (!generated.ok) {
          const banner = useAppStore.getState().syncError;
          const apiDetail =
            generated.code === "api_error" &&
            banner &&
            banner.includes("Weekly plan (AI generate)")
              ? banner
              : null;
          const msg =
            generated.code === "no_session"
              ? "Sign in or refresh so your session is active, then try again."
              : generated.code === "invalid_week"
                ? "That week isn’t valid for planning."
                : generated.code === "monthly_sync_failed"
                  ? "Monthly goals have not finished syncing yet, so the weekly AI draft cannot be generated cleanly."
                  : generated.code === "no_monthly_on_server"
                    ? "Save monthly goals for this week’s month on the board first, then try AI again."
                    : apiDetail ?? "We couldn’t generate the next week yet.";
          throw new Error(msg);
        }
        const draft = normalizePlanDraft(generated.draft as PeriodPlanDraft);
        setPlanDraft(draft);
        setDraftKeys(buildDraftRowKeys(draft));
        setPlanSectionUnlocked(true);
        return;
      }

      if (!activeMonthContext) throw new Error("Missing next-month context.");
      const generated = await generateMonthlyPlan(activeMonthContext.nextYear, activeMonthContext.nextMonth);
      if (epoch !== modalAiEpochRef.current) return;
      if (!generated.ok && generated.code === "no_yearly_on_server") {
        throw new Error("The next month needs yearly goals saved first before AI can turn them into a monthly draft.");
      }
      if (!generated.ok && generated.code === "yearly_sync_failed") {
        throw new Error("Yearly goals have not finished syncing yet, so the monthly AI draft cannot be generated cleanly.");
      }
      if (!generated.ok && generated.code === "api_error") {
        const banner = useAppStore.getState().syncError;
        throw new Error(
          banner && banner.includes("Monthly plan (AI generate)")
            ? banner
            : "We couldn’t generate the next month yet.",
        );
      }
      if (!generated.ok) {
        throw new Error("We couldn’t generate the next month yet.");
      }
      const draft = normalizePlanDraft(generated.draft as PeriodPlanDraft);
      setPlanDraft(draft);
      setDraftKeys(buildDraftRowKeys(draft));
      setPlanSectionUnlocked(true);
    } catch (err) {
      if (epoch === modalAiEpochRef.current) {
        setError(err instanceof Error ? err.message : "Could not generate the next plan.");
      }
    } finally {
      if (epoch === modalAiEpochRef.current) setPlanLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!planDraft || selectedDraftCount === 0) return;
    const epoch = modalAiEpochRef.current;
    setPlanSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const goals = normalizePlanGoals(planDraft, draftKeys);
      if (activeCandidate.type === "weekly") {
        if (!activeWeekContext) throw new Error("Missing next-week context.");
        const ok = await approveWeeklyPlan(activeWeekContext.nextYear, activeWeekContext.nextWeek, goals);
        if (!ok) throw new Error("Could not save the next weekly plan.");
        if (epoch !== modalAiEpochRef.current) return;
        setSavedNotice("Next week is now saved on the board.");
      } else if (activeCandidate.type === "monthly") {
        if (!activeMonthContext) throw new Error("Missing next-month context.");
        const ok = await approveMonthlyPlan(activeMonthContext.nextYear, activeMonthContext.nextMonth, goals);
        if (!ok) throw new Error("Could not save the next monthly plan.");
        if (epoch !== modalAiEpochRef.current) return;
        setSavedNotice("Next month is now saved on the board.");
      }
      if (epoch !== modalAiEpochRef.current) return;
      setPlanDraft(null);
      setDraftKeys(new Set());
      setPlanSectionUnlocked(true);
    } catch (err) {
      if (epoch === modalAiEpochRef.current) {
        setError(err instanceof Error ? err.message : "Could not save the AI draft.");
      }
    } finally {
      if (epoch === modalAiEpochRef.current) setPlanSaving(false);
    }
  }

  function handleReturnHome() {
    closePrompt();
    setActiveDashboardDate(nextHomeDate);
    void loadDashboard(nextHomeDate);
    startTransition(() => {
      router.push("/dashboard");
    });
  }

  const reviewBody = (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Context"
        title={activeCandidate.periodLabel}
        description="Keep the signal tight: what happened, what mattered, and what should carry forward."
        tone="accent"
      >
        {loading ? (
          <p className="text-sm font-medium" style={{ color: "#4f5d58" }}>
            Preparing your review...
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1a1f1e" }}>
              {narrative.summary}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
              {narrative.reflection}
            </p>
            {tailoredPattern && tailoredAction && (
              <div
                className="rounded-2xl px-4 py-4"
                style={{ background: "#003d2b", color: "white", boxShadow: "0 10px 24px rgba(0,61,43,0.18)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.72)" }}>
                  Pattern to address
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed">
                  {tailoredPattern}
                </p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.72)" }}>
                  Action to carry forward
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {tailoredAction}
                </p>
              </div>
            )}
            {narrative.nextFocus && (
              <div
                className="rounded-2xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.76)", border: "1px solid rgba(0,108,74,0.08)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Carry forward
                </p>
                <p className="mt-1.5 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                  {narrative.nextFocus}
                </p>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Next move"
        title={nextMoveLabel(activeCandidate.type)}
        description={supportCopy(activeCandidate.type)}
        tone="soft"
      >
        <div className="flex flex-wrap gap-2">
          <InfoPill>{nextPeriodLabel}</InfoPill>
          <InfoPill>{planButtonLabel(activeCandidate.type)}</InfoPill>
        </div>
      </SectionCard>
    </div>
  );

  const planningBody = (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Context"
        title={nextPeriodLabel}
        description={supportCopy(activeCandidate.type)}
        tone="accent"
      >
        <div className="space-y-3">
          {tailoredAction ? (
            <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1a1f1e" }}>
              {tailoredAction}
            </p>
          ) : narrative.nextFocus ? (
            <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1a1f1e" }}>
              {narrative.nextFocus}
            </p>
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
              {narrative.reflection}
            </p>
          )}
          <p className="text-xs leading-relaxed" style={{ color: "#6f817a" }}>
            {activeCandidate.type === "weekly" || activeCandidate.type === "monthly"
              ? "Start however you want: generate a draft or build the period manually. Either way, the saved board stays separate from the AI draft."
              : "This handoff stays light on purpose: check whether the structure already exists, then open the full board for deeper shaping."}
          </p>
        </div>
      </SectionCard>

      {(activeCandidate.type === "weekly" || activeCandidate.type === "monthly") && (
        <SectionCard
          eyebrow="AI support"
          title={planSectionUnlocked ? "AI support and manual start" : "Choose how to start"}
          description={
            planSectionUnlocked && existingMainGoals.length + existingSecondaryGoals.length > 0
              ? "Saving selected AI items will replace the current saved plan for this period."
              : "Generate a draft or start adding goals manually right here."
          }
          tone="soft"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {planSectionUnlocked ? (
                <div className="flex min-w-0 flex-wrap gap-2">
                  <InfoPill>{existingMainGoals.length} main</InfoPill>
                  <InfoPill>{existingSecondaryGoals.length} supporting</InfoPill>
                  <InfoPill>{activeHabits.length} habit{activeHabits.length === 1 ? "" : "s"}</InfoPill>
                </div>
              ) : (
                <p className="min-w-0 flex-1 text-xs leading-relaxed" style={{ color: "#6f817a" }}>
                  Your AI draft appears here if you generate one. Manual adds also open the saved plan below.
                </p>
              )}
              <button
                type="button"
                onClick={handleGenerateDraft}
                disabled={planLoading}
                className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                style={{ background: "#006c4a" }}
              >
                {planLoading ? "Generating..." : aiButtonLabel(activeCandidate.type)}
                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
              </button>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                Start manually
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openMainGoalEditor}
                  disabled={mainGoalCapReached}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{
                    background: mainGoalCapReached ? "rgba(0,0,0,0.04)" : "rgba(0,108,74,0.08)",
                    color: mainGoalCapReached ? "#9ca9a4" : "#006c4a",
                  }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add main goal
                </button>
                <button
                  type="button"
                  onClick={openSupportingGoalEditor}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{ background: "#ffffff", color: "#5d6d67", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add supporting
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlanSectionUnlocked(true);
                    setHabitEditor({});
                  }}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{ background: "#ffffff", color: "#5d6d67", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add habit
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {planDraft && (activeCandidate.type === "weekly" || activeCandidate.type === "monthly") && (
        <SectionCard
          eyebrow="AI draft"
          title="Select the pieces worth keeping"
          description="This stays grouped so the layout still holds when AI returns longer content."
          tone="default"
        >
          <div className="space-y-4">
            {planDraft.reasoning && (
              <div
                className="max-h-32 overflow-y-auto rounded-2xl px-4 py-3 text-xs leading-relaxed"
                style={{ background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.05)", color: "#5d6d67" }}
              >
                {planDraft.reasoning}
              </div>
            )}

            <Subsection label="Main goals">
              {planDraft.main_goals?.length ? (
                <div className="space-y-3">
                  {planDraft.main_goals.map((goal, index) => (
                    <SelectableDraftCard
                      key={`m:${index}:${goal.title}`}
                      goal={goal}
                      selected={draftKeys.has(`m:${index}`)}
                      onToggle={() => toggleDraftRow(`m:${index}`)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyBlock copy="The draft did not return any main goals." />
              )}
            </Subsection>

            <Subsection label="Supporting goals">
              {planDraft.secondary_goals?.length ? (
                <div className="space-y-3">
                  {planDraft.secondary_goals.map((goal, index) => (
                    <SelectableDraftCard
                      key={`s:${index}:${goal.title}`}
                      goal={goal}
                      selected={draftKeys.has(`s:${index}`)}
                      onToggle={() => toggleDraftRow(`s:${index}`)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyBlock copy="The draft did not return any supporting goals." />
              )}
            </Subsection>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={planSaving || selectedDraftCount === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.22)" }}
            >
              {planSaving ? "Saving..." : `Save selected (${selectedDraftCount})`}
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </button>
          </div>
        </SectionCard>
      )}

      {planSectionUnlocked && (activeCandidate.type === "weekly" || activeCandidate.type === "monthly") && (
        <SectionCard
          eyebrow="Saved plan"
          title="Goals on your board for this period"
          description="These are the goals stored on the board—not the AI draft above. Edit here or on the full board."
          tone="soft"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <InfoPill>{existingMainGoals.length} main</InfoPill>
                <InfoPill>{existingSecondaryGoals.length} supporting</InfoPill>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openMainGoalEditor}
                  disabled={mainGoalCapReached}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{
                    background: mainGoalCapReached ? "rgba(0,0,0,0.04)" : "rgba(0,108,74,0.08)",
                    color: mainGoalCapReached ? "#9ca9a4" : "#006c4a",
                  }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add main goal
                </button>
                <button
                  type="button"
                  onClick={openSupportingGoalEditor}
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{ background: "#ffffff", color: "#5d6d67", border: "1px solid rgba(0,0,0,0.08)" }}
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Add supporting
                </button>
              </div>
            </div>

            <Subsection label="Main goals">
              {existingMainGoals.length === 0 ? (
                <EmptyBlock copy="No main goals are saved for this period yet." />
              ) : (
                <div className="space-y-3">
                  {existingMainGoals.map((goal) => (
                    <GoalPreviewCard
                      key={goal.key}
                      title={goal.title}
                      description={goal.description}
                      meta={goal.meta}
                      actions={
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openExistingGoalEditor(goal.goal)}
                            className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                            style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExistingGoal(goal.key)}
                            className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                            style={{ background: "rgba(162,90,90,0.08)", color: "#a25a5a" }}
                          >
                            Remove
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </Subsection>

            <Subsection label="Supporting goals">
              {existingSecondaryGoals.length === 0 ? (
                <EmptyBlock copy="No supporting goals are saved for this period yet." />
              ) : (
                <div className="space-y-3">
                  {existingSecondaryGoals.map((goal) => (
                    <GoalPreviewCard
                      key={goal.key}
                      title={goal.title}
                      description={goal.description}
                      meta={goal.meta}
                      actions={
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openExistingGoalEditor(goal.goal)}
                            className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                            style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeExistingGoal(goal.key)}
                            className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                            style={{ background: "rgba(162,90,90,0.08)", color: "#a25a5a" }}
                          >
                            Remove
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </Subsection>
          </div>
        </SectionCard>
      )}

      {planSectionUnlocked && (activeCandidate.type === "weekly" || activeCandidate.type === "monthly") && (
        <SectionCard
          eyebrow="Foundational habits"
          title="Keep the repeatable layer visible"
          description="Habit upkeep sits beside board goals—not inside AI drafts."
          tone="soft"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <InfoPill>{activeHabits.length} active habit{activeHabits.length === 1 ? "" : "s"}</InfoPill>
              </div>
              <button
                type="button"
                onClick={() => setHabitEditor({})}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                Add habit
              </button>
            </div>

            {activeHabits.length === 0 ? (
              <EmptyBlock copy="No active foundational habits yet. Add only the ones that should still carry this period." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {activeHabits.map((habit) => (
                  <GoalPreviewCard
                    key={habit.id}
                    title={habit.name}
                    description={formatHabitFrequencyLabel(habit.frequency)}
                    meta={[habit.categoryId ? "Linked to a category" : "No category link"]}
                    actions={
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHabitEditor({ habit })}
                          className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                          style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExistingHabit(habit.id)}
                          className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                          style={{ background: "rgba(162,90,90,0.08)", color: "#a25a5a" }}
                        >
                          Remove
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {activeCandidate.type === "quarterly" && (
        <SectionCard
          eyebrow="Board preview"
          title="Check the next quarter backbone"
          description="A cleaner handoff starts by making each month legible before you open the board."
          tone="soft"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {nextQuarterCards.map((card) => (
              <div
                key={`${card.month}`}
                className="rounded-2xl p-4"
                style={{ background: "white", border: "1px solid rgba(0,0,0,0.07)" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  {card.label}
                </p>
                <p className="mt-2 text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
                  {card.mainGoal?.title ?? "No main monthly goal yet"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#6f817a" }}>
                  {card.mainGoal?.description ?? "This month still needs a clear anchor before the quarter feels intentional."}
                </p>
                <p className="mt-2 text-[11px]" style={{ color: "#8a9e97" }}>
                  {card.supportCount} supporting goal{card.supportCount === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeCandidate.type === "yearly" && (
        <>
          <SectionCard
            eyebrow="Start manually"
            title="Shape next year directly"
            description="You should be able to start the next year immediately without hunting for the add action."
            tone="soft"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <InfoPill>{activeYearContext?.nextYear ?? yearContext.nextYear}</InfoPill>
                <InfoPill>{nextYearGoals.length} saved goal{nextYearGoals.length === 1 ? "" : "s"}</InfoPill>
              </div>
              <button
                type="button"
                onClick={() => setYearGoalModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                Add yearly goal
              </button>
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Board preview"
            title="Check the next year backbone"
            description="The yearly view should feel clear before it gets broken into months."
            tone="soft"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <OverviewStat label="Yearly goals" value={String(nextYearGoals.length)} />
              <OverviewStat
                label="With monthly depth"
                value={String(nextYearGoals.filter((goal) => (monthlyByYearly.get(goal.id) ?? []).length > 0).length)}
                tone="#006c4a"
              />
              <OverviewStat
                label="Still broad"
                value={String(nextYearGoals.filter((goal) => (monthlyByYearly.get(goal.id) ?? []).length === 0).length)}
                tone={nextYearGoals.some((goal) => (monthlyByYearly.get(goal.id) ?? []).length === 0) ? "#b45309" : "#006c4a"}
              />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Top outcomes"
            title="What is already defined"
            description="Add the next-year outcomes here first; the goals board can carry the deeper breakdown afterward."
            tone="default"
          >
            {nextYearGoals.length === 0 ? (
              <EmptyBlock copy="No yearly goals are saved for the next year yet." />
            ) : (
              <div className="space-y-3">
                {nextYearGoals.slice(0, 4).map((goal) => (
                  <GoalPreviewCard
                    key={goal.id}
                    title={goal.title}
                    description={goal.description}
                    meta={formatYearlyGoalMeta(goal, (monthlyByYearly.get(goal.id) ?? []).length)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );

  const dialog = (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-2 sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      role="presentation"
      onClick={closePrompt}
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-review-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #003d2b, #006c4a)" }} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "rgba(0,108,74,0.10)" }}
              >
                <span className="material-symbols-outlined text-[24px]" style={{ color: "#006c4a" }}>
                  insights
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                    {activeCandidate.periodLabel}
                  </p>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ background: "#f7faf8", color: "#5d6d67", border: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    {screen === "review" ? "Review" : "Next plan"}
                  </span>
                </div>
                <h2
                  id="period-review-title"
                  className="mt-2 font-headline text-[28px] font-extrabold leading-tight"
                  style={{ color: "#1a1f1e" }}
                >
                  {screen === "review" ? promptHeading(activeCandidate.type) : planHeading(activeCandidate.type)}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "#6f817a" }}>
                  {screen === "review"
                    ? loading
                      ? "Preparing your review so the next step stays grounded in real execution data."
                      : narrative.summary
                    : "Keep this screen focused: context first, then the real next-period structure underneath it."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closePrompt}
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ color: "#8a9e97" }}
              aria-label="Close review prompt"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="mt-5">
            <StepIndicator screen={screen} />
          </div>

          {screen === "plan" && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  setScreen("review");
                  setError(null);
                  setSavedNotice(null);
                }}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
                style={{ background: "#f7faf8", color: "#5d6d67", border: "1px solid rgba(0,0,0,0.06)" }}
              >
                <span className="material-symbols-outlined text-[15px]">west</span>
                Back to review
              </button>
            </div>
          )}

          <div className="mt-6">
            {screen === "review" ? reviewBody : planningBody}
          </div>

          {(error || savedNotice) && (
            <div className="mt-4 space-y-3">
              {error && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "rgba(165,42,42,0.08)", color: "#8b2c2c" }}
                >
                  {error}
                </div>
              )}
              {savedNotice && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                >
                  {savedNotice}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="shrink-0 border-t px-4 py-4 sm:px-8 sm:py-5"
          style={{ borderColor: "rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closePrompt}
              className="rounded-xl px-5 py-3 text-sm font-semibold"
              style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
            >
              Close for now
            </button>

            {screen === "review" ? (
              <button
                type="button"
                onClick={() => {
                  setScreen("plan");
                  setError(null);
                  setSavedNotice(null);
                }}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
              >
                {planButtonLabel(activeCandidate.type)}
                <span className="material-symbols-outlined text-[18px]">east</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReturnHome}
                className="flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white"
                style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
              >
                {returnHomeLabel(activeCandidate.type)}
                <span className="material-symbols-outlined text-[18px]">east</span>
              </button>
            )}
          </div>
        </div>

        {goalEditor?.type === "weekly" && (
          <PlanningWeeklyGoalModal
            mode={(goalEditor.goal?.isMain ?? goalEditor.defaultIsMain ?? true) ? "main" : "secondary"}
            monthlyGoals={candidateMonthlyGoalsForWeekly}
            initialTitle={goalEditor.goal?.title}
            initialMonthlyGoalId={goalEditor.goal?.monthlyGoalId}
            initialTargetDay={goalEditor.goal?.targetDay}
            initialDescription={goalEditor.goal?.description}
            initialWorkload={goalEditor.goal?.workload}
            onSubmit={handleGoalEditorSubmitWeekly}
            onClose={() => setGoalEditor(null)}
          />
        )}

        {goalEditor?.type === "monthly" && (
          <PlanningMonthlyGoalModal
            mode={(goalEditor.goal?.isMain ?? goalEditor.defaultIsMain ?? true) ? "main" : "secondary"}
            categories={categories}
            yearlyGoals={yearlyGoals.filter((goal) => goal.year === (activeMonthContext?.nextYear ?? monthContext.nextYear))}
            monthOverride={activeMonthContext?.nextMonth ?? monthContext.nextMonth}
            yearOverride={activeMonthContext?.nextYear ?? monthContext.nextYear}
            initialTitle={goalEditor.goal?.title}
            initialCategoryId={goalEditor.goal?.categoryId}
            initialYearlyGoalId={goalEditor.goal?.yearlyGoalId}
            initialDate={goalEditor.goal?.targetDate}
            initialDescription={goalEditor.goal?.description}
            initialWorkload={goalEditor.goal?.workload}
            onSubmit={handleGoalEditorSubmitMonthly}
            onClose={() => setGoalEditor(null)}
          />
        )}

        {habitEditor && (
          <AddHabitModal
            categories={categories}
            initialName={habitEditor.habit?.name}
            initialIcon={habitEditor.habit?.icon}
            initialCategoryId={habitEditor.habit?.categoryId}
            initialFrequency={habitEditor.habit?.frequency}
            onSubmit={handleHabitSubmit}
            onClose={() => setHabitEditor(null)}
          />
        )}

        {activeCandidate.type === "yearly" && activeYearContext && (
          <AddYearlyGoalModal
            open={yearGoalModalOpen}
            yearOverride={activeYearContext.nextYear}
            onClose={() => setYearGoalModalOpen(false)}
          />
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
