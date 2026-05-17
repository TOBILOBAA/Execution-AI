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


class ActivityWorkspaceSummaryResponse(BaseModel):
    session_id: str
    auth_user_id: str | None = None
    device_hint: str | None = None
    timezone: str
    onboarding_done: bool
    current_stage: Literal[
        "onboarding",
        "planning_foundation",
        "daily_planning",
        "executing",
        "reviewing",
        "inactive",
    ]
    days_since_last_seen: int | None = Field(default=None, ge=0)
    last_seen_at: datetime | None = None
    last_active_at: datetime | None = None
    last_opened_date_local: date | None = None
    onboarding_evidence_complete: bool = False
    active_days_in_range: int = 0
    absent_days_in_range: int = 0
    tasks_completed_in_range: int = 0
    habits_completed_in_range: int = 0
    reports_opened_in_range: int = 0


class AdminActivityOverviewResponse(BaseModel):
    total_workspaces: int
    active_today: int
    onboarding_incomplete: int
    inactive: int
    executing_now: int
    reviewing_now: int
    workspaces: list[ActivityWorkspaceSummaryResponse]
