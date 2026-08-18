"use client";

import { Fragment, use, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoalCompletionButton } from "@/components/goals/GoalCompletionButton";
import { GoalsHierarchyNav } from "@/components/goals/GoalsHierarchyNav";
import { GoalsInfoTooltip } from "@/components/goals/GoalsInfoTooltip";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import {
  averageProgress,
  classifyGoalState,
  countGoalStates,
  formatWeekWindow,
  getGoalDisplayProgress,
  getGoalDisplayStatusLabel,
  getGoalStateMeta,
  getMonthShortName,
  getProgressTone,
  isGoalComplete,
  listWeeksForYearThroughWeek,
} from "@/lib/goalsView";
import { useAppStore } from "@/lib/store";

const STATUS_GUIDE_DETAIL = [
  "Completed: weekly goals already finished.",
  "In Progress: goals started and still moving without being overdue.",
  "At Risk: goals overdue or already marked missed.",
  "Not Started: goals with no progress yet.",
].join(" ");

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

export default function WeeklyGoalsPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = use(params);
  const year = parseInt(yearStr, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionWeekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const openModal = useAppStore((state) => state.openModal);
  const updateWeeklyGoal = useAppStore((state) => state.updateWeeklyGoal);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const {
    ready,
    hasCachedData,
    error,
    today,
    currentWeekNumber,
    weeklyGoals,
    monthlyGoals,
    yearlyGoals,
  } = useGoalsHierarchy(year);

  const liveYear = Number(today.slice(0, 4));
  const maxSavedWeek = weeklyGoals.reduce((max, goal) => Math.max(max, goal.weekNumber), 0);
  const throughWeek = year === liveYear ? currentWeekNumber : Math.max(currentWeekNumber, maxSavedWeek);
  const weekSlots = useMemo(
    () => listWeeksForYearThroughWeek(year, throughWeek, sessionWeekStartsOn),
    [sessionWeekStartsOn, throughWeek, year],
  );
  const weekQuery = searchParams?.get("week");
  const selectedWeek = weekQuery ? Math.max(1, parseInt(weekQuery, 10) || currentWeekNumber) : null;

  useEffect(() => {
    setPage(1);
  }, [sortOrder]);

  const pageSize = 12;

  useEffect(() => {
    if (selectedWeek === null) return;
    const weekIndex = weekSlots.findIndex((slot) => slot.weekNumber === selectedWeek);
    if (weekIndex === -1) return;
    const orderedIndex = sortOrder === "desc" ? weekSlots.length - 1 - weekIndex : weekIndex;
    setPage(Math.floor(orderedIndex / pageSize) + 1);
  }, [pageSize, selectedWeek, sortOrder, weekSlots]);

  const monthlyGoalById = useMemo(
    () => new Map(monthlyGoals.map((goal) => [goal.id, goal])),
    [monthlyGoals],
  );
  const yearlyGoalById = useMemo(
    () => new Map(yearlyGoals.map((goal) => [goal.id, goal])),
    [yearlyGoals],
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
    return <GoalsLoadingShell title="Loading weekly goals" />;
  }

  const todayIso = today;

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
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(sortedRows.length, currentPage * pageSize);
  const selectedWeekGoals = selectedWeek === null
    ? []
    : weeklyGoals.filter((goal) => goal.weekNumber === selectedWeek);
  const selectedWeekMainGoals = selectedWeekGoals.filter((goal) => goal.isMain);
  const selectedWeekSecondaryGoals = selectedWeekGoals.filter((goal) => !goal.isMain);
  const selectedWeekSlot = selectedWeek === null
    ? null
    : weekSlots.find((slot) => slot.weekNumber === selectedWeek) ?? null;
  const selectedWeekIsCurrent = selectedWeek !== null && selectedWeek === currentWeekNumber && year === liveYear;

  function pushWeek(weekNumber: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("week", String(weekNumber));
    router.push(`/dashboard/goals/${year}/weekly?${params.toString()}`, { scroll: false });
  }

  function renderSelectedWeekDetail() {
    if (selectedWeek === null) return null;

    return (
      <div
        className="rounded-[24px] p-5"
        style={{ background: "#f9fbfa", border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Selected week detail
            </p>
            <h2 className="font-headline font-bold text-2xl mt-2" style={{ color: "#1a1f1e" }}>
              Week {selectedWeek}
            </h2>
            <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: "#6b7c75" }}>
              {selectedWeekSlot
                ? `${formatWeekWindow(new Date(`${selectedWeekSlot.start}T00:00:00Z`), new Date(`${selectedWeekSlot.end}T00:00:00Z`))}.`
                : "See the actual weekly goals saved for this period."} Current-week items can be edited; past weeks stay visible but locked.
            </p>
          </div>

          {selectedWeekIsCurrent ? (
            <button
              type="button"
              onClick={() => openModal("add-weekly-goal", { yearOverride: year, weekOverride: selectedWeek, defaultIsMain: selectedWeekMainGoals.length === 0 })}
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-[0_12px_28px_rgba(0,108,74,0.16)] sm:w-auto"
              style={{ background: "#006c4a", color: "#fff" }}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add weekly goal
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

        {selectedWeekGoals.length === 0 ? (
          <div
            className="mt-5 rounded-2xl p-5 text-sm leading-relaxed"
            style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", color: "#6b7c75" }}
          >
            {selectedWeekIsCurrent
              ? "No weekly goals are saved for this week yet. Add the main and secondary goals you want this week to carry."
              : "No weekly goals were saved for this week."}
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Main goals
                </p>
                <p className="text-xs font-semibold" style={{ color: "#8a9e97" }}>
                  {selectedWeekMainGoals.length} main goal{selectedWeekMainGoals.length === 1 ? "" : "s"}
                </p>
              </div>
              {selectedWeekMainGoals.length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No main weekly goals were saved for this week.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedWeekMainGoals.map((goal) => (
                    (() => {
                      const state = classifyGoalState(goal, today);
                      const stateMeta = getGoalStateMeta(state);
                      const linkedMonthlyGoal = goal.monthlyGoalId ? monthlyGoalById.get(goal.monthlyGoalId) : null;
                      const linkedYearlyGoal =
                        linkedMonthlyGoal?.yearlyGoalId ? yearlyGoalById.get(linkedMonthlyGoal.yearlyGoalId) : null;
                      return (
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
                                  Main focus
                                </span>
                                <span
                                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                                  style={{
                                    background: stateMeta.background,
                                    border: `1px solid ${stateMeta.border}`,
                                    color: stateMeta.text,
                                  }}
                                >
                                  {getGoalDisplayStatusLabel(goal)}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                                  {getGoalDisplayProgress(goal)}% complete
                                </span>
                              </div>
                              <h3 className="font-semibold text-base mt-3" style={{ color: "#1a1f1e" }}>
                                {goal.title}
                              </h3>
                              <p className="text-sm mt-2 leading-relaxed" style={{ color: goal.description ? "#5d6d67" : "#8a9e97" }}>
                                {goal.description || "No description saved yet."}
                              </p>
                              <div className="mt-3 space-y-1">
                                <p className="text-xs font-semibold" style={{ color: linkedMonthlyGoal ? "#1f6f5a" : "#8a9e97" }}>
                                  {linkedMonthlyGoal ? `Linked monthly goal: ${linkedMonthlyGoal.title}` : "Unlinked: no monthly goal connected yet."}
                                </p>
                                {linkedYearlyGoal ? (
                                  <p className="text-xs" style={{ color: "#6b7c75" }}>
                                    Yearly parent: {linkedYearlyGoal.title}
                                  </p>
                                ) : null}
                                {goal.truthReason ? (
                                  <p className="text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
                                    {goal.truthReason}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {goal.editable ? (
                                <>
                                  <GoalCompletionButton
                                    completed={isGoalComplete(goal)}
                                    onClick={() =>
                                      updateWeeklyGoal(goal.id, {
                                        status: isGoalComplete(goal) ? "active" : "completed",
                                        progress: isGoalComplete(goal) ? Math.min(getGoalDisplayProgress(goal), 99) : 100,
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => openModal("edit-weekly-goal", goal)}
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
                      );
                    })()
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
                  {selectedWeekSecondaryGoals.length} secondary goal{selectedWeekSecondaryGoals.length === 1 ? "" : "s"}
                </p>
              </div>
              {selectedWeekSecondaryGoals.length === 0 ? (
                <p className="text-sm" style={{ color: "#8a9e97" }}>
                  No secondary weekly goals were saved for this week.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedWeekSecondaryGoals.map((goal) => (
                    (() => {
                      const state = classifyGoalState(goal, today);
                      const stateMeta = getGoalStateMeta(state);
                      const linkedMonthlyGoal = goal.monthlyGoalId ? monthlyGoalById.get(goal.monthlyGoalId) : null;
                      return (
                        <div
                          key={goal.id}
                          className="rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
                          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                                {goal.title}
                              </p>
                              <span
                                className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                                style={{
                                  background: stateMeta.background,
                                  border: `1px solid ${stateMeta.border}`,
                                  color: stateMeta.text,
                                }}
                              >
                                {getGoalDisplayStatusLabel(goal)}
                              </span>
                            </div>
                            <p className="text-xs mt-1" style={{ color: "#6b7c75" }}>
                              {linkedMonthlyGoal ? `Linked monthly goal: ${linkedMonthlyGoal.title}` : "Unlinked: no monthly goal connected yet."}
                            </p>
                            {goal.truthReason ? (
                              <p className="text-xs mt-2 leading-relaxed" style={{ color: "#6b7c75" }}>
                                {goal.truthReason}
                              </p>
                            ) : null}
                            <p className="text-xs mt-2" style={{ color: "#6b7c75" }}>
                              {getGoalDisplayProgress(goal)}% complete
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {goal.editable ? (
                              <>
                                <GoalCompletionButton
                                  completed={isGoalComplete(goal)}
                                  compact
                                  onClick={() =>
                                    updateWeeklyGoal(goal.id, {
                                      status: isGoalComplete(goal) ? "active" : "completed",
                                      progress: isGoalComplete(goal) ? Math.min(getGoalDisplayProgress(goal), 99) : 100,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => openModal("edit-weekly-goal", goal)}
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
                      );
                    })()
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 md:p-8">
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
            <span>{formatHeaderDate(today)}</span>
          </div>
        </div>

        <GoalsHierarchyNav year={year} active="weekly" />
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
              className="hidden items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium md:inline-flex"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", color: "#4b635b" }}
            >
              <span>Status guide</span>
              <GoalsInfoTooltip label="Weekly goal statuses" detail={STATUS_GUIDE_DETAIL} />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {paginatedRows.map((row) => {
            const progressTone = getProgressTone(row.progress);
            const current = row.weekNumber === currentWeekNumber && year === liveYear;
            const selected = selectedWeek === row.weekNumber;
            return (
              <Fragment key={row.weekNumber}>
                <button
                  type="button"
                  onClick={() => pushWeek(row.weekNumber)}
                  className="w-full rounded-[22px] p-4 text-left"
                  style={{
                    background: current ? "rgba(0,108,74,0.03)" : "#fff",
                    border: current ? "1.5px solid rgba(0,108,74,0.14)" : "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold" style={{ color: current ? "#006c4a" : "#1a1f1e" }}>
                        Week {row.weekNumber}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "#8a9e97" }}>
                        {getMonthShortName(row.month)} · {formatWeekWindow(new Date(`${row.start}T00:00:00Z`), new Date(`${row.end}T00:00:00Z`))}
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
                        Goals
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: "#1a1f1e" }}>
                        {row.goalsSet}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        Completed
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("completed").text }}>
                        {row.completed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        In Progress
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("on-track").text }}>
                        {row.inProgress}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
                        At Risk
                      </p>
                      <p className="mt-1 font-semibold" style={{ color: getGoalStateMeta("at-risk").text }}>
                        {row.atRisk}
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs font-semibold"
                    style={{ borderColor: "rgba(0,0,0,0.06)", color: current ? "#006c4a" : "#6b7c75" }}
                  >
                    <span>{current ? "Open this week to edit goals" : "Tap to review this week"}</span>
                    <span className="material-symbols-outlined text-[16px]">{selected ? "expand_less" : "chevron_right"}</span>
                  </div>
                </button>
                {selected ? renderSelectedWeekDetail() : null}
              </Fragment>
            );
          })}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-[22px] md:block" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
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
                  <Fragment key={row.weekNumber}>
                    <tr
                      onClick={() => pushWeek(row.weekNumber)}
                      className="cursor-pointer transition-colors"
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
                    {selectedWeek === row.weekNumber ? (
                      <tr style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <td colSpan={7} className="px-3 py-4" style={{ background: "#fcfdfc" }}>
                          {renderSelectedWeekDetail()}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 hidden items-center justify-between gap-4 flex-wrap text-sm md:flex" style={{ color: "#6b7c75" }}>
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
