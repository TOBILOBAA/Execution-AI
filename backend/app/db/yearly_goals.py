"""Yearly goals repository."""
from uuid import UUID
from supabase import Client

from app.db._utils import serialize_payload

TABLE = "yearly_goals"


def list_yearly_goals(db: Client, session_id: UUID, year: int) -> list[dict]:
    result = (
        db.table(TABLE)
        .select("*")
        .eq("session_id", str(session_id))
        .eq("year", year)
        .order("created_at")
        .execute()
    )
    return result.data or []


def get_yearly_goal(db: Client, goal_id: UUID, session_id: UUID) -> dict | None:
    result = (
        db.table(TABLE)
        .select("*")
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .maybe_single()
        .execute()
    )
    return result.data


def create_yearly_goal(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    result = db.table(TABLE).insert(payload).execute()
    return result.data[0]


def update_yearly_goal(db: Client, goal_id: UUID, session_id: UUID, updates: dict) -> dict:
    result = (
        db.table(TABLE)
        .update(serialize_payload(updates))
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return result.data[0]


def delete_yearly_goal(db: Client, goal_id: UUID, session_id: UUID) -> bool:
    result = (
        db.table(TABLE)
        .delete()
        .eq("id", str(goal_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return bool(result.data)
