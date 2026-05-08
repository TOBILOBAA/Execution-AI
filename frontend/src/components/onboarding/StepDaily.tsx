"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { DailyPriority, FoundationalHabit, HabitFrequency } from "@/lib/types";
import { getToday } from "@/lib/mockData";
import { AddDailyPriorityModal } from "./AddDailyPriorityModal";
import { AddSecondaryTaskModal } from "./AddSecondaryTaskModal";
import { AddHabitModal } from "./AddHabitModal";
import { isAuthLocalOnly, isCloudSupabaseConfigured } from "@/lib/authMode";

interface Props {
  onFinish: () => void;
  onBack: () => void;
}

// ─── Ordinal number formatter ──────────────────────────────────────────────────
function ordinal(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({
  number,
  title,
  subtitle,
  action,
  onAction,
}: {
  number: string;
  title: string;
  subtitle: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="font-headline text-lg font-extrabold" style={{ color: "#1a1f1e" }}>
          {number}. {title}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "#8a9e97" }}>{subtitle}</p>
      </div>
      <button
        onClick={onAction}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider flex-shrink-0 mt-1 transition-opacity hover:opacity-70"
        style={{ color: "#006c4a" }}
      >
        <span className="material-symbols-outlined text-[15px]">add</span>
        {action}
      </button>
    </div>
  );
}

// ─── Priority Row ──────────────────────────────────────────────────────────────
function PriorityRow({
  priority,
  index,
  isLast,
  onEdit,
  onDelete,
}: {
  priority: DailyPriority;
  index: number;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const mins = priority.estimatedMinutes;
  const timeLabel = mins
    ? mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins} mins`
    : null;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 bg-white cursor-pointer"
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
        background: hovered ? "rgba(0,108,74,0.02)" : "white",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      {/* Number */}
      <span
        className="text-[13px] font-bold tabular-nums flex-shrink-0 w-6"
        style={{ color: "#c4d0cb" }}
      >
        {ordinal(index + 1)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
            {priority.title}
          </p>
          <span
            className="material-symbols-outlined text-[11px] transition-opacity"
            style={{ color: "#a8b5af", opacity: hovered ? 1 : 0 }}
          >
            edit
          </span>
        </div>
        {priority.description && (
          <p className="text-xs leading-relaxed mt-1 line-clamp-2" style={{ color: "#6b7b74" }}>{priority.description}</p>
        )}
        {(timeLabel || priority.tag) && (
          <p className="text-[11px] mt-0.5" style={{ color: "#a8b5af" }}>
            {timeLabel && `Estimated: ${timeLabel}`}
            {timeLabel && priority.tag && " • "}
            {priority.tag}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
        style={{ color: "#c4d0cb", opacity: hovered ? 1 : 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fff0f0"; e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c4d0cb"; }}
      >
        <span className="material-symbols-outlined text-[15px]">delete</span>
      </button>
    </div>
  );
}

// ─── Support Task Row ──────────────────────────────────────────────────────────
function SupportRow({
  task,
  index,
  isLast,
  onEdit,
  onDelete,
}: {
  task: DailyPriority;
  index: number;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 bg-white cursor-pointer"
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
        background: hovered ? "rgba(0,108,74,0.02)" : "white",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      {/* Number */}
      <span
        className="text-[13px] font-bold tabular-nums flex-shrink-0 w-6"
        style={{ color: "#c4d0cb" }}
      >
        {ordinal(index + 1)}
      </span>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium leading-snug" style={{ color: "#1a1f1e" }}>
            {task.title}
          </p>
          <span
            className="material-symbols-outlined text-[11px] transition-opacity"
            style={{ color: "#a8b5af", opacity: hovered ? 1 : 0 }}
          >
            edit
          </span>
        </div>
        {task.description && (
          <p className="text-xs leading-relaxed mt-1 line-clamp-2" style={{ color: "#6b7b74" }}>{task.description}</p>
        )}
        {(task.estimatedMinutes || task.tag) && (
          <p className="text-[11px] mt-0.5" style={{ color: "#a8b5af" }}>
            {task.estimatedMinutes
              ? task.estimatedMinutes >= 60
                ? `Estimated: ${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 ? ` ${task.estimatedMinutes % 60}m` : ""}`
                : `Estimated: ${task.estimatedMinutes} mins`
              : null}
            {task.estimatedMinutes && task.tag && " • "}
            {task.tag}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
        style={{ color: "#c4d0cb", opacity: hovered ? 1 : 0 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fff0f0"; e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#c4d0cb"; }}
      >
        <span className="material-symbols-outlined text-[15px]">delete</span>
      </button>
    </div>
  );
}

// ─── Habit Row ─────────────────────────────────────────────────────────────────
function HabitRow({
  habit,
  onEdit,
  onDelete,
}: {
  habit: FoundationalHabit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const freqLabel: Record<HabitFrequency, string> = {
    daily: "Daily",
    weekdays: "Weekdays",
    "3x_week": "3× / Week",
    "5x_week": "5× / Week",
    weekends: "Weekends",
  };

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
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(0,108,74,0.08)" }}
      >
        <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>
          {habit.icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold leading-none" style={{ color: "#1a1f1e" }}>{habit.name}</p>
          <span
            className="material-symbols-outlined text-[12px] transition-opacity"
            style={{ color: "#a8b5af", opacity: hovered ? 1 : 0 }}
          >
            edit
          </span>
        </div>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
        style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
      >
        {freqLabel[habit.frequency] ?? habit.frequency}
      </span>
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

// ─── AI Draft types ────────────────────────────────────────────────────────────
interface DailyAIDraft {
  reasoning: string;
  top_priorities: { title: string; description?: string; estimated_effort?: string; tag?: string }[];
  secondary_tasks: { title: string; description?: string; estimated_effort?: string; tag?: string }[];
  foundational_habits: string[];
}

// ─── Main Step ─────────────────────────────────────────────────────────────────
export function StepDaily({ onFinish, onBack }: Props) {
  const {
    dailyPriorities,
    addDailyPriority,
    updateDailyPriority,
    removeDailyPriority,
    secondaryTasks,
    addSecondaryTask,
    updateSecondaryTask,
    removeSecondaryTask,
    habits,
    categories,
    weeklyGoals,
    addHabit,
    updateHabit,
    removeHabit,
    generateDailyPlan,
    approveDailyPlan,
    syncDailySetupToServer,
  } = useAppStore(
    useShallow((state) => ({
      dailyPriorities: state.dailyPriorities,
      addDailyPriority: state.addDailyPriority,
      updateDailyPriority: state.updateDailyPriority,
      removeDailyPriority: state.removeDailyPriority,
      secondaryTasks: state.secondaryTasks,
      addSecondaryTask: state.addSecondaryTask,
      updateSecondaryTask: state.updateSecondaryTask,
      removeSecondaryTask: state.removeSecondaryTask,
      habits: state.habits,
      categories: state.categories,
      weeklyGoals: state.weeklyGoals,
      addHabit: state.addHabit,
      updateHabit: state.updateHabit,
      removeHabit: state.removeHabit,
      generateDailyPlan: state.generateDailyPlan,
      approveDailyPlan: state.approveDailyPlan,
      syncDailySetupToServer: state.syncDailySetupToServer,
    })),
  );

  const todayPriorities = dailyPriorities.filter((p) => p.date === getToday());
  const todayTasks = secondaryTasks.filter((t) => t.date === getToday());
  const activeHabits = habits.filter((h) => h.active);

  // Modal state
  const [priorityModal, setPriorityModal] = useState<null | true | DailyPriority>(null);
  const [taskModal, setTaskModal] = useState<null | true | DailyPriority>(null);
  const [habitModal, setHabitModal] = useState<null | true | FoundationalHabit>(null);

  // AI generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<DailyAIDraft | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAccepting, setAiAccepting] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [aiRowKeys, setAiRowKeys] = useState<Set<string>>(() => new Set());

  const buildAiRowKeys = (draft: DailyAIDraft) => {
    const next = new Set<string>();
    draft.top_priorities?.forEach((_, i) => next.add(`p:${i}`));
    (draft.secondary_tasks ?? []).forEach((_, i) => next.add(`t:${i}`));
    return next;
  };

  const aiSelectedCount = useMemo(() => {
    if (!aiDraft) return 0;
    let n = 0;
    aiDraft.top_priorities?.forEach((_, i) => {
      if (aiRowKeys.has(`p:${i}`)) n += 1;
    });
    (aiDraft.secondary_tasks ?? []).forEach((_, i) => {
      if (aiRowKeys.has(`t:${i}`)) n += 1;
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

  const isEditingPriority = priorityModal !== null && typeof priorityModal === "object";
  const isEditingTask = taskModal !== null && typeof taskModal === "object";
  const isEditingHabit = habitModal !== null && typeof habitModal === "object";

  const handleAIGenerate = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiDraft(null);
    const result = await generateDailyPlan(getToday());
    if (!result.ok) {
      const banner = useAppStore.getState().syncError;
      const apiDetail =
        result.code === "api_error" &&
        banner &&
        banner.includes("Daily plan (AI generate)")
          ? banner
          : null;
      const msg =
        result.code === "no_weekly_or_habits"
          ? "Add weekly goals or at least one active habit, commit so they sync, then try again."
          : result.code === "weekly_sync_failed"
            ? "Weekly goals are still syncing. Fix any sync banner above, then try again."
            : result.code === "invalid_date"
              ? "Today’s date isn’t valid for planning."
              : result.code === "no_session"
                ? "Sign in or refresh your session, then try again."
                : apiDetail ??
                  "AI generation failed. Add weekly goals (or use AI on the previous step and accept), click “Commit Plan” so they save, and add at least one habit if you have no weeklies — then try again.";
      setAiError(msg);
    } else {
      const draft = result.draft as DailyAIDraft;
      setAiDraft(draft);
      setAiRowKeys(buildAiRowKeys(draft));
    }
    setAiLoading(false);
  };

  const handleAIAccept = async () => {
    if (!aiDraft || aiSelectedCount === 0) return;
    const priorities: Record<string, unknown>[] = [];
    aiDraft.top_priorities?.forEach((p, i) => {
      if (aiRowKeys.has(`p:${i}`)) priorities.push({ ...p, is_main: true, priority: "high" });
    });
    (aiDraft.secondary_tasks ?? []).forEach((t, i) => {
      if (aiRowKeys.has(`t:${i}`)) priorities.push({ ...t, is_main: false });
    });
    setAiAccepting(true);
    const ok = await approveDailyPlan(getToday(), priorities);
    if (ok) {
      setAiDraft(null);
      setAiRowKeys(new Set());
    }
    setAiAccepting(false);
  };

  const todayStr = getToday();
  const headlineDate = useMemo(() => {
    const d = new Date(`${todayStr}T12:00:00`);
    return {
      weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
      monthShort: d.toLocaleDateString("en-US", { month: "short" }),
      day: d.getDate(),
    };
  }, [todayStr]);

  const handleFinish = async () => {
    setLeaveError(null);
    const todayPrioritiesCount = dailyPriorities.filter(p => p.date === getToday()).length;
    const todayTasksCount = secondaryTasks.filter(t => t.date === getToday()).length;
    if (todayPrioritiesCount !== 1) {
      setLeaveError("You need exactly one main goal for today before continuing.");
      return;
    }
    if (todayTasksCount > 3) {
      setLeaveError("You can have at most three secondary tasks for today.");
      return;
    }
    const ok = await syncDailySetupToServer(getToday());
    const serverPersistenceRequired = isCloudSupabaseConfigured() && !isAuthLocalOnly();
    if (serverPersistenceRequired && (!ok || useAppStore.getState().syncError)) {
      setLeaveError("Daily tasks and habits have not finished saving to the server yet. Fix the sync error above, then try again.");
      return;
    }
    await onFinish();
  };

  return (
    <>
      <div className="space-y-8 animate-slide-up">
        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="font-headline text-4xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            Set up {headlineDate.weekday}, {headlineDate.monthShort} {headlineDate.day}.
          </h1>
          <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#8a9e97" }}>
            1 main goal, up to 3 secondary goals. Each connects to a weekly goal. Your routines roll forward from Step 2.
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
                  We&apos;ll use this week&apos;s goals and your habits to suggest a focused day.
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
                  Drafting your day…
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
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Top Priorities</p>
                <div className="space-y-1.5">
                  {aiDraft.top_priorities?.map((p, i) => {
                    const key = `p:${i}`;
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
                          <p className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>{p.title}</p>
                          {p.description && <p className="text-[11px]" style={{ color: "#8a9e97" }}>{p.description}</p>}
                          {p.estimated_effort && <p className="text-[10px] mt-0.5" style={{ color: "#5a6b65" }}>Time: {p.estimated_effort}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {(aiDraft.secondary_tasks?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Secondary Goals</p>
                  <div className="space-y-1.5">
                    {(aiDraft.secondary_tasks ?? []).map((t, i) => {
                      const key = `t:${i}`;
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
                            <p className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>{t.title}</p>
                            {t.description && <p className="text-[11px]" style={{ color: "#8a9e97" }}>{t.description}</p>}
                            {t.estimated_effort && <p className="text-[10px] mt-0.5" style={{ color: "#5a6b65" }}>Time: {t.estimated_effort}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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

        {/* ── 01. Essential Priorities ── */}
        <section>
          <SectionHeader
            number="01"
            title="Essential Priorities"
            subtitle="The three non-negotiables for a successful day."
            action="Add Main Goal"
            onAction={() => setPriorityModal(true)}
          />
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            {todayPriorities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: "#a8b5af" }}>
                  No priorities yet — add your top 3 for today.
                </p>
              </div>
            ) : (
              todayPriorities.map((p, idx) => (
                <PriorityRow
                  key={p.id}
                  priority={p}
                  index={idx}
                  isLast={idx === todayPriorities.length - 1}
                  onEdit={() => setPriorityModal(p)}
                  onDelete={() => removeDailyPriority(p.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* ── 02. Supporting Priorities ── */}
        <section>
          <SectionHeader
            number="02"
            title="Supporting Priorities"
            subtitle="Supporting tasks to be addressed after primary focus."
            action="Add Task"
            onAction={() => setTaskModal(true)}
          />
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            {todayTasks.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: "#a8b5af" }}>
                  No secondary goals yet.
                </p>
              </div>
            ) : (
              todayTasks.map((t, idx) => (
                <SupportRow
                  key={t.id}
                  task={t}
                  index={idx}
                  isLast={idx === todayTasks.length - 1}
                  onEdit={() => setTaskModal(t)}
                  onDelete={() => removeSecondaryTask(t.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* ── 03. High-Performance Habits ── */}
        <section>
          <SectionHeader
            number="03"
            title="High-Performance Habits"
            subtitle="Micro-actions that fuel your long-term output."
            action="Add Routine"
            onAction={() => setHabitModal(true)}
          />
          <div className="space-y-2.5">
            {activeHabits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                onEdit={() => setHabitModal(habit)}
                onDelete={() => removeHabit(habit.id)}
              />
            ))}
            {activeHabits.length === 0 && (
              <button
                onClick={() => setHabitModal(true)}
                className="w-full flex items-center justify-center gap-2 py-5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  border: "1.5px dashed rgba(0,108,74,0.25)",
                  color: "#8a9e97",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.border = "1.5px solid rgba(0,108,74,0.35)"; e.currentTarget.style.color = "#006c4a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.border = "1.5px dashed rgba(0,108,74,0.25)"; e.currentTarget.style.color = "#8a9e97"; }}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Define your first routine
              </button>
            )}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="text-center space-y-4 pt-2 pb-2">
          <p className="text-sm leading-relaxed" style={{ color: "#8a9e97" }}>
            Ready to begin your day with precision? All goals and<br />routines are synced to your dashboard.
          </p>
        </div>

        {/* Navigation */}
        {leaveError && (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "#991b1b" }}>{leaveError}</p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition"
            style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#f7f9f8")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "white")}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </button>
          <button
            onClick={() => { void handleFinish(); }}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "#006c4a", boxShadow: "0 2px 12px rgba(0,108,74,0.22)" }}
          >
            Begin
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      {priorityModal !== null && (
        <AddDailyPriorityModal
          categories={categories}
          weeklyGoals={weeklyGoals}
          initialTitle={isEditingPriority ? (priorityModal as DailyPriority).title : ""}
          initialCategoryId={
            isEditingPriority
              ? categories.find((c) => c.name === (priorityModal as DailyPriority).tag)?.id
              : undefined
          }
          initialWeeklyGoalId={isEditingPriority ? (priorityModal as DailyPriority).weeklyGoalId : undefined}
          initialAllocation={isEditingPriority ? (priorityModal as DailyPriority).estimatedMinutes : 30}
          initialDescription={isEditingPriority ? (priorityModal as DailyPriority).description : undefined}
          onSubmit={(data) => {
            if (isEditingPriority) {
              updateDailyPriority((priorityModal as DailyPriority).id, {
                title: data.title,
                estimatedMinutes: data.estimatedMinutes,
                tag: data.tag,
                weeklyGoalId: data.weeklyGoalId,
                description: data.description,
              });
            } else {
              addDailyPriority({
                title: data.title,
                estimatedMinutes: data.estimatedMinutes,
                tag: data.tag,
                weeklyGoalId: data.weeklyGoalId,
                ...(data.description ? { description: data.description } : {}),
                date: getToday(),
                status: "active",
                completed: false,
                priority: "high",
                isMain: true,
                aiSuggested: false,
              });
            }
            setPriorityModal(null);
          }}
          onClose={() => setPriorityModal(null)}
        />
      )}

      {taskModal !== null && (
        <AddSecondaryTaskModal
          categories={categories}
          weeklyGoals={weeklyGoals}
          initialTitle={isEditingTask ? (taskModal as DailyPriority).title : ""}
          initialCategoryId={isEditingTask
            ? categories.find((c) => c.name === (taskModal as DailyPriority).tag)?.id
            : undefined}
          initialWeeklyGoalId={isEditingTask ? (taskModal as DailyPriority).weeklyGoalId : undefined}
          initialAllocation={isEditingTask ? (taskModal as DailyPriority).estimatedMinutes : 30}
          initialDescription={isEditingTask ? (taskModal as DailyPriority).description : undefined}
          onSubmit={(data) => {
            if (isEditingTask) {
              updateSecondaryTask((taskModal as DailyPriority).id, {
                title: data.title,
                estimatedMinutes: data.estimatedMinutes,
                tag: data.tag,
                weeklyGoalId: data.weeklyGoalId,
                description: data.description,
              });
            } else {
              addSecondaryTask({
                title: data.title,
                estimatedMinutes: data.estimatedMinutes,
                tag: data.tag,
                weeklyGoalId: data.weeklyGoalId,
                ...(data.description ? { description: data.description } : {}),
                date: getToday(),
                status: "active",
                completed: false,
                priority: "medium",
                isMain: false,
                aiSuggested: false,
              });
            }
            setTaskModal(null);
          }}
          onClose={() => setTaskModal(null)}
        />
      )}

      {habitModal !== null && (
        <AddHabitModal
          categories={categories}
          initialName={isEditingHabit ? (habitModal as FoundationalHabit).name : undefined}
          initialIcon={isEditingHabit ? (habitModal as FoundationalHabit).icon : undefined}
          initialCategoryId={isEditingHabit ? (habitModal as FoundationalHabit).categoryId : undefined}
          initialFrequency={isEditingHabit ? (habitModal as FoundationalHabit).frequency : undefined}
          onSubmit={(name, icon, categoryId, frequency) => {
            if (isEditingHabit) {
              updateHabit((habitModal as FoundationalHabit).id, { name, icon, categoryId, frequency });
            } else {
              addHabit({ name, icon, categoryId, frequency, active: true, completedToday: false, streak: 0 });
            }
            setHabitModal(null);
          }}
          onClose={() => setHabitModal(null)}
        />
      )}
    </>
  );
}

// ─── Daily AI Guidance Panel ───────────────────────────────────────────────────
const GUIDANCE_TIPS = [
  {
    title: "Minimize Context Switching",
    body: "Your goals today require high cognitive load. Batch your secondary goals into a single 30-minute block at 4:00 PM to protect your morning momentum.",
    tip: "Drink 500ml of water during Main Goal 01 to maintain peak neural function.",
    mindset: "Execution is the only form of progress that matters today. Done is better than perfect.",
  },
  {
    title: "Protect Deep Work Time",
    body: "Schedule your highest-energy priority first. Block the first 90 minutes of your day for focused execution before any meetings or communication.",
    tip: "Close all notification channels during your Essential Priorities block for maximum output.",
    mindset: "Clarity precedes action. Know your target before you start moving.",
  },
  {
    title: "Energy Before Tasks",
    body: "Match tasks to your natural energy curve. Do creative and analytical work in the morning, operational tasks in the afternoon.",
    tip: "A 10-minute walk between Priority 02 and 03 resets your focus and reduces decision fatigue.",
    mindset: "Small consistent actions compound into extraordinary results over time.",
  },
];

export function DailyAIGuidancePanel() {
  const [tipIndex, setTipIndex] = useState(0);
  const tip = GUIDANCE_TIPS[tipIndex];

  const handleRefresh = () => {
    setTipIndex((prev) => (prev + 1) % GUIDANCE_TIPS.length);
  };

  return (
    <div className="px-7 pt-10 pb-8 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#ecf7f2" }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>auto_awesome</span>
        </div>
        <div>
          <p className="font-headline font-bold text-sm" style={{ color: "#1a1f1e" }}>AI Guidance</p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#a8b5af" }}>Daily Intelligence</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        {/* Rule of 3 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>Rule of 3 Advice</p>
          </div>
          <p className="text-sm font-bold mb-1.5" style={{ color: "#1a1f1e" }}>{tip.title}</p>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>{tip.body}</p>
        </div>

        {/* Execution Tip */}
        <div
          className="rounded-xl p-3.5"
          style={{ background: "#f5f7f6" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8a9e97" }}>Execution Tip</p>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>{tip.tip}</p>
        </div>

        {/* Mindset */}
        <div
          className="rounded-xl p-3.5"
          style={{ background: "#f5f7f6" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#8a9e97" }}>Mindset</p>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>{tip.mindset}</p>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="w-full py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all"
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            color: "#8a9e97",
            background: "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f5f7f6"; e.currentTarget.style.color = "#1a1f1e"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#8a9e97"; }}
        >
          Refresh Guidance
        </button>
      </div>
    </div>
  );
}
