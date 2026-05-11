"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { DailyPriority } from "@/lib/types";
import { getWeekNumber } from "@/lib/goalsView";

const ORDINALS = ["ONE", "TWO", "THREE"];

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: "add" | "edit";
  initialData?: DailyPriority;
}

export function AddDailyPriorityModal({ open, onClose, mode = "add", initialData }: Props) {
  const { dailyPriorities, categories, weeklyGoals, sessionWeekStartsOn, addDailyPriority, updateDailyPriority, activeDashboardDate } = useAppStore(
    useShallow((state) => ({
      dailyPriorities: state.dailyPriorities,
      categories: state.categories,
      weeklyGoals: state.weeklyGoals,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
      addDailyPriority: state.addDailyPriority,
      updateDailyPriority: state.updateDailyPriority,
      activeDashboardDate: state.activeDashboardDate,
    })),
  );
  const isEditMode = mode === "edit";
  const isBatchEdit = isEditMode && !initialData;
  const titleId = isBatchEdit ? "daily-priority-batch-title" : "daily-priority-single-title";
  const referenceWeekDate = initialData?.date ?? activeDashboardDate;
  const referenceWeekYear = Number(referenceWeekDate.slice(0, 4)) || new Date().getFullYear();
  const referenceWeekSource = new Date(`${referenceWeekDate}T12:00:00`);
  const referenceWeekNumber = Number.isNaN(referenceWeekSource.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(referenceWeekSource, sessionWeekStartsOn);

  // Batch-edit state: mirror current priorities
  const [edits, setEdits] = useState<{ id: string; title: string; tag: string }[]>(() =>
    dailyPriorities.map((p) => ({
      id: p.id,
      title: p.title,
      tag: p.tag ?? (categories[0]?.name ?? ""),
    }))
  );

  // Single-add state
  const [singleTitle, setSingleTitle] = useState(initialData?.title ?? "");
  const [singleTag, setSingleTag] = useState(
    initialData?.tag ?? (categories[0]?.name ?? "")
  );
  const [singleWeeklyGoalId, setSingleWeeklyGoalId] = useState(initialData?.weeklyGoalId ?? "");
  const [singleError, setSingleError] = useState("");
  const availableWeeklyGoals = weeklyGoals.filter(
    (goal) => goal.year === referenceWeekYear && goal.weekNumber === referenceWeekNumber,
  );
  const mainPriorityCapReached =
    !initialData && dailyPriorities.filter((priority) => priority.date === activeDashboardDate).length >= 3;

  useEffect(() => {
    if (!open) return;
    setEdits(
      dailyPriorities.map((p) => ({
        id: p.id,
        title: p.title,
        tag: p.tag ?? (categories[0]?.name ?? ""),
      })),
    );
    setSingleTitle(initialData?.title ?? "");
    setSingleTag(initialData?.tag ?? (categories[0]?.name ?? ""));
    setSingleWeeklyGoalId(initialData?.weeklyGoalId ?? availableWeeklyGoals[0]?.id ?? "");
    setSingleError("");
  }, [open, initialData, dailyPriorities, categories, availableWeeklyGoals]);

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

  const handleSaveBatch = () => {
    edits.forEach((e) => {
      if (e.title.trim()) {
        updateDailyPriority(e.id, { title: e.title.trim(), tag: e.tag });
      }
    });
    onClose();
  };

  const handleSaveSingle = () => {
    if (mainPriorityCapReached) {
      setSingleError("You can only save up to 3 main priorities for this day.");
      return;
    }
    if (!singleTitle.trim()) { setSingleError("Priority title is required"); return; }
    if (!singleWeeklyGoalId) { setSingleError("Pick a weekly goal first"); return; }
    if (initialData) {
      updateDailyPriority(initialData.id, { title: singleTitle.trim(), tag: singleTag, weeklyGoalId: singleWeeklyGoalId });
    } else {
      addDailyPriority({
        title: singleTitle.trim(),
        tag: singleTag,
        weeklyGoalId: singleWeeklyGoalId,
        isMain: true,
        date: activeDashboardDate,
        status: "active",
        completed: false,
        priority: "high",
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="bg-white w-full max-w-[520px] max-h-[calc(100vh-2rem)] sm:max-h-[88vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto"
        style={{ border: "1px solid rgba(0,0,0,0.07)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-7 pb-6 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 id={titleId} className="font-headline font-extrabold text-xl" style={{ color: "#1a1f1e" }}>
            {isBatchEdit ? "Manage Daily Priorities" : (initialData ? "Edit Priority" : "Add Priority")}
          </h2>
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
        <div className="px-8 py-7 space-y-5 overflow-y-auto">
          {isBatchEdit ? (
            edits.map((edit, idx) => (
              <div key={edit.id} className="space-y-2">
                {/* Row number + label */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                    style={{ background: "rgba(0,108,74,0.10)", color: "#006c4a" }}
                  >
                    {idx + 1}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>
                    Priority {ORDINALS[idx] ?? idx + 1}
                  </span>
                </div>
                {/* Inputs */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={edit.title}
                    onChange={(e) =>
                      setEdits((prev) => prev.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))
                    }
                    className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: "#f7f9f8",
                      border: "1.5px solid rgba(0,0,0,0.07)",
                      color: "#1a1f1e",
                    }}
                    placeholder={`Priority ${idx + 1} title...`}
                    onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                    onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
                  />
                  <div className="relative w-[160px] flex-shrink-0">
                    <select
                      value={edit.tag}
                      onChange={(e) =>
                        setEdits((prev) => prev.map((x, i) => i === idx ? { ...x, tag: e.target.value } : x))
                      }
                      className="w-full appearance-none rounded-xl px-3 py-3 text-sm outline-none cursor-pointer transition-all"
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
                      className="material-symbols-outlined text-[16px] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "#8a9e97" }}
                    >
                      expand_more
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* Single add/edit */
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                  Weekly Goal
                </label>
                <div className="relative">
                  <select
                    value={singleWeeklyGoalId}
                    onChange={(e) => { setSingleWeeklyGoalId(e.target.value); setSingleError(""); }}
                    className="w-full appearance-none rounded-xl px-4 py-3 text-sm outline-none cursor-pointer transition-all"
                    style={{
                      background: "#f7f9f8",
                      border: singleError && !singleWeeklyGoalId ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)",
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
                  Priority Title
                </label>
                <input
                  type="text"
                  value={singleTitle}
                  autoFocus
                  onChange={(e) => { setSingleTitle(e.target.value); setSingleError(""); }}
                  placeholder="e.g., Finalize Q4 Strategy Deck"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: "#f7f9f8",
                    border: singleError ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)",
                    color: "#1a1f1e",
                  }}
                  onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                  onBlur={(e) => (e.currentTarget.style.border = singleError ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.07)")}
                />
                {singleError && <p className="text-xs" style={{ color: "#ef4444" }}>{singleError}</p>}
                {mainPriorityCapReached && !singleError && (
                  <p className="text-xs" style={{ color: "#a25a5a" }}>
                    This day already has 3 main priorities. Remove or edit one before adding another.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                  Strategic Alignment
                </label>
                <div className="relative">
                  <select
                    value={singleTag}
                    onChange={(e) => setSingleTag(e.target.value)}
                    className="w-full appearance-none rounded-xl px-4 py-3 text-sm outline-none cursor-pointer transition-all"
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-8 py-5 flex items-center justify-end gap-4 flex-shrink-0"
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
            onClick={isBatchEdit ? handleSaveBatch : handleSaveSingle}
            disabled={!isBatchEdit && (!singleWeeklyGoalId || mainPriorityCapReached)}
            className="px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: !isBatchEdit && (!singleWeeklyGoalId || mainPriorityCapReached) ? "#8a9e97" : "#006c4a",
              boxShadow: !isBatchEdit && (!singleWeeklyGoalId || mainPriorityCapReached)
                ? "none"
                : "0 2px 10px rgba(0,108,74,0.20)",
            }}
            onMouseEnter={(e) => {
              if (!(!isBatchEdit && (!singleWeeklyGoalId || mainPriorityCapReached))) {
                e.currentTarget.style.background = "#004d38";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = !isBatchEdit && (!singleWeeklyGoalId || mainPriorityCapReached)
                ? "#8a9e97"
                : "#006c4a";
            }}
          >
            {isBatchEdit ? "Save Changes" : initialData ? "Save Priority" : "Add Priority"}
          </button>
        </div>
      </div>
    </div>
  );
}
