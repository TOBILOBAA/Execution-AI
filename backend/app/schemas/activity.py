from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


ActivityEvent = Literal[
    "app_opened",
    "onboarding_completed",
    "yearly_goal_created",
    "monthly_goal_created",
    "weekly_goal_created",
    "daily_plan_created",
    "next_day_review_opened",
    "next_day_review_approved",
    "reports_opened",
    "recap_handled",
]


class ActivityTouchRequest(BaseModel):
    event: ActivityEvent
    activity_date: date | None = None


class DailyUserActivityResponse(BaseModel):
    session_id: str
    auth_user_id: str | None = None
    activity_date: date
    timezone: str
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    opened_app: bool = False
    completed_onboarding: bool = False
    created_yearly_goal: bool = False
    created_monthly_goal: bool = False
    created_weekly_goal: bool = False
    created_daily_plan: bool = False
    opened_next_day_review: bool = False
    approved_next_day_review: bool = False
    opened_reports: bool = False
    handled_recap: bool = False
    completed_tasks_count: int = 0
    completed_habits_count: int = 0


class OnboardingEvidenceResponse(BaseModel):
    has_yearly_goals: bool
    has_monthly_goals: bool
    has_weekly_goals: bool
    has_daily_plan: bool
    complete: bool


class ActivityOverviewResponse(BaseModel):
    session_id: str
    last_seen_at: datetime | None = None
    last_active_at: datetime | None = None
    last_opened_date_local: date | None = None
    current_stage: Literal[
        "onboarding",
        "planning_foundation",
        "daily_planning",
        "executing",
        "reviewing",
        "inactive",
    ]
    days_since_last_seen: int | None = Field(default=None, ge=0)
    onboarding_evidence: OnboardingEvidenceResponse
    recent_days: list[DailyUserActivityResponse]
