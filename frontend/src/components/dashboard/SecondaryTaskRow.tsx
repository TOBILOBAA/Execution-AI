"use client";

import { useState } from "react";
import type { DailyPriority } from "@/lib/types";

// Solid filled badges — each category has a unique, visually distinct color
function getTagStyle() {
  return {
    background: "rgba(0,108,74,0.08)",
    color: "#0a8754",
  };
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
      className="cursor-pointer rounded-2xl px-4 py-4 transition-all duration-150 sm:rounded-xl sm:py-5"
      style={{
        background: hovered ? "#ffffff" : "#fcfdfc",
        border: "1px solid rgba(0,0,0,0.03)",
        boxShadow: hovered
          ? "0 10px 24px rgba(15,23,42,0.05)"
          : "0 2px 10px rgba(15,23,42,0.02)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Circle toggle — stopPropagation so row click (edit) isn't triggered */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150"
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
                className="break-words text-[16px] font-semibold leading-6"
                style={{
                  color: task.completed ? "#a8b5af" : "#1a1f1e",
                  textDecoration: task.completed ? "line-through" : "none",
                }}
              >
                {task.title}
              </span>
            </div>
            {task.tag ? (
              <div className="mt-3">
                <span
                  className="inline-flex min-w-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                  style={getTagStyle()}
                >
                  {task.tag}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
          {task.estimatedMinutes ? (
            <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "#7d8d87" }}>
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              {task.estimatedMinutes} min
            </span>
          ) : null}

          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="hidden h-8 w-8 items-center justify-center rounded-full transition-colors sm:inline-flex"
            style={{ color: "#8a9e97" }}
            aria-label="Edit secondary goal"
          >
            <span className="material-symbols-outlined text-[17px]">edit</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors sm:hidden"
            style={{ color: "#d43d3d", background: "rgba(212,61,61,0.08)" }}
            aria-label="Delete secondary goal"
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
            Delete
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="hidden h-8 w-8 items-center justify-center rounded-full transition-colors sm:inline-flex"
            style={{ color: "#8a9e97" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8a9e97"; }}
            aria-label="Delete secondary goal"
          >
            <span className="material-symbols-outlined text-[17px]">delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
