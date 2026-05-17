"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import {
  activityApi,
  ApiActivityOverview,
  ApiActivityWorkspaceSummary,
  ApiAdminActivityOverview,
} from "@/lib/api";

const DAY_RANGE_OPTIONS = [14, 30] as const;

function formatDateLabel(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeLabel(isoDateTime?: string) {
  if (!isoDateTime) return "Not seen yet";
  return new Date(isoDateTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stageMeta(
  stage: ApiActivityOverview["current_stage"] | ApiActivityWorkspaceSummary["current_stage"],
) {
  switch (stage) {
    case "executing":
      return { label: "Executing", tone: "#006c4a", bg: "rgba(0,108,74,0.10)" };
    case "reviewing":
      return { label: "Reviewing", tone: "#155eef", bg: "rgba(21,94,239,0.10)" };
    case "daily_planning":
      return { label: "Daily Planning", tone: "#b54708", bg: "rgba(181,71,8,0.10)" };
    case "planning_foundation":
      return { label: "Planning Foundation", tone: "#6941c6", bg: "rgba(105,65,198,0.10)" };
    case "inactive":
      return { label: "Inactive", tone: "#b42318", bg: "rgba(180,35,24,0.10)" };
    default:
      return { label: "Onboarding", tone: "#667085", bg: "rgba(102,112,133,0.10)" };
  }
}

function buildRecentCalendar(days: number, rows: ApiActivityOverview["recent_days"]) {
  const byDate = new Map(rows.map((row) => [row.activity_date, row]));
  const today = new Date();
  const calendar: Array<{ date: string; row: ApiActivityOverview["recent_days"][number] | null }> = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const iso = day.toISOString().slice(0, 10);
    calendar.push({ date: iso, row: byDate.get(iso) ?? null });
  }

  return calendar;
}

function summarizeDay(row: ApiActivityOverview["recent_days"][number] | null) {
  if (!row) {
    return {
      label: "Absent",
      detail: "No activity row was recorded for this day.",
      accent: "#b42318",
      bg: "rgba(180,35,24,0.08)",
      border: "rgba(180,35,24,0.16)",
    };
  }
  if (row.approved_next_day_review || row.handled_recap) {
    return {
      label: "Review",
      detail: "The user closed a feedback loop or approved the next-day setup.",
      accent: "#155eef",
      bg: "rgba(21,94,239,0.08)",
      border: "rgba(21,94,239,0.16)",
    };
  }
  if (row.completed_tasks_count > 0 || row.completed_habits_count > 0) {
    return {
      label: "Execution",
      detail: `Completed ${row.completed_tasks_count} task(s) and ${row.completed_habits_count} habit(s).`,
      accent: "#006c4a",
      bg: "rgba(0,108,74,0.08)",
      border: "rgba(0,108,74,0.14)",
    };
  }
  if (row.created_daily_plan || row.created_weekly_goal || row.created_monthly_goal || row.created_yearly_goal) {
    return {
      label: "Planning",
      detail: "A planning layer was created or updated on this day.",
      accent: "#b54708",
      bg: "rgba(181,71,8,0.08)",
      border: "rgba(181,71,8,0.16)",
    };
  }
  return {
    label: "Visited",
    detail: "The app was opened, but there was no strong execution signal.",
    accent: "#667085",
    bg: "rgba(102,112,133,0.08)",
    border: "rgba(102,112,133,0.16)",
  };
}

function workspaceLabel(workspace: ApiActivityWorkspaceSummary) {
  if (workspace.auth_user_id?.startsWith("user-test-")) {
    return workspace.auth_user_id.replace("user-test-", "").replace(/-/g, " ");
  }
  if (workspace.auth_user_id?.startsWith("user-")) {
    return workspace.auth_user_id.replace("user-", "").replace(/-/g, " ");
  }
  if (workspace.device_hint) return workspace.device_hint;
  if (workspace.auth_user_id) return workspace.auth_user_id.slice(0, 12);
  return workspace.session_id.slice(0, 8);
}

function DetailPanel({
  overview,
  range,
  title,
  subtitle,
}: {
  overview: ApiActivityOverview | null;
  range: number;
  title: string;
  subtitle: string;
}) {
  const stage = overview ? stageMeta(overview.current_stage) : null;
  const recentCalendar = useMemo(
    () => buildRecentCalendar(range, overview?.recent_days ?? []),
    [overview?.recent_days, range],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayRow = overview?.recent_days.find((row) => row.activity_date === todayIso) ?? null;

  return (
    <div className="space-y-6">
      <section
        className="rounded-[28px] p-5 sm:p-6"
        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Workspace Detail
            </p>
            <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
              {subtitle}
            </p>
          </div>
          {stage && (
            <span
              className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] self-start"
              style={{ color: stage.tone, background: stage.bg }}
            >
              {stage.label}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] p-4" style={{ background: "#f8faf9" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Last seen</p>
            <p className="mt-2 text-lg font-bold" style={{ color: "#1a1f1e" }}>{formatDateTimeLabel(overview?.last_seen_at)}</p>
          </div>
          <div className="rounded-[22px] p-4" style={{ background: "#f8faf9" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Last active</p>
            <p className="mt-2 text-lg font-bold" style={{ color: "#1a1f1e" }}>{formatDateTimeLabel(overview?.last_active_at)}</p>
          </div>
          <div className="rounded-[22px] p-4" style={{ background: "#f8faf9" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Today&apos;s output</p>
            <p className="mt-2 text-lg font-bold" style={{ color: "#1a1f1e" }}>
              {todayRow ? `${todayRow.completed_tasks_count} tasks / ${todayRow.completed_habits_count} habits` : "No signal yet"}
            </p>
          </div>
          <div className="rounded-[22px] p-4" style={{ background: "#f8faf9" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Onboarding proof</p>
            <p className="mt-2 text-lg font-bold" style={{ color: "#1a1f1e" }}>
              {overview?.onboarding_evidence.complete ? "Complete" : "Incomplete"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.45fr]">
        <div
          className="rounded-[28px] p-5 sm:p-6 space-y-4"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Integrity Checklist
            </p>
            <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
              Setup proof
            </h3>
          </div>

          {[
            { label: "Yearly goal exists", done: Boolean(overview?.onboarding_evidence.has_yearly_goals) },
            { label: "Monthly goal exists", done: Boolean(overview?.onboarding_evidence.has_monthly_goals) },
            { label: "Weekly goal exists", done: Boolean(overview?.onboarding_evidence.has_weekly_goals) },
            { label: "Daily plan exists", done: Boolean(overview?.onboarding_evidence.has_daily_plan) },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: item.done ? "rgba(0,108,74,0.06)" : "rgba(180,35,24,0.06)" }}
            >
              <span className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>{item.label}</span>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: item.done ? "rgba(0,108,74,0.12)" : "rgba(180,35,24,0.12)",
                  color: item.done ? "#006c4a" : "#b42318",
                }}
              >
                {item.done ? "Yes" : "No"}
              </span>
            </div>
          ))}
        </div>

        <div
          className="rounded-[28px] p-5 sm:p-6"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                Daily Ledger
              </p>
              <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                Show-up history
              </h3>
            </div>
            <p className="text-sm" style={{ color: "#6b7c75" }}>
              Missing rows mean the user did not come in that day.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {recentCalendar.map(({ date, row }) => {
              const summary = summarizeDay(row);
              return (
                <div
                  key={date}
                  className="rounded-[24px] p-4"
                  style={{
                    background: summary.bg,
                    border: `1px solid ${summary.border}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                        {date}
                      </p>
                      <h4 className="mt-1 text-base font-bold" style={{ color: "#1a1f1e" }}>
                        {formatDateLabel(date)}
                      </h4>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ background: "#fff", color: summary.accent }}
                    >
                      {summary.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "#50615b" }}>
                    {summary.detail}
                  </p>

                  {row && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.68)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          Tasks / habits
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {row.completed_tasks_count} / {row.completed_habits_count}
                        </p>
                      </div>
                      <div className="rounded-2xl px-3 py-2" style={{ background: "rgba(255,255,255,0.68)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          Planning
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {row.created_daily_plan || row.created_weekly_goal || row.created_monthly_goal || row.created_yearly_goal ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function WorkspaceList({
  overview,
  selectedSessionId,
  onSelect,
}: {
  overview: ApiAdminActivityOverview;
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return overview.workspaces;
    return overview.workspaces.filter((workspace) =>
      [
        workspace.auth_user_id,
        workspace.device_hint,
        workspace.session_id,
        workspaceLabel(workspace),
        workspace.timezone,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [deferredQuery, overview.workspaces]);

  return (
    <section
      className="rounded-[28px] p-5 sm:p-6 space-y-5"
      style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
            Workspace Directory
          </p>
          <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            All tracked users
          </h2>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search auth id, label, timezone..."
          className="w-full lg:w-72 rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ background: "#f8faf9", border: "1px solid rgba(0,0,0,0.08)", color: "#1a1f1e" }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Workspaces", value: overview.total_workspaces, tone: "#1a1f1e" },
          { label: "Active today", value: overview.active_today, tone: "#006c4a" },
          { label: "Executing now", value: overview.executing_now, tone: "#006c4a" },
          { label: "Reviewing now", value: overview.reviewing_now, tone: "#155eef" },
          { label: "Inactive", value: overview.inactive, tone: "#b42318" },
          { label: "Onboarding incomplete", value: overview.onboarding_incomplete, tone: "#b54708" },
        ].map((card) => (
          <div key={card.label} className="rounded-[22px] p-4" style={{ background: "#f8faf9" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>{card.label}</p>
            <p className="mt-2 font-headline text-3xl font-extrabold tracking-tight" style={{ color: card.tone }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((workspace) => {
          const stage = stageMeta(workspace.current_stage);
          const selected = workspace.session_id === selectedSessionId;
          return (
            <button
              key={workspace.session_id}
              type="button"
              onClick={() => onSelect(workspace.session_id)}
              className="rounded-[24px] p-4 text-left transition-transform hover:-translate-y-0.5"
              style={{
                background: selected ? "rgba(0,108,74,0.08)" : "#fcfdfc",
                border: selected ? "1px solid rgba(0,108,74,0.22)" : "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold capitalize" style={{ color: "#1a1f1e" }}>
                      {workspaceLabel(workspace)}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "#6b7c75" }}>
                    {workspace.auth_user_id || workspace.session_id}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ background: stage.bg, color: stage.tone }}
                >
                  {stage.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Last seen</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                    {formatDateTimeLabel(workspace.last_seen_at)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Activity window</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                    {workspace.active_days_in_range} active / {workspace.absent_days_in_range} absent
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Tasks / habits</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                    {workspace.tasks_completed_in_range} / {workspace.habits_completed_in_range}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>Onboarding proof</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: workspace.onboarding_evidence_complete ? "#006c4a" : "#b42318" }}>
                    {workspace.onboarding_evidence_complete ? "Complete" : "Missing setup"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminPage() {
  const [range, setRange] = useState<(typeof DAY_RANGE_OPTIONS)[number]>(14);
  const [overview, setOverview] = useState<ApiAdminActivityOverview | null>(null);
  const [detailOverview, setDetailOverview] = useState<ApiActivityOverview | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    activityApi
      .getAdminOverview(range)
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        const nextSelected = data.workspaces[0]?.session_id ?? null;
        setSelectedSessionId((current) =>
          current && data.workspaces.some((workspace) => workspace.session_id === current)
            ? current
            : nextSelected,
        );
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load admin dashboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  useEffect(() => {
    if (!selectedSessionId) return;
    let cancelled = false;

    activityApi
      .getOverview(selectedSessionId, range)
      .then((data) => {
        if (!cancelled) setDetailOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load workspace detail.");
      });

    return () => {
      cancelled = true;
    };
  }, [range, selectedSessionId]);

  const refresh = () => {
    startRefresh(async () => {
      try {
        const admin = await activityApi.getAdminOverview(range);
        setOverview(admin);
        const targetSessionId =
          selectedSessionId && admin.workspaces.some((workspace) => workspace.session_id === selectedSessionId)
            ? selectedSessionId
            : admin.workspaces[0]?.session_id ?? null;
        setSelectedSessionId(targetSessionId);
        if (targetSessionId) {
          const detail = await activityApi.getOverview(targetSessionId, range);
          setDetailOverview(detail);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not refresh admin dashboard.");
      }
    });
  };

  const selectedWorkspace = useMemo(
    () => overview?.workspaces.find((workspace) => workspace.session_id === selectedSessionId) ?? null,
    [overview?.workspaces, selectedSessionId],
  );

  return (
    <div className="w-full max-w-[1500px] mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <section
        className="rounded-[32px] p-6 sm:p-8"
        style={{
          background: "linear-gradient(135deg, #0f2a1f 0%, #12392a 58%, #f4fbf7 58%, #f9fcfa 100%)",
          boxShadow: "0 28px 60px rgba(18,57,42,0.16)",
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.95fr] lg:items-end">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "rgba(133,248,196,0.72)" }}>
                Internal Admin
              </p>
              <h1 className="mt-2 font-headline text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                Execution AI activity board.
              </h1>
              <p className="mt-4 max-w-2xl text-sm sm:text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.74)" }}>
                A lean internal URL for checking who is using the app, when they last showed up, what stage they reached, and where activity starts to drop.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {DAY_RANGE_OPTIONS.map((option) => {
                const active = option === range;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors"
                    style={{
                      background: active ? "#85f8c4" : "rgba(255,255,255,0.08)",
                      color: active ? "#0f2a1f" : "rgba(255,255,255,0.74)",
                    }}
                  >
                    Last {option} days
                  </button>
                );
              })}
              <button
                type="button"
                onClick={refresh}
                className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.74)" }}
              >
                {isRefreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>

          <div
            className="rounded-[28px] p-5 sm:p-6"
            style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.5)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Selected Workspace
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                  {selectedWorkspace ? workspaceLabel(selectedWorkspace) : "No workspace"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
                  {selectedWorkspace?.auth_user_id || selectedWorkspace?.session_id || "Once activity exists, workspaces appear here automatically."}
                </p>
              </div>
              {selectedWorkspace && (
                <span
                  className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{
                    color: stageMeta(selectedWorkspace.current_stage).tone,
                    background: stageMeta(selectedWorkspace.current_stage).bg,
                  }}
                >
                  {stageMeta(selectedWorkspace.current_stage).label}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ background: "rgba(180,35,24,0.08)", border: "1px solid rgba(180,35,24,0.18)", color: "#b42318" }}
        >
          {error}
        </div>
      )}

      {loading && !overview ? (
        <section
          className="rounded-[28px] p-6"
          style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <p className="text-sm" style={{ color: "#6b7c75" }}>Loading admin dashboard...</p>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.98fr_1.32fr]">
          {overview ? (
            <WorkspaceList
              overview={overview}
              selectedSessionId={selectedSessionId}
              onSelect={setSelectedSessionId}
            />
          ) : (
            <section
              className="rounded-[28px] p-6"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <p className="text-sm" style={{ color: "#6b7c75" }}>No overview data available yet.</p>
            </section>
          )}

          <DetailPanel
            overview={detailOverview}
            range={range}
            title={selectedWorkspace ? workspaceLabel(selectedWorkspace) : "Workspace detail"}
            subtitle={
              selectedWorkspace
                ? `${selectedWorkspace.auth_user_id || selectedWorkspace.session_id} · ${selectedWorkspace.timezone}`
                : "Select a workspace to inspect its day-by-day usage history."
            }
          />
        </div>
      )}
    </div>
  );
}
