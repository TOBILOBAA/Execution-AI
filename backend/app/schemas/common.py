"""Shared enums and base types used across all schemas."""
from enum import Enum


class GoalStatus(str, Enum):
    active = "active"
    completed = "completed"
    missed = "missed"
    locked = "locked"
    pending = "pending"


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


class PlanStatus(str, Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    locked = "locked"


class ReportType(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class ReportStatus(str, Enum):
    pending = "pending"
    generating = "generating"
    ready = "ready"
    failed = "failed"
