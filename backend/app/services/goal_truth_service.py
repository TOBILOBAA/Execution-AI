from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.common import GoalTruthStatus
from app.utils.date_utils import get_week_boundaries


def _parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _clamp_progress(value: int | float | str | None) -> int:
    try:
        return max(0, min(100, int(value or 0)))
    except (TypeError, ValueError):
        return 0


def _child_progress(children: list[dict]) -> int:
    if not children:
        return 0
    return round(sum(_clamp_progress(child.get("truth_progress")) for child in children) / len(children))


def _target_date_overdue(goal: dict, today: date) -> bool:
    target_date = _parse_iso_date(goal.get("target_date"))
    return bool(target_date and target_date < today)


def _decorate_priority(priority: dict, today: date) -> dict:
    raw_status = str(priority.get("status") or "").lower()
    completed = bool(priority.get("completed")) or raw_status == GoalTruthStatus.completed.value
    priority_date = _parse_iso_date(priority.get("date"))
    period_closed = bool(priority_date and priority_date < today)

    if completed:
        truth_status = GoalTruthStatus.completed
        truth_reason = "This task was completed."
    elif raw_status == "missed" or period_closed:
        truth_status = GoalTruthStatus.at_risk
        truth_reason = "This day passed before the task was completed."
    elif raw_status in {"pending", "locked"}:
        truth_status = GoalTruthStatus.not_started
        truth_reason = "The task has not entered execution yet."
    else:
        truth_status = GoalTruthStatus.in_progress
        truth_reason = "This task is already part of the execution plan."

    return {
        **priority,
        "truth_status": truth_status.value,
        "truth_progress": 100 if completed else 0,
        "truth_reason": truth_reason,
        "has_activity": truth_status != GoalTruthStatus.not_started,
        "linked_children_count": None,
        "completed_children_count": None,
        "period_closed": period_closed,
    }


def _decorate_goal(
    goal: dict,
    children: list[dict],
    *,
    today: date,
    period_closed: bool,
) -> dict:
    raw_status = str(goal.get("status") or "").lower()
    manual_progress = _clamp_progress(goal.get("progress"))
    completed = raw_status == "completed" or manual_progress >= 100
    completed_children_count = sum(
        1 for child in children if child.get("truth_status") == GoalTruthStatus.completed.value
    )
    child_progress = _child_progress(children)
    truth_progress = 100 if completed else max(manual_progress, child_progress)
    has_activity = manual_progress > 0 or bool(children)
    all_children_complete = bool(children) and completed_children_count == len(children)

    if completed:
        truth_status = GoalTruthStatus.completed
        truth_reason = "This goal is already completed."
    elif raw_status == "missed":
        truth_status = GoalTruthStatus.at_risk
        truth_reason = "This goal is marked as missed."
    elif all_children_complete:
        truth_status = GoalTruthStatus.review_ready
        truth_reason = "All linked child work is complete. Review and mark this goal complete."
    elif period_closed or _target_date_overdue(goal, today):
        truth_status = GoalTruthStatus.at_risk
        truth_reason = "The goal period ended before this goal was completed."
    elif has_activity:
        truth_status = GoalTruthStatus.in_progress
        truth_reason = "Linked work or recorded progress exists for this goal."
    else:
        truth_status = GoalTruthStatus.not_started
        truth_reason = "No linked work or recorded progress exists yet."

    return {
        **goal,
        "truth_status": truth_status.value,
        "truth_progress": truth_progress,
        "truth_reason": truth_reason,
        "has_activity": has_activity,
        "linked_children_count": len(children),
        "completed_children_count": completed_children_count,
        "period_closed": period_closed,
    }


def decorate_goal_truth(
    *,
    yearly_goals: list[dict],
    monthly_goals: list[dict],
    weekly_goals: list[dict],
    daily_priorities: list[dict],
    today: date,
    week_starts_on: str = "monday",
) -> dict[str, list[dict]]:
    decorated_priorities = [_decorate_priority(dict(priority), today) for priority in daily_priorities]
    priorities_by_weekly: dict[str, list[dict]] = defaultdict(list)
    for priority in decorated_priorities:
        weekly_goal_id = priority.get("weekly_goal_id")
        if weekly_goal_id:
            priorities_by_weekly[str(weekly_goal_id)].append(priority)

    decorated_weekly: list[dict] = []
    weekly_by_monthly: dict[str, list[dict]] = defaultdict(list)
    for weekly_goal in weekly_goals:
        goal = dict(weekly_goal)
        week_start, week_end = get_week_boundaries(
            int(goal["year"]),
            int(goal["week_number"]),
            week_starts_on,
        )
        decorated = _decorate_goal(
            goal,
            priorities_by_weekly.get(str(goal["id"]), []),
            today=today,
            period_closed=week_end < today,
        )
        decorated_weekly.append(decorated)
        monthly_goal_id = decorated.get("monthly_goal_id")
        if monthly_goal_id:
            weekly_by_monthly[str(monthly_goal_id)].append(decorated)

    decorated_monthly: list[dict] = []
    monthly_by_yearly: dict[str, list[dict]] = defaultdict(list)
    for monthly_goal in monthly_goals:
        goal = dict(monthly_goal)
        period_closed = (int(goal["year"]), int(goal["month"])) < (today.year, today.month)
        decorated = _decorate_goal(
            goal,
            weekly_by_monthly.get(str(goal["id"]), []),
            today=today,
            period_closed=period_closed,
        )
        decorated_monthly.append(decorated)
        yearly_goal_id = decorated.get("yearly_goal_id")
        if yearly_goal_id:
            monthly_by_yearly[str(yearly_goal_id)].append(decorated)

    decorated_yearly: list[dict] = []
    for yearly_goal in yearly_goals:
        goal = dict(yearly_goal)
        decorated_yearly.append(
            _decorate_goal(
                goal,
                monthly_by_yearly.get(str(goal["id"]), []),
                today=today,
                period_closed=int(goal["year"]) < today.year,
            )
        )

    return {
        "yearly_goals": decorated_yearly,
        "monthly_goals": decorated_monthly,
        "weekly_goals": decorated_weekly,
        "daily_priorities": decorated_priorities,
    }
