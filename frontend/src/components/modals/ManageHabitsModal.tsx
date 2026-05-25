"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { AddHabitModal } from "@/components/onboarding/AddHabitModal";
import type { FoundationalHabit } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type HabitEditorState = null | { habit?: FoundationalHabit };

function cloneHabit(habit: FoundationalHabit): FoundationalHabit {
  return { ...habit };
}

function formatFrequencyLabel(value: FoundationalHabit["frequency"]) {
  if (value === "3x_week") return "3x per week";
  if (value === "5x_week") return "5x per week";
  if (value === "weekdays") return "Weekdays";
  if (value === "weekends") return "Weekends";
  if (value === "flexible") return "Flexible";
  return "Daily";
}

function monthShort(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "short" });
}

function routineSupportLabel(
  habit: FoundationalHabit,
  lookups: {
    yearlyById: Map<string, string>;
    monthlyById: Map<string, string>;
    weeklyById: Map<string, string>;
  },
) {
  if (habit.weeklyGoalId) {
    return lookups.weeklyById.get(habit.weeklyGoalId) ?? "Supports a weekly goal";
  }
  if (habit.monthlyGoalId) {
    return lookups.monthlyById.get(habit.monthlyGoalId) ?? "Supports a monthly goal";
  }
  if (habit.yearlyGoalId) {
    return lookups.yearlyById.get(habit.yearlyGoalId) ?? "Supports a yearly goal";
  }
  return "No direct goal link";
}

function HabitRow({
  habit,
  categoryLabel,
  supportLabel,
  onEdit,
  onRemove,
}: {
  habit: FoundationalHabit;
  categoryLabel: string;
  supportLabel: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        background: "#f7f9f8",
        border: hovered ? "1.5px solid rgba(0,108,74,0.18)" : "1.5px solid rgba(0,0,0,0.04)",
        boxShadow: hovered ? "0 8px 26px rgba(0,108,74,0.08)" : "0 1px 3px rgba(0,0,0,0.03)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#ffffff", border: "1.5px solid rgba(0,0,0,0.06)" }}
        >
          <span className="material-symbols-outlined text-[21px]" style={{ color: "#006c4a" }}>
            {habit.icon}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
                {habit.name}
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "#6f817a" }}>
                {supportLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(162,90,90,0.08)", color: "#a25a5a" }}
              >
                Remove
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: "#ffffff", color: "#1a1f1e", border: "1px solid rgba(0,0,0,0.08)" }}
            >
              {formatFrequencyLabel(habit.frequency)}
            </span>
            <span
              className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{ background: "#ffffff", color: "#6f817a", border: "1px solid rgba(0,0,0,0.08)" }}
            >
              {categoryLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManageHabitsModal({ open, onClose }: Props) {
  const { habits, categories, yearlyGoals, monthlyGoals, weeklyGoals, addHabit, removeHabit, updateHabit } = useAppStore(
    useShallow((state) => ({
      habits: state.habits,
      categories: state.categories,
      yearlyGoals: state.yearlyGoals,
      monthlyGoals: state.monthlyGoals,
      weeklyGoals: state.weeklyGoals,
      addHabit: state.addHabit,
      removeHabit: state.removeHabit,
      updateHabit: state.updateHabit,
    })),
  );
  const titleId = "manage-habits-title";
  const [draftHabits, setDraftHabits] = useState<FoundationalHabit[]>(() => habits.map(cloneHabit));
  const [habitEditor, setHabitEditor] = useState<HabitEditorState>(null);

  useEffect(() => {
    if (!open) return;
    setDraftHabits(habits.map(cloneHabit));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [habits, open, onClose]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories],
  );
  const yearlyById = useMemo(
    () => new Map(yearlyGoals.map((goal) => [goal.id, `${goal.year} · ${goal.title}`] as const)),
    [yearlyGoals],
  );
  const monthlyById = useMemo(
    () =>
      new Map(
        monthlyGoals.map((goal) => [
          goal.id,
          `${monthShort(goal.month)} ${goal.year} · ${goal.title}`,
        ] as const),
      ),
    [monthlyGoals],
  );
  const weeklyById = useMemo(
    () => new Map(weeklyGoals.map((goal) => [goal.id, `Week ${goal.weekNumber} · ${goal.title}`] as const)),
    [weeklyGoals],
  );

  if (!open) return null;

  const handleSave = () => {
    const originalById = new Map(habits.map((habit) => [habit.id, habit] as const));
    const draftById = new Map(draftHabits.map((habit) => [habit.id, habit] as const));

    for (const habit of habits) {
      if (!draftById.has(habit.id)) {
        removeHabit(habit.id);
      }
    }

    for (const habit of draftHabits) {
      const original = originalById.get(habit.id);
      if (!original) {
        addHabit({
          name: habit.name,
          icon: habit.icon,
          frequency: habit.frequency,
          completedToday: habit.completedToday,
          streak: habit.streak,
          active: habit.active,
          ...(habit.categoryId ? { categoryId: habit.categoryId } : {}),
          ...(habit.yearlyGoalId ? { yearlyGoalId: habit.yearlyGoalId } : {}),
          ...(habit.monthlyGoalId ? { monthlyGoalId: habit.monthlyGoalId } : {}),
          ...(habit.weeklyGoalId ? { weeklyGoalId: habit.weeklyGoalId } : {}),
        });
        continue;
      }

      if (
        original.name !== habit.name ||
        original.icon !== habit.icon ||
        original.frequency !== habit.frequency ||
        original.categoryId !== habit.categoryId ||
        original.yearlyGoalId !== habit.yearlyGoalId ||
        original.monthlyGoalId !== habit.monthlyGoalId ||
        original.weeklyGoalId !== habit.weeklyGoalId ||
        original.active !== habit.active
      ) {
        updateHabit(habit.id, {
          name: habit.name,
          icon: habit.icon,
          frequency: habit.frequency,
          active: habit.active,
          categoryId: habit.categoryId,
          yearlyGoalId: habit.yearlyGoalId,
          monthlyGoalId: habit.monthlyGoalId,
          weeklyGoalId: habit.weeklyGoalId,
        });
      }
    }

    onClose();
  };

  const handleDiscard = () => {
    setDraftHabits(habits.map(cloneHabit));
    setHabitEditor(null);
    onClose();
  };

  const upsertDraftHabit = (payload: {
    id?: string;
    name: string;
    icon: string;
    categoryId?: string;
    frequency: FoundationalHabit["frequency"];
    yearlyGoalId?: string;
    monthlyGoalId?: string;
    weeklyGoalId?: string;
  }) => {
    if (payload.id) {
      setDraftHabits((prev) =>
        prev.map((habit) =>
          habit.id === payload.id
            ? {
                ...habit,
                name: payload.name,
                icon: payload.icon,
                categoryId: payload.categoryId,
                frequency: payload.frequency,
                yearlyGoalId: payload.yearlyGoalId,
                monthlyGoalId: payload.monthlyGoalId,
                weeklyGoalId: payload.weeklyGoalId,
              }
            : habit,
        ),
      );
      return;
    }

    const id = `draft-habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDraftHabits((prev) => [
      ...prev,
      {
        id,
        name: payload.name,
        icon: payload.icon,
        categoryId: payload.categoryId,
        frequency: payload.frequency,
        yearlyGoalId: payload.yearlyGoalId,
        monthlyGoalId: payload.monthlyGoalId,
        weeklyGoalId: payload.weeklyGoalId,
        completedToday: false,
        streak: 0,
        active: true,
      },
    ]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white w-full max-w-[560px] max-h-[calc(100vh-2rem)] sm:max-h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto"
        style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-6" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#006c4a" }}>
                Routines
              </p>
              <h2 id={titleId} className="font-headline font-extrabold text-xl" style={{ color: "#1a1f1e" }}>
                Manage Routines
              </h2>
              <p className="text-sm mt-1 max-w-[430px]" style={{ color: "#8a9e97" }}>
                Keep the repeatable layer clean. A routine can stay flexible or directly support a yearly, monthly, or weekly goal.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
              style={{ color: "#8a9e97" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f6f4")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
              {draftHabits.length} routine{draftHabits.length === 1 ? "" : "s"} in view
            </p>
            <button
              type="button"
              onClick={() => setHabitEditor({})}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold"
              style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              Add routine
            </button>
          </div>

          {draftHabits.length === 0 ? (
            <div
              className="rounded-2xl px-4 py-5 text-sm"
              style={{ background: "white", border: "1.5px dashed rgba(0,108,74,0.16)", color: "#8a9e97" }}
            >
              No routines yet. Add the ones you want to keep visible and tied to real execution.
            </div>
          ) : (
            draftHabits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                categoryLabel={habit.categoryId ? (categoryById.get(habit.categoryId) ?? "Category linked") : "No category link"}
                supportLabel={routineSupportLabel(habit, { yearlyById, monthlyById, weeklyById })}
                onEdit={() => setHabitEditor({ habit })}
                onRemove={() => setDraftHabits((prev) => prev.filter((item) => item.id !== habit.id))}
              />
            ))
          )}
        </div>

        <div
          className="px-8 py-5 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <button
            onClick={handleDiscard}
            className="text-sm font-semibold uppercase tracking-wide transition-opacity hover:opacity-60"
            style={{ color: "#8a9e97" }}
          >
            Discard Changes
          </button>
          <button
            onClick={handleSave}
            className="px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "#006c4a", boxShadow: "0 2px 10px rgba(0,108,74,0.20)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#004d38")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#006c4a")}
          >
            Save Routines
          </button>
        </div>
      </div>

      {habitEditor && (
        <AddHabitModal
          categories={categories}
          initialName={habitEditor.habit?.name}
          initialIcon={habitEditor.habit?.icon}
          initialCategoryId={habitEditor.habit?.categoryId}
          initialFrequency={habitEditor.habit?.frequency}
          initialYearlyGoalId={habitEditor.habit?.yearlyGoalId}
          initialMonthlyGoalId={habitEditor.habit?.monthlyGoalId}
          initialWeeklyGoalId={habitEditor.habit?.weeklyGoalId}
          onSubmit={({ name, icon, categoryId, frequency, yearlyGoalId, monthlyGoalId, weeklyGoalId }) => {
            upsertDraftHabit({
              id: habitEditor.habit?.id,
              name,
              icon,
              categoryId: categoryId || undefined,
              frequency,
              yearlyGoalId,
              monthlyGoalId,
              weeklyGoalId,
            });
            setHabitEditor(null);
          }}
          onClose={() => setHabitEditor(null)}
        />
      )}
    </div>
  );
}
