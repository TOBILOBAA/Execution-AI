"use client";

import { DailyPriority, FoundationalHabit } from "@/lib/types";

interface Props {
  priorities: DailyPriority[];
  tasks: DailyPriority[];
  habits: FoundationalHabit[];
  onBegin: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMins(mins?: number) {
  if (!mins) return null;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} mins`;
}

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  "3x_week": "3× Week",
  "5x_week": "5× Week",
  weekends: "Weekends",
};

function ordinal(n: number) {
  return String(n).padStart(2, "0");
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="material-symbols-outlined text-[14px]" style={{ color: "#a8b5af" }}>
        {icon}
      </span>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#8a9e97" }}>
        {label}
      </p>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function DailyKickoffModal({ priorities, tasks, habits, onBegin }: Props) {
  const activeHabits = habits.filter((h) => h.active).slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="bg-white w-full max-w-[520px] rounded-3xl shadow-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* ── Top accent strip ── */}
        <div className="h-1 w-full" style={{ background: "#006c4a" }} />

        <div className="px-8 pt-8 pb-0">
          {/* ── Header ── */}
          <div className="flex items-start gap-4 mb-7">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,108,74,0.1)" }}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ color: "#006c4a" }}>
                rocket_launch
              </span>
            </div>
            <div>
              <h2
                className="font-headline text-2xl font-extrabold leading-tight"
                style={{ color: "#1a1f1e" }}
              >
                All Set — Begin Executing
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "#8a9e97" }}>
                Here&apos;s everything you need to do today. Stay locked in.
              </p>
            </div>
          </div>

          {/* ── Essential Priorities ── */}
          {priorities.length > 0 && (
            <div className="mb-6">
              <SectionLabel icon="star" label="Essential Priorities" />
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(0,0,0,0.07)" }}
              >
                {priorities.map((p, idx) => {
                  const time = formatMins(p.estimatedMinutes);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        borderBottom:
                          idx < priorities.length - 1
                            ? "1px solid rgba(0,0,0,0.05)"
                            : "none",
                      }}
                    >
                      <span
                        className="text-[12px] font-bold tabular-nums flex-shrink-0 w-5"
                        style={{ color: "#c4d0cb" }}
                      >
                        {ordinal(idx + 1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold leading-snug truncate"
                          style={{ color: "#1a1f1e" }}
                        >
                          {p.title}
                        </p>
                        {(time || p.tag) && (
                          <p className="text-[11px] mt-0.5" style={{ color: "#a8b5af" }}>
                            {time}{time && p.tag && " • "}{p.tag}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Supporting Priorities ── */}
          {tasks.length > 0 && (
            <div className="mb-6">
              <SectionLabel icon="checklist" label="Supporting Priorities" />
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(0,0,0,0.07)" }}
              >
                {tasks.map((t, idx) => {
                  const time = formatMins(t.estimatedMinutes);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        borderBottom:
                          idx < tasks.length - 1
                            ? "1px solid rgba(0,0,0,0.05)"
                            : "none",
                      }}
                    >
                      <span
                        className="text-[12px] font-bold tabular-nums flex-shrink-0 w-5"
                        style={{ color: "#c4d0cb" }}
                      >
                        {ordinal(idx + 1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium leading-snug truncate"
                          style={{ color: "#1a1f1e" }}
                        >
                          {t.title}
                        </p>
                        {(time || t.tag) && (
                          <p className="text-[11px] mt-0.5" style={{ color: "#a8b5af" }}>
                            {time}{time && t.tag && " • "}{t.tag}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Foundational Habits ── */}
          {activeHabits.length > 0 && (
            <div className="mb-7">
              <SectionLabel icon="self_improvement" label="Foundational Habits" />
              <div className="flex flex-wrap gap-2">
                {activeHabits.map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: "rgba(0,108,74,0.06)",
                      border: "1px solid rgba(0,108,74,0.12)",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[15px]"
                      style={{ color: "#006c4a" }}
                    >
                      {habit.icon}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>
                      {habit.name}
                    </span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "#a8b5af" }}
                    >
                      {FREQ_LABEL[habit.frequency] ?? habit.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="px-8 py-5 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: "#a8b5af" }}>
            Your plan is locked in and synced to your dashboard.
          </p>
          <button
            onClick={onBegin}
            className="flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#006c4a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#003d2b")}
          >
            Begin Executing
            <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
          </button>
        </div>
      </div>
    </div>
  );
}
