"use client";

import { DailyPriority, FoundationalHabit } from "@/lib/types";

interface Props {
  priorities: DailyPriority[];
  tasks: DailyPriority[];
  habits: FoundationalHabit[];
  onClose: () => void;
  /** IANA zone from browser, e.g. "America/New_York" */
  timeZoneLabel: string;
  /** Overrides the default “6:00 PM …” line (e.g. URL test mode). */
  scheduleNote?: string;
}

function formatMins(mins?: number) {
  if (!mins) return null;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins} mins`;
}

function ordinal(n: number) {
  return String(n).padStart(2, "0");
}

export function EveningReviewModal({
  priorities,
  tasks,
  habits,
  onClose,
  timeZoneLabel,
  scheduleNote,
}: Props) {
  const activeHabits = habits.filter((h) => h.active).slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evening-review-title"
    >
      <div
        className="bg-white w-full max-w-[520px] rounded-3xl shadow-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #0d4a36, #006c4a)" }} />

        <div className="px-8 pt-8 pb-0">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,108,74,0.1)" }}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ color: "#006c4a" }}>
                bedtime
              </span>
            </div>
            <div>
              <h2
                id="evening-review-title"
                className="font-headline text-2xl font-extrabold leading-tight"
                style={{ color: "#1a1f1e" }}
              >
                End of day — quick review
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "#8a9e97" }}>
                {scheduleNote ?? (
                  <>
                    It&apos;s 6:00 PM in your local time ({timeZoneLabel}). Wrap up what moved, note what didn&apos;t,
                    and you&apos;ll be set to plan tomorrow.
                  </>
                )}
              </p>
            </div>
          </div>

          {priorities.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Today&apos;s priorities
              </p>
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
                {priorities.map((p, idx) => {
                  const time = formatMins(p.estimatedMinutes);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        borderBottom:
                          idx < priorities.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                      }}
                    >
                      <span
                        className="text-[12px] font-bold tabular-nums flex-shrink-0 w-5"
                        style={{ color: "#c4d0cb" }}
                      >
                        {ordinal(idx + 1)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-snug truncate" style={{ color: "#1a1f1e" }}>
                          {p.title}
                        </p>
                        {(time || p.tag) && (
                          <p className="text-[11px] mt-0.5" style={{ color: "#a8b5af" }}>
                            {time}
                            {time && p.tag && " • "}
                            {p.tag}
                          </p>
                        )}
                      </div>
                      <span
                        className="material-symbols-outlined text-[18px] flex-shrink-0"
                        style={{ color: p.completed ? "#006c4a" : "#e2e8e4" }}
                      >
                        {p.completed ? "check_circle" : "radio_button_unchecked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Supporting tasks
              </p>
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
                {tasks.slice(0, 5).map((t, idx, arr) => {
                  const time = formatMins(t.estimatedMinutes);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{
                        borderBottom: idx < arr.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug truncate" style={{ color: "#1a1f1e" }}>
                          {t.title}
                        </p>
                        {(time || t.tag) && (
                          <p className="text-[10px] mt-0.5" style={{ color: "#a8b5af" }}>
                            {time}
                            {time && t.tag && " • "}
                            {t.tag}
                          </p>
                        )}
                      </div>
                      <span
                        className="material-symbols-outlined text-[16px] flex-shrink-0"
                        style={{ color: t.completed ? "#006c4a" : "#e2e8e4" }}
                      >
                        {t.completed ? "check_circle" : "radio_button_unchecked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeHabits.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Habits
              </p>
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
                    <span className="material-symbols-outlined text-[15px]" style={{ color: "#006c4a" }}>
                      {habit.icon}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "#1a1f1e" }}>
                      {habit.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="px-8 py-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="order-2 sm:order-1 px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
          >
            Remind me tomorrow
          </button>
          <button
            type="button"
            onClick={onClose}
            className="order-1 sm:order-2 flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white transition-all"
            style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#006c4a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#003d2b")}
          >
            Done for today
            <span className="material-symbols-outlined text-[18px]">check</span>
          </button>
        </div>
      </div>
    </div>
  );
}
