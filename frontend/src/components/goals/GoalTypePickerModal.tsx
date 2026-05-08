"use client";

import { useState } from "react";

const GOAL_TYPES = [
  {
    key: "add-yearly-goal",
    icon: "calendar_today",
    label: "Yearly Goal",
    desc: "Major milestones and vision-level objectives for the next 12 months.",
  },
  {
    key: "add-monthly-goal",
    icon: "event_note",
    label: "Monthly Goal",
    desc: "Specific targets for the current month to keep your momentum steady.",
  },
  {
    key: "add-weekly-goal",
    icon: "view_week",
    label: "Weekly Goal",
    desc: "Short-term focus built around key projects and routines.",
  },
  {
    key: "add-daily-priority",
    icon: "today",
    label: "Daily Goal",
    desc: "The daily goals that define your day-to-day success.",
  },
];

interface Props {
  onClose: () => void;
  onSelect: (type: string) => void;
}

export function GoalTypePickerModal({ onClose, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-[640px] rounded-3xl shadow-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-10 pt-10 pb-6 text-center">
          {/* Target icon */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "#f4f6f4" }}
          >
            <span className="material-symbols-outlined text-[28px]" style={{ color: "#c4d0cb" }}>
              track_changes
            </span>
          </div>
          <h2
            className="font-headline font-extrabold leading-tight mb-3"
            style={{ fontSize: "26px", color: "#1a1f1e" }}
          >
            What type of goal are you adding?
          </h2>
          <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "#8a9e97" }}>
            Choose a timeframe that matches your ambition. We&apos;ll help you break it down into actionable steps.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-3 px-8 pb-6">
          {GOAL_TYPES.map((gt) => {
            const isHovered = hovered === gt.key;
            return (
              <button
                key={gt.key}
                onClick={() => onSelect(gt.key)}
                onMouseEnter={() => setHovered(gt.key)}
                onMouseLeave={() => setHovered(null)}
                className="text-left rounded-2xl p-5 transition-all duration-150"
                style={{
                  background: isHovered ? "rgba(0,108,74,0.05)" : "#f7f9f8",
                  border: isHovered ? "1.5px solid rgba(0,108,74,0.30)" : "1.5px solid rgba(0,0,0,0.06)",
                  boxShadow: isHovered ? "0 2px 12px rgba(0,108,74,0.08)" : "none",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: isHovered ? "rgba(0,108,74,0.12)" : "rgba(0,0,0,0.06)",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: isHovered ? "#006c4a" : "#8a9e97" }}
                  >
                    {gt.icon}
                  </span>
                </div>
                <p
                  className="font-headline font-bold text-sm mb-1.5"
                  style={{ color: isHovered ? "#006c4a" : "#1a1f1e" }}
                >
                  {gt.label}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#a8b5af" }}>
                  {gt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-8 pb-8 pt-2 flex justify-center"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-widest px-6 py-2.5 transition-opacity hover:opacity-60"
            style={{ color: "#a8b5af" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
