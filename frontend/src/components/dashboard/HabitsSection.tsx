"use client";

import { useState } from "react";
import type { FoundationalHabit } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const ICON_PALETTES = [
  { bg: "rgba(0,108,74,0.12)", color: "#006c4a" },
  { bg: "rgba(0,80,60,0.18)",  color: "#004d3a" },
  { bg: "rgba(0,108,74,0.08)", color: "#006c4a" },
  { bg: "#eeeeee",             color: "#9ca3af" },
  { bg: "rgba(0,108,74,0.10)", color: "#006c4a" },
  { bg: "rgba(0,60,40,0.12)",  color: "#003c28" },
];

interface HabitCardProps {
  habit: FoundationalHabit;
  index: number;
  onToggle: () => void;
}

function HabitCard({ habit, index, onToggle }: HabitCardProps) {
  const [hovered, setHovered] = useState(false);
  const palette = ICON_PALETTES[index % ICON_PALETTES.length];
  const done = habit.completedToday;

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative bg-white rounded-2xl p-5 text-left transition-all duration-200 w-full"
      style={{
        border: done
          ? "1.5px solid rgba(0,108,74,0.25)"
          : hovered
          ? "1.5px solid rgba(0,108,74,0.30)"
          : "1.5px solid rgba(0,0,0,0.07)",
        boxShadow: done || hovered
          ? "0 2px 16px rgba(0,108,74,0.08)"
          : "0 1px 4px rgba(0,0,0,0.04)",
      }}
      aria-label={`${habit.name}: ${done ? "completed — click to undo" : "click to mark complete"}`}
    >
      {/* Checkbox circle — top right, always visible */}
      <div
        className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          background: done ? "#006c4a" : hovered ? "rgba(0,108,74,0.08)" : "rgba(0,0,0,0.04)",
          borderWidth: done ? 0 : "1.5px",
          borderStyle: "solid",
          borderColor: done ? "transparent" : hovered ? "#006c4a" : "rgba(0,0,0,0.12)",
        }}
      >
        {done && (
          <span className="material-symbols-outlined text-[13px] text-white">check</span>
        )}
      </div>

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: done ? palette.bg : "#f4f6f4" }}
      >
        <span
          className="material-symbols-outlined text-[20px] transition-colors"
          style={{ color: done ? palette.color : "#b0bcb7" }}
        >
          {habit.icon}
        </span>
      </div>

      {/* Name */}
      <p
        className="text-sm font-semibold leading-snug pr-6"
        style={{ color: done ? "#1a1f1e" : "#6b7c75" }}
      >
        {habit.name}
      </p>

      {/* Status label */}
      <p
        className="text-[10px] font-bold uppercase tracking-wide mt-1.5"
        style={{ color: done ? "#006c4a" : hovered ? "#006c4a" : "#c4d0cb" }}
      >
        {done ? "Completed" : "Tap to complete"}
      </p>
    </button>
  );
}

interface HabitsSectionProps {
  habits: FoundationalHabit[];
  onManage: () => void;
  description?: string;
  eyebrow?: string;
  actionLabel?: string;
  actionIcon?: string;
}

export function HabitsSection({
  habits,
  onManage,
  description,
  eyebrow = "Routines",
  actionLabel = "Manage",
  actionIcon = "settings",
}: HabitsSectionProps) {
  const toggleHabit = useAppStore((state) => state.toggleHabit);
  const visibleHabits = habits.filter((h) => h.active);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
            {eyebrow}
          </p>
          {description ? (
            <p className="mt-1 text-sm max-w-xl leading-6" style={{ color: "#8a9e97" }}>
              {description}
            </p>
          ) : null}
        </div>
        <button
          onClick={onManage}
          className="inline-flex items-center gap-2 self-start rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(0,108,74,0.10)]"
          style={{ color: "#006c4a", background: "rgba(0,108,74,0.06)" }}
        >
          <span className="material-symbols-outlined text-[16px]">{actionIcon}</span>
          {actionLabel}
        </button>
      </div>

      {/* Cards */}
      {visibleHabits.length === 0 ? (
        <div
          className="rounded-[24px] px-5 py-6 text-center"
          style={{ background: "#fafcfb", border: "1.5px dashed rgba(0,108,74,0.18)" }}
        >
          <p className="font-semibold" style={{ color: "#1a1f1e" }}>
            No routines are active yet
          </p>
          <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: "#8a9e97" }}>
            Add the repeated actions that keep your day steady when the goals change.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleHabits.map((habit, i) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              index={i}
              onToggle={() => toggleHabit(habit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
