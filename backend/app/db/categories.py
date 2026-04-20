"""Category repository."""
from uuid import UUID
from supabase import Client

from app.db._utils import serialize_payload

TABLE = "categories"


def list_categories(db: Client, session_id: UUID) -> list[dict]:
    result = (
        db.table(TABLE)
        .select("*")
        .eq("session_id", str(session_id))
        .order("sort_order")
        .execute()
    )
    return result.data or []


def create_category(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    result = db.table(TABLE).insert(payload).execute()
    return result.data[0]


def delete_category(db: Client, session_id: UUID, category_id: UUID) -> bool:
    result = (
        db.table(TABLE)
        .delete()
        .eq("id", str(category_id))
        .eq("session_id", str(session_id))
        .execute()
    )
    return bool(result.data)
