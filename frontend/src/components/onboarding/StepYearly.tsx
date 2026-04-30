"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { getCurrentYear } from "@/lib/mockData";
import { isAuthLocalOnly, isCloudSupabaseConfigured } from "@/lib/authMode";
import { AddGoalModal } from "./AddGoalModal";
import { AddCategoryModal } from "./AddCategoryModal";
import { formatShortDate } from "./MiniCalendar";
import type { YearlyGoal } from "@/lib/types";

interface Props {
  onNext: () => void;
}

// ── Right AI Guidance Panel ───────────────────────────────────────────────────
export function YearlyAIGuidancePanel() {
  return (
    <div className="px-7 pt-10 pb-8 space-y-6 h-full overflow-y-auto">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#ecf7f2" }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#006c4a" }}>auto_awesome</span>
        </div>
        <div>
          <p className="font-headline font-bold text-sm" style={{ color: "#1a1f1e" }}>AI Guidance</p>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#a8b5af" }}>Goal Architecture</p>
        </div>
      </div>
      <div className="space-y-5">
        {[
          { icon: "trending_up", label: "Think Long-Term", body: "Yearly goals are milestones on a longer journey. Ensure they move the needle toward your 3–5 year vision." },
          { icon: "my_location", label: "Be Specific", body: "\u201CGet healthy\u201D is a wish; \u201CRun a half-marathon by October\u201D is a goal." },
          { icon: "favorite", label: "Align with Values", body: "Productivity without purpose leads to burnout. Ask yourself: \u201CWhy does this matter to me right now?\u201D" },
        ].map(({ icon, label, body }) => (
          <div key={label}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="material-symbols-outlined text-[13px]" style={{ color: "#a8b5af" }}>{icon}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>{label}</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#6b7b74" }}>{body}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4" style={{ background: "#f4f6f4" }}>
        <p className="text-xs italic leading-relaxed" style={{ color: "#6b7b74" }}>
          &ldquo;Setting goals is the first step in turning the invisible into the visible.&rdquo; — Tony Robbins
        </p>
      </div>
    </div>
  );
}

// ── Main step ─────────────────────────────────────────────────────────────────
export function StepYearly({ onNext }: Props) {
  const {
    categories,
    yearlyGoals,
    addYearlyGoal,
    updateYearlyGoal,
    removeYearlyGoal,
    addCategory,
    removeCategory,
    syncYearlyGoalsToServer,
  } = useAppStore(
    useShallow((state) => ({
      categories: state.categories,
      yearlyGoals: state.yearlyGoals,
      addYearlyGoal: state.addYearlyGoal,
      updateYearlyGoal: state.updateYearlyGoal,
      removeYearlyGoal: state.removeYearlyGoal,
      addCategory: state.addCategory,
      removeCategory: state.removeCategory,
      syncYearlyGoalsToServer: state.syncYearlyGoalsToServer,
    })),
  );

  const [expanded, setExpanded] = useState<string>(categories[0]?.id ?? "");
  // null = closed, "new" = add mode, or a YearlyGoal object = edit mode
  const [goalModal, setGoalModal] = useState<null | "new" | YearlyGoal>(null);
  const [modalCatId, setModalCatId] = useState<string>("");
  const [showCatModal, setShowCatModal] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState("");

  const fallbackCategoryId = categories[0]?.id ?? "";
  const getGoalsForCat = (catId: string) =>
    yearlyGoals.filter(
      (g) =>
        g.year === getCurrentYear() &&
        (g.categoryId === catId || (!g.categoryId && catId === fallbackCategoryId)),
    );

  const openAddGoal = (catId: string) => {
    setModalCatId(catId);
    setGoalModal("new");
  };

  const openEditGoal = (goal: YearlyGoal) => {
    setModalCatId(goal.categoryId ?? fallbackCategoryId);
    setGoalModal(goal);
  };

  const handleModalSubmit = (title: string, targetDate: string, description: string) => {
    if (typeof goalModal === "string") {
      // "new" → add
      addYearlyGoal({
        title,
        categoryId: modalCatId,
        ...(description ? { description } : {}),
        year: getCurrentYear(),
        status: "active",
        progress: 0,
        targetDate,
      });
    } else if (goalModal) {
      // YearlyGoal object → edit
      updateYearlyGoal(goalModal.id, { title, description: description || undefined, targetDate });
    }
    setGoalModal(null);
  };

  const isEditMode = goalModal !== null && typeof goalModal !== "string";

  const handleLeaveYearly = async () => {
    if (yearlyGoals.filter(g => g.year === CURRENT_YEAR).length < 1) {
      setLeaveError("Add at least one yearly goal before continuing.");
      return;
    }
    setLeaveError("");
    setLeaveBusy(true);
    const ok = await syncYearlyGoalsToServer();
    const serverPersistenceRequired = isCloudSupabaseConfigured() && !isAuthLocalOnly();
    if (serverPersistenceRequired && (!ok || useAppStore.getState().syncError)) {
      setLeaveBusy(false);
      return;
    }
    setLeaveBusy(false);
    onNext();
  };

  return (
    <>
      <div className="animate-slide-up">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="font-headline text-4xl font-extrabold tracking-tight mb-2.5" style={{ color: "#1a1f1e" }}>
            Set your yearly goals.
          </h1>
          <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#6b7b74" }}>
            What do you want to accomplish in {getCurrentYear()}? Group them by category. Your monthly, weekly, and daily
            plans flow from these.
          </p>
        </div>

        {/* Category accordion list */}
        <div className="space-y-3">
          {categories.map((cat) => {
            const goals = getGoalsForCat(cat.id);
            const isOpen = expanded === cat.id;

            return (
              <CategoryCard
                key={cat.id}
                cat={cat}
                goals={goals}
                isOpen={isOpen}
                onToggle={() => setExpanded(isOpen ? "" : cat.id)}
                onDelete={() => { removeCategory(cat.id); if (expanded === cat.id) setExpanded(""); }}
                onAddGoal={() => openAddGoal(cat.id)}
                onEditGoal={openEditGoal}
                onRemoveGoal={removeYearlyGoal}
              />
            );
          })}

          {/* Add Custom Category */}
          <button
            onClick={() => setShowCatModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all rounded-xl"
            style={{ color: "#a8b5af", border: "1.5px dashed rgba(168,181,175,0.4)" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#006c4a";
              el.style.borderColor = "rgba(0,108,74,0.3)";
              el.style.background = "rgba(0,108,74,0.03)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.color = "#a8b5af";
              el.style.borderColor = "rgba(168,181,175,0.4)";
              el.style.background = "transparent";
            }}
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            + Add custom category
          </button>
        </div>

        {/* Next Step */}
        <div className="flex flex-col items-end gap-2 pt-8 pb-2">
          {leaveError && (
            <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>{leaveError}</p>
          )}
          <button
            type="button"
            disabled={leaveBusy}
            onClick={() => void handleLeaveYearly()}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            style={{ background: "#006c4a", boxShadow: "0 2px 12px rgba(0,108,74,0.22)" }}
          >
            {leaveBusy ? "Saving…" : "Next"}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Add / Edit goal modal */}
      {goalModal !== null && (
        <AddGoalModal
          categoryName={categories.find(c => c.id === modalCatId)?.name ?? ""}
          mode={isEditMode ? "edit" : "add"}
          initialTitle={isEditMode ? (goalModal as YearlyGoal).title : ""}
          initialDate={isEditMode ? (goalModal as YearlyGoal).targetDate : undefined}
          initialDescription={isEditMode ? (goalModal as YearlyGoal).description : ""}
          onAdd={handleModalSubmit}
          onClose={() => setGoalModal(null)}
        />
      )}

      {/* New category modal */}
      {showCatModal && (
        <AddCategoryModal
          onAdd={(name, icon) => { addCategory({ name, icon }); setShowCatModal(false); }}
          onClose={() => setShowCatModal(false)}
        />
      )}
    </>
  );
}

// ── Category accordion card with hover state ──────────────────────────────────
function CategoryCard({
  cat,
  goals,
  isOpen,
  onToggle,
  onDelete,
  onAddGoal,
  onEditGoal,
  onRemoveGoal,
}: {
  cat: { id: string; name: string; icon: string };
  goals: YearlyGoal[];
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddGoal: () => void;
  onEditGoal: (goal: YearlyGoal) => void;
  onRemoveGoal: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl"
      style={{
        border: hovered ? "1.5px solid rgba(0,108,74,0.4)" : "1.5px dashed rgba(0,0,0,0.1)",
        boxShadow: hovered ? "0 6px 24px rgba(0,108,74,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "border 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Header ── */}
      <div className="flex items-center px-5 py-4 gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <span className="material-symbols-outlined text-[20px] flex-shrink-0" style={{ color: "#006c4a" }}>
            {cat.icon}
          </span>
          <span className="font-headline font-bold text-sm truncate" style={{ color: "#1a1f1e" }}>
            {cat.name}
          </span>
        </button>

        {goals.length > 0 && (
          <span className="text-xs font-semibold flex-shrink-0" style={{ color: "#a8b5af" }}>
            {goals.length} {goals.length === 1 ? "Goal" : "Goals"}
          </span>
        )}

        <button
          type="button"
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center flex-shrink-0"
        >
          <span
            className="material-symbols-outlined text-[18px] transition-transform duration-200"
            style={{ color: "#a8b5af", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            expand_more
          </span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 transition-all"
          style={{ color: "#c8d5d0" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#c8d5d0"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <span className="material-symbols-outlined text-[15px]">delete</span>
        </button>
      </div>

      {/* ── Expanded body ── */}
      {isOpen && (
        <div className="px-5 pb-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="pt-1">
            {goals.map((goal, i) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                isLast={i === goals.length - 1}
                onEdit={() => onEditGoal(goal)}
                onRemove={() => onRemoveGoal(goal.id)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onAddGoal}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ border: "2px dashed rgba(0,108,74,0.22)", color: "rgba(0,108,74,0.65)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,108,74,0.45)"; (e.currentTarget as HTMLElement).style.background = "rgba(0,108,74,0.03)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,108,74,0.22)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            + Add yearly goal
          </button>
        </div>
      )}
    </div>
  );
}

// ── Individual goal row inside a category ─────────────────────────────────────
function GoalRow({
  goal,
  isLast,
  onEdit,
  onRemove,
}: {
  goal: YearlyGoal;
  isLast: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-3 py-3 rounded-lg px-1 cursor-pointer"
      style={{
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.04)",
        background: hovered ? "rgba(0,108,74,0.03)" : "transparent",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium leading-snug" style={{ color: "#1a1f1e" }}>
            {goal.title}
          </p>
          <span
            className="material-symbols-outlined text-[12px] transition-opacity"
            style={{ color: "#a8b5af", opacity: hovered ? 1 : 0 }}
          >
            edit
          </span>
        </div>
        {goal.targetDate && (
          <div className="flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-[11px]" style={{ color: "#c4d0cb" }}>
              calendar_today
            </span>
            <span className="text-xs" style={{ color: "#a8b5af" }}>
              {formatShortDate(goal.targetDate)}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full transition-all"
        style={{ color: "#c4d0cb", opacity: hovered ? 1 : 0 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.background = "#fef2f2"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#c4d0cb"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        aria-label="Remove goal"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  );
}
