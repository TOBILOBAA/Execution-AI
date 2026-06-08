"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoalCompletionButton } from "@/components/goals/GoalCompletionButton";
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
import { useAppStore } from "@/lib/store";

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
  const openModal = useAppStore((state) => state.openModal);
  const updateMonthlyGoal = useAppStore((state) => state.updateMonthlyGoal);
  const [page, setPage] = useState(1);

  const {
    ready,
    hasCachedData,
    error,
    today,
    currentMonth,
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

  if (!ready && !hasCachedData) {
    return <GoalsLoadingShell title="Loading monthly goals" />;
  }

  const filteredRows = selectedMonth === "all" ? rows : rows.filter((row) => row.month === selectedMonth);
  const pageSize = selectedMonth === "all" ? 6 : 12;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(filteredRows.length, currentPage * pageSize);
  const selectedMonthGoals = selectedMonth === "all"
    ? []
    : monthlyGoals.filter((goal) => goal.month === selectedMonth);
  const selectedMonthMainGoals = selectedMonthGoals.filter((goal) => goal.isMain);
  const selectedMonthSecondaryGoals = selectedMonthGoals.filter((goal) => !goal.isMain);
  const isSelectedMonthCurrent = selectedMonth !== "all" && year === Number(today.slice(0, 4)) && selectedMonth === currentMonth;

  function pushMonth(month: number | "all") {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("month", String(month));
    router.push(`/dashboard/goals/${year}/monthly?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 md:p-8">
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

        <GoalsHierarchyNav year={year} active="monthly" />
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
              onClick={() => pushMonth("all")}
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
                  onClick={() => pushMonth(month)}
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
            className="hidden items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium md:inline-flex"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
          >
            <span>Status guide</span>
            <GoalsInfoTooltip label="Monthly goal statuses" detail={STATUS_GUIDE_DETAIL} />
          </div>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {paginatedRows.map((row) => {
            const progressTone = getProgressTone(row.progress);
            const current = row.month === currentMonth;
            return (
              <button
                key={row.month}
                type="button"
                onClick={() => pushMonth(row.month)}
                className="w-full rounded-[22px] p-4 text-left"
                style={{
                  background: current ? "rgba(0,108,74,0.03)" : "#fff",
                  border: current ? "1.5px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold" style={{ color: current ? "#006c4a" : "#1a1f1e" }}>
                      {row.label}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "#8a9e97" }}>
                      {row.goalsSet} goal{row.goalsSet === 1 ? "" : "s"} saved
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: "rgba(0,108,74,0.08)", color: progressTone }}
                  >
                    {row.progress}%
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      Completed
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "#0b7a53" }}>
                      {row.completed}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      In Progress
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "#006c4a" }}>
                      {row.inProgress}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      At Risk
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "#b45309" }}>
                      {row.atRisk}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                      Not Started
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "#667781" }}>
                      {row.notStarted}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-[22px] md:block" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
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
                    onClick={() => pushMonth(row.month)}
                    className="cursor-pointer transition-colors"
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

        <div className="mt-5 hidden items-center justify-between gap-4 flex-wrap text-sm md:flex" style={{ color: "#6b7c75" }}>
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

        {selectedMonth !== "all" && (
          <div
            className="mt-6 rounded-[24px] p-5"
            style={{ background: "#f9fbfa", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                  Selected month detail
                </p>
                <h2 className="font-headline font-bold text-2xl mt-2" style={{ color: "#1a1f1e" }}>
                  {GOALS_MONTH_NAMES[selectedMonth - 1]} {year}
                </h2>
                <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: "#6b7c75" }}>
                  See the actual monthly goals saved for this period. Current-month items can be edited; past months stay visible but locked.
                </p>
              </div>

              {isSelectedMonthCurrent ? (
                <button
                  type="button"
                  onClick={() => openModal("add-monthly-goal", { yearOverride: year, monthOverride: selectedMonth })}
                  className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold sm:w-auto"
                  style={{ background: "#006c4a", color: "#fff" }}
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add monthly goal
                </button>
              ) : (
                <span
                  className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold sm:w-auto"
                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#6b7c75" }}
                >
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  Read only
                </span>
              )}
            </div>

            {selectedMonthGoals.length === 0 ? (
              <div
                className="mt-5 rounded-2xl p-5 text-sm leading-relaxed"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", color: "#6b7c75" }}
              >
                {isSelectedMonthCurrent
                  ? "No monthly goals are saved for this month yet. Add the main and secondary goals you want this month to carry."
                  : "No monthly goals were saved for this month."}
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                      Main goals
                    </p>
                    <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                      {selectedMonthMainGoals.length} main goal{selectedMonthMainGoals.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {selectedMonthMainGoals.length === 0 ? (
                    <p className="text-sm" style={{ color: "#8a9e97" }}>
                      No main monthly goals were saved for this month.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedMonthMainGoals.map((goal) => (
                        <div
                          key={goal.id}
                          className="rounded-[22px] p-4"
                          style={{ background: "#fff", border: "1.5px solid rgba(0,108,74,0.12)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                                  style={{ background: "#006c4a", color: "#fff" }}
                                >
                                  Main goal
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                                  {goal.progress}% complete
                                </span>
                              </div>
                              <h3 className="font-semibold text-base mt-3" style={{ color: "#1a1f1e" }}>
                                {goal.title}
                              </h3>
                              <p className="text-sm mt-2 leading-relaxed" style={{ color: goal.description ? "#5d6d67" : "#8a9e97" }}>
                                {goal.description || "No description saved yet."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {goal.editable ? (
                                <>
                                  <GoalCompletionButton
                                    completed={goal.status === "completed" || goal.progress >= 100}
                                    onClick={() =>
                                      updateMonthlyGoal(goal.id, {
                                        status: goal.status === "completed" || goal.progress >= 100 ? "active" : "completed",
                                        progress: goal.status === "completed" || goal.progress >= 100 ? Math.min(goal.progress, 99) : 100,
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => openModal("edit-monthly-goal", goal)}
                                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0"
                                    style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", color: "#4b635b" }}
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                    Edit
                                  </button>
                                </>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", color: "#6b7c75" }}
                                >
                                  <span className="material-symbols-outlined text-[14px]">lock</span>
                                  Locked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                      Secondary goals
                    </p>
                    <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                      {selectedMonthSecondaryGoals.length} secondary goal{selectedMonthSecondaryGoals.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {selectedMonthSecondaryGoals.length === 0 ? (
                    <p className="text-sm" style={{ color: "#8a9e97" }}>
                      No secondary monthly goals were saved for this month.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedMonthSecondaryGoals.map((goal) => (
                        <div
                          key={goal.id}
                          className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                              {goal.title}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "#6b7c75" }}>
                              {goal.progress}% complete
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {goal.editable ? (
                              <>
                                <GoalCompletionButton
                                  completed={goal.status === "completed" || goal.progress >= 100}
                                  compact
                                  onClick={() =>
                                    updateMonthlyGoal(goal.id, {
                                      status: goal.status === "completed" || goal.progress >= 100 ? "active" : "completed",
                                      progress: goal.status === "completed" || goal.progress >= 100 ? Math.min(goal.progress, 99) : 100,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => openModal("edit-monthly-goal", goal)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", color: "#4b635b" }}
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  Edit
                                </button>
                              </>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", color: "#6b7c75" }}
                              >
                                <span className="material-symbols-outlined text-[14px]">lock</span>
                                Locked
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
