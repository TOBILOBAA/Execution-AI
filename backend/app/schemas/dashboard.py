"""Dashboard aggregate response schemas."""
from pydantic import BaseModel
from .goals import DailyPriorityResponse, WeeklyGoalResponse, MonthlyGoalResponse
from .habits import HabitResponse
from .session import RecapQueueEntry


class DashboardMetrics(BaseModel):
    execution_streak: int
    best_execution_streak: int
    yesterday_completion: int           # 0-100
    weekly_consistency: list[int]       # 7 values Sun-Sat (0-100)
    tasks_completed_today: int
    tasks_total_today: int
    habits_completed_today: int
    habits_total_today: int
    weekly_completion_rate: int         # 0-100
    monthly_completion_rate: int        # 0-100
    yearly_progress: int = 0
    weekly_goal_progress_by_id: dict[str, int] = {}
    monthly_goal_progress_by_id: dict[str, int] = {}
    yearly_goal_progress_by_id: dict[str, int] = {}


class DashboardResponse(BaseModel):
    session_id: str
    today: str                          # YYYY-MM-DD
    week_number: int
    month: int
    year: int
    week_start: str
    week_end: str
    days_left_in_week: int
    days_left_in_month: int
    # Current plans
    daily_priorities: list[DailyPriorityResponse]
    secondary_tasks: list[DailyPriorityResponse]
    weekly_goals: list[WeeklyGoalResponse]
    monthly_context: list[MonthlyGoalResponse]
    habits: list[HabitResponse]
    metrics: DashboardMetrics
    pending_recaps: list[RecapQueueEntry] = []
    # AI insight (optional, pulled from latest report or generated ad-hoc)
    ai_insight: str | None = None
    weekly_objective: str | None = None
    monthly_context_text: str | None = None


class NextDayReviewItem(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"
    estimated_minutes: int | None = None
    tag: str | None = None
    weekly_goal_id: str | None = None


class NextDayReviewApproveRequest(BaseModel):
    priorities: list[NextDayReviewItem] = []
    tasks: list[NextDayReviewItem] = []
