"""
Execution tracking service.

Handles:
- Marking tasks/priorities complete or incomplete
- Marking habits complete or incomplete
- Updating progress on goals (manual or derived)
- Timestamp management
"""
from datetime import datetime, timezone, date
from uuid import UUID

from supabase import Client

from app.core.exceptions import NotFoundError, PlanLockedError
from app.core.logging import logger
import app.db.plans as plans_db
import app.db.habits as habits_db
import app.db.reports as reports_db
import app.db.yearly_goals as yg_db
from app.utils.period_guards import assert_period_current_daily, assert_period_current_monthly, assert_period_current_weekly, assert_period_current_yearly, get_session_today


def toggle_daily_priority(
    db: Client,
    session_id: UUID,
    priority_id: UUID,
    completed: bool,
) -> dict:
    """Mark a daily priority as complete or incomplete."""
    item = plans_db.get_daily_priority(db, priority_id, session_id)
    if not item:
        raise NotFoundError("Daily priority", str(priority_id))
    assert_period_current_daily(session_id, date.fromisoformat(item["date"]), db)

    updates: dict = {
        "completed": completed,
        "status": "completed" if completed else "active",
        "completed_at": datetime.now(timezone.utc).isoformat() if completed else None,
    }

    result = plans_db.update_daily_priority(db, priority_id, session_id, updates)
    reports_db.mark_daily_report_stale(db, session_id, date.fromisoformat(item["date"]))
    logger.info(
        "priority_toggled",
        session_id=str(session_id),
        priority_id=str(priority_id),
        completed=completed,
    )
    return result


def update_daily_priority_fields(
    db: Client,
    session_id: UUID,
    priority_id: UUID,
    updates: dict,
) -> dict:
    """Patch arbitrary fields on a daily priority."""
    item = plans_db.get_daily_priority(db, priority_id, session_id)
    if not item:
        raise NotFoundError("Daily priority", str(priority_id))
    assert_period_current_daily(session_id, date.fromisoformat(item["date"]), db)

    # Strip None values so we don't overwrite with nulls unintentionally
    clean_updates = {k: v for k, v in updates.items() if v is not None}
    return plans_db.update_daily_priority(db, priority_id, session_id, clean_updates)


def toggle_habit(
    db: Client,
    session_id: UUID,
    habit_id: UUID,
    completed: bool,
    log_date: date | None = None,
) -> dict:
    """Record habit completion for a given date (defaults to today)."""
    habit = habits_db.get_habit(db, habit_id, session_id)
    if not habit:
        raise NotFoundError("Habit", str(habit_id))

    log_date = log_date or get_session_today(db, session_id)
    assert_period_current_daily(session_id, log_date, db)
    result = habits_db.upsert_habit_log(db, habit_id, session_id, log_date, completed)

    logger.info(
        "habit_toggled",
        session_id=str(session_id),
        habit_id=str(habit_id),
        date=log_date.isoformat(),
        completed=completed,
    )
    return result


def update_goal_progress(
    db: Client,
    session_id: UUID,
    goal_type: str,   # "yearly" | "monthly" | "weekly"
    goal_id: UUID,
    progress: int,
    status: str | None = None,
) -> dict:
    """
    Manually update progress on a goal.
    Progress is 0-100. Status changes are optional.
    """
    updates: dict = {"progress": max(0, min(100, progress))}
    if status:
        updates["status"] = status
    if progress == 100 and not status:
        updates["status"] = "completed"

    if goal_type == "yearly":
        item = yg_db.get_yearly_goal(db, goal_id, session_id)
        if not item:
            raise NotFoundError("Yearly goal", str(goal_id))
        assert_period_current_yearly(session_id, int(item["year"]), db)
        return yg_db.update_yearly_goal(db, goal_id, session_id, updates)

    elif goal_type == "monthly":
        item = plans_db.get_monthly_goal(db, goal_id, session_id)
        if not item:
            raise NotFoundError("Monthly goal", str(goal_id))
        assert_period_current_monthly(session_id, int(item["year"]), int(item["month"]), db)
        return plans_db.update_monthly_goal(db, goal_id, session_id, updates)

    elif goal_type == "weekly":
        item = plans_db.get_weekly_goal(db, goal_id, session_id)
        if not item:
            raise NotFoundError("Weekly goal", str(goal_id))
        assert_period_current_weekly(session_id, int(item["year"]), int(item["week_number"]), db)
        return plans_db.update_weekly_goal(db, goal_id, session_id, updates)

    else:
        raise ValueError(f"Unknown goal_type: {goal_type}")
