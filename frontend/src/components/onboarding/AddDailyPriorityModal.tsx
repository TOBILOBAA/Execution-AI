"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";

interface Props {
  categories: Category[];
  initialTitle?: string;
  initialCategoryId?: string;
  initialAllocation?: number;
  initialDescription?: string;
  onSubmit: (data: {
    title: string;
    categoryId?: string;
    estimatedMinutes: number;
    tag?: string;
    description: string;
  }) => void;
  onClose: () => void;
}

const ALLOC_OPTIONS = [
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h+", value: 120 },
];

export function AddDailyPriorityModal({
  categories,
  initialTitle = "",
  initialCategoryId,
  initialAllocation = 30,
  initialDescription = "",
  onSubmit,
  onClose,
}: Props) {
  const isEdit = !!initialTitle;
  const [title, setTitle] = useState(initialTitle);
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? "");
  const [description, setDescription] = useState(initialDescription);
  const [allocation, setAllocation] = useState(
    ALLOC_OPTIONS.some((o) => o.value === initialAllocation) ? initialAllocation : 30
  );
  const [isCustom, setIsCustom] = useState(
    !ALLOC_OPTIONS.some((o) => o.value === initialAllocation)
  );
  const [customMins, setCustomMins] = useState(String(initialAllocation));
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Please enter a task name.");
      return;
    }
    const mins = isCustom ? parseInt(customMins) || 30 : allocation;
    const cat = categories.find((c) => c.id === categoryId);
    onSubmit({
      title: title.trim(),
      categoryId: categoryId || undefined,
      estimatedMinutes: mins,
      tag: cat?.name,
      description: description.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="px-7 pt-7 pb-0">
          <h2 className="font-headline text-2xl font-bold mb-1" style={{ color: "#1a1f1e" }}>
            {isEdit ? "Edit Priority" : "Add Daily Priority"}
          </h2>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "#8a9e97" }}>
            Align your daily output with your architectural pillars.
          </p>

          {/* TASK NAME */}
          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
              Task Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="What is your primary execution focus?"
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
              rows={3}
              placeholder="What “done” looks like, blockers to watch, or notes from AI."
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-y min-h-[76px]"
              style={{ background: "#f5f7f6", border: "1px solid rgba(0,0,0,0.06)", color: "#1a1f1e" }}
            />
          </div>

          {/* STRATEGIC ALIGNMENT */}
          <div className="mb-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#8a9e97" }}>
              Strategic Alignment
            </label>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-3 text-sm font-medium pr-10 focus:outline-none cursor-pointer"
                style={{
                  background: "#f5f7f6",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: categoryId ? "#1a1f1e" : "#a8b5af",
                }}
              >
                <option value="">Select a yearly pillar...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span
                className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[18px]"
                style={{ color: "#8a9e97" }}
              >
                unfold_more
              </span>
            </div>
          </div>

          {/* ALLOCATION */}
          <div className="mb-7">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#8a9e97" }}>
              Allocation
            </label>
            <div className="flex gap-2">
              {ALLOC_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setAllocation(opt.value); setIsCustom(false); }}
                  className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-all"
                  style={
                    !isCustom && allocation === opt.value
                      ? { background: "#006c4a", color: "#fff" }
                      : { background: "#f0f4f2", color: "#6b7b74" }
                  }
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setIsCustom(true)}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-1 transition-all"
                style={
                  isCustom
                    ? { background: "#006c4a", color: "#fff" }
                    : { background: "#f0f4f2", color: "#6b7b74" }
                }
              >
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Custom
              </button>
            </div>
            {isCustom && (
              <input
                type="number"
                value={customMins}
                onChange={(e) => setCustomMins(e.target.value)}
                placeholder="Enter minutes"
                className="mt-2.5 w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{
                  background: "#f5f7f6",
                  border: "1.5px solid rgba(0,108,74,0.3)",
                  color: "#1a1f1e",
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <p className="text-[11px] mb-4 flex items-center gap-1.5" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#006c4a" }}>
              auto_awesome
            </span>
            <span className="font-bold uppercase tracking-widest text-[10px]" style={{ color: "#8a9e97" }}>
              Architectural Tip:
            </span>
            <span style={{ color: "#a8b5af" }}>
              Deep work sprints are most effective before 11:00 AM.
            </span>
          </p>
          <div className="flex items-center justify-end gap-4">
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
              {isEdit ? "Save Changes" : "Add Priority"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
