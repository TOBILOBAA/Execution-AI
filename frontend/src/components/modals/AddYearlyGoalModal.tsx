"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { YearlyGoal } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: YearlyGoal;
}

export function AddYearlyGoalModal({ open, onClose, initialData }: Props) {
  const { categories, addYearlyGoal, updateYearlyGoal, removeYearlyGoal, activeDashboardDate } = useAppStore(
    useShallow((state) => ({
      categories: state.categories,
      addYearlyGoal: state.addYearlyGoal,
      updateYearlyGoal: state.updateYearlyGoal,
      removeYearlyGoal: state.removeYearlyGoal,
      activeDashboardDate: state.activeDashboardDate,
    })),
  );
  const isEdit = !!initialData;
  const titleId = isEdit ? "yearly-goal-edit-title" : "yearly-goal-add-title";
  const activeDashboardYear = Number(activeDashboardDate.slice(0, 4)) || new Date().getFullYear();

  const [title, setCategoryTitle] = useState(initialData?.title ?? "");
  const [categoryId, setCategoryId] = useState(
    initialData?.categoryId ?? categories[0]?.id ?? ""
  );
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [targetDate, setTargetDate] = useState(initialData?.targetDate ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategoryTitle(initialData?.title ?? "");
    setCategoryId(initialData?.categoryId ?? categories[0]?.id ?? "");
    setDescription(initialData?.description ?? "");
    setTargetDate(initialData?.targetDate ?? "");
    setError("");
  }, [open, initialData, categories]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim()) { setError("Goal name is required"); return; }
    if (isEdit && initialData) {
      updateYearlyGoal(initialData.id, {
        title: title.trim(),
        categoryId,
        description: description.trim() || undefined,
        targetDate: targetDate || undefined,
      });
    } else {
      addYearlyGoal({
        title: title.trim(),
        categoryId,
        ...(description.trim() ? { description: description.trim() } : {}),
        year: activeDashboardYear,
        status: "active",
        progress: 0,
        targetDate: targetDate || undefined,
      });
    }
    onClose();
  };

  const handleDiscard = () => {
    if (initialData) removeYearlyGoal(initialData.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white w-full max-w-[560px] max-h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-5 flex items-start justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 id={titleId} className="font-headline font-extrabold text-xl" style={{ color: "#1a1f1e" }}>
              {isEdit ? "Edit Yearly Goal" : "Add Yearly Goal"}
            </h2>
            <p className="text-sm mt-1" style={{ color: "#8a9e97" }}>
              {isEdit ? "Refine your vision for the upcoming year." : "Define a new anchor for your annual success."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors flex-shrink-0"
            style={{ color: "#8a9e97" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f6f4")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-6 overflow-y-auto">
          {/* Goal Name */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Goal Name
            </label>
            <input
              type="text"
              placeholder="e.g., Master Architectural Visualization"
              value={title}
              autoFocus
              onChange={(e) => { setCategoryTitle(e.target.value); setError(""); }}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "#f7f9f8",
                border: error ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)",
                color: "#1a1f1e",
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
              onBlur={(e) => (e.currentTarget.style.border = error ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)")}
            />
            {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Category
            </label>
            <div className="relative">
              <span
                className="material-symbols-outlined text-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#a8b5af" }}
              >
                category
              </span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-all appearance-none"
                style={{
                  background: "#f7f9f8",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: "#1a1f1e",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <span
                className="material-symbols-outlined text-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#a8b5af" }}
              >
                expand_more
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Description
            </label>
            <textarea
              placeholder="Add more context about what success looks like for this goal."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-y min-h-[96px]"
              style={{
                background: "#f7f9f8",
                border: "1.5px solid rgba(0,0,0,0.07)",
                color: "#1a1f1e",
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
              onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
            />
          </div>

          {/* Target Date */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Target Completion Date
            </label>
            <div className="relative">
              <span
                className="material-symbols-outlined text-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#a8b5af" }}
              >
                calendar_month
              </span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: "#f7f9f8",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: targetDate ? "#1a1f1e" : "#a8b5af",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          {/* Left: discard only in edit mode */}
          <div>
            {isEdit ? (
              <button
                onClick={handleDiscard}
                className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: "#ef4444" }}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Discard Goal
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-sm font-semibold transition-opacity hover:opacity-60"
                style={{ color: "#8a9e97" }}
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isEdit && (
              <button
                onClick={onClose}
                className="text-sm font-semibold transition-opacity hover:opacity-60"
                style={{ color: "#8a9e97" }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              className="px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: "#006c4a", boxShadow: "0 2px 10px rgba(0,108,74,0.20)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#004d38")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#006c4a")}
            >
              {isEdit ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
