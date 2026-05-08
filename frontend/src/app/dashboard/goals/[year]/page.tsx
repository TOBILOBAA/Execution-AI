"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoalCompletionButton } from "@/components/goals/GoalCompletionButton";
import { GoalsHierarchyNav } from "@/components/goals/GoalsHierarchyNav";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import {
  deriveYearlyGoalReviewSummary,
  formatGoalDate,
  getYearlyGoalStateMeta,
  getMonthName,
  getProgressTone,
  groupMonthlyGoalsByYearly,
  groupWeeklyGoalsByMonthly,
} from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";

type FilterKey = "all" | "in-progress" | "ready-for-review" | "at-risk" | "not-started" | "completed";

function formatHeaderDate(todayIso: string) {
  const date = new Date(`${todayIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return todayIso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function YearlyGoalsPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const openModal = useAppStore((state) => state.openModal);
  const updateYearlyGoal = useAppStore((state) => state.updateYearlyGoal);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const {
    ready,
    hasCachedData,
    error,
    today,
    yearlyGoals,
    monthlyGoals,
    weeklyGoals,
    yearDailyPriorities,
    categories,
  } = useGoalsHierarchy(year);

  useEffect(() => {
    setPage(1);
  }, [filter, query]);

  const monthlyByYearly = useMemo(() => groupMonthlyGoalsByYearly(monthlyGoals), [monthlyGoals]);
  const weeklyByMonthly = useMemo(() => groupWeeklyGoalsByMonthly(weeklyGoals), [weeklyGoals]);
  const dailyByWeekly = useMemo(() => {
    const grouped = new Map<string, typeof yearDailyPriorities>();
    yearDailyPriorities.forEach((priority) => {
      if (!priority.weeklyGoalId) return;
      grouped.set(priority.weeklyGoalId, [...(grouped.get(priority.weeklyGoalId) ?? []), priority]);
    });
    return grouped;
  }, [yearDailyPriorities]);
  const yearEditable = year === Number(today.slice(0, 4));

  if (Number.isNaN(year)) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: "#8a9e97" }}>Invalid year.</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/goals")}
          className="mt-4 text-sm font-bold underline"
          style={{ color: "#006c4a" }}
        >
          Goals overview
        </button>
      </div>
    );
  }

  if (!ready && !hasCachedData) {
    return (
      <GoalsLoadingShell
        eyebrow={`${year} yearly goals`}
        title="Loading your yearly goals list"
        detail="We are checking every yearly outcome, its monthly children, and the weekly support underneath it before showing the list."
      />
    );
  }

  const rows = yearlyGoals.map((goal) => {
    const linkedMonthly = monthlyByYearly.get(goal.id) ?? [];
    const linkedWeekly = linkedMonthly.flatMap((monthlyGoal) => weeklyByMonthly.get(monthlyGoal.id) ?? []);
    const review = deriveYearlyGoalReviewSummary(goal, linkedMonthly, weeklyByMonthly, dailyByWeekly, today);
    const category = categories.find((item) => item.id === goal.categoryId);
    const firstScheduledMonth = [...linkedMonthly].sort((a, b) => a.month - b.month)[0] ?? null;
    return {
      goal,
      state: review.state,
      progress: review.progress,
      review,
      category,
      linkedMonthlyCount: linkedMonthly.length,
      linkedWeeklyCount: linkedWeekly.length,
      firstScheduledMonth,
    };
  });

  const counts = rows.reduce<Record<FilterKey, number>>(
    (acc, row) => {
      acc.all += 1;
      acc[row.state] += 1;
      return acc;
    },
    { all: 0, "in-progress": 0, "ready-for-review": 0, "at-risk": 0, "not-started": 0, completed: 0 },
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (filter !== "all" && row.state !== filter) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      row.goal.title,
      row.goal.description,
      row.category?.name,
      row.firstScheduledMonth ? getMonthName(row.firstScheduledMonth.month) : null,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(filteredRows.length, currentPage * pageSize);

  const filterItems: Array<{ id: FilterKey; label: string }> = [
    { id: "all", label: "All" },
    { id: "in-progress", label: "In Progress" },
    { id: "ready-for-review", label: "Ready for Review" },
    { id: "at-risk", label: "At Risk" },
    { id: "not-started", label: "Not Started" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => router.push("/dashboard/goals")}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
                style={{ color: "#8a9e97" }}
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                Goals
              </button>
              <span style={{ color: "#d1d9d5" }}>/</span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
                Yearly goals
              </span>
            </div>

            <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "30px", color: "#1a1f1e" }}>
              My Yearly Goals ({year})
            </h1>
            <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
              Your top-level goals for the year, with their status, progress, and planning depth.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#1a1f1e" }}
            >
              <span className="material-symbols-outlined text-[17px]">calendar_month</span>
              <span>{formatHeaderDate(today)}</span>
            </div>
            {yearEditable ? (
              <button
                type="button"
                onClick={() => openModal("add-yearly-goal")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#006c4a", color: "#fff" }}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Goal
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7c75" }}
                title="This period is locked. You can review it, but only the current period is editable."
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Read only
              </span>
            )}
          </div>
        </div>

        <GoalsHierarchyNav year={year} active="yearly" />
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.15)", color: "#8a5b12" }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-[28px] p-5"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {filterItems.map((item) => {
              const active = item.id === filter;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className="px-3.5 py-2 rounded-[18px] text-sm font-bold"
                  style={{
                    background: active ? "rgba(0,108,74,0.08)" : "#f7faf8",
                    color: active ? "#006c4a" : "#5d6d67",
                    border: active ? "1px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {item.label} ({counts[item.id]})
                </button>
              );
            })}
          </div>

          <label
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl w-full sm:w-auto sm:min-w-[220px]"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: "#8a9e97" }}>search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search goals..."
              className="w-full text-sm outline-none bg-transparent"
              style={{ color: "#1a1f1e" }}
            />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left">
                {["Goal", "Category", "Progress", "Status", "Actions"].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: "#8a9e97" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: "#8a9e97" }}>
                    No yearly goals match this filter yet.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const completed = row.state === "completed";
                  const stateMeta = getYearlyGoalStateMeta(row.state);
                  const progressTone = getProgressTone(row.progress);
                  return (
                    <tr key={row.goal.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td className="px-4 py-4 align-top">
                        <div className="max-w-[300px]">
                          <p className="text-sm font-semibold leading-relaxed" style={{ color: "#1a1f1e" }}>
                            {row.goal.title}
                          </p>
                          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#6b7c75" }}>
                            {row.goal.description || "No description saved yet."}
                          </p>
                          <p className="text-xs mt-2" style={{ color: "#8a9e97" }}>
                            {row.firstScheduledMonth
                              ? `Linked to ${row.linkedMonthlyCount} monthly goal${row.linkedMonthlyCount === 1 ? "" : "s"} and ${row.linkedWeeklyCount} weekly goal${row.linkedWeeklyCount === 1 ? "" : "s"} · Due ${formatGoalDate(row.goal.targetDate)}`
                              : `No monthly breakdown yet · Due ${formatGoalDate(row.goal.targetDate)}`}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="text-sm" style={{ color: row.category?.color || "#1a1f1e" }}>
                          <p className="font-semibold">{row.category?.name ?? "Uncategorised"}</p>
                          <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                            {row.firstScheduledMonth
                              ? `First scheduled month: ${getMonthName(row.firstScheduledMonth.month)}`
                              : "No monthly schedule yet"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top min-w-[180px]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold" style={{ color: progressTone }}>
                            {row.progress}%
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${row.progress}%`, background: progressTone }}
                          />
                        </div>
                        <p className="text-xs mt-2" style={{ color: "#8a9e97" }}>
                          Progress reflects aligned monthly execution, not outcome proof.
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2 max-w-[220px]">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                            style={{
                              color: stateMeta.text,
                              background: stateMeta.background,
                              border: `1px solid ${stateMeta.border}`,
                            }}
                          >
                            {stateMeta.label}
                          </span>
                          {row.review.note ? (
                            <p className="text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
                              {row.review.note}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2 flex-wrap">
                          {row.goal.editable ? (
                            <>
                              <GoalCompletionButton
                                completed={completed}
                                disabled={!completed && !row.review.canMarkComplete}
                                onClick={() =>
                                  updateYearlyGoal(row.goal.id, {
                                    status: completed ? "active" : "completed",
                                    progress: completed ? Math.min(row.progress, 99) : 100,
                                  })
                                }
                              />
                              {!completed && !row.review.canMarkComplete ? (
                                <span className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                                  Finish an aligned month before closing this goal.
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openModal("edit-yearly-goal", row.goal)}
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
                                aria-label="Edit yearly goal"
                              >
                                <span className="material-symbols-outlined text-[17px]">edit</span>
                                Edit
                              </button>
                            </>
                          ) : (
                            <span
                              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7c75" }}
                              title="This period is locked. You can review it, but only the current period is editable."
                            >
                              <span className="material-symbols-outlined text-[17px]">lock</span>
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 flex-wrap text-sm" style={{ color: "#6b7c75" }}>
          <p>
            Showing {startRow} to {endRow} of {filteredRows.length} filtered goals
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="h-10 px-3 rounded-xl inline-flex items-center justify-center"
              style={{
                background: currentPage === 1 ? "#f6f8f7" : "#fff",
                border: "1px solid rgba(0,0,0,0.06)",
                color: currentPage === 1 ? "#b0bdb7" : "#4b635b",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className="w-9 h-9 rounded-xl text-sm font-bold"
                style={{
                  background: pageNumber === currentPage ? "rgba(0,108,74,0.08)" : "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: pageNumber === currentPage ? "#006c4a" : "#6b7c75",
                }}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage === totalPages}
              className="h-10 px-3 rounded-xl inline-flex items-center justify-center"
              style={{
                background: currentPage === totalPages ? "#f6f8f7" : "#fff",
                border: "1px solid rgba(0,0,0,0.06)",
                color: currentPage === totalPages ? "#b0bdb7" : "#4b635b",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div
          className="mt-5 rounded-2xl px-4 py-3 text-sm"
          style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)", color: "#4b635b" }}
        >
          A yearly goal becomes <strong>In Progress</strong> once it has a linked monthly plan, <strong>Ready for Review</strong> when aligned month work is fully done, <strong>At Risk</strong> when a linked month closes unfinished without recovery underway, and <strong>Completed</strong> only when you confirm the outcome yourself.
        </div>
      </div>
    </div>
  );
}
