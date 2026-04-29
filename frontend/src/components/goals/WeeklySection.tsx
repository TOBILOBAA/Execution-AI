"use client";

import { cn } from "@/lib/utils";
import type { WeeklyGoal } from "@/lib/types";
import { ProgressBar } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { getCurrentWeek, getCurrentYear } from "@/lib/mockData";

interface WeeklySectionProps {
  goals: WeeklyGoal[];
  onAdd: () => void;
  onEdit: (goal: WeeklyGoal) => void;
}

export function WeeklySection({ goals, onAdd, onEdit }: WeeklySectionProps) {
  const currentGoals = goals.filter(
    (g) => g.weekNumber === getCurrentWeek() && g.year === getCurrentYear()
  );
  const mainGoals = currentGoals.filter((g) => g.isMain);
  const secondaryGoals = currentGoals.filter((g) => !g.isMain);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-[--color-primary] block mb-1">
            Current Week
          </span>
          <h2 className="font-headline font-bold text-xl text-[--color-on-surface]">
            Week {getCurrentWeek()} Sprint
          </h2>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs font-bold text-[--color-primary] uppercase tracking-wider hover:opacity-70 transition-opacity"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Add Goal
        </button>
      </div>

      {/* Main Weekly Goals */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1.5 h-6 bg-[--color-primary] rounded-full" />
          <h3 className="font-headline font-bold text-base uppercase tracking-tight text-[--color-primary]">
            Main Weekly Goals
          </h3>
        </div>
        <div className="space-y-3">
          {mainGoals.map((goal) => (
            <WeeklyGoalCard key={goal.id} goal={goal} onEdit={onEdit} isMain />
          ))}
          <button
            onClick={onAdd}
            className="w-full p-4 rounded-xl border-2 border-dashed border-[--color-outline-variant]/20 hover:border-[--color-primary]/30 hover:bg-[--color-primary]/5 transition-all duration-150 flex items-center gap-2 text-[--color-on-surface-variant]/40 hover:text-[--color-primary] text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add Main Goal
          </button>
        </div>
      </section>

      {/* Secondary */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1.5 h-6 bg-[--color-secondary] rounded-full" />
          <h3 className="font-headline font-bold text-base uppercase tracking-tight text-[--color-on-surface-variant]">
            Secondary Goals
          </h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {secondaryGoals.map((goal) => (
            <WeeklyGoalCard key={goal.id} goal={goal} onEdit={onEdit} />
          ))}
          <button
            onClick={onAdd}
            className="p-4 rounded-xl border-2 border-dashed border-[--color-outline-variant]/20 hover:border-[--color-primary]/30 hover:bg-[--color-primary]/5 transition-all duration-150 flex items-center gap-2 text-[--color-on-surface-variant]/40 hover:text-[--color-primary] text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add Goal
          </button>
        </div>
      </section>
    </div>
  );
}

function WeeklyGoalCard({
  goal,
  onEdit,
  isMain = false,
}: {
  goal: WeeklyGoal;
  onEdit: (g: WeeklyGoal) => void;
  isMain?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer group hover:shadow-md transition-all duration-200",
        isMain
          ? "border-l-4 border-[--color-primary]"
          : "border border-[--color-outline-variant]/10"
      )}
      style={isMain ? { borderTop: "1px solid rgba(171,179,183,0.1)", borderRight: "1px solid rgba(171,179,183,0.1)", borderBottom: "1px solid rgba(171,179,183,0.1)" } : {}}
      onClick={() => onEdit(goal)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-[--color-on-surface-variant]/60 uppercase tracking-wider">
                <span className="text-[10px]">WK</span>
                <span className="font-headline font-black text-[--color-on-surface-variant]">
                  {goal.weekNumber}
                </span>
              </span>
              {goal.aiSuggested && (
                <Badge variant="ai">
                  <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                  AI
                </Badge>
              )}
            </div>
            <h4 className={cn("font-headline font-bold text-[--color-on-surface] leading-snug", isMain ? "text-base" : "text-sm")}>
              {goal.title}
            </h4>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-[--color-on-surface-variant]/40 hover:text-[--color-on-surface] rounded"
          >
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
        </div>

        {goal.description && (
          <p className="text-xs text-[--color-on-surface-variant] mb-4 leading-relaxed">
            {goal.description}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-[--color-outline-variant]/5 pt-3">
          <ProgressBar value={goal.progress} className="flex-1 mr-4" />
          <span className="text-[11px] font-bold text-[--color-on-surface-variant] flex-shrink-0">
            {goal.progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
