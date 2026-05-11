from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class RecapQueueEntry(BaseModel):
    type: str = Field(pattern="^(weekly|monthly|quarterly|yearly)$")
    period_year: int
    period_week: int | None = None
    period_month: int | None = None
    period_quarter: int | None = None
    fired_at: datetime


class SessionCreate(BaseModel):
    device_hint: str | None = None
    auth_user_id: str | None = None
    timezone: str = "UTC"
    week_starts_on: str | None = Field(default=None, pattern="^(sunday|monday)$")


class SessionResponse(BaseModel):
    id: UUID
    created_at: datetime
    onboarding_step: int
    onboarding_done: bool
    timezone: str
    week_starts_on: str
    device_hint: str | None = None
    auth_user_id: str | None = None
    pending_recaps: list[RecapQueueEntry] = Field(default_factory=list)
    handled_recaps: list[str] = Field(default_factory=list)


class SessionUpdate(BaseModel):
    onboarding_step: int | None = None
    onboarding_done: bool | None = None
    timezone: str | None = None
    auth_user_id: str | None = None
    week_starts_on: str | None = Field(default=None, pattern="^(sunday|monday)$")
    pending_recaps: list[RecapQueueEntry] | None = None
    handled_recaps: list[str] | None = None
