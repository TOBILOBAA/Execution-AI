"""
Execution tracking routes — task and habit status updates.
"""
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Body
from supabase import Client

from app.api.deps import get_db
from app.schemas.goals import DailyPriorityCreate, DailyPriorityUpdate
from app.services import execution_service
import app.db.plans as plans_db
import app.db.sessions as sessions_db
from app.utils.date_utils import week_number_for
from app.utils.period_guards import assert_period_current_daily, get_session_today

router = APIRouter(tags=["Execution"])


def _ensure_daily_plan_row(db: Client, session_id: UUID, plan_date: date) -> dict:
    """Create a draft daily plan row if one does not exist yet."""
    plan = plans_db.get_daily_plan(db, session_id, plan_date)
    if plan:
        return plan
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    week_number = week_number_for(plan_date, week_starts_on)
    weekly_plan = plans_db.get_weekly_plan(db, session_id, plan_date.year, week_number)
    return plans_db.upsert_daily_plan(
        db,
        session_id,
        {
            "weekly_plan_id": weekly_plan["id"] if weekly_plan else None,
            "date": plan_date.isoformat(),
            "status": "draft",
        },
    )


# ─── Daily Priorities / Tasks ─────────────────────────────────────────────────

@router.patch("/tasks/{task_id}/status")
def toggle_task_status(
    task_id: UUID,
    session_id: UUID,
    completed: bool = Query(...),
    db: Client = Depends(get_db),
):
    """Mark a task (daily priority) complete or incomplete."""
    item = plans_db.get_daily_priority(db, task_id, session_id)
    if item:
        assert_period_current_daily(session_id, date.fromisoformat(item["date"]), db)
    return execution_service.toggle_daily_priority(db, session_id, task_id, completed)


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: UUID,
    session_id: UUID,
    body: DailyPriorityUpdate,
    db: Client = Depends(get_db),
):
    """Update task fields (title, notes, priority, estimated_minutes, etc.)."""
    item = plans_db.get_daily_priority(db, task_id, session_id)
    if item:
        assert_period_current_daily(session_id, date.fromisoformat(item["date"]), db)
    return execution_service.update_daily_priority_fields(
        db, session_id, task_id, body.model_dump(exclude_unset=True)
    )


@router.post("/tasks", status_code=201)
def create_task(
    session_id: UUID,
    plan_date: date = Query(..., alias="date"),
    body: DailyPriorityCreate = Body(...),
    db: Client = Depends(get_db),
):
    """Manually add a task to a daily plan."""
    assert_period_current_daily(session_id, plan_date, db)
    plan = _ensure_daily_plan_row(db, session_id, plan_date)
    data = {
        **body.model_dump(),
        "session_id": str(session_id),
        "daily_plan_id": plan["id"],
        "date": plan_date.isoformat(),
        "status": "active",
        "completed": False,
        "ai_suggested": False,
    }
    if data.get("weekly_goal_id"):
        data["weekly_goal_id"] = str(data["weekly_goal_id"])
    return plans_db.create_daily_priority(db, data)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: UUID,
    session_id: UUID,
    db: Client = Depends(get_db),
):
    """Delete a task (daily priority or secondary task) from the current day."""
    item = plans_db.get_daily_priority(db, task_id, session_id)
    if item:
        assert_period_current_daily(session_id, date.fromisoformat(item["date"]), db)
        plans_db.delete_daily_priority(db, task_id, session_id)
    return None


# ─── Goals progress ───────────────────────────────────────────────────────────

@router.patch("/goals/{goal_type}/{goal_id}/progress")
def update_goal_progress(
    goal_type: str,
    goal_id: UUID,
    session_id: UUID,
    progress: int = Query(..., ge=0, le=100),
    status: str | None = Query(None),
    db: Client = Depends(get_db),
):
    """
    Update progress (0-100) on a yearly, monthly, or weekly goal.
    goal_type: 'yearly' | 'monthly' | 'weekly'
    """
    return execution_service.update_goal_progress(
        db, session_id, goal_type, goal_id, progress, status
    )


# ─── Habits ───────────────────────────────────────────────────────────────────

@router.patch("/habits/{habit_id}/status")
def toggle_habit_status(
    habit_id: UUID,
    session_id: UUID,
    completed: bool = Query(...),
    log_date: date = Query(default=None),
    db: Client = Depends(get_db),
):
    """Mark a habit as complete or incomplete for a given date (defaults to today)."""
    effective_log_date = log_date or get_session_today(db, session_id)
    assert_period_current_daily(session_id, effective_log_date, db)
    return execution_service.toggle_habit(db, session_id, habit_id, completed, effective_log_date)
