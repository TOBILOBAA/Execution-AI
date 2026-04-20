"use client";

import { useRouter } from "next/navigation";
import { GoalsLoadingShell } from "@/components/goals/GoalsLoadingShell";
import { useGoalsHierarchy } from "@/hooks/useGoalsHierarchy";
import { useAppStore } from "@/lib/store";

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentQuarter(month: number) {
  return Math.ceil(month / 3);
}

export default function GoalsPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const metrics = useAppStore((state) => state.metrics);
  const openModal = useAppStore((state) => state.openModal);
  const {
    ready,
    loading,
    error,
    currentMonth,
    currentWeekNumber,
    yearlyGoals,
    monthlyGoals,
    weeklyGoals,
    selectedWeekDailyPriorities,
  } = useGoalsHierarchy(currentYear);

  const quarter = currentQuarter(currentMonth);
  const completionSignal =
    yearlyGoals.length === 0
      ? null
      : Math.round(yearlyGoals.reduce((sum, goal) => sum + goal.progress, 0) / yearlyGoals.length);

  if (!ready || loading) {
    return (
      <GoalsLoadingShell
        eyebrow="Goals hub"
        title="Loading your execution stack"
        detail="We are checking how the active year, quarter, week, and daily execution layers connect before showing the hub."
      />
    );
  }

  const currentYearlyGoals = yearlyGoals;
  const currentMonthGoals = monthlyGoals.filter((goal) => goal.month === currentMonth);
  const currentWeekGoals = weeklyGoals.filter((goal) => goal.weekNumber === currentWeekNumber);
  const todayPriorities = selectedWeekDailyPriorities.filter((priority) => {
    const today = new Date().toISOString().slice(0, 10);
    return priority.date === today;
  });

  const yearlyMain = currentYearlyGoals.slice(0, 3);
  const currentMonthMain = currentMonthGoals.find((goal) => goal.isMain) ?? currentMonthGoals[0] ?? null;
  const currentWeekMain = currentWeekGoals.find((goal) => goal.isMain) ?? currentWeekGoals[0] ?? null;

  const missingMonthly = currentYearlyGoals.filter(
    (yearlyGoal) => !monthlyGoals.some((monthlyGoal) => monthlyGoal.yearlyGoalId === yearlyGoal.id),
  ).length;
  const missingWeekly = currentMonthGoals.filter(
    (monthlyGoal) => !weeklyGoals.some((weeklyGoal) => weeklyGoal.monthlyGoalId === monthlyGoal.id),
  ).length;
  const unlinkedToday = todayPriorities.filter((priority) => !priority.weeklyGoalId).length;

  const nextAction =
    currentYearlyGoals.length === 0
      ? {
          title: "Define the active year",
          body: "Add the outcomes that actually matter for this year so the rest of the product has something real to support.",
          action: () => openModal("add-yearly-goal"),
          label: "Add yearly goal",
        }
      : missingMonthly > 0
        ? {
            title: "Add monthly planning depth",
            body: `${missingMonthly} yearly goal${missingMonthly === 1 ? "" : "s"} still have no monthly follow-through.`,
            action: () => router.push(`/dashboard/goals/${currentYear}/q/q${quarter}`),
            label: `Open Q${quarter}`,
          }
        : currentWeekGoals.length === 0
          ? {
              title: "Define this week's commitment",
              body: `ISO week ${currentWeekNumber} has no saved sprint yet.`,
              action: () => openModal("add-weekly-goal"),
              label: "Add weekly goal",
            }
          : todayPriorities.length === 0
            ? {
                title: "Translate the sprint into today",
                body: "The weekly plan exists, but today has no saved execution list yet.",
                action: () => router.push("/dashboard"),
                label: "Open dashboard",
              }
            : {
                title: "Keep execution aligned",
                body: "Use the dashboard to make sure today stays linked to the active weekly sprint.",
                action: () => router.push("/dashboard"),
                label: "Review today",
              };

  const priorYears = [...new Set(yearlyGoals.map((goal) => goal.year).filter((year) => year < currentYear))].sort(
    (a, b) => b - a,
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "#8a9e97" }}>
            Goals hub
          </p>
          <h1 className="font-headline font-extrabold tracking-tight mt-2" style={{ fontSize: "32px", color: "#1a1f1e" }}>
            Where am I in the execution stack?
          </h1>
          <p className="text-sm mt-2 max-w-3xl leading-relaxed" style={{ color: "#6b7c75" }}>
            This hub is meant to orient you fast: what the active year is, what quarter matters now, what this week is asking for, and whether today is actually linked to it.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.15)", color: "#8a5b12" }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                  Active year
                </p>
                <h2 className="font-headline font-extrabold mt-2" style={{ fontSize: "56px", lineHeight: 1, color: "#1a1f1e" }}>
                  {currentYear}
                </h2>
                <p className="text-sm mt-3 max-w-xl leading-relaxed" style={{ color: "#6b7c75" }}>
                  The active year card should tell you whether the top of your execution stack is clear or still missing planning depth.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/goals/${currentYear}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
              >
                Open strategy view
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              {[
                {
                  label: "Yearly goals",
                  value: String(currentYearlyGoals.length),
                  helper: completionSignal === null ? "No outcomes yet" : `${completionSignal}% average progress`,
                },
                {
                  label: "Quarter status",
                  value: `Q${quarter}`,
                  helper: currentMonthMain ? currentMonthMain.title : `No main monthly goal in ${MONTH_LONG[currentMonth - 1]}`,
                },
                {
                  label: "Week status",
                  value: `W${currentWeekNumber}`,
                  helper: currentWeekMain ? currentWeekMain.title : "No saved weekly sprint",
                },
                {
                  label: "Today",
                  value: todayPriorities.length > 0 ? String(todayPriorities.length) : "0",
                  helper: todayPriorities.length > 0 ? "Saved priorities" : "Nothing saved yet",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4"
                  style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                    {stat.label}
                  </p>
                  <p className="mt-2 font-headline font-extrabold leading-tight" style={{ fontSize: "28px", color: "#1a1f1e" }}>
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
                    {stat.helper}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl p-4" style={{ background: "rgba(0,108,74,0.04)", border: "1px solid rgba(0,108,74,0.08)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Top yearly goals
                </p>
                {yearlyMain.length === 0 ? (
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: "#6b7c75" }}>
                    No yearly goals saved yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {yearlyMain.map((goal) => (
                      <div key={goal.id} className="rounded-xl px-3 py-2.5" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}>
                        <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>{goal.title}</p>
                        <p className="text-xs mt-1" style={{ color: "#6b7c75" }}>{goal.progress}% complete</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(0,108,74,0.04)", border: "1px solid rgba(0,108,74,0.08)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Current quarter
                </p>
                <p className="text-sm font-semibold mt-3" style={{ color: "#1a1f1e" }}>
                  {currentMonthMain?.title ?? "No main monthly goal yet"}
                </p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: "#6b7c75" }}>
                  {currentMonthGoals.length > 0
                    ? `${currentMonthGoals.length} monthly goal${currentMonthGoals.length === 1 ? "" : "s"} saved for ${MONTH_LONG[currentMonth - 1]}.`
                    : `Nothing saved for ${MONTH_LONG[currentMonth - 1]} yet.`}
                </p>
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(0,108,74,0.04)", border: "1px solid rgba(0,108,74,0.08)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#006c4a" }}>
                  Current week
                </p>
                <p className="text-sm font-semibold mt-3" style={{ color: "#1a1f1e" }}>
                  {currentWeekMain?.title ?? "No weekly sprint saved yet"}
                </p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: "#6b7c75" }}>
                  {currentWeekGoals.length > 0
                    ? `${currentWeekGoals.length} weekly goal${currentWeekGoals.length === 1 ? "" : "s"} saved for ISO week ${currentWeekNumber}.`
                    : `Nothing saved for ISO week ${currentWeekNumber} yet.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div
            className="rounded-[28px] p-6"
            style={{
              background: "linear-gradient(180deg, rgba(17,24,22,1), rgba(12,36,28,1))",
              color: "#fff",
              boxShadow: "0 12px 32px rgba(10,24,18,0.28)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.42)" }}>
              Next best action
            </p>
            <h2 className="font-headline font-bold text-xl mt-3" style={{ color: "#fff" }}>
              {nextAction.title}
            </h2>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.76)" }}>
              {nextAction.body}
            </p>
            <button
              type="button"
              onClick={nextAction.action}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold"
              style={{ background: "#006c4a", color: "#fff" }}
            >
              {nextAction.label}
            </button>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Execution gaps
            </p>
            <div className="mt-4 space-y-3">
              {[
                `${missingMonthly} yearly goal${missingMonthly === 1 ? "" : "s"} without monthly depth`,
                `${missingWeekly} monthly goal${missingWeekly === 1 ? "" : "s"} in the current month without weekly follow-through`,
                `${unlinkedToday} unlinked priorit${unlinkedToday === 1 ? "y" : "ies"} today`,
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-2xl p-4"
                  style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.12)" }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: "#8a5b12" }}>
                    {line}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-[28px] p-6"
            style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Dashboard signal
            </p>
            <div className="mt-4 space-y-3 text-sm" style={{ color: "#5d6d67" }}>
              <p>Execution streak: {metrics.executionStreak} day{metrics.executionStreak === 1 ? "" : "s"}</p>
              <p>Yesterday completion: {metrics.yesterdayCompletion}%</p>
              <p>Weekly consistency average: {metrics.weeklyConsistency.length ? Math.round(metrics.weeklyConsistency.reduce((sum, value) => sum + value, 0) / metrics.weeklyConsistency.length) : 0}%</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-headline font-bold text-lg" style={{ color: "#1a1f1e" }}>
          Other years in your workspace
        </h2>
        {priorYears.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "#8a9e97" }}>
            No other years are stored yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-3">
            {priorYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => router.push(`/dashboard/goals/${year}`)}
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "#fff", border: "1.5px solid rgba(0,0,0,0.08)", color: "#1a1f1e" }}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
