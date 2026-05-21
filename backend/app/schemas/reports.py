"""Report request/response schemas and AI output validation schemas."""
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field
from .common import ReportType, ReportStatus


# ─── Report generation requests ───────────────────────────────────────────────

class DailyReportRequest(BaseModel):
    session_id: UUID
    date: date


class WeeklyReportRequest(BaseModel):
    session_id: UUID
    year: int
    week_number: int


class MonthlyReportRequest(BaseModel):
    session_id: UUID
    year: int
    month: int = Field(..., ge=1, le=12)


class QuarterlyReportRequest(BaseModel):
    session_id: UUID
    year: int
    quarter: int = Field(..., ge=1, le=4)


class YearlyReportRequest(BaseModel):
    session_id: UUID
    year: int


# ─── Computed metrics snapshots (code-produced, not LLM) ──────────────────────

class DailyMetrics(BaseModel):
    date: str
    priorities_total: int
    priorities_completed: int
    secondary_tasks_total: int
    secondary_tasks_completed: int
    habits_total: int
    habits_completed: int
    completion_rate: int        # 0-100 weighted
    estimated_minutes_planned: int
    estimated_minutes_completed: int


class WeeklyMetrics(BaseModel):
    year: int
    week_number: int
    week_start: str
    week_end: str
    days_with_data: int
    goals_total: int
    goals_completed: int
    main_goals_total: int
    main_goals_completed: int
    tasks_total: int
    tasks_completed: int
    avg_daily_completion: int   # 0-100
    habit_consistency: int      # 0-100


class MonthlyMetrics(BaseModel):
    year: int
    month: int
    weeks_count: int
    goals_total: int
    goals_completed: int
    main_goals_total: int
    main_goals_completed: int
    tasks_total: int
    tasks_completed: int
    avg_weekly_completion: int
    best_week: int | None       # week_number
    best_pillar: str | None


class QuarterlyMetrics(BaseModel):
    year: int
    quarter: int                # 1..4
    months_count: int
    tasks_total: int
    tasks_completed: int
    avg_monthly_completion: int
    # §9c canonical keys are also persisted on metrics JSONB.
    completion: int
    consistency: int
    alignment: int
    realism: int
    momentum: int
    execution_score: int


class YearlyMetrics(BaseModel):
    year: int
    months_with_data: int
    tasks_total: int
    tasks_completed: int
    avg_monthly_completion: int
    best_month: int | None
    best_pillar: str | None
    execution_streak: int
    percent_change: int | None  # vs previous year


# ─── AI narrative output (validated from Gemini) ──────────────────────────────

class DailyNarrative(BaseModel):
    summary: str
    top_win: str | None = None
    key_miss: str | None = None
    reflection: str
    tomorrow_focus: str


class WeeklyNarrative(BaseModel):
    summary: str
    top_win: str | None = None
    key_pattern: str | None = None
    reflection: str
    next_week_priority: str
    tailored_pattern: str = Field(..., min_length=1)
    tailored_action: str = Field(..., min_length=1)


class MonthlyNarrative(BaseModel):
    summary: str
    top_pillar: str | None = None
    biggest_win: str | None = None
    key_lesson: str | None = None
    reflection: str
    next_month_focus: str
    tailored_pattern: str = Field(..., min_length=1)
    tailored_action: str = Field(..., min_length=1)


class QuarterlyNarrative(BaseModel):
    summary: str
    key_pattern: str | None = None
    reflection: str
    next_quarter_focus: str
    tailored_pattern: str = Field(..., min_length=1)
    tailored_action: str = Field(..., min_length=1)


class YearlyNarrative(BaseModel):
    summary: str
    top_pillar: str | None = None
    biggest_win: str | None = None
    key_pattern: str | None = None
    reflection: str
    next_year_focus: str
    tailored_pattern: str = Field(..., min_length=1)
    tailored_action: str = Field(..., min_length=1)


# ─── Full report snapshot response ────────────────────────────────────────────

class ReportResponse(BaseModel):
    id: UUID
    session_id: UUID
    report_type: ReportType
    period_date: date | None = None
    period_week: int | None = None
    period_month: int | None = None
    period_quarter: int | None = None
    period_year: int
    metrics: dict
    ai_narrative: dict | None
    tailored_pattern: str | None = None
    tailored_action: str | None = None
    has_execution_data: bool = False
    ai_generated_at: datetime | None
    status: ReportStatus
    created_at: datetime
    updated_at: datetime


class ReportListResponse(BaseModel):
    session_id: str
    reports: list[ReportResponse]


# ─── AI plan generation output schemas ────────────────────────────────────────

class AIGoalItem(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"
    is_main: bool = False
    yearly_goal_ref: str | None = None   # hint text only
    monthly_goal_ref: str | None = None  # hint text only
    weekly_goal_ref: str | None = None   # hint text only
    estimated_effort: str | None = None
    # Target completion date YYYY-MM-DD (monthly: within that month; weekly: within week)
    target_date: str | None = None


class AIMonthlyPlanOutput(BaseModel):
    reasoning: str
    main_goals: list[AIGoalItem]
    secondary_goals: list[AIGoalItem]
    # Not generated for monthly plans — users define habits in-app
    foundational_habits: list[str] = Field(default_factory=list)


class AIWeeklyPlanOutput(BaseModel):
    reasoning: str
    main_goals: list[AIGoalItem]
    secondary_goals: list[AIGoalItem]
    foundational_habits: list[str] = Field(default_factory=list)


class AIDailyPlanOutput(BaseModel):
    reasoning: str
    top_priorities: list[AIGoalItem]
    secondary_tasks: list[AIGoalItem]
