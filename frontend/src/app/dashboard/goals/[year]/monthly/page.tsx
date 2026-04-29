"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoalsHierarchyNav } from "@/components/goals/GoalsHierarchyNav";
import { GoalsInfoTooltip } from "@/components/goals/GoalsInfoTooltip";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import {
  averageProgress,
  countGoalStates,
  getProgressTone,
  GOALS_MONTH_NAMES,
} from "@/lib/goalsView";

const STATUS_HELP = {
  completed: "Completed monthly goals for that month.",
  inProgress: "Goals that have started and are moving forward without being overdue.",
  atRisk: "Goals that are overdue or have already been marked missed.",
  notStarted: "Goals that still have no progress or are still pending.",
} as const;

const STATUS_GUIDE_DETAIL = [
  `Completed: ${STATUS_HELP.completed}`,
  `In Progress: ${STATUS_HELP.inProgress}`,
  `At Risk: ${STATUS_HELP.atRisk}`,
  `Not Started: ${STATUS_HELP.notStarted}`,
].join(" ");

function formatHeaderDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MonthlyGoalsPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);

  const {
    ready,
    loading,
    error,
    currentMonth,
    currentWeekNumber,
    monthlyGoals,
  } = useGoalsHierarchy(year);

  const monthQuery = searchParams?.get("month");
  const selectedMonth =
    monthQuery === "all" || !monthQuery
      ? "all"
      : Math.max(1, Math.min(12, parseInt(monthQuery, 10) || currentMonth));

  useEffect(() => {
    setPage(1);
  }, [selectedMonth]);

  const rows = useMemo(
    () =>
      GOALS_MONTH_NAMES.map((label, index) => {
        const month = index + 1;
        const goals = monthlyGoals.filter((goal) => goal.month === month);
        const stateCounts = countGoalStates(goals);
        return {
          month,
          label,
          goalsSet: goals.length,
          completed: stateCounts.completed,
          inProgress: stateCounts["on-track"],
          atRisk: stateCounts["at-risk"],
          notStarted: stateCounts["not-started"],
          progress: averageProgress(goals),
        };
      }),
    [monthlyGoals],
  );

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

  if (!ready || loading) {
    return (
      <GoalsLoadingShell
        eyebrow={`${year} monthly goals`}
        title="Loading the monthly goals layer"
        detail="We are pulling every month across the year so the system can show where the yearly strategy actually becomes a monthly plan."
      />
    );
  }

  const filteredRows = selectedMonth === "all" ? rows : rows.filter((row) => row.month === selectedMonth);
  const pageSize = selectedMonth === "all" ? 6 : 12;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(filteredRows.length, currentPage * pageSize);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/goals/${year}`)}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
                style={{ color: "#8a9e97" }}
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                Goals
              </button>
              <span style={{ color: "#d1d9d5" }}>/</span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
                Monthly goals
              </span>
            </div>

            <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "30px", color: "#1a1f1e" }}>
              All Monthly Goals
            </h1>
            <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
              A snapshot of how each month is carrying the yearly plan across {year}.
            </p>
          </div>

          <div
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#1a1f1e" }}
          >
            <span className="material-symbols-outlined text-[17px]">calendar_month</span>
            <span>{formatHeaderDate()}</span>
          </div>
        </div>

        <GoalsHierarchyNav
          year={year}
          active="monthly"
          currentMonth={currentMonth}
          currentWeekNumber={currentWeekNumber}
        />
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
          <div
            className="flex items-center gap-1.5 flex-wrap rounded-[18px] p-1.5 overflow-x-auto"
            style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <button
              type="button"
              onClick={() => router.push(`/dashboard/goals/${year}/monthly?month=all`)}
              className="px-3.5 py-2 rounded-[14px] text-sm font-semibold"
              style={{
                background: selectedMonth === "all" ? "#ffffff" : "transparent",
                boxShadow: selectedMonth === "all" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                color: selectedMonth === "all" ? "#006c4a" : "#5d6d67",
              }}
            >
              All Months
            </button>
            {GOALS_MONTH_NAMES.map((label, index) => {
              const month = index + 1;
              const active = selectedMonth === month;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => router.push(`/dashboard/goals/${year}/monthly?month=${month}`)}
                  className="px-3 py-2 rounded-[14px] text-sm font-semibold transition-colors"
                  style={{
                    background: active ? "#ffffff" : "transparent",
                    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                    color: active ? "#006c4a" : "#7b8b84",
                  }}
                >
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <div
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
          >
            <span>Status guide</span>
            <GoalsInfoTooltip label="Monthly goal statuses" detail={STATUS_GUIDE_DETAIL} />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[22px]" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          <table className="min-w-full">
            <thead>
              <tr className="text-left" style={{ background: "#fbfcfb" }}>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  Month
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  Goals Set
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  Completed
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  In Progress
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  At Risk
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  Not Started
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const progressTone = getProgressTone(row.progress);
                return (
                  <tr
                    key={row.month}
                    style={{
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                      background: row.month === currentMonth ? "rgba(0,108,74,0.03)" : "transparent",
                    }}
                  >
                    <td className="px-4 py-4 text-sm font-semibold" style={{ color: row.month === currentMonth ? "#006c4a" : "#1a1f1e" }}>
                      {row.label}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#1a1f1e" }}>
                      {row.goalsSet}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#0b7a53" }}>
                      {row.completed}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#006c4a" }}>
                      {row.inProgress}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#b45309" }}>
                      {row.atRisk}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#667781" }}>
                      {row.notStarted}
                    </td>
                    <td className="px-4 py-4 min-w-[170px]">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold min-w-[36px]" style={{ color: progressTone }}>
                          {row.progress}%
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${row.progress}%`, background: progressTone }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 flex-wrap text-sm" style={{ color: "#6b7c75" }}>
          <p>
            Showing {startRow} to {endRow} of {filteredRows.length} months
          </p>
          {selectedMonth === "all" && totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3 rounded-xl inline-flex items-center justify-center"
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
                className="h-9 px-3 rounded-xl inline-flex items-center justify-center"
                style={{
                  background: currentPage === totalPages ? "#f6f8f7" : "#fff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: currentPage === totalPages ? "#b0bdb7" : "#4b635b",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          ) : (
            <div className="h-9" />
          )}
        </div>
      </div>
    </div>
  );
}
