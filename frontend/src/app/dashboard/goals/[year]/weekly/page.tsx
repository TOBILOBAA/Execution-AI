"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GoalsHierarchyNav } from "@/components/goals/GoalsHierarchyNav";
import { GoalsInfoTooltip } from "@/components/goals/GoalsInfoTooltip";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import {
  averageProgress,
  countGoalStates,
  formatWeekWindow,
  getGoalStateMeta,
  getMonthShortName,
  getProgressTone,
  listWeeksForYearThroughWeek,
} from "@/lib/goalsView";

const STATUS_GUIDE_DETAIL = [
  "Completed: weekly goals already finished.",
  "In Progress: goals started and still moving without being overdue.",
  "At Risk: goals overdue or already marked missed.",
  "Not Started: goals with no progress yet.",
].join(" ");

function formatHeaderDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WeeklyGoalsPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const {
    ready,
    loading,
    error,
    currentMonth,
    currentWeekNumber,
    weeklyGoals,
  } = useGoalsHierarchy(year);

  const liveYear = new Date().getFullYear();
  const maxSavedWeek = weeklyGoals.reduce((max, goal) => Math.max(max, goal.weekNumber), 0);
  const throughWeek = year === liveYear ? currentWeekNumber : Math.max(currentWeekNumber, maxSavedWeek);
  const weekSlots = useMemo(() => listWeeksForYearThroughWeek(year, throughWeek), [year, throughWeek]);

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
        eyebrow={`${year} weekly goals`}
        title="Loading the weekly goals layer"
        detail="We are pulling every week from the start of the year through the current point so the table reflects the real weekly progression of the system."
      />
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const rows = weekSlots.map((slot) => {
    const goals = weeklyGoals.filter((goal) => goal.weekNumber === slot.weekNumber);
    const stateCounts = countGoalStates(goals, todayIso);
    return {
      ...slot,
      goalsSet: goals.length,
      completed: stateCounts.completed,
      inProgress: stateCounts["on-track"],
      atRisk: stateCounts["at-risk"],
      notStarted: stateCounts["not-started"],
      progress: averageProgress(goals),
    };
  });

  const sortedRows = [...rows].sort((a, b) =>
    sortOrder === "desc" ? b.weekNumber - a.weekNumber : a.weekNumber - b.weekNumber,
  );
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(sortedRows.length, currentPage * pageSize);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/goals/${year}/monthly`)}
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60"
                style={{ color: "#8a9e97" }}
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                Monthly goals
              </button>
              <span style={{ color: "#d1d9d5" }}>/</span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#006c4a" }}>
                Weekly goals
              </span>
            </div>

            <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "30px", color: "#1a1f1e" }}>
              All Weekly Goals
            </h1>
            <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
              A snapshot of weekly execution across the year.
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
          active="weekly"
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
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <label
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
            >
              <span>Sort</span>
              <select
                value={sortOrder}
                onChange={(event) => {
                  setSortOrder(event.target.value as "desc" | "asc");
                  setPage(1);
                }}
                className="bg-transparent text-sm font-semibold outline-none"
                style={{ color: "#1a1f1e" }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>

            <div
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
            >
              <span>Status guide</span>
              <GoalsInfoTooltip label="Weekly goal statuses" detail={STATUS_GUIDE_DETAIL} />
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[22px]" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          <table className="min-w-full">
            <thead>
              <tr className="text-left" style={{ background: "#fbfcfb" }}>
                {["Week", "Goals Set", "Completed", "In Progress", "At Risk", "Not Started", "Progress"].map((label) => (
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
              {paginatedRows.map((row) => {
                const progressTone = getProgressTone(row.progress);
                const current = row.weekNumber === currentWeekNumber && year === liveYear;
                return (
                  <tr
                    key={row.weekNumber}
                    style={{
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                      background: current ? "rgba(0,108,74,0.03)" : "transparent",
                    }}
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold" style={{ color: current ? "#006c4a" : "#1a1f1e" }}>
                        Week {row.weekNumber}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#8a9e97" }}>
                        {getMonthShortName(row.month)} · {formatWeekWindow(new Date(`${row.start}T00:00:00Z`), new Date(`${row.end}T00:00:00Z`))}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                      {row.goalsSet}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("completed").text }}>
                      {row.completed}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("on-track").text }}>
                      {row.inProgress}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("at-risk").text }}>
                      {row.atRisk}
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: getGoalStateMeta("not-started").text }}>
                      {row.notStarted}
                    </td>
                    <td className="px-4 py-4 min-w-[180px]">
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
            Showing {startRow} to {endRow} of {sortedRows.length} weeks
          </p>
          {totalPages > 1 ? (
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
