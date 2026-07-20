"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/lib/store";
import type { DashboardRecapEntry } from "@/lib/types";

interface NotificationItem {
  id: string;
  icon: string;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
}

function recapKey(entry: DashboardRecapEntry) {
  return [
    entry.type,
    entry.periodYear,
    entry.periodQuarter ?? "",
    entry.periodMonth ?? "",
    entry.periodWeek ?? "",
  ].join(":");
}

function recapLabel(entry: DashboardRecapEntry) {
  if (entry.type === "weekly") return `Week ${entry.periodWeek} review`;
  if (entry.type === "monthly") {
    const month = entry.periodMonth ?? 1;
    return new Date(Date.UTC(entry.periodYear, month - 1, 1)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (entry.type === "quarterly") return `Q${entry.periodQuarter} ${entry.periodYear}`;
  return `${entry.periodYear} review`;
}

function recapDetail(entry: DashboardRecapEntry) {
  if (entry.type === "weekly") {
    return `${recapLabel(entry)} is ready. Lock the reflection and shape the next week while the signal is still fresh.`;
  }
  if (entry.type === "monthly") {
    return `${recapLabel(entry)} is waiting for review. Close the month cleanly before the next one drifts.`;
  }
  if (entry.type === "quarterly") {
    return `${recapLabel(entry)} is ready for review. Use the saved monthly evidence to define the next quarter clearly.`;
  }
  return `${recapLabel(entry)} is ready for review. Capture what held and what needs to change before the new year moves on.`;
}

function buildRecapNotification(entry: DashboardRecapEntry): NotificationItem {
  return {
    id: `recap:${recapKey(entry)}`,
    icon: entry.type === "weekly" ? "calendar_view_week" : entry.type === "monthly" ? "calendar_month" : entry.type === "quarterly" ? "query_stats" : "history",
    eyebrow: "Review ready",
    title:
      entry.type === "weekly"
        ? "Weekly review ready"
        : entry.type === "monthly"
          ? "Monthly review ready"
          : entry.type === "quarterly"
            ? "Quarterly review ready"
            : "Yearly review ready",
    detail: recapDetail(entry),
    href: `/dashboard?recap=${encodeURIComponent(recapKey(entry))}`,
    actionLabel: "Open review",
  };
}

export function NotificationCenter() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const {
    activeDashboardDate,
    dailyPriorities,
    secondaryTasks,
    habits,
    metrics,
    pendingRecaps,
  } = useAppStore(
    useShallow((state) => ({
      activeDashboardDate: state.activeDashboardDate,
      dailyPriorities: state.dailyPriorities,
      secondaryTasks: state.secondaryTasks,
      habits: state.habits,
      metrics: state.metrics,
      pendingRecaps: state.pendingRecaps,
    })),
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];
    const todayMainGoals = dailyPriorities.filter((item) => item.date === activeDashboardDate);
    const todayTasks = secondaryTasks.filter((item) => item.date === activeDashboardDate);
    const activeHabits = habits.filter((habit) => habit.active);
    const totalTracked = todayMainGoals.length + todayTasks.length + activeHabits.length;
    const completedTracked =
      todayMainGoals.filter((item) => item.completed).length +
      todayTasks.filter((item) => item.completed).length +
      activeHabits.filter((habit) => habit.completedToday).length;
    const unfinishedTracked = Math.max(0, totalTracked - completedTracked);
    const afterEveningReview = now.getHours() >= 18;

    if (todayMainGoals.length === 0) {
      items.push({
        id: `today:missing-main:${activeDashboardDate}`,
        icon: "target",
        eyebrow: "Today needs a lead",
        title: "Set today's main goal",
        detail: "The day does not have a main goal yet. Pick the one thing today should actually move.",
        href: "/dashboard",
        actionLabel: "Open home",
      });
    } else if (!afterEveningReview && completedTracked === 0) {
      items.push({
        id: `today:start:${activeDashboardDate}`,
        icon: "play_circle",
        eyebrow: "Start the day",
        title: "Begin today's execution",
        detail:
          metrics.yesterdayCompletion === 0
            ? "Yesterday slipped. Reset cleanly today and get the first completion on the board."
            : "Your plan is in place, but nothing has been completed yet today.",
        href: "/dashboard",
        actionLabel: "Resume home",
      });
    } else if (afterEveningReview && unfinishedTracked > 0) {
      items.push({
        id: `today:closeout:${activeDashboardDate}`,
        icon: "bedtime",
        eyebrow: "Close the day",
        title: "Review what did and did not move",
        detail:
          unfinishedTracked === totalTracked
            ? "Nothing has been completed yet today. Use the evening review to capture what blocked the day and reset tomorrow."
            : `${unfinishedTracked} tracked item${unfinishedTracked === 1 ? "" : "s"} still need attention before the day closes.`,
        href: "/dashboard",
        actionLabel: "Open review",
      });
    }

    return [
      ...pendingRecaps.map(buildRecapNotification),
      ...items,
    ];
  }, [activeDashboardDate, dailyPriorities, habits, metrics.yesterdayCompletion, now, pendingRecaps, secondaryTasks]);

  const unreadCount = notifications.length;

  function openNotification(item: NotificationItem) {
    setOpen(false);
    router.push(item.href);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="interactive-icon-button relative flex h-9 w-9 items-center justify-center rounded-full"
        style={{ color: "#8a9e97" }}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full px-1 py-0.5 text-[10px] font-bold leading-none text-white"
            style={{ background: "#006c4a" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-[360px] overflow-hidden rounded-[24px] bg-white shadow-lg"
          style={{ border: "1px solid rgba(0,0,0,0.08)" }}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            <div>
              <p className="text-sm font-bold" style={{ color: "#1a1f1e" }}>
                Notifications
              </p>
              <p className="text-[11px]" style={{ color: "#8a9e97" }}>
                {unreadCount === 0 ? "You are caught up." : `${unreadCount} item${unreadCount === 1 ? "" : "s"} need attention.`}
              </p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6">
              <div
                className="rounded-2xl p-4"
                style={{ background: "#f7faf8", border: "1px solid rgba(0,0,0,0.06)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                  Nothing urgent right now
                </p>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  When a review is due or today needs attention, it will appear here with a direct path back into the right flow.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className="w-full rounded-2xl p-4 text-left transition-opacity hover:opacity-85"
                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: "rgba(0,108,74,0.08)", color: "#006c4a" }}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        {item.eyebrow}
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {item.title}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5d6d67" }}>
                        {item.detail}
                      </p>
                      <p className="mt-3 text-xs font-bold" style={{ color: "#006c4a" }}>
                        {item.actionLabel}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
