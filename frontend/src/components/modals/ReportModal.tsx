"use client";

import { useEffect } from "react";
import type { ModalType } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  type: ModalType;
  data: unknown;
}

// ── Backdrop + modal shell ─────────────────────────────────────────────────────
function ModalShell({
  onClose,
  children,
  wide = false,
  extraWide = false,
  labelledBy,
}: {
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  extraWide?: boolean;
  labelledBy?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full overflow-y-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overscroll-contain"
        style={{ maxWidth: extraWide ? 880 : wide ? 720 : 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Day Recap Modal ───────────────────────────────────────────────────────────
const DAY_DATA = {
  date: "Oct 24",
  weekday: "Thursday, 2024",
  perfScore: 92,
  focusHours: 6.5,
  completion: 88,
  habitStreak: 12,
  aiStatus: "Systematic execution observed. High focus alignment with core objectives.",
  priorities: [
    { title: "Finalize Architectural System documentation", meta: "Deep Work Session · 2h 15m", completed: true },
    { title: "Quarterly Execution Review with Leadership",  meta: "Meeting · 45m",              completed: true },
    { title: "Internal Team Onboarding Module",             meta: "Postponed to Oct 25",         completed: false, note: "Postponed to Oct 25" },
  ],
  secondary: [
    { title: "Inbox Zero clearance",   meta: "Processed 24 threads", completed: true },
    { title: "Review Q4 Budget drafts", meta: "Pending feedback",     completed: false },
    { title: "Update CRM leads",        meta: "12 entries modified",  completed: true },
  ],
  habits: [
    { name: "Hydration",  icon: "water_drop",      done: true },
    { name: "Mobility",   icon: "fitness_center",  done: true },
    { name: "Meditation", icon: "self_improvement", done: true },
    { name: "Reading",    icon: "menu_book",        done: false },
  ],
  reflection: "Today's execution was marked by a strong start on high-leverage tasks. You spent 82% of your focus hours on documented priorities. The missed task 'Internal Team Onboarding' was likely due to over-extension of the leadership meeting — consider capping future review sessions at 30 minutes to protect afternoon execution blocks.",
  tomorrow: [
    "Research competitive execution frameworks",
    "Quarterly roadmap presentation prep",
    "Weekly performance audit",
  ],
};

function DayRecapModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} wide labelledBy="day-recap-title">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 id="day-recap-title" className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>Day Recap</h2>
            <p className="text-sm mt-0.5" style={{ color: "#8a9e97" }}>Excellent progress today. Take a moment to reflect.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl transition-all hover:opacity-60" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Efficiency + Focus Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl p-4" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Efficiency</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>8/10</span>
              <span className="text-xs" style={{ color: "#8a9e97" }}>Tasks Met</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e8eeeb" }}>
              <div className="h-full rounded-full" style={{ width: "80%", background: "#006c4a" }} />
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>Focus Time</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>5.2h</span>
              <span className="text-xs" style={{ color: "#8a9e97" }}>Deep Work</span>
            </div>
            <div className="flex gap-1">
              {[1,1,1,1,0.6,0.3].map((v, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: v === 1 ? "#006c4a" : v > 0.5 ? "rgba(0,108,74,0.5)" : "rgba(0,108,74,0.2)" }} />
              ))}
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="rounded-2xl p-4 mb-5 flex gap-3" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.12)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#006c4a" }}>
            <span className="material-symbols-outlined text-[15px] text-white">auto_awesome</span>
          </div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: "#006c4a" }}>AI Insights</p>
            <p className="text-xs leading-relaxed" style={{ color: "#4a5c54" }}>
              You reached a flow state within 15 minutes of your first task. This suggests your morning routine is optimised. However, your energy dipped around 3 PM — consider scheduling your &ldquo;Review&rdquo; tasks during this window tomorrow to maintain momentum without burnout.
            </p>
          </div>
        </div>

        {/* Suggested for Tomorrow */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>Suggested for Tomorrow</p>
            <button className="text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60" style={{ color: "#006c4a" }}>Add Task</button>
          </div>
          <div className="space-y-1">
            {DAY_DATA.tomorrow.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: "#f9fbfa" }}>
                <span className="material-symbols-outlined text-[16px] flex-shrink-0" style={{ color: "#c4d0cb" }}>drag_indicator</span>
                <p className="text-sm" style={{ color: "#1a1f1e" }}>{t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button onClick={onClose} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-80" style={{ background: "#006c4a" }}>
          Finish Day &amp; Plan Tomorrow
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
        <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: "#c4d0cb" }}>Shift + Enter to Confirm</p>
      </div>
    </ModalShell>
  );
}

// ── Weekly Execution Summary Modal ────────────────────────────────────────────
const WEEK_DATA = {
  weekNum: 42,
  weekTitle: "Operational Excellence",
  dateRange: "Oct 16 – Oct 22, 2023",
  efficiencyPct: 94,
  efficiencyDelta: "+4.2%",
  tasksCompleted: 47,
  tasksTotal: 50,
  focusHours: 32.5,
  focusTarget: 40,
  aiInsight: "\"You demonstrated exceptional momentum in the first half of the week. Your deep work blocks on Tuesday and Wednesday accounted for 60% of your output. Focus on maintaining this intensity on Fridays to avoid the end-of-week drop-off.\"",
  habits: [
    { name: "Morning Routine", icon: "wb_sunny", dots: [1,1,1,0,1,1,1] },
    { name: "Deep Reading",    icon: "menu_book", dots: [1,0,1,0,1,0,1] },
    { name: "Movement",        icon: "fitness_center", dots: [1,1,0,1,1,0,1] },
  ],
};

function WeeklyReportModal({ onClose }: { onClose: () => void }) {
  const focusPct = Math.round((WEEK_DATA.focusHours / WEEK_DATA.focusTarget) * 100);
  return (
    <ModalShell onClose={onClose} wide labelledBy="weekly-report-title">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>Execution Summary</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl transition-opacity hover:opacity-60" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <h2 id="weekly-report-title" className="font-headline font-bold text-2xl mb-1" style={{ color: "#1a1f1e" }}>Week {WEEK_DATA.weekNum}: {WEEK_DATA.weekTitle}</h2>
        <p className="text-sm mb-5" style={{ color: "#8a9e97" }}>{WEEK_DATA.dateRange}</p>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl p-4" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#006c4a" }}>bolt</span>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>Efficiency Score</p>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>{WEEK_DATA.efficiencyPct}%</span>
              <span className="text-sm font-bold" style={{ color: "#006c4a" }}>{WEEK_DATA.efficiencyDelta}</span>
            </div>
            <p className="text-xs" style={{ color: "#a8b5af" }}>{WEEK_DATA.tasksCompleted} of {WEEK_DATA.tasksTotal} scheduled tasks completed</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#006c4a" }}>schedule</span>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>Focus Time</p>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-headline font-extrabold text-3xl" style={{ color: "#1a1f1e" }}>{WEEK_DATA.focusHours}h</span>
              <span className="text-sm" style={{ color: "#a8b5af" }}>/ {WEEK_DATA.focusTarget}h target</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#e8eeeb" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(focusPct, 100)}%`, background: "#006c4a" }} />
            </div>
          </div>
        </div>

        {/* AI Performance Insights */}
        <div className="rounded-2xl p-4 mb-5 flex gap-3" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.12)" }}>
          <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5" style={{ color: "#006c4a" }}>auto_awesome</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#006c4a" }}>AI Performance Insights</p>
            <p className="text-xs leading-relaxed italic" style={{ color: "#4a5c54" }}>{WEEK_DATA.aiInsight}</p>
          </div>
        </div>

        {/* Habit Foundations */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>Habit Foundations</p>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a8b5af" }}>Weekly Completion</p>
          </div>
          <div className="space-y-3">
            {WEEK_DATA.habits.map((h) => (
              <div key={h.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f4f6f4" }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: "#006c4a" }}>{h.icon}</span>
                </div>
                <p className="text-sm flex-1" style={{ color: "#1a1f1e" }}>{h.name}</p>
                <div className="flex items-center gap-1">
                  {h.dots.map((done, i) => (
                    <div key={i} className="w-3 h-3 rounded-full" style={{ background: done ? "#006c4a" : "rgba(0,108,74,0.15)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold transition-opacity hover:opacity-70" style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#6b7c75" }}>
            Reflect &amp; Close
          </button>
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-80" style={{ background: "#006c4a" }}>
            Start Next Week
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Monthly Insight Modal ─────────────────────────────────────────────────────
function MonthlyInsightModal({ onClose, data }: { onClose: () => void; data: unknown }) {
  const d = data as { month?: number; year?: number } | undefined;
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthName = d?.month ? MONTH_NAMES[d.month - 1] : "June";
  const year = d?.year ?? 2026;
  const nextMonth = d?.month ? (MONTH_NAMES[d.month] ?? "Next Month") : "July";

  return (
    <ModalShell onClose={onClose} extraWide labelledBy="monthly-insight-title">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>Monthly Insight</p>
            <h2 id="monthly-insight-title" className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>{monthName} {year}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl transition-opacity hover:opacity-60" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Executive Summary */}
        <div className="rounded-2xl p-5 mb-5 flex gap-3" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.15)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#006c4a" }}>
            <span className="material-symbols-outlined text-[18px] text-white">auto_awesome</span>
          </div>
          <div>
            <p className="text-sm font-bold mb-2" style={{ color: "#1a1f1e" }}>Executive Performance Summary</p>
            <p className="text-xs leading-relaxed" style={{ color: "#4a5c54" }}>
              You&rsquo;ve demonstrated exceptional consistency in your <strong>Foundational Habits</strong> this month, maintaining an 88% success rate. While the <strong>Main Goal</strong> completion reached 92%, your focus dipped slightly in Week 3. Adjusting your evening wind-down routine by 15 minutes could mitigate future mid-month fatigue.
            </p>
          </div>
        </div>

        {/* Main Objective + Secondary */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4 mb-5">
          {/* Main objective */}
          <div className="rounded-2xl p-5" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>Main Objective</p>
                <p className="font-headline font-bold text-base" style={{ color: "#1a1f1e" }}>Scale Operations: Project Phoenix</p>
              </div>
              <div className="text-right">
                <p className="font-headline font-bold text-2xl" style={{ color: "#006c4a" }}>92%</p>
                <p className="text-[9px]" style={{ color: "#a8b5af" }}>COMPLETED</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: "#e8eeeb" }}>
              <div className="h-full rounded-full" style={{ width: "92%", background: "#006c4a" }} />
            </div>
            <div className="space-y-2">
              {[
                { text: "Hire Lead Infrastructure Architect", done: true },
                { text: "Beta Testing Phase 1 Completion",   done: true },
                { text: "Finalize Q3 Strategy Roadmap",      done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: item.done ? "#006c4a" : "#d1d9d5", background: item.done ? "#006c4a" : "transparent" }}>
                    {item.done && <span className="material-symbols-outlined text-[10px] text-white">check</span>}
                  </div>
                  <p className="text-xs" style={{ color: item.done ? "#a8b5af" : "#1a1f1e", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Secondary priorities */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4 flex-1" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "#a8b5af" }}>Secondary Priorities</p>
              {[{ label: "Health: Marathon Prep", pct: 75 }, { label: "Personal: Piano Practice", pct: 40 }].map((s) => (
                <div key={s.label} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <p className="text-[11px]" style={{ color: "#4a5c54" }}>{s.label}</p>
                    <p className="text-[11px] font-bold" style={{ color: "#1a1f1e" }}>{s.pct}%</p>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "#e8eeeb" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: "#1a1f1e" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-3" style={{ background: "#f4f6f4" }}>
              <p className="text-[10px] italic text-center" style={{ color: "#8a9e97" }}>&quot;Progress is not linear; keep moving forward.&quot;</p>
            </div>
          </div>
        </div>

        {/* Foundational Habits */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>Foundational Habits</p>
            <p className="text-xs font-bold" style={{ color: "#006c4a" }}>{monthName.slice(0,3)} Avg: 88%</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[{ name:"Deep Sleep",icon:"bedtime"},{name:"Meditation",icon:"self_improvement"},{name:"Hydration",icon:"water_drop"},{name:"Deep Work",icon:"work"}].map((h) => (
              <div key={h.name} className="rounded-xl p-3 flex flex-col items-center gap-2" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.06)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "#006c4a" }}>{h.icon}</span>
                <p className="text-[10px] font-semibold text-center" style={{ color: "#4a5c54" }}>{h.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-60" style={{ color: "#6b7c75" }}>
              <span className="material-symbols-outlined text-[14px]">download</span>Export PDF
            </button>
            <button className="text-xs font-bold transition-opacity hover:opacity-60" style={{ color: "#6b7c75" }}>Share Report</button>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-80" style={{ background: "#006c4a" }}>
            Archive &amp; Set {nextMonth} Goals
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Yearly Report Modal (opens from the old "View Report" button) ─────────────
function YearlyReportModal({ onClose, data }: { onClose: () => void; data: unknown }) {
  const d = data as { year?: number; completionRate?: number; topPillar?: string; streak?: number } | undefined;
  return (
    <ModalShell onClose={onClose} wide labelledBy="yearly-report-title">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>Annual Report</p>
            <h2 id="yearly-report-title" className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>{d?.year ?? 2026} Summary</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl transition-opacity hover:opacity-60" style={{ color: "#a8b5af" }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {[{ label: "Completion Rate", value: `${d?.completionRate ?? 94}%` }, { label: "Best Streak", value: `${d?.streak ?? 42}d` }].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: "#f9fbfa", border: "1.5px solid rgba(0,0,0,0.07)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>{s.label}</p>
              <p className="font-headline font-bold text-2xl" style={{ color: "#1a1f1e" }}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-4 mb-5 flex gap-2" style={{ background: "rgba(0,108,74,0.06)", border: "1.5px solid rgba(0,108,74,0.12)" }}>
          <span className="material-symbols-outlined text-[18px] flex-shrink-0" style={{ color: "#006c4a" }}>auto_awesome</span>
          <p className="text-xs leading-relaxed" style={{ color: "#4a5c54" }}>
            Top pillar: <strong>{d?.topPillar ?? "Career"}</strong>. Your execution velocity peaked in Q3. View the full report for AI master review and Hall of Fame highlights.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-bold transition-opacity hover:opacity-70" style={{ border: "1.5px solid rgba(0,0,0,0.1)", color: "#6b7c75" }}>Close</button>
          <a href={`/dashboard/reports/${d?.year ?? 2026}`} className="flex-1 py-3 rounded-2xl text-sm font-bold text-white text-center transition-opacity hover:opacity-80" style={{ background: "#006c4a" }}>
            Full Report
          </a>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
export function ReportModal({ open, onClose, type, data }: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  switch (type) {
    case "daily-report":
      return <DayRecapModal onClose={onClose} />;
    case "weekly-report":
      return <WeeklyReportModal onClose={onClose} />;
    case "monthly-report":
      return <MonthlyInsightModal onClose={onClose} data={data} />;
    case "yearly-report":
      return <YearlyReportModal onClose={onClose} data={data} />;
    default:
      return null;
  }
}
