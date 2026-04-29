"use client";

import { useState } from "react";
import type { Category, WeeklyGoal } from "@/lib/types";

interface Props {
  categories: Category[];
  weeklyGoals: WeeklyGoal[];
  initialTitle?: string;
  initialCategoryId?: string;
  initialWeeklyGoalId?: string;
  initialAllocation?: number;
  initialDescription?: string;
  onSubmit: (data: {
    title: string;
    categoryId?: string;
    estimatedMinutes: number;
    tag?: string;
    weeklyGoalId?: string;
    description: string;
  }) => void;
  onClose: () => void;
}

const ALLOC_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
];

export function AddSecondaryTaskModal({
  categories,
  weeklyGoals,
  initialTitle = "",
  initialCategoryId,
  initialWeeklyGoalId,
  initialAllocation = 30,
  initialDescription = "",
  onSubmit,
  onClose,
}: Props) {
  const isEdit = !!initialTitle;
  const [title, setTitle] = useState(initialTitle);
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? "");
  const [weeklyGoalId, setWeeklyGoalId] = useState(initialWeeklyGoalId ?? weeklyGoals[0]?.id ?? "");
  const [description, setDescription] = useState(initialDescription);
  const [allocation, setAllocation] = useState(
    ALLOC_OPTIONS.some((o) => o.value === initialAllocation) ? initialAllocation : 30
  );
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Please enter a task name.");
      return;
    }
    const cat = categories.find((c) => c.id === categoryId);
    onSubmit({
      title: title.trim(),
      categoryId: categoryId || undefined,
      estimatedMinutes: allocation,
      tag: cat?.name,
      weeklyGoalId: weeklyGoalId || undefined,
      description: description.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="px-7 pt-7 pb-0">
          {/* Top label + close */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#a8b5af" }}>
                Secondary Action
              </p>
              <h2 className="font-headline text-xl font-bold leading-snug" style={{ color: "#1a1f1e" }}>
                {isEdit ? "Edit Task" : "Add Secondary Task"}
              </h2>
              <p className="text-xs leading-relaxed mt-1" style={{ color: "#8a9e97" }}>
                Define a supporting task to optimize your daily execution flow.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 ml-4 transition-colors"
              style={{ color: "#8a9e97" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f4f2")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* TASK NAME */}
          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
              Task Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="e.g. Portfolio deep-review"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{
                background: "#f5f7f6",
                border: error ? "1.5px solid #ef4444" : "1px solid transparent",
                color: "#1a1f1e",
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,108,74,0.35)")}
              onBlur={(e) => (e.currentTarget.style.border = error ? "1.5px solid #ef4444" : "1px solid transparent")}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              autoFocus
            />
            {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
              Context & details <span className="font-medium normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quick context or success check."
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-y min-h-[64px]"
              style={{ background: "#f5f7f6", border: "1px solid rgba(0,0,0,0.06)", color: "#1a1f1e" }}
            />
          </div>

          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
              Link to Weekly Goal
            </label>
            <div className="relative">
              <select
                value={weeklyGoalId}
                onChange={(e) => setWeeklyGoalId(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-3 text-sm font-medium pr-10 focus:outline-none cursor-pointer"
                style={{
                  background: "#f5f7f6",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: weeklyGoalId ? "#1a1f1e" : "#a8b5af",
                }}
              >
                <option value="">No weekly parent selected</option>
                {weeklyGoals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[18px]" style={{ color: "#8a9e97" }}>
                unfold_more
              </span>
            </div>
          </div>

          {/* Strategic Alignment + Allocation side by side */}
          <div className="flex gap-4 mb-5">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
                Strategic Alignment
              </label>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full appearance-none rounded-xl px-3 py-2.5 text-sm font-medium pr-8 focus:outline-none cursor-pointer"
                  style={{
                    background: "#f5f7f6",
                    border: "1px solid rgba(0,0,0,0.06)",
                    color: categoryId ? "#1a1f1e" : "#a8b5af",
                  }}
                >
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span
                  className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[16px]"
                  style={{ color: "#8a9e97" }}
                >
                  unfold_more
                </span>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
                Allocation
              </label>
              <div className="flex gap-1.5">
                {ALLOC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAllocation(opt.value)}
                    className="flex-1 py-2.5 rounded-full text-xs font-semibold transition-all"
                    style={
                      allocation === opt.value
                        ? { background: "#006c4a", color: "#fff" }
                        : { background: "#f0f4f2", color: "#6b7b74" }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Architectural Tip card */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl mb-6"
            style={{ background: "#f5f7f6" }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "rgba(0,108,74,0.1)" }}
            >
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#006c4a" }}>
                auto_awesome
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "#1a1f1e" }}>
                Architectural Tip
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#8a9e97" }}>
                Secondary tasks are best scheduled after high-intensity deep work blocks to maintain momentum.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-4 px-7 py-5"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={onClose}
            className="text-sm font-semibold transition-colors"
            style={{ color: "#8a9e97" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1a1f1e")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#8a9e97")}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "#003d2b" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#006c4a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#003d2b")}
          >
            {isEdit ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
