"""
Planning logic preprocessing layer.

This module computes the structured planning payload that is passed to the AI.
The AI receives a compact, structured dict — not raw data or vague context.

Key principles:
- Time remaining shapes workload realism
- Goal compression applied when time is short
- Parent-child alignment enforced here (not by LLM)
- All math is deterministic Python
"""
from dataclasses import dataclass, field
from typing import Any
from .date_utils import TemporalContext
from .planning_limits import (
    DAILY_MAIN_PRIORITY_CAP,
    DAILY_SECONDARY_TASK_CAP,
    MONTHLY_MAIN_GOAL_CAP,
    MONTHLY_SECONDARY_GOAL_CAP,
    WEEKLY_MAIN_GOAL_CAP,
    WEEKLY_SECONDARY_GOAL_CAP,
)


@dataclass
class WorkloadBudget:
    """
    Determines realistic task limits based on time remaining.
    These bounds are injected into prompts as hard constraints.
    """
    max_main_goals: int
    max_secondary_goals: int
    max_habits: int
    max_daily_priorities: int
    max_daily_secondary: int
    workload_label: str         # "full" | "compressed" | "minimal"
    rationale: str              # human-readable explanation for the AI prompt


def compute_monthly_workload(ctx: TemporalContext) -> WorkloadBudget:
    """
    Monthly workload budget based on days remaining in the month.
    Full month: 3 main + 4 secondary goals.
    Late month (<= 7 days): max 1 main + 2 secondary.
    """
    days = ctx.days_remaining_in_month

    if days >= 21:
        return WorkloadBudget(
            max_main_goals=MONTHLY_MAIN_GOAL_CAP,
            max_secondary_goals=MONTHLY_SECONDARY_GOAL_CAP,
            max_habits=6,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="full",
            rationale=f"Full month available ({days} days remaining). Keep the month focused around one main goal and a small set of secondary goals.",
        )
    elif days >= 14:
        return WorkloadBudget(
            max_main_goals=MONTHLY_MAIN_GOAL_CAP,
            max_secondary_goals=MONTHLY_SECONDARY_GOAL_CAP,
            max_habits=5,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="moderate",
            rationale=f"{days} days remaining. Keep one clear main goal and only the secondary goals that still matter.",
        )
    elif days >= 7:
        return WorkloadBudget(
            max_main_goals=MONTHLY_MAIN_GOAL_CAP,
            max_secondary_goals=MONTHLY_SECONDARY_GOAL_CAP,
            max_habits=4,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="compressed",
            rationale=f"Only {days} days left. Compress scope around one realistic main goal and a few secondary goals.",
        )
    else:
        return WorkloadBudget(
            max_main_goals=MONTHLY_MAIN_GOAL_CAP,
            max_secondary_goals=MONTHLY_SECONDARY_GOAL_CAP,
            max_habits=3,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="minimal",
            rationale=f"Only {days} days remaining this month. Set 1 achievable main goal and close out habits.",
        )


def compute_weekly_workload(ctx: TemporalContext) -> WorkloadBudget:
    """
    Weekly workload budget based on days remaining in the week.
    """
    days = ctx.days_remaining_in_week

    if days >= 5:
        return WorkloadBudget(
            max_main_goals=WEEKLY_MAIN_GOAL_CAP,
            max_secondary_goals=WEEKLY_SECONDARY_GOAL_CAP,
            max_habits=5,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="full",
            rationale=f"Nearly full week ({days} days remaining). Keep the week anchored by one main goal and a tight set of secondary goals.",
        )
    elif days >= 3:
        return WorkloadBudget(
            max_main_goals=WEEKLY_MAIN_GOAL_CAP,
            max_secondary_goals=WEEKLY_SECONDARY_GOAL_CAP,
            max_habits=4,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="compressed",
            rationale=f"{days} days left in the week. Compress scope around one critical goal and only the support work that truly matters.",
        )
    else:
        return WorkloadBudget(
            max_main_goals=WEEKLY_MAIN_GOAL_CAP,
            max_secondary_goals=WEEKLY_SECONDARY_GOAL_CAP,
            max_habits=3,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="minimal",
            rationale=f"Only {days} days left. Sprint on 1 main deliverable and close habits.",
        )


def compute_daily_workload(ctx: TemporalContext, total_weekly_remaining: int) -> WorkloadBudget:
    """
    Daily workload budget. Also considers how much weekly work is still undone.
    """
    if total_weekly_remaining > 8:
        # Heavy week backlog — push more into today
        return WorkloadBudget(
            max_main_goals=DAILY_MAIN_PRIORITY_CAP,
            max_secondary_goals=DAILY_SECONDARY_TASK_CAP,
            max_habits=5,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="full",
            rationale="Heavy weekly backlog. Keep today anchored to one main goal and only a few secondary goals.",
        )
    elif total_weekly_remaining > 4:
        return WorkloadBudget(
            max_main_goals=DAILY_MAIN_PRIORITY_CAP,
            max_secondary_goals=DAILY_SECONDARY_TASK_CAP,
            max_habits=5,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="moderate",
            rationale="Moderate weekly backlog. Stay focused on one main outcome and only the secondary goals that fit today.",
        )
    else:
        return WorkloadBudget(
            max_main_goals=DAILY_MAIN_PRIORITY_CAP,
            max_secondary_goals=DAILY_SECONDARY_TASK_CAP,
            max_habits=4,
            max_daily_priorities=DAILY_MAIN_PRIORITY_CAP,
            max_daily_secondary=DAILY_SECONDARY_TASK_CAP,
            workload_label="light",
            rationale="Light workload remaining. Focus on depth over breadth today.",
        )


def build_monthly_planning_payload(
    ctx: TemporalContext,
    yearly_goals: list[dict],
    categories: list[dict],
    existing_monthly_goals: list[dict] | None = None,
) -> dict:
    """
    Structured payload injected into the monthly plan generation prompt.
    """
    budget = compute_monthly_workload(ctx)

    # Summarize yearly goals compactly for the prompt
    yearly_summary = [
        {
            "title": g["title"],
            "category": next(
                (c["name"] for c in categories if c["id"] == g.get("category_id")), "General"
            ),
            "progress_pct": g.get("progress", 0),
            "description": g.get("description", ""),
            "target_date": g.get("target_date", ""),
        }
        for g in yearly_goals
    ]

    return {
        "temporal_context": {
            "month": ctx.current_month,
            "year": ctx.current_year,
            "days_remaining": ctx.days_remaining_in_month,
            "days_in_month": ctx.days_in_month,
            "month_progress_pct": ctx.month_progress_pct,
            "is_late_in_month": ctx.is_late_in_month,
        },
        "workload_budget": {
            "max_main_goals": budget.max_main_goals,
            "max_secondary_goals": budget.max_secondary_goals,
            "max_habits": budget.max_habits,
            "workload_label": budget.workload_label,
            "rationale": budget.rationale,
        },
        "yearly_goals": yearly_summary,
        "categories": [{"id": c["id"], "name": c["name"]} for c in categories],
        "existing_monthly_goals": existing_monthly_goals or [],
    }


def build_weekly_planning_payload(
    ctx: TemporalContext,
    monthly_goals: list[dict],
    yearly_goals: list[dict] | None = None,
    existing_weekly_goals: list[dict] | None = None,
) -> dict:
    """
    Structured payload for weekly plan generation.
    Monthly goals are the parent — weekly goals must serve them.
    """
    budget = compute_weekly_workload(ctx)
    yearly_by_id = {str(g["id"]): g for g in (yearly_goals or []) if g.get("id")}

    monthly_summary = [
        {
            "title": g["title"],
            "is_main": g.get("is_main", False),
            "priority": g.get("priority", "medium"),
            "progress_pct": g.get("progress", 0),
            "description": g.get("description", ""),
            "workload": g.get("workload", ""),
            "parent_yearly_title": (
                yearly_by_id.get(str(g.get("yearly_goal_id")), {}).get("title")
                if g.get("yearly_goal_id")
                else None
            ),
        }
        for g in monthly_goals
    ]

    yearly_summary = [
        {
            "title": g["title"],
            "progress_pct": g.get("progress", 0),
            "description": g.get("description", ""),
        }
        for g in (yearly_goals or [])
    ]

    return {
        "temporal_context": {
            "week_number": ctx.current_week_number,
            "week_start": ctx.week_start.isoformat(),
            "week_end": ctx.week_end.isoformat(),
            "days_remaining": ctx.days_remaining_in_week,
            "week_progress_pct": ctx.week_progress_pct,
            "is_late_in_week": ctx.is_late_in_week,
            "month": ctx.current_month,
            "year": ctx.current_year,
        },
        "workload_budget": {
            "max_main_goals": budget.max_main_goals,
            "max_secondary_goals": budget.max_secondary_goals,
            "max_habits": budget.max_habits,
            "workload_label": budget.workload_label,
            "rationale": budget.rationale,
        },
        "monthly_goals": monthly_summary,
        "yearly_goals": yearly_summary,
        "existing_weekly_goals": existing_weekly_goals or [],
    }


def build_daily_planning_payload(
    ctx: TemporalContext,
    weekly_goals: list[dict],
    weekly_remaining_tasks: int,
    existing_daily: list[dict] | None = None,
    habits: list[dict] | None = None,
    monthly_goals: list[dict] | None = None,
    yearly_goals: list[dict] | None = None,
    yesterday_completion: dict | None = None,
) -> dict:
    """
    Structured payload for daily plan generation.
    Reflects today's position in the week and remaining weekly workload.
    """
    budget = compute_daily_workload(ctx, weekly_remaining_tasks)
    monthly_by_id = {str(g["id"]): g for g in (monthly_goals or []) if g.get("id")}
    yearly_by_id = {str(g["id"]): g for g in (yearly_goals or []) if g.get("id")}

    weekly_summary = [
        {
            "title": g["title"],
            "is_main": g.get("is_main", False),
            "progress_pct": g.get("progress", 0),
            "description": g.get("description", ""),
            "parent_monthly_title": (
                monthly_by_id.get(str(g.get("monthly_goal_id")), {}).get("title")
                if g.get("monthly_goal_id")
                else None
            ),
            "parent_yearly_title": (
                yearly_by_id.get(
                    str(
                        monthly_by_id.get(str(g.get("monthly_goal_id")), {}).get("yearly_goal_id")
                    )
                ).get("title")
                if g.get("monthly_goal_id")
                and monthly_by_id.get(str(g.get("monthly_goal_id")), {}).get("yearly_goal_id")
                and yearly_by_id.get(
                    str(monthly_by_id.get(str(g.get("monthly_goal_id")), {}).get("yearly_goal_id"))
                )
                else None
            ),
        }
        for g in weekly_goals
    ]

    monthly_summary = [
        {
            "title": g["title"],
            "is_main": g.get("is_main", False),
            "progress_pct": g.get("progress", 0),
            "description": g.get("description", ""),
            "workload": g.get("workload", ""),
        }
        for g in (monthly_goals or [])
    ]

    yearly_summary = [
        {
            "title": g["title"],
            "progress_pct": g.get("progress", 0),
            "description": g.get("description", ""),
        }
        for g in (yearly_goals or [])
    ]

    habit_names = [h["name"] for h in (habits or []) if h.get("active")]

    return {
        "temporal_context": {
            "today": ctx.today.isoformat(),
            "day_of_week": ctx.today.strftime("%A"),
            "days_remaining_in_week": ctx.days_remaining_in_week,
            "days_remaining_in_month": ctx.days_remaining_in_month,
            "is_late_in_week": ctx.is_late_in_week,
            "is_late_in_month": ctx.is_late_in_month,
        },
        "workload_budget": {
            "max_daily_priorities": budget.max_daily_priorities,
            "max_secondary_tasks": budget.max_daily_secondary,
            "workload_label": budget.workload_label,
            "rationale": budget.rationale,
        },
        "weekly_goals": weekly_summary,
        "monthly_goals": monthly_summary,
        "yearly_goals": yearly_summary,
        "weekly_tasks_remaining": weekly_remaining_tasks,
        "active_habits": habit_names,
        "existing_daily_items": existing_daily or [],
        "yesterday_completion": yesterday_completion or {},
    }
