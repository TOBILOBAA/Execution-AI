"""Grounded context builders for report AI prompts.

These helpers are DB-aware by design. They assemble factual evidence from the
user's saved plans, execution rows, and habit logs so `ai_service.py` can stay
purely focused on prompt formatting and schema validation.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from uuid import UUID

from supabase import Client

import app.db.categories as categories_db
import app.db.habits as habits_db
import app.db.plans as plans_db
import app.db.sessions as sessions_db
import app.db.yearly_goals as yearly_goals_db
from app.utils.date_utils import week_start_for


WEEKDAY_KEYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


def _date_range(start: date, end: date) -> list[date]:
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(days + 1)]


def _month_keys_in_range(start: date, end: date) -> list[tuple[int, int]]:
    keys: list[tuple[int, int]] = []
    cursor = date(start.year, start.month, 1)
    limit = date(end.year, end.month, 1)
    while cursor <= limit:
        keys.append((cursor.year, cursor.month))
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return keys


def _year_keys_in_range(start: date, end: date) -> list[int]:
    return list(range(start.year, end.year + 1))


def _weekly_plan_rows_in_range(db: Client, session_id: UUID, start: date, end: date) -> list[dict]:
    result = (
        db.table("weekly_plans")
        .select("*")
        .eq("session_id", str(session_id))
        .lte("week_start", end.isoformat())
        .gte("week_end", start.isoformat())
        .order("year")
        .order("week_number")
        .execute()
    )
    return result.data or []


def _load_goals_and_habits(db: Client, session_id: UUID, period_start: date, period_end: date) -> dict:
    yearly_goals: list[dict] = []
    for year in _year_keys_in_range(period_start, period_end):
        yearly_goals.extend(yearly_goals_db.list_yearly_goals(db, session_id, year))

    monthly_goals: list[dict] = []
    for year, month in _month_keys_in_range(period_start, period_end):
        monthly_goals.extend(plans_db.list_monthly_goals(db, session_id, year, month))

    weekly_plan_rows = _weekly_plan_rows_in_range(db, session_id, period_start, period_end)
    weekly_goals: list[dict] = []
    seen_week_keys: set[tuple[int, int]] = set()
    for row in weekly_plan_rows:
        week_key = (row["year"], row["week_number"])
        if week_key in seen_week_keys:
            continue
        weekly_goals.extend(plans_db.list_weekly_goals(db, session_id, row["year"], row["week_number"]))
        seen_week_keys.add(week_key)

    habits = habits_db.list_habits(db, session_id, active_only=False)
    categories = categories_db.list_categories(db, session_id)
    return {
        "yearly_goals": yearly_goals,
        "monthly_goals": monthly_goals,
        "weekly_goals": weekly_goals,
        "weekly_plans": weekly_plan_rows,
        "habits": habits,
        "categories": categories,
    }


def _parse_completed_at(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _expected_habit_occurrences(
    habit: dict,
    period_start: date,
    period_end: date,
    week_starts_on: str,
) -> int:
    frequency = (habit.get("frequency") or "daily").lower()
    days = _date_range(period_start, period_end)
    if frequency == "daily":
        return len(days)
    if frequency == "weekdays":
        return sum(1 for day in days if day.weekday() < 5)
    if frequency == "weekends":
        return sum(1 for day in days if day.weekday() >= 5)
    week_count = len({week_start_for(day, week_starts_on) for day in days})
    if frequency == "weekly":
        return week_count
    if frequency == "3x_week":
        return week_count * 3
    if frequency == "5x_week":
        return week_count * 5
    return len(days)


def build_execution_diary(session_id: UUID, period_start: date, period_end: date, db: Client) -> dict:
    """Build the structured diary block required by spec §8a for report prompts."""
    week_starts_on = sessions_db.get_effective_week_starts_on(db, session_id)
    loaded = _load_goals_and_habits(db, session_id, period_start, period_end)
    priorities = plans_db.list_daily_priorities_for_range(db, session_id, period_start, period_end)
    habit_logs = habits_db.list_habit_logs_for_session(db, session_id, period_start, period_end)

    category_lookup = {row["id"]: row["name"] for row in loaded["categories"]}
    yearly_by_id = {row["id"]: row for row in loaded["yearly_goals"]}
    monthly_by_id = {row["id"]: row for row in loaded["monthly_goals"]}
    weekly_by_id = {row["id"]: row for row in loaded["weekly_goals"]}

    by_day: dict[str, list[dict]] = defaultdict(list)
    for item in priorities:
        by_day[item["date"]].append(item)

    daily_completion_counts: list[dict] = []
    weekday_slip_values: dict[str, list[int]] = {weekday: [] for weekday in WEEKDAY_KEYS}
    for day in _date_range(period_start, period_end):
        day_items = by_day.get(day.isoformat(), [])
        complete = sum(1 for item in day_items if item.get("completed"))
        total = len(day_items)
        daily_completion_counts.append({
            "date": day.isoformat(),
            "complete": complete,
            "total": total,
        })
        if total > 0:
            slip_pct = round(((total - complete) / total) * 100)
            weekday_slip_values[WEEKDAY_KEYS[day.weekday()]].append(slip_pct)

    weekday_slip_rates = {
        weekday: (
            round(sum(values) / len(values))
            if values
            else 0
        )
        for weekday, values in weekday_slip_values.items()
    }

    category_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"complete": 0, "total": 0})
    for item in priorities:
        weekly_goal = weekly_by_id.get(item.get("weekly_goal_id"))
        monthly_goal = monthly_by_id.get(weekly_goal.get("monthly_goal_id")) if weekly_goal else None
        yearly_goal = yearly_by_id.get(monthly_goal.get("yearly_goal_id")) if monthly_goal else None
        category_name = category_lookup.get(
            (monthly_goal or {}).get("category_id") or (yearly_goal or {}).get("category_id"),
            "Unlinked",
        )
        category_totals[category_name]["total"] += 1
        if item.get("completed"):
            category_totals[category_name]["complete"] += 1

    category_completion = {
        category: round((counts["complete"] / counts["total"]) * 100) if counts["total"] else 0
        for category, counts in sorted(category_totals.items())
    }

    logs_by_habit: dict[str, list[dict]] = defaultdict(list)
    for log in habit_logs:
        logs_by_habit[log["habit_id"]].append(log)

    habit_holds: list[dict] = []
    for habit in loaded["habits"]:
        logs = logs_by_habit.get(habit["id"], [])
        completed_count = sum(1 for log in logs if log.get("completed"))
        explicit_drops = sum(1 for log in logs if not log.get("completed"))
        expected_total = _expected_habit_occurrences(
            habit,
            period_start,
            period_end,
            week_starts_on,
        )
        days_dropped = max(explicit_drops, expected_total - completed_count)
        if completed_count == 0 and days_dropped == 0:
            continue
        habit_holds.append({
            "habit_name": habit["name"],
            "days_held": completed_count,
            "days_dropped": days_dropped,
        })

    goals_shipped: list[str] = []
    goals_missed: list[str] = []
    for group in (loaded["yearly_goals"], loaded["monthly_goals"], loaded["weekly_goals"]):
        for goal in group:
            status = goal.get("status")
            if status == "completed":
                goals_shipped.append(goal["title"])
            elif status == "missed":
                goals_missed.append(goal["title"])

    late_completions: list[dict] = []
    for item in priorities:
        if not item.get("completed"):
            continue
        completed_at = _parse_completed_at(item.get("completed_at"))
        scheduled_for = item.get("date")
        if completed_at is None or not scheduled_for:
            continue
        if completed_at.date().isoformat() > scheduled_for:
            late_completions.append({
                "title": item["title"],
                "completed_at": completed_at.isoformat(),
                "scheduled_for": scheduled_for,
            })

    return {
        "daily_completion_counts": daily_completion_counts,
        "weekday_slip_rates": weekday_slip_rates,
        "category_completion": category_completion,
        "habit_holds": habit_holds,
        "goals_shipped": list(dict.fromkeys(goals_shipped)),
        "goals_missed": list(dict.fromkeys(goals_missed)),
        "late_completions": late_completions,
    }


def build_report_prompt_context(session_id: UUID, period_start: date, period_end: date, db: Client) -> dict:
    """Build the hierarchy/habit context block used by report prompts."""
    loaded = _load_goals_and_habits(db, session_id, period_start, period_end)
    category_lookup = {row["id"]: row["name"] for row in loaded["categories"]}
    yearly_by_id = {row["id"]: row for row in loaded["yearly_goals"]}
    monthly_by_id = {row["id"]: row for row in loaded["monthly_goals"]}

    yearly_full = [
        {
            "title": goal["title"],
            "description": goal.get("description"),
            "target_date": goal.get("target_date"),
            "category": category_lookup.get(goal.get("category_id"), "Uncategorized"),
            "progress": goal.get("progress", 0),
        }
        for goal in loaded["yearly_goals"]
    ]
    yearly_summary = [
        {
            "title": goal["title"],
            "progress": goal.get("progress", 0),
        }
        for goal in loaded["yearly_goals"]
    ]

    monthly_full = []
    monthly_summary = []
    for goal in loaded["monthly_goals"]:
        parent_yearly = yearly_by_id.get(goal.get("yearly_goal_id"))
        row = {
            "title": goal["title"],
            "description": goal.get("description"),
            "workload": goal.get("workload"),
            "is_main": goal.get("is_main", False),
            "progress": goal.get("progress", 0),
            "parent_yearly_title": parent_yearly.get("title") if parent_yearly else None,
            "category": category_lookup.get(
                goal.get("category_id") or (parent_yearly or {}).get("category_id"),
                "Uncategorized",
            ),
            "target_date": goal.get("target_date"),
        }
        monthly_full.append(row)
        monthly_summary.append({
            "title": goal["title"],
            "progress": goal.get("progress", 0),
            "parent_yearly_title": row["parent_yearly_title"],
        })

    weekly_full = []
    weekly_summary = []
    for goal in loaded["weekly_goals"]:
        parent_monthly = monthly_by_id.get(goal.get("monthly_goal_id"))
        parent_yearly = yearly_by_id.get(parent_monthly.get("yearly_goal_id")) if parent_monthly else None
        row = {
            "title": goal["title"],
            "description": goal.get("description"),
            "target_day": goal.get("target_day"),
            "is_main": goal.get("is_main", False),
            "progress": goal.get("progress", 0),
            "parent_monthly_title": parent_monthly.get("title") if parent_monthly else None,
            "parent_yearly_title": parent_yearly.get("title") if parent_yearly else None,
            "workload": goal.get("workload"),
        }
        weekly_full.append(row)
        weekly_summary.append({
            "title": goal["title"],
            "progress": goal.get("progress", 0),
            "parent_monthly_title": row["parent_monthly_title"],
        })

    active_habits = [
        {
            "name": habit["name"],
            "frequency": habit.get("frequency", "daily"),
            "category": category_lookup.get(habit.get("category_id"), "Uncategorized"),
        }
        for habit in loaded["habits"]
        if habit.get("active", True)
    ]

    return {
        "yearly_goals_full": yearly_full,
        "yearly_goals_summary": yearly_summary,
        "monthly_goals_full": monthly_full,
        "monthly_goals_summary": monthly_summary,
        "weekly_goals_full": weekly_full,
        "weekly_goals_summary": weekly_summary,
        "active_habits": active_habits,
    }
