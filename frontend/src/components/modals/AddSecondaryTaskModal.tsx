"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { DailyPriority } from "@/lib/types";
import { getWeekNumber } from "@/lib/goalsView";

const TIME_PILLS = [
  { value: 15, label: "15m", sub: "SPRT" },
  { value: 30, label: "30m", sub: "FOCUS" },
  { value: 60, label: "1h",  sub: "DEEP" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: DailyPriority;
}

export function AddSecondaryTaskModal({ open, onClose, initialData }: Props) {
  const { addSecondaryTask, updateSecondaryTask, categories, weeklyGoals, sessionWeekStartsOn, activeDashboardDate } = useAppStore(
    useShallow((state) => ({
      addSecondaryTask: state.addSecondaryTask,
      updateSecondaryTask: state.updateSecondaryTask,
      categories: state.categories,
      weeklyGoals: state.weeklyGoals,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
      activeDashboardDate: state.activeDashboardDate,
    })),
  );
  const isEdit = !!initialData;
  const titleId = isEdit ? "secondary-task-edit-title" : "secondary-task-add-title";
  const referenceWeekDate = initialData?.date ?? activeDashboardDate;
  const referenceWeekYear = Number(referenceWeekDate.slice(0, 4)) || new Date().getFullYear();
  const referenceWeekSource = new Date(`${referenceWeekDate}T12:00:00`);
  const referenceWeekNumber = Number.isNaN(referenceWeekSource.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(referenceWeekSource, sessionWeekStartsOn);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [alignment, setAlignment] = useState(
    initialData?.tag ?? (categories[0]?.name ?? "")
  );
  const [weeklyGoalId, setWeeklyGoalId] = useState(initialData?.weeklyGoalId ?? "");
  const [minutes, setMinutes] = useState<number>(
    initialData?.estimatedMinutes ?? 15
  );
  const [error, setError] = useState("");
  const availableWeeklyGoals = weeklyGoals.filter(
    (goal) => goal.year === referenceWeekYear && goal.weekNumber === referenceWeekNumber,
  );

  useEffect(() => {
    if (!open) return;
    setTitle(initialData?.title ?? "");
    setAlignment(initialData?.tag ?? (categories[0]?.name ?? ""));
    setWeeklyGoalId(initialData?.weeklyGoalId ?? availableWeeklyGoals[0]?.id ?? "");
    setMinutes(initialData?.estimatedMinutes ?? 15);
    setError("");
  }, [availableWeeklyGoals, categories, initialData, open]);

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
    if (!title.trim()) { setError("Task name is required"); return; }
    if (!weeklyGoalId) { setError("Pick a weekly goal first"); return; }
    if (isEdit && initialData) {
      updateSecondaryTask(initialData.id, {
        title: title.trim(),
        tag: alignment,
        estimatedMinutes: minutes,
        weeklyGoalId,
      });
    } else {
      addSecondaryTask({
        title: title.trim(),
        tag: alignment,
        weeklyGoalId,
        estimatedMinutes: minutes,
        isMain: false,
        date: activeDashboardDate,
        status: "active",
        completed: false,
        priority: "medium",
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white w-full max-w-[460px] rounded-3xl shadow-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 flex items-start justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
              {isEdit ? "Edit Task" : "Execution Layer"}
            </p>
            <h2 id={titleId} className="font-headline font-extrabold text-xl" style={{ color: "#1a1f1e" }}>
              {isEdit ? "Edit Secondary Task" : "New Secondary Task"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "#8a9e97" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f6f4")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-7 space-y-6">
          {/* Task Name */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Task Name
            </label>
            <input
              type="text"
              placeholder="e.g., Review architectural diagrams"
              value={title}
              autoFocus
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
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

          {/* Strategic Alignment */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Weekly Goal
            </label>
            <div className="relative">
              <select
                value={weeklyGoalId}
                onChange={(e) => { setWeeklyGoalId(e.target.value); setError(""); }}
                className="w-full appearance-none rounded-xl px-4 py-3 text-sm outline-none transition-all cursor-pointer"
                style={{
                  background: "#f7f9f8",
                  border: error && !weeklyGoalId ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)",
                  color: "#1a1f1e",
                }}
              >
                {availableWeeklyGoals.length === 0 ? (
                  <option value="">Add a weekly goal first</option>
                ) : (
                  <>
                    <option value="">Select a weekly goal</option>
                    {availableWeeklyGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>{goal.title}</option>
                    ))}
                  </>
                )}
              </select>
              <span
                className="material-symbols-outlined text-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#8a9e97" }}
              >
                expand_more
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Strategic Alignment
            </label>
            <div className="relative">
              <select
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-3 text-sm outline-none transition-all cursor-pointer"
                style={{
                  background: "#f7f9f8",
                  border: "1.5px solid rgba(0,0,0,0.07)",
                  color: "#1a1f1e",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <span
                className="material-symbols-outlined text-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#8a9e97" }}
              >
                expand_more
              </span>
            </div>
          </div>

          {/* Time Allocation */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Time Allocation
            </label>
            <div className="grid grid-cols-3 gap-3">
              {TIME_PILLS.map((pill) => {
                const active = minutes === pill.value;
                return (
                  <button
                    key={pill.value}
                    onClick={() => setMinutes(pill.value)}
                    className="flex flex-col items-center justify-center py-4 rounded-xl font-bold transition-all duration-150"
                    style={{
                      background: active ? "#006c4a" : "#f7f9f8",
                      color: active ? "#fff" : "#8a9e97",
                      border: "1.5px solid",
                      borderColor: active ? "#006c4a" : "rgba(0,0,0,0.07)",
                    }}
                  >
                    <span className="text-[15px] leading-none">{pill.label}</span>
                    <span
                      className="text-[9px] font-bold tracking-widest mt-1.5"
                      style={{ color: active ? "rgba(255,255,255,0.65)" : "#c4d0cb" }}
                    >
                      {pill.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <button
            onClick={onClose}
            className="text-sm font-semibold uppercase tracking-wide transition-opacity hover:opacity-60"
            style={{ color: "#8a9e97" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!weeklyGoalId}
            className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "#003d2b", boxShadow: "0 2px 10px rgba(0,108,74,0.22)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#006c4a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#003d2b")}
          >
            {isEdit ? "Save Changes" : "Add to Today"}
            <span className="material-symbols-outlined text-[16px]">{isEdit ? "check" : "bolt"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
