"""Habit management routes (CRUD for habits)."""
from uuid import UUID
from fastapi import APIRouter, Depends
from supabase import Client

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.schemas.habits import HabitCreate, HabitUpdate, HabitResponse
import app.db.habits as habits_db

router = APIRouter(prefix="/habits", tags=["Habits"])


@router.get("/{session_id}", response_model=list[HabitResponse])
def list_habits(
    session_id: UUID,
    active_only: bool = False,
    db: Client = Depends(get_db),
):
    habits = habits_db.list_habits(db, session_id, active_only)
    return habits


@router.post("/{session_id}", response_model=HabitResponse, status_code=201)
def create_habit(
    session_id: UUID,
    body: HabitCreate,
    db: Client = Depends(get_db),
):
    return habits_db.create_habit(db, session_id, body.model_dump())


@router.patch("/{session_id}/{habit_id}", response_model=HabitResponse)
def update_habit(
    session_id: UUID,
    habit_id: UUID,
    body: HabitUpdate,
    db: Client = Depends(get_db),
):
    habit = habits_db.get_habit(db, habit_id, session_id)
    if not habit:
        raise NotFoundError("Habit", str(habit_id))
    return habits_db.update_habit(db, habit_id, session_id, body.model_dump(exclude_unset=True))


@router.delete("/{session_id}/{habit_id}", status_code=204)
def delete_habit(
    session_id: UUID,
    habit_id: UUID,
    db: Client = Depends(get_db),
):
    deleted = habits_db.delete_habit(db, habit_id, session_id)
    if not deleted:
        raise NotFoundError("Habit", str(habit_id))
