from datetime import date
from uuid import UUID

from supabase import Client

from app.db._utils import serialize_payload


TABLE = "daily_user_activity"


def get_daily_activity(db: Client, session_id: UUID, activity_date: date) -> dict | None:
    result = (
        db.table(TABLE)
        .select("*")
        .eq("session_id", str(session_id))
        .eq("activity_date", activity_date.isoformat())
        .maybe_single()
        .execute()
    )
    return result.data


def upsert_daily_activity(db: Client, payload: dict) -> dict:
    result = (
        db.table(TABLE)
        .upsert(serialize_payload(payload), on_conflict="session_id,activity_date")
        .execute()
    )
    return result.data[0]


def list_daily_activity(
    db: Client,
    session_id: UUID,
    *,
    since: date | None = None,
    until: date | None = None,
    limit: int | None = None,
) -> list[dict]:
    query = (
        db.table(TABLE)
        .select("*")
        .eq("session_id", str(session_id))
        .order("activity_date", desc=True)
    )
    if since is not None:
        query = query.gte("activity_date", since.isoformat())
    if until is not None:
        query = query.lte("activity_date", until.isoformat())
    if limit is not None:
        query = query.limit(limit)
    result = query.execute()
    return result.data or []
