"""Goals hierarchy endpoint — returns the planning tree for a given year."""
from datetime import datetime, UTC, date
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.api.deps import get_db
from app.utils.date_utils import get_temporal_context, get_week_boundaries
import app.db.yearly_goals as yg_db
import app.db.categories as cat_db
import app.db.plans as plans_db
import app.db.sessions as sessions_db

router = APIRouter(prefix="/goals", tags=["Goals Hierarchy"])


@router.get("/{session_id}")
def get_goals_hierarchy(
    session_id: UUID,
    year: int = Query(default=None),
    week_number: int | None = Query(default=None, ge=1, le=53),
    db: Client = Depends(get_db),
):
    """
    Returns a structured view of the goal hierarchy for a year:
    - yearly goals + categories
    - all monthly goals in that year
    - all weekly goals in that year
    - daily priorities for a selected week (or current week when relevant)
    """
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    ctx = get_temporal_context(week_starts_on=week_starts_on)
    target_year = year or ctx.current_year
    selected_week_number = week_number
    if selected_week_number is None and target_year == ctx.current_year:
        selected_week_number = ctx.current_week_number

    yearly_goals = yg_db.list_yearly_goals(db, session_id, target_year)
    categories = cat_db.list_categories(db, session_id)
    monthly_goals = plans_db.list_monthly_goals_for_year(db, session_id, target_year)
    weekly_goals = plans_db.list_weekly_goals_for_year(db, session_id, target_year)

    year_start = date(target_year, 1, 1)
    year_end = ctx.today if target_year == ctx.current_year else date(target_year, 12, 31)
    year_daily_priorities = plans_db.list_daily_priorities_for_range(
        db,
        session_id,
        year_start,
        year_end,
    )

    selected_week_start = None
    selected_week_end = None
    selected_week_daily_priorities: list[dict] = []
    if selected_week_number is not None:
        selected_week_start, selected_week_end = get_week_boundaries(
            target_year, selected_week_number, week_starts_on
        )
        selected_week_daily_priorities = plans_db.list_daily_priorities_for_range(
            db,
            session_id,
            selected_week_start,
            selected_week_end,
        )

    for goal in monthly_goals:
        goal["editable"] = goal.get("status") not in ("locked", "completed")
    for goal in weekly_goals:
        goal["editable"] = goal.get("status") not in ("locked", "completed")
    for priority in selected_week_daily_priorities:
        priority["editable"] = priority.get("status") not in ("locked",)
    for priority in year_daily_priorities:
        priority["editable"] = priority.get("status") not in ("locked",)

    return {
        "year": target_year,
        "last_synced_at": datetime.now(UTC).isoformat(),
        "yearly_goals": yearly_goals,
        "categories": categories,
        "current_month": ctx.current_month,
        "monthly_goals": monthly_goals,
        "current_week_number": ctx.current_week_number,
        "weekly_goals": weekly_goals,
        "today": ctx.today.isoformat(),
        "year_daily_priorities": year_daily_priorities,
        "selected_week_number": selected_week_number,
        "selected_week_start": selected_week_start.isoformat() if selected_week_start else None,
        "selected_week_end": selected_week_end.isoformat() if selected_week_end else None,
        "selected_week_daily_priorities": selected_week_daily_priorities,
    }
