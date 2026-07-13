from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.schemas.goals import (
    CategoryCreate, CategoryResponse,
    YearlyGoalCreate, YearlyGoalUpdate, YearlyGoalResponse,
)
from app.services import activity_service
from app.services.goal_truth_service import decorate_goal_truth
import app.db.categories as cat_db
import app.db.plans as plans_db
import app.db.sessions as sessions_db
import app.db.yearly_goals as yg_db
from app.utils.period_guards import (
    assert_period_plannable_yearly,
    get_session_temporal_context,
    is_plannable_yearly_period,
)

router = APIRouter(prefix="/yearly-goals", tags=["Yearly Goals"])


# ─── Categories ───────────────────────────────────────────────────────────────

@router.get("/{session_id}/categories", response_model=list[CategoryResponse])
def list_categories(session_id: UUID, db: Client = Depends(get_db)):
    return cat_db.list_categories(db, session_id)


@router.post("/{session_id}/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    session_id: UUID,
    body: CategoryCreate,
    db: Client = Depends(get_db),
):
    return cat_db.create_category(db, session_id, body.model_dump())


@router.delete("/{session_id}/categories/{category_id}", status_code=204)
def delete_category(
    session_id: UUID,
    category_id: UUID,
    db: Client = Depends(get_db),
):
    deleted = cat_db.delete_category(db, session_id, category_id)
    if not deleted:
        raise NotFoundError("Category", str(category_id))


# ─── Yearly Goals ─────────────────────────────────────────────────────────────

@router.get("/{session_id}", response_model=list[YearlyGoalResponse])
def list_yearly_goals(
    session_id: UUID,
    year: int = Query(default=None),
    db: Client = Depends(get_db),
):
    ctx = get_session_temporal_context(db, session_id)
    target_year = year or ctx.current_year
    goals = yg_db.list_yearly_goals(db, session_id, target_year)
    for goal in goals:
        goal["editable"] = is_plannable_yearly_period(db, session_id, int(goal["year"]))
    decorated = decorate_goal_truth(
        yearly_goals=goals,
        monthly_goals=plans_db.list_monthly_goals_for_year(db, session_id, target_year),
        weekly_goals=plans_db.list_weekly_goals_for_year(db, session_id, target_year),
        daily_priorities=plans_db.list_daily_priorities_for_range(
            db,
            session_id,
            date(target_year, 1, 1),
            ctx.today if target_year == ctx.current_year else date(target_year, 12, 31),
        ),
        today=ctx.today,
        week_starts_on=sessions_db.get_effective_week_starts_on(db, session_id),
    )
    return decorated["yearly_goals"]


@router.post("/{session_id}", response_model=YearlyGoalResponse, status_code=201)
def create_yearly_goal(
    session_id: UUID,
    body: YearlyGoalCreate,
    db: Client = Depends(get_db),
):
    data = body.model_dump()
    assert_period_plannable_yearly(session_id, int(data["year"]), db)
    if data.get("category_id"):
        data["category_id"] = str(data["category_id"])
    goal = yg_db.create_yearly_goal(db, session_id, data)
    activity_service.track_created_yearly_goal(db, session_id)
    return goal


@router.patch("/{session_id}/{goal_id}", response_model=YearlyGoalResponse)
def update_yearly_goal(
    session_id: UUID,
    goal_id: UUID,
    body: YearlyGoalUpdate,
    db: Client = Depends(get_db),
):
    goal = yg_db.get_yearly_goal(db, goal_id, session_id)
    if not goal:
        raise NotFoundError("Yearly goal", str(goal_id))
    assert_period_plannable_yearly(session_id, int(goal["year"]), db)
    updates = body.model_dump(exclude_none=True)
    if updates.get("category_id"):
        updates["category_id"] = str(updates["category_id"])
    return yg_db.update_yearly_goal(db, goal_id, session_id, updates)


@router.delete("/{session_id}/{goal_id}", status_code=204)
def delete_yearly_goal(
    session_id: UUID,
    goal_id: UUID,
    db: Client = Depends(get_db),
):
    goal = yg_db.get_yearly_goal(db, goal_id, session_id)
    if not goal:
        raise NotFoundError("Yearly goal", str(goal_id))
    assert_period_plannable_yearly(session_id, int(goal["year"]), db)
    deleted = yg_db.delete_yearly_goal(db, goal_id, session_id)
    if not deleted:
        raise NotFoundError("Yearly goal", str(goal_id))
