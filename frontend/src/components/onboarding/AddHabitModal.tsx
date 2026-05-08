"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Category, HabitFrequency } from "@/lib/types";

interface Props {
  categories: Category[];
  /** Pre-fill for edit mode */
  initialName?: string;
  initialIcon?: string;
  initialCategoryId?: string;
  initialFrequency?: HabitFrequency;
  onSubmit: (name: string, icon: string, categoryId: string, frequency: HabitFrequency) => void;
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
];

export function AddHabitModal({
  categories,
  initialName = "",
  initialIcon = "favorite",
  initialCategoryId,
  initialFrequency = "daily",
  onSubmit,
  onClose,
}: Props) {
  const isEdit = !!initialName;
  const [selectedIcon, setSelectedIcon] = useState(initialIcon);
  const [name, setName] = useState(initialName);
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? "");
  const [frequency, setFrequency] = useState<HabitFrequency>(initialFrequency);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) { setError("Routine name is required."); return; }
    onSubmit(name.trim(), selectedIcon, categoryId, frequency);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="px-7 pt-7 pb-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-headline text-xl font-bold" style={{ color: "#1a1f1e" }}>
              {isEdit ? "Edit Routine" : "Define Routine"}
            </h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition" style={{ color: "#5a6b65" }}>
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <p className="text-sm mb-6" style={{ color: "#8a9e97" }}>
            {isEdit ? "Update the routine name, icon, category, or frequency." : "Set the routine you want to keep in motion."}
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

          {/* Routine name */}
          <div className="mb-5">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Routine Name
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-5" style={{ borderTop: "1px solid #f0f3f1" }}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold transition"
            style={{ color: "#5a6b65" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#1a1f1e")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#5a6b65")}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: "#1a2b24" }}
          >
            {isEdit ? "Save Changes" : "Add Routine"}
          </button>
        </div>
      </div>
    </div>
  );
}
