"""
Repository for monthly, weekly, and daily plans + their goal/priority children.
"""
from datetime import date
from uuid import UUID
from supabase import Client

from app.db._utils import serialize_payload


# ─── Monthly Plans ────────────────────────────────────────────────────────────

def get_monthly_plan(db: Client, session_id: UUID, year: int, month: int) -> dict | None:
    result = (
        db.table("monthly_plans")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .eq("month", month)
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_monthly_plan(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    result = (
        db.table("monthly_plans")
        .upsert(payload, on_conflict="session_id,year,month")
        .execute()
    )
    return result.data[0]


def update_monthly_plan(db: Client, plan_id: UUID, updates: dict) -> dict:
    result = (
        db.table("monthly_plans")
        .update(serialize_payload(updates))
        .eq("id", str(plan_id))
        .execute()
    )
    return result.data[0]


# ─── Monthly Goals ─────────────────────────────────────────────────────────────

def list_monthly_goals(db: Client, session_id: UUID, year: int, month: int) -> list[dict]:
    result = (
        db.table("monthly_goals")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .eq("month", month)
        .order("is_main", desc=True)
        .order("created_at")
        .execute()
    )
    return result.data or []


def list_monthly_goals_for_year(db: Client, session_id: UUID, year: int) -> list[dict]:
    result = (
        db.table("monthly_goals")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .order("month")
        .order("is_main", desc=True)
        .order("created_at")
        .execute()
    )
    return result.data or []


def get_monthly_goal(db: Client, goal_id: UUID, session_id: UUID) -> dict | None:
    result = (
        db.table("monthly_goals")
        .select("*")
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    return result.data


def bulk_create_monthly_goals(db: Client, goals: list[dict]) -> list[dict]:
    result = db.table("monthly_goals").insert([serialize_payload(goal) for goal in goals]).execute()
    return result.data or []


def create_monthly_goal(db: Client, data: dict) -> dict:
    result = db.table("monthly_goals").insert(serialize_payload(data)).execute()
    return result.data[0]


def update_monthly_goal(db: Client, goal_id: UUID, session_id: UUID, updates: dict) -> dict:
    result = (
        db.table("monthly_goals")
        .update(serialize_payload(updates))
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return result.data[0]


def delete_monthly_goals_for_plan(db: Client, monthly_plan_id: UUID) -> None:
    db.table("monthly_goals").delete().eq("monthly_plan_id", str(monthly_plan_id)).execute()


def delete_monthly_goal(db: Client, goal_id: UUID, session_id: UUID) -> None:
    (
        db.table("monthly_goals")
        .delete()
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .execute()
    )


# ─── Weekly Plans ─────────────────────────────────────────────────────────────

def get_weekly_plan(db: Client, session_id: UUID, year: int, week_number: int) -> dict | None:
    result = (
        db.table("weekly_plans")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .eq("week_number", week_number)
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_weekly_plan(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    result = (
        db.table("weekly_plans")
        .upsert(payload, on_conflict="session_id,year,week_number")
        .execute()
    )
    return result.data[0]


def update_weekly_plan(db: Client, plan_id: UUID, updates: dict) -> dict:
    result = (
        db.table("weekly_plans")
        .update(serialize_payload(updates))
        .eq("id", str(plan_id))
        .execute()
    )
    return result.data[0]


def list_weekly_plans_for_month(db: Client, session_id: UUID, year: int, month: int) -> list[dict]:
    result = (
        db.table("weekly_plans")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .eq("month", month)
        .order("week_number")
        .execute()
    )
    return result.data or []


# ─── Weekly Goals ─────────────────────────────────────────────────────────────

def list_weekly_goals(db: Client, session_id: UUID, year: int, week_number: int) -> list[dict]:
    result = (
        db.table("weekly_goals")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .eq("week_number", week_number)
        .order("is_main", desc=True)
        .order("created_at")
        .execute()
    )
    return result.data or []


def list_weekly_goals_for_year(db: Client, session_id: UUID, year: int) -> list[dict]:
    result = (
        db.table("weekly_goals")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .order("week_number")
        .order("is_main", desc=True)
        .order("created_at")
        .execute()
    )
    return result.data or []


def get_weekly_goal(db: Client, goal_id: UUID, session_id: UUID) -> dict | None:
    result = (
        db.table("weekly_goals")
        .select("*")
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    return result.data


def bulk_create_weekly_goals(db: Client, goals: list[dict]) -> list[dict]:
    result = db.table("weekly_goals").insert([serialize_payload(goal) for goal in goals]).execute()
    return result.data or []


def create_weekly_goal(db: Client, data: dict) -> dict:
    result = db.table("weekly_goals").insert(serialize_payload(data)).execute()
    return result.data[0]


def update_weekly_goal(db: Client, goal_id: UUID, session_id: UUID, updates: dict) -> dict:
    result = (
        db.table("weekly_goals")
        .update(serialize_payload(updates))
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return result.data[0]


def delete_weekly_goals_for_plan(db: Client, weekly_plan_id: UUID) -> None:
    db.table("weekly_goals").delete().eq("weekly_plan_id", str(weekly_plan_id)).execute()


def delete_weekly_goal(db: Client, goal_id: UUID, session_id: UUID) -> None:
    (
        db.table("weekly_goals")
        .delete()
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .execute()
    )


# ─── Daily Plans ──────────────────────────────────────────────────────────────

def get_daily_plan(db: Client, session_id: UUID, plan_date: date) -> dict | None:
    result = (
        db.table("daily_plans")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("date", plan_date.isoformat())
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_daily_plan(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    result = (
        db.table("daily_plans")
        .upsert(payload, on_conflict="session_id,date")
        .execute()
    )
    return result.data[0]


def update_daily_plan(db: Client, plan_id: UUID, updates: dict) -> dict:
    result = (
        db.table("daily_plans")
        .update(serialize_payload(updates))
        .eq("id", str(plan_id))
        .execute()
    )
    return result.data[0]


def list_daily_plans_for_week(
    db: Client, session_id: UUID, week_start: date, week_end: date
) -> list[dict]:
    result = (
        db.table("daily_plans")
        .select("*")
        .eq("session_id", str(session_id))
        .gte("date", week_start.isoformat())
        .lte("date", week_end.isoformat())
        .order("date")
        .execute()
    )
    return result.data or []


# ─── Daily Priorities ─────────────────────────────────────────────────────────

def list_daily_priorities(db: Client, session_id: UUID, plan_date: date) -> list[dict]:
    result = (
        db.table("daily_priorities")
        .select("*")
        .eq("session_id", str(session_id))
        .eq("date", plan_date.isoformat())
        .order("is_main", desc=True)
        .order("priority")
        .execute()
    )
    return result.data or []


def list_daily_priorities_for_range(
    db: Client,
    session_id: UUID,
    start_date: date,
    end_date: date,
) -> list[dict]:
    result = (
        db.table("daily_priorities")
        .select("*")
        .eq("session_id", str(session_id))
        .gte("date", start_date.isoformat())
        .lte("date", end_date.isoformat())
        .order("date")
        .order("is_main", desc=True)
        .order("priority")
        .execute()
    )
    return result.data or []


def get_daily_priority(db: Client, priority_id: UUID, session_id: UUID) -> dict | None:
    result = (
        db.table("daily_priorities")
        .select("*")
        .eq("id", str(priority_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    return result.data


def bulk_create_daily_priorities(db: Client, items: list[dict]) -> list[dict]:
    result = db.table("daily_priorities").insert([serialize_payload(item) for item in items]).execute()
    return result.data or []


def create_daily_priority(db: Client, data: dict) -> dict:
    result = db.table("daily_priorities").insert(serialize_payload(data)).execute()
    return result.data[0]


def update_daily_priority(db: Client, priority_id: UUID, session_id: UUID, updates: dict) -> dict:
    result = (
        db.table("daily_priorities")
        .update(serialize_payload(updates))
        .eq("id", str(priority_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return result.data[0]


def delete_daily_priorities_for_plan(db: Client, daily_plan_id: UUID) -> None:
    db.table("daily_priorities").delete().eq("daily_plan_id", str(daily_plan_id)).execute()
