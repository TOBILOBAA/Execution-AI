"use client";

import { useState } from "react";
import { MonthlyGoal } from "@/lib/types";

interface Props {
  mode: "main" | "secondary";
  monthlyGoals: MonthlyGoal[];
  currentCount?: number;
  maxCount?: number;
  limitMessage?: string;
  initialTitle?: string;
  initialMonthlyGoalId?: string;
  initialTargetDay?: string;
  initialDescription?: string;
  initialWorkload?: string;
  onSubmit: (data: {
    title: string;
    monthlyGoalId?: string;
    targetDay?: string;
    description: string;
    workload: string;
  }) => void;
  onClose: () => void;
}

const DAYS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

export function AddWeeklyGoalModal({
  mode,
  monthlyGoals,
  currentCount = 0,
  maxCount,
  limitMessage,
  initialTitle = "",
  initialMonthlyGoalId,
  initialTargetDay,
  initialDescription = "",
  initialWorkload = "",
  onSubmit,
  onClose,
}: Props) {
  const isMain = mode === "main";
  const isEdit = !!initialTitle;

  const [title, setTitle] = useState(initialTitle);
  const [selectedMonthlyGoalId, setSelectedMonthlyGoalId] = useState(
    initialMonthlyGoalId ?? monthlyGoals[0]?.id ?? ""
  );
  const [targetDay, setTargetDay] = useState<string>(initialTargetDay ?? "wed");
  const [description, setDescription] = useState(initialDescription);
  const [workload, setWorkload] = useState(initialWorkload);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) {
      setError("Please enter a goal name.");
      return;
    }
    if (!isEdit && typeof maxCount === "number" && currentCount >= maxCount) {
      setError(limitMessage ?? "You have reached the limit for this goal type.");
      return;
    }
    onSubmit({
      title: title.trim(),
      monthlyGoalId: selectedMonthlyGoalId || undefined,
      targetDay,
      description: description.trim(),
      workload: workload.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[88vh] overflow-hidden flex flex-col my-auto"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-0 overflow-y-auto min-h-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: "#a8b5af" }}
              >
                Strategic Alignment
              </p>
              <h2
                className="font-headline text-xl font-bold leading-snug"
                style={{ color: "#1a1f1e" }}
              >
                {isEdit
                  ? "Edit Weekly Goal"
                  : isMain
                  ? "Add Weekly Main Goal"
                  : "Add Weekly Secondary Goal"}
              </h2>
              <p className="text-xs leading-relaxed mt-1" style={{ color: "#8a9e97" }}>
                {isMain
                  ? "Define a high-impact objective for the next seven days to maintain momentum."
                  : "Define a secondary objective to support your main weekly goal and maintain momentum."}
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

          {/* SELECT MONTHLY GOAL */}
          <div className="mb-5">
            <label
              className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "#8a9e97" }}
            >
              Select Monthly Goal
            </label>
            <div className="relative">
              <select
                value={selectedMonthlyGoalId}
                onChange={(e) => setSelectedMonthlyGoalId(e.target.value)}
                className="w-full appearance-none rounded-xl px-4 py-3 text-sm font-medium pr-10 focus:outline-none"
                style={{
                  background: "#f5f7f6",
                  border: "1px solid rgba(0,0,0,0.08)",
                  color: "#1a1f1e",
                  cursor: "pointer",
                }}
              >
                <option value="">— None —</option>
                {monthlyGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
              <span
                className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[18px]"
                style={{ color: "#8a9e97" }}
              >
                expand_more
              </span>
            </div>
            <p className="text-[11px] italic mt-1.5" style={{ color: "#aabdb6" }}>
              This links your weekly effort to the &ldquo;bedrock&rdquo; structure.
            </p>
          </div>

          {/* WEEKLY TASK NAME */}
          <div className="mb-5">
            <label
              className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "#8a9e97" }}
            >
              Weekly Goal
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="e.g., Draft first 5 pages of the strategy document"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{
                background: "#f5f7f6",
                border: error ? "1.5px solid #ef4444" : "1px solid transparent",
                color: "#1a1f1e",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = "1.5px solid rgba(0,108,74,0.35)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = error
                  ? "1.5px solid #ef4444"
                  : "1px solid transparent")
              }
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              autoFocus
            />
            {error && (
              <p className="text-xs mt-1 text-red-500">{error}</p>
            )}
          </div>

          <div className="mb-5">
            <label
              className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "#8a9e97" }}
            >
              Context & details <span className="font-medium normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Success criteria, scope, or notes from AI you want to keep."
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-y min-h-[80px]"
              style={{ background: "#f5f7f6", border: "1px solid rgba(0,0,0,0.06)", color: "#1a1f1e" }}
            />
          </div>

          <div className="mb-5">
            <label
              className="block text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: "#8a9e97" }}
            >
              Effort estimate <span className="font-medium normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
              placeholder="e.g. ~4–6 hours this week"
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ background: "#f5f7f6", border: "1px solid rgba(0,0,0,0.06)", color: "#1a1f1e" }}
            />
          </div>

          {/* EXECUTION TARGET DAY */}
          <div className="mb-7">
            <label
              className="block text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "#8a9e97" }}
            >
              Execution Target Day
            </label>
            <div className="flex gap-2">
              {DAYS.map((d, idx) => {
                const isWeekend = idx >= 5;
                const isSelected = targetDay === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setTargetDay(d.key)}
                    className="flex-1 h-10 rounded-full text-xs font-bold transition-all"
                    style={
                      isSelected
                        ? { background: "#006c4a", color: "#fff" }
                        : {
                            background: isWeekend ? "#f5f7f6" : "#f0f4f2",
                            color: isWeekend ? "#c4d0cb" : "#6b7b74",
                          }
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-4 px-7 py-5 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold uppercase tracking-wider transition-colors"
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
            {isEdit ? "Save Changes" : "Add to Week"}
          </button>
        </div>
      </div>
    </div>
  );
}
