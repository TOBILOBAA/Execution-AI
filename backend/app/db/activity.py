"""Analytics activity repository."""
from __future__ import annotations

from datetime import date
from uuid import UUID

from postgrest.exceptions import APIError
from supabase import Client

from app.core.logging import logger
from app.db._utils import serialize_payload


TABLE = "daily_user_activity"
DEVICE_TABLE = "user_device_activity"


def _analytics_relation_missing(exc: APIError) -> bool:
    details = str(exc).lower()
    return (
        "daily_user_activity" in details
        and ("does not exist" in details or "schema cache" in details or "pgrst" in details)
    )


def _guard_analytics(exc: APIError) -> bool:
    if _analytics_relation_missing(exc):
        logger.warning("analytics_schema_missing", error=str(exc))
        return True
    return False


def get_daily_activity(db: Client, session_id: UUID, activity_date: date) -> dict | None:
    try:
        result = (
            db.table(TABLE)
            .select("*")
            .eq("session_id", str(session_id))
            .eq("activity_date", activity_date.isoformat())
            .maybe_single()
            .execute()
        )
    except APIError as exc:
        if _guard_analytics(exc):
            return None
        raise
    if result is None:
        return None
    return getattr(result, "data", None)


def upsert_daily_activity(db: Client, payload: dict) -> dict | None:
    try:
        result = (
            db.table(TABLE)
            .upsert(serialize_payload(payload), on_conflict="session_id,activity_date")
            .execute()
        )
    except APIError as exc:
        if _guard_analytics(exc):
            return None
        raise
    return result.data[0] if result.data else None


def list_daily_activity(
    db: Client,
    *,
    auth_user_id: str | None = None,
    session_id: UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int | None = None,
) -> list[dict]:
    try:
        query = db.table(TABLE).select("*").order("activity_date", desc=True).order("last_seen_at", desc=True)
        if auth_user_id:
            query = query.eq("auth_user_id", auth_user_id)
        if session_id:
            query = query.eq("session_id", str(session_id))
        if start_date:
            query = query.gte("activity_date", start_date.isoformat())
        if end_date:
            query = query.lte("activity_date", end_date.isoformat())
        if limit is not None:
            query = query.limit(limit)
        result = query.execute()
    except APIError as exc:
        if _guard_analytics(exc):
            return []
        raise
    return result.data or []


def upsert_user_device_activity(db: Client, payload: dict) -> dict | None:
    try:
        result = (
            db.table(DEVICE_TABLE)
            .upsert(
                serialize_payload(payload),
                on_conflict="auth_user_id,session_id,device_type,device_family,os_name,browser_name",
            )
            .execute()
        )
    except APIError as exc:
        details = str(exc).lower()
        if "user_device_activity" in details and ("does not exist" in details or "schema cache" in details or "pgrst" in details):
            logger.warning("analytics_device_schema_missing", error=str(exc))
            return None
        raise
    return result.data[0] if result.data else None


def list_user_device_activity(
    db: Client,
    *,
    auth_user_id: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    try:
        query = db.table(DEVICE_TABLE).select("*").order("last_seen_at", desc=True).order("created_at", desc=True)
        if auth_user_id:
            query = query.eq("auth_user_id", auth_user_id)
        if limit is not None:
            query = query.limit(limit)
        result = query.execute()
    except APIError as exc:
        details = str(exc).lower()
        if "user_device_activity" in details and ("does not exist" in details or "schema cache" in details or "pgrst" in details):
            logger.warning("analytics_device_schema_missing", error=str(exc))
            return []
        raise
    return result.data or []
