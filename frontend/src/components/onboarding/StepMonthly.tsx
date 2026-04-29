"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getCurrentMonth, getCurrentYear, MONTH_NAMES } from "@/lib/mockData";
import { AddMonthlyGoalModal } from "./AddMonthlyGoalModal";
import { AddHabitModal } from "./AddHabitModal";
import type { MonthlyGoal, FoundationalHabit, HabitFrequency } from "@/lib/types";
import { isAuthLocalOnly, isCloudSupabaseConfigured } from "@/lib/authMode";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const FREQ_LABELS: Record<HabitFrequency, string> = {
  daily: "Daily Recurrence",
  weekdays: "Weekdays",
  "3x_week": "3x Per Week",
  "5x_week": "5x Per Week",
  weekends: "Weekends",
};

// ── Right panel ───────────────────────────────────────────────────────────────
export function MonthlyAIGuidancePanel() {
  return (
    <div className="px-7 pt-10 pb-8 space-y-6 h-full overflow-y-auto">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#ecf7f2" }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>auto_awesome</span>
        </div>
        <div>
          <p className="font-headline font-bold text-sm" style={{ color: "#1a1f1e" }}>AI Guidance</p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#a8b5af" }}>Planning Strategy</p>
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>layers</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>Bedrock Structure</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
            For a balanced month, use a &lsquo;Bedrock&rsquo; setup:{" "}
            <strong style={{ color: "#1a1f1e" }}>1 Main Goal</strong> for focus and{" "}
            <strong style={{ color: "#1a1f1e" }}>2 Secondary Goals</strong> for support.{" "}
            Foundational habits are yours to define below — AI only suggests the goals.
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>bolt</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>Avoid Overload</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
            Most productivity failures happen when the monthly list is too long. By limiting your primary targets, you increase your completion probability by 40%.
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>stacked_line_chart</span>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>Habit Stacking</p>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>
            Select habits that directly support your goals. If your goal is financial, &ldquo;Daily Expense Logging&rdquo; is a critical foundational habit.
          </p>
        </div>
      </div>
      <div className="rounded-xl p-4" style={{ background: "#f4f6f4" }}>
        <p className="text-xs italic leading-relaxed" style={{ color: "#6b7b74" }}>
          &ldquo;The secret of your future is hidden in your daily routine.&rdquo; — Mike Murdock
        </p>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, action, onAction }: { label: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-1 h-5 rounded-full" style={{ background: "#006c4a" }} />
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#3d4f49" }}>{label}</h2>
      </div>
      <button
        onClick={onAction}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-70"
        style={{ color: "#006c4a" }}
      >
        <span className="material-symbols-outlined text-[15px]">add_circle</span>
        {action}
      </button>
    </div>
  );
}

// ── AI Draft Preview ──────────────────────────────────────────────────────────
interface AIDraft {
  reasoning: string;
  main_goals: { title: string; description: string; estimated_effort?: string; target_date?: string }[];
  secondary_goals: { title: string; description: string; estimated_effort?: string; target_date?: string }[];
}

// ── Main step ─────────────────────────────────────────────────────────────────
export function StepMonthly({ onNext, onBack }: Props) {
  const {
    categories,
    yearlyGoals,
    monthlyGoals,
    addMonthlyGoal,
    updateMonthlyGoal,
    removeMonthlyGoal,
    habits,
    addHabit,
    updateHabit,
    removeHabit,
    generateMonthlyPlan,
    approveMonthlyPlan,
    syncMonthlyGoalsToServer,
  } = useAppStore(
    useShallow((state) => ({
      categories: state.categories,
      yearlyGoals: state.yearlyGoals,
      monthlyGoals: state.monthlyGoals,
      addMonthlyGoal: state.addMonthlyGoal,
      updateMonthlyGoal: state.updateMonthlyGoal,
      removeMonthlyGoal: state.removeMonthlyGoal,
      habits: state.habits,
      addHabit: state.addHabit,
      updateHabit: state.updateHabit,
      removeHabit: state.removeHabit,
      generateMonthlyPlan: state.generateMonthlyPlan,
      approveMonthlyPlan: state.approveMonthlyPlan,
      syncMonthlyGoalsToServer: state.syncMonthlyGoalsToServer,
    })),
  );

  // Modal state: null=closed, "main"/"secondary"=add mode, MonthlyGoal=edit mode
  const [goalModal, setGoalModal] = useState<null | "main" | "secondary" | MonthlyGoal>(null);
  // Habit modal: null=closed, true=add mode, FoundationalHabit=edit mode
  const [habitModal, setHabitModal] = useState<null | true | FoundationalHabit>(null);

  // AI generation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<AIDraft | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAccepting, setAiAccepting] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  /** Which AI draft rows are included when saving (`m:0` main, `s:0` secondary). */
  const [aiRowKeys, setAiRowKeys] = useState<Set<string>>(() => new Set());

  const buildAiRowKeys = (draft: AIDraft) => {
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

  const handleAIGenerate = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiDraft(null);
    const result = await generateMonthlyPlan(getCurrentYear(), getCurrentMonth());
    if (result.ok && result.draft) {
      const draft = result.draft as AIDraft;
      setAiDraft(draft);
      setAiRowKeys(buildAiRowKeys(draft));
    } else if (!result.ok && result.code === "no_yearly_on_server") {
      setAiError(
        "The server does not have yearly goals for this year yet. Go back to Step 1 and save at least one yearly goal, then try AI again.",
      );
    } else if (!result.ok && result.code === "yearly_sync_failed") {
      const detail = useAppStore.getState().syncError;
      setAiError(
        detail ??
          "Yearly goals could not be confirmed on the server yet. Fix the sync issue above, then try AI again.",
      );
    } else if (!result.ok && result.code === "no_session") {
      setAiError("Your workspace session is not ready. Refresh the page or sign in again, then retry.");
    } else {
      const detail = useAppStore.getState().syncError;
      setAiError(
        detail ??
          "Could not generate a monthly plan. Check NEXT_PUBLIC_API_URL, network, and backend logs, then try again.",
      );
    }
    setAiLoading(false);
  };

  const handleAIAccept = async () => {
    if (!aiDraft || aiSelectedCount === 0) return;
    const goals: Record<string, unknown>[] = [];
    aiDraft.main_goals?.forEach((g, i) => {
      if (aiRowKeys.has(`m:${i}`)) goals.push({ ...g, is_main: true, priority: "high" });
    });
    aiDraft.secondary_goals?.forEach((g, i) => {
      if (aiRowKeys.has(`s:${i}`)) goals.push({ ...g, is_main: false, priority: "medium" });
    });
    setAiAccepting(true);
    const ok = await approveMonthlyPlan(getCurrentYear(), getCurrentMonth(), goals);
    if (ok) {
      setAiDraft(null);
      setAiRowKeys(new Set());
    }
    setAiAccepting(false);
  };

  const currentGoals = monthlyGoals.filter((g) => g.month === getCurrentMonth() && g.year === getCurrentYear());
  const mainGoals = currentGoals.filter((g) => g.isMain);
  const secondaryGoals = currentGoals.filter((g) => !g.isMain);
  const activeHabits = habits.filter((h) => h.active);

  const isEditMode = goalModal !== null && typeof goalModal === "object";
  const addMode = typeof goalModal === "string" ? goalModal : null;

  const handleGoalSubmit = (
    title: string,
    categoryId: string,
    yearlyGoalId: string,
    targetDate: string,
    description: string,
    workload: string,
  ) => {
    const desc = description.trim();
    const wl = workload.trim();
    if (isEditMode && goalModal) {
      const g = goalModal as MonthlyGoal;
      updateMonthlyGoal(g.id, {
        title,
        categoryId,
        yearlyGoalId: yearlyGoalId || undefined,
        targetDate,
        description: desc,
        workload: wl,
      });
    } else if (addMode) {
      addMonthlyGoal({
        title,
        categoryId,
        yearlyGoalId: yearlyGoalId || undefined,
        targetDate,
        ...(desc ? { description: desc } : {}),
        ...(wl ? { workload: wl } : {}),
        isMain: addMode === "main",
        month: getCurrentMonth(),
        year: getCurrentYear(),
        status: "active",
        progress: 0,
        priority: addMode === "main" ? "high" : "medium",
        aiSuggested: false,
      });
    }
    setGoalModal(null);
  };

  const isEditingHabit = habitModal !== null && habitModal !== true;

  const handleHabitSubmit = (name: string, icon: string, categoryId: string, frequency: HabitFrequency) => {
    if (isEditingHabit && habitModal) {
      const h = habitModal as FoundationalHabit;
      updateHabit(h.id, { name, icon, categoryId, frequency });
    } else {
      addHabit({ name, icon, categoryId, frequency, completedToday: false, streak: 0, active: true });
    }
    setHabitModal(null);
  };

  const getCategoryName = (catId?: string) =>
    categories.find((c) => c.id === catId)?.name?.toUpperCase() ?? "";

  const handleLeaveMonthly = async () => {
    setLeaveError(null);
    const ok = await syncMonthlyGoalsToServer(getCurrentYear(), getCurrentMonth());
    const serverPersistenceRequired = isCloudSupabaseConfigured() && !isAuthLocalOnly();
    if (serverPersistenceRequired && (!ok || useAppStore.getState().syncError)) {
      setLeaveError("Monthly goals have not finished saving to the server yet. Fix the sync error above, then try again.");
      return;
    }
    onNext();
  };

  return (
    <>
      <div className="animate-slide-up space-y-8">
        {/* Heading */}
        <div className="text-center">
          <h1 className="font-headline text-4xl font-extrabold tracking-tight mb-2.5" style={{ color: "#1a1f1e" }}>
            {MONTH_NAMES[getCurrentMonth() - 1]} {getCurrentYear()} Bedrock
          </h1>
          <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "#6b7b74" }}>
            Establish your foundation. We&apos;ve structured your month around primary objectives, secondary supports, and the habits that sustain them.
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
                <p className="text-xs" style={{ color: "#6b7b74" }}>Let AI suggest main and secondary monthly goals from your yearly objectives (often a few seconds).</p>
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
                  Generating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[15px]">bolt</span>
                  AI Generate
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
                          <div className="flex flex-wrap gap-2 mt-1">
                            {g.target_date && (
                              <span className="text-[10px] font-semibold" style={{ color: "#5a6b65" }}>
                                Target: {formatDate(g.target_date)}
                              </span>
                            )}
                            {g.estimated_effort && (
                              <span className="text-[10px]" style={{ color: "#8a9e97" }}>Effort: {g.estimated_effort}</span>
                            )}
                          </div>
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
                          <div className="flex flex-wrap gap-2 mt-1">
                            {g.target_date && (
                              <span className="text-[10px] font-semibold" style={{ color: "#5a6b65" }}>
                                Target: {formatDate(g.target_date)}
                              </span>
                            )}
                            {g.estimated_effort && (
                              <span className="text-[10px]" style={{ color: "#8a9e97" }}>Effort: {g.estimated_effort}</span>
                            )}
                          </div>
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

        {/* ── Main Goals ── */}
        <section>
          <SectionHeader label="Main Goals (High Priority)" action="Add Goal" onAction={() => setGoalModal("main")} />
          <div className="space-y-3">
            {mainGoals.map((goal) => (
              <MainGoalCard
                key={goal.id}
                goal={goal}
                categoryName={getCategoryName(goal.categoryId)}
                onEdit={() => setGoalModal(goal)}
                onDelete={() => removeMonthlyGoal(goal.id)}
              />
            ))}
            {mainGoals.length === 0 && (
              <EmptySlot label="Add your primary goal for the month" onAdd={() => setGoalModal("main")} />
            )}
          </div>
        </section>

        {/* ── Secondary Goals ── */}
        <section>
          <SectionHeader label="Secondary Goals" action="Add Target" onAction={() => setGoalModal("secondary")} />
          <div className="grid grid-cols-2 gap-3">
            {secondaryGoals.map((goal) => (
              <SecondaryGoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => setGoalModal(goal)}
                onDelete={() => removeMonthlyGoal(goal.id)}
              />
            ))}
            {secondaryGoals.length === 0 && (
              <div className="col-span-2">
                <EmptySlot label="Add supporting goals" onAdd={() => setGoalModal("secondary")} />
              </div>
            )}
          </div>
        </section>

        {/* ── Foundational Habits ── */}
        <section>
          <SectionHeader label="Foundational Habits" action="Define Routine" onAction={() => setHabitModal(true)} />
          <div className="space-y-2">
            {activeHabits.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                categoryName={getCategoryName(habit.categoryId)}
                freqLabel={FREQ_LABELS[habit.frequency]}
                onEdit={() => setHabitModal(habit)}
                onDelete={() => removeHabit(habit.id)}
              />
            ))}
            {activeHabits.length === 0 && (
              <EmptySlot label="Define your foundational habits" onAdd={() => setHabitModal(true)} />
            )}
          </div>
        </section>

        {/* Navigation */}
        {leaveError && (
          <div className="rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "#991b1b" }}>{leaveError}</p>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 pb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition"
            style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#f7f9f8")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "white")}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </button>
          <button
            type="button"
            onClick={() => void handleLeaveMonthly()}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "#006c4a", boxShadow: "0 2px 12px rgba(0,108,74,0.22)" }}
          >
            Generate Weekly Flow
            <span className="material-symbols-outlined text-[18px]">stacked_bar_chart</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      {goalModal !== null && (
        <AddMonthlyGoalModal
          mode={isEditMode ? ((goalModal as MonthlyGoal).isMain ? "main" : "secondary") : (addMode as "main" | "secondary")}
          categories={categories}
          yearlyGoals={yearlyGoals.filter((g) => g.year === getCurrentYear())}
          initialTitle={isEditMode ? (goalModal as MonthlyGoal).title : ""}
          initialCategoryId={isEditMode ? (goalModal as MonthlyGoal).categoryId : undefined}
          initialYearlyGoalId={isEditMode ? (goalModal as MonthlyGoal).yearlyGoalId : undefined}
          initialDate={isEditMode ? (goalModal as MonthlyGoal).targetDate : undefined}
          initialDescription={isEditMode ? (goalModal as MonthlyGoal).description : undefined}
          initialWorkload={isEditMode ? (goalModal as MonthlyGoal).workload : undefined}
          onSubmit={handleGoalSubmit}
          onClose={() => setGoalModal(null)}
        />
      )}
      {habitModal !== null && (
        <AddHabitModal
          categories={categories}
          initialName={isEditingHabit ? (habitModal as FoundationalHabit).name : undefined}
          initialIcon={isEditingHabit ? (habitModal as FoundationalHabit).icon : undefined}
          initialCategoryId={isEditingHabit ? (habitModal as FoundationalHabit).categoryId : undefined}
          initialFrequency={isEditingHabit ? (habitModal as FoundationalHabit).frequency : undefined}
          onSubmit={handleHabitSubmit}
          onClose={() => setHabitModal(null)}
        />
      )}
    </>
  );
}

// ── Goal cards ────────────────────────────────────────────────────────────────
function MainGoalCard({
  goal,
  categoryName,
  onEdit,
  onDelete,
}: {
  goal: MonthlyGoal;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="bg-white rounded-2xl p-5 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
      style={{
        border: hovered ? "1.5px solid rgba(0,108,74,0.4)" : "1.5px dashed rgba(0,0,0,0.1)",
        boxShadow: hovered ? "0 6px 24px rgba(0,108,74,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "border 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: badge + actions */}
      <div className="flex items-start justify-between mb-3">
        {goal.aiSuggested ? (
          <span
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: "#ecf7f2", color: "#006c4a" }}
          >
            <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
            AI Suggested Priority
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: "#f4f6f4", color: "#8a9e97" }}
          >
            User Entry
          </span>
        )}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-all"
            style={{ color: "#c8d5d0" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#006c4a"; (e.currentTarget as HTMLElement).style.background = "#ecf7f2"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#c8d5d0"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-all"
            style={{ color: "#c8d5d0" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#c8d5d0"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[15px]">delete</span>
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-headline text-xl font-bold leading-snug mb-2" style={{ color: "#1a1f1e" }}>
        {goal.title}
      </h3>

      {goal.description ? (
        <p className="text-sm leading-relaxed mb-4 line-clamp-4" style={{ color: "#5a6b65" }}>
          {goal.description}
        </p>
      ) : null}

      {/* Meta row */}
      <div className="flex items-center gap-4 flex-wrap">
        {goal.workload && (
          <div className="flex items-center gap-1.5 min-w-0 max-w-full">
            <span className="material-symbols-outlined text-[13px] flex-shrink-0" style={{ color: "#b0bcb8" }}>hourglass_empty</span>
            <span className="text-xs min-w-0" style={{ color: "#6b7b74" }}>
              Effort: <strong className="font-semibold" style={{ color: "#3d4f49" }}>{goal.workload}</strong>
            </span>
          </div>
        )}
        {goal.targetDate && (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#b0bcb8" }}>calendar_today</span>
            <span className="text-xs" style={{ color: "#6b7b74" }}>
              Target: <strong>{formatDate(goal.targetDate)}</strong>
            </span>
          </div>
        )}
        {categoryName && (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[13px]" style={{ color: "#b0bcb8" }}>label</span>
            <span className="text-xs" style={{ color: "#6b7b74" }}>{categoryName}</span>
          </div>
        )}
        {goal.yearlyGoalId && (
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider" style={{ color: "#c4d0cb" }}>
            Yearly Anchor
          </span>
        )}
      </div>
    </div>
  );
}

function SecondaryGoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: MonthlyGoal;
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
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: goal.aiSuggested ? "#ecf7f2" : "#f4f6f4", color: goal.aiSuggested ? "#006c4a" : "#8a9e97" }}
        >
          {goal.aiSuggested ? "Strategy Suggestion" : "User Entry"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all"
          style={{ color: "#c8d5d0" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#c8d5d0"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span className="material-symbols-outlined text-[13px]">delete</span>
        </button>
      </div>
      <p className="text-sm font-semibold flex-1 leading-snug mb-1.5" style={{ color: "#1a1f1e" }}>{goal.title}</p>
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
          {goal.targetDate ? "calendar_today" : "schedule"}
        </span>
        <span className="text-xs" style={{ color: "#b0bcb8" }}>
          {goal.targetDate ? formatDate(goal.targetDate) : "Date pending"}
        </span>
      </div>
    </div>
  );
}

function HabitRow({
  habit,
  categoryName,
  freqLabel,
  onEdit,
  onDelete,
}: {
  habit: { id: string; name: string; icon: string; categoryId?: string };
  categoryName: string;
  freqLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
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
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f4f6f4" }}>
        <span className="material-symbols-outlined text-[18px]" style={{ color: "#5a6b65" }}>{habit.icon}</span>
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
        {categoryName && (
          <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "#a8b5af" }}>
            {categoryName}
          </p>
        )}
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
        style={{ background: "#ecf7f2", color: "#006c4a" }}
      >
        {freqLabel}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
        style={{ color: "#c8d5d0" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#c8d5d0"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <span className="material-symbols-outlined text-[15px]">delete</span>
      </button>
    </div>
  );
}

function EmptySlot({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-semibold transition-all"
      style={{ border: "2px dashed rgba(0,108,74,0.2)", color: "rgba(0,108,74,0.5)" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,108,74,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(0,108,74,0.03)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,108,74,0.2)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span className="material-symbols-outlined text-[16px]">add</span>
      {label}
    </button>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}
