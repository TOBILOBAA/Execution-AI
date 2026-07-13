"""Shared enums and base types used across all schemas."""
from enum import Enum


class GoalStatus(str, Enum):
    active = "active"
    completed = "completed"
    missed = "missed"
    locked = "locked"
    pending = "pending"


class GoalTruthStatus(str, Enum):
    completed = "completed"
    in_progress = "in_progress"
    review_ready = "review_ready"
    at_risk = "at_risk"
    not_started = "not_started"


class PriorityLevel(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class HabitFrequency(str, Enum):
    daily = "daily"
    weekly = "weekly"
    weekdays = "weekdays"
    three_x_week = "3x_week"
    five_x_week = "5x_week"
    weekends = "weekends"
    flexible = "flexible"


class PlanStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    locked = "locked"


class ReportType(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class ReportStatus(str, Enum):
    pending = "pending"
    generating = "generating"
    ready = "ready"
    failed = "failed"
    stale = "stale"
