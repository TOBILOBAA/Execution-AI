"use client";

import { useState } from "react";
import type { DailyPriority } from "@/lib/types";

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

interface PriorityCardProps {
  priority: DailyPriority;
  onToggle: () => void;
  onEdit: () => void;
  index?: number;
}

export function PriorityCard({ priority, onToggle, onEdit, index = 0 }: PriorityCardProps) {
  const [hovered, setHovered] = useState(false);
  const palette = ICON_PALETTES[index % ICON_PALETTES.length];

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-white rounded-2xl p-5 cursor-pointer transition-all duration-200 flex flex-col gap-5"
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

      {/* Title only — no description */}
      <p
        className="text-sm font-semibold leading-snug"
        style={{
          color: priority.completed ? "#a8b5af" : "#1a1f1e",
          textDecoration: priority.completed ? "line-through" : "none",
        }}
      >
        {priority.title}
      </p>
    </div>
  );
}
