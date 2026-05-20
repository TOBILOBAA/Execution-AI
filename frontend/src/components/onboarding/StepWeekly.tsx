"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { WeeklyGoal } from "@/lib/types";
import { getCurrentMonth, getCurrentYear, getToday } from "@/lib/mockData";
import { getWeekNumber } from "@/lib/goalsView";
import { WEEKLY_MAIN_GOAL_CAP, WEEKLY_SECONDARY_GOAL_CAP } from "@/lib/planningConstraints";
import { AddWeeklyGoalModal } from "./AddWeeklyGoalModal";
import { AddHabitModal } from "./AddHabitModal";
import { isAuthLocalOnly, isCloudSupabaseConfigured } from "@/lib/authMode";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

// ─── Main Goal Card ────────────────────────────────────────────────────────────
function MainGoalCard({
  goal,
  supportTitle,
  onEdit,
  onDelete,
}: {
  goal: WeeklyGoal;
  supportTitle?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl cursor-pointer"
      style={{
        border: hovered ? "1.5px solid rgba(0,108,74,0.4)" : "1.5px dashed rgba(0,0,0,0.1)",
        boxShadow: hovered ? "0 6px 24px rgba(0,108,74,0.10)" : "0 1px 4px rgba(0,0,0,0.05)",
        transition: "border 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      <div className="px-5 pt-5 pb-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {goal.aiSuggested && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(0,108,74,0.1)", color: "#006c4a" }}
              >
                <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                AI Suggested Priority
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
              style={{ color: "#c4d0cb" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f4f2"; e.currentTarget.style.color = "#6b7b74"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c4d0cb"; }}
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
              style={{ color: "#c4d0cb" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#fff0f0"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c4d0cb"; }}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>

        {/* Title */}
        <h3
          className="font-headline text-xl font-extrabold leading-snug mb-2"
          style={{ color: "#1a1f1e" }}
        >
          {goal.title}
        </h3>

        {goal.description ? (
          <p className="text-sm leading-relaxed mb-3 line-clamp-4" style={{ color: "#5a6b65" }}>
            {goal.description}
          </p>
        ) : null}

        {(goal.workload || goal.targetDay) && (
          <div className="flex flex-wrap gap-3 mb-3">
            {goal.workload && (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[14px] flex-shrink-0" style={{ color: "#b0bcb8" }}>hourglass_empty</span>
                <span className="text-xs" style={{ color: "#6b7b74" }}>
                  Effort: <strong style={{ color: "#3d4f49" }}>{goal.workload}</strong>
                </span>
              </div>
            )}
            {goal.targetDay && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]" style={{ color: "#b0bcb8" }}>calendar_today</span>
                <span className="text-xs" style={{ color: "#6b7b74" }}>
                  Target: <strong style={{ color: "#3d4f49" }}>{DAY_FULL[goal.targetDay] ?? goal.targetDay}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]" style={{ color: "#a8b5af" }}>
              link
            </span>
            <span className="text-xs" style={{ color: "#8a9e97" }}>
              Supports: Monthly Goal:{" "}
              <span className="font-bold" style={{ color: "#1a1f1e" }}>
                {supportTitle ?? "—"}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Secondary Goal Card ───────────────────────────────────────────────────────
const DAY_FULL: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function SecondaryGoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: WeeklyGoal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl p-4 flex flex-col group cursor-pointer"
      style={{
        border: hovered ? "1.5px solid rgba(0,108,74,0.4)" : "1.5px dashed rgba(0,0,0,0.1)",
        boxShadow: hovered ? "0 6px 24px rgba(0,108,74,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "border 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      {/* Top: badge + delete */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            background: goal.aiSuggested ? "#ecf7f2" : "#f4f6f4",
            color: goal.aiSuggested ? "#006c4a" : "#8a9e97",
          }}
        >
          {goal.aiSuggested ? "AI Suggested" : "Secondary Goal"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all"
          style={{ color: "#c8d5d0" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#c8d5d0"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span className="material-symbols-outlined text-[13px]">delete</span>
        </button>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold flex-1 leading-snug mb-1.5" style={{ color: "#1a1f1e" }}>
        {goal.title}
      </p>

      {goal.description ? (
        <p className="text-xs leading-relaxed line-clamp-3 mb-2" style={{ color: "#6b7b74" }}>{goal.description}</p>
      ) : null}

      {goal.workload && (
        <div className="flex items-center gap-1 mb-2 min-w-0">
          <span className="material-symbols-outlined text-[12px] flex-shrink-0" style={{ color: "#a8b5af" }}>hourglass_empty</span>
          <span className="text-[11px] font-medium truncate" style={{ color: "#5a6b65" }}>{goal.workload}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-auto">
        <span className="material-symbols-outlined text-[12px]" style={{ color: "#c4d0cb" }}>
          {goal.targetDay ? "calendar_today" : "event"}
        </span>
        <span className="text-xs" style={{ color: "#b0bcb8" }}>
          {goal.targetDay ? (DAY_FULL[goal.targetDay] ?? goal.targetDay) : "Pick target day"}
        </span>
      </div>
    </div>
  );
}

// ─── Habit Row ────────────────────────────────────────────────────────────────
function HabitRow({
  habit,
  onEdit,
  onDelete,
}: {
  habit: { id: string; name: string; icon: string; frequency: string; categoryId?: string };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const freqLabel = {
    daily: "Daily",
    weekdays: "Weekdays",
    "3x_week": "3× / Week",
    "5x_week": "5× / Week",
    weekends: "Weekends",
  }[habit.frequency] ?? habit.frequency;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl cursor-pointer"
      style={{
        border: hovered ? "1.5px solid rgba(0,108,74,0.4)" : "1.5px dashed rgba(0,0,0,0.1)",
        boxShadow: hovered ? "0 4px 16px rgba(0,108,74,0.09)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "border 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(0,108,74,0.08)" }}
      >
        <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>
          {habit.icon}
        </span>
      </div>

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold leading-none" style={{ color: "#1a1f1e" }}>
            {habit.name}
          </p>
          <span
            className="material-symbols-outlined text-[12px] transition-opacity"
            style={{ color: "#a8b5af", opacity: hovered ? 1 : 0 }}
          >
            edit
          </span>
        </div>
      </div>

      {/* Frequency badge */}
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
        style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
      >
        {freqLabel}
      </span>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
        style={{ color: "#c8d5d0" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fff0f0"; e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c8d5d0"; }}
      >
        <span className="material-symbols-outlined text-[15px]">delete</span>
      </button>
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  action,
  onAction,
  actionIcon,
}: {
  title: string;
  action: string;
  onAction: () => void;
  actionIcon: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-5 rounded-full" style={{ background: "#006c4a" }} />
        <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#1a1f1e" }}>
          {title}
        </h2>
      </div>
      <button
        onClick={onAction}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors"
        style={{ color: "#006c4a" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <span className="material-symbols-outlined text-[16px]">{actionIcon}</span>
        {action}
      </button>
    </div>
  );
}

// ─── AI Draft types ────────────────────────────────────────────────────────────
interface WeeklyAIDraft {
  reasoning: string;
  main_goals: { title: string; description?: string; estimated_effort?: string }[];
  secondary_goals: { title: string; description?: string; estimated_effort?: string }[];
}

// ─── Main Step ────────────────────────────────────────────────────────────────
export function StepWeekly({ onNext, onBack }: Props) {
  const {
    weeklyGoals,
    addWeeklyGoal,
    updateWeeklyGoal,
    removeWeeklyGoal,
    monthlyGoals,
    habits,
    categories,
    addHabit,
    updateHabit,
    removeHabit,
    generateWeeklyPlan,
    approveWeeklyPlan,
    syncWeeklyGoalsToServer,
    sessionTimezone,
    sessionWeekStartsOn,
  } = useAppStore(
    useShallow((state) => ({
      weeklyGoals: state.weeklyGoals,
      addWeeklyGoal: state.addWeeklyGoal,
      updateWeeklyGoal: state.updateWeeklyGoal,
      removeWeeklyGoal: state.removeWeeklyGoal,
      monthlyGoals: state.monthlyGoals,
      habits: state.habits,
      categories: state.categories,
      addHabit: state.addHabit,
      updateHabit: state.updateHabit,
      removeHabit: state.removeHabit,
      generateWeeklyPlan: state.generateWeeklyPlan,
      approveWeeklyPlan: state.approveWeeklyPlan,
      syncWeeklyGoalsToServer: state.syncWeeklyGoalsToServer,
      sessionTimezone: state.sessionTimezone,
      sessionWeekStartsOn: state.sessionWeekStartsOn,
    })),
  );

  const today = getToday(sessionTimezone);
  const currentYear = Number(today.slice(0, 4)) || getCurrentYear();
  const currentMonth = Number(today.slice(5, 7)) || getCurrentMonth();
  const todayReference = new Date(`${today}T12:00:00`);
  const currentWeek = Number.isNaN(todayReference.getTime())
    ? getWeekNumber(new Date(), sessionWeekStartsOn)
    : getWeekNumber(todayReference, sessionWeekStartsOn);

  const currentWeekGoals = weeklyGoals.filter(
    (g) => g.weekNumber === currentWeek && g.year === currentYear
  );
  const mainGoals = currentWeekGoals.filter((g) => g.isMain);
  const secondaryGoals = currentWeekGoals.filter((g) => !g.isMain);

  const currentMonthlyGoals = monthlyGoals.filter(
    (g) => g.month === currentMonth && g.year === currentYear
  );

  // Modal state
  const [addMainOpen, setAddMainOpen] = useState(false);
  const [addSecOpen, setAddSecOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<WeeklyGoal | null>(null);
  const [addHabitOpen, setAddHabitOpen] = useState(false);
  const [editHabitId, setEditHabitId] = useState<string | null>(null);

  // AI generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<WeeklyAIDraft | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAccepting, setAiAccepting] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [aiRowKeys, setAiRowKeys] = useState<Set<string>>(() => new Set());

  const buildAiRowKeys = (draft: WeeklyAIDraft) => {
    const next = new Set<string>();
    draft.main_goals?.forEach((_, i) => next.add(`m:${i}`));
    draft.secondary_goals?.forEach((_, i) => next.add(`s:${i}`));
    return next;
  };

  const aiSelectedCount = useMemo(() => {
    if (!aiDraft) return 0;
    let n = 0;
    aiDraft.main_goals?.forEach((_, i) => {
      if (aiRowKeys.has(`m:${i}`)) n += 1;
    });
    aiDraft.secondary_goals?.forEach((_, i) => {
      if (aiRowKeys.has(`s:${i}`)) n += 1;
    });
    return n;
  }, [aiDraft, aiRowKeys]);

  const toggleAiRow = (key: string) => {
    setAiRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const editHabitData = habits.find((h) => h.id === editHabitId);

  const getMonthlyTitle = (id?: string) =>
    currentMonthlyGoals.find((g) => g.id === id)?.title;

  const handleAIGenerate = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiDraft(null);
    const result = await generateWeeklyPlan(currentYear, currentWeek);
    if (!result.ok) {
      const banner = useAppStore.getState().syncError;
      const apiDetail =
        result.code === "api_error" &&
        banner &&
        banner.includes("Weekly plan (AI generate)")
          ? banner
          : null;
      const msg =
        result.code === "no_monthly_on_server"
          ? "Save monthly goals for this week’s month on the board first (or use AI on the monthly step and accept), click Next so they save, then try again."
          : result.code === "monthly_sync_failed"
            ? "Monthly goals are still syncing. Fix any sync banner above, then try again."
            : result.code === "invalid_week"
              ? "This week isn’t available for AI planning yet."
              : result.code === "no_session"
                ? "Sign in or refresh your session, then try again."
                : apiDetail ??
                  "AI generation failed. Add monthly goals (or use AI on the previous step and accept), click Next so they save, then try again.";
      setAiError(msg);
    } else {
      const draft = result.draft as WeeklyAIDraft;
      setAiDraft(draft);
      setAiRowKeys(buildAiRowKeys(draft));
    }
    setAiLoading(false);
  };

  const handleAIAccept = async () => {
    if (!aiDraft || aiSelectedCount === 0) return;
    const goals: Record<string, unknown>[] = [];
    aiDraft.main_goals?.forEach((g, i) => {
      if (aiRowKeys.has(`m:${i}`)) goals.push({ ...g, is_main: true });
    });
    aiDraft.secondary_goals?.forEach((g, i) => {
      if (aiRowKeys.has(`s:${i}`)) goals.push({ ...g, is_main: false });
    });
    setAiAccepting(true);
    const ok = await approveWeeklyPlan(currentYear, currentWeek, goals);
    if (ok) {
      setAiDraft(null);
      setAiRowKeys(new Set());
    }
    setAiAccepting(false);
  };

  const handleLeaveWeekly = async () => {
    setLeaveError(null);
    const mainGoalsCount = weeklyGoals.filter(g => g.year === currentYear && g.weekNumber === currentWeek && g.isMain).length;
    const secondaryGoalsCount = weeklyGoals.filter(g => g.year === currentYear && g.weekNumber === currentWeek && !g.isMain).length;
    if (mainGoalsCount !== 1) {
      setLeaveError("You need exactly one main goal for the week before continuing.");
      return;
    }
    if (secondaryGoalsCount > WEEKLY_SECONDARY_GOAL_CAP) {
      setLeaveError("You can have at most two secondary goals for the week.");
      return;
    }
    const ok = await syncWeeklyGoalsToServer(currentYear, currentWeek, { mode: "verify" });
    const serverPersistenceRequired = isCloudSupabaseConfigured() && !isAuthLocalOnly();
    if (serverPersistenceRequired && (!ok || useAppStore.getState().syncError)) {
      setLeaveError("Weekly goals have not finished saving to the server yet. Fix the sync error above, then try again.");
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Heading */}
      <div className="text-center space-y-2">
        <h1
          className="font-headline text-4xl font-extrabold tracking-tight"
          style={{ color: "#1a1f1e" }}
        >
          Plan week {currentWeek}.
        </h1>
        <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "#8a9e97" }}>
          1 main goal, up to 2 secondary goals. Each connects to a monthly goal.
        </p>
      </div>

      {/* ── AI Generate Banner ── */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(0,108,74,0.05)", border: "1.5px dashed rgba(0,108,74,0.25)" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,108,74,0.1)" }}>
              <span className="material-symbols-outlined text-[16px]" style={{ color: "#006c4a" }}>auto_awesome</span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>Generate with AI</p>
              <p className="text-xs" style={{ color: "#6b7b74" }}>
                We&apos;ll use your monthly goals — and a summary of your year — to suggest a focused week.
              </p>
            </div>
          </div>
          <button
            onClick={handleAIGenerate}
            disabled={aiLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 flex-shrink-0"
            style={{ background: aiLoading ? "#8ab5a0" : "#006c4a", cursor: aiLoading ? "not-allowed" : "pointer" }}
          >
            {aiLoading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Drafting your week…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[15px]">bolt</span>
                Generate with AI
              </>
            )}
          </button>
        </div>
        {aiError && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 flex-shrink-0" style={{ color: "#ef4444" }}>error</span>
            <p className="text-xs" style={{ color: "#ef4444" }}>{aiError}</p>
          </div>
        )}
      </div>

      {/* ── AI Draft Preview ── */}
      {aiDraft && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1.5px solid rgba(0,108,74,0.2)", background: "#f9fdfb" }}>
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: "rgba(0,108,74,0.07)", borderBottom: "1px solid rgba(0,108,74,0.12)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]" style={{ color: "#006c4a" }}>auto_awesome</span>
              <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>AI Suggestions Ready</p>
            </div>
            <button onClick={() => setAiDraft(null)} className="text-[#a8b5af] hover:text-[#6b7b74]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div className="p-5 space-y-4">
            {aiDraft.reasoning && (
              <p className="text-xs italic leading-relaxed" style={{ color: "#6b7b74" }}>{aiDraft.reasoning}</p>
            )}
            <p className="text-[11px] leading-relaxed" style={{ color: "#6b7b74" }}>
              Tap the circle on each row to include or exclude it before saving.
            </p>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Main Goals</p>
              <div className="space-y-1.5">
                {aiDraft.main_goals?.map((g, i) => {
                  const key = `m:${i}`;
                  const on = aiRowKeys.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleAiRow(key)}
                      className="flex w-full items-start gap-2 px-3 py-2 rounded-lg text-left transition-[border,box-shadow]"
                      style={{
                        background: "white",
                        border: on ? "1.5px solid rgba(0,108,74,0.35)" : "1px solid #e8f0ec",
                        boxShadow: on ? "0 2px 8px rgba(0,108,74,0.08)" : "none",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0"
                        style={{ color: on ? "#006c4a" : "#c4d0cb" }}
                        aria-hidden
                      >
                        {on ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>{g.title}</p>
                        {g.description && <p className="text-[11px]" style={{ color: "#8a9e97" }}>{g.description}</p>}
                        {g.estimated_effort && (
                          <p className="text-[10px] mt-0.5" style={{ color: "#5a6b65" }}>Effort: {g.estimated_effort}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Secondary Goals</p>
              <div className="space-y-1.5">
                {aiDraft.secondary_goals?.map((g, i) => {
                  const key = `s:${i}`;
                  const on = aiRowKeys.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleAiRow(key)}
                      className="flex w-full items-start gap-2 px-3 py-2 rounded-lg text-left transition-[border,box-shadow]"
                      style={{
                        background: "white",
                        border: on ? "1.5px solid rgba(0,108,74,0.35)" : "1px solid #e8f0ec",
                        boxShadow: on ? "0 2px 8px rgba(0,108,74,0.08)" : "none",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0"
                        style={{ color: on ? "#006c4a" : "#c4d0cb" }}
                        aria-hidden
                      >
                        {on ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>{g.title}</p>
                        {g.description && <p className="text-[11px]" style={{ color: "#8a9e97" }}>{g.description}</p>}
                        {g.estimated_effort && (
                          <p className="text-[10px] mt-0.5" style={{ color: "#5a6b65" }}>Effort: {g.estimated_effort}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleAIAccept}
              disabled={aiAccepting || aiSelectedCount === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: aiAccepting || aiSelectedCount === 0 ? "#8ab5a0" : "#006c4a", cursor: aiAccepting || aiSelectedCount === 0 ? "not-allowed" : "pointer" }}
            >
              {aiAccepting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Save selected ({aiSelectedCount})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN WEEKLY GOALS ── */}
      <section>
        <SectionHeader
          title="Main Weekly Goals"
          action="Add Goal"
          actionIcon="add_circle"
          onAction={() => { setEditGoal(null); setAddMainOpen(true); }}
        />
        <div className="space-y-3">
          {mainGoals.map((goal) => (
            <MainGoalCard
              key={goal.id}
              goal={goal}
              supportTitle={getMonthlyTitle(goal.monthlyGoalId)}
              onEdit={() => { setEditGoal(goal); setAddMainOpen(true); }}
              onDelete={async () => { await removeWeeklyGoal(goal.id, { persistMode: "blocking" }); }}
            />
          ))}
          {mainGoals.length === 0 && (
            <button
              onClick={() => { setEditGoal(null); setAddMainOpen(true); }}
              className="w-full flex items-center justify-center gap-2 py-6 rounded-2xl text-sm font-semibold transition-all"
              style={{
                border: "1.5px dashed rgba(0,108,74,0.25)",
                color: "#8a9e97",
                background: "rgba(0,108,74,0.02)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = "1.5px solid rgba(0,108,74,0.35)";
                e.currentTarget.style.color = "#006c4a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "1.5px dashed rgba(0,108,74,0.25)";
                e.currentTarget.style.color = "#8a9e97";
              }}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add your main weekly goal
            </button>
          )}
        </div>
      </section>

      {/* ── SECONDARY WEEKLY GOALS ── */}
      <section>
        <SectionHeader
          title="Secondary Weekly Goals"
          action="Add Goal"
          actionIcon="add"
          onAction={() => { setEditGoal(null); setAddSecOpen(true); }}
        />
        <div className="grid grid-cols-2 gap-3">
          {secondaryGoals.map((goal) => (
            <SecondaryGoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => { setEditGoal(goal); setAddSecOpen(true); }}
              onDelete={async () => { await removeWeeklyGoal(goal.id, { persistMode: "blocking" }); }}
            />
          ))}
          {secondaryGoals.length === 0 && (
            <button
              onClick={() => { setEditGoal(null); setAddSecOpen(true); }}
              className="col-span-2 flex items-center justify-center gap-2 py-6 rounded-2xl text-sm font-semibold transition-all"
              style={{
                border: "1.5px dashed rgba(0,108,74,0.25)",
                color: "#8a9e97",
                background: "rgba(0,108,74,0.02)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = "1.5px solid rgba(0,108,74,0.35)";
                e.currentTarget.style.color = "#006c4a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "1.5px dashed rgba(0,108,74,0.25)";
                e.currentTarget.style.color = "#8a9e97";
              }}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Add secondary goals
            </button>
          )}
          {secondaryGoals.length === 1 && (
            <button
              onClick={() => { setEditGoal(null); setAddSecOpen(true); }}
              className="flex items-center justify-center gap-2 py-5 rounded-2xl text-sm font-semibold transition-all"
              style={{
                border: "1.5px dashed rgba(0,108,74,0.2)",
                color: "#a8b5af",
                background: "rgba(0,108,74,0.01)",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          )}
        </div>
      </section>

      {/* ── FOUNDATIONAL HABITS ── */}
      <section>
        <SectionHeader
          title="Routines"
          action="Define Routine"
          actionIcon="add_circle"
          onAction={() => { setEditHabitId(null); setAddHabitOpen(true); }}
        />
        <div className="space-y-2.5">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onEdit={() => setEditHabitId(habit.id)}
              onDelete={async () => { await removeHabit(habit.id, { persistMode: "blocking" }); }}
            />
          ))}
          {habits.length === 0 && (
            <button
              onClick={() => setAddHabitOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-5 rounded-xl text-sm font-semibold transition-all"
              style={{
                border: "1.5px dashed rgba(0,108,74,0.25)",
                color: "#8a9e97",
              }}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Define your first routine
            </button>
          )}
        </div>
      </section>

      {/* ── Navigation ── */}
      {leaveError && (
        <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <p className="text-xs leading-relaxed" style={{ color: "#991b1b" }}>{leaveError}</p>
        </div>
      )}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#6b7b74" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f7f6")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </button>
        <button
          type="button"
          onClick={() => void handleLeaveWeekly()}
          className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
          style={{ background: "#006c4a" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#005f41")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#006c4a")}
        >
          Next
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>

      {/* ── Modals ── */}
      {(addMainOpen || (editGoal && editGoal.isMain)) && (
        <AddWeeklyGoalModal
          mode="main"
          monthlyGoals={currentMonthlyGoals}
          currentCount={editGoal ? 0 : mainGoals.length}
          maxCount={WEEKLY_MAIN_GOAL_CAP}
          limitMessage="You can only save 1 main goal for this week."
          initialTitle={editGoal?.title}
          initialMonthlyGoalId={editGoal?.monthlyGoalId}
          initialTargetDay={editGoal?.targetDay}
          initialDescription={editGoal?.description}
          initialWorkload={editGoal?.workload}
          onSubmit={async (data) => {
            if (editGoal) {
              const ok = await updateWeeklyGoal(editGoal.id, data, { persistMode: "blocking" });
              if (!ok) return;
            } else {
              const ok = await addWeeklyGoal({
                ...data,
                isMain: true,
                weekNumber: currentWeek,
                month: currentMonth,
                year: currentYear,
                status: "active",
                progress: 0,
                aiSuggested: false,
              }, { persistMode: "blocking" });
              if (!ok) return;
            }
            setAddMainOpen(false);
            setEditGoal(null);
          }}
          onClose={() => { setAddMainOpen(false); setEditGoal(null); }}
        />
      )}

      {(addSecOpen || (editGoal && !editGoal.isMain)) && (
        <AddWeeklyGoalModal
          mode="secondary"
          monthlyGoals={currentMonthlyGoals}
          currentCount={editGoal ? 0 : secondaryGoals.length}
          maxCount={WEEKLY_SECONDARY_GOAL_CAP}
          limitMessage="You can only save up to 2 secondary goals for this week."
          initialTitle={editGoal?.title}
          initialMonthlyGoalId={editGoal?.monthlyGoalId}
          initialTargetDay={editGoal?.targetDay}
          initialDescription={editGoal?.description}
          initialWorkload={editGoal?.workload}
          onSubmit={async (data) => {
            if (editGoal) {
              const ok = await updateWeeklyGoal(editGoal.id, data, { persistMode: "blocking" });
              if (!ok) return;
            } else {
              const ok = await addWeeklyGoal({
                ...data,
                isMain: false,
                weekNumber: currentWeek,
                month: currentMonth,
                year: currentYear,
                status: "active",
                progress: 0,
                aiSuggested: false,
              }, { persistMode: "blocking" });
              if (!ok) return;
            }
            setAddSecOpen(false);
            setEditGoal(null);
          }}
          onClose={() => { setAddSecOpen(false); setEditGoal(null); }}
        />
      )}

      {(addHabitOpen || editHabitId) && (
        <AddHabitModal
          categories={categories}
          initialName={editHabitData?.name}
          initialIcon={editHabitData?.icon}
          initialCategoryId={editHabitData?.categoryId}
          initialFrequency={editHabitData?.frequency}
          initialYearlyGoalId={editHabitData?.yearlyGoalId}
          initialMonthlyGoalId={editHabitData?.monthlyGoalId}
          initialWeeklyGoalId={editHabitData?.weeklyGoalId}
          onSubmit={async ({ name, icon, categoryId, frequency, yearlyGoalId, monthlyGoalId, weeklyGoalId }) => {
            if (editHabitId) {
              const ok = await updateHabit(
                editHabitId,
                { name, icon, categoryId, frequency, yearlyGoalId, monthlyGoalId, weeklyGoalId },
                { persistMode: "blocking" },
              );
              if (!ok) return;
            } else {
              const ok = await addHabit(
                { name, icon, categoryId, frequency, yearlyGoalId, monthlyGoalId, weeklyGoalId, active: true, completedToday: false, streak: 0 },
                { persistMode: "blocking" },
              );
              if (!ok) return;
            }
            setAddHabitOpen(false);
            setEditHabitId(null);
          }}
          onClose={() => { setAddHabitOpen(false); setEditHabitId(null); }}
        />
      )}
    </div>
  );
}

// ─── Weekly AI Guidance Panel ─────────────────────────────────────────────────
export function WeeklyAIGuidancePanel() {
  return (
    <div className="px-7 pt-10 pb-8 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#ecf7f2" }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>
            auto_awesome
          </span>
        </div>
        <div>
          <p className="font-headline font-bold text-sm" style={{ color: "#1a1f1e" }}>
            Planning Strategy
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#a8b5af" }}>
            Weekly Focus
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>bolt</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Protect The Main Goal
            </p>
          </div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: "#6b7b74" }}>
            Your weekly main goal should be the clearest advancement on this month&apos;s main goal. Secondary goals should support that priority, not compete with it.
          </p>
          <div className="space-y-2.5">
            {[
              { num: "1", text: "Main goal that moves the month forward." },
              { num: "2", text: "Secondary goals that remove friction or carry useful momentum." },
              { num: "3+", text: "Routines that protect your focus, energy, and follow-through." },
            ].map((item) => (
              <div key={item.num} className="flex items-start gap-2.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(0,108,74,0.1)", color: "#006c4a" }}
                >
                  {item.num}
                </span>
                <p className="text-xs leading-snug" style={{ color: "#4a5c54" }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>trending_up</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Weekly Prioritisation
            </p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
            When the week is overloaded, the monthly main goal usually slips. Keep the main goal obvious so your time and attention know where to go first.
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>stacked_line_chart</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
              Routine Continuity
            </p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
            Let routines carry the pressure that goals shouldn&apos;t. Consistent routines keep the week stable while your goals absorb the harder execution work.
          </p>
        </div>
      </div>
    </div>
  );
}
