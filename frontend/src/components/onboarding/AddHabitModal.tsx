"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { Category, HabitFrequency } from "@/lib/types";

type HabitLinkType = "none" | "yearly" | "monthly" | "weekly";

interface HabitSubmitPayload {
  name: string;
  icon: string;
  categoryId: string;
  frequency: HabitFrequency;
  yearlyGoalId?: string;
  monthlyGoalId?: string;
  weeklyGoalId?: string;
}

function formatLinkedGoalOption(goal: { id: string; title: string; year: number; month?: number; weekNumber?: number }) {
  if (typeof goal.weekNumber === "number") {
    return `Week ${goal.weekNumber} · ${goal.title}`;
  }
  if (typeof goal.month === "number") {
    return `${new Date(2000, goal.month - 1, 1).toLocaleString("en-US", { month: "short" })} ${goal.year} · ${goal.title}`;
  }
  return `${goal.year} · ${goal.title}`;
}

interface Props {
  categories: Category[];
  /** Pre-fill for edit mode */
  initialName?: string;
  initialIcon?: string;
  initialCategoryId?: string;
  initialFrequency?: HabitFrequency;
  initialYearlyGoalId?: string;
  initialMonthlyGoalId?: string;
  initialWeeklyGoalId?: string;
  onSubmit: (payload: HabitSubmitPayload) => void | Promise<void>;
  onClose: () => void;
}

const HABIT_ICONS = [
  "favorite",
  "fitness_center",
  "menu_book",
  "self_improvement",
  "water_drop",
  "apps",
];

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "3x_week", label: "3x Per Week" },
  { value: "5x_week", label: "5x Per Week" },
  { value: "weekends", label: "Weekends" },
  { value: "flexible", label: "Flexible" },
];

export function AddHabitModal({
  categories,
  initialName = "",
  initialIcon = "favorite",
  initialCategoryId,
  initialFrequency = "daily",
  initialYearlyGoalId,
  initialMonthlyGoalId,
  initialWeeklyGoalId,
  onSubmit,
  onClose,
}: Props) {
  const yearlyGoals = useAppStore((state) => state.yearlyGoals);
  const monthlyGoals = useAppStore((state) => state.monthlyGoals);
  const weeklyGoals = useAppStore((state) => state.weeklyGoals);
  const isEdit = !!initialName;
  const [selectedIcon, setSelectedIcon] = useState(initialIcon);
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? "");
  const [frequency, setFrequency] = useState<HabitFrequency>(initialFrequency);
  const initialLinkType: HabitLinkType = initialWeeklyGoalId
    ? "weekly"
    : initialMonthlyGoalId
      ? "monthly"
      : initialYearlyGoalId
        ? "yearly"
        : "none";
  const [linkType, setLinkType] = useState<HabitLinkType>(initialLinkType);
  const [yearlyGoalId, setYearlyGoalId] = useState(initialYearlyGoalId ?? "");
  const [monthlyGoalId, setMonthlyGoalId] = useState(initialMonthlyGoalId ?? "");
  const [weeklyGoalId, setWeeklyGoalId] = useState(initialWeeklyGoalId ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const sortedYearlyGoals = useMemo(
    () => [...yearlyGoals].sort((a, b) => (a.year - b.year) || a.title.localeCompare(b.title)),
    [yearlyGoals],
  );
  const sortedMonthlyGoals = useMemo(
    () => [...monthlyGoals].sort((a, b) => (a.year - b.year) || (a.month - b.month) || a.title.localeCompare(b.title)),
    [monthlyGoals],
  );
  const sortedWeeklyGoals = useMemo(
    () => [...weeklyGoals].sort((a, b) => (a.year - b.year) || (a.weekNumber - b.weekNumber) || a.title.localeCompare(b.title)),
    [weeklyGoals],
  );

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Routine name is required."); return; }
    if (linkType === "yearly" && !yearlyGoalId) { setError("Choose the yearly goal this routine supports."); return; }
    if (linkType === "monthly" && !monthlyGoalId) { setError("Choose the monthly goal this routine supports."); return; }
    if (linkType === "weekly" && !weeklyGoalId) { setError("Choose the weekly goal this routine supports."); return; }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        icon: selectedIcon,
        categoryId,
        frequency,
        ...(linkType === "yearly" && yearlyGoalId ? { yearlyGoalId } : {}),
        ...(linkType === "monthly" && monthlyGoalId ? { monthlyGoalId } : {}),
        ...(linkType === "weekly" && weeklyGoalId ? { weeklyGoalId } : {}),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Couldn't save this routine. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="px-7 pt-7 pb-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-headline text-xl font-bold" style={{ color: "#1a1f1e" }}>
              {isEdit ? "Edit Habit" : "Define Foundational Habit"}
            </h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition" style={{ color: "#5a6b65" }}>
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <p className="text-sm mb-6" style={{ color: "#8a9e97" }}>
            {isEdit ? "Update the habit name, icon, category, or frequency." : "Link this to your yearly vision and define your focus for the month."}
          </p>

          {/* Icon picker */}
          <div className="mb-5">
            <label className="block mb-3" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Choose Icon
            </label>
            <div className="flex gap-2">
              {HABIT_ICONS.map((icon) => {
                const isSelected = icon === selectedIcon;
                return (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className="flex-1 aspect-square flex items-center justify-center rounded-xl transition-all"
                    style={{
                      background: isSelected ? "#006c4a" : "#f4f6f4",
                      border: isSelected ? "2px solid #006c4a" : "2px solid transparent",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[22px]"
                      style={{ color: isSelected ? "#ffffff" : "#6b7b74" }}
                    >
                      {icon}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Habit name */}
          <div className="mb-5">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Habit Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
              placeholder="e.g. 20 Minutes Deep Meditation"
              className={cn(
                "w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition",
                error ? "border-red-300 bg-red-50" : "border-[#e2e8e4] bg-[#f7f9f8] focus:border-[#006c4a]"
              )}
              style={{ color: "#1a1f1e" }}
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          {/* Yearly category */}
          <div className="mb-5">
            <label className="block mb-3" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Yearly Category
            </label>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 4)}, 1fr)` }}>
              {categories.map((cat) => {
                const isSelected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all"
                    style={{
                      background: isSelected ? "#ecf7f2" : "#f4f6f4",
                      border: `1.5px solid ${isSelected ? "#006c4a" : "transparent"}`,
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ color: "#006c4a" }}>
                      {cat.icon}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#5a6b65" }}>
                      {cat.name.length > 8 ? cat.name.split(" ")[0] : cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frequency */}
          <div className="mb-7">
            <label className="block mb-3" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Frequency
            </label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map(({ value, label }) => {
                const isSelected = value === frequency;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFrequency(value)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: isSelected ? "#006c4a" : "#f4f6f4",
                      color: isSelected ? "#ffffff" : "#6b7b74",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {frequency === "flexible" && (
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
                Flexible routines stay visible without treating skipped days like a miss. Use this when the practice supports a goal but does not belong on a fixed schedule.
              </p>
            )}
          </div>

          <div className="mb-7">
            <label className="block mb-3" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Strategic Link
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "none" as const, label: "None" },
                { value: "yearly" as const, label: "Yearly Goal" },
                { value: "monthly" as const, label: "Monthly Goal" },
                { value: "weekly" as const, label: "Weekly Goal" },
              ].map(({ value, label }) => {
                const isSelected = value === linkType;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setLinkType(value);
                      setError("");
                      if (value !== "yearly") setYearlyGoalId("");
                      if (value !== "monthly") setMonthlyGoalId("");
                      if (value !== "weekly") setWeeklyGoalId("");
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: isSelected ? "#006c4a" : "#f4f6f4",
                      color: isSelected ? "#ffffff" : "#6b7b74",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {linkType !== "none" && (
              <div className="mt-3 relative">
                <select
                  value={linkType === "yearly" ? yearlyGoalId : linkType === "monthly" ? monthlyGoalId : weeklyGoalId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (linkType === "yearly") setYearlyGoalId(value);
                    if (linkType === "monthly") setMonthlyGoalId(value);
                    if (linkType === "weekly") setWeeklyGoalId(value);
                    setError("");
                  }}
                  className="w-full appearance-none rounded-xl px-4 py-3 text-sm outline-none transition"
                  style={{
                    background: "#f7f9f8",
                    border: "1.5px solid rgba(0,0,0,0.07)",
                    color: "#1a1f1e",
                  }}
                >
                  <option value="">
                    {linkType === "yearly"
                      ? "Select a yearly goal"
                      : linkType === "monthly"
                        ? "Select a monthly goal"
                        : "Select a weekly goal"}
                  </option>
                  {(linkType === "yearly" ? sortedYearlyGoals : linkType === "monthly" ? sortedMonthlyGoals : sortedWeeklyGoals).map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {formatLinkedGoalOption(goal)}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#8a9e97" }}>
                  expand_more
                </span>
              </div>
            )}
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
              Use this when a routine supports a goal directly, even if it does not need to sit inside a monthly or weekly plan.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-5" style={{ borderTop: "1px solid #f0f3f1" }}>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold transition"
            style={{ color: "#5a6b65" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#1a1f1e")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#5a6b65")}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ background: "#1a2b24" }}
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add to Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
