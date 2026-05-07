"""
Dashboard retrieval service.

This module serves two dashboard-oriented read/write flows:

1. `get_dashboard`
   The main dashboard payload for the current day.
2. `get_next_day_review` / `approve_next_day_review`
   A persisted "next login" review flow that helps the user carry yesterday's
   unfinished work into today before they continue execution.

All metrics and suggestions are computed in Python — no AI involved here.
"""
from datetime import date, timedelta
from datetime import datetime, timezone
import calendar
from uuid import UUID

from supabase import Client

import app.db.sessions as sessions_db
from app.utils.date_utils import get_temporal_context, get_week_boundaries, week_number_for
from app.utils.metrics import (
    compute_weighted_daily_completion,
    compute_completion_rate,
    compute_habit_streak,
)
import app.db.plans as plans_db
import app.db.habits as habits_db
import app.db.yearly_goals as yg_db
from app.utils.period_guards import (
    get_session_now,
    get_session_temporal_context,
    get_session_today,
    is_current_daily_period,
    is_plannable_monthly_period,
    is_plannable_weekly_period,
    is_plannable_yearly_period,
)

RECAP_GRANULARITY_ORDER = {
    "weekly": 0,
    "monthly": 1,
    "quarterly": 2,
    "yearly": 3,
}


def _recap_key(entry: dict) -> str:
    return ":".join(
        [
            str(entry.get("type")),
            str(entry.get("period_year")),
            str(entry.get("period_quarter") or ""),
            str(entry.get("period_month") or ""),
            str(entry.get("period_week") or ""),
        ]
    )


def _make_recap_entry(
    recap_type: str,
    period_year: int,
    fired_at: datetime,
    *,
    period_week: int | None = None,
    period_month: int | None = None,
    period_quarter: int | None = None,
) -> dict:
    return {
        "type": recap_type,
        "period_year": period_year,
        "period_week": period_week,
        "period_month": period_month,
        "period_quarter": period_quarter,
        "fired_at": fired_at.isoformat(),
    }


def _quarter_for_month(month: int) -> int:
    return ((month - 1) // 3) + 1


def _quarter_bounds(year: int, quarter: int) -> tuple[date, date]:
    start_month = ((quarter - 1) * 3) + 1
    end_month = start_month + 2
    return (
        date(year, start_month, 1),
        date(year, end_month, calendar.monthrange(year, end_month)[1]),
    )


def _recap_period_end(entry: dict, week_starts_on: str) -> date:
    recap_type = entry.get("type")
    period_year = int(entry["period_year"])
    if recap_type == "weekly":
        start, end = get_week_boundaries(period_year, int(entry["period_week"]), week_starts_on)
        return end
    if recap_type == "monthly":
        period_month = int(entry["period_month"])
        return date(period_year, period_month, calendar.monthrange(period_year, period_month)[1])
    if recap_type == "quarterly":
        _, end = _quarter_bounds(period_year, int(entry["period_quarter"]))
        return end
    return date(period_year, 12, 31)


def _recap_sort_key(entry: dict, week_starts_on: str) -> tuple[date, int, str]:
    return (
        _recap_period_end(entry, week_starts_on),
        RECAP_GRANULARITY_ORDER.get(str(entry.get("type")), 99),
        _recap_key(entry),
    )


def _has_execution_signal(db: Client, session_id: UUID, start: date, end: date) -> bool:
    if plans_db.list_daily_priorities_for_range(db, session_id, start, end):
        return True
    if habits_db.list_habit_logs_for_session(db, session_id, start, end):
        return True
    return False


def _all_goals_completed(goals: list[dict]) -> bool:
    return bool(goals) and all(goal.get("status") == "completed" for goal in goals)


def _ensure_pending_recaps(
    db: Client,
    session_id: UUID,
    week_starts_on: str,
    now: datetime,
    current_ctx,
) -> list[dict]:
    session = sessions_db.get_session(db, session_id) or {}
    pending = list(session.get("pending_recaps") or [])
    handled = set(session.get("handled_recaps") or [])
    pending_keys = {_recap_key(entry) for entry in pending}
    due_entries: list[dict] = []

    current_week_goals = plans_db.list_weekly_goals(
        db, session_id, current_ctx.current_year, current_ctx.current_week_number
    )
    if current_ctx.today < current_ctx.week_end and _all_goals_completed(current_week_goals):
        due_entries.append(
            _make_recap_entry(
                "weekly",
                current_ctx.current_year,
                now,
                period_week=current_ctx.current_week_number,
            )
        )
    else:
        previous_week_day = current_ctx.week_start - timedelta(days=1)
        previous_week = get_session_temporal_context(db, session_id, previous_week_day)
        if _has_execution_signal(db, session_id, previous_week.week_start, previous_week.week_end):
            due_entries.append(
                _make_recap_entry(
                    "weekly",
                    previous_week.current_year,
                    now,
                    period_week=previous_week.current_week_number,
                )
            )

    current_month_goals = plans_db.list_monthly_goals(
        db, session_id, current_ctx.current_year, current_ctx.current_month
    )
    if current_ctx.day_of_month < current_ctx.days_in_month and _all_goals_completed(current_month_goals):
        due_entries.append(
            _make_recap_entry(
                "monthly",
                current_ctx.current_year,
                now,
                period_month=current_ctx.current_month,
            )
        )
    else:
        previous_month_day = date(current_ctx.current_year, current_ctx.current_month, 1) - timedelta(days=1)
        if _has_execution_signal(
            db,
            session_id,
            date(previous_month_day.year, previous_month_day.month, 1),
            previous_month_day,
        ):
            due_entries.append(
                _make_recap_entry(
                    "monthly",
                    previous_month_day.year,
                    now,
                    period_month=previous_month_day.month,
                )
            )

    current_quarter = _quarter_for_month(current_ctx.current_month)
    quarter_start, quarter_end = _quarter_bounds(current_ctx.current_year, current_quarter)
    yearly_monthly_goals = plans_db.list_monthly_goals_for_year(db, session_id, current_ctx.current_year)
    current_quarter_goals = [
        goal for goal in yearly_monthly_goals
        if _quarter_for_month(int(goal["month"])) == current_quarter and goal.get("is_main")
    ]
    if current_ctx.today < quarter_end and _all_goals_completed(current_quarter_goals):
        due_entries.append(
            _make_recap_entry(
                "quarterly",
                current_ctx.current_year,
                now,
                period_quarter=current_quarter,
            )
        )
    else:
        previous_quarter_day = quarter_start - timedelta(days=1)
        previous_quarter = _quarter_for_month(previous_quarter_day.month)
        previous_quarter_start, previous_quarter_end = _quarter_bounds(previous_quarter_day.year, previous_quarter)
        if _has_execution_signal(db, session_id, previous_quarter_start, previous_quarter_end):
            due_entries.append(
                _make_recap_entry(
                    "quarterly",
                    previous_quarter_day.year,
                    now,
                    period_quarter=previous_quarter,
                )
            )

    yearly_goals = yg_db.list_yearly_goals(db, session_id, current_ctx.current_year)
    if (current_ctx.current_month, current_ctx.day_of_month) >= (12, 15):
        if yearly_goals or _has_execution_signal(
            db,
            session_id,
            date(current_ctx.current_year, 1, 1),
            current_ctx.today,
        ):
            due_entries.append(
                _make_recap_entry("yearly", current_ctx.current_year, now)
            )
    elif _all_goals_completed(yearly_goals):
        due_entries.append(
            _make_recap_entry("yearly", current_ctx.current_year, now)
        )
    else:
        previous_year = current_ctx.current_year - 1
        previous_year_goals = yg_db.list_yearly_goals(db, session_id, previous_year)
        if previous_year_goals or _has_execution_signal(
            db,
            session_id,
            date(previous_year, 1, 1),
            date(previous_year, 12, 31),
        ):
            due_entries.append(_make_recap_entry("yearly", previous_year, now))

    next_pending = list(pending)
    for entry in due_entries:
        key = _recap_key(entry)
        if key in pending_keys or key in handled:
            continue
        next_pending.append(entry)
        pending_keys.add(key)

    next_pending.sort(key=lambda entry: _recap_sort_key(entry, week_starts_on))
    if next_pending != pending:
        sessions_db.update_session(db, session_id, {"pending_recaps": next_pending})
    return next_pending


def get_dashboard(db: Client, session_id: UUID, plan_date: date | None = None) -> dict:
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_session_temporal_context(db, session_id, plan_date)
    current_ctx = get_session_temporal_context(db, session_id)
    pending_recaps = _ensure_pending_recaps(
        db,
        session_id,
        week_starts_on,
        get_session_now(db, session_id),
        current_ctx,
    )

    # ── Today's data ─────────────────────────────────────────────────────────
    today = ctx.today
    all_priorities = plans_db.list_daily_priorities(db, session_id, today)
    main_priorities = [p for p in all_priorities if p.get("is_main")]
    secondary_tasks = [p for p in all_priorities if not p.get("is_main")]

    # ── Weekly goals ──────────────────────────────────────────────────────────
    weekly_goals = plans_db.list_weekly_goals(
        db, session_id, ctx.current_year, ctx.current_week_number
    )

    # ── Monthly context ────────────────────────────────────────────────────────
    monthly_goals = plans_db.list_monthly_goals(
        db, session_id, ctx.current_year, ctx.current_month
    )

    yearly_goals = yg_db.list_yearly_goals(db, session_id, ctx.current_year)

    # ── Habits ────────────────────────────────────────────────────────────────
    habits = habits_db.list_habits(db, session_id, active_only=True)
    today_habit_logs = {
        log["habit_id"]: log
        for log in habits_db.list_habit_logs_for_session(db, session_id, today, today)
    }

    habits_completed_today = 0
    habits_total_today = 0
    enriched_habits = []

    # Get 30 days of history for streak calculation
    since = today - timedelta(days=30)
    habit_history = habits_db.list_habit_logs_for_session(db, session_id, since, today)

    for habit in habits:
        hid = habit["id"]
        log = today_habit_logs.get(hid)
        completed_today = log["completed"] if log else False

        if habit.get("frequency") == "daily":
            habits_total_today += 1
            if completed_today:
                habits_completed_today += 1

        # Compute streak
        history = [(
            date.fromisoformat(h["date"]),
            h["completed"]
        ) for h in habit_history if h["habit_id"] == hid]
        streak = compute_habit_streak(
            history,
            habit.get("frequency", "daily"),
            week_starts_on=week_starts_on,
        )

        enriched_habits.append({
            **habit,
            "completed_today": completed_today,
            "streak": streak,
        })

    # ── Daily metrics ─────────────────────────────────────────────────────────
    priorities_total = len(main_priorities)
    priorities_completed = sum(1 for p in main_priorities if p.get("completed"))
    secondary_total = len(secondary_tasks)
    secondary_completed = sum(1 for t in secondary_tasks if t.get("completed"))

    today_completion = compute_weighted_daily_completion(
        priorities_completed, priorities_total,
        secondary_completed, secondary_total,
        habits_completed_today, habits_total_today,
    )

    # ── Weekly consistency (last 7 days) ─────────────────────────────────────
    weekly_consistency = _compute_weekly_consistency(db, session_id, ctx.week_start)

    # ── Yesterday's completion ────────────────────────────────────────────────
    yesterday = today - timedelta(days=1)
    yesterday_priorities = plans_db.list_daily_priorities(db, session_id, yesterday)
    yesterday_main = [p for p in yesterday_priorities if p.get("is_main")]
    yesterday_secondary = [p for p in yesterday_priorities if not p.get("is_main")]
    yesterday_logs = {
        log["habit_id"]: log
        for log in habits_db.list_habit_logs_for_session(db, session_id, yesterday, yesterday)
    }
    yesterday_habits_done = sum(1 for hid, log in yesterday_logs.items() if log["completed"])
    yesterday_habits_total = sum(1 for h in habits if h.get("frequency") == "daily")

    yesterday_completion = compute_weighted_daily_completion(
        sum(1 for p in yesterday_main if p.get("completed")), len(yesterday_main),
        sum(1 for t in yesterday_secondary if t.get("completed")), len(yesterday_secondary),
        yesterday_habits_done, yesterday_habits_total,
    )

    # ── Execution streak ──────────────────────────────────────────────────────
    streak, best_streak = _compute_execution_streaks(db, session_id, today)

    # ── Weekly/monthly completion rates ───────────────────────────────────────
    weekly_goals_total = len(weekly_goals)
    weekly_goals_done = sum(1 for g in weekly_goals if g.get("status") == "completed")
    monthly_goals_total = len(monthly_goals)
    monthly_goals_done = sum(1 for g in monthly_goals if g.get("status") == "completed")

    for item in all_priorities:
        item["editable"] = is_current_daily_period(db, session_id, date.fromisoformat(item["date"]))
    for goal in weekly_goals:
        goal["editable"] = is_plannable_weekly_period(db, session_id, int(goal["year"]), int(goal["week_number"]))
    for goal in monthly_goals:
        goal["editable"] = is_plannable_monthly_period(db, session_id, int(goal["year"]), int(goal["month"]))
    for goal in yearly_goals:
        goal["editable"] = is_plannable_yearly_period(db, session_id, int(goal["year"]))

    # ── Assemble response ─────────────────────────────────────────────────────
    return {
        "session_id": str(session_id),
        "today": today.isoformat(),
        "week_number": ctx.current_week_number,
        "month": ctx.current_month,
        "year": ctx.current_year,
        "week_start": ctx.week_start.isoformat(),
        "week_end": ctx.week_end.isoformat(),
        "days_left_in_week": ctx.days_remaining_in_week,
        "days_left_in_month": ctx.days_remaining_in_month,
        "daily_priorities": main_priorities,
        "secondary_tasks": secondary_tasks,
        "weekly_goals": weekly_goals,
        "monthly_context": monthly_goals,
        "yearly_goals": yearly_goals,
        "habits": enriched_habits,
        "pending_recaps": pending_recaps,
        "metrics": {
            "execution_streak": streak,
            "best_execution_streak": best_streak,
            "yesterday_completion": yesterday_completion,
            "weekly_consistency": weekly_consistency,
            "tasks_completed_today": priorities_completed,
            "tasks_total_today": priorities_total,
            "habits_completed_today": habits_completed_today,
            "habits_total_today": habits_total_today,
            "weekly_completion_rate": compute_completion_rate(weekly_goals_done, weekly_goals_total),
            "monthly_completion_rate": compute_completion_rate(monthly_goals_done, monthly_goals_total),
        },
        "weekly_objective": _summarize_weekly_objective(weekly_goals),
        "monthly_context_text": _summarize_monthly_context(monthly_goals),
    }


def get_next_day_review(db: Client, session_id: UUID, plan_date: date | None = None) -> dict:
    """
    Build the persisted morning-review payload.

    The gate is intentionally simple and trustworthy:
    - If the target date already has priorities, we do not force-open the review again.
    - If the target date is empty, we use the previous day's real execution data
      plus the active weekly goals to propose a clean starting point.
    """
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_session_temporal_context(db, session_id)
    target_date = plan_date or ctx.today
    source_date = target_date - timedelta(days=1)
    target_week_number = week_number_for(target_date, week_starts_on)

    target_plan = plans_db.get_daily_plan(db, session_id, target_date)
    target_items = plans_db.list_daily_priorities(db, session_id, target_date)

    source_items = plans_db.list_daily_priorities(db, session_id, source_date)
    source_main = [item for item in source_items if item.get("is_main")]
    source_tasks = [item for item in source_items if not item.get("is_main")]

    habits = habits_db.list_habits(db, session_id, active_only=True)
    source_logs = {
        log["habit_id"]: log
        for log in habits_db.list_habit_logs_for_session(db, session_id, source_date, source_date)
    }

    weekly_goals = plans_db.list_weekly_goals(db, session_id, target_date.year, target_week_number)
    weekly_main = [goal for goal in weekly_goals if goal.get("is_main")]
    weekly_support = [goal for goal in weekly_goals if not goal.get("is_main")]

    suggested_priorities = _build_suggested_priorities(source_main, weekly_main, target_date.isoformat())
    suggested_tasks = _build_suggested_tasks(source_tasks, weekly_support, target_date.isoformat())

    completed_main = [item for item in source_main if item.get("completed")]
    incomplete_main = [item for item in source_main if not item.get("completed")]
    completed_tasks = [item for item in source_tasks if item.get("completed")]
    incomplete_tasks = [item for item in source_tasks if not item.get("completed")]

    completed_habits = [
        habit for habit in habits
        if source_logs.get(habit["id"], {}).get("completed")
    ]
    missed_habits = [
        habit for habit in habits
        if habit["id"] not in {h["id"] for h in completed_habits}
    ]

    source_completion = compute_weighted_daily_completion(
        len(completed_main),
        len(source_main),
        len(completed_tasks),
        len(source_tasks),
        len(completed_habits),
        len(habits),
    )

    should_open = len(target_items) == 0 and (
        bool(source_items) or bool(weekly_goals) or bool(habits)
    )

    return {
        "today": target_date.isoformat(),
        "source_date": source_date.isoformat(),
        "should_open": should_open,
        "already_planned_today": bool(target_plan and target_items),
        "yesterday_summary": {
            "completion_rate": source_completion,
            "completed_main_count": len(completed_main),
            "main_count": len(source_main),
            "completed_task_count": len(completed_tasks),
            "task_count": len(source_tasks),
            "completed_habit_count": len(completed_habits),
            "habit_count": len(habits),
            "completed_main_titles": [item["title"] for item in completed_main[:5]],
            "completed_task_titles": [item["title"] for item in completed_tasks[:5]],
            "completed_habit_names": [habit["name"] for habit in completed_habits[:5]],
            "incomplete_main_titles": [item["title"] for item in incomplete_main[:5]],
            "incomplete_task_titles": [item["title"] for item in incomplete_tasks[:5]],
            "missed_habit_names": [habit["name"] for habit in missed_habits[:5]],
        },
        "reflection": _build_review_reflection(
            yesterday_completion=source_completion,
            completed_main=completed_main,
            completed_tasks=completed_tasks,
            completed_habits=completed_habits,
            incomplete_main=incomplete_main,
            incomplete_tasks=incomplete_tasks,
            weekly_main=weekly_main,
        ),
        "insights": _build_review_insights(
            yesterday_completion=source_completion,
            incomplete_main=incomplete_main,
            incomplete_tasks=incomplete_tasks,
            weekly_main=weekly_main,
        ),
        "proposal": {
            "priorities": suggested_priorities,
            "tasks": suggested_tasks,
            "weekly_objective": _summarize_weekly_objective(weekly_goals),
            "monthly_context": _summarize_monthly_context(
                plans_db.list_monthly_goals(db, session_id, target_date.year, target_date.month)
            ),
        },
    }


def approve_next_day_review(
    db: Client,
    session_id: UUID,
    plan_date: date,
    priorities: list[dict],
    tasks: list[dict],
) -> dict:
    """
    Save the user-approved next-day plan.

    We intentionally overwrite any existing priorities for the day so the review
    modal becomes the single source of truth for today's kickoff.
    """
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    week_number = week_number_for(plan_date, week_starts_on)
    weekly_plan = plans_db.get_weekly_plan(db, session_id, plan_date.year, week_number)

    plan = plans_db.upsert_daily_plan(
        db,
        session_id,
        {
            "weekly_plan_id": weekly_plan["id"] if weekly_plan else None,
            "date": plan_date.isoformat(),
            "status": "active",
            "approved_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    plans_db.delete_daily_priorities_for_plan(db, UUID(plan["id"]))

    records: list[dict] = []
    for item in priorities:
        records.append(
            {
                "session_id": str(session_id),
                "daily_plan_id": plan["id"],
                "title": item["title"],
                "description": item.get("description"),
                "date": plan_date.isoformat(),
                "status": "active",
                "completed": False,
                "priority": item.get("priority", "high"),
                "estimated_minutes": item.get("estimated_minutes"),
                "is_main": True,
                "tag": item.get("tag"),
                "weekly_goal_id": item.get("weekly_goal_id"),
                "ai_suggested": False,
                "notes": "Approved from next-day review",
            }
        )
    for item in tasks:
        records.append(
            {
                "session_id": str(session_id),
                "daily_plan_id": plan["id"],
                "title": item["title"],
                "description": item.get("description"),
                "date": plan_date.isoformat(),
                "status": "active",
                "completed": False,
                "priority": item.get("priority", "medium"),
                "estimated_minutes": item.get("estimated_minutes"),
                "is_main": False,
                "tag": item.get("tag"),
                "weekly_goal_id": item.get("weekly_goal_id"),
                "ai_suggested": False,
                "notes": "Approved from next-day review",
            }
        )

    if records:
        plans_db.bulk_create_daily_priorities(db, records)

    return {
        "id": plan["id"],
        "status": "active",
        "saved_priorities": len(priorities),
        "saved_tasks": len(tasks),
        "date": plan_date.isoformat(),
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _compute_weekly_consistency(db: Client, session_id: UUID, week_start: date) -> list[int]:
    """Returns 7 integers where elapsed days are 100 if active, else 0. Future days remain 0."""
    week_end = week_start + timedelta(days=6)
    priorities = plans_db.list_daily_priorities_for_range(db, session_id, week_start, week_end)
    habit_logs = habits_db.list_habit_logs_for_session(db, session_id, week_start, week_end)

    active_days: set[date] = set()
    for item in priorities:
        if item.get("completed"):
            active_days.add(date.fromisoformat(item["date"]))
    for log in habit_logs:
        if log.get("completed"):
            active_days.add(date.fromisoformat(log["date"]))

    today = get_session_today(db, session_id)
    result = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        if day > today:
            result.append(0)
            continue
        result.append(100 if day in active_days else 0)
    return result


def _compute_execution_streaks(db: Client, session_id: UUID, today: date) -> tuple[int, int]:
    """
    Return (current_streak, best_streak).

    A streak day only counts when that day had at least one main priority and
    every main priority for that day was completed.
    """
    session = sessions_db.get_session(db, session_id) or {}
    created_at = str(session.get("created_at") or "")[:10]
    try:
        history_start = date.fromisoformat(created_at)
    except ValueError:
        history_start = today - timedelta(days=365)

    rows = plans_db.list_daily_priorities_for_range(db, session_id, history_start, today)
    by_day: dict[date, dict[str, int]] = {}
    for row in rows:
        if not row.get("is_main"):
            continue
        day = date.fromisoformat(row["date"])
        snapshot = by_day.setdefault(day, {"total": 0, "completed": 0})
        snapshot["total"] += 1
        if row.get("completed"):
            snapshot["completed"] += 1

    def is_elite_execution(day: date) -> bool | None:
        snapshot = by_day.get(day)
        if not snapshot or snapshot["total"] == 0:
            return None
        return snapshot["completed"] == snapshot["total"]

    current_streak = 0
    check_day = today
    skipped_today_without_commitment = False
    while check_day >= history_start:
        outcome = is_elite_execution(check_day)
        if outcome is None:
            if check_day == today and not skipped_today_without_commitment:
                skipped_today_without_commitment = True
                check_day -= timedelta(days=1)
                continue
            break
        if not outcome:
            break
        current_streak += 1
        check_day -= timedelta(days=1)

    best_streak = 0
    running_streak = 0
    cursor = history_start
    while cursor <= today:
        outcome = is_elite_execution(cursor)
        if outcome:
            running_streak += 1
            best_streak = max(best_streak, running_streak)
        else:
            running_streak = 0
        cursor += timedelta(days=1)

    return current_streak, best_streak


def _titles_for_summary(goals: list[dict]) -> list[str]:
    """Prefer is_main goals; otherwise any titled goals (manual adds may omit is_main)."""
    mains = [g["title"] for g in goals if g.get("title") and g.get("is_main")]
    if mains:
        return mains
    return [g["title"] for g in goals if g.get("title")]


def _summarize_weekly_objective(weekly_goals: list[dict]) -> str | None:
    main = _titles_for_summary(weekly_goals)
    if not main:
        return None
    if len(main) == 1:
        return main[0]
    return f"{main[0]} and {len(main) - 1} more"


def _summarize_monthly_context(monthly_goals: list[dict]) -> str | None:
    main = _titles_for_summary(monthly_goals)
    if not main:
        return None
    if len(main) == 1:
        return main[0]
    return f"{main[0]} (+{len(main) - 1} more)"


def _carry_forward_item(item: dict, plan_date_iso: str, is_main: bool) -> dict:
    """Normalize an existing DB priority/task into a proposed next-day item."""
    return {
        "title": item["title"],
        "description": item.get("description"),
        "date": plan_date_iso,
        "priority": item.get("priority") or ("high" if is_main else "medium"),
        "estimated_minutes": item.get("estimated_minutes"),
        "tag": item.get("tag"),
        "weekly_goal_id": item.get("weekly_goal_id"),
        "is_main": is_main,
    }


def _goal_to_item(goal: dict, plan_date_iso: str, is_main: bool) -> dict:
    """Turn an active weekly goal into a proposed today item."""
    return {
        "title": goal["title"],
        "description": goal.get("description"),
        "date": plan_date_iso,
        "priority": "high" if is_main else "medium",
        "estimated_minutes": None,
        "tag": "Weekly goal",
        "weekly_goal_id": goal.get("id"),
        "is_main": is_main,
    }


def _build_suggested_priorities(yesterday_main: list[dict], weekly_main: list[dict], plan_date_iso: str) -> list[dict]:
    suggestions = [
        _carry_forward_item(item, plan_date_iso, True)
        for item in yesterday_main
        if not item.get("completed")
    ][:3]
    if suggestions:
        return suggestions
    return [_goal_to_item(goal, plan_date_iso, True) for goal in weekly_main[:3]]


def _build_suggested_tasks(yesterday_tasks: list[dict], weekly_support: list[dict], plan_date_iso: str) -> list[dict]:
    suggestions = [
        _carry_forward_item(item, plan_date_iso, False)
        for item in yesterday_tasks
        if not item.get("completed")
    ][:5]
    if len(suggestions) >= 3:
        return suggestions
    taken_titles = {item["title"] for item in suggestions}
    for goal in weekly_support:
        if goal["title"] in taken_titles:
            continue
        suggestions.append(_goal_to_item(goal, plan_date_iso, False))
        if len(suggestions) >= 5:
            break
    return suggestions


def _build_review_insights(
    yesterday_completion: int,
    incomplete_main: list[dict],
    incomplete_tasks: list[dict],
    weekly_main: list[dict],
) -> list[str]:
    insights: list[str] = []
    insights.append(f"Yesterday closed at {yesterday_completion}% overall completion.")
    if incomplete_main:
        insights.append(f"{len(incomplete_main)} main priority item(s) are still unfinished and worth deciding on before you start.")
    if incomplete_tasks:
        insights.append(f"{len(incomplete_tasks)} supporting task(s) can be carried forward or dropped intentionally.")
    if weekly_main:
        insights.append(f"Your active weekly focus is {weekly_main[0]['title']}.")
    return insights[:3]


def _build_review_reflection(
    yesterday_completion: int,
    completed_main: list[dict],
    completed_tasks: list[dict],
    completed_habits: list[dict],
    incomplete_main: list[dict],
    incomplete_tasks: list[dict],
    weekly_main: list[dict],
) -> str:
    wins: list[str] = []
    if completed_main:
        wins.append(f"you closed {len(completed_main)} main priorit{'y' if len(completed_main) == 1 else 'ies'}")
    if completed_tasks:
        wins.append(f"finished {len(completed_tasks)} supporting task{'s' if len(completed_tasks) != 1 else ''}")
    if completed_habits:
        wins.append(f"kept {len(completed_habits)} habit{'s' if len(completed_habits) != 1 else ''} alive")

    friction: list[str] = []
    if incomplete_main:
        friction.append(f"{len(incomplete_main)} main item{' is' if len(incomplete_main) == 1 else 's are'} still open")
    if incomplete_tasks:
        friction.append(f"{len(incomplete_tasks)} supporting task{' remains' if len(incomplete_tasks) == 1 else 's remain'} undecided")

    weekly_focus = weekly_main[0]["title"] if weekly_main else None

    opening = (
        f"Yesterday landed at {yesterday_completion}% completion."
        if yesterday_completion > 0
        else "Yesterday did not fully convert into execution yet."
    )
    wins_text = (
        f" The strongest signal is that {', '.join(wins)}."
        if wins
        else " There were no clear wins captured in the plan itself."
    )
    friction_text = (
        f" The main cleanup is that {', '.join(friction)}."
        if friction
        else " Nothing major needs to be carried forward unless it still matters."
    )
    focus_text = f" Plan the next day around {weekly_focus}." if weekly_focus else " Plan the next day around what matters most now."
    return f"{opening}{wins_text}{friction_text}{focus_text}"
