"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { WeeklyGoal } from "@/lib/types";
import { getWeekNumber } from "@/lib/goalsView";

interface Props {
  open: boolean;
  onClose: () => void;
  initialData?: WeeklyGoal;
  yearOverride?: number;
  monthOverride?: number;
  weekOverride?: number;
  defaultIsMain?: boolean;
}

export function AddWeeklyGoalModal({
  open,
  onClose,
  initialData,
  yearOverride,
  monthOverride,
  weekOverride,
  defaultIsMain,
}: Props) {
  const addWeeklyGoal = useAppStore((state) => state.addWeeklyGoal);
  const updateWeeklyGoal = useAppStore((state) => state.updateWeeklyGoal);
  const monthlyGoals = useAppStore((state) => state.monthlyGoals);
  const sessionWeekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const activeDashboardDate = useAppStore((state) => state.activeDashboardDate);
  const isEdit = !!initialData;
  const titleId = isEdit ? "weekly-goal-edit-title" : "weekly-goal-add-title";

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [monthlyGoalId, setMonthlyGoalId] = useState(initialData?.monthlyGoalId ?? "");
  const [isMain, setIsMain] = useState(initialData?.isMain ?? defaultIsMain ?? true);
  const [error, setError] = useState("");

  const activeDashboardReference = new Date(`${activeDashboardDate}T12:00:00`);
  const activeDashboardYear = Number(activeDashboardDate.slice(0, 4)) || new Date().getFullYear();
  const activeDashboardMonth = Number(activeDashboardDate.slice(5, 7)) || new Date().getMonth() + 1;
  const activeDashboardWeek = Number.isNaN(activeDashboardReference.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(activeDashboardReference, sessionWeekStartsOn);
  const effectiveWeek = initialData?.weekNumber ?? weekOverride ?? activeDashboardWeek;
  const effectiveMonth = initialData?.month ?? monthOverride ?? activeDashboardMonth;
  const effectiveYear = initialData?.year ?? yearOverride ?? activeDashboardYear;
  const availableMonthlyGoals = monthlyGoals.filter((goal) => goal.year === effectiveYear && goal.month === effectiveMonth);

  useEffect(() => {
    if (!open) return;
    setTitle(initialData?.title ?? "");
    setDescription(initialData?.description ?? "");
    setMonthlyGoalId(initialData?.monthlyGoalId ?? availableMonthlyGoals[0]?.id ?? "");
    setIsMain(initialData?.isMain ?? defaultIsMain ?? true);
    setError("");
  }, [availableMonthlyGoals, defaultIsMain, initialData, open]);

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
    if (!title.trim()) {
      setError("Goal title is required");
      return;
    }
    if (!monthlyGoalId) {
      setError("Pick a monthly goal first");
      return;
    }
    if (isEdit && initialData) {
      updateWeeklyGoal(initialData.id, { title: title.trim(), description, isMain, monthlyGoalId });
    } else {
      addWeeklyGoal({
        title: title.trim(),
        description,
        monthlyGoalId,
        isMain,
        weekNumber: effectiveWeek,
        month: effectiveMonth,
        year: effectiveYear,
        status: "active",
        progress: 0,
      });
    }
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
        className="bg-white w-full max-w-[620px] max-h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-5 flex items-start justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#006c4a" }}>
              Weekly planning
            </p>
            <h2 id={titleId} className="font-headline font-extrabold text-xl mt-2" style={{ color: "#1a1f1e" }}>
              {isEdit ? "Edit Weekly Goal" : "Add Weekly Goal"}
            </h2>
            <p className="text-sm mt-1 max-w-[420px]" style={{ color: "#8a9e97" }}>
              Give this week one unmistakable main objective, plus any supporting goals that help it move.
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

        <div className="px-8 py-7 space-y-6 overflow-y-auto">
          <div
            className="rounded-2xl p-5"
            style={{ background: "linear-gradient(135deg, rgba(0,108,74,0.08), rgba(255,255,255,0.98))", border: "1px solid rgba(0,108,74,0.12)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#006c4a" }}>
              This week
            </p>
            <h3 className="mt-2 text-base font-bold" style={{ color: "#1a1f1e" }}>
              Week {effectiveWeek} · {effectiveYear}
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5d6d67" }}>
              Pick the monthly goal this week should move. Then set the main goal and any secondary goals that support it.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Monthly Goal
            </label>
            <div className="relative">
              <select
                value={monthlyGoalId}
                disabled={availableMonthlyGoals.length === 0}
                onChange={(e) => { setMonthlyGoalId(e.target.value); setError(""); }}
                className="w-full rounded-xl px-4 pr-10 py-3 text-sm outline-none transition-all appearance-none disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "#f7f9f8",
                  border: error && !monthlyGoalId ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)",
                  color: "#1a1f1e",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                onBlur={(e) => (e.currentTarget.style.border = error && !monthlyGoalId ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)")}
              >
                {availableMonthlyGoals.length === 0 ? (
                  <option value="">Add a monthly goal first</option>
                ) : (
                  <>
                    <option value="">Select a monthly goal</option>
                    {availableMonthlyGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>{goal.title}</option>
                    ))}
                  </>
                )}
              </select>
              <span
                className="material-symbols-outlined text-[18px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#a8b5af" }}
              >
                expand_more
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Goal Role
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { value: true, label: "Main Goal", desc: "The one goal this week needs to carry" },
                { value: false, label: "Secondary Goal", desc: "Work that helps the main goal move" },
              ].map((option) => {
                const active = isMain === option.value;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setIsMain(option.value)}
                    className="rounded-2xl p-4 text-left transition-all duration-150"
                    style={{
                      background: active ? "rgba(0,108,74,0.08)" : "#f7f9f8",
                      border: active ? "1.5px solid rgba(0,108,74,0.28)" : "1.5px solid rgba(0,0,0,0.07)",
                      color: active ? "#006c4a" : "#5d6d67",
                      boxShadow: active ? "0 10px 24px rgba(0,108,74,0.10)" : "none",
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: active ? "#006c4a" : "#1a1f1e" }}>
                      {option.label}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: active ? "#2f6d58" : "#7f8d88" }}>
                      {option.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Goal Title
            </label>
            <input
              type="text"
              value={title}
              autoFocus
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="e.g., Finish the goals dashboard polish pass"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "#f7f9f8",
                border: error && !title.trim() ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)",
                color: "#1a1f1e",
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
              onBlur={(e) => (e.currentTarget.style.border = error && !title.trim() ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)")}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be true by the end of the week?"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all resize-y min-h-[110px]"
              style={{
                background: "#f7f9f8",
                border: "1.5px solid rgba(0,0,0,0.07)",
                color: "#1a1f1e",
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
              onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
            />
          </div>

          {error ? (
            <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <button
            onClick={onClose}
            className="text-sm font-semibold transition-opacity hover:opacity-60"
            style={{ color: "#8a9e97" }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!monthlyGoalId}
            className="px-7 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#006c4a", boxShadow: "0 2px 10px rgba(0,108,74,0.20)" }}
            onMouseEnter={(e) => {
              if (!monthlyGoalId) return;
              e.currentTarget.style.background = "#004d38";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#006c4a";
            }}
          >
            {isEdit ? "Save Changes" : "Create Weekly Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}
