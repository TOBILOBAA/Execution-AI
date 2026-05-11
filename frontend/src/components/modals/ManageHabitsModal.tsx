"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { FoundationalHabit, HabitFrequency } from "@/lib/types";

const HABIT_ICONS = [
  "water_drop", "timer", "self_improvement", "do_not_disturb_on",
  "assignment_turned_in", "fitness_center", "menu_book", "bedtime",
  "directions_run", "favorite", "psychology", "restaurant",
];

const FREQ_PILLS: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "5x_week", label: "5x/Week" },
  { value: "weekends", label: "Weekends" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

function cloneHabit(habit: FoundationalHabit): FoundationalHabit {
  return { ...habit };
}

export function ManageHabitsModal({ open, onClose }: Props) {
  const { habits, addHabit, removeHabit, updateHabit } = useAppStore(
    useShallow((state) => ({
      habits: state.habits,
      addHabit: state.addHabit,
      removeHabit: state.removeHabit,
      updateHabit: state.updateHabit,
    })),
  );
  const titleId = "manage-habits-title";

  // Local draft so "Discard Changes" truly leaves the store untouched.
  const [draftHabits, setDraftHabits] = useState<FoundationalHabit[]>(() => habits.map(cloneHabit));
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("water_drop");
  const [newFreq, setNewFreq] = useState<HabitFrequency>("daily");

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;

  const resetComposer = () => {
    setShowAdd(false);
    setNewName("");
    setNewIcon("water_drop");
    setNewFreq("daily");
  };

  const handleAddHabit = () => {
    if (!newName.trim()) return;
    const id = `draft-habit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setDraftHabits((prev) => [
      ...prev,
      {
        id,
        name: newName.trim(),
        icon: newIcon,
        frequency: newFreq,
        completedToday: false,
        streak: 0,
        active: true,
      },
    ]);
    resetComposer();
  };

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
        });
        continue;
      }

      if (
        original.name !== habit.name ||
        original.icon !== habit.icon ||
        original.frequency !== habit.frequency ||
        original.categoryId !== habit.categoryId ||
        original.active !== habit.active
      ) {
        updateHabit(habit.id, {
          name: habit.name,
          icon: habit.icon,
          frequency: habit.frequency,
          active: habit.active,
          categoryId: habit.categoryId,
        });
      }
    }

    onClose();
  };

  const handleDiscard = () => {
    setDraftHabits(habits.map(cloneHabit));
    resetComposer();
    onClose();
  };

  const updateDraftHabit = (id: string, updates: Partial<FoundationalHabit>) => {
    setDraftHabits((prev) => prev.map((habit) => (habit.id === id ? { ...habit, ...updates } : habit)));
  };

  const removeDraftHabit = (id: string) => {
    setDraftHabits((prev) => prev.filter((habit) => habit.id !== id));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white w-full max-w-[500px] max-h-[calc(100vh-2rem)] sm:max-h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto"
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
              <p className="text-sm mt-1" style={{ color: "#a8b5af" }}>
                Set the repeatable routines you want in your day.
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

        <div className="px-6 py-5 space-y-2 overflow-y-auto">
          {draftHabits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onRemove={() => removeDraftHabit(habit.id)}
              onChangeFreq={(freq) => updateDraftHabit(habit.id, { frequency: freq })}
            />
          ))}

          {showAdd ? (
            <div
              className="rounded-2xl p-5 space-y-4 mt-2"
              style={{ background: "#f7f9f8", border: "1.5px solid rgba(0,108,74,0.15)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
                New Routine
              </p>
              <input
                type="text"
                placeholder="Routine name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "#fff",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: "#1a1f1e",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
              />
              <div className="grid grid-cols-6 gap-2">
                {HABIT_ICONS.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setNewIcon(ic)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: newIcon === ic ? "#006c4a" : "#fff",
                      color: newIcon === ic ? "#fff" : "#8a9e97",
                      border: "1.5px solid rgba(0,0,0,0.07)",
                    }}
                    title={ic}
                  >
                    <span className="material-symbols-outlined text-base">{ic}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {FREQ_PILLS.map((fp) => (
                  <button
                    key={fp.value}
                    onClick={() => setNewFreq(fp.value)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                    style={{
                      background: newFreq === fp.value ? "#006c4a" : "#fff",
                      color: newFreq === fp.value ? "#fff" : "#8a9e97",
                      border: "1.5px solid",
                      borderColor: newFreq === fp.value ? "#006c4a" : "rgba(0,0,0,0.08)",
                    }}
                  >
                    {fp.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    resetComposer();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: "#8a9e97" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddHabit}
                  disabled={!newName.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: "#006c4a" }}
                >
                  Add Routine
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-semibold transition-all mt-2"
              style={{
                border: "1.5px dashed rgba(0,0,0,0.12)",
                color: "#a8b5af",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#006c4a";
                (e.currentTarget as HTMLButtonElement).style.color = "#006c4a";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.12)";
                (e.currentTarget as HTMLButtonElement).style.color = "#a8b5af";
              }}
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add New Routine
            </button>
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
    </div>
  );
}

function HabitRow({
  habit,
  onRemove,
  onChangeFreq,
}: {
  habit: FoundationalHabit;
  onRemove: () => void;
  onChangeFreq: (freq: HabitFrequency) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-start gap-4 p-4 rounded-2xl transition-all"
      style={{ background: "#f7f9f8" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.07)" }}
      >
        <span className="material-symbols-outlined text-[20px]" style={{ color: "#006c4a" }}>
          {habit.icon}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-2" style={{ color: "#1a1f1e" }}>
          {habit.name}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FREQ_PILLS.map((fp) => {
            const active = habit.frequency === fp.value;
            return (
              <button
                key={fp.value}
                onClick={() => onChangeFreq(fp.value)}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                style={{
                  background: active ? "#006c4a" : "transparent",
                  color: active ? "#fff" : "#a8b5af",
                  border: "1.5px solid",
                  borderColor: active ? "#006c4a" : "rgba(0,0,0,0.08)",
                }}
              >
                {fp.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
        style={{ color: "#c4d0cb", opacity: hovered ? 1 : 0.4 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fff0f0"; e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c4d0cb"; }}
        aria-label={`Remove ${habit.name}`}
      >
        <span className="material-symbols-outlined text-[17px]">delete</span>
      </button>
    </div>
  );
}
