"use client";

import { useEffect, useState } from "react";
import type { DashboardMetrics } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getDayLabels, getWeekdayIndex } from "@/lib/utils";
import { isDayRecapPeriodComplete, isWeekRecapPeriodComplete } from "@/lib/reportAvailability";

interface AnalyticsPanelProps {
  metrics: DashboardMetrics;
  onDayReport?: () => void;
  onWeekReport?: () => void;
}

export function AnalyticsPanel({ metrics, onDayReport, onWeekReport }: AnalyticsPanelProps) {
  const maxVal = Math.max(...metrics.weeklyConsistency, 1);
  const [now, setNow] = useState<Date>(() => new Date());
  const weekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const dayLabels = getDayLabels(weekStartsOn);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dayOpen = isDayRecapPeriodComplete(now);
  const weekOpen = isWeekRecapPeriodComplete(now, weekStartsOn);
  const todayIndex = getWeekdayIndex(now, weekStartsOn);
  const hasWeeklyData = metrics.weeklyConsistency.some((value) => value > 0);
  const hasWeeklyObjective = Boolean(metrics.weeklyObjective?.trim());

  return (
    <div
      className="text-white rounded-2xl p-6 space-y-7"
      style={{ background: "#1a1f1e", boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}
    >
      {/* Streak */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Execution Streak
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-headline font-extrabold" style={{ fontSize: "48px", lineHeight: 1, color: "#85f8c4" }}>
            {metrics.executionStreak}
          </span>
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Days strong</span>
        </div>
        <p className="text-[10px] mt-1.5 font-medium leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>
          Updates as your saved execution history grows.
        </p>
      </div>

      {/* Yesterday Completion */}
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
            Yesterday Completion
          </p>
          <span className="text-xl font-headline font-bold text-white">{metrics.yesterdayCompletion}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${metrics.yesterdayCompletion}%`, background: "#85f8c4" }}
          />
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
          Weekly Consistency
        </p>
        <div className="flex justify-between items-end h-16 gap-1.5">
          {metrics.weeklyConsistency.map((val, i) => {
            const pct = Math.round((val / maxVal) * 100);
            const isToday = i === todayIndex;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-500"
                style={{
                  height: `${Math.max(pct, 6)}%`,
                  background: isToday
                    ? "#85f8c4"
                    : `rgba(133,248,196,${0.15 + (val / maxVal) * 0.55})`,
                  boxShadow: isToday ? "0 0 10px rgba(133,248,196,0.35)" : undefined,
                }}
                title={`${dayLabels[i]}: ${val}%`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
          {dayLabels.map((d, i) => (
            <span key={i} className="flex-1 text-center">
              {d}
            </span>
          ))}
        </div>
        {!hasWeeklyData && (
          <p className="text-[10px] font-medium leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>
            No execution has been logged for the current week yet.
          </p>
        )}
      </div>

      <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          Weekly Objective
        </p>
        <p className="text-sm font-semibold leading-snug text-white">
          {hasWeeklyObjective ? metrics.weeklyObjective : "No weekly sprint saved for this week yet."}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          Monthly Context
        </p>
        <p className="text-sm font-medium leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>
          {metrics.monthlyContext || "No monthly context is connected yet."}
        </p>
      </div>

      <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
          Quick Reports
        </p>
        {onDayReport && (
          <button
            type="button"
            onClick={() => dayOpen && onDayReport()}
            disabled={!dayOpen}
            title={dayOpen ? "Open day recap" : "Available after today ends (local time)."}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
            style={{
              background: dayOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
              color: dayOpen ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)",
              cursor: dayOpen ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (!dayOpen) return;
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)";
            }}
            onMouseLeave={(e) => {
              if (!dayOpen) return;
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
            }}
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[15px]">today</span>
              Day Recap
            </span>
            <span className="material-symbols-outlined text-[16px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              chevron_right
            </span>
          </button>
        )}
        {onWeekReport && (
          <button
            type="button"
            onClick={() => weekOpen && onWeekReport()}
            disabled={!weekOpen}
            title={weekOpen ? "Open weekly recap" : "Available after this week ends (local time)."}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
            style={{
              background: weekOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
              color: weekOpen ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)",
              cursor: weekOpen ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (!weekOpen) return;
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)";
            }}
            onMouseLeave={(e) => {
              if (!weekOpen) return;
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
            }}
          >
            <span className="flex items-center gap-2 text-xs font-semibold">
              <span className="material-symbols-outlined text-[15px]">date_range</span>
              Weekly Recap
            </span>
            <span className="material-symbols-outlined text-[16px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              chevron_right
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
