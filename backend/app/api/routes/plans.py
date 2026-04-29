"""
Routes for monthly, weekly, and daily plan generation and approval.
"""
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import AIGenerationError, NotFoundError
from app.schemas.plans import (
    MonthlyPlanGenerateRequest, MonthlyPlanApproveRequest,
    WeeklyPlanGenerateRequest, WeeklyPlanApproveRequest,
    DailyPlanGenerateRequest, DailyPlanApproveRequest,
)
from app.schemas.goals import MonthlyGoalCreate, MonthlyGoalUpdate, WeeklyGoalCreate, WeeklyGoalUpdate
from app.services import planning_service
import app.db.plans as plans_db
import app.db.sessions as sessions_db
from app.utils.date_utils import get_temporal_context, get_week_boundaries

router = APIRouter(tags=["Plans"])


def _ensure_monthly_plan_row(db: Client, session_id: UUID, plan_year: int, plan_month: int) -> dict:
    """Create a draft monthly plan row if missing so manual goal adds work without AI generate first."""
    plan = plans_db.get_monthly_plan(db, session_id, plan_year, plan_month)
    if plan:
        return plan
    import calendar

    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    days_in_month = calendar.monthrange(plan_year, plan_month)[1]
    if plan_year == ctx.current_year and plan_month == ctx.current_month:
        days_remaining = ctx.days_remaining_in_month
    else:
        days_remaining = days_in_month
    return plans_db.upsert_monthly_plan(
        db,
        session_id,
        {
            "year": plan_year,
            "month": plan_month,
            "status": "draft",
            "days_in_month": days_in_month,
            "days_remaining": days_remaining,
        },
    )


def _ensure_weekly_plan_row(db: Client, session_id: UUID, plan_year: int, plan_week: int) -> dict:
    """Create a draft weekly plan row if missing so manual weekly goal adds work without AI generate first."""
    plan = plans_db.get_weekly_plan(db, session_id, plan_year, plan_week)
    if plan:
        return plan
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    week_start, week_end = get_week_boundaries(plan_year, plan_week, week_starts_on)
    month = week_start.month
    days_remaining = (
        ctx.days_remaining_in_week
        if plan_year == ctx.current_year and plan_week == ctx.current_week_number
        else 7
    )
    return plans_db.upsert_weekly_plan(
        db,
        session_id,
        {
            "year": plan_year,
            "month": month,
            "week_number": plan_week,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "status": "draft",
            "days_remaining": days_remaining,
        },
    )


# ─── Monthly Plans ────────────────────────────────────────────────────────────

@router.post("/monthly-plan/generate")
def generate_monthly_plan(
    body: MonthlyPlanGenerateRequest,
    db: Client = Depends(get_db),
):
    """Generate an AI monthly plan draft. Does not approve it."""
    try:
        return planning_service.generate_monthly_plan(
            db, body.session_id, body.year, body.month
        )
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/monthly-plan/save")
def approve_monthly_plan(
    session_id: UUID,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    body: MonthlyPlanApproveRequest = MonthlyPlanApproveRequest(),
    db: Client = Depends(get_db),
):
    """Approve a monthly plan draft. Persists monthly goals."""
    return planning_service.approve_monthly_plan(
        db, session_id, year, month, body.goals
    )


@router.get("/monthly-plan/{session_id}")
def get_monthly_plan(
    session_id: UUID,
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    db: Client = Depends(get_db),
):
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    plan = plans_db.get_monthly_plan(
        db, session_id, year or ctx.current_year, month or ctx.current_month
    )
    if not plan:
        raise NotFoundError("Monthly plan")
    goals = plans_db.list_monthly_goals(
        db, session_id, year or ctx.current_year, month or ctx.current_month
    )
    return {**plan, "goals": goals}


@router.post("/monthly-plan/{session_id}/goals", status_code=201)
def add_monthly_goal(
    session_id: UUID,
    body: MonthlyGoalCreate,
    year: int = Query(default=None),
    month: int = Query(default=None, ge=1, le=12),
    db: Client = Depends(get_db),
):
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    plan_year = year or ctx.current_year
    plan_month = month or ctx.current_month
    plan = _ensure_monthly_plan_row(db, session_id, plan_year, plan_month)
    data = {
        **body.model_dump(),
        "session_id": str(session_id),
        "monthly_plan_id": plan["id"],
        "year": plan_year,
        "month": plan_month,
        "status": "active",
        "progress": 0,
        "ai_suggested": False,
    }
    if data.get("yearly_goal_id"):
        data["yearly_goal_id"] = str(data["yearly_goal_id"])
    return plans_db.create_monthly_goal(db, data)


@router.patch("/monthly-goals/{goal_id}")
def update_monthly_goal(
    goal_id: UUID,
    session_id: UUID,
    body: MonthlyGoalUpdate,
    db: Client = Depends(get_db),
):
    goal = plans_db.get_monthly_goal(db, goal_id, session_id)
    if not goal:
        raise NotFoundError("Monthly goal", str(goal_id))
    return plans_db.update_monthly_goal(
        db, goal_id, session_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/monthly-goals/{goal_id}", status_code=204)
def delete_monthly_goal(
    goal_id: UUID,
    session_id: UUID,
    db: Client = Depends(get_db),
):
    goal = plans_db.get_monthly_goal(db, goal_id, session_id)
    if not goal:
        raise NotFoundError("Monthly goal", str(goal_id))
    plans_db.delete_monthly_goal(db, goal_id, session_id)
    return None


# ─── Weekly Plans ─────────────────────────────────────────────────────────────

@router.post("/weekly-plan/generate")
def generate_weekly_plan(
    body: WeeklyPlanGenerateRequest,
    db: Client = Depends(get_db),
):
    """Generate an AI weekly plan draft."""
    try:
        return planning_service.generate_weekly_plan(
            db, body.session_id, body.year, body.week_number
        )
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/weekly-plan/save")
def approve_weekly_plan(
    session_id: UUID,
    year: int = Query(...),
    week_number: int = Query(...),
    body: WeeklyPlanApproveRequest = WeeklyPlanApproveRequest(),
    db: Client = Depends(get_db),
):
    """Approve a weekly plan draft. Persists weekly goals."""
    return planning_service.approve_weekly_plan(
        db, session_id, year, week_number, body.goals
    )


@router.get("/weekly-plan/{session_id}")
def get_weekly_plan(
    session_id: UUID,
    year: int = Query(default=None),
    week_number: int = Query(default=None),
    db: Client = Depends(get_db),
):
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    plan = plans_db.get_weekly_plan(
        db, session_id, year or ctx.current_year, week_number or ctx.current_week_number
    )
    if not plan:
        raise NotFoundError("Weekly plan")
    goals = plans_db.list_weekly_goals(
        db, session_id, year or ctx.current_year, week_number or ctx.current_week_number
    )
    return {**plan, "goals": goals}


@router.post("/weekly-plan/{session_id}/goals", status_code=201)
def add_weekly_goal(
    session_id: UUID,
    body: WeeklyGoalCreate,
    year: int = Query(default=None),
    week_number: int = Query(default=None),
    db: Client = Depends(get_db),
):
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    plan_year = year or ctx.current_year
    plan_week = week_number or ctx.current_week_number
    plan = _ensure_weekly_plan_row(db, session_id, plan_year, plan_week)
    week_start, _ = get_week_boundaries(plan_year, plan_week, week_starts_on)
    data = {
        **body.model_dump(),
        "session_id": str(session_id),
        "weekly_plan_id": plan["id"],
        "year": plan_year,
        "month": week_start.month,
        "week_number": plan_week,
        "status": "active",
        "progress": 0,
        "ai_suggested": False,
    }
    if data.get("monthly_goal_id"):
        data["monthly_goal_id"] = str(data["monthly_goal_id"])
    return plans_db.create_weekly_goal(db, data)


@router.patch("/weekly-goals/{goal_id}")
def update_weekly_goal(
    goal_id: UUID,
    session_id: UUID,
    body: WeeklyGoalUpdate,
    db: Client = Depends(get_db),
):
    goal = plans_db.get_weekly_goal(db, goal_id, session_id)
    if not goal:
        raise NotFoundError("Weekly goal", str(goal_id))
    return plans_db.update_weekly_goal(
        db, goal_id, session_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/weekly-goals/{goal_id}", status_code=204)
def delete_weekly_goal(
    goal_id: UUID,
    session_id: UUID,
    db: Client = Depends(get_db),
):
    goal = plans_db.get_weekly_goal(db, goal_id, session_id)
    if not goal:
        raise NotFoundError("Weekly goal", str(goal_id))
    plans_db.delete_weekly_goal(db, goal_id, session_id)
    return None


# ─── Daily Plans ──────────────────────────────────────────────────────────────

@router.post("/daily-plan/generate")
def generate_daily_plan(
    body: DailyPlanGenerateRequest,
    db: Client = Depends(get_db),
):
    """Generate an AI daily plan draft."""
    try:
        return planning_service.generate_daily_plan(db, body.session_id, body.date)
    except RuntimeError as exc:
        raise AIGenerationError(str(exc)) from exc


@router.post("/daily-plan/save")
def approve_daily_plan(
    session_id: UUID,
    plan_date: date = Query(..., alias="date"),
    body: DailyPlanApproveRequest = DailyPlanApproveRequest(),
    db: Client = Depends(get_db),
):
    """Approve a daily plan draft. Persists daily priorities."""
    return planning_service.approve_daily_plan(db, session_id, plan_date, body.priorities)


@router.get("/daily-plan/{session_id}")
def get_daily_plan(
    session_id: UUID,
    plan_date: date = Query(default=None, alias="date"),
    db: Client = Depends(get_db),
):
    today = plan_date or date.today()
    plan = plans_db.get_daily_plan(db, session_id, today)
    if not plan:
        raise NotFoundError("Daily plan")
    priorities = plans_db.list_daily_priorities(db, session_id, today)
    return {**plan, "priorities": priorities}
