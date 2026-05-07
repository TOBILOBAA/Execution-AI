"use client";

import { useEffect, useState } from "react";
import type { DashboardMetrics } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { getDayLabels, getWeekdayIndex } from "@/lib/utils";

interface AnalyticsPanelProps {
  metrics: DashboardMetrics;
}

export function AnalyticsPanel({ metrics }: AnalyticsPanelProps) {
  const maxVal = Math.max(...metrics.weeklyConsistency, 1);
  const [now, setNow] = useState<Date>(() => new Date());
  const weekStartsOn = useAppStore((state) => state.sessionWeekStartsOn);
  const dayLabels = getDayLabels(weekStartsOn);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayIndex = getWeekdayIndex(now, weekStartsOn);
  const hasWeeklyData = metrics.weeklyConsistency.some((value) => value > 0);
  const hasWeeklyObjective = Boolean(metrics.weeklyObjective?.trim());
  const bestStreakLabel = metrics.bestExecutionStreak === 1 ? "1 day" : `${metrics.bestExecutionStreak} days`;

  return (
    <div
      className="text-white rounded-2xl p-5 sm:p-6 space-y-6 sm:space-y-7"
      style={{ background: "#1a1f1e", boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Execution Streak
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-headline font-extrabold" style={{ fontSize: "48px", lineHeight: 1, color: "#85f8c4" }}>
            {metrics.executionStreak}
          </span>
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Current streak</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ background: "rgba(133,248,196,0.08)", color: "#85f8c4", border: "1px solid rgba(133,248,196,0.15)" }}
          >
            Best streak {bestStreakLabel}
          </span>
        </div>
        <p className="text-[10px] mt-1.5 font-medium leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>
          Grows only when every main priority for the day gets finished.
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
        <div className="flex justify-between items-end h-[72px] md:h-16 gap-1.5">
          {metrics.weeklyConsistency.map((val, i) => {
            const pct = Math.round((val / maxVal) * 100);
            const isToday = i === todayIndex;
            const isFuture = i > todayIndex;
            const isActiveDay = val > 0;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-500"
                style={{
                  height: `${isFuture ? 10 : Math.max(pct, 12)}%`,
                  background: isFuture
                    ? "rgba(255,255,255,0.08)"
                    : isToday
                      ? "#85f8c4"
                      : isActiveDay
                        ? "rgba(133,248,196,0.62)"
                        : "rgba(255,255,255,0.14)",
                  boxShadow: isToday ? "0 0 10px rgba(133,248,196,0.35)" : undefined,
                }}
                title={
                  isFuture
                    ? `${dayLabels[i]}: upcoming`
                    : isActiveDay
                      ? `${dayLabels[i]}: active`
                      : `${dayLabels[i]}: missed`
                }
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.34)" }}>
          {dayLabels.map((d, i) => (
            <span key={i} className="flex-1 text-center">
              {d}
            </span>
          ))}
        </div>
        {!hasWeeklyData && (
          <p className="text-[10px] font-medium leading-snug" style={{ color: "rgba(255,255,255,0.35)" }}>
            No meaningful action has been logged for the current week yet.
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
    </div>
  );
}
