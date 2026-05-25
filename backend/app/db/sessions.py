"""Session / workspace repository."""
from uuid import UUID
from postgrest.exceptions import APIError
from supabase import Client

from app.db._utils import serialize_payload
from app.utils.date_utils import resolve_week_starts_on


TABLE = "sessions"


def _is_missing_column(exc: APIError, column_name: str) -> bool:
    details = str(exc)
    return column_name in details and (
        "PGRST204" in details or "schema cache" in details
    )


def _is_missing_week_starts_on_column(exc: APIError) -> bool:
    return _is_missing_column(exc, "week_starts_on")


def _drop_unsupported_session_columns(payload: dict, exc: APIError) -> dict:
    unsupported = {
        key
        for key in (
            "week_starts_on",
            "pending_recaps",
            "handled_recaps",
            "last_seen_at",
            "last_active_at",
            "last_opened_date_local",
        )
        if key in payload and _is_missing_column(exc, key)
    }
    if not unsupported:
        return payload
    return {key: value for key, value in payload.items() if key not in unsupported}


def _hydrate_session_defaults(session: dict | None) -> dict | None:
    if not session:
        return session
    return {
        **session,
        "week_starts_on": resolve_week_starts_on(
            session.get("week_starts_on"),
            session.get("timezone"),
        ),
        "pending_recaps": session.get("pending_recaps") or [],
        "handled_recaps": session.get("handled_recaps") or [],
    }


def get_session_by_auth_user_id(db: Client, auth_user_id: str) -> dict | None:
    result = (
        db.table(TABLE)
        .select("*")
        .eq("auth_user_id", auth_user_id)
        .order("updated_at", desc=True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return _hydrate_session_defaults(result.data[0] if result.data else None)


def create_session(
    db: Client,
    device_hint: str | None,
    timezone: str,
    auth_user_id: str | None = None,
    week_starts_on: str | None = None,
) -> dict:
    payload = {
        "device_hint": device_hint,
        "timezone": timezone,
        "auth_user_id": auth_user_id,
    }
    if week_starts_on is not None:
        payload["week_starts_on"] = resolve_week_starts_on(week_starts_on, timezone)
    try:
        result = db.table(TABLE).insert(serialize_payload(payload)).execute()
    except APIError as exc:
        fallback_payload = _drop_unsupported_session_columns(payload, exc)
        if fallback_payload == payload:
            if "week_starts_on" not in payload or not _is_missing_week_starts_on_column(exc):
                raise
            fallback_payload = {key: value for key, value in payload.items() if key != "week_starts_on"}
        result = db.table(TABLE).insert(serialize_payload(fallback_payload)).execute()
    return _hydrate_session_defaults(result.data[0])


def get_or_create_session(
    db: Client,
    device_hint: str | None,
    timezone: str,
    auth_user_id: str | None = None,
    week_starts_on: str | None = None,
) -> dict:
    if auth_user_id:
        existing = get_session_by_auth_user_id(db, auth_user_id)
        if existing:
            return existing
    return create_session(
        db,
        device_hint,
        timezone,
        auth_user_id=auth_user_id,
        week_starts_on=week_starts_on,
    )


def get_session(db: Client, session_id: UUID) -> dict | None:
    result = (
        db.table(TABLE).select("*").eq("id", str(session_id)).maybe_single().execute()
    )
    return _hydrate_session_defaults(result.data)


def update_session(db: Client, session_id: UUID, updates: dict) -> dict:
    payload = dict(updates)
    next_timezone = payload.get("timezone")
    if "week_starts_on" in payload or "timezone" in payload:
        current = get_session(db, session_id)
        payload["week_starts_on"] = resolve_week_starts_on(
            payload.get("week_starts_on", current.get("week_starts_on") if current else None),
            next_timezone or (current.get("timezone") if current else None),
        )
    result = (
        db.table(TABLE)
        .update(serialize_payload(payload))
        .eq("id", str(session_id))
    )
    try:
        updated = result.execute()
    except APIError as exc:
        fallback_payload = _drop_unsupported_session_columns(payload, exc)
        if fallback_payload == payload:
            raise
        updated = (
            db.table(TABLE)
            .update(serialize_payload(fallback_payload))
            .eq("id", str(session_id))
            .execute()
        )
    return _hydrate_session_defaults(updated.data[0])


def get_effective_week_starts_on(db: Client, session_id: UUID) -> str:
    session = get_session(db, session_id)
    return session["week_starts_on"] if session else "monday"


def list_sessions(db: Client, limit: int | None = 100) -> list[dict]:
    query = (
        db.table(TABLE)
        .select("*")
        .order("updated_at", desc=True)
        .order("created_at", desc=True)
    )
    if limit is not None:
        query = query.limit(limit)
    result = query.execute()
    return [_hydrate_session_defaults(row) for row in (result.data or [])]
