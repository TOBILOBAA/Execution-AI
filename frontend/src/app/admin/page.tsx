"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
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

function formatRelativeDays(days?: number) {
  if (days === undefined || days === null) return "No recent signal";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function stageMeta(
  stage: ApiActivityOverview["current_stage"] | ApiActivityWorkspaceSummary["current_stage"],
) {
  switch (stage) {
    case "executing":
      return {
        label: "Actively executing",
        shortLabel: "Executing",
        hint: "Completing tasks or habits right now.",
        tone: "#006c4a",
        bg: "rgba(0,108,74,0.10)",
        border: "rgba(0,108,74,0.18)",
      };
    case "reviewing":
      return {
        label: "Reviewing progress",
        shortLabel: "Reviewing",
        hint: "Closing loops with recaps or next-day review.",
        tone: "#155eef",
        bg: "rgba(21,94,239,0.10)",
        border: "rgba(21,94,239,0.16)",
      };
    case "daily_planning":
      return {
        label: "Planning daily",
        shortLabel: "Daily plan",
        hint: "Daily planning exists, but execution is still light.",
        tone: "#b54708",
        bg: "rgba(181,71,8,0.10)",
        border: "rgba(181,71,8,0.16)",
      };
    case "planning_foundation":
      return {
        label: "Foundation built",
        shortLabel: "Foundation",
        hint: "Core planning layers exist, but daily usage has not taken hold.",
        tone: "#6941c6",
        bg: "rgba(105,65,198,0.10)",
        border: "rgba(105,65,198,0.16)",
      };
    case "inactive":
      return {
        label: "Inactive now",
        shortLabel: "Inactive",
        hint: "Has not shown up recently enough to count as active.",
        tone: "#b42318",
        bg: "rgba(180,35,24,0.10)",
        border: "rgba(180,35,24,0.18)",
      };
    default:
      return {
        label: "Setup in progress",
        shortLabel: "Onboarding",
        hint: "Still moving through onboarding and required setup.",
        tone: "#667085",
        bg: "rgba(102,112,133,0.10)",
        border: "rgba(102,112,133,0.16)",
      };
  }
}

function onboardingStepMeta(
  evidence: ApiActivityOverview["onboarding_evidence"] | undefined,
  onboardingDone?: boolean,
) {
  if (!evidence) {
    return {
      label: "Unknown",
      detail: "Not enough data yet to determine where the user stopped.",
      tone: "#667085",
      bg: "rgba(102,112,133,0.10)",
    };
  }
  if (onboardingDone && evidence.complete) {
    return {
      label: "Completed onboarding",
      detail: "All required setup layers exist: yearly, monthly, weekly, and daily.",
      tone: "#006c4a",
      bg: "rgba(0,108,74,0.10)",
    };
  }
  if (!evidence.has_yearly_goals) {
    return {
      label: "Stopped at yearly setup",
      detail: "The user has not created the required yearly goal layer yet.",
      tone: "#b54708",
      bg: "rgba(181,71,8,0.10)",
    };
  }
  if (!evidence.has_monthly_goals) {
    return {
      label: "Stopped at monthly setup",
      detail: "The user got through yearly setup but did not complete the monthly layer.",
      tone: "#b54708",
      bg: "rgba(181,71,8,0.10)",
    };
  }
  if (!evidence.has_weekly_goals) {
    return {
      label: "Stopped at weekly setup",
      detail: "The user reached monthly planning but did not complete weekly setup.",
      tone: "#b54708",
      bg: "rgba(181,71,8,0.10)",
    };
  }
  if (!evidence.has_daily_plan) {
    return {
      label: "Stopped at daily setup",
      detail: "The user built the yearly, monthly, and weekly layers but did not finish daily planning.",
      tone: "#b54708",
      bg: "rgba(181,71,8,0.10)",
    };
  }
  return {
    label: "Setup complete",
    detail: "The required onboarding setup exists even if activity is still light.",
    tone: "#006c4a",
    bg: "rgba(0,108,74,0.10)",
  };
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
      bg: "rgba(180,35,24,0.06)",
      border: "rgba(180,35,24,0.14)",
    };
  }
  if (row.approved_next_day_review || row.handled_recap) {
    return {
      label: "Review",
      detail: "The user approved a review flow or handled a recap.",
      accent: "#155eef",
      bg: "rgba(21,94,239,0.06)",
      border: "rgba(21,94,239,0.14)",
    };
  }
  if (row.completed_tasks_count > 0 || row.completed_habits_count > 0) {
    return {
      label: "Execution",
      detail: `Completed ${row.completed_tasks_count} task(s) and ${row.completed_habits_count} habit(s).`,
      accent: "#006c4a",
      bg: "rgba(0,108,74,0.06)",
      border: "rgba(0,108,74,0.12)",
    };
  }
  if (row.created_daily_plan || row.created_weekly_goal || row.created_monthly_goal || row.created_yearly_goal) {
    return {
      label: "Planning",
      detail: "Created or updated a planning layer.",
      accent: "#b54708",
      bg: "rgba(181,71,8,0.06)",
      border: "rgba(181,71,8,0.14)",
    };
  }
  return {
    label: "Visited",
    detail: "Opened the app, but there was no strong execution signal.",
    accent: "#667085",
    bg: "rgba(102,112,133,0.06)",
    border: "rgba(102,112,133,0.14)",
  };
}

function workspaceDisplayName(workspace: Pick<ApiActivityWorkspaceSummary, "auth_name" | "auth_email" | "device_hint" | "auth_user_id" | "session_id">) {
  const name = workspace.auth_name?.trim();
  if (name) return name;
  const email = workspace.auth_email?.trim();
  if (email) return email.split("@")[0];
  if (workspace.device_hint) return workspace.device_hint;
  if (workspace.auth_user_id?.startsWith("user-test-")) {
    return workspace.auth_user_id.replace("user-test-", "").replace(/-/g, " ");
  }
  if (workspace.auth_user_id?.startsWith("user-")) {
    return workspace.auth_user_id.replace("user-", "").replace(/-/g, " ");
  }
  if (workspace.auth_user_id) return workspace.auth_user_id.slice(0, 12);
  return workspace.session_id.slice(0, 8);
}

function workspaceSecondaryLine(
  workspace: Pick<ApiActivityWorkspaceSummary, "auth_email" | "auth_user_id" | "session_id" | "timezone">,
) {
  return workspace.auth_email || workspace.auth_user_id || `${workspace.session_id} · ${workspace.timezone}`;
}

function OverviewCards({ overview }: { overview: ApiAdminActivityOverview }) {
  const cards = [
    {
      label: "Auth signups",
      value: overview.total_users,
      tone: "#1a1f1e",
      note: "Real users from Supabase Auth",
    },
    {
      label: "Tracked in app",
      value: overview.total_signed_up,
      tone: "#155eef",
      note: "Auth users who have actually created a workspace",
    },
    {
      label: "Completed onboarding",
      value: overview.completed_onboarding,
      tone: "#006c4a",
      note: "Finished onboarding with setup proof",
    },
    {
      label: "Onboarding incomplete",
      value: overview.onboarding_incomplete,
      tone: "#b54708",
      note: "Still missing required setup layers",
    },
    {
      label: "Active today",
      value: overview.active_today,
      tone: "#006c4a",
      note: "Opened the app on the current local day",
    },
    {
      label: "Dropped recently",
      value: overview.dropped_recently,
      tone: "#b42318",
      note: "No recent show-up signal",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-[24px] border p-4 sm:p-5"
          style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
            {card.label}
          </p>
          <p className="mt-3 font-headline text-3xl font-extrabold tracking-tight" style={{ color: card.tone }}>
            {card.value}
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6b7c75" }}>
            {card.note}
          </p>
        </div>
      ))}
    </section>
  );
}

function StageGuide() {
  const stages: ApiActivityOverview["current_stage"][] = [
    "onboarding",
    "planning_foundation",
    "daily_planning",
    "executing",
    "reviewing",
    "inactive",
  ];

  return (
    <section
      className="rounded-[28px] border p-5 sm:p-6"
      style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
    >
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
          Stage Guide
        </p>
        <h2 className="font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
          What the tags mean
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
          These labels show the stage each user has reached in the product journey.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {stages.map((stageKey) => {
          const stage = stageMeta(stageKey);
          return (
            <div
              key={stageKey}
              className="rounded-[22px] border p-4"
              style={{ background: stage.bg, borderColor: stage.border }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ background: "#fff", color: stage.tone }}
                >
                  {stage.shortLabel}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                {stage.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "#50615b" }}>
                {stage.hint}
              </p>
            </div>
          );
        })}
      </div>
    </section>
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
        workspace.auth_name,
        workspace.auth_email,
        workspace.auth_user_id,
        workspace.device_hint,
        workspace.session_id,
        workspace.timezone,
        stageMeta(workspace.current_stage).label,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [deferredQuery, overview.workspaces]);

  return (
    <section
      className="rounded-[28px] border p-5 sm:p-6"
      style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
            User Directory
          </p>
          <h2 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
            Everyone using the app
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
            Search by name, email, stage, id, or timezone.
          </p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, stage..."
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none lg:max-w-sm"
          style={{ background: "#f8faf9", border: "1px solid rgba(10,22,18,0.08)", color: "#1a1f1e" }}
        />
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 ? (
          <div
            className="rounded-[22px] border border-dashed px-4 py-8 text-sm"
            style={{ borderColor: "rgba(10,22,18,0.12)", color: "#6b7c75", background: "#fdfefd" }}
          >
            No users match this search yet.
          </div>
        ) : (
          filtered.map((workspace) => {
            const stage = stageMeta(workspace.current_stage);
            const selected = workspace.session_id === selectedSessionId;
            const activeToday = workspace.days_since_last_seen === 0;
            const onboardingLabel = workspace.onboarding_evidence_complete ? "Completed" : "Needs setup";
            return (
              <button
                key={workspace.session_id}
                type="button"
                onClick={() => onSelect(workspace.session_id)}
                className="w-full rounded-[24px] border p-4 text-left transition-transform hover:-translate-y-0.5"
                style={{
                  background: selected ? "rgba(0,108,74,0.06)" : "#fcfdfc",
                  borderColor: selected ? "rgba(0,108,74,0.20)" : "rgba(10,22,18,0.08)",
                }}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-bold" style={{ color: "#1a1f1e" }}>
                        {workspaceDisplayName(workspace)}
                      </h3>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                        style={{ background: stage.bg, color: stage.tone }}
                      >
                        {stage.shortLabel}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm" style={{ color: "#50615b" }}>
                      {workspaceSecondaryLine(workspace)}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "#8a9e97" }}>
                      {stage.hint}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px] xl:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Last seen
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {formatRelativeDays(workspace.days_since_last_seen)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Onboarding
                      </p>
                      <p
                        className="mt-1 text-sm font-semibold"
                        style={{ color: workspace.onboarding_evidence_complete ? "#006c4a" : "#b54708" }}
                      >
                        {onboardingLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Active today
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: activeToday ? "#006c4a" : "#1a1f1e" }}>
                        {activeToday ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Tasks done
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {workspace.tasks_completed_in_range}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Habits done
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {workspace.habits_completed_in_range}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                        Range
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                        {workspace.active_days_in_range} active
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function DetailPanel({
  overview,
  selectedWorkspace,
  range,
}: {
  overview: ApiActivityOverview | null;
  selectedWorkspace: ApiActivityWorkspaceSummary | null;
  range: number;
}) {
  const stage = overview ? stageMeta(overview.current_stage) : null;
  const onboardingStep = onboardingStepMeta(
    overview?.onboarding_evidence,
    selectedWorkspace?.onboarding_done,
  );
  const recentCalendar = useMemo(
    () => buildRecentCalendar(range, overview?.recent_days ?? []),
    [overview?.recent_days, range],
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayRow = overview?.recent_days.find((row) => row.activity_date === todayIso) ?? null;

  const title =
    selectedWorkspace
      ? workspaceDisplayName(selectedWorkspace)
      : "Select a user";
  const subtitle =
    selectedWorkspace
      ? workspaceSecondaryLine(selectedWorkspace)
      : "Choose a user from the directory to inspect their activity timeline.";

  return (
    <div className="space-y-6">
      <section
        className="rounded-[28px] border p-5 sm:p-6"
        style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Selected User
            </p>
            <h2 className="mt-2 truncate font-headline text-3xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
              {title}
            </h2>
            <p className="mt-2 break-all text-sm leading-relaxed" style={{ color: "#50615b" }}>
              {subtitle}
            </p>
            {selectedWorkspace?.auth_user_id && (
              <p className="mt-2 text-xs" style={{ color: "#8a9e97" }}>
                Auth user id: {selectedWorkspace.auth_user_id}
              </p>
            )}
          </div>
          {stage && (
            <div
              className="rounded-[22px] border px-4 py-3"
              style={{ background: stage.bg, borderColor: stage.border }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: stage.tone }}>
                Current stage
              </p>
              <p className="mt-1 text-base font-bold" style={{ color: "#1a1f1e" }}>
                {stage.label}
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "#50615b" }}>
                {stage.hint}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Last seen", value: formatDateTimeLabel(overview?.last_seen_at), tone: "#1a1f1e" },
            { label: "Last active", value: formatDateTimeLabel(overview?.last_active_at), tone: "#1a1f1e" },
            {
              label: "Today",
              value: todayRow ? `${todayRow.completed_tasks_count} tasks · ${todayRow.completed_habits_count} habits` : "No signal yet",
              tone: todayRow ? "#006c4a" : "#1a1f1e",
            },
            {
              label: "Onboarding stage",
              value: onboardingStep.label,
              tone: onboardingStep.tone,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-[22px] p-4" style={{ background: "#f8faf9" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                {item.label}
              </p>
              <p className="mt-2 text-base font-bold leading-snug" style={{ color: item.tone }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[0.82fr_1.28fr]">
        <div
          className="rounded-[28px] border p-5 sm:p-6"
          style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
              Setup Proof
            </p>
            <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
              Required onboarding layers
            </h3>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
              This lets you verify whether the user truly completed the foundation, not just whether a flag was set.
            </p>
          </div>

          <div
            className="mt-5 rounded-[22px] px-4 py-4"
            style={{ background: onboardingStep.bg }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
              Onboarding stop point
            </p>
            <p className="mt-2 text-base font-bold" style={{ color: "#1a1f1e" }}>
              {onboardingStep.label}
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "#50615b" }}>
              {onboardingStep.detail}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {[
              { label: "Yearly goals", done: Boolean(overview?.onboarding_evidence.has_yearly_goals) },
              { label: "Monthly goals", done: Boolean(overview?.onboarding_evidence.has_monthly_goals) },
              { label: "Weekly goals", done: Boolean(overview?.onboarding_evidence.has_weekly_goals) },
              { label: "Daily planning", done: Boolean(overview?.onboarding_evidence.has_daily_plan) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-[22px] px-4 py-3"
                style={{ background: item.done ? "rgba(0,108,74,0.06)" : "rgba(181,71,8,0.06)" }}
              >
                <span className="text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                  {item.label}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{
                    background: item.done ? "rgba(0,108,74,0.12)" : "rgba(181,71,8,0.12)",
                    color: item.done ? "#006c4a" : "#b54708",
                  }}
                >
                  {item.done ? "Done" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-[28px] border p-5 sm:p-6"
          style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                Activity Ledger
              </p>
              <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                Day-by-day show-up history
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#6b7c75" }}>
              If a day is absent, there was no app activity recorded.
            </p>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {recentCalendar.map(({ date, row }) => {
              const summary = summarizeDay(row);
              return (
                <div
                  key={date}
                  className="rounded-[24px] border p-4"
                  style={{ background: summary.bg, borderColor: summary.border }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8a9e97" }}>
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
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.72)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          Tasks / habits
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {row.completed_tasks_count} / {row.completed_habits_count}
                        </p>
                      </div>
                      <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.72)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#8a9e97" }}>
                          Planning signal
                        </p>
                        <p className="mt-1 text-sm font-semibold" style={{ color: "#1a1f1e" }}>
                          {row.created_daily_plan || row.created_weekly_goal || row.created_monthly_goal || row.created_yearly_goal
                            ? "Yes"
                            : "No"}
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

export default function AdminPage() {
  const [range, setRange] = useState<(typeof DAY_RANGE_OPTIONS)[number]>(14);
  const [overview, setOverview] = useState<ApiAdminActivityOverview | null>(null);
  const [detailOverview, setDetailOverview] = useState<ApiActivityOverview | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const detailAnchorRef = useRef<HTMLDivElement | null>(null);

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
    if (!selectedSessionId) {
      setDetailOverview(null);
      return;
    }
    let cancelled = false;

    activityApi
      .getOverview(selectedSessionId, range)
      .then((data) => {
        if (!cancelled) {
          setDetailOverview(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load user detail.");
      });

    return () => {
      cancelled = true;
    };
  }, [range, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 1280) return;
    const handle = window.setTimeout(() => {
      detailAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [selectedSessionId]);

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
        } else {
          setDetailOverview(null);
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
    <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
      <div className="space-y-6">
        <section
          className="overflow-hidden rounded-[32px] border p-6 sm:p-8"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(133,248,196,0.18), transparent 28%), linear-gradient(135deg, #0f2a1f 0%, #16382b 55%, #f7fbf8 55%, #f9fcfa 100%)",
            borderColor: "rgba(10,22,18,0.08)",
            boxShadow: "0 24px 60px rgba(18,57,42,0.12)",
          }}
        >
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr] xl:items-end">
            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: "rgba(133,248,196,0.74)" }}>
                  Internal Admin
                </p>
                <h1 className="mt-2 font-headline text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                  Operator view of product usage.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: "rgba(255,255,255,0.76)" }}>
                  See how many people have signed up, who actually finished onboarding, who came back today, and where activity starts to drop.
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
                        background: active ? "#85f8c4" : "rgba(255,255,255,0.10)",
                        color: active ? "#0f2a1f" : "rgba(255,255,255,0.78)",
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
                  style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.78)" }}
                >
                  {isRefreshing ? "Refreshing" : "Refresh"}
                </button>
              </div>
            </div>

            <div
              className="rounded-[28px] border p-5 sm:p-6"
              style={{ background: "rgba(255,255,255,0.90)", borderColor: "rgba(255,255,255,0.50)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "#8a9e97" }}>
                Focus user
              </p>
              <h2 className="mt-3 font-headline text-2xl font-extrabold tracking-tight" style={{ color: "#1a1f1e" }}>
                {selectedWorkspace ? workspaceDisplayName(selectedWorkspace) : "No user selected yet"}
              </h2>
              <p className="mt-2 break-all text-sm leading-relaxed" style={{ color: "#50615b" }}>
                {selectedWorkspace
                  ? workspaceSecondaryLine(selectedWorkspace)
                  : "As tracked users appear, pick one from the directory below to inspect their usage history."}
              </p>
              {selectedWorkspace && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      background: stageMeta(selectedWorkspace.current_stage).bg,
                      color: stageMeta(selectedWorkspace.current_stage).tone,
                    }}
                  >
                    {stageMeta(selectedWorkspace.current_stage).shortLabel}
                  </span>
                  <span className="text-xs" style={{ color: "#6b7c75" }}>
                    Last seen {formatRelativeDays(selectedWorkspace.days_since_last_seen)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{ background: "rgba(180,35,24,0.08)", borderColor: "rgba(180,35,24,0.18)", color: "#b42318" }}
          >
            {error}
          </div>
        )}

        {loading && !overview ? (
          <section
            className="rounded-[28px] border p-6"
            style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
          >
            <p className="text-sm" style={{ color: "#6b7c75" }}>
              Loading admin dashboard...
            </p>
          </section>
        ) : overview ? (
          <>
            <OverviewCards overview={overview} />
            <StageGuide />
            <div className="grid gap-6 xl:grid-cols-[0.98fr_1.18fr]">
              <WorkspaceList
                overview={overview}
                selectedSessionId={selectedSessionId}
                onSelect={setSelectedSessionId}
              />
              <div ref={detailAnchorRef} className="self-start xl:sticky xl:top-6">
                <DetailPanel
                  overview={detailOverview}
                  selectedWorkspace={selectedWorkspace}
                  range={range}
                />
              </div>
            </div>
          </>
        ) : (
          <section
            className="rounded-[28px] border p-6"
            style={{ background: "#ffffff", borderColor: "rgba(10,22,18,0.08)" }}
          >
            <p className="text-sm" style={{ color: "#6b7c75" }}>
              No overview data is available yet.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
