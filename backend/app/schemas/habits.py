from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from .common import HabitFrequency


class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    icon: str = "check_circle"
    frequency: HabitFrequency = HabitFrequency.daily
    category_id: UUID | None = None
    sort_order: int = 0


class HabitUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    frequency: HabitFrequency | None = None
    active: bool | None = None
    category_id: UUID | None = None
    sort_order: int | None = None


class HabitResponse(BaseModel):
    id: UUID
    session_id: UUID
    name: str
    icon: str
    frequency: HabitFrequency
    active: bool
    category_id: UUID | None = None
    sort_order: int
    # Computed fields (joined from habit_logs)
    completed_today: bool = False
    streak: int = 0
    created_at: datetime
    updated_at: datetime


class HabitLogResponse(BaseModel):
    habit_id: UUID
    date: str   # YYYY-MM-DD
    completed: bool
    completed_at: datetime | None
