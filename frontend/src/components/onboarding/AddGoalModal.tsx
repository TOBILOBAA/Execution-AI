"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MiniCalendar, toISO, formatDisplayDate } from "./MiniCalendar";

interface AddGoalModalProps {
  categoryName: string;
  /** Pre-fill for edit mode */
  initialTitle?: string;
  initialDate?: string;
  initialDescription?: string;
  mode?: "add" | "edit";
  onAdd: (title: string, targetDate: string, description: string) => void;
  onClose: () => void;
}

export function AddGoalModal({
  onAdd,
  onClose,
  initialTitle = "",
  initialDate,
  initialDescription = "",
  mode = "add",
}: AddGoalModalProps) {
  const today = new Date();
  const defaultDate = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [calOpen, setCalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(initialDate ?? defaultDate);
  const [error, setError] = useState("");

  const isEdit = mode === "edit";

  const handleSubmit = () => {
    if (!title.trim()) { setError("Goal title is required."); return; }
    onAdd(title.trim(), selectedDate, description.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="px-7 pt-7 pb-6">
          {/* Header */}
          <h2 className="font-headline text-xl font-bold mb-1" style={{ color: "#1a1f1e" }}>
            {isEdit ? "Edit Goal" : "Add New Goal"}
          </h2>
          <p className="text-sm mb-6" style={{ color: "#8a9e97" }}>
            {isEdit
              ? "Update your goal title or target date."
              : "Define your next milestone with architectural precision."}
          </p>

          {/* Goal title */}
          <div className="mb-5">
            <label
              className="block mb-2"
              style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}
            >
              Goal Title
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
              placeholder="e.g., Strategic Expansion Phase I"
              className={cn(
                "w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition",
                error ? "border-red-300 bg-red-50" : "border-[#e2e8e4] bg-[#f7f9f8]"
              )}
              style={{ color: "#1a1f1e" }}
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          <div className="mb-5">
            <label
              className="block mb-2"
              style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}
            >
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more context for this yearly goal."
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition resize-y min-h-[88px] border-[#e2e8e4] bg-[#f7f9f8]"
              style={{ color: "#1a1f1e" }}
            />
          </div>

          {/* Target date */}
          <div>
            <label
              className="block mb-2"
              style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}
            >
              <span className="sm:hidden">Target Date</span>
              <span className="hidden sm:inline">Target Completion Date</span>
            </label>
            <button
              type="button"
              onClick={() => setCalOpen(!calOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition"
              style={{
                borderColor: calOpen ? "#006c4a" : "#e2e8e4",
                background: "#f7f9f8",
                color: "#1a1f1e",
              }}
            >
              <span>{formatDisplayDate(selectedDate)}</span>
              <span className="material-symbols-outlined text-[18px]" style={{ color: "#b0bcb8" }}>
                calendar_month
              </span>
            </button>

            {calOpen && (
              <div className="mt-2">
                <MiniCalendar
                  selectedDate={selectedDate}
                  onSelect={(iso) => { setSelectedDate(iso); setCalOpen(false); }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-7 py-5"
          style={{ borderTop: "1px solid #f0f3f1" }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition"
            style={{ border: "1px solid #e2e8e4", color: "#5a6b65", background: "white" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#f7f9f8")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "white")}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition"
            style={{ background: "#006c4a" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#005f41")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#006c4a")}
          >
            {isEdit ? "Save Changes" : "Add Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
