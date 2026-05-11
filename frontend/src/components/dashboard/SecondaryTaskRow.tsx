"use client";

import { useState } from "react";
import type { DailyPriority } from "@/lib/types";

// Solid filled badges — each category has a unique, visually distinct color
const TAG_STYLES: Record<string, { bg: string; color: string }> = {
  // Our 4 core categories
  Career:           { bg: "#006c4a", color: "#fff" },
  Spiritual:        { bg: "#7c3aed", color: "#fff" },
  Academic:         { bg: "#d97706", color: "#fff" },
  "Personal Growth":{ bg: "#2563eb", color: "#fff" },
  // Fallbacks for any extra tags users might add
  Health:           { bg: "#059669", color: "#fff" },
  Finance:          { bg: "#dc2626", color: "#fff" },
  Admin:            { bg: "#475569", color: "#fff" },
  Personal:         { bg: "#9333ea", color: "#fff" },
  Errands:          { bg: "#ea580c", color: "#fff" },
  Dev:              { bg: "#0284c7", color: "#fff" },
};

function getTagStyle(tag: string) {
  return TAG_STYLES[tag] ?? { bg: "#6b7280", color: "#fff" };
}

interface SecondaryTaskRowProps {
  task: DailyPriority;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
}

export function SecondaryTaskRow({ task, onToggle, onRemove, onEdit }: SecondaryTaskRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="cursor-pointer rounded-2xl px-4 py-4 transition-all duration-150 sm:rounded-xl sm:py-3.5"
      style={{
        background: hovered ? "#fff" : "transparent",
        boxShadow: hovered ? "0 1px 8px rgba(0,0,0,0.05)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Circle toggle — stopPropagation so row click (edit) isn't triggered */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150"
            style={{
              borderColor: task.completed ? "#006c4a" : "#d1ddd8",
              background: task.completed ? "#006c4a" : "transparent",
            }}
            aria-label={`Mark "${task.title}" complete`}
          >
            {task.completed && (
              <span className="material-symbols-outlined text-[11px] text-white">check</span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <span
                className="break-words text-sm font-medium leading-snug"
                style={{
                  color: task.completed ? "#a8b5af" : "#1a1f1e",
                  textDecoration: task.completed ? "line-through" : "none",
                }}
              >
                {task.title}
              </span>
              <span
                className="material-symbols-outlined hidden text-[13px] transition-opacity sm:inline"
                style={{ color: "#a8b5af", opacity: hovered ? 1 : 0.45 }}
              >
                edit
              </span>
              {task.tag && (
                <span
                  className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={getTagStyle(task.tag)}
                >
                  {task.tag}
                </span>
              )}
            </div>
            {(task.estimatedMinutes || task.priority) && (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {task.estimatedMinutes && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: "#a8b5af" }}>
                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                    {task.estimatedMinutes}m
                  </span>
                )}
                {task.priority && (
                  <span className="flex items-center gap-1 text-[11px] capitalize" style={{ color: "#a8b5af" }}>
                    <span className="material-symbols-outlined text-[13px]">flag</span>
                    {task.priority}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Remove button */}
        <div className="flex justify-end sm:block">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="inline-flex h-9 items-center justify-center rounded-full px-3 transition-all sm:h-7 sm:w-7 sm:px-0"
            style={{ opacity: hovered ? 1 : 0.82, color: "#c4d0cb" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fff0f0"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c4d0cb"; }}
            aria-label="Remove secondary goal"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
