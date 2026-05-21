from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, model_validator
from .common import HabitFrequency


class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    icon: str = "check_circle"
    frequency: HabitFrequency = HabitFrequency.daily
    category_id: UUID | None = None
    yearly_goal_id: UUID | None = None
    monthly_goal_id: UUID | None = None
    weekly_goal_id: UUID | None = None
    sort_order: int = 0

    @model_validator(mode="after")
    def validate_single_goal_link(self) -> "HabitCreate":
        links = [self.yearly_goal_id, self.monthly_goal_id, self.weekly_goal_id]
        if sum(link is not None for link in links) > 1:
            raise ValueError("A routine can link to only one goal level at a time.")
        return self


class HabitUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    frequency: HabitFrequency | None = None
    active: bool | None = None
    category_id: UUID | None = None
    yearly_goal_id: UUID | None = None
    monthly_goal_id: UUID | None = None
    weekly_goal_id: UUID | None = None
    sort_order: int | None = None

    @model_validator(mode="after")
    def validate_single_goal_link(self) -> "HabitUpdate":
        links = [self.yearly_goal_id, self.monthly_goal_id, self.weekly_goal_id]
        if sum(link is not None for link in links) > 1:
            raise ValueError("A routine can link to only one goal level at a time.")
        return self


class HabitResponse(BaseModel):
    id: UUID
    session_id: UUID
    name: str
    icon: str
    frequency: HabitFrequency
    active: bool
    category_id: UUID | None = None
    yearly_goal_id: UUID | None = None
    monthly_goal_id: UUID | None = None
    weekly_goal_id: UUID | None = None
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
