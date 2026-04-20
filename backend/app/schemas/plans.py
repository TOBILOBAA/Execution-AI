"""Request/response schemas for plan generation and approval."""
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field
from .common import PlanStatus
from .goals import MonthlyGoalResponse, WeeklyGoalResponse, DailyPriorityResponse


# ─── Monthly Plan ─────────────────────────────────────────────────────────────

class MonthlyPlanGenerateRequest(BaseModel):
    session_id: UUID
    year: int
    month: int = Field(..., ge=1, le=12)


class MonthlyPlanApproveRequest(BaseModel):
    """
    User may adjust AI-suggested goals before approval.
    If goals are omitted, the AI draft is approved as-is.
    """
    goals: list[dict] | None = None


class MonthlyPlanResponse(BaseModel):
    id: UUID
    session_id: UUID
    year: int
    month: int
    status: PlanStatus
    days_in_month: int
    days_remaining: int
    ai_draft: dict | None
    ai_generated_at: datetime | None
    approved_at: datetime | None
    goals: list[MonthlyGoalResponse] = []
    created_at: datetime
    updated_at: datetime


# ─── Weekly Plan ──────────────────────────────────────────────────────────────

class WeeklyPlanGenerateRequest(BaseModel):
    session_id: UUID
    year: int
    week_number: int


class WeeklyPlanApproveRequest(BaseModel):
    goals: list[dict] | None = None


class WeeklyPlanResponse(BaseModel):
    id: UUID
    session_id: UUID
    year: int
    month: int
    week_number: int
    week_start: date
    week_end: date
    status: PlanStatus
    days_remaining: int
    ai_draft: dict | None
    ai_generated_at: datetime | None
    approved_at: datetime | None
    goals: list[WeeklyGoalResponse] = []
    created_at: datetime
    updated_at: datetime


# ─── Daily Plan ───────────────────────────────────────────────────────────────

class DailyPlanGenerateRequest(BaseModel):
    session_id: UUID
    date: date


class DailyPlanApproveRequest(BaseModel):
    priorities: list[dict] | None = None


class DailyPlanResponse(BaseModel):
    id: UUID
    session_id: UUID
    date: date
    status: PlanStatus
    ai_draft: dict | None
    ai_generated_at: datetime | None
    approved_at: datetime | None
    priorities: list[DailyPriorityResponse] = []
    created_at: datetime
    updated_at: datetime
