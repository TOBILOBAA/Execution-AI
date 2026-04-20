"use client";

import { cn } from "@/lib/utils";
import type { YearlyGoal, Category } from "@/lib/types";
import { ProgressBar } from "@/components/ui/Progress";
import { Badge } from "@/components/ui/Badge";
import { CURRENT_YEAR } from "@/lib/mockData";

interface YearlyGoalsSectionProps {
  goals: YearlyGoal[];
  categories: Category[];
  onAdd: () => void;
  onEdit: (goal: YearlyGoal) => void;
}

export function YearlyGoalsSection({
  goals,
  categories,
  onAdd,
  onEdit,
}: YearlyGoalsSectionProps) {
  const getCat = (id?: string) => (id ? categories.find((c) => c.id === id) : undefined);

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div
        className="bg-white rounded-xl p-8 shadow-sm relative overflow-hidden"
        style={{ boxShadow: "0 12px 32px -4px rgba(43,52,55,0.04)" }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[--color-primary-container]/10 rounded-bl-full -mr-8 -mt-8" />
        <div className="flex justify-between items-end mb-8 flex-wrap gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-[--color-primary] block mb-1.5">
              Annual Directive
            </span>
            <h2 className="font-headline font-bold text-2xl text-[--color-on-surface]">
              Yearly Goals {CURRENT_YEAR}
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

        <div className="grid md:grid-cols-2 gap-5">
          {goals.map((goal) => {
            const cat = getCat(goal.categoryId);
            return (
              <div
                key={goal.id}
                className={cn(
                  "p-6 rounded-lg ghost-border hover:bg-white hover:shadow-md transition-all duration-200 group cursor-pointer",
                  goal.status === "completed"
                    ? "bg-emerald-50/50"
                    : "bg-[--color-surface-container-low]"
                )}
                onClick={() => onEdit(goal)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {cat && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[--color-on-surface-variant]/60">
                        <span className="material-symbols-outlined text-xs">{cat.icon}</span>
                        {cat.name}
                      </span>
                    )}
                    {goal.aiSuggested && (
                      <Badge variant="ai">
                        <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                        AI
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[--color-primary] rounded"
                    aria-label="Edit goal"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>

                <h4 className="font-headline font-bold text-[--color-on-surface] mb-2 leading-snug">
                  <span className="w-2 h-2 rounded-full bg-[--color-primary] inline-block mr-2 flex-shrink-0" />
                  {goal.title}
                </h4>

                {goal.description && (
                  <p className="text-sm text-[--color-on-surface-variant] leading-relaxed mb-4">
                    {goal.description}
                  </p>
                )}

                <ProgressBar value={goal.progress} showLabel size="sm" />
              </div>
            );
          })}

          {/* Add placeholder */}
          <button
            onClick={onAdd}
            className="p-6 rounded-lg border-2 border-dashed border-[--color-outline-variant]/30 hover:border-[--color-primary]/30 hover:bg-[--color-primary]/5 transition-all duration-150 flex flex-col items-center gap-2 text-[--color-on-surface-variant]/40 hover:text-[--color-primary] group"
          >
            <span className="material-symbols-outlined text-3xl">add_circle</span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              Add Yearly Goal
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
