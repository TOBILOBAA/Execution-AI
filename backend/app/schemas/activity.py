from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DailyUserActivityResponse(BaseModel):
    id: UUID | None = None
    session_id: UUID
    auth_user_id: str | None = None
    activity_date: date
    timezone: str
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    opened_app: bool
    reached_dashboard: bool = False
    device_type: str | None = None
    device_family: str | None = None
    os_name: str | None = None
    browser_name: str | None = None
    completed_onboarding: bool
    created_yearly_goal: bool
    created_monthly_goal: bool
    created_weekly_goal: bool
    created_daily_plan: bool
    opened_next_day_review: bool
    approved_next_day_review: bool
    opened_reports: bool
    handled_recap: bool
    main_tasks_total: int = 0
    main_tasks_completed: int = 0
    secondary_tasks_total: int = 0
    secondary_tasks_completed: int = 0
    habits_total: int = 0
    completed_tasks_count: int
    completed_habits_count: int
    main_goal_completed: bool = False
    completed_any_meaningful_work: bool = False
    daily_completion_score: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserActivitySummaryResponse(BaseModel):
    user_key: str
    auth_user_id: str | None = None
    auth_email: str | None = None
    auth_name: str | None = None
    signup_at: datetime | None = None
    last_active_at: datetime | None = None
    primary_device_type: str | None = None
    device_types_used: list[str] = Field(default_factory=list)
    onboarding_started: bool
    onboarding_completed: bool
    onboarding_dropoff_stage: str | None = None
    reached_homepage: bool = False
    created_yearly_goal: bool = False
    created_monthly_goal: bool = False
    created_weekly_goal: bool = False
    created_daily_plan: bool = False
    planned_day: bool = False
    ticked_any_task: bool = False
    completed_main_task: bool = False
    completed_secondary_task: bool = False
    completed_habit: bool = False
    saw_review: bool = False
    planned_next_day: bool = False
    returned_after_onboarding: bool = False
    returned_after_review: bool = False
    days_active_total: int
    days_active_7d: int
    days_active_30d: int
    productive_days_7d: int = 0
    productive_days_30d: int = 0
    current_streak_days: int
    retention_status: str
    days_since_last_seen: int | None = None


class UserDeviceActivityResponse(BaseModel):
    auth_user_id: str
    session_id: UUID | None = None
    device_type: str
    device_family: str
    os_name: str
    browser_name: str
    user_agent: str | None = None
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None


class UserCategoryProfileResponse(BaseModel):
    auth_user_id: str
    auth_email: str | None = None
    category_id: UUID | None = None
    category_name: str
    yearly_goal_count: int = 0
    monthly_goal_count: int = 0
    weekly_goal_count: int = 0
    daily_task_count: int = 0
    habit_count: int = 0
    total_items_count: int = 0


class CategoryPopularityResponse(BaseModel):
    category_name: str
    users_count: int
    yearly_goal_count: int = 0
    monthly_goal_count: int = 0
    weekly_goal_count: int = 0
    daily_task_count: int = 0
    habit_count: int = 0
    total_items_count: int = 0


class UserActivitySummaryListResponse(BaseModel):
    users: list[UserActivitySummaryResponse]
    total_users: int
