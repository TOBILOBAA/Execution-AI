"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { getCurrentMonth, getCurrentYear } from "@/lib/mockData";
import type { Category, YearlyGoal } from "@/lib/types";

interface Props {
  mode: "main" | "secondary";
  categories: Category[];
  yearlyGoals: YearlyGoal[];
  currentCount?: number;
  maxCount?: number;
  limitMessage?: string;
  monthOverride?: number;
  yearOverride?: number;
  /** Pre-fill for edit */
  initialTitle?: string;
  initialCategoryId?: string;
  initialYearlyGoalId?: string;
  initialDate?: string;
  initialDescription?: string;
  initialWorkload?: string;
  onSubmit: (
    title: string,
    categoryId: string,
    yearlyGoalId: string,
    targetDate: string,
    description: string,
    workload: string,
  ) => void;
  onClose: () => void;
}

function daysRemainingInMonth(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayDay = today.getDate();
  return Math.max(0, lastDay - todayDay);
}

const MONTH_NAMES_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function endOfMonth(year: number, month: number) {
  // month is 1-indexed
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function AddMonthlyGoalModal({
  mode,
  categories,
  yearlyGoals,
  currentCount = 0,
  maxCount,
  limitMessage,
  monthOverride,
  yearOverride,
  initialTitle = "",
  initialCategoryId,
  initialYearlyGoalId,
  initialDate,
  initialDescription = "",
  initialWorkload = "",
  onSubmit,
  onClose,
}: Props) {
  const isMain = mode === "main";
  const isEdit = !!initialTitle;
  const effectiveMonth = monthOverride ?? getCurrentMonth();
  const effectiveYear = yearOverride ?? getCurrentYear();
  const defaultDate = initialDate ?? endOfMonth(effectiveYear, effectiveMonth);

  const [title, setTitle] = useState(initialTitle);
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? categories[0]?.id ?? "");
  const [yearlyGoalId, setYearlyGoalId] = useState(initialYearlyGoalId ?? yearlyGoals[0]?.id ?? "");
  const [targetDate, setTargetDate] = useState(defaultDate);
  const [description, setDescription] = useState(initialDescription);
  const [workload, setWorkload] = useState(initialWorkload);
  const [error, setError] = useState("");

  const daysLeft = daysRemainingInMonth(effectiveYear, effectiveMonth);
  const monthName = MONTH_NAMES_FULL[effectiveMonth - 1];

  const handleSubmit = () => {
    if (!title.trim()) { setError("Goal name is required."); return; }
    if (!isEdit && typeof maxCount === "number" && currentCount >= maxCount) {
      setError(limitMessage ?? "You have reached the limit for this goal type.");
      return;
    }
    onSubmit(title.trim(), categoryId, yearlyGoalId, targetDate, description.trim(), workload.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] sm:max-h-[88vh] overflow-hidden flex flex-col my-auto"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-0 overflow-y-auto min-h-0">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-headline text-xl font-bold" style={{ color: "#1a1f1e" }}>
              {isEdit ? "Edit Goal" : isMain ? "Add Main Goal" : "Add Secondary Goal"}
            </h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition" style={{ color: "#5a6b65" }}>
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <p className="text-sm mb-6" style={{ color: "#8a9e97" }}>
            {isMain
              ? "Define a major objective for your month tied to your long-term vision."
              : "Add a secondary goal to strengthen the month without crowding the main goal."}
          </p>

          {/* Category selector */}
          <div className="mb-5">
            <label className="block mb-3" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Select Yearly Category
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
                      background: isSelected ? "#006c4a" : "#f4f6f4",
                      border: isSelected ? "none" : "1px solid transparent",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={{ color: isSelected ? "#ffffff" : "#5a6b65" }}
                    >
                      {cat.icon}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: isSelected ? "#ffffff" : "#8a9e97" }}
                    >
                      {cat.name.length > 8 ? cat.name.split(" ")[0] : cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parent yearly goal selector */}
          <div className="mb-5">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Link to Yearly Goal
            </label>
            <div className="relative">
              <select
                value={yearlyGoalId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setYearlyGoalId(nextId);
                  const parent = yearlyGoals.find((g) => g.id === nextId);
                  if (parent?.categoryId) setCategoryId(parent.categoryId);
                }}
                className="w-full appearance-none px-4 py-3 rounded-xl border text-sm focus:outline-none focus:border-[#006c4a] transition"
                style={{ borderColor: "#e2e8e4", background: "#f7f9f8", color: yearlyGoalId ? "#1a1f1e" : "#8a9e97" }}
              >
                <option value="">No yearly parent selected</option>
                {yearlyGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[18px]" style={{ color: "#8a9e97" }}>
                expand_more
              </span>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: "#a8b5af" }}>
              This keeps the yearly → monthly hierarchy visible across the dashboard.
            </p>
          </div>

          {/* Goal name */}
          <div className="mb-5">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Goal Name
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
              placeholder={isMain ? "e.g. Launch the Q1 Marketing Campaign" : "e.g. Complete Advanced React Architecture Module"}
              className={cn(
                "w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition",
                error ? "border-red-300 bg-red-50" : "border-[#e2e8e4] bg-[#f7f9f8] focus:border-[#006c4a]"
              )}
              style={{ color: "#1a1f1e" }}
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </div>

          {/* Description */}
          <div className="mb-5">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Context & details <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: "0" }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Why this goal matters this month, success criteria, or notes from AI you want to keep."
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition resize-y min-h-[88px]"
              style={{ borderColor: "#e2e8e4", background: "#f7f9f8", color: "#1a1f1e" }}
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            />
          </div>

          {/* Effort estimate */}
          <div className="mb-5">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              Effort estimate <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: "0" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={workload}
              onChange={(e) => setWorkload(e.target.value)}
              placeholder="e.g. ~10–15 hours this month"
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:border-[#006c4a] transition"
              style={{ borderColor: "#e2e8e4", background: "#f7f9f8", color: "#1a1f1e" }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
            />
          </div>

          {/* Target date */}
          <div className="mb-7">
            <label className="block mb-2" style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8a9e97" }}>
              <span className="sm:hidden">Target Date</span>
              <span className="hidden sm:inline">Target Completion Date</span>
            </label>
            <div className="relative">
              <span
                className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]"
                style={{ color: "#a8b5af" }}
              >
                calendar_month
              </span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full min-w-0 rounded-xl pl-10 pr-4 py-3 text-[13px] outline-none transition-all sm:text-sm"
                style={{ border: "1.5px solid rgba(0,0,0,0.07)", background: "#f7f9f8", color: targetDate ? "#1a1f1e" : "#a8b5af" }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid #006c4a")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)")}
              />
            </div>
            <div className="mt-3 flex items-start gap-1.5">
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#a8b5af" }}>info</span>
              <span className="text-xs" style={{ color: "#8a9e97" }}>
                {daysLeft} days remaining in {monthName}.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-7 py-5 flex-shrink-0" style={{ borderTop: "1px solid #f0f3f1" }}>
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
            {isEdit ? "Save Changes" : "Add to Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
