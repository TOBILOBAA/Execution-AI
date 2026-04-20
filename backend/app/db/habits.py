"""Habits and habit log repository."""
from datetime import date
from uuid import UUID
from supabase import Client

from app.db._utils import serialize_payload


# ─── Habits ───────────────────────────────────────────────────────────────────

def list_habits(db: Client, session_id: UUID, active_only: bool = False) -> list[dict]:
    query = (
        db.table("foundational_habits")
        .select("*")
        .eq("session_id", str(session_id))
        .order("sort_order")
    )
    if active_only:
        query = query.eq("active", True)
    return query.execute().data or []


def get_habit(db: Client, habit_id: UUID, session_id: UUID) -> dict | None:
    result = (
        db.table("foundational_habits")
        .select("*")
        .eq("id", str(habit_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    return result.data


def create_habit(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    result = db.table("foundational_habits").insert(payload).execute()
    return result.data[0]


def update_habit(db: Client, habit_id: UUID, session_id: UUID, updates: dict) -> dict:
    result = (
        db.table("foundational_habits")
        .update(serialize_payload(updates))
        .eq("id", str(habit_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return result.data[0]


def delete_habit(db: Client, habit_id: UUID, session_id: UUID) -> bool:
    result = (
        db.table("foundational_habits")
        .delete()
        .eq("id", str(habit_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return bool(result.data)


# ─── Habit Logs ───────────────────────────────────────────────────────────────

def get_habit_log(db: Client, habit_id: UUID, log_date: date) -> dict | None:
    result = (
        db.table("habit_logs")
        .select("*")
        .eq("habit_id", str(habit_id))
        .eq("date", log_date.isoformat())
        .execute()
    )
    return result.data[0] if result.data else None


def upsert_habit_log(db: Client, habit_id: UUID, session_id: UUID, log_date: date, completed: bool) -> dict:
    from datetime import datetime
    payload = serialize_payload({
        "habit_id": str(habit_id),
        "session_id": str(session_id),
        "date": log_date.isoformat(),
        "completed": completed,
        "completed_at": datetime.utcnow().isoformat() if completed else None,
    })
    result = (
        db.table("habit_logs")
        .upsert(payload, on_conflict="habit_id,date")
        .execute()
    )
    return result.data[0]


def list_habit_logs_for_session(
    db: Client, session_id: UUID, since: date, until: date
) -> list[dict]:
    result = (
        db.table("habit_logs")
        .select("*")
        .eq("session_id", str(session_id))
        .gte("date", since.isoformat())
        .lte("date", until.isoformat())
        .execute()
    )
    return result.data or []


def list_habit_logs_for_habit(
    db: Client, habit_id: UUID, since: date, until: date
) -> list[dict]:
    result = (
        db.table("habit_logs")
        .select("*")
        .eq("habit_id", str(habit_id))
        .gte("date", since.isoformat())
        .lte("date", until.isoformat())
        .order("date", desc=True)
        .execute()
    )
    return result.data or []
