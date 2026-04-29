"use client";

import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import type { DashboardMetrics } from "@/lib/types";
import { getCurrentMonth, getCurrentWeek, getCurrentYear } from "@/lib/mockData";

interface AlignmentPanelProps {
  metrics: DashboardMetrics;
}

export function AlignmentPanel({ metrics }: AlignmentPanelProps) {
  const { openModal, monthlyGoals, weeklyGoals } = useAppStore(
    useShallow((state) => ({
      openModal: state.openModal,
      monthlyGoals: state.monthlyGoals,
      weeklyGoals: state.weeklyGoals,
    })),
  );
  const currentMonthlyGoal =
    monthlyGoals.find((g) => g.year === getCurrentYear() && g.month === getCurrentMonth() && g.isMain) ??
    monthlyGoals.find((g) => g.year === getCurrentYear() && g.month === getCurrentMonth());
  const currentWeeklyGoal =
    weeklyGoals.find((g) => g.year === getCurrentYear() && g.weekNumber === getCurrentWeek() && g.isMain) ??
    weeklyGoals.find((g) => g.year === getCurrentYear() && g.weekNumber === getCurrentWeek());

  return (
    <div className="space-y-3">
      <div
        className="p-5 bg-white rounded-2xl relative group"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#a8b5af" }}>
          Weekly Objective
        </p>
        <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
          {metrics.weeklyObjective}
        </p>
        <button
          onClick={() => openModal(currentWeeklyGoal ? "edit-weekly-goal" : "add-weekly-goal", currentWeeklyGoal)}
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
          style={{ color: "#006c4a" }}
          aria-label="Edit weekly objective"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
      </div>

      <div
        className="p-5 rounded-2xl relative group"
        style={{ background: "#f7f9f8", boxShadow: "0 1px 4px rgba(0,0,0,0.02)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#a8b5af" }}>
          Monthly Context
        </p>
        <p className="text-sm font-medium leading-snug" style={{ color: "#6b7c75" }}>
          {metrics.monthlyContext}
        </p>
        <button
          onClick={() => openModal(currentMonthlyGoal ? "edit-monthly-goal" : "add-monthly-goal", currentMonthlyGoal)}
          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
          style={{ color: "#006c4a" }}
          aria-label="Edit monthly context"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
        </button>
      </div>
    </div>
  );
}
