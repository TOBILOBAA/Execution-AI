from uuid import UUID
from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.schemas.goals import (
    CategoryCreate, CategoryResponse,
    YearlyGoalCreate, YearlyGoalUpdate, YearlyGoalResponse,
)
import app.db.categories as cat_db
import app.db.yearly_goals as yg_db
from app.utils.date_utils import get_temporal_context

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
    ctx = get_temporal_context()
    return yg_db.list_yearly_goals(db, session_id, year or ctx.current_year)


@router.post("/{session_id}", response_model=YearlyGoalResponse, status_code=201)
def create_yearly_goal(
    session_id: UUID,
    body: YearlyGoalCreate,
    db: Client = Depends(get_db),
):
    data = body.model_dump()
    if data.get("category_id"):
        data["category_id"] = str(data["category_id"])
    return yg_db.create_yearly_goal(db, session_id, data)


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
    deleted = yg_db.delete_yearly_goal(db, goal_id, session_id)
    if not deleted:
        raise NotFoundError("Yearly goal", str(goal_id))
