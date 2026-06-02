"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { DailyPriority } from "@/lib/types";
import { useAppStore } from "@/lib/store";

const PRIORITY_ICONS: Record<string, string> = {
  "dp-1": "bolt",
  "dp-2": "groups",
  "dp-3": "edit_note",
};

const ICON_PALETTES = [
  { bg: "rgba(0,108,74,0.10)", color: "#006c4a" },
  { bg: "rgba(0,108,74,0.15)", color: "#006c4a" },
  { bg: "rgba(0,108,74,0.08)", color: "#006c4a" },
  { bg: "rgba(0,108,74,0.12)", color: "#006c4a" },
];

function getIcon(id: string, index: number): string {
  const icons = ["bolt", "groups", "edit_note", "target", "psychology", "rocket_launch"];
  return PRIORITY_ICONS[id] ?? icons[index % icons.length];
}

function compactCopy(value?: string, fallback?: string) {
  const copy = (value?.trim() || fallback || "").replace(/\s+/g, " ");
  if (!copy) return "";
  return copy.length > 74 ? `${copy.slice(0, 71).trimEnd()}...` : copy;
}

interface PriorityCardProps {
  priority: DailyPriority;
  onToggle: () => void;
  onEdit: () => void;
  index?: number;
}

export function PriorityCard({ priority, onToggle, onEdit, index = 0 }: PriorityCardProps) {
  const [hovered, setHovered] = useState(false);
  const palette = ICON_PALETTES[index % ICON_PALETTES.length];
  const { weeklyGoals, monthlyGoals, yearlyGoals } = useAppStore(
    useShallow((state) => ({
      weeklyGoals: state.weeklyGoals,
      monthlyGoals: state.monthlyGoals,
      yearlyGoals: state.yearlyGoals,
    })),
  );
  const weeklyGoal = priority.weeklyGoalId ? weeklyGoals.find((goal) => goal.id === priority.weeklyGoalId) ?? null : null;
  const monthlyGoal = weeklyGoal?.monthlyGoalId
    ? monthlyGoals.find((goal) => goal.id === weeklyGoal.monthlyGoalId) ?? null
    : null;
  const yearlyGoal = monthlyGoal?.yearlyGoalId
    ? yearlyGoals.find((goal) => goal.id === monthlyGoal.yearlyGoalId) ?? null
    : null;
  const supportCopy =
    compactCopy(priority.description) ||
    compactCopy(weeklyGoal?.title, "Primary execution target for today.");
  const primaryLink =
    (weeklyGoal && { label: "Weekly", value: weeklyGoal.title, icon: "bolt" }) ||
    (monthlyGoal && { label: "Monthly", value: monthlyGoal.title, icon: "calendar_month" }) ||
    (yearlyGoal && { label: "Yearly", value: yearlyGoal.title, icon: "track_changes" }) ||
    null;

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-white rounded-2xl p-5 cursor-pointer transition-all duration-200 flex flex-col gap-4"
      style={{
        border: hovered ? "1.5px solid #006c4a" : "1.5px solid rgba(0,0,0,0.07)",
        boxShadow: hovered ? "0 4px 20px rgba(0,108,74,0.10)" : "0 1px 4px rgba(0,0,0,0.05)",
        opacity: priority.completed ? 0.6 : 1,
      }}
    >
      {/* Icon row + circle toggle */}
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: palette.bg }}
        >
          <span className="material-symbols-outlined text-[19px]" style={{ color: palette.color }}>
            {getIcon(priority.id, index)}
          </span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150"
          style={{
            borderColor: priority.completed ? "#006c4a" : "#d1ddd8",
            background: priority.completed ? "#006c4a" : "transparent",
          }}
          aria-label={`Mark "${priority.title}" complete`}
        >
          {priority.completed && (
            <span className="material-symbols-outlined text-[13px] text-white">check</span>
          )}
        </button>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: priority.completed ? "#b7c3be" : "#8a9e97" }}>
              Main goal
            </p>
            <p
              className="mt-1 text-[15px] font-semibold leading-6"
              style={{
                color: priority.completed ? "#a8b5af" : "#1a1f1e",
                textDecoration: priority.completed ? "line-through" : "none",
              }}
            >
              {priority.title}
            </p>
          </div>
        </div>

        <p
          className="text-[12px] leading-5 line-clamp-2"
          style={{ color: priority.completed ? "#b7c3be" : "#8a9e97" }}
        >
          {supportCopy}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {priority.estimatedMinutes ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ background: "rgba(0,108,74,0.06)", color: priority.completed ? "#9bb4aa" : "#006c4a" }}
            >
              <span className="material-symbols-outlined text-[12px]">schedule</span>
              {priority.estimatedMinutes}m
            </span>
          ) : null}

          {priority.priority ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize"
              style={{ background: "rgba(0,0,0,0.04)", color: priority.completed ? "#9bb4aa" : "#5d6c67" }}
            >
              <span className="material-symbols-outlined text-[12px]">flag</span>
              {priority.priority}
            </span>
          ) : null}

          {primaryLink ? (
            <span
              className="inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
              style={{ background: "rgba(0,0,0,0.04)", color: priority.completed ? "#9bb4aa" : "#5d6c67" }}
            >
              <span className="material-symbols-outlined text-[12px]">{primaryLink.icon}</span>
              <span className="uppercase tracking-[0.12em]">{primaryLink.label}</span>
              <span className="max-w-[140px] truncate normal-case tracking-normal">{primaryLink.value}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
