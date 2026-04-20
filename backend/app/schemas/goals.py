"""Request/response schemas for all goal layers."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from .common import GoalStatus, PriorityLevel


# ─── Categories ───────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    icon: str = "category"
    color: str | None = None
    sort_order: int = 0


class CategoryResponse(BaseModel):
    id: UUID
    session_id: UUID
    name: str
    icon: str
    color: str | None
    sort_order: int
    created_at: datetime


# ─── Yearly Goals ─────────────────────────────────────────────────────────────

class YearlyGoalCreate(BaseModel):
    category_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    year: int
    target_date: str | None = None   # ISO date string


class YearlyGoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: GoalStatus | None = None
    progress: int | None = Field(None, ge=0, le=100)
    category_id: UUID | None = None
    target_date: str | None = None


class YearlyGoalResponse(BaseModel):
    id: UUID
    session_id: UUID
    category_id: UUID | None
    title: str
    description: str | None
    year: int
    status: GoalStatus
    progress: int
    target_date: str | None = None
    ai_suggested: bool
    created_at: datetime
    updated_at: datetime


# ─── Monthly Goals ────────────────────────────────────────────────────────────

class MonthlyGoalCreate(BaseModel):
    yearly_goal_id: UUID | None = None
    category_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    priority: PriorityLevel = PriorityLevel.medium
    is_main: bool = False
    target_date: str | None = None
    workload: str | None = None   # e.g. "~6 hours workload"


class MonthlyGoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: GoalStatus | None = None
    progress: int | None = Field(None, ge=0, le=100)
    priority: PriorityLevel | None = None
    is_main: bool | None = None
    target_date: str | None = None
    workload: str | None = None
    category_id: UUID | None = None


class MonthlyGoalResponse(BaseModel):
    id: UUID
    session_id: UUID
    monthly_plan_id: UUID
    yearly_goal_id: UUID | None
    category_id: UUID | None = None
    title: str
    description: str | None
    year: int
    month: int
    status: GoalStatus
    progress: int
    priority: PriorityLevel
    is_main: bool
    target_date: str | None = None
    workload: str | None = None
    ai_suggested: bool
    created_at: datetime
    updated_at: datetime


# ─── Weekly Goals ─────────────────────────────────────────────────────────────

class WeeklyGoalCreate(BaseModel):
    monthly_goal_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    is_main: bool = False
    target_day: str | None = None   # "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"
    goal_type: str | None = None    # "tactical" | "operational"
    workload: str | None = None


class WeeklyGoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: GoalStatus | None = None
    progress: int | None = Field(None, ge=0, le=100)
    is_main: bool | None = None
    target_day: str | None = None
    goal_type: str | None = None
    workload: str | None = None
    monthly_goal_id: UUID | None = None


class WeeklyGoalResponse(BaseModel):
    id: UUID
    session_id: UUID
    weekly_plan_id: UUID
    monthly_goal_id: UUID | None
    title: str
    description: str | None
    year: int
    month: int
    week_number: int
    status: GoalStatus
    progress: int
    is_main: bool
    target_day: str | None = None
    goal_type: str | None = None
    workload: str | None = None
    ai_suggested: bool
    created_at: datetime
    updated_at: datetime


# ─── Daily Priorities ─────────────────────────────────────────────────────────

class DailyPriorityCreate(BaseModel):
    weekly_goal_id: UUID | None = None
    title: str = Field(..., min_length=1, max_length=300)
    description: str | None = None
    priority: PriorityLevel = PriorityLevel.medium
    estimated_minutes: int | None = Field(None, ge=1)
    is_main: bool = True
    tag: str | None = None


class DailyPriorityUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: GoalStatus | None = None
    completed: bool | None = None
    priority: PriorityLevel | None = None
    estimated_minutes: int | None = None
    is_main: bool | None = None
    tag: str | None = None
    notes: str | None = None


class DailyPriorityResponse(BaseModel):
    id: UUID
    session_id: UUID
    daily_plan_id: UUID
    weekly_goal_id: UUID | None
    title: str
    description: str | None
    date: str              # ISO date string YYYY-MM-DD
    status: GoalStatus
    completed: bool
    completed_at: datetime | None
    priority: PriorityLevel
    estimated_minutes: int | None
    is_main: bool
    tag: str | None
    ai_suggested: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ─── Goals hierarchy response ──────────────────────────────────────────────────

class GoalsHierarchyResponse(BaseModel):
    year: int
    yearly_goals: list[YearlyGoalResponse]
    categories: list[CategoryResponse]
    current_month: int
    monthly_goals: list[MonthlyGoalResponse]
    current_week_number: int
    weekly_goals: list[WeeklyGoalResponse]
    today: str
    daily_priorities: list[DailyPriorityResponse]
