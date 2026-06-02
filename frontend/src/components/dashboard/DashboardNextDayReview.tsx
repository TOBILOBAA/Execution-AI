"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { dashboardApi, habitsApi, tasksApi, type ApiNextDayReview, type ApiNextDayReviewItem } from "@/lib/api";
import { AddDailyPriorityModal } from "@/components/onboarding/AddDailyPriorityModal";
import { AddSecondaryTaskModal } from "@/components/onboarding/AddSecondaryTaskModal";
import { AddHabitModal } from "@/components/onboarding/AddHabitModal";
import type { Category, FoundationalHabit, HabitFrequency, MonthlyGoal, WeeklyGoal } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { describeSyncError } from "@/lib/apiErrors";

type EditableReviewItem = ApiNextDayReviewItem & { localId: string; yearly_goal_ref?: string };
type RecoverableEntry = { id: string; title: string; kind: "main" | "task" | "habit" };

interface DailyAIDraft {
  reasoning?: string;
  top_priorities?: { title: string; description?: string; estimated_effort?: string; tag?: string; yearly_goal_ref?: string; weekly_goal_id?: string }[];
  secondary_tasks?: { title: string; description?: string; estimated_effort?: string; tag?: string; yearly_goal_ref?: string; weekly_goal_id?: string }[];
  foundational_habits?: string[];
}

type PlannerModalState =
  | null
  | { type: "priority"; item?: EditableReviewItem }
  | { type: "task"; item?: EditableReviewItem }
  | { type: "habit"; habit?: FoundationalHabit };

const MAX_MAIN_PRIORITIES = 3;

function makeLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function toReviewItem({
  title,
  description,
  priority,
  estimated_minutes,
  tag,
  weekly_goal_id,
  is_main,
}: EditableReviewItem): ApiNextDayReviewItem {
  return {
    title: title.trim(),
    description: description?.trim() || undefined,
    priority,
    estimated_minutes,
    tag,
    weekly_goal_id,
    is_main,
  };
}

function toEditableItem(item: ApiNextDayReviewItem, prefix: string): EditableReviewItem {
  return { ...item, localId: makeLocalId(prefix) };
}

function formatReviewDateLabel(isoDate: string) {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function parseEstimatedMinutes(value?: string) {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim();
  const hoursMatch = lower.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hoursMatch) return Math.round(Number(hoursMatch[1]) * 60);
  const minutesMatch = lower.match(/(\d+)\s*m/);
  if (minutesMatch) return Number(minutesMatch[1]);
  const numeric = Number(lower.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : undefined;
}

function formatMinutes(minutes?: number) {
  if (!minutes) return null;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function compactCopy(value?: string, maxLength = 180) {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function normalizeLookup(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function inferWeeklyGoalId(
  item: { weekly_goal_id?: string; yearly_goal_ref?: string; title?: string; description?: string },
  weeklyGoals: WeeklyGoal[],
) {
  if (item.weekly_goal_id && weeklyGoals.some((goal) => goal.id === item.weekly_goal_id)) {
    return item.weekly_goal_id;
  }

  const ref = normalizeLookup(item.yearly_goal_ref);
  if (ref) {
    const exact = weeklyGoals.find((goal) => normalizeLookup(goal.title) === ref);
    if (exact) return exact.id;
    const fuzzy = weeklyGoals.find((goal) => {
      const title = normalizeLookup(goal.title);
      return title && (title.includes(ref) || ref.includes(title));
    });
    if (fuzzy) return fuzzy.id;
  }

  const combined = normalizeLookup([item.title, item.description].filter(Boolean).join(" "));
  if (!combined) return undefined;
  const byContent = weeklyGoals.find((goal) => {
    const title = normalizeLookup(goal.title);
    return title && combined.includes(title);
  });
  return byContent?.id;
}

function inferCategoryId(
  item: { tag?: string; weekly_goal_id?: string; yearly_goal_ref?: string; title?: string; description?: string },
  categories: Category[],
  weeklyGoals: WeeklyGoal[],
  monthlyGoals: MonthlyGoal[],
) {
  const tag = normalizeLookup(item.tag);
  if (tag) {
    const exact = categories.find((category) => normalizeLookup(category.name) === tag);
    if (exact) return exact.id;
    const fuzzy = categories.find((category) => {
      const name = normalizeLookup(category.name);
      return name && (name.includes(tag) || tag.includes(name));
    });
    if (fuzzy) return fuzzy.id;
  }

  const linkedWeeklyGoalId = inferWeeklyGoalId(item, weeklyGoals) ?? item.weekly_goal_id;
  const weeklyGoal = linkedWeeklyGoalId ? weeklyGoals.find((goal) => goal.id === linkedWeeklyGoalId) : undefined;
  const monthlyGoal = weeklyGoal?.monthlyGoalId
    ? monthlyGoals.find((goal) => goal.id === weeklyGoal.monthlyGoalId)
    : undefined;
  return monthlyGoal?.categoryId;
}

function addUniqueItem(items: EditableReviewItem[], item: ApiNextDayReviewItem, prefix: string) {
  const normalizedTitle = item.title.trim().toLowerCase();
  if (!normalizedTitle) return items;
  if (items.some((existing) => existing.title.trim().toLowerCase() === normalizedTitle)) {
    return items;
  }
  return [...items, toEditableItem(item, prefix)];
}

function addUniqueMainItem(items: EditableReviewItem[], item: ApiNextDayReviewItem, prefix: string) {
  if (items.length >= MAX_MAIN_PRIORITIES) {
    return items;
  }
  return addUniqueItem(items, item, prefix);
}

function mergeUniqueItems(current: EditableReviewItem[], incoming: ApiNextDayReviewItem[], prefix: string) {
  return incoming.reduce((acc, item) => addUniqueItem(acc, item, prefix), current);
}

function mergeUniqueMainItems(current: EditableReviewItem[], incoming: ApiNextDayReviewItem[], prefix: string) {
  return incoming.slice(0, MAX_MAIN_PRIORITIES).reduce((acc, item) => addUniqueMainItem(acc, item, prefix), current);
}

function findCategoryIdByTag(categories: Category[], tag?: string) {
  if (!tag) return undefined;
  return categories.find((category) => category.name === tag)?.id;
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
  const palette =
    tone === "accent"
      ? { background: "linear-gradient(180deg, rgba(0,108,74,0.08), rgba(0,108,74,0.03))", border: "1px solid rgba(0,108,74,0.12)" }
      : tone === "soft"
        ? { background: "#f8fbf9", border: "1px solid rgba(0,0,0,0.05)" }
        : { background: "white", border: "1px solid rgba(0,0,0,0.06)" };

  return (
    <section className="rounded-[26px] p-5" style={palette}>
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

function ReviewGroup({ label, items, tone = "default" }: { label: string; items: string[]; tone?: "default" | "success" | "warning" }) {
  if (!items.length) return null;
  const background =
    tone === "success"
      ? "rgba(0,108,74,0.07)"
      : tone === "warning"
        ? "rgba(26,31,30,0.04)"
        : "white";
  return (
    <div
      className="space-y-2 rounded-2xl p-4"
      style={{ background, border: "1px solid rgba(0,0,0,0.05)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "#8a9e97" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${label}:${item}`}
            className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: "white", color: "#1a1f1e", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewSummaryCard({
  eyebrow,
  title,
  description,
  groups,
  emptyCopy,
}: {
  eyebrow: string;
  title: string;
  description: string;
  groups: Array<{ label: string; items: string[] }>;
  emptyCopy: string;
}) {
  const visibleGroups = groups.filter((group) => group.items.length > 0);
  return (
    <SectionCard eyebrow={eyebrow} title={title} description={description} tone="soft">
      {visibleGroups.length === 0 ? (
        <p className="text-sm" style={{ color: "#8a9e97" }}>
          {emptyCopy}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <ReviewGroup
              key={group.label}
              label={group.label}
              items={group.items}
              tone={eyebrow === "Signal" ? "success" : "warning"}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function RecoveryCard({
  items,
  recoveringKey,
  onRecover,
}: {
  items: RecoverableEntry[];
  recoveringKey: string | null;
  onRecover: (item: RecoverableEntry) => void;
}) {
  if (!items.length) return null;

  return (
    <SectionCard
      eyebrow="Yesterday recovery"
      title="Did you finish any of these but forget to log them?"
      description="Confirm them now and they will still count for yesterday."
      tone="accent"
    >
      <div className="space-y-3">
        {items.map((item) => {
          const tone =
            item.kind === "main"
              ? "Main goal"
              : item.kind === "task"
                ? "Secondary goal"
                : "Routine";
          const itemKey = `${item.kind}:${item.id}`;
          const isSaving = recoveringKey === itemKey;
          return (
            <div
              key={itemKey}
              className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                  {tone}
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug break-words" style={{ color: "#1a1f1e" }}>
                  {item.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRecover(item)}
                disabled={isSaving}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.16em]"
                style={{
                  background: isSaving ? "rgba(0,0,0,0.08)" : "rgba(0,108,74,0.12)",
                  color: isSaving ? "#6f817a" : "#006c4a",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">task_alt</span>
                {isSaving ? "Saving..." : "Count it"}
              </button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function PlanItemCard({
  item,
  onEdit,
  onRemove,
}: {
  item: EditableReviewItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
            {item.title}
          </p>
          {item.description && (
            <p className="mt-1.5 text-xs leading-relaxed line-clamp-3 break-words" style={{ color: "#6f817a" }}>
              {item.description}
            </p>
          )}
          {(item.tag || item.estimated_minutes) && (
            <p className="mt-2 text-[11px]" style={{ color: "#8a9e97" }}>
              {[item.tag, formatMinutes(item.estimated_minutes)].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(162,90,90,0.08)", color: "#a25a5a" }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function PlannerSection({
  eyebrow,
  title,
  description,
  items,
  emptyCopy,
  addLabel,
  suggestions,
  suggestionLabel,
  onAdd,
  onEdit,
  onRemove,
  onAddSuggestion,
  addDisabled = false,
  addDisabledCopy,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: EditableReviewItem[];
  emptyCopy: string;
  addLabel: string;
  suggestions: ApiNextDayReviewItem[];
  suggestionLabel: string;
  onAdd: () => void;
  onEdit: (item: EditableReviewItem) => void;
  onRemove: (localId: string) => void;
  onAddSuggestion: (item: ApiNextDayReviewItem) => void;
  addDisabled?: boolean;
  addDisabledCopy?: string;
}) {
  return (
    <SectionCard eyebrow={eyebrow} title={title} description={description} tone="soft">
      <div className="flex flex-col">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAdd}
            disabled={addDisabled}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
            style={{
              background: addDisabled ? "rgba(0,0,0,0.06)" : "rgba(0,108,74,0.08)",
              color: addDisabled ? "#8a9e97" : "#006c4a",
            }}
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            {addDisabled ? addDisabledCopy ?? addLabel : addLabel}
          </button>
        </div>

        <div className="mt-4">
          {items.length === 0 ? (
            <div
              className="rounded-2xl px-4 py-6 text-center text-sm"
              style={{ background: "white", border: "1.5px dashed rgba(0,108,74,0.2)", color: "#8a9e97" }}
            >
              {emptyCopy}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <PlanItemCard
                  key={item.localId}
                  item={item}
                  onEdit={() => onEdit(item)}
                  onRemove={() => onRemove(item.localId)}
                />
              ))}
            </div>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "#8a9e97" }}>
              {suggestionLabel}
            </p>
            <div className="space-y-2.5">
              {suggestions.map((item) => (
                <div
                  key={`${title}:${item.title}`}
                  className="rounded-2xl p-3.5 flex items-start justify-between gap-3"
                  style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-xs leading-relaxed line-clamp-2 break-words" style={{ color: "#6f817a" }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddSuggestion(item)}
                    disabled={addDisabled}
                    className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      background: addDisabled ? "rgba(0,0,0,0.06)" : "rgba(0,108,74,0.08)",
                      color: addDisabled ? "#8a9e97" : "#006c4a",
                    }}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function HabitSection({
  habits,
  onAdd,
  onEdit,
  onRemove,
}: {
  habits: FoundationalHabit[];
  onAdd: () => void;
  onEdit: (habit: FoundationalHabit) => void;
  onRemove: (habitId: string) => void;
}) {
  const freqLabel: Record<HabitFrequency, string> = {
    daily: "Daily",
    weekdays: "Weekdays",
    "3x_week": "3x / Week",
    "5x_week": "5x / Week",
    weekends: "Weekends",
    flexible: "Flexible",
  };

  return (
    <SectionCard
      eyebrow="Routines"
      title="Keep routines visible"
      description="Only the routines that should still show up with the next plan belong here."
      tone="soft"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
          style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
          Add routine
        </button>
      </div>

      <div className="mt-4">
        {habits.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-6 text-center text-sm"
            style={{ background: "white", border: "1.5px dashed rgba(0,108,74,0.2)", color: "#8a9e97" }}
          >
            No active routines yet. Add only the ones that still matter to the next day.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="rounded-2xl p-4"
                style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(0,108,74,0.10)" }}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>
                        {habit.icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {habit.name}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "#8a9e97" }}>
                        {freqLabel[habit.frequency] ?? habit.frequency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(habit)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(habit.id)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(162,90,90,0.08)", color: "#a25a5a" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

interface DashboardNextDayReviewProps {
  planDate?: string;
  startOpen?: boolean;
  onClose?: () => void;
}

export function DashboardNextDayReview({ planDate, startOpen = false, onClose }: DashboardNextDayReviewProps = {}) {
  const {
    sessionId,
    kickoffPending,
    categories,
    weeklyGoals,
    monthlyGoals,
    habits,
    loadDashboard,
    addHabit,
    updateHabit,
    removeHabit,
    generateDailyPlan,
  } = useAppStore(
    useShallow((state) => ({
      sessionId: state.sessionId,
      kickoffPending: state.kickoffPending,
      categories: state.categories,
      weeklyGoals: state.weeklyGoals,
      monthlyGoals: state.monthlyGoals,
      habits: state.habits,
      loadDashboard: state.loadDashboard,
      addHabit: state.addHabit,
      updateHabit: state.updateHabit,
      removeHabit: state.removeHabit,
      generateDailyPlan: state.generateDailyPlan,
    })),
  );

  const [review, setReview] = useState<ApiNextDayReview | null>(null);
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"review" | "plan">("review");
  const [mobileReviewView, setMobileReviewView] = useState<"moved" | "carry">("moved");
  const [mobilePlanView, setMobilePlanView] = useState<"priorities" | "tasks" | "habits">("priorities");
  const [priorities, setPriorities] = useState<EditableReviewItem[]>([]);
  const [tasks, setTasks] = useState<EditableReviewItem[]>([]);
  const [plannerModal, setPlannerModal] = useState<PlannerModalState>(null);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [recoveringKey, setRecoveringKey] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || kickoffPending) return;
    let cancelled = false;

    const loadReview = async () => {
      try {
        const data = await dashboardApi.getNextDayReview(sessionId, planDate);
        if (cancelled) return;
        setReview(data);
        setPriorities([]);
        setTasks([]);
        setScreen("review");
        setMobileReviewView("moved");
        setMobilePlanView("priorities");
        setAiNote(null);
        setError(null);
        setOpen(startOpen || data.should_open);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load next-day review");
      }
    };

    void loadReview();

    return () => {
      cancelled = true;
    };
  }, [sessionId, kickoffPending, planDate, startOpen]);

  const activeHabits = useMemo(() => habits.filter((habit) => habit.active), [habits]);
  const planningTomorrow = Boolean(planDate && review && review.today === planDate);
  const cleanPriorities = priorities.map(toReviewItem).filter((item) => item.title.length > 0);
  const cleanTasks = tasks.map(toReviewItem).filter((item) => item.title.length > 0);
  const mainPriorityCapReached = priorities.length >= MAX_MAIN_PRIORITIES;

  const availablePrioritySuggestions = useMemo(
    () =>
      review?.proposal.priorities.filter(
        (item) => !priorities.some((existing) => existing.title.trim().toLowerCase() === item.title.trim().toLowerCase()),
      ) ?? [],
    [priorities, review],
  );

  const availableTaskSuggestions = useMemo(
    () =>
      review?.proposal.tasks.filter(
        (item) => !tasks.some((existing) => existing.title.trim().toLowerCase() === item.title.trim().toLowerCase()),
      ) ?? [],
    [review, tasks],
  );

  const recoverableItems = useMemo<RecoverableEntry[]>(
    () =>
      review
        ? [
            ...review.recovery.main_items.map((item) => ({ ...item, title: item.title, kind: "main" as const })),
            ...review.recovery.task_items.map((item) => ({ ...item, title: item.title, kind: "task" as const })),
            ...review.recovery.habit_items.map((item) => ({ id: item.id, title: item.name, kind: "habit" as const })),
          ]
        : [],
    [review],
  );

  async function refreshReviewState(targetDate: string) {
    if (!sessionId) return;
    const nextReview = await dashboardApi.getNextDayReview(sessionId, planDate);
    setReview(nextReview);
    await loadDashboard(targetDate);
  }

  if (!open || !review) return null;

  const reviewTitle = planningTomorrow ? "Review today, then lock tomorrow in" : "Review yesterday before you begin";
  const reviewIntro = planningTomorrow
    ? `You finished ${formatReviewDateLabel(review.source_date)}. Keep the useful signal, drop the noise, then plan ${formatReviewDateLabel(review.today)} with intention.`
    : `Look at ${formatReviewDateLabel(review.source_date)} clearly so ${formatReviewDateLabel(review.today)} starts with focus instead of guesswork.`;
  const planTitle = planningTomorrow ? "Plan tomorrow" : "Plan today";
  const planIntro = planningTomorrow
    ? `Build ${formatReviewDateLabel(review.today)} yourself. AI can help only when you ask it to.`
    : `Set up ${formatReviewDateLabel(review.today)} clearly before execution begins.`;

  async function handleRecoverItem(item: RecoverableEntry) {
    const currentReview = review;
    if (!sessionId || !currentReview) return;
    const key = `${item.kind}:${item.id}`;
    setRecoveringKey(key);
    setError(null);
    try {
      if (item.kind === "habit") {
        await habitsApi.toggle(sessionId, item.id, true, currentReview.source_date);
      } else {
        await tasksApi.toggleStatus(sessionId, item.id, true);
      }
      await refreshReviewState(currentReview.today);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update yesterday's record");
    } finally {
      setRecoveringKey(null);
    }
  }

  async function handleApprove() {
    const currentReview = review;
    if (!sessionId || !currentReview) return;
    if (cleanPriorities.length === 0) {
      setError("Add at least one main goal before saving the plan.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await dashboardApi.approveNextDayReview(sessionId, {
        date: currentReview.today,
        priorities: cleanPriorities,
        tasks: cleanTasks,
      });
      await loadDashboard(currentReview.today);
      startTransition(() => {
        setOpen(false);
        onClose?.();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the plan");
    } finally {
      setSaving(false);
    }
  }

  async function handleAiGenerate() {
    const currentReview = review;
    if (!currentReview) return;
    setAiLoading(true);
    setAiNote(null);
    setError(null);
    try {
      const result = await generateDailyPlan(currentReview.today);
      if (!result.ok) {
        const banner = useAppStore.getState().syncError;
        const apiDetail =
          result.code === "api_error" &&
          banner &&
          banner.includes("Daily plan (AI generate)")
            ? banner
            : null;
        const msg =
          result.code === "no_weekly_or_habits"
            ? "Add weekly goals or at least one active routine and sync them, then try AI again."
            : result.code === "weekly_sync_failed"
              ? "Weekly goals haven’t finished syncing yet. Fix the issue above, then try again."
              : result.code === "invalid_date"
                ? "That date isn’t valid for daily planning."
                : result.code === "no_session"
                  ? "Your session isn’t active. Refresh or sign in, then try again."
                  : apiDetail ??
                    "AI could not generate a daily plan right now. You can still build the plan manually.";
        setError(msg);
        return;
      }
      const draft = result.draft as DailyAIDraft;
      const aiPriorities = (draft.top_priorities ?? [])
        .slice(0, MAX_MAIN_PRIORITIES)
        .filter((item) => item.title?.trim())
        .map<EditableReviewItem>((item) => ({
          localId: makeLocalId("priority"),
          title: item.title.trim(),
          description: compactCopy(item.description, 160),
          estimated_minutes: parseEstimatedMinutes(item.estimated_effort),
          tag: item.tag,
          weekly_goal_id: inferWeeklyGoalId(item, weeklyGoals),
          yearly_goal_ref: item.yearly_goal_ref,
          priority: "high",
          is_main: true,
        }));
      const aiTasks = (draft.secondary_tasks ?? [])
        .filter((item) => item.title?.trim())
        .map<EditableReviewItem>((item) => ({
          localId: makeLocalId("task"),
          title: item.title.trim(),
          description: compactCopy(item.description, 140),
          estimated_minutes: parseEstimatedMinutes(item.estimated_effort),
          tag: item.tag,
          weekly_goal_id: inferWeeklyGoalId(item, weeklyGoals),
          yearly_goal_ref: item.yearly_goal_ref,
          priority: "medium",
          is_main: false,
        }));
      setPriorities((current) => mergeUniqueMainItems(current, aiPriorities, "priority"));
      setTasks((current) => mergeUniqueItems(current, aiTasks, "task"));
      setAiNote(
        draft.reasoning?.trim()
          || (draft.foundational_habits?.length
            ? `AI also surfaced these routines: ${draft.foundational_habits.join(", ")}.`
            : "AI suggestions were added to the planner.")
          || null,
      );
    } finally {
      setAiLoading(false);
    }
  }

  function handlePrioritySubmit(data: {
    title: string;
    categoryId?: string;
    estimatedMinutes: number;
    tag?: string;
    weeklyGoalId?: string;
    description: string;
  }) {
    const editingPriority = plannerModal?.type === "priority" ? plannerModal.item : undefined;
    if (!editingPriority && mainPriorityCapReached) {
      setPlannerModal(null);
      return;
    }
    const nextItem: EditableReviewItem = {
      localId: editingPriority ? editingPriority.localId : makeLocalId("priority"),
      title: data.title,
      description: data.description || undefined,
      priority: "high",
      estimated_minutes: data.estimatedMinutes,
      tag: data.tag,
      weekly_goal_id: data.weeklyGoalId,
      is_main: true,
    };
    setPriorities((current) =>
      editingPriority
        ? current.map((item) => (item.localId === editingPriority.localId ? nextItem : item))
        : current.length >= MAX_MAIN_PRIORITIES
          ? current
          : [...current, nextItem],
    );
    setPlannerModal(null);
  }

  function handleTaskSubmit(data: {
    title: string;
    categoryId?: string;
    estimatedMinutes: number;
    tag?: string;
    weeklyGoalId?: string;
    description: string;
  }) {
    const nextItem: EditableReviewItem = {
      localId: plannerModal?.type === "task" && plannerModal.item ? plannerModal.item.localId : makeLocalId("task"),
      title: data.title,
      description: data.description || undefined,
      priority: "medium",
      estimated_minutes: data.estimatedMinutes,
      tag: data.tag,
      weekly_goal_id: data.weeklyGoalId,
      is_main: false,
    };
    setTasks((current) =>
      plannerModal?.type === "task" && plannerModal.item
        ? current.map((item) => (item.localId === plannerModal.item?.localId ? nextItem : item))
        : [...current, nextItem],
    );
    setPlannerModal(null);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[61] bg-black/45 backdrop-blur-[6px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-day-review-title"
      >
        <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
          <div
            className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-[940px] sm:rounded-[32px]"
            style={{ border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="h-1 w-full shrink-0" style={{ background: "linear-gradient(90deg, #003d2b, #006c4a)" }} />

            <div className="shrink-0 border-b px-5 pb-5 pt-6 sm:px-7 sm:pt-7" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: "rgba(0,108,74,0.10)" }}
                  >
                    <span className="material-symbols-outlined text-[24px]" style={{ color: "#006c4a" }}>
                      {screen === "review" ? "history" : "assignment"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                      {screen === "review" ? "Review" : "Planning"}
                    </p>
                    <h2
                      id="next-day-review-title"
                      className="mt-2 font-headline text-[26px] font-extrabold leading-tight sm:text-[32px]"
                      style={{ color: "#1a1f1e" }}
                    >
                      {screen === "review" ? reviewTitle : planTitle}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "#6f817a" }}>
                      {screen === "review" ? reviewIntro : planIntro}
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-[22px] px-4 py-3 lg:min-w-[230px]"
                  style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                    {screen === "review" ? "Step 1 of 2" : "Step 2 of 2"}
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                    {screen === "review" ? (planningTomorrow ? "Review today" : "Review yesterday") : (planningTomorrow ? "Plan tomorrow" : "Plan today")}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full" style={{ background: "rgba(0,61,43,0.10)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: screen === "review" ? "50%" : "100%", background: "#003d2b" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {screen === "review" ? (
                <div className="space-y-5">
                  <SectionCard
                    eyebrow="Context"
                    title={review.proposal.weekly_objective ?? "No weekly focus set yet"}
                    description={review.proposal.monthly_context ?? "No monthly context saved yet."}
                    tone="accent"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                        {review.reflection ?? review.insights.join(" ")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.72)", color: "#1a1f1e" }}>
                          {review.yesterday_summary.completion_rate}% complete
                        </span>
                        <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.72)", color: "#1a1f1e" }}>
                          {review.yesterday_summary.completed_main_count + review.yesterday_summary.completed_task_count} goals done
                        </span>
                      </div>
                      </div>
                    </SectionCard>

                  {review.recovery.should_prompt ? (
                    <RecoveryCard
                      items={recoverableItems}
                      recoveringKey={recoveringKey}
                      onRecover={handleRecoverItem}
                    />
                  ) : null}

                  <div className="space-y-4 md:hidden">
                    <div
                      className="inline-flex rounded-full p-1"
                      style={{ background: "#f1f5f3", border: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      {[
                        { id: "moved" as const, label: "What moved" },
                        { id: "carry" as const, label: "Carry forward" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setMobileReviewView(option.id)}
                          className="rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                          style={{
                            background: mobileReviewView === option.id ? "#fff" : "transparent",
                            color: mobileReviewView === option.id ? "#006c4a" : "#6f817a",
                            boxShadow: mobileReviewView === option.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {mobileReviewView === "moved" ? (
                      <ReviewSummaryCard
                        eyebrow="Signal"
                        title="What actually moved"
                        description="The finished work worth carrying forward in your thinking."
                        groups={[
                          { label: "Main goals", items: review.yesterday_summary.completed_main_titles },
                          { label: "Secondary goals", items: review.yesterday_summary.completed_task_titles },
                          { label: "Routines kept", items: review.yesterday_summary.completed_habit_names },
                        ]}
                        emptyCopy="No completed work was recorded."
                      />
                    ) : (
                      <ReviewSummaryCard
                        eyebrow="Carry forward"
                        title="What still needs a decision"
                        description="Keep it only if it still deserves space in the next plan."
                        groups={[
                          { label: "Unfinished main goals", items: review.yesterday_summary.incomplete_main_titles },
                          { label: "Unfinished secondary goals", items: review.yesterday_summary.incomplete_task_titles },
                          { label: "Routines missed", items: review.yesterday_summary.missed_habit_names },
                        ]}
                        emptyCopy="No loose ends were carried into the next day."
                      />
                    )}
                  </div>

                  <div className="hidden gap-4 md:grid xl:grid-cols-[1.05fr_0.95fr]">
                    <ReviewSummaryCard
                      eyebrow="Signal"
                      title="What actually moved"
                      description="The finished work worth carrying forward in your thinking."
                      groups={[
                        { label: "Main goals", items: review.yesterday_summary.completed_main_titles },
                        { label: "Secondary goals", items: review.yesterday_summary.completed_task_titles },
                        { label: "Routines kept", items: review.yesterday_summary.completed_habit_names },
                      ]}
                      emptyCopy="No completed work was recorded."
                    />

                    <ReviewSummaryCard
                      eyebrow="Carry forward"
                      title="What still needs a decision"
                      description="Keep it only if it still deserves space in the next plan."
                      groups={[
                        { label: "Unfinished main goals", items: review.yesterday_summary.incomplete_main_titles },
                        { label: "Unfinished secondary goals", items: review.yesterday_summary.incomplete_task_titles },
                        { label: "Routines missed", items: review.yesterday_summary.missed_habit_names },
                      ]}
                      emptyCopy="No loose ends were carried into the next day."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-4 md:hidden">
                    <SectionCard
                      eyebrow="Direction"
                      title={review.proposal.weekly_objective ?? formatReviewDateLabel(review.today)}
                      description="This is the context to plan around, not more noise to process."
                      tone="accent"
                    >
                      <div className="space-y-3">
                        <div className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.72)", color: "#1a1f1e" }}>
                          {formatReviewDateLabel(review.today)}
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                          {review.reflection ?? "Use what yesterday taught you to shape the next day intentionally."}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: "#6f817a" }}>
                          {review.proposal.monthly_context ?? "No monthly context saved yet."}
                        </p>
                      </div>
                    </SectionCard>

                    <SectionCard
                      eyebrow="Optional AI"
                      title="Generate a draft only if you need one"
                      description="AI stays out of the way until you ask. Anything generated still passes through you."
                      tone="accent"
                    >
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleAiGenerate}
                          disabled={aiLoading}
                          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                          style={{ background: "#003d2b" }}
                        >
                          <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                          {aiLoading ? "Generating..." : "AI Generate"}
                        </button>
                        {aiNote && (
                          <div
                            className="rounded-2xl px-3.5 py-3"
                            style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,108,74,0.08)" }}
                          >
                            <p className="max-h-28 overflow-y-auto pr-1 text-xs leading-relaxed break-words" style={{ color: "#0f766e" }}>
                              {aiNote}
                            </p>
                          </div>
                        )}
                      </div>
                    </SectionCard>

                    <div
                      className="inline-flex rounded-full p-1"
                      style={{ background: "#f1f5f3", border: "1px solid rgba(0,0,0,0.06)" }}
                    >
                      {[
                        { id: "priorities" as const, label: "Main" },
                        { id: "tasks" as const, label: "Secondary" },
                        { id: "habits" as const, label: "Routines" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setMobilePlanView(option.id)}
                          className="rounded-full px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                          style={{
                            background: mobilePlanView === option.id ? "#fff" : "transparent",
                            color: mobilePlanView === option.id ? "#006c4a" : "#6f817a",
                            boxShadow: mobilePlanView === option.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {mobilePlanView === "priorities" ? (
                      <PlannerSection
                        eyebrow={priorities.length ? `${priorities.length} locked in` : "Main goals"}
                        title="Main goals"
                        description="The few things that make the day count."
                        items={priorities}
                        emptyCopy="Add the main work that deserves dashboard attention first."
                        addLabel="Add main goal"
                        suggestions={availablePrioritySuggestions}
                        suggestionLabel="Worth carrying from yesterday or your weekly focus"
                        onAdd={() => setPlannerModal({ type: "priority" })}
                        onEdit={(item) => setPlannerModal({ type: "priority", item })}
                        onRemove={(localId) => setPriorities((current) => current.filter((item) => item.localId !== localId))}
                        onAddSuggestion={(item) => setPriorities((current) => addUniqueMainItem(current, { ...item, is_main: true }, "priority"))}
                        addDisabled={mainPriorityCapReached}
                        addDisabledCopy="Main goal cap reached"
                      />
                    ) : mobilePlanView === "tasks" ? (
                      <PlannerSection
                        eyebrow={tasks.length ? `${tasks.length} secondary` : "Secondary goals"}
                        title="Secondary goals"
                        description="Additional goals that still deserve space in the day."
                        items={tasks}
                        emptyCopy="Add only the additional goals that should travel with the plan."
                        addLabel="Add secondary goal"
                        suggestions={availableTaskSuggestions}
                        suggestionLabel="Useful goals you may still want to keep"
                        onAdd={() => setPlannerModal({ type: "task" })}
                        onEdit={(item) => setPlannerModal({ type: "task", item })}
                        onRemove={(localId) => setTasks((current) => current.filter((item) => item.localId !== localId))}
                        onAddSuggestion={(item) => setTasks((current) => addUniqueItem(current, { ...item, is_main: false }, "task"))}
                      />
                    ) : (
                      <HabitSection
                        habits={activeHabits}
                        onAdd={() => setPlannerModal({ type: "habit" })}
                        onEdit={(habit) => setPlannerModal({ type: "habit", habit })}
                        onRemove={removeHabit}
                      />
                    )}
                  </div>

                  <div className="hidden space-y-5 md:block">
                    <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                      <SectionCard
                        eyebrow="Direction"
                        title={review.proposal.weekly_objective ?? formatReviewDateLabel(review.today)}
                        description="This is the context to plan around, not more noise to process."
                        tone="accent"
                      >
                        <div className="space-y-3">
                          <div className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.72)", color: "#1a1f1e" }}>
                            {formatReviewDateLabel(review.today)}
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: "#1a1f1e" }}>
                            {review.reflection ?? "Use what yesterday taught you to shape the next day intentionally."}
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: "#6f817a" }}>
                            {review.proposal.monthly_context ?? "No monthly context saved yet."}
                          </p>
                        </div>
                      </SectionCard>

                      <SectionCard
                        eyebrow="Optional AI"
                        title="Generate a draft only if you need one"
                        description="AI stays out of the way until you ask. Anything generated still passes through you."
                        tone="accent"
                      >
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={handleAiGenerate}
                            disabled={aiLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
                            style={{ background: "#003d2b" }}
                          >
                            <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                            {aiLoading ? "Generating..." : "AI Generate"}
                          </button>
                          {aiNote && (
                            <div
                              className="rounded-2xl px-3.5 py-3"
                              style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,108,74,0.08)" }}
                            >
                              <p className="max-h-28 overflow-y-auto pr-1 text-xs leading-relaxed break-words" style={{ color: "#0f766e" }}>
                                {aiNote}
                              </p>
                            </div>
                          )}
                        </div>
                      </SectionCard>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <PlannerSection
                        eyebrow={priorities.length ? `${priorities.length} locked in` : "Main goals"}
                        title="Main goals"
                        description="The few things that make the day count."
                        items={priorities}
                        emptyCopy="Add the main work that deserves dashboard attention first."
                        addLabel="Add main goal"
                        suggestions={availablePrioritySuggestions}
                        suggestionLabel="Worth carrying from yesterday or your weekly focus"
                        onAdd={() => setPlannerModal({ type: "priority" })}
                        onEdit={(item) => setPlannerModal({ type: "priority", item })}
                        onRemove={(localId) => setPriorities((current) => current.filter((item) => item.localId !== localId))}
                        onAddSuggestion={(item) => setPriorities((current) => addUniqueMainItem(current, { ...item, is_main: true }, "priority"))}
                        addDisabled={mainPriorityCapReached}
                        addDisabledCopy="Main goal cap reached"
                      />

                      <PlannerSection
                        eyebrow={tasks.length ? `${tasks.length} secondary` : "Secondary goals"}
                        title="Secondary goals"
                        description="Additional goals that still deserve space in the day."
                        items={tasks}
                        emptyCopy="Add only the additional goals that should travel with the plan."
                        addLabel="Add secondary goal"
                        suggestions={availableTaskSuggestions}
                        suggestionLabel="Useful goals you may still want to keep"
                        onAdd={() => setPlannerModal({ type: "task" })}
                        onEdit={(item) => setPlannerModal({ type: "task", item })}
                        onRemove={(localId) => setTasks((current) => current.filter((item) => item.localId !== localId))}
                        onAddSuggestion={(item) => setTasks((current) => addUniqueItem(current, { ...item, is_main: false }, "task"))}
                      />
                    </div>

                    <HabitSection
                      habits={activeHabits}
                      onAdd={() => setPlannerModal({ type: "habit" })}
                      onEdit={(habit) => setPlannerModal({ type: "habit", habit })}
                      onRemove={removeHabit}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div
                  className="mt-5 rounded-2xl px-4 py-3 text-sm"
                  style={{ background: "rgba(165, 42, 42, 0.08)", color: "#8b2c2c" }}
                >
                  {error}
                </div>
              )}
            </div>

            <div
              className="shrink-0 border-t px-5 py-4 sm:px-7"
              style={{ borderColor: "rgba(0,0,0,0.06)", background: "#fafbfa" }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {screen === "plan" && (
                    <button
                      type="button"
                      onClick={() => setScreen("review")}
                      className="w-full rounded-xl px-5 py-3 text-sm font-semibold sm:w-auto"
                      style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
                    >
                      Back to review
                    </button>
                  )}
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onClose?.();
                      }}
                    className="w-full rounded-xl px-5 py-3 text-sm font-semibold sm:w-auto"
                    style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
                  >
                    Close for now
                  </button>
                </div>

                {screen === "review" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setScreen("plan");
                      setMobilePlanView("priorities");
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white sm:w-auto"
                    style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
                  >
                    {planningTomorrow ? "Continue to tomorrow" : "Continue to planning"}
                    <span className="material-symbols-outlined text-[18px]">east</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleApprove}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
                    style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
                  >
                    {saving ? "Saving..." : planningTomorrow ? "Save tomorrow’s plan" : "Save today’s plan"}
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {plannerModal?.type === "priority" && (
        <AddDailyPriorityModal
          categories={categories}
          weeklyGoals={weeklyGoals}
          initialTitle={plannerModal.item?.title}
          initialCategoryId={inferCategoryId(plannerModal.item ?? {}, categories, weeklyGoals, monthlyGoals) ?? findCategoryIdByTag(categories, plannerModal.item?.tag)}
          initialWeeklyGoalId={inferWeeklyGoalId(plannerModal.item ?? {}, weeklyGoals) ?? plannerModal.item?.weekly_goal_id}
          initialAllocation={plannerModal.item?.estimated_minutes ?? 30}
          initialDescription={plannerModal.item?.description ?? ""}
          onSubmit={handlePrioritySubmit}
          onClose={() => setPlannerModal(null)}
        />
      )}

      {plannerModal?.type === "task" && (
        <AddSecondaryTaskModal
          categories={categories}
          weeklyGoals={weeklyGoals}
          initialTitle={plannerModal.item?.title}
          initialCategoryId={inferCategoryId(plannerModal.item ?? {}, categories, weeklyGoals, monthlyGoals) ?? findCategoryIdByTag(categories, plannerModal.item?.tag)}
          initialWeeklyGoalId={inferWeeklyGoalId(plannerModal.item ?? {}, weeklyGoals) ?? plannerModal.item?.weekly_goal_id}
          initialAllocation={plannerModal.item?.estimated_minutes ?? 30}
          initialDescription={plannerModal.item?.description ?? ""}
          onSubmit={handleTaskSubmit}
          onClose={() => setPlannerModal(null)}
        />
      )}

      {plannerModal?.type === "habit" && (
        <AddHabitModal
          categories={categories}
          initialName={plannerModal.habit?.name}
          initialIcon={plannerModal.habit?.icon}
          initialCategoryId={plannerModal.habit?.categoryId}
          initialFrequency={plannerModal.habit?.frequency}
          initialYearlyGoalId={plannerModal.habit?.yearlyGoalId}
          initialMonthlyGoalId={plannerModal.habit?.monthlyGoalId}
          initialWeeklyGoalId={plannerModal.habit?.weeklyGoalId}
          onSubmit={async ({ name, icon, categoryId, frequency, yearlyGoalId, monthlyGoalId, weeklyGoalId }) => {
            if (plannerModal.habit) {
              const ok = await updateHabit(
                plannerModal.habit.id,
                { name, icon, categoryId, frequency, yearlyGoalId, monthlyGoalId, weeklyGoalId },
                { persistMode: "blocking" },
              );
              if (!ok) {
                const banner = useAppStore.getState().syncError;
                throw new Error(
                  banner ? describeSyncError(banner).message : "Couldn't save this routine.",
                );
              }
            } else {
              const ok = await addHabit(
                {
                  name,
                  icon,
                  categoryId,
                  frequency,
                  yearlyGoalId,
                  monthlyGoalId,
                  weeklyGoalId,
                  completedToday: false,
                  streak: 0,
                  active: true,
                },
                { persistMode: "blocking" },
              );
              if (!ok) {
                const banner = useAppStore.getState().syncError;
                throw new Error(
                  banner ? describeSyncError(banner).message : "Couldn't save this routine.",
                );
              }
            }
            setPlannerModal(null);
          }}
          onClose={() => setPlannerModal(null)}
        />
      )}
    </>
  );
}
