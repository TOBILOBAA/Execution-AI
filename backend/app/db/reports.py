"""Report snapshot repository."""
from datetime import date
from uuid import UUID
from supabase import Client

from app.db._utils import serialize_payload

TABLE = "report_snapshots"


def _natural_lookup_fields(
    report_type: str,
    period_month: int | None = None,
    period_quarter: int | None = None,
    period_week: int | None = None,
    period_date: date | None = None,
) -> dict[str, int | str]:
    if report_type == "daily":
        return {"period_date": period_date.isoformat()} if period_date is not None else {}
    if report_type == "weekly":
        return {"period_week": period_week} if period_week is not None else {}
    if report_type == "monthly":
        return {"period_month": period_month} if period_month is not None else {}
    if report_type == "quarterly":
        return {"period_quarter": period_quarter} if period_quarter is not None else {}
    return {}


def get_report(
    db: Client,
    session_id: UUID,
    report_type: str,
    period_year: int,
    period_month: int | None = None,
    period_quarter: int | None = None,
    period_week: int | None = None,
    period_date: date | None = None,
) -> dict | None:
    query = (
        db.table(TABLE)
        .select("*")
        .eq("session_id", str(session_id))
        .eq("report_type", report_type)
        .eq("period_year", period_year)
    )
    for field, value in _natural_lookup_fields(
        report_type,
        period_month=period_month,
        period_quarter=period_quarter,
        period_week=period_week,
        period_date=period_date,
    ).items():
        query = query.eq(field, value)
    result = query.execute()
    return result.data[0] if result.data else None


def upsert_report(db: Client, session_id: UUID, data: dict) -> dict:
    payload = serialize_payload({**data, "session_id": str(session_id)})
    report_type = payload.get("report_type")
    if report_type not in {"daily", "weekly", "monthly", "quarterly", "yearly"}:
        raise ValueError(f"Unsupported report_type: {report_type!r}")

    # PostgREST upsert cannot target our partial unique indexes directly, so we
    # resolve the natural key in application code and then perform either an
    # update or an insert. This keeps report persistence compatible with the
    # per-report-type uniqueness constraints created in migration 006.
    existing = get_report(
        db,
        session_id,
        report_type=report_type,
        period_year=payload["period_year"],
        period_month=payload.get("period_month"),
        period_quarter=payload.get("period_quarter"),
        period_week=payload.get("period_week"),
        period_date=date.fromisoformat(payload["period_date"]) if payload.get("period_date") else None,
    )
    if existing:
        return update_report(db, existing["id"], payload)

    result = db.table(TABLE).insert(payload).execute()
    return result.data[0]


def update_report(db: Client, report_id: UUID, updates: dict) -> dict:
    result = (
        db.table(TABLE)
        .update(updates)
        .eq("id", str(report_id))
        .execute()
    )
    return result.data[0]


def list_reports(
    db: Client, session_id: UUID, report_type: str | None = None
) -> list[dict]:
    query = db.table(TABLE).select("*").eq("session_id", str(session_id))
    if report_type:
        query = query.eq("report_type", report_type)
    result = (
        query
        .order("period_year", desc=True)
        .order("period_quarter", desc=True)
        .order("period_month", desc=True)
        .order("period_week", desc=True)
        .order("period_date", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def log_ai_generation(db: Client, data: dict) -> None:
    db.table("ai_generations").insert(serialize_payload(data)).execute()
