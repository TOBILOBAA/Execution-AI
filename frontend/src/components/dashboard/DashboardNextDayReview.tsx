"use client";

import { startTransition, useEffect, useState } from "react";
import { dashboardApi, type ApiNextDayReview, type ApiNextDayReviewItem } from "@/lib/api";
import { useAppStore } from "@/lib/store";

/**
 * Morning review modal.
 *
 * This opens on the next login when today does not yet have a saved plan, so
 * the user can intentionally carry forward unfinished work instead of silently
 * starting from a blank dashboard.
 */
type EditableReviewItem = ApiNextDayReviewItem & { localId: string };

function makeLocalId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function toEditable(items: ApiNextDayReviewItem[], prefix: string): EditableReviewItem[] {
  return items.map((item) => ({ ...item, localId: makeLocalId(prefix) }));
}

function ReviewListEditor({
  title,
  subtitle,
  items,
  onChange,
  addLabel,
  defaultPriority,
}: {
  title: string;
  subtitle: string;
  items: EditableReviewItem[];
  onChange: (items: EditableReviewItem[]) => void;
  addLabel: string;
  defaultPriority: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#a8b5af" }}>
        {title}
      </p>
      <p className="text-xs mb-3" style={{ color: "#7c8d87" }}>
        {subtitle}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div
            key={item.localId}
            className="rounded-2xl p-3"
            style={{ border: "1px solid rgba(0,0,0,0.08)", background: "white" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold" style={{ color: "#a8b5af" }}>
                {index + 1}.
              </span>
              <input
                value={item.title}
                onChange={(e) =>
                  onChange(items.map((row) => (row.localId === item.localId ? { ...row, title: e.target.value } : row)))
                }
                className="flex-1 text-sm font-semibold bg-transparent outline-none"
                style={{ color: "#1a1f1e" }}
                placeholder="Untitled item"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((row) => row.localId !== item.localId))}
                className="text-xs font-semibold"
                style={{ color: "#a25a5a" }}
              >
                Remove
              </button>
            </div>
            <textarea
              value={item.description ?? ""}
              onChange={(e) =>
                onChange(
                  items.map((row) =>
                    row.localId === item.localId ? { ...row, description: e.target.value || undefined } : row
                  )
                )
              }
              className="w-full text-xs rounded-xl p-2 resize-none outline-none"
              style={{ border: "1px solid rgba(0,0,0,0.06)", color: "#4f5d58", minHeight: 64 }}
              placeholder="Optional note or framing"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onChange([
            ...items,
            {
              localId: makeLocalId(title.toLowerCase()),
              title: "",
              description: "",
              priority: defaultPriority,
            },
          ])
        }
        className="mt-3 px-4 py-2 rounded-xl text-xs font-bold"
        style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function DashboardNextDayReview() {
  const sessionId = useAppStore((s) => s.sessionId);
  const kickoffPending = useAppStore((s) => s.kickoffPending);
  const loadDashboard = useAppStore((s) => s.loadDashboard);

  const [review, setReview] = useState<ApiNextDayReview | null>(null);
  const [open, setOpen] = useState(false);
  const [priorities, setPriorities] = useState<EditableReviewItem[]>([]);
  const [tasks, setTasks] = useState<EditableReviewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || kickoffPending) return;
    let cancelled = false;

    dashboardApi
      .getNextDayReview(sessionId)
      .then((data) => {
        if (cancelled) return;
        setReview(data);
        setPriorities(toEditable(data.proposal.priorities, "priority"));
        setTasks(toEditable(data.proposal.tasks, "task"));
        setOpen(data.should_open);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load next-day review");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, kickoffPending]);

  if (!open || !review) return null;

  const cleanPriorities = priorities
    .map(({ localId: _localId, ...item }) => ({ ...item, title: item.title.trim() }))
    .filter((item) => item.title.length > 0);
  const cleanTasks = tasks
    .map(({ localId: _localId, ...item }) => ({ ...item, title: item.title.trim() }))
    .filter((item) => item.title.length > 0);

  async function handleApprove() {
    if (!sessionId || !review) return;
    setSaving(true);
    setError(null);
    try {
      await dashboardApi.approveNextDayReview(sessionId, {
        date: review.today,
        priorities: cleanPriorities,
        tasks: cleanTasks,
      });
      await loadDashboard();
      startTransition(() => setOpen(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save today's plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[61] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="next-day-review-title"
    >
      <div
        className="bg-white w-full max-w-[760px] rounded-3xl shadow-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #003d2b, #006c4a)" }} />
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-start gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,108,74,0.1)" }}
            >
              <span className="material-symbols-outlined text-[24px]" style={{ color: "#006c4a" }}>
                event_available
              </span>
            </div>
            <div>
              <h2
                id="next-day-review-title"
                className="font-headline text-2xl font-extrabold leading-tight"
                style={{ color: "#1a1f1e" }}
              >
                Before you start today
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "#8a9e97" }}>
                Reviewing {review.source_date} so you can lock in {review.today} with intention, not guesswork.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Yesterday
              </p>
              <p className="text-2xl font-extrabold" style={{ color: "#1a1f1e" }}>
                {review.yesterday_summary.completion_rate}%
              </p>
              <p className="text-xs mt-1" style={{ color: "#6f817a" }}>
                overall completion
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Weekly focus
              </p>
              <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
                {review.proposal.weekly_objective ?? "No weekly objective set yet"}
              </p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#a8b5af" }}>
                Monthly context
              </p>
              <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1f1e" }}>
                {review.proposal.monthly_context ?? "No monthly context set yet"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4 mb-6" style={{ background: "rgba(0,108,74,0.06)", border: "1px solid rgba(0,108,74,0.12)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#0f766e" }}>
              Execution notes
            </p>
            <div className="flex flex-col gap-1">
              {review.insights.map((line) => (
                <p key={line} className="text-sm" style={{ color: "#1a1f1e" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          <ReviewListEditor
            title="Top priorities"
            subtitle="These are the main things to lock in for today."
            items={priorities}
            onChange={setPriorities}
            addLabel="Add priority"
            defaultPriority="high"
          />
          <ReviewListEditor
            title="Supporting tasks"
            subtitle="Optional but useful carry-forward work for today."
            items={tasks}
            onChange={setTasks}
            addLabel="Add supporting task"
            defaultPriority="medium"
          />

          {error && (
            <div className="rounded-2xl px-4 py-3 mb-4 text-sm" style={{ background: "rgba(165, 42, 42, 0.08)", color: "#8b2c2c" }}>
              {error}
            </div>
          )}
        </div>

        <div
          className="px-8 py-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3"
          style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fafbfa" }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="order-2 sm:order-1 px-5 py-3 rounded-xl text-sm font-semibold"
            style={{ border: "1.5px solid #e2e8e4", color: "#5a6b65", background: "white" }}
          >
            Close for now
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleApprove}
            className="order-1 sm:order-2 flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
            style={{ background: "#003d2b", boxShadow: "0 2px 12px rgba(0,108,74,0.25)" }}
          >
            {saving ? "Saving..." : "Approve today's plan"}
            <span className="material-symbols-outlined text-[18px]">check</span>
          </button>
        </div>
      </div>
    </div>
  );
}
